import { randomUUID } from 'node:crypto';
import { getRedisClient } from '../../redis/client';
import {
  TRACKING_STATUSES,
  FRESHNESS_THRESHOLDS,
  type TrackingStatus,
  type StatusFreshness,
  type TechnicianLocationPing,
  type ActiveDestinationRecord,
  type TechnicianTrackingRecord,
  type RouteCalculationStatus,
  type RouteErrorCode,
  type TravelledPathPoint,
} from './maps-tracking.types';
import { mapsRoutesService } from './maps-routes.service';

/**
 * Isolated Redis Temporary Location & Tracking State Manager
 *
 * Rules:
 * - NO permanent PostgreSQL GPS tables.
 * - Temporary Redis state with TTL 7200 seconds (2 hours maximum retention).
 * - Immediate cleanup upon tracking stop or job completion.
 * - Isolated keys per technician: NO global state.
 * - ONE active destination per technician.
 * - Strict lifecycle: No eternal "Calculating..." loading state.
 */
export class MapsTrackingRedisService {
  private keyPrefixLocation = 'tech_location:';
  private keyPrefixDestination = 'tech_active_dest:';
  private keyActiveSet = 'tech_active_tracking_set';
  private keyPrefixNavToken = 'tech_nav_token:';
  private keyPrefixActiveNavToken = 'tech_active_nav_token:';
  private stateTtlSeconds = 7200; // 2 hours auto-expire

