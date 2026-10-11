import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { db } from '../../database/client';
import { services, customers, customerAddresses, jobCards, technicians } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticateTechnician } from '../technician-portal/technician-portal.middleware';
import { authenticate } from '../../middleware/auth';
import { mapsTrackingRedisService } from './maps-tracking.redis';
import {
  broadcastTechnicianLocationUpdate,
  broadcastTechnicianTrackingStopped,
} from './maps-socket.service';
import {
  TRACKING_STATUSES,
  type ActiveDestinationRecord,
  type TechnicianLocationPing,
} from './maps-tracking.types';
import { HTTP_STATUS } from '@crm/shared';
import { SUPERADMIN_TECH_ID } from '../technician-portal/technician-portal.constants';
import { memoryServices } from '../services/services.repository';
import { memoryCustomers } from '../customers/customer.repository';
import { memoryJobCards } from '../job-cards/job-cards.repository';
import { z } from 'zod';

import { GeocodeQuerySchema, UpdateAddressPinpointSchema } from '@crm/validation';

const NavigateRequestSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  confirmSwitch: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const LocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().default(10),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  timestamp: z.number().optional(),
});

/**
 * Universal Precision Coordinates & Pinpoint Resolver
 * Resolves exact coordinates from:
 * 1. Direct numeric coordinates
 * 2. Coordinate string "18.52043, 73.85674"
 * 3. Google Maps link (maps.google.com/?q=..., @lat,lng, maps.app.goo.gl redirect, destination=lat,lng)
 * 4. Geocoding from full address text (OSM Nominatim / Photon)
 */
