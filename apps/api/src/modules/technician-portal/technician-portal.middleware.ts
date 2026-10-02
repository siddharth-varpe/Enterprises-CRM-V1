import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '../../redis/client';
import {
  HTTP_STATUS,
  TECHNICIAN_AUTH_COOKIE_NAME,
  TECH_REDIS_KEYS,
  TECHNICIAN_ERROR_CODES,
  TECHNICIAN_SESSION_TTL_SECONDS,
} from '@crm/shared';
import type { TechnicianSessionData } from '@crm/types';

declare module 'fastify' {
  interface FastifyRequest {
    technician?: TechnicianSessionData;
  }
}

/**
 * Fastify PreHandler Hook for Technician Portal Authentication
 * Strictly isolates technician sessions from standard CRM user sessions.
 * Verifies active Redis session from technician-scoped HTTP-only cookie or Authorization header.
 * Rejects all unauthenticated requests with HTTP 401 Unauthorized.
 */
export async function authenticateTechnician(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. Extract session token from technician-specific cookie or Authorization header
  let sessionToken = request.cookies?.[TECHNICIAN_AUTH_COOKIE_NAME];

  if (!sessionToken && request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
      sessionToken = parts[1];
    }
  }

  // 2. Reject immediately if no session token was provided
  if (!sessionToken) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: {
        code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
        message: 'Technician authentication required. Please log in.',
      },
    });
  }

  // 3. Validate technician session in isolated Redis namespace
  try {
    const redis = getRedisClient();
    const key = `${TECH_REDIS_KEYS.SESSION_PREFIX}${sessionToken}`;
    const raw = await redis.get(key);

    if (raw) {
      const session = JSON.parse(raw) as TechnicianSessionData;

      if (session.role !== 'Technician') {
        return reply.status(HTTP_STATUS.FORBIDDEN).send({
          success: false,
          error: {
            code: TECHNICIAN_ERROR_CODES.FORBIDDEN,
            message: 'Access restricted to field technicians only.',
          },
        });
      }

      if (session.portalEnabled === false) {
        return reply.status(HTTP_STATUS.FORBIDDEN).send({
          success: false,
          error: {
            code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
            message: 'Your portal access has been disabled by administration.',
          },
        });
      }

      // Sliding 24-hour activity window: refresh session lastActivityAt and Redis TTL
      session.lastActivityAt = Date.now();
      await redis.set(key, JSON.stringify(session), 'EX', TECHNICIAN_SESSION_TTL_SECONDS);

      // Attach strictly typed technician session to request
      request.technician = session;
      return;
    }
  } catch (error) {
    request.log.error({ error }, 'Technician session validation error in Redis');
  }

  // 4. Session invalid, revoked, or expired -> Reject with 401
  return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
    success: false,
    error: {
      code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
      message: 'Technician session has expired. Please log in again.',
    },
  });
}

/**
 * Authorization Guard: Verifies that the requested resource belongs strictly
 * to the authenticated technician. Enforces server-side data isolation.
 */
export function requireSelfTechnician(
  targetTechnicianIdGetter: (req: FastifyRequest) => string | undefined
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.technician) {
      await authenticateTechnician(request, reply);
      if (!request.technician) return;
    }

    const targetId = targetTechnicianIdGetter(request);
    if (!targetId || targetId !== request.technician.technicianId) {
      return reply.status(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        error: {
          code: TECHNICIAN_ERROR_CODES.FORBIDDEN,
          message: 'Access denied. You can only view and modify your own assigned work.',
        },
      });
    }
  };
}