  /**
   * Determine staleness classification for a given timestamp
   */
  public evaluateFreshness(lastUpdate: number): StatusFreshness {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000));
    if (ageSeconds <= FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_SEC) {
      return 'LIVE';
    }
    if (ageSeconds <= FRESHNESS_THRESHOLDS.WARNING_MAX_AGE_SEC) {
      return 'WARNING';
    }
    if (ageSeconds >= FRESHNESS_THRESHOLDS.OFFLINE_MIN_AGE_SEC) {
      return 'OFFLINE';
    }
    return 'STALE';
  }

  /**
   * Resilient fallback to OSRM driving route when primary routing provider
   * is rate-limited or temporarily unavailable.
   */
  private async fetchOsrmDrivingRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<{
    distanceMeters: number;
    distanceText: string;
    etaSeconds: number;
    etaText: string;
    polyline: string | null;
  } | null> {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
      const res = await fetch(osrmUrl, {
        headers: { 'User-Agent': 'Enterprises-CRM/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const osrmData = (await res.json()) as any;
        const osrmRoute = osrmData?.routes?.[0];
        if (osrmRoute) {
          const distanceMeters = Math.round(Number(osrmRoute.distance) || 0);
          const etaSeconds = Math.round(Number(osrmRoute.duration) || 0);
          return {
            distanceMeters,
            distanceText: mapsRoutesService.formatDistance(distanceMeters),
            etaSeconds,
            etaText: mapsRoutesService.formatDuration(etaSeconds),
            polyline: typeof osrmRoute.geometry === 'string' ? osrmRoute.geometry : null,
          };
        }
      }
    } catch (err: any) {
      console.warn('[MapsTrackingRedisService] OSRM fallback notice:', err?.cause || err?.message || err);
    }
    return null;
  }

  /**
   * Set the active navigation destination for an authenticated technician.
   * Enforces: ONE technician = ONE active destination.
   * Computes initial route immediately if technician already has a valid position.
   */
  public async setActiveDestination(
    technicianId: string,
    destination: ActiveDestinationRecord,
    technicianName?: string,
    technicianPhone?: string,
    initialOrigin?: { latitude: number; longitude: number }
  ): Promise<void> {
    const redis = getRedisClient();
    const destKey = `${this.keyPrefixDestination}${technicianId}`;
    const locKey = `${this.keyPrefixLocation}${technicianId}`;

    // Read previous location if exists to maintain current ping
    let currentRecord: Partial<TechnicianTrackingRecord> | null = null;
    try {
      const raw = await redis.get(locKey);
      if (raw) currentRecord = JSON.parse(raw);
    } catch {}

    const currentLoc = currentRecord?.currentLocation || (
      initialOrigin && mapsRoutesService.isValidCoordinate(initialOrigin.latitude, initialOrigin.longitude)
        ? {
            latitude: initialOrigin.latitude,
            longitude: initialOrigin.longitude,
            accuracy: 10,
            heading: null,
            speed: null,
            timestamp: Date.now(),
          }
        : null
    );

    let distanceMeters: number | null = currentRecord?.distanceMeters ?? null;
    let distanceText: string | null = currentRecord?.distanceText ?? null;
    let etaSeconds: number | null = currentRecord?.etaSeconds ?? null;
    let etaText: string | null = currentRecord?.etaText ?? null;
    let routeStatus: RouteCalculationStatus = 'UNAVAILABLE';
    let routeErrorCode: RouteErrorCode | null = null;
    let routeErrorMessage: string | null = null;
    let routeCalculatedAt: number | null = null;
    let routeOriginLat: number | null = null;
    let routeOriginLng: number | null = null;
    let routePolyline: string | null = currentRecord?.routePolyline ?? null;

    // If technician position is already known and destination has valid coordinates, compute route immediately
    if (
      currentLoc &&
      mapsRoutesService.isValidCoordinate(currentLoc.latitude, currentLoc.longitude) &&
      mapsRoutesService.isValidCoordinate(destination.latitude, destination.longitude)
    ) {
      routeStatus = 'LOADING';
      const route = await mapsRoutesService.computeRoute(
        currentLoc.latitude,
        currentLoc.longitude,
        destination.latitude,
        destination.longitude
      );

      if (route.status === 'SUCCESS') {
        distanceMeters = route.distanceMeters;
        distanceText = route.distanceText;
        etaSeconds = route.durationSeconds;
        etaText = route.durationText;
        routePolyline = route.polyline || null;
        routeStatus = 'SUCCESS';
        routeCalculatedAt = route.calculatedAt || Date.now();
        routeOriginLat = currentLoc.latitude;
        routeOriginLng = currentLoc.longitude;
      } else {
        const fallback = await this.fetchOsrmDrivingRoute(
          currentLoc.latitude,
          currentLoc.longitude,
          destination.latitude,
          destination.longitude
        );
        if (fallback) {
          distanceMeters = fallback.distanceMeters;
          distanceText = fallback.distanceText;
          etaSeconds = fallback.etaSeconds;
          etaText = fallback.etaText;
          routePolyline = fallback.polyline;
          routeStatus = 'SUCCESS';
          routeErrorCode = null;
          routeErrorMessage = null;
          routeCalculatedAt = Date.now();
          routeOriginLat = currentLoc.latitude;
          routeOriginLng = currentLoc.longitude;
        } else {
          routeStatus = route.status;
          routeErrorCode = route.errorCode || 'UNKNOWN_ROUTE_ERROR';
          routeErrorMessage = route.errorMessage || 'Route calculation failed';
        }
      }
    } else if (!destination.latitude || !destination.longitude) {
      routeStatus = 'UNAVAILABLE';
      routeErrorCode = 'INVALID_COORDINATES';
      routeErrorMessage = 'Destination coordinates are missing';
    } else {
      routeStatus = 'UNAVAILABLE';
      routeErrorCode = 'MISSING_ORIGIN';
      routeErrorMessage = 'Waiting for technician GPS signal';
    }

    const actualTimestamp = Date.now();

    const initialTravelledPath: TravelledPathPoint[] =
      currentLoc && mapsRoutesService.isValidCoordinate(currentLoc.latitude, currentLoc.longitude)
        ? [{ latitude: currentLoc.latitude, longitude: currentLoc.longitude, timestamp: currentLoc.timestamp || Date.now() }]
        : [];

    const updatedRecord: TechnicianTrackingRecord = {
      technicianId,
      technicianName: technicianName || currentRecord?.technicianName || 'Technician',
      technicianPhone: technicianPhone || currentRecord?.technicianPhone,
      trackingStatus: TRACKING_STATUSES.ON_THE_WAY,
      activeDestination: destination,
      currentLocation: currentLoc,
      distanceMeters,
      distanceText,
      etaSeconds,
      etaText,
      routeStatus,
      routeErrorCode,
      routeErrorMessage,
      routeCalculatedAt,
      routeOriginLat,
      routeOriginLng,
      routePolyline,
      travelledPath: initialTravelledPath,
      arrivalPendingSince: null,
      arrivalPendingSamples: 0,
      lastUpdate: actualTimestamp,
      freshness: 'LIVE',
    };

    // Store in Redis with TTL
    await redis.set(destKey, JSON.stringify(destination), 'EX', this.stateTtlSeconds);
    await redis.set(locKey, JSON.stringify(updatedRecord), 'EX', this.stateTtlSeconds);
    await redis.sadd(this.keyActiveSet, technicianId);
  }

  /**
   * Get active destination for an authenticated technician
   */
  public async getActiveDestination(
    technicianId: string
  ): Promise<ActiveDestinationRecord | null> {
    const redis = getRedisClient();
    const destKey = `${this.keyPrefixDestination}${technicianId}`;
    try {
      const raw = await redis.get(destKey);
      return raw ? (JSON.parse(raw) as ActiveDestinationRecord) : null;
    } catch {
      return null;
    }
  }

  /**
   * Process and save a live GPS location ping for a technician.
   * Performs arrival detection and distance/ETA recalculation with controlled refresh.
   */
  public async updateLocation(
    technicianId: string,
    technicianName: string,
    technicianPhone: string | undefined,
    ping: TechnicianLocationPing
  ): Promise<TechnicianTrackingRecord> {
    const redis = getRedisClient();
    const locKey = `${this.keyPrefixLocation}${technicianId}`;

    // Validate incoming ping coordinates
    const isValidOrigin = mapsRoutesService.isValidCoordinate(ping.latitude, ping.longitude);

    // Retrieve active destination
    const destination = await this.getActiveDestination(technicianId);

    // Retrieve existing location state
    let prevRecord: TechnicianTrackingRecord | null = null;
    try {
      const raw = await redis.get(locKey);
      if (raw) prevRecord = JSON.parse(raw);
    } catch {}

    // Maintain accurate tracking status (only ON_THE_WAY if active destination exists or previously set)
    let trackingStatus: TrackingStatus = destination
      ? (prevRecord?.trackingStatus === TRACKING_STATUSES.UNTRACKED
          ? TRACKING_STATUSES.ON_THE_WAY
          : prevRecord?.trackingStatus || TRACKING_STATUSES.ON_THE_WAY)
      : TRACKING_STATUSES.UNTRACKED;

    let distanceMeters: number | null = prevRecord?.distanceMeters ?? null;
    let distanceText: string | null = prevRecord?.distanceText ?? null;
    let etaSeconds: number | null = prevRecord?.etaSeconds ?? null;
    let etaText: string | null = prevRecord?.etaText ?? null;
    let routeStatus: RouteCalculationStatus = prevRecord?.routeStatus || 'UNAVAILABLE';
    let routeErrorCode: RouteErrorCode | null = prevRecord?.routeErrorCode || null;
    let routeErrorMessage: string | null = prevRecord?.routeErrorMessage || null;
    let routeCalculatedAt: number | null = prevRecord?.routeCalculatedAt || null;
    let routeOriginLat: number | null = prevRecord?.routeOriginLat || null;
    let routeOriginLng: number | null = prevRecord?.routeOriginLng || null;
    let routePolyline: string | null = prevRecord?.routePolyline ?? null;
    let arrivalPendingSince = prevRecord?.arrivalPendingSince ?? null;
    let arrivalPendingSamples = prevRecord?.arrivalPendingSamples ?? 0;

    // Check destination validity
    if (!destination) {
      trackingStatus = TRACKING_STATUSES.UNTRACKED;
      routeStatus = 'UNAVAILABLE';
      routeErrorCode = 'MISSING_DESTINATION';
      routeErrorMessage = 'No active destination assigned';
      distanceMeters = null;
      distanceText = null;
      etaSeconds = null;
      etaText = null;
      routePolyline = null;
    } else if (!mapsRoutesService.isValidCoordinate(destination.latitude, destination.longitude)) {
      routeStatus = 'UNAVAILABLE';
      routeErrorCode = 'INVALID_COORDINATES';
      routeErrorMessage = 'Destination coordinates are missing or invalid';
      distanceMeters = null;
      distanceText = null;
      etaSeconds = null;
      etaText = null;
      routePolyline = null;
    } else if (!isValidOrigin) {
      routeStatus = 'UNAVAILABLE';
      routeErrorCode = 'INVALID_COORDINATES';
      routeErrorMessage = 'Technician coordinates are invalid';
    } else {
      // Both origin and destination coordinates are valid
      const straightLineDist = mapsRoutesService.calculateHaversineDistance(
        ping.latitude,
        ping.longitude,
        destination.latitude,
        destination.longitude
      );

      // Arrival detection logic: Geofence ~ 100 meters
      const GEOFENCE_RADIUS_METERS = 100;

      if (straightLineDist <= GEOFENCE_RADIUS_METERS) {
        if (trackingStatus === TRACKING_STATUSES.ON_THE_WAY) {
          trackingStatus = TRACKING_STATUSES.ARRIVAL_PENDING;
          arrivalPendingSince = Date.now();
          arrivalPendingSamples = 1;
        } else if (trackingStatus === TRACKING_STATUSES.ARRIVAL_PENDING) {
          arrivalPendingSamples += 1;
          const dwellDurationSec = arrivalPendingSince
            ? Math.floor((Date.now() - arrivalPendingSince) / 1000)
            : 0;

          if (arrivalPendingSamples >= 2 || dwellDurationSec >= 8) {
            trackingStatus = TRACKING_STATUSES.AT_CUSTOMER;
          }
        }
      } else {
        if (trackingStatus === TRACKING_STATUSES.ARRIVAL_PENDING && straightLineDist > 150) {
          trackingStatus = TRACKING_STATUSES.ON_THE_WAY;
          arrivalPendingSince = null;
          arrivalPendingSamples = 0;
        }
      }

      // Controlled Recalculation Policy (Section 16):
      // Only recalculate when:
      // 1. Never calculated before or previously failed
      // 2. Technician moved >= 25 meters from last calculated origin
      // 3. Or last calculation is older than 60 seconds
      let shouldRecalculate = false;
      if (!routeCalculatedAt || routeStatus !== 'SUCCESS') {
        shouldRecalculate = true;
      } else if (routeOriginLat !== null && routeOriginLng !== null) {
        const movedMeters = mapsRoutesService.calculateHaversineDistance(
          ping.latitude,
          ping.longitude,
          routeOriginLat,
          routeOriginLng
        );
        const ageSec = Math.floor((Date.now() - routeCalculatedAt) / 1000);
        if (movedMeters >= 25 || ageSec >= 60) {
          shouldRecalculate = true;
        }
      } else {
        shouldRecalculate = true;
      }

      if (shouldRecalculate) {
        try {
          const route = await mapsRoutesService.computeRoute(
            ping.latitude,
            ping.longitude,
            destination.latitude,
            destination.longitude
          );

          if (route.status === 'SUCCESS') {
            distanceMeters = route.distanceMeters;
            distanceText = route.distanceText;
            etaSeconds = route.durationSeconds;
            etaText = route.durationText;
            routePolyline = route.polyline || null;
            routeStatus = 'SUCCESS';
            routeErrorCode = null;
            routeErrorMessage = null;
            routeCalculatedAt = route.calculatedAt || Date.now();
            routeOriginLat = ping.latitude;
            routeOriginLng = ping.longitude;
          } else {
            routeStatus = route.status;
            routeErrorCode = route.errorCode || 'UNKNOWN_ROUTE_ERROR';
            routeErrorMessage = route.errorMessage || 'Route calculation failed';

            // If we have a previously calculated distance, preserve it as last known
            if (prevRecord?.distanceMeters !== null && prevRecord?.distanceMeters !== undefined) {
              distanceMeters = prevRecord.distanceMeters;
              distanceText = prevRecord.distanceText || null;
              etaSeconds = prevRecord.etaSeconds || null;
              etaText = prevRecord.etaText || null;
            } else {
              distanceMeters = null;
              distanceText = null;
              etaSeconds = null;
              etaText = null;
            }
          }
        } catch (err: any) {
          routeStatus = 'ERROR';
          routeErrorCode = 'UNKNOWN_ROUTE_ERROR';
          routeErrorMessage = err?.message || 'Route calculation error';
        }
      }
    }

    // Maintain actual observed GPS travelled path for active navigation session
    let travelledPath: TravelledPathPoint[] = prevRecord?.travelledPath ? [...prevRecord.travelledPath] : [];
    if (isValidOrigin && destination) {
      const lastPt = travelledPath[travelledPath.length - 1];
      const isDuplicate =
        lastPt &&
        mapsRoutesService.calculateHaversineDistance(
          lastPt.latitude,
          lastPt.longitude,
          ping.latitude,
          ping.longitude
        ) < 5;

      if (!isDuplicate) {
        travelledPath.push({
          latitude: ping.latitude,
          longitude: ping.longitude,
          timestamp: ping.timestamp || Date.now(),
        });
        if (travelledPath.length > 100) {
          travelledPath = travelledPath.slice(travelledPath.length - 100);
        }
      }
    } else if (!destination) {
      travelledPath = [];
    }

    const timestamp = ping.timestamp || Date.now();

    const record: TechnicianTrackingRecord = {
      technicianId,
      technicianName: technicianName || prevRecord?.technicianName || 'Technician',
      technicianPhone: technicianPhone || prevRecord?.technicianPhone,
      trackingStatus,
      activeDestination: destination,
      currentLocation: ping,
      distanceMeters,
      distanceText,
      etaSeconds,
      etaText,
      routeStatus,
      routeErrorCode,
      routeErrorMessage,
      routeCalculatedAt,
      routeOriginLat,
      routeOriginLng,
      routePolyline,
      travelledPath,
      arrivalPendingSince,
      arrivalPendingSamples,
      lastUpdate: timestamp,
      freshness: this.evaluateFreshness(timestamp),
    };

    // Save with 2-hour TTL fallback
    await redis.set(locKey, JSON.stringify(record), 'EX', this.stateTtlSeconds);
    await redis.sadd(this.keyActiveSet, technicianId);

    return record;
  }

  /**
   * On-demand route recalculation for a technician (used by Admin retry and manual refresh)
   */
  public async recalculateRoute(technicianId: string): Promise<TechnicianTrackingRecord | null> {
    const redis = getRedisClient();
    const locKey = `${this.keyPrefixLocation}${technicianId}`;

    const raw = await redis.get(locKey);
    if (!raw) return null;

    const record = JSON.parse(raw) as TechnicianTrackingRecord;
    const destination = record.activeDestination || (await this.getActiveDestination(technicianId));
    const loc = record.currentLocation;

    if (!loc || !mapsRoutesService.isValidCoordinate(loc.latitude, loc.longitude)) {
      record.routeStatus = 'UNAVAILABLE';
      record.routeErrorCode = 'MISSING_ORIGIN';
      record.routeErrorMessage = 'Technician location coordinates unavailable';
      await redis.set(locKey, JSON.stringify(record), 'EX', this.stateTtlSeconds);
      return record;
    }

    if (!destination || !mapsRoutesService.isValidCoordinate(destination.latitude, destination.longitude)) {
      record.routeStatus = 'UNAVAILABLE';
      record.routeErrorCode = 'MISSING_DESTINATION';
      record.routeErrorMessage = 'Active destination coordinates unavailable';
      record.distanceMeters = null;
      record.distanceText = null;
      record.etaSeconds = null;
      record.etaText = null;
      await redis.set(locKey, JSON.stringify(record), 'EX', this.stateTtlSeconds);
      return record;
    }

    const route = await mapsRoutesService.computeRoute(
      loc.latitude,
      loc.longitude,
      destination.latitude,
      destination.longitude
    );

    if (route.status === 'SUCCESS') {
      record.distanceMeters = route.distanceMeters;
      record.distanceText = route.distanceText;
      record.etaSeconds = route.durationSeconds;
      record.etaText = route.durationText;
      record.routePolyline = route.polyline || record.routePolyline || null;
      record.routeStatus = 'SUCCESS';
      record.routeErrorCode = null;
      record.routeErrorMessage = null;
      record.routeCalculatedAt = route.calculatedAt || Date.now();
      record.routeOriginLat = loc.latitude;
      record.routeOriginLng = loc.longitude;
    } else {
      record.routeStatus = route.status;
      record.routeErrorCode = route.errorCode || 'UNKNOWN_ROUTE_ERROR';
      record.routeErrorMessage = route.errorMessage || 'Route calculation failed';
    }

    record.freshness = this.evaluateFreshness(record.lastUpdate);
    await redis.set(locKey, JSON.stringify(record), 'EX', this.stateTtlSeconds);

    return record;
  }

  /**
   * Get location record for a single technician
   */
  public async getLocation(technicianId: string): Promise<TechnicianTrackingRecord | null> {
    const redis = getRedisClient();
    const locKey = `${this.keyPrefixLocation}${technicianId}`;
    try {
      const raw = await redis.get(locKey);
      if (!raw) return null;
      const record = JSON.parse(raw) as TechnicianTrackingRecord;
      record.freshness = this.evaluateFreshness(record.lastUpdate);
      return record;
    } catch {
      return null;
    }
  }

  /**
   * Retrieve all currently active tracked technicians for the Admin Live Map.
   */
  public async getAllActiveLocations(): Promise<TechnicianTrackingRecord[]> {
    const redis = getRedisClient();
    try {
      const techIds = await redis.smembers(this.keyActiveSet);
      if (!techIds || techIds.length === 0) {
        return [];
      }

      const records: TechnicianTrackingRecord[] = [];
      const staleOrMissing: string[] = [];

      for (const id of techIds) {
        const locKey = `${this.keyPrefixLocation}${id}`;
        const raw = await redis.get(locKey);
        if (!raw) {
          staleOrMissing.push(id);
          continue;
        }
        const record = JSON.parse(raw) as TechnicianTrackingRecord;
        record.freshness = this.evaluateFreshness(record.lastUpdate);
        records.push(record);
      }

      // Clean up dead IDs from the active set
      if (staleOrMissing.length > 0) {
        await redis.srem(this.keyActiveSet, ...staleOrMissing);
      }

      return records;
    } catch {
      return [];
    }
  }

  /**
   * Issue a temporary, scoped navigation session token for the authenticated technician.
   * Scoped strictly to location updates for this active navigation destination.
   * Auto-expires via Redis TTL (7200s), and invalidates any previous token for this technician.
   */
  public async createNavSessionToken(technicianId: string, serviceId: string): Promise<string> {
    const redis = getRedisClient();
    const token = randomUUID();
    const tokenKey = `${this.keyPrefixNavToken}${token}`;
    const activeTokenKey = `${this.keyPrefixActiveNavToken}${technicianId}`;

    try {
      // Invalidate previous token for this technician if present
      const oldToken = await redis.get(activeTokenKey);
      if (oldToken) {
        await redis.del(`${this.keyPrefixNavToken}${oldToken}`);
      }

      const payload = JSON.stringify({
        technicianId,
        serviceId,
        createdAt: Date.now(),
      });

      await redis.set(tokenKey, payload, 'EX', this.stateTtlSeconds);
      await redis.set(activeTokenKey, token, 'EX', this.stateTtlSeconds);

      return token;
    } catch (err) {
      console.warn(`[MapsTrackingRedisService] Failed to create scoped nav token for ${technicianId}:`, err);
      return token;
    }
  }

  /**
   * Verify a scoped navigation token. Returns authorized technicianId and serviceId if valid.
   */
  public async verifyNavSessionToken(
    token: string
  ): Promise<{ technicianId: string; serviceId: string } | null> {
    if (!token || typeof token !== 'string') return null;
    const redis = getRedisClient();
    const tokenKey = `${this.keyPrefixNavToken}${token}`;

    try {
      const raw = await redis.get(tokenKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Revoke scoped navigation token for an authenticated technician.
   */
  public async revokeNavSessionToken(technicianId: string): Promise<void> {
    const redis = getRedisClient();
    const activeTokenKey = `${this.keyPrefixActiveNavToken}${technicianId}`;

    try {
      const activeToken = await redis.get(activeTokenKey);
      if (activeToken) {
        await redis.del(`${this.keyPrefixNavToken}${activeToken}`);
      }
      await redis.del(activeTokenKey);
    } catch (err) {
      console.warn(`[MapsTrackingRedisService] Failed to revoke scoped nav token for ${technicianId}:`, err);
    }
  }

  /**
   * Immediately clear active tracking and destination state when tracking terminates normally.
   */
  public async clearTracking(technicianId: string): Promise<void> {
    const redis = getRedisClient();
    const locKey = `${this.keyPrefixLocation}${technicianId}`;
    const destKey = `${this.keyPrefixDestination}${technicianId}`;

    try {
      await redis.del(locKey, destKey);
      await redis.srem(this.keyActiveSet, technicianId);
      await this.revokeNavSessionToken(technicianId);
    } catch (err) {
      console.warn(`[MapsTrackingRedisService] Error clearing tracking state for ${technicianId}:`, err);
    }
  }
}

export const mapsTrackingRedisService = new MapsTrackingRedisService();
