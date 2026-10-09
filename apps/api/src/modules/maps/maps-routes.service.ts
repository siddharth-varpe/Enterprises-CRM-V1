import { env } from '../../config/env';
import { getRedisClient } from '../../redis/client';
import type { RoutesCalculationResult, RouteErrorCode } from './maps-tracking.types';

/**
 * Google Routes API Client & Road Distance/ETA Calculation Service
 *
 * Rules:
 * - Strictly keeps server API key server-side.
 * - Validates origin and destination coordinates.
 * - Throttles and caches external Google Routes calls.
 * - Deduplicates concurrent in-flight requests.
 * - Enforces explicit request timeouts (8s) via AbortSignal.
 * - Never presents straight-line distances as road distances.
 * - Never returns fake or hardcoded mock distances/ETAs in production.
 * - Returns structured success or safe error states with typed error codes.
 */
class MapsRoutesService {
  private cachePrefix = 'tech_routes_cache:';
  private cacheTtlSeconds = 180; // Cache valid road distance & ETA for 3 minutes
  private inFlightRequests = new Map<string, Promise<RoutesCalculationResult>>();

  /**
   * Validate geographical coordinates
   */
  public isValidCoordinate(lat: unknown, lng: unknown): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  }

  /**
   * Calculate Haversine straight-line distance between two points in meters.
   * Note: Haversine distance is strictly used for arrival geofence detection,
   * NOT as a substitute for road route distance.
   */
  public calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Format distance in meters to user-friendly string
   */
  public formatDistance(meters: number): string {
    if (!Number.isFinite(meters) || meters < 0) return '--';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Format duration in seconds to user-friendly string
   */
  public formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '--';
    const mins = Math.round(seconds / 60);
    if (mins < 1) {
      return '< 1 min';
    }
    if (mins < 60) {
      return `${mins} min${mins === 1 ? '' : 's'}`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours} hr ${remMins} min` : `${hours} hr`;
  }

  /**
   * Compute route road distance and ETA between origin and destination.
   * Uses Google Routes API (computeRoutes) with request deduplication, timeout, and caching.
   */
  public async computeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RoutesCalculationResult> {
    // 1. Strict coordinate validation
    if (!this.isValidCoordinate(originLat, originLng)) {
      return {
        status: 'UNAVAILABLE',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
        source: 'GOOGLE_ROUTES_API',
        errorCode: 'INVALID_COORDINATES',
        errorMessage: 'Technician coordinates are invalid or out of range',
      };
    }

    if (!this.isValidCoordinate(destLat, destLng)) {
      return {
        status: 'UNAVAILABLE',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
        source: 'GOOGLE_ROUTES_API',
        errorCode: 'INVALID_COORDINATES',
        errorMessage: 'Destination coordinates are invalid or out of range',
      };
    }

    // 2. Proximity check: If origin and destination are within 15 meters, road distance is 0
    const proximityDist = this.calculateHaversineDistance(originLat, originLng, destLat, destLng);
    if (proximityDist <= 15) {
      return {
        status: 'SUCCESS',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '0 m',
        durationText: '< 1 min',
        source: 'GOOGLE_ROUTES_API',
        calculatedAt: Date.now(),
      };
    }

    // 3. Cache Check (~100m grid clustering: 3 decimal places)
    const cacheKey = `${this.cachePrefix}${originLat.toFixed(3)},${originLng.toFixed(3)}:${destLat.toFixed(3)},${destLng.toFixed(3)}`;
    const redis = getRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as RoutesCalculationResult;
        if (parsed && parsed.status === 'SUCCESS') {
          return parsed;
        }
      }
    } catch {
      // Redis cache read failure is non-fatal
    }

    // 4. In-flight request deduplication
    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    // 5. Execute computation with deduplication wrapper
    const computationPromise = this.executeComputeRoute(
      originLat,
      originLng,
      destLat,
      destLng,
      cacheKey
    );

    this.inFlightRequests.set(cacheKey, computationPromise);

    try {
      return await computationPromise;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Internal execution of Google Routes API request
   */
  private async executeComputeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    cacheKey: string
  ): Promise<RoutesCalculationResult> {
    const serverKey = env.GOOGLE_MAPS_SERVER_API_KEY || env.ROUTES_API_KEY;
    const redis = getRedisClient();

    if (!serverKey || serverKey.trim().length === 0) {
      console.warn('[MapsRoutesService] Google Maps server API key (ROUTES_API_KEY) is not configured.');
      return {
        status: 'ERROR',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
        source: 'GOOGLE_ROUTES_API',
        errorCode: 'PROVIDER_CONFIGURATION_ERROR',
        errorMessage: 'Routing API server key is missing or not configured',
      };
    }

    try {
      // 8-second strict timeout to prevent indefinite hangs
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: originLat,
                longitude: originLng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destLat,
                longitude: destLng,
              },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const route = data?.routes?.[0];

        if (!route) {
          return {
            status: 'UNAVAILABLE',
            distanceMeters: 0,
            durationSeconds: 0,
            distanceText: '--',
            durationText: '--',
            source: 'GOOGLE_ROUTES_API',
            errorCode: 'PROVIDER_INVALID_RESPONSE',
            errorMessage: 'No drivable route found between origin and destination',
          };
        }

        const rawDist = route.distanceMeters;
        const distanceMeters = typeof rawDist === 'number' ? rawDist : parseInt(rawDist, 10);
        const durationRaw = String(route.duration || '0s');
        const durationSeconds = parseInt(durationRaw.replace('s', ''), 10) || 0;
        const polyline = route.polyline?.encodedPolyline || null;

        if (isNaN(distanceMeters) || isNaN(durationSeconds)) {
          return {
            status: 'ERROR',
            distanceMeters: 0,
            durationSeconds: 0,
            distanceText: '--',
            durationText: '--',
            source: 'GOOGLE_ROUTES_API',
            errorCode: 'PROVIDER_INVALID_RESPONSE',
            errorMessage: 'Malformed distance or duration in routing provider response',
          };
        }

        const result: RoutesCalculationResult = {
          status: 'SUCCESS',
          distanceMeters,
          durationSeconds,
          distanceText: this.formatDistance(distanceMeters),
          durationText: this.formatDuration(durationSeconds),
          source: 'GOOGLE_ROUTES_API',
          polyline,
          calculatedAt: Date.now(),
        };

        // Cache successful road route in Redis with TTL
        try {
          await redis.set(cacheKey, JSON.stringify(result), 'EX', this.cacheTtlSeconds);
        } catch {}

        return result;
      }

      // Handle provider HTTP failure statuses
      let errorCode: RouteErrorCode = 'PROVIDER_INVALID_RESPONSE';
      let errorMessage = `Routing provider returned HTTP ${response.status}`;

      if (response.status === 429) {
        errorCode = 'PROVIDER_RATE_LIMITED';
        errorMessage = 'Google Routes API request quota exceeded (RATE_LIMIT_EXCEEDED)';
        console.warn(`[MapsRoutesService] Routes API rate limit reached (HTTP 429)`);
      } else if (response.status === 401 || response.status === 403) {
        errorCode = 'PROVIDER_AUTHORIZATION_ERROR';
        errorMessage = 'Google Routes API authorization failed or API key restricted';
        console.warn(`[MapsRoutesService] Routes API authorization failed (HTTP ${response.status})`);
      } else if (response.status === 400) {
        errorCode = 'INVALID_COORDINATES';
        errorMessage = 'Google Routes API rejected routing coordinates';
        console.warn(`[MapsRoutesService] Routes API rejected request (HTTP 400)`);
      }

      return {
        status: 'ERROR',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
        source: 'GOOGLE_ROUTES_API',
        errorCode,
        errorMessage,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const errorCode: RouteErrorCode = isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
      const errorMessage = isTimeout
        ? 'Route calculation timed out after 8 seconds'
        : (err?.message || 'Network error communicating with Google Routes API');

      console.warn(`[MapsRoutesService] Route calculation error: ${errorMessage}`);

      return {
        status: 'ERROR',
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '--',
        durationText: '--',
        source: 'GOOGLE_ROUTES_API',
        errorCode,
        errorMessage,
      };
    }
  }
}

export const mapsRoutesService = new MapsRoutesService();
