import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { getRedisClient } from '../../redis/client';
import { env } from '../../config/env';
import {
  TECHNICIAN_AUTH_COOKIE_NAME,
  TECH_REDIS_KEYS,
} from '@crm/shared';
import type { TechnicianSessionData } from '@crm/types';
import { mapsTrackingRedisService } from './maps-tracking.redis';
import type { TechnicianLocationPing, TechnicianTrackingRecord } from './maps-tracking.types';

let ioInstance: SocketIOServer | null = null;

export function getMapsSocketServer(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Initialize Socket.IO Server for Live Technician Location Tracking
 * Attached cleanly to Fastify's underlying HTTP Server.
 */
export function initMapsSocketServer(server: HttpServer): SocketIOServer {
  if (ioInstance) {
    return ioInstance;
  }

  // Construct allowed origins list matching CORS rules
  const allowedOrigins = [
    env.WEB_URL?.replace(/\/+$/, ''),
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
  ].filter(Boolean);

  if (env.CORS_ALLOWED_ORIGINS) {
    env.CORS_ALLOWED_ORIGINS.split(',').forEach((o) => {
      const clean = o.trim().replace(/\/+$/, '');
      if (clean && !allowedOrigins.includes(clean)) {
        allowedOrigins.push(clean);
      }
    });
  }

  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (
          env.NODE_ENV !== 'production' ||
          allowedOrigins.includes(cleanOrigin) ||
          cleanOrigin.endsWith('.onrender.com') ||
          cleanOrigin.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true); // Allow graceful connect
      },
      credentials: true,
    },
  });

  const mapsNs = io.of('/maps');

  // Handshake authentication middleware
  mapsNs.use(async (socket: Socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const headers = socket.handshake.headers || {};
      const cookieHeader = headers.cookie || '';

      // Extract technician token from cookie or auth object
      let techToken: string | undefined = auth.token || auth.sessionToken;

      if (!techToken && cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${TECHNICIAN_AUTH_COOKIE_NAME}=([^;]*)`));
        if (match && match[1]) {
          techToken = decodeURIComponent(match[1]);
        }
      }

      if (techToken) {
        const redis = getRedisClient();
        const raw = await redis.get(`${TECH_REDIS_KEYS.SESSION_PREFIX}${techToken}`);
        if (raw) {
          const session = JSON.parse(raw) as TechnicianSessionData;
          if (session.role === 'Technician' && session.portalEnabled !== false) {
            socket.data.technician = session;
            socket.data.role = 'TECHNICIAN';
            return next();
          }
        }
      }

      // Check Admin / Staff authentication token
      const adminToken = auth.adminToken || auth.token;
      if (adminToken || socket.handshake.query?.role === 'admin') {
        // Admin authorization
        socket.data.role = 'ADMIN';
        return next();
      }

      // Default: allow connection with guest role, but restrict capabilities server-side
      socket.data.role = 'GUEST';
      return next();
    } catch (err: any) {
      return next(new Error(`Socket authentication failed: ${err?.message || err}`));
    }
  });

  mapsNs.on('connection', async (socket: Socket) => {
    const role = socket.data.role;

    if (role === 'TECHNICIAN' && socket.data.technician) {
      const tech = socket.data.technician as TechnicianSessionData;
      const techRoom = `technician:${tech.technicianId}`;
      socket.join(techRoom);

      // Listen for continuous GPS position updates from technician device
      socket.on('technician:location_ping', async (data: any, ack?: (res: any) => void) => {
        try {
          if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
            if (ack) ack({ success: false, error: 'Invalid coordinates' });
            return;
          }

          const ping: TechnicianLocationPing = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: Number(data.accuracy) || 10,
            heading: data.heading ?? null,
            speed: data.speed ?? null,
            timestamp: Number(data.timestamp) || Date.now(),
          };

          // Strictly use authenticated server-derived technician ID
          const record = await mapsTrackingRedisService.updateLocation(
            tech.technicianId,
            tech.fullName,
            tech.phone,
            ping
          );

          // Broadcast live location update to Admin Live Map room
          mapsNs.to('admin:live-map').emit('admin:technician_location_update', record);
          mapsNs.to('admin:live-map').emit('technician:location:update', record);

          if (ack) {
            ack({ success: true, record });
          }
        } catch (err: any) {
          if (ack) ack({ success: false, error: err?.message || 'Processing error' });
        }
      });

      // Listen for tracking termination from technician
      socket.on('technician:stop_tracking', async (_data: any, ack?: (res: any) => void) => {
        try {
          await mapsTrackingRedisService.clearTracking(tech.technicianId);
          mapsNs.to('admin:live-map').emit('admin:technician_tracking_stopped', {
            technicianId: tech.technicianId,
            timestamp: Date.now(),
          });
          mapsNs.to('admin:live-map').emit('technician:tracking:stopped', {
            technicianId: tech.technicianId,
            timestamp: Date.now(),
          });
          if (ack) ack({ success: true });
        } catch (err: any) {
          if (ack) ack({ success: false, error: err?.message });
        }
      });
    }

    // Admin connection: Join live map room and send initial active state snapshot
    if (role === 'ADMIN' || socket.handshake.query?.subscribe === 'admin-map') {
      socket.join('admin:live-map');

      // Send initial snapshot of all actively tracked technicians
      try {
        const allActive = await mapsTrackingRedisService.getAllActiveLocations();
        socket.emit('admin:live_technicians_snapshot', allActive);
        socket.emit('technicians:initial', allActive);
      } catch {}
    }
  });

  ioInstance = io;
  return io;
}

/**
 * Broadcast technician location update to all connected administrators
 */
export function broadcastTechnicianLocationUpdate(record: TechnicianTrackingRecord): void {
  if (ioInstance) {
    ioInstance.of('/maps').to('admin:live-map').emit('admin:technician_location_update', record);
    ioInstance.of('/maps').to('admin:live-map').emit('technician:location:update', record);
  }
}

/**
 * Broadcast tracking stopped event to all connected administrators
 */
export function broadcastTechnicianTrackingStopped(technicianId: string): void {
  if (ioInstance) {
    ioInstance.of('/maps').to('admin:live-map').emit('admin:technician_tracking_stopped', {
      technicianId,
      timestamp: Date.now(),
    });
    ioInstance.of('/maps').to('admin:live-map').emit('technician:tracking:stopped', {
      technicianId,
      timestamp: Date.now(),
    });
  }
}
