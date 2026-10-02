import { env } from '../../config/env';
import { getRedisClient } from '../../redis/client';
import type { RoutesCalculationResult } from './maps-tracking.types';

/**
 * Google Routes API Client & Distance/ETA Calculation Service
 * Strictly keeps server API key server-side.
 * Throttles and caches external Google Routes calls to prevent high-frequency billing loops.
 * Provides safe fallback Haversine distance and duration calculation.
 */
class MapsRoutesService {
  private cachePrefix = 'tech_routes_cache:';
  private cacheTtlSeconds = 90; // Cache road distance & ETA for 90 seconds

  /**
   * Calculate Haversine straight-line distance between two points in meters
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
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Format duration in seconds to user-friendly string
   */
  public formatDuration(seconds: number): string {
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
   * Uses Google Routes API with in-memory/Redis caching and fallback.
   */
  public async computeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RoutesCalculationResult> {
    // 1. Check cache for recent calculation between these proximate coordinates (~10m rounding)
    const cacheKey = `${this.cachePrefix}${originLat.toFixed(3)},${originLng.toFixed(3)}:${destLat.toFixed(3)},${destLng.toFixed(3)}`;
    const redis = getRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as RoutesCalculationResult;
      }
    } catch {
      // Redis cache read failure is non-fatal
    }

    // 2. Compute straight-line distance as baseline
    const straightLineMeters = this.calculateHaversineDistance(originLat, originLng, destLat, destLng);

    // 3. Attempt Google Routes API (Directions v2) if server key is configured
    const serverKey = env.GOOGLE_MAPS_SERVER_API_KEY || env.ROUTES_API_KEY;

    if (serverKey && serverKey.trim().length > 0) {
      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': serverKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
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
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const route = data?.routes?.[0];
          if (route) {
            const distanceMeters = Number(route.distanceMeters || straightLineMeters);
            // duration is formatted as "720s"
            const durationRaw = route.duration || '0s';
            const durationSeconds = parseInt(durationRaw.replace('s', ''), 10) || Math.round(distanceMeters / 7); // ~25km/h

            const result: RoutesCalculationResult = {
              distanceMeters,
              durationSeconds,
              distanceText: this.formatDistance(distanceMeters),
              durationText: this.formatDuration(durationSeconds),
              source: 'GOOGLE_ROUTES_API',
            };

            // Cache result in Redis
            try {
              await redis.set(cacheKey, JSON.stringify(result), 'EX', this.cacheTtlSeconds);
            } catch {}

            return result;
          }
        } else {
          // Controlled diagnostic logging without printing secret values
          console.warn(`[MapsRoutesService] Routes API responded with status ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[MapsRoutesService] Routes API call warning: ${err?.message || 'Network error'}`);
      }
    }

    // 4. Safe Fallback: Urban road factor estimation (road distance ~ 1.3x straight-line, 25 km/h driving speed)
    const estimatedRoadMeters = Math.round(straightLineMeters * 1.3);
    const estimatedSeconds = Math.max(60, Math.round(estimatedRoadMeters / 6.94)); // 25 km/h = 6.94 m/s

    const fallbackResult: RoutesCalculationResult = {
      distanceMeters: estimatedRoadMeters,
      durationSeconds: estimatedSeconds,
      distanceText: this.formatDistance(estimatedRoadMeters),
      durationText: this.formatDuration(estimatedSeconds),
      source: 'HAVERSINE_ESTIMATE',
    };

    try {
      await redis.set(cacheKey, JSON.stringify(fallbackResult), 'EX', this.cacheTtlSeconds);
    } catch {}

    return fallbackResult;
  }
}

export const mapsRoutesService = new MapsRoutesService();
