import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { db } from '../../database/client';
import { services, customers, customerAddresses, jobCards } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticateTechnician } from '../technician-portal/technician-portal.middleware';
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
import { memoryServices } from '../services/services.repository';
import { memoryJobCards } from '../job-cards/job-cards.repository';
import { z } from 'zod';

const NavigateRequestSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  confirmSwitch: z.boolean().optional(),
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
   * GET /api/v1/maps/admin/live-technicians
   * Returns all active tracked technicians for the Admin Live Map.
   */
  fastify.get('/admin/live-technicians', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const activeTechnicians = await mapsTrackingRedisService.getAllActiveLocations();
      const enriched = activeTechnicians.map((t) => ({
        ...t,
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
        customerLatitude: t.activeDestination?.latitude,
        customerLongitude: t.activeDestination?.longitude,
        scheduledTime: t.activeDestination?.scheduledTimeSlot,
        distanceKm: t.distanceMeters ? Math.round((t.distanceMeters / 1000) * 10) / 10 : undefined,
        etaMinutes: t.etaSeconds ? Math.ceil(t.etaSeconds / 60) : undefined,
        lastUpdated: new Date(t.lastUpdate).toISOString(),
        secondsAgo: Math.max(0, Math.floor((Date.now() - t.lastUpdate) / 1000)),
      }));
      return reply.send({
        success: true,
        data: enriched,
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

      try {
        const [serv] = await db
          .select()
          .from(services)
          .where(and(eq(services.id, serviceId), eq(services.technicianId, technician.technicianId)))
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
            s.technicianId === technician.technicianId
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

      await mapsTrackingRedisService.setActiveDestination(technician.technicianId, destinationRecord);

      // 5. Construct Google Maps navigation URL
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

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