export async function resolvePinpointCoordinates(input: {
  query?: string;
  address?: string;
  url?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ latitude: number; longitude: number; formattedAddress?: string; source: string } | null> {
  // 1. Direct coordinates
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    if (!isNaN(input.latitude) && !isNaN(input.longitude) && input.latitude >= -90 && input.latitude <= 90 && input.longitude >= -180 && input.longitude <= 180) {
      return { latitude: input.latitude, longitude: input.longitude, source: 'EXACT_COORDINATES' };
    }
  }

  // 2. Parse text or URL
  const rawText = (input.url || input.query || input.address || '').trim();
  if (rawText) {
    // A. "18.52043, 73.85674" or "18.52043,73.85674"
    const coordMatch = rawText.match(/^([-+]?[0-9]{1,2}(?:\.[0-9]+)?)[,\s]+([-+]?[0-9]{1,3}(?:\.[0-9]+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng, source: 'COORDINATE_INPUT' };
      }
    }

    // B. Google Maps URL patterns: q=lat,lng or query=lat,lng or destination=lat,lng
    const qMatch = rawText.match(/[?&](?:q|destination|query)=([-+]?[0-9]{1,2}(?:\.[0-9]+)?)[,\s]+([-+]?[0-9]{1,3}(?:\.[0-9]+)?)/i);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng, source: 'GOOGLE_MAPS_LINK' };
      }
    }

    // C. @lat,lng
    const atMatch = rawText.match(/@([-+]?[0-9]{1,2}(?:\.[0-9]+)?),([-+]?[0-9]{1,3}(?:\.[0-9]+)?)/i);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng, source: 'GOOGLE_MAPS_LINK' };
      }
    }

    // D. Shortened Google Maps links (e.g. https://maps.app.goo.gl/... or https://goo.gl/maps/...)
    if (/https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+/i.test(rawText)) {
      try {
        const resp = await fetch(rawText, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(4000) });
        const finalUrl = resp.url;
        const expandedQ = finalUrl.match(/[?&](?:q|destination|query)=([-+]?[0-9]{1,2}(?:\.[0-9]+)?)[,\s]+([-+]?[0-9]{1,3}(?:\.[0-9]+)?)/i);
        if (expandedQ) {
          const lat = parseFloat(expandedQ[1]);
          const lng = parseFloat(expandedQ[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { latitude: lat, longitude: lng, source: 'EXPANDED_MAPS_LINK' };
          }
        }
        const expandedAt = finalUrl.match(/@([-+]?[0-9]{1,2}(?:\.[0-9]+)?),([-+]?[0-9]{1,3}(?:\.[0-9]+)?)/i);
        if (expandedAt) {
          const lat = parseFloat(expandedAt[1]);
          const lng = parseFloat(expandedAt[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { latitude: lat, longitude: lng, source: 'EXPANDED_MAPS_LINK' };
          }
        }
      } catch {}
    }
  }

  // 3. Fallback to geocoding services for address text
  const searchAddress = input.address || input.query || '';
  if (searchAddress.trim()) {
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`,
        {
          headers: { 'User-Agent': 'Enterprises-CRM-Geocoding/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (nomRes.ok) {
        const data = (await nomRes.json()) as any[];
        if (data?.[0]?.lat && data?.[0]?.lon) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: lat,
              longitude: lng,
              formattedAddress: data[0].display_name,
              source: 'OSM_NOMINATIM',
            };
          }
        }
      }
    } catch {}

    try {
      const photRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchAddress)}&limit=1`,
        {
          headers: { 'User-Agent': 'Enterprises-CRM-Geocoding/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (photRes.ok) {
        const data = (await photRes.json()) as any;
        const coords = data?.features?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: lat,
              longitude: lng,
              formattedAddress: data?.features?.[0]?.properties?.name,
              source: 'PHOTON_GEOCODING',
            };
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Maps & Technician Live Tracking Routes Plugin
 * Mounted at: /api/v1/maps
 */
export const mapsRoutes: FastifyPluginAsync = async (fastify) => {
  // ------------------------------------------------------------
  // 1. ADMIN LIVE MAP CONFIGURATION & DATA ENDPOINTS
  // ------------------------------------------------------------

  /**
   * GET /api/v1/maps/admin/config
   * Returns public client-side Google Maps API key and Map ID.
   * Strictly keeps server-side credentials hidden.
   */
  fastify.get('/admin/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        apiKey: env.GOOGLE_MAPS_BROWSER_API_KEY || env.MAPS_JAVASCRIPT_API_KEY || '',
        mapId: env.GOOGLE_MAPS_MAP_ID || env.MAP_ID || '',
      },
    });
  });

  /**
   * POST /api/v1/maps/geocode
   * Resolves precise pinpoint coordinates from address text, coordinate strings, or Google Maps links
   */
  fastify.post('/geocode', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = GeocodeQuerySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid geocode request',
        },
      });
    }

    const resolved = await resolvePinpointCoordinates(parsed.data);
    if (!resolved) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: {
          code: 'COORDINATES_NOT_FOUND',
          message: 'Unable to resolve pinpoint coordinates from the provided location data. Please adjust the pin on the map or enter coordinates directly.',
        },
      });
    }

    return reply.send({
      success: true,
      data: resolved,
    });
  });

  /**
   * PATCH /api/v1/maps/customer-addresses/:id/pinpoint
   * Saves exact pinpoint coordinates for a customer address
   */
  fastify.patch('/customer-addresses/:id/pinpoint', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = (request.params as any) || {};
    if (!id) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Address identifier is required' },
      });
    }

    const parsed = UpdateAddressPinpointSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid pinpoint coordinates',
        },
      });
    }

    const { latitude, longitude } = parsed.data;

    try {
      await db
        .update(customerAddresses)
        .set({ latitude, longitude, updatedAt: new Date() })
        .where(eq(customerAddresses.id, id));
    } catch (err: any) {
      console.warn('[mapsRoutes.pinpoint] DB update notice:', err?.message);
    }

    // Update in-memory customer addresses if present
    for (const memCust of memoryCustomers) {
      if (Array.isArray(memCust.addresses)) {
        const addr = memCust.addresses.find((a: any) => a.id === id);
        if (addr) {
          addr.latitude = latitude;
          addr.longitude = longitude;
        }
      }
    }

    return reply.send({
      success: true,
      data: { id, latitude, longitude },
    });
  });

  const requireAdminOrStaffMapAccess = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // In production, when explicit security enforcement is requested, or when authentication credentials are provided
    if (env.NODE_ENV === 'production' || request.headers['x-enforce-auth'] === 'true' || request.cookies?.crm_auth_session || request.headers.authorization) {
      await authenticate(request, reply);
      if (!request.user) return;
      if (request.user.role !== 'Super Admin' && request.user.role !== 'Admin' && request.user.role !== 'Staff') {
        return reply.status(HTTP_STATUS.FORBIDDEN).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: Admin or Staff live map permissions required',
          },
        });
      }
    }
  };

  /**
   * GET /api/v1/maps/admin/live-technicians
   * Returns all active tracked technicians for the Admin Live Map.
   */
  fastify.get('/admin/live-technicians', { preHandler: [requireAdminOrStaffMapAccess] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const activeTechnicians = await mapsTrackingRedisService.getAllActiveLocations();
      const trackedTechIds = new Set<string>();

      const enriched = activeTechnicians.map((t) => {
        trackedTechIds.add(t.technicianId);
        const actualTimestamp = t.currentLocation?.timestamp || t.lastUpdate;
        const hasDest = Boolean(t.activeDestination && t.activeDestination.latitude && t.activeDestination.longitude);

        const distKm =
          hasDest && typeof t.distanceMeters === 'number'
            ? Math.round((t.distanceMeters / 1000) * 10) / 10
            : undefined;
        const etaMins =
          hasDest && typeof t.etaSeconds === 'number'
            ? Math.ceil(t.etaSeconds / 60)
            : undefined;

        let trackingStatus: string = t.trackingStatus;
        if (!hasDest) {
          trackingStatus = TRACKING_STATUSES.UNTRACKED;
        }

        let routeStatus = t.routeStatus;
        if (!routeStatus) {
          if (distKm !== undefined && etaMins !== undefined) {
            routeStatus = 'SUCCESS';
          } else {
            routeStatus = 'UNAVAILABLE';
          }
        }

        return {
          ...t,
          trackingStatus,
          latitude: t.currentLocation?.latitude,
          longitude: t.currentLocation?.longitude,
          accuracy: t.currentLocation?.accuracy,
          heading: t.currentLocation?.heading,
          speed: t.currentLocation?.speed,
          statusFreshness: t.freshness,
          serviceId: t.activeDestination?.serviceId || '',
          jobCardId: t.activeDestination?.jobCardId || undefined,
          customerName: t.activeDestination?.customerName,
          customerAddress: t.activeDestination?.address,
          customerLatitude: hasDest ? t.activeDestination?.latitude : undefined,
          customerLongitude: hasDest ? t.activeDestination?.longitude : undefined,
          scheduledTime: t.activeDestination?.scheduledTimeSlot,
          distanceKm: distKm,
          etaMinutes: etaMins,
          distanceMeters: hasDest ? (t.distanceMeters ?? null) : null,
          distanceText: hasDest ? (t.distanceText ?? null) : null,
          etaSeconds: hasDest ? (t.etaSeconds ?? null) : null,
          etaText: hasDest ? (t.etaText ?? null) : null,
          routeStatus,
          routeErrorCode: t.routeErrorCode ?? null,
          routeErrorMessage: t.routeErrorMessage ?? null,
          routeCalculatedAt: t.routeCalculatedAt ?? null,
          routePolyline: hasDest ? (t.routePolyline ?? null) : null,
          travelledPath: hasDest ? (t.travelledPath ?? []) : [],
          lastUpdated: new Date(actualTimestamp).toISOString(),
          secondsAgo: Math.max(0, Math.floor((Date.now() - actualTimestamp) / 1000)),
        };
      });

      // Include assigned technicians who have not clicked Navigate as UNTRACKED
      const untrackedAssignedTechs: any[] = [];
      try {
        const assignedServices = await db
          .select({
            serviceId: services.id,
            serviceNumber: services.serviceNumber,
            technicianId: services.technicianId,
            technicianName: technicians.fullName,
            technicianPhone: technicians.phone,
            scheduledTimeSlot: services.scheduledTimeSlot,
            status: services.status,
            customerName: customers.fullName,
            customerAddress: customerAddresses.addressLine1,
          })
          .from(services)
          .innerJoin(customers, eq(services.customerId, customers.id))
          .leftJoin(technicians, eq(services.technicianId, technicians.id))
          .leftJoin(
            customerAddresses,
            and(eq(customerAddresses.customerId, customers.id), eq(customerAddresses.isDefault, true))
          )
          .where(eq(services.status, 'ASSIGNED'));

        for (const s of assignedServices) {
          if (s.technicianId && !trackedTechIds.has(s.technicianId)) {
            trackedTechIds.add(s.technicianId);
            untrackedAssignedTechs.push({
              technicianId: s.technicianId,
              technicianName: s.technicianName || 'Assigned Technician',
              technicianPhone: s.technicianPhone,
              trackingStatus: TRACKING_STATUSES.UNTRACKED,
              serviceId: s.serviceId,
              customerName: s.customerName,
              customerAddress: s.customerAddress,
              scheduledTime: s.scheduledTimeSlot,
              statusFreshness: 'OFFLINE',
              routeStatus: 'UNAVAILABLE',
              routePolyline: null,
              travelledPath: [],
              lastUpdated: new Date(0).toISOString(),
              secondsAgo: 0,
            });
          }
        }
      } catch {
        // Fallback for tests or memory store
        for (const s of memoryServices) {
          if (
            s.technicianId &&
            (s.status === 'ASSIGNED' || s.status === 'SCHEDULED') &&
            !trackedTechIds.has(s.technicianId)
          ) {
            trackedTechIds.add(s.technicianId);
            const memCust = memoryCustomers.find((c: any) => c.id === s.customerId);
            const memAddr = memCust?.addresses?.find((a: any) => a.isDefault) || memCust?.addresses?.[0];
            untrackedAssignedTechs.push({
              technicianId: s.technicianId,
              technicianName: s.technicianName || 'Assigned Technician',
              trackingStatus: TRACKING_STATUSES.UNTRACKED,
              serviceId: s.id,
              customerName: s.customer?.fullName || memCust?.fullName || s.customerName || 'Customer',
              customerAddress: s.address?.addressLine1 || memAddr?.addressLine1 || s.serviceAddress || 'Address',
              scheduledTime: s.scheduledTimeSlot,
              statusFreshness: 'OFFLINE',
              routeStatus: 'UNAVAILABLE',
              routePolyline: null,
              travelledPath: [],
              lastUpdated: new Date(0).toISOString(),
              secondsAgo: 0,
            });
          }
        }
      }

      return reply.send({
        success: true,
        data: [...enriched, ...untrackedAssignedTechs],
      });
    } catch (err: any) {
      return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          code: 'REDIS_ERROR',
          message: 'Unable to retrieve live technician tracking records',
        },
      });
    }
  });

  /**
   * POST /api/v1/maps/admin/recalculate-route
   * Triggers an on-demand route calculation/refresh for a specific technician.
   */
  fastify.post('/admin/recalculate-route', { preHandler: [requireAdminOrStaffMapAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { technicianId?: string };
    const technicianId = body?.technicianId;

    if (!technicianId || typeof technicianId !== 'string') {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'technicianId is required for route recalculation',
        },
      });
    }

    try {
      const updatedRecord = await mapsTrackingRedisService.recalculateRoute(technicianId);
      if (!updatedRecord) {
        return reply.status(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          error: {
            code: 'TECHNICIAN_NOT_FOUND',
            message: 'Technician is not currently in active tracking',
          },
        });
      }

      // Broadcast updated location with refreshed route to all admin listeners
      broadcastTechnicianLocationUpdate(updatedRecord);

      const distKm =
        typeof updatedRecord.distanceMeters === 'number'
          ? Math.round((updatedRecord.distanceMeters / 1000) * 10) / 10
          : undefined;
      const etaMins =
        typeof updatedRecord.etaSeconds === 'number'
          ? Math.ceil(updatedRecord.etaSeconds / 60)
          : undefined;

      return reply.send({
        success: true,
        data: {
          technicianId: updatedRecord.technicianId,
          routeStatus: updatedRecord.routeStatus,
          routeErrorCode: updatedRecord.routeErrorCode,
          routeErrorMessage: updatedRecord.routeErrorMessage,
          distanceKm: distKm,
          etaMinutes: etaMins,
          distanceMeters: updatedRecord.distanceMeters,
          distanceText: updatedRecord.distanceText,
          etaSeconds: updatedRecord.etaSeconds,
          etaText: updatedRecord.etaText,
          routeCalculatedAt: updatedRecord.routeCalculatedAt,
        },
      });
    } catch (err: any) {
      return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          code: 'RECALCULATION_FAILED',
          message: err?.message || 'Failed to recalculate route',
        },
      });
    }
  });

  // ------------------------------------------------------------
  // 2. TECHNICIAN PORTAL LIVE TRACKING ENDPOINTS
  // Strictly authenticated and scoped to session technicianId
  // ------------------------------------------------------------

  const technicianTracking = async (techScope: typeof fastify) => {
    techScope.addHook('preHandler', authenticateTechnician);

    /**
     * POST /api/v1/maps/technician/navigate
     * Sets active destination, sets status ON_THE_WAY, and returns Google Maps URL.
     * Enforces ONE active destination per technician.
     */
    techScope.post('/technician/navigate', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = NavigateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Invalid navigation request',
          },
        });
      }

      const technician = request.technician!;
      const { serviceId, confirmSwitch } = parsed.data;

      // 1. Verify service belongs strictly to the authenticated technician
      let serviceRecord: any = null;
      let customerRecord: any = null;
      let addressRecord: any = null;
      let jobCardRecord: any = null;

      const isSuperAdmin =
        (technician as any).isSuperAdmin === true ||
        technician.technicianId === SUPERADMIN_TECH_ID;

      try {
        const queryCondition = isSuperAdmin
          ? eq(services.id, serviceId)
          : and(eq(services.id, serviceId), eq(services.technicianId, technician.technicianId));

        const [serv] = await db
          .select()
          .from(services)
          .where(queryCondition)
          .limit(1);

        serviceRecord = serv;

        if (serviceRecord) {
          const [cust] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, serviceRecord.customerId))
            .limit(1);
          customerRecord = cust;

          const [addr] = await db
            .select()
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, serviceRecord.customerId))
            .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
            .limit(1);
          addressRecord = addr;

          const [jc] = await db
            .select()
            .from(jobCards)
            .where(eq(jobCards.serviceId, serviceRecord.id))
            .limit(1);
          jobCardRecord = jc;
        }
      } catch (dbErr) {
        // Fallback for tests or in-memory
      }

      // Memory fallback for tests & dev offline store
      if (!serviceRecord) {
        const mem = memoryServices.find(
          (s: any) =>
            (s.id === serviceId || s.serviceNumber === serviceId) &&
            (isSuperAdmin || s.technicianId === technician.technicianId)
        );
        if (mem) {
          serviceRecord = mem;
          customerRecord = mem.customer || {
            id: mem.customerId,
            fullName: mem.customerName || 'Customer',
            phone: mem.customerPhone || '',
          };
          addressRecord = mem.location || mem.address || {
            latitude: mem.latitude,
            longitude: mem.longitude,
            addressLine1: mem.addressLine1 || mem.serviceAddress || 'Customer Address',
            city: mem.city,
            state: mem.state,
            postalCode: mem.pincode || mem.postalCode,
          };
          jobCardRecord = memoryJobCards.find((j: any) => j.serviceId === mem.id);
        }
      }

      // If customerRecord or addressRecord is incomplete or missing, check memoryCustomers
      if (serviceRecord) {
        const memCust = memoryCustomers.find(
          (c: any) => c.id === serviceRecord.customerId || c.customerNumber === serviceRecord.customerId
        );
        if (memCust) {
          if (!customerRecord || customerRecord.fullName === 'Customer') {
            customerRecord = {
              id: memCust.id,
              fullName: memCust.fullName,
              phone: memCust.phone || '',
            };
          }
          if (
            !addressRecord ||
            (!addressRecord.latitude && !addressRecord.city && !addressRecord.postalCode) ||
            addressRecord.addressLine1 === 'Customer Address'
          ) {
            const defAddr =
              memCust.addresses?.find((a: any) => a.isDefault) ||
              memCust.addresses?.[0] ||
              memCust.address;
            if (defAddr) {
              addressRecord = {
                id: defAddr.id,
                latitude: defAddr.latitude,
                longitude: defAddr.longitude,
                addressLine1: defAddr.addressLine1,
                addressLine2: defAddr.addressLine2,
                landmark: defAddr.landmark,
                city: defAddr.city,
                state: defAddr.state,
                postalCode: defAddr.postalCode || defAddr.pincode,
              };
            }
          }
        }
      }

      // If database returned no record, check if technician is authorized
      if (!serviceRecord) {
        return reply.status(HTTP_STATUS.FORBIDDEN).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Service is not assigned to the authenticated technician',
          },
        });
      }

      // 2. Obtain existing authoritative customer coordinates
      let lat = addressRecord?.latitude ? Number(addressRecord.latitude) : null;
      let lng = addressRecord?.longitude ? Number(addressRecord.longitude) : null;

      // If customer address does not have lat/lng stored yet, geocode from address text
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        const candidateQueries = [
          [addressRecord?.addressLine1, addressRecord?.addressLine2, addressRecord?.city, addressRecord?.postalCode],
          [addressRecord?.addressLine2, addressRecord?.city, addressRecord?.postalCode],
          [addressRecord?.addressLine1, addressRecord?.city, addressRecord?.postalCode],
          [addressRecord?.landmark, addressRecord?.city, addressRecord?.postalCode],
          [addressRecord?.city, addressRecord?.postalCode],
          [addressRecord?.city, addressRecord?.state],
          [addressRecord?.addressLine1, addressRecord?.city],
        ]
          .map((parts) => parts.filter(Boolean).join(', ').trim())
          .filter((q, idx, arr) => q.length > 0 && arr.indexOf(q) === idx);

        for (const query of candidateQueries) {
          const resolved = await resolvePinpointCoordinates({ query });
          if (resolved) {
            lat = resolved.latitude;
            lng = resolved.longitude;
            break;
          }
        }

        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          // Save to customerAddresses in DB so it's permanently cached
          if (addressRecord?.id) {
            try {
              await db
                .update(customerAddresses)
                .set({ latitude: lat, longitude: lng })
                .where(eq(customerAddresses.id, addressRecord.id));
            } catch {}
          }
          if (serviceRecord?.customerId) {
            const memCust = memoryCustomers.find(
              (c: any) => c.id === serviceRecord.customerId || c.customerNumber === serviceRecord.customerId
            );
            if (memCust) {
              memCust.latitude = lat;
              memCust.longitude = lng;
              if (Array.isArray(memCust.addresses)) {
                const addr = memCust.addresses.find((a: any) => a.id === addressRecord?.id) || memCust.addresses[0];
                if (addr) {
                  addr.latitude = lat;
                  addr.longitude = lng;
                }
              }
            }
          }
        }
      }

      // Fail safely if customer coordinates do not exist: do not invent coordinates
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            code: 'CUSTOMER_COORDINATES_MISSING',
            message: 'Authoritative GPS coordinates do not exist for this customer address. Navigation cannot start without valid destination coordinates.',
          },
        });
      }

      // 3. Concurrency check: ONE technician = ONE active destination
      const existingDestination = await mapsTrackingRedisService.getActiveDestination(technician.technicianId);
      if (existingDestination && existingDestination.serviceId !== serviceId && !confirmSwitch) {
        return reply.status(HTTP_STATUS.CONFLICT).send({
          success: false,
          conflict: true,
          activeServiceId: existingDestination.serviceId,
          activeServiceNumber: existingDestination.serviceNumber,
          message: `You are currently navigating to Service ${existingDestination.serviceNumber}. Confirm switching active destination?`,
        });
      }

      // 4. Set active destination in Redis with TTL
      const formattedAddress = [
        addressRecord?.addressLine1,
        addressRecord?.addressLine2,
        addressRecord?.landmark,
        addressRecord?.city,
        addressRecord?.state,
        addressRecord?.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      const destinationRecord: ActiveDestinationRecord = {
        serviceId: serviceRecord.id,
        serviceNumber: serviceRecord.serviceNumber,
        jobCardId: jobCardRecord?.id || null,
        jobCardNumber: jobCardRecord?.jobCardNumber || null,
        customerId: customerRecord?.id || serviceRecord.customerId,
        customerName: customerRecord?.fullName || 'Customer',
        customerPhone: customerRecord?.phone || '',
        address: formattedAddress || 'Service Address',
        latitude: lat,
        longitude: lng,
        scheduledDate: serviceRecord.scheduledDate,
        scheduledTimeSlot: serviceRecord.scheduledTimeSlot,
        startedAt: Date.now(),
      };

      const initialOrigin =
        typeof parsed.data.latitude === 'number' && typeof parsed.data.longitude === 'number'
          ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
          : undefined;

      await mapsTrackingRedisService.setActiveDestination(
        technician.technicianId,
        destinationRecord,
        technician.fullName,
        technician.phone,
        initialOrigin
      );

      // 5. Construct Google Maps navigation URL
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

      // 6. Issue scoped navigation session token for native/background tracking
      const navSessionToken = await mapsTrackingRedisService.createNavSessionToken(
        technician.technicianId,
        destinationRecord.serviceId
      );

      // Broadcast destination update to admin map
      const currentLoc = await mapsTrackingRedisService.getLocation(technician.technicianId);
      if (currentLoc) {
        broadcastTechnicianLocationUpdate(currentLoc);
      }

      return reply.send({
        success: true,
        trackingStatus: TRACKING_STATUSES.ON_THE_WAY,
        googleMapsUrl,
        destination: destinationRecord,
        navSessionToken,
      });
    });

    /**
     * POST /api/v1/maps/technician/location
     * Submits continuous GPS location ping from browser navigator.geolocation.watchPosition()
     */
    techScope.post('/technician/location', async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = LocationPingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Invalid location coordinates',
          },
        });
      }

      const technician = request.technician!;
      const ping: TechnicianLocationPing = {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracy: parsed.data.accuracy,
        heading: parsed.data.heading ?? null,
        speed: parsed.data.speed ?? null,
        timestamp: parsed.data.timestamp || Date.now(),
      };

      try {
        const record = await mapsTrackingRedisService.updateLocation(
          technician.technicianId,
          technician.fullName,
          technician.phone,
          ping
        );

        // Broadcast live update to Admin Live Map
        broadcastTechnicianLocationUpdate(record);

        return reply.send({
          success: true,
          data: record,
        });
      } catch (err: any) {
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: {
            code: 'TRACKING_UPDATE_FAILED',
            message: err?.message || 'Failed to update live location',
          },
        });
      }
    });

    /**
     * POST /api/v1/maps/technician/stop
     * Explicitly terminates live tracking and clears temporary Redis state.
     */
    techScope.post('/technician/stop', async (request: FastifyRequest, reply: FastifyReply) => {
      const technician = request.technician!;

      try {
        await mapsTrackingRedisService.clearTracking(technician.technicianId);
        broadcastTechnicianTrackingStopped(technician.technicianId);

        return reply.send({
          success: true,
          message: 'Tracking terminated and temporary location state removed.',
        });
      } catch (err: any) {
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: {
            code: 'TRACKING_STOP_FAILED',
            message: err?.message || 'Failed to stop tracking',
          },
        });
      }
    });

    /**
     * PATCH /api/v1/maps/technician/services/:id/pinpoint
     * Allows authenticated technician to update the exact customer address pinpoint coordinates for an assigned service
     */
    techScope.patch('/technician/services/:id/pinpoint', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: serviceId } = (request.params as any) || {};
      const parsed = UpdateAddressPinpointSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Invalid pinpoint coordinates',
          },
        });
      }

      const technician = request.technician!;
      const isSuperAdmin = (technician as any).isSuperAdmin === true || technician.technicianId === SUPERADMIN_TECH_ID;

      // Locate service and customer address
      let serviceRecord: any = null;
      try {
        const queryCondition = isSuperAdmin
          ? eq(services.id, serviceId)
          : and(eq(services.id, serviceId), eq(services.technicianId, technician.technicianId));

        const [serv] = await db.select().from(services).where(queryCondition).limit(1);
        serviceRecord = serv;
      } catch {}

      if (!serviceRecord) {
        serviceRecord = memoryServices.find((s: any) => s.id === serviceId && (isSuperAdmin || s.technicianId === technician.technicianId));
      }

      if (!serviceRecord) {
        return reply.status(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          error: { code: 'SERVICE_NOT_FOUND', message: 'Assigned service work order not found.' },
        });
      }

      const { latitude, longitude } = parsed.data;

      // Update customer address in DB
      try {
        const [addr] = await db
          .select({ id: customerAddresses.id })
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, serviceRecord.customerId))
          .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
          .limit(1);

        if (addr?.id) {
          await db
            .update(customerAddresses)
            .set({ latitude, longitude, updatedAt: new Date() })
            .where(eq(customerAddresses.id, addr.id));
        }
      } catch (err: any) {
        console.warn('[technician.pinpoint] DB update notice:', err?.message);
      }

      // Also update in-memory customers and services
      const memCust = memoryCustomers.find((c: any) => c.id === serviceRecord.customerId);
      if (memCust) {
        memCust.latitude = latitude;
        memCust.longitude = longitude;
        if (Array.isArray(memCust.addresses) && memCust.addresses.length > 0) {
          memCust.addresses[0].latitude = latitude;
          memCust.addresses[0].longitude = longitude;
        }
      }
      if (serviceRecord) {
        serviceRecord.latitude = latitude;
        serviceRecord.longitude = longitude;
        if (serviceRecord.location) {
          serviceRecord.location.latitude = latitude;
          serviceRecord.location.longitude = longitude;
        }
      }

      return reply.send({
        success: true,
        data: {
          serviceId,
          latitude,
          longitude,
          googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
        },
      });
    });

    /**
     * GET /api/v1/maps/technician/active
     * Retrieves current active tracking and destination state for the authenticated technician.
     */
    techScope.get('/technician/active', async (request: FastifyRequest, reply: FastifyReply) => {
      const technician = request.technician!;

      try {
        const record = await mapsTrackingRedisService.getLocation(technician.technicianId);
        return reply.send({
          success: true,
          data: record,
        });
      } catch (err: any) {
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
          success: false,
          error: {
            code: 'TRACKING_FETCH_FAILED',
            message: err?.message || 'Failed to fetch active tracking status',
          },
        });
      }
    });
  };

  // Register technician tracking routes under this namespace
  fastify.register(technicianTracking);
};
