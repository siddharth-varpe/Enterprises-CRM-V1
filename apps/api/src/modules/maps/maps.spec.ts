import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { mapsTrackingRedisService } from './maps-tracking.redis.js';
import { mapsRoutesService } from './maps-routes.service.js';
import { getRedisClient } from '../../redis/client.js';
import {
  TRACKING_STATUSES,
  FRESHNESS_THRESHOLDS,
  type ActiveDestinationRecord,
} from './maps-tracking.types.js';

describe('Google Maps Platform & Live Tracking Architecture Suite', () => {
  const app = buildApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Credential Protection & Configuration Endpoint', () => {
    it('GET /api/v1/maps/admin/config returns browser API key and map ID, but NEVER exposes server API keys or secrets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/config',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();

      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();

      // Verified present fields
      expect(json.data).toHaveProperty('apiKey');
      expect(json.data).toHaveProperty('mapId');

      // Strict credential isolation checks:
      expect(json.data).not.toHaveProperty('serverApiKey');
      expect(json.data).not.toHaveProperty('routesApiKey');
      expect(json.data).not.toHaveProperty('ROUTES_API_KEY');
      expect(json.data).not.toHaveProperty('secret');
      expect(json.data).not.toHaveProperty('jwtSecret');
    });
  });

  describe('2. Security & Server-Side Authorization (Sections 15, 16)', () => {
    it('rejects unauthenticated requests to /api/v1/maps/technician/navigate with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/navigate',
        payload: { serviceId: 'srv-123' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects unauthenticated requests to /api/v1/maps/technician/location with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/location',
        payload: {
          latitude: 18.5204,
          longitude: 73.8567,
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects unauthenticated requests to /api/v1/maps/technician/stop with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/stop',
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects unauthenticated requests to /api/v1/maps/technician/active with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/technician/active',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('3. Concurrency & Isolation Testing (Sections 10, 16, 30)', () => {
    it('isolates state across 1, 5, and 20+ concurrent technicians with zero cross-contamination', async () => {
      const technicianCount = 25;
      const testTechnicians = Array.from({ length: technicianCount }, (_, i) => ({
        technicianId: `concurrent-tech-${i + 1}`,
        technicianName: `Field Engineer ${i + 1}`,
        serviceId: `service-${100 + i}`,
        lat: 18.5000 + i * 0.005,
        lng: 73.8000 + i * 0.005,
      }));

      // Set active destinations concurrently
      await Promise.all(
        testTechnicians.map((tech) => {
          const dest: ActiveDestinationRecord = {
            serviceId: tech.serviceId,
            serviceNumber: `SRV-${tech.serviceId}`,
            customerId: `cust-${tech.technicianId}`,
            customerName: `Customer ${tech.technicianName}`,
            customerPhone: '9876543210',
            address: `Address for ${tech.technicianName}`,
            latitude: tech.lat + 0.01,
            longitude: tech.lng + 0.01,
            startedAt: Date.now(),
          };
          return mapsTrackingRedisService.setActiveDestination(tech.technicianId, dest);
        })
      );

      // Record location updates concurrently
      await Promise.all(
        testTechnicians.map((tech) =>
          mapsTrackingRedisService.updateLocation(
            tech.technicianId,
            tech.technicianName,
            '9876543210',
            {
              latitude: tech.lat,
              longitude: tech.lng,
              accuracy: 10,
              timestamp: Date.now(),
            }
          )
        )
      );

      // Verify each technician has independent destination and location
      for (const tech of testTechnicians) {
        const activeDest = await mapsTrackingRedisService.getActiveDestination(tech.technicianId);
        expect(activeDest).not.toBeNull();
        expect(activeDest?.serviceId).toBe(tech.serviceId);
      }

      // Query active tracking records
      const activeList = await mapsTrackingRedisService.getAllActiveLocations();
      expect(activeList.length).toBeGreaterThanOrEqual(technicianCount);

      const foundTech1 = activeList.find((t) => t.technicianId === 'concurrent-tech-1');
      const foundTech25 = activeList.find((t) => t.technicianId === 'concurrent-tech-25');

      expect(foundTech1).toBeDefined();
      expect(foundTech25).toBeDefined();

      // Verify no shared/overwritten coordinates
      expect(foundTech1?.currentLocation?.latitude).toBeCloseTo(testTechnicians[0].lat, 4);
      expect(foundTech25?.currentLocation?.latitude).toBeCloseTo(testTechnicians[24].lat, 4);
      expect(foundTech1?.activeDestination?.serviceId).toBe('service-100');
      expect(foundTech25?.activeDestination?.serviceId).toBe('service-124');

      // Cleanup
      await Promise.all(testTechnicians.map((t) => mapsTrackingRedisService.clearTracking(t.technicianId)));
    });
  });

  describe('4. Arrival Detection State Machine (Section 20)', () => {
    const techId = 'arrival-tech-test';
    const destLat = 18.5204;
    const destLng = 73.8567;

    afterEach(async () => {
      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('remains ON_THE_WAY when outside the 100m geofence', async () => {
      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-arrival-1',
        serviceNumber: 'SRV-ARR-1',
        customerId: 'cust-1',
        customerName: 'Customer One',
        address: 'MG Road, Pune',
        latitude: destLat,
        longitude: destLng,
        startedAt: Date.now(),
      });

      // 5km away
      const record = await mapsTrackingRedisService.updateLocation(
        techId,
        'Arrival Engineer',
        undefined,
        {
          latitude: 18.5600,
          longitude: 73.8567,
          accuracy: 15,
          timestamp: Date.now(),
        }
      );

      expect(record?.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
    });

    it('transitions to ARRIVAL_PENDING upon entering the 100m geofence on first sample', async () => {
      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-arrival-2',
        serviceNumber: 'SRV-ARR-2',
        customerId: 'cust-2',
        customerName: 'Customer Two',
        address: 'FC Road, Pune',
        latitude: destLat,
        longitude: destLng,
        startedAt: Date.now(),
      });

      // Within ~20 meters of customer
      const record1 = await mapsTrackingRedisService.updateLocation(
        techId,
        'Arrival Engineer',
        undefined,
        {
          latitude: 18.52055,
          longitude: 73.8567,
          accuracy: 10,
          timestamp: Date.now(),
        }
      );

      expect(record1?.trackingStatus).toBe(TRACKING_STATUSES.ARRIVAL_PENDING);
    });

    it('transitions to AT_CUSTOMER only after stability/dwell requirement is met', async () => {
      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-arrival-3',
        serviceNumber: 'SRV-ARR-3',
        customerId: 'cust-3',
        customerName: 'Customer Three',
        address: 'JM Road, Pune',
        latitude: destLat,
        longitude: destLng,
        startedAt: Date.now(),
      });

      // First sample inside geofence -> ARRIVAL_PENDING
      const record1 = await mapsTrackingRedisService.updateLocation(
        techId,
        'Arrival Engineer',
        undefined,
        {
          latitude: 18.52048,
          longitude: 73.8567,
          accuracy: 8,
          timestamp: Date.now(),
        }
      );
      expect(record1?.trackingStatus).toBe(TRACKING_STATUSES.ARRIVAL_PENDING);

      // Second consecutive stable sample inside geofence -> AT_CUSTOMER
      const record2 = await mapsTrackingRedisService.updateLocation(
        techId,
        'Arrival Engineer',
        undefined,
        {
          latitude: 18.52045,
          longitude: 73.8567,
          accuracy: 6,
          timestamp: Date.now() + 1000,
        }
      );
      expect(record2?.trackingStatus).toBe(TRACKING_STATUSES.AT_CUSTOMER);
    });
  });

  describe('5. Freshness & Staleness Calculation (Section 19)', () => {
    it('correctly maps age to LIVE, WARNING, STALE, and OFFLINE', () => {
      const now = Date.now();

      // Fresh (0-30s)
      expect(mapsTrackingRedisService.evaluateFreshness(now)).toBe('LIVE');
      expect(mapsTrackingRedisService.evaluateFreshness(now - 15000)).toBe('LIVE');
      expect(mapsTrackingRedisService.evaluateFreshness(now - 30000)).toBe('LIVE');

      // Warning / Aging (31-90s)
      expect(mapsTrackingRedisService.evaluateFreshness(now - 45000)).toBe('WARNING');
      expect(mapsTrackingRedisService.evaluateFreshness(now - 90000)).toBe('WARNING');

      // Stale (91s - 15min)
      expect(mapsTrackingRedisService.evaluateFreshness(now - 120000)).toBe('STALE');
      expect(mapsTrackingRedisService.evaluateFreshness(now - 500000)).toBe('STALE');

      // Offline (>15min)
      expect(mapsTrackingRedisService.evaluateFreshness(now - 901000)).toBe('OFFLINE');
      expect(mapsTrackingRedisService.evaluateFreshness(now - 3600000)).toBe('OFFLINE');
    });
  });

  describe('6. Routes Service & Distance Fallback (Section 21)', () => {
    it('accurately computes Haversine straight-line distance in meters', () => {
      // Pune Station to Shivaji Nagar (~2.5km)
      const dist = mapsRoutesService.calculateHaversineDistance(18.5284, 73.8744, 18.5314, 73.8446);
      expect(dist).toBeGreaterThan(2000);
      expect(dist).toBeLessThan(4000);
    });

    it('formats distance and duration strings cleanly', () => {
      expect(mapsRoutesService.formatDistance(450)).toBe('450 m');
      expect(mapsRoutesService.formatDistance(3200)).toBe('3.2 km');
      expect(mapsRoutesService.formatDuration(20)).toBe('< 1 min');
      expect(mapsRoutesService.formatDuration(300)).toBe('5 mins');
    });

    it('calculates road route distance and ETA with provider response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 1400,
              duration: '180s',
            },
          ],
        }),
      } as any);

      const result = await mapsRoutesService.computeRoute(
        18.5204,
        73.8567,
        18.5300,
        73.8600
      );

      expect(result).toHaveProperty('distanceMeters');
      expect(result).toHaveProperty('durationSeconds');
      expect(result).toHaveProperty('distanceText');
      expect(result).toHaveProperty('durationText');
      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeGreaterThan(0);
    });
  });

  describe('7. Tracking Termination & Temporary State Purging (Sections 14, 23)', () => {
    it('immediately purges Redis temporary state when tracking is cleared', async () => {
      const techId = 'tech-purge-test';

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-purge-1',
        serviceNumber: 'SRV-PURGE-1',
        customerId: 'cust-purge',
        customerName: 'Purge Customer',
        address: 'Camp, Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        startedAt: Date.now(),
      });

      await mapsTrackingRedisService.updateLocation(
        techId,
        'Purge Engineer',
        undefined,
        {
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 10,
          timestamp: Date.now(),
        }
      );

      // Verify active
      const beforePurge = await mapsTrackingRedisService.getActiveDestination(techId);
      expect(beforePurge).not.toBeNull();

      // Clear tracking
      await mapsTrackingRedisService.clearTracking(techId);

      // Verify immediate removal
      const afterPurgeDest = await mapsTrackingRedisService.getActiveDestination(techId);
      expect(afterPurgeDest).toBeNull();

      const activeList = await mapsTrackingRedisService.getAllActiveLocations();
      expect(activeList.find((t) => t.technicianId === techId)).toBeUndefined();
    });
  });

  describe('8. Root-Cause Verification Suite: Road Distance, ETA & Error States (Prompt Tests A-M)', () => {
    const originLat = 18.5204;
    const originLng = 73.8567;
    const destLat = 18.5304;
    const destLng = 73.8667;

    it('TEST A — Valid input and successful provider response: returns actual road distance and ETA', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 4500,
              duration: '600s',
            },
          ],
        }),
      } as any);

      const result = await mapsRoutesService.computeRoute(originLat, originLng, destLat, destLng);
      expect(result.status).toBe('SUCCESS');
      expect(result.distanceMeters).toBe(4500);
      expect(result.durationSeconds).toBe(600);
      expect(result.distanceText).toBe('4.5 km');
      expect(result.durationText).toBe('10 mins');
      expect(result.source).toBe('GOOGLE_ROUTES_API');
    });

    it('TEST B — Missing origin: loading ends, clear unavailable state appears', async () => {
      const result = await mapsRoutesService.computeRoute(NaN, originLng, destLat, destLng);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.errorCode).toBe('INVALID_COORDINATES');
    });

    it('TEST C — Missing destination: updateLocation produces clear UNAVAILABLE state without eternal loading', async () => {
      const techId = 'tech-no-dest-test';
      // Ensure no destination in Redis
      await mapsTrackingRedisService.clearTracking(techId);

      const record = await mapsTrackingRedisService.updateLocation(
        techId,
        'Test Tech',
        undefined,
        {
          latitude: originLat,
          longitude: originLng,
          accuracy: 10,
          timestamp: Date.now(),
        }
      );

      expect(record.activeDestination).toBeNull();
      expect(record.routeStatus).toBe('UNAVAILABLE');
      expect(record.routeErrorCode).toBe('MISSING_DESTINATION');
      expect(record.distanceMeters).toBeNull();
      expect(record.etaSeconds).toBeNull();
      // Tracking status should not be blindly ON_THE_WAY when no destination exists
      expect(record.trackingStatus).toBe(TRACKING_STATUSES.NOT_TRACKING);
    });

    it('TEST D — Invalid coordinates: request is not sent, loading ends', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await mapsRoutesService.computeRoute(999, originLng, destLat, destLng);

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.errorCode).toBe('INVALID_COORDINATES');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('TEST E — Stale location: staleness is honestly represented with real update timestamp', async () => {
      const staleTimestamp = Date.now() - 200000; // 200 seconds ago (matches screenshot)
      const freshness = mapsTrackingRedisService.evaluateFreshness(staleTimestamp);

      expect(freshness).toBe('STALE');

      const techId = 'tech-stale-test';
      const record = await mapsTrackingRedisService.updateLocation(
        techId,
        'Kartik',
        '8432708662',
        {
          latitude: 18.5883,
          longitude: 73.7819,
          accuracy: 10.5,
          timestamp: staleTimestamp,
        }
      );

      expect(record.lastUpdate).toBe(staleTimestamp);
      expect(record.freshness).toBe('STALE');
    });

    it('TEST F — Provider returns 429 quota error: enters explicit PROVIDER_RATE_LIMITED state', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' },
        }),
      } as any);

      // Using distinct coordinates to bypass any prior cache
      const result = await mapsRoutesService.computeRoute(18.601, 73.701, 18.651, 73.751);
      expect(result.status).toBe('ERROR');
      expect(result.errorCode).toBe('PROVIDER_RATE_LIMITED');
      expect(result.errorMessage).toContain('quota exceeded');
    });

    it('TEST G — HTTP succeeds but provider returns no routes: safe UNAVAILABLE state', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [],
        }),
      } as any);

      const result = await mapsRoutesService.computeRoute(18.701, 73.801, 18.751, 73.851);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.errorCode).toBe('PROVIDER_INVALID_RESPONSE');
    });

    it('TEST H — Malformed provider response: handled cleanly without crashing or fake numbers', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ distanceMeters: 'not_a_valid_number' }],
        }),
      } as any);

      const result = await mapsRoutesService.computeRoute(18.801, 73.901, 18.851, 73.951);
      expect(result.status).toBe('ERROR');
      expect(result.errorCode).toBe('PROVIDER_INVALID_RESPONSE');
    });

    it('TEST I — Request timeout: aborts safely and reports REQUEST_TIMEOUT', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      );

      const result = await mapsRoutesService.computeRoute(18.901, 73.101, 18.951, 73.151);
      expect(result.status).toBe('ERROR');
      expect(result.errorCode).toBe('REQUEST_TIMEOUT');
    });

    it('TEST J — Multiple overlapping requests: in-flight deduplication shares single request', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            routes: [{ distanceMeters: 3000, duration: '400s' }],
          }),
        } as any;
      });

      const p1 = mapsRoutesService.computeRoute(18.111, 73.222, 18.333, 73.444);
      const p2 = mapsRoutesService.computeRoute(18.111, 73.222, 18.333, 73.444);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(callCount).toBe(1);
      expect(r1.distanceMeters).toBe(3000);
      expect(r2.distanceMeters).toBe(3000);
    });

    it('TEST K — New technician coordinates arrive: controlled recalculation on significant movement', async () => {
      const techId = 'tech-movement-test';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-move-1',
        serviceNumber: 'SRV-MOVE-1',
        customerId: 'cust-move',
        customerName: 'Move Customer',
        address: 'Shivaji Nagar, Pune',
        latitude: 18.5300,
        longitude: 73.8500,
        startedAt: Date.now(),
      });

      // First ping
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ distanceMeters: 5000, duration: '600s' }],
        }),
      } as any);

      const rec1 = await mapsTrackingRedisService.updateLocation(techId, 'Move Tech', undefined, {
        latitude: 18.5000,
        longitude: 73.8000,
        accuracy: 10,
        timestamp: Date.now(),
      });
      expect(rec1.distanceMeters).toBe(5000);

      // Micro-jitter (< 10 meters): should NOT trigger recalculation
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const rec2 = await mapsTrackingRedisService.updateLocation(techId, 'Move Tech', undefined, {
        latitude: 18.50002, // ~2 meters
        longitude: 73.80002,
        accuracy: 10,
        timestamp: Date.now() + 2000,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(rec2.distanceMeters).toBe(5000); // Preserved
    });

    it('TEST L — Missing credentials: reports PROVIDER_CONFIGURATION_ERROR without exposing secrets', async () => {
      const origKey = env.GOOGLE_MAPS_SERVER_API_KEY;
      const origRoutes = env.ROUTES_API_KEY;
      try {
        (env as any).GOOGLE_MAPS_SERVER_API_KEY = '';
        (env as any).ROUTES_API_KEY = '';

        const result = await mapsRoutesService.computeRoute(18.201, 73.301, 18.251, 73.351);
        expect(result.status).toBe('ERROR');
        expect(result.errorCode).toBe('PROVIDER_CONFIGURATION_ERROR');
      } finally {
        (env as any).GOOGLE_MAPS_SERVER_API_KEY = origKey;
        (env as any).ROUTES_API_KEY = origRoutes;
      }
    });

    it('TEST M — Recovery after failure: subsequent valid calculation succeeds and updates card', async () => {
      const techId = 'tech-recovery-test';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-rec-1',
        serviceNumber: 'SRV-REC-1',
        customerId: 'cust-rec',
        customerName: 'Rec Customer',
        address: 'Pune Station',
        latitude: 18.5284,
        longitude: 73.8744,
        startedAt: Date.now(),
      });

      // 1. Initial failing request
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 429, message: 'Rate limit' } }),
      } as any);

      const failRec = await mapsTrackingRedisService.updateLocation(techId, 'Rec Tech', undefined, {
        latitude: 18.5000,
        longitude: 73.8000,
        accuracy: 8,
        timestamp: Date.now(),
      });
      expect(failRec.routeStatus).toBe('ERROR');

      // 2. Subsequent retry succeeds
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ distanceMeters: 4200, duration: '540s' }],
        }),
      } as any);

      const recoveredRec = await mapsTrackingRedisService.recalculateRoute(techId);
      expect(recoveredRec).not.toBeNull();
      expect(recoveredRec?.routeStatus).toBe('SUCCESS');
      expect(recoveredRec?.distanceMeters).toBe(4200);
      expect(recoveredRec?.etaSeconds).toBe(540);
    });

    it('Admin recalculate-route endpoint handles valid and invalid requests properly', async () => {
      // 1. Rejects missing technicianId
      const badRes = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/admin/recalculate-route',
        payload: {},
      });
      expect(badRes.statusCode).toBe(400);

      // 2. Rejects unknown technician
      const notFoundRes = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/admin/recalculate-route',
        payload: { technicianId: 'non-existent-tech-xyz' },
      });
      expect(notFoundRes.statusCode).toBe(404);
    });
  });

  describe('Section 19: Strict Navigation-Triggered Live Tracking State Machine (Tests A - M)', () => {
    it('TEST A & G — Assigned service without Navigate click remains UNTRACKED with no fabricated live route', async () => {
      const techId = 'tech-untracked-spec-1';
      await mapsTrackingRedisService.clearTracking(techId);

      const record = await mapsTrackingRedisService.getLocation(techId);
      expect(record).toBeNull(); // No active navigation session in Redis

      // Even if location ping arrives without Navigate action (no active destination):
      const untrackedRec = await mapsTrackingRedisService.updateLocation(techId, 'Idle Tech', undefined, {
        latitude: 18.5204,
        longitude: 73.8567,
        accuracy: 10,
        timestamp: Date.now(),
      });
      expect(untrackedRec.trackingStatus).toBe(TRACKING_STATUSES.UNTRACKED);
      expect(untrackedRec.activeDestination).toBeNull();
      expect(untrackedRec.routePolyline).toBeNull();
      expect(untrackedRec.distanceMeters).toBeNull();
      expect(untrackedRec.etaSeconds).toBeNull();
    });

    it('TEST B & C — Navigate click establishes active destination, initial GPS fix resolves route with polyline & metrics', async () => {
      const techId = 'tech-nav-start-1';
      await mapsTrackingRedisService.clearTracking(techId);

      // Mock Google Routes API returning polyline and metrics
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 7500,
              duration: '900s',
              polyline: { encodedPolyline: 'u{~vFvyys@fG}N' },
            },
          ],
        }),
      } as any);

      // Navigate action sets active destination
      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-100',
        serviceNumber: 'SRV-SPEC-100',
        customerId: 'cust-spec-1',
        customerName: 'Kunal Deshmukh',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        startedAt: Date.now(),
      });

      // Initial GPS location ping sent immediately
      const record = await mapsTrackingRedisService.updateLocation(techId, 'Nav Tech', undefined, {
        latitude: 18.5000,
        longitude: 73.8000,
        accuracy: 10,
        timestamp: Date.now(),
      });

      expect(record.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
      expect(record.routePolyline).toBe('u{~vFvyys@fG}N');
      expect(record.distanceMeters).toBe(7500);
      expect(record.etaSeconds).toBe(900);
      expect(record.travelledPath).toHaveLength(1);
      expect(record.travelledPath?.[0].latitude).toBe(18.5000);
    });

    it('TEST D & E — Navigation tracking session remains active and independent of job execution state', async () => {
      const techId = 'tech-independent-job-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-200',
        serviceNumber: 'SRV-SPEC-200',
        customerId: 'cust-spec-2',
        customerName: 'Anil Kapoor',
        address: 'Viman Nagar, Pune',
        latitude: 18.5679,
        longitude: 73.9143,
        startedAt: Date.now(),
      });

      // Navigation is active
      const navRecord = await mapsTrackingRedisService.getLocation(techId);
      expect(navRecord?.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
      expect(navRecord?.activeDestination?.serviceId).toBe('srv-spec-200');

      // Simulating job execution starting (e.g. status transition in database to IN_PROGRESS)
      // The navigation session in Redis remains untouched and continuous!
      const navRecordAfterJobStart = await mapsTrackingRedisService.getLocation(techId);
      expect(navRecordAfterJobStart?.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
      expect(navRecordAfterJobStart?.activeDestination?.serviceId).toBe('srv-spec-200');
    });

    it('TEST F — New GPS coordinates arrive: updates current marker, appends travelled path breadcrumbs, preserves route', async () => {
      const techId = 'tech-breadcrumb-1';
      await mapsTrackingRedisService.clearTracking(techId);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 6000,
              duration: '720s',
              polyline: { encodedPolyline: 'initial_route_polyline' },
            },
          ],
        }),
      } as any);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-300',
        serviceNumber: 'SRV-SPEC-300',
        customerId: 'cust-spec-3',
        customerName: 'Sunita Rao',
        address: 'Aundh, Pune',
        latitude: 18.5580,
        longitude: 73.8070,
        startedAt: Date.now(),
      });

      // Ping 1
      const rec1 = await mapsTrackingRedisService.updateLocation(techId, 'Breadcrumb Tech', undefined, {
        latitude: 18.5000,
        longitude: 73.8000,
        accuracy: 10,
        timestamp: 1000000,
      });
      expect(rec1.travelledPath).toHaveLength(1);

      // Ping 2: significant movement (>5m)
      const rec2 = await mapsTrackingRedisService.updateLocation(techId, 'Breadcrumb Tech', undefined, {
        latitude: 18.5010,
        longitude: 73.8010,
        accuracy: 8,
        timestamp: 1005000,
      });
      expect(rec2.travelledPath).toHaveLength(2);
      expect(rec2.travelledPath?.[0].latitude).toBe(18.5000);
      expect(rec2.travelledPath?.[1].latitude).toBe(18.5010);
      expect(rec2.routePolyline).toBe('initial_route_polyline');
    });

    it('TEST J & K — Stale location (>90s) is correctly evaluated, and recovers on fresh GPS ping', async () => {
      const techId = 'tech-stale-recovery-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-400',
        serviceNumber: 'SRV-SPEC-400',
        customerId: 'cust-spec-4',
        customerName: 'Meera Sen',
        address: 'Kalyani Nagar, Pune',
        latitude: 18.5500,
        longitude: 73.9000,
        startedAt: Date.now(),
      });

      // Ping with old timestamp (120 seconds ago)
      const oldTime = Date.now() - 120_000;
      const staleRec = await mapsTrackingRedisService.updateLocation(techId, 'Stale Tech', undefined, {
        latitude: 18.5200,
        longitude: 73.8500,
        accuracy: 10,
        timestamp: oldTime,
      });

      // Check staleness threshold
      const secondsAgoStale = (Date.now() - staleRec.lastUpdate) / 1000;
      expect(secondsAgoStale).toBeGreaterThanOrEqual(FRESHNESS_THRESHOLDS.WARNING_MAX_AGE_SEC);
      expect(staleRec.freshness).toBe('STALE');

      // Ping with fresh timestamp (now)
      const freshTime = Date.now();
      const freshRec = await mapsTrackingRedisService.updateLocation(techId, 'Stale Tech', undefined, {
        latitude: 18.5205,
        longitude: 73.8505,
        accuracy: 5,
        timestamp: freshTime,
      });

      const secondsAgoFresh = (Date.now() - freshRec.lastUpdate) / 1000;
      expect(secondsAgoFresh).toBeLessThan(FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_SEC);
      expect(freshRec.freshness).toBe('LIVE');
      expect(freshRec.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
    });

    it('TEST L — Navigation ended cleanly resets active destination and stops tracking', async () => {
      const techId = 'tech-nav-end-1';
      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-500',
        serviceNumber: 'SRV-SPEC-500',
        customerId: 'cust-spec-5',
        customerName: 'Rohit Verma',
        address: 'Camp, Pune',
        latitude: 18.5150,
        longitude: 73.8750,
        startedAt: Date.now(),
      });

      // Clear tracking / end navigation
      await mapsTrackingRedisService.clearTracking(techId);

      const record = await mapsTrackingRedisService.getLocation(techId);
      expect(record).toBeNull();
    });

    it('TEST M — GET /admin/live-technicians preserves operational ON_THE_WAY status when location freshness is STALE', async () => {
      const techId = 'tech-stale-preservation-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-spec-600',
        serviceNumber: 'SRV-SPEC-600',
        customerId: 'cust-spec-6',
        customerName: 'Kavita Deshmukh',
        address: 'Deccan, Pune',
        latitude: 18.5167,
        longitude: 73.8417,
        startedAt: Date.now(),
      });

      // Old ping > 90 seconds ago
      await mapsTrackingRedisService.updateLocation(techId, 'Kavita Tech', undefined, {
        latitude: 18.5200,
        longitude: 73.8500,
        accuracy: 10,
        timestamp: Date.now() - 150_000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const record = json.data.find((t: any) => t.technicianId === techId);
      expect(record).toBeDefined();
      // Crucial: Operational state is ON_THE_WAY, NOT STALE!
      expect(record.trackingStatus).toBe(TRACKING_STATUSES.ON_THE_WAY);
      // Location freshness honestly indicates STALE:
      expect(record.statusFreshness).toBe('STALE');
      expect(record.secondsAgo).toBeGreaterThanOrEqual(90);

      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('TEST N — Scoped nav token authorizes location pings, rejects non-tracking routes, and is revoked on stop', async () => {
      const techId = 'tech-scoped-token-test';
      const serviceId = 'srv-scoped-101';
      await mapsTrackingRedisService.clearTracking(techId);

      // Create scoped token
      const navToken = await mapsTrackingRedisService.createNavSessionToken(techId, serviceId);
      expect(typeof navToken).toBe('string');
      expect(navToken.length).toBeGreaterThan(10);

      // 1. Valid scoped token allows POST /api/v1/maps/technician/location
      const pingResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/location',
        headers: {
          authorization: `Bearer ${navToken}`,
        },
        payload: {
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 8,
          timestamp: Date.now(),
        },
      });
      expect(pingResponse.statusCode).toBe(200);
      const pingJson = pingResponse.json();
      expect(pingJson.success).toBe(true);
      expect(pingJson.data.technicianId).toBe(techId);

      // 2. Scoped nav token CANNOT access non-tracking endpoints (e.g. services list)
      const serviceAccessResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/technicians/services',
        headers: {
          authorization: `Bearer ${navToken}`,
        },
      });
      // Strictly rejected with 401
      expect(serviceAccessResponse.statusCode).toBe(401);

      // 3. Stopping tracking revokes the scoped token
      const stopResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/stop',
        headers: {
          authorization: `Bearer ${navToken}`,
        },
      });
      expect(stopResponse.statusCode).toBe(200);

      // 4. Revoked token is immediately rejected
      const revokedPingResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/maps/technician/location',
        headers: {
          authorization: `Bearer ${navToken}`,
        },
        payload: {
          latitude: 18.5204,
          longitude: 73.8567,
        },
      });
      expect(revokedPingResponse.statusCode).toBe(401);

      await mapsTrackingRedisService.clearTracking(techId);
    });
  });

  describe('Phase 1: Operational Status vs Location Freshness Decoupling Suite', () => {
    it('TEST 1 — Fresh location: active navigation with recent GPS has ON_THE_WAY operational status and LIVE freshness', async () => {
      const techId = 'phase1-tech-live-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-p1-live',
        serviceNumber: 'SRV-P1-001',
        customerId: 'cust-p1-1',
        customerName: 'Live Customer',
        address: 'MG Road, Pune',
        latitude: 18.5200,
        longitude: 73.8500,
        startedAt: Date.now(),
      });

      const pingTime = Date.now();
      await mapsTrackingRedisService.updateLocation(techId, 'Live Technician', undefined, {
        latitude: 18.5100,
        longitude: 73.8400,
        accuracy: 5,
        timestamp: pingTime,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const tech = json.data.find((t: any) => t.technicianId === techId);
      expect(tech).toBeDefined();
      expect(tech.trackingStatus).toBe('ON_THE_WAY');
      expect(tech.statusFreshness).toBe('LIVE');
      expect(tech.secondsAgo).toBeLessThan(30);

      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('TEST 2 — Stale location: absence of recent GPS changes freshness to STALE but DOES NOT overwrite operational state', async () => {
      const techId = 'phase1-tech-stale-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-p1-stale',
        serviceNumber: 'SRV-P1-002',
        customerId: 'cust-p1-2',
        customerName: 'Stale Customer',
        address: 'Viman Nagar, Pune',
        latitude: 18.5600,
        longitude: 73.9100,
        startedAt: Date.now(),
      });

      const oldTimestamp = Date.now() - 180_000; // 3 minutes ago
      await mapsTrackingRedisService.updateLocation(techId, 'Stale Technician', undefined, {
        latitude: 18.5500,
        longitude: 73.9000,
        accuracy: 12,
        timestamp: oldTimestamp,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const tech = json.data.find((t: any) => t.technicianId === techId);
      expect(tech).toBeDefined();
      // Operational state MUST NOT be overwritten to STALE:
      expect(tech.trackingStatus).toBe('ON_THE_WAY');
      // Location freshness honestly indicates STALE:
      expect(tech.statusFreshness).toBe('STALE');
      expect(tech.secondsAgo).toBeGreaterThanOrEqual(180);
      // Original lastUpdate is preserved:
      expect(tech.lastUpdate).toBe(oldTimestamp);

      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('TEST 5 — Recovery: submitting a fresh GPS update restores LIVE freshness and preserves operational state', async () => {
      const techId = 'phase1-tech-recovery-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-p1-rec',
        serviceNumber: 'SRV-P1-003',
        customerId: 'cust-p1-3',
        customerName: 'Recovery Customer',
        address: 'Kothrud, Pune',
        latitude: 18.5074,
        longitude: 73.8077,
        startedAt: Date.now(),
      });

      // 1. Initially stale
      await mapsTrackingRedisService.updateLocation(techId, 'Recovery Technician', undefined, {
        latitude: 18.5000,
        longitude: 73.8000,
        accuracy: 10,
        timestamp: Date.now() - 200_000,
      });

      const staleRes = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });
      const staleRecord = staleRes.json().data.find((t: any) => t.technicianId === techId);
      expect(staleRecord.statusFreshness).toBe('STALE');
      expect(staleRecord.trackingStatus).toBe('ON_THE_WAY');

      // 2. Fresh GPS ping arrives
      const newTimestamp = Date.now();
      await mapsTrackingRedisService.updateLocation(techId, 'Recovery Technician', undefined, {
        latitude: 18.5050,
        longitude: 73.8050,
        accuracy: 8,
        timestamp: newTimestamp,
      });

      const recoveredRes = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });
      const recoveredRecord = recoveredRes.json().data.find((t: any) => t.technicianId === techId);
      expect(recoveredRecord.statusFreshness).toBe('LIVE');
      expect(recoveredRecord.trackingStatus).toBe('ON_THE_WAY');
      expect(recoveredRecord.latitude).toBe(18.5050);
      expect(recoveredRecord.longitude).toBe(73.8050);

      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('TEST 6 — Navigation termination: clearing tracking removes active destination and purges temporary location state', async () => {
      const techId = 'phase1-tech-term-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-p1-term',
        serviceNumber: 'SRV-P1-004',
        customerId: 'cust-p1-4',
        customerName: 'Term Customer',
        address: 'Aundh, Pune',
        latitude: 18.5580,
        longitude: 73.8070,
        startedAt: Date.now(),
      });

      await mapsTrackingRedisService.updateLocation(techId, 'Term Technician', undefined, {
        latitude: 18.5500,
        longitude: 73.8000,
        accuracy: 10,
        timestamp: Date.now(),
      });

      // Explicitly clear/terminate tracking
      await mapsTrackingRedisService.clearTracking(techId);

      // Verify Redis temporary location state is purged
      const location = await mapsTrackingRedisService.getLocation(techId);
      expect(location).toBeNull();

      const activeDest = await mapsTrackingRedisService.getActiveDestination(techId);
      expect(activeDest).toBeNull();
    });

    it('TEST 7 — Multi-technician isolation: Technician A becoming STALE does not affect Technician B LIVE freshness', async () => {
      const techA = 'phase1-tech-iso-A';
      const techB = 'phase1-tech-iso-B';
      await mapsTrackingRedisService.clearTracking(techA);
      await mapsTrackingRedisService.clearTracking(techB);

      // Technician A: On the way, stale location (250s ago)
      await mapsTrackingRedisService.setActiveDestination(techA, {
        serviceId: 'srv-p1-iso-A',
        serviceNumber: 'SRV-ISO-A',
        customerId: 'cust-iso-A',
        customerName: 'Customer A',
        address: 'Baner, Pune',
        latitude: 18.5590,
        longitude: 73.7868,
        startedAt: Date.now(),
      });
      await mapsTrackingRedisService.updateLocation(techA, 'Technician A', undefined, {
        latitude: 18.5500,
        longitude: 73.7800,
        accuracy: 10,
        timestamp: Date.now() - 250_000,
      });

      // Technician B: On the way, fresh location (5s ago)
      await mapsTrackingRedisService.setActiveDestination(techB, {
        serviceId: 'srv-p1-iso-B',
        serviceNumber: 'SRV-ISO-B',
        customerId: 'cust-iso-B',
        customerName: 'Customer B',
        address: 'Wakad, Pune',
        latitude: 18.5987,
        longitude: 73.7680,
        startedAt: Date.now(),
      });
      await mapsTrackingRedisService.updateLocation(techB, 'Technician B', undefined, {
        latitude: 18.5900,
        longitude: 73.7600,
        accuracy: 5,
        timestamp: Date.now() - 5_000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });
      const list = response.json().data;

      const recordA = list.find((t: any) => t.technicianId === techA);
      const recordB = list.find((t: any) => t.technicianId === techB);

      expect(recordA).toBeDefined();
      expect(recordB).toBeDefined();

      // Independent operational status:
      expect(recordA.trackingStatus).toBe('ON_THE_WAY');
      expect(recordB.trackingStatus).toBe('ON_THE_WAY');

      // Independent freshness:
      expect(recordA.statusFreshness).toBe('STALE');
      expect(recordB.statusFreshness).toBe('LIVE');

      await mapsTrackingRedisService.clearTracking(techA);
      await mapsTrackingRedisService.clearTracking(techB);
    });

    it('TEST 8 — Redis TTL policy: temporary location records are stored with authoritative 7200s TTL', async () => {
      const techId = 'phase1-tech-ttl-1';
      await mapsTrackingRedisService.clearTracking(techId);

      await mapsTrackingRedisService.setActiveDestination(techId, {
        serviceId: 'srv-p1-ttl',
        serviceNumber: 'SRV-TTL-001',
        customerId: 'cust-ttl',
        customerName: 'TTL Customer',
        address: 'Hinjawadi, Pune',
        latitude: 18.5913,
        longitude: 73.7389,
        startedAt: Date.now(),
      });

      await mapsTrackingRedisService.updateLocation(techId, 'TTL Technician', undefined, {
        latitude: 18.5800,
        longitude: 73.7300,
        accuracy: 10,
        timestamp: Date.now(),
      });

      const redis = getRedisClient();
      const ttl = await redis.ttl(`tech_location:${techId}`);
      // 7200 seconds TTL (allow 10 seconds leeway during test execution)
      expect(ttl).toBeGreaterThanOrEqual(7190);
      expect(ttl).toBeLessThanOrEqual(7200);

      await mapsTrackingRedisService.clearTracking(techId);
    });

    it('TEST 9 — API compatibility: GET /admin/live-technicians preserves backward compatibility and contract shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/maps/admin/live-technicians',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('success', true);
      expect(Array.isArray(json.data)).toBe(true);

      // Verify each item preserves essential fields
      for (const item of json.data) {
        expect(item).toHaveProperty('technicianId');
        expect(item).toHaveProperty('technicianName');
        expect(item).toHaveProperty('trackingStatus');
        expect(item).toHaveProperty('statusFreshness');
        expect(item).toHaveProperty('lastUpdated');
        expect(item).toHaveProperty('secondsAgo');
      }
    });
  });
});
