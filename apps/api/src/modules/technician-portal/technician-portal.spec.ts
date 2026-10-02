import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TECHNICIAN_PORTAL_ROUTE_PREFIX,
  TECHNICIAN_AUTH_API_PREFIX,
  TECHNICIAN_PORTAL_API_PREFIX,
  TECHNICIAN_AUTH_COOKIE_NAME,
  TECH_REDIS_KEYS,
  TECH_QUEUE_NAMES,
  TECHNICIAN_ERROR_CODES,
  TECHNICIAN_OTP_CONFIG,
} from '@crm/shared';
import {
  authenticateTechnician,
  requireSelfTechnician,
} from './technician-portal.middleware';
import { getRedisClient } from '../../redis/client';

describe('Technician Portal Phase 0 — Architectural Isolation & Namespace Verification', () => {
  it('ensures dedicated, non-overlapping route and API namespaces', () => {
    expect(TECHNICIAN_PORTAL_ROUTE_PREFIX).toBe('/technician');
    expect(TECHNICIAN_AUTH_API_PREFIX).toBe('/technician-auth');
    expect(TECHNICIAN_PORTAL_API_PREFIX).toBe('/technician');
    expect(TECHNICIAN_AUTH_COOKIE_NAME).toBe('sr_tech_sid');
  });

  it('ensures isolated Redis key prefixes for OTP and technician sessions', () => {
    expect(TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX).toBe('crm:tech_otp:');
    expect(TECH_REDIS_KEYS.ACTIVE_CHALLENGE_PREFIX).toBe('crm:tech_active_otp:');
    expect(TECH_REDIS_KEYS.RATE_LIMIT_TECH_PREFIX).toBe('crm:tech_rl:tech:');
    expect(TECH_REDIS_KEYS.RATE_LIMIT_IP_PREFIX).toBe('crm:tech_rl:ip:');
    expect(TECH_REDIS_KEYS.SESSION_PREFIX).toBe('crm:tech_session:');
    expect(TECH_REDIS_KEYS.USER_SESSIONS_PREFIX).toBe('crm:tech_user_sessions:');
  });

  it('ensures independent Queue names for asynchronous worker processing', () => {
    expect(TECH_QUEUE_NAMES.EMAIL_OTP).toBe('crm:queue:tech-email-otp');
    expect(TECH_QUEUE_NAMES.ASSIGNMENT_NOTIFICATION).toBe('crm:queue:tech-assignment-notification');
  });

  it('ensures OTP configuration conforms to specification rules', () => {
    expect(TECHNICIAN_OTP_CONFIG.LENGTH).toBe(6);
    expect(TECHNICIAN_OTP_CONFIG.VALIDITY_SECONDS).toBe(300); // 5 minutes
    expect(TECHNICIAN_OTP_CONFIG.MAX_ATTEMPTS).toBe(3);
    expect(TECHNICIAN_OTP_CONFIG.RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it('verifies all mandatory technician error codes are defined', () => {
    expect(TECHNICIAN_ERROR_CODES.TECHNICIAN_NOT_FOUND).toBe('TECHNICIAN_NOT_FOUND');
    expect(TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED).toBe('PORTAL_ACCESS_DISABLED');
    expect(TECHNICIAN_ERROR_CODES.OTP_RATE_LIMITED).toBe('OTP_RATE_LIMITED');
    expect(TECHNICIAN_ERROR_CODES.OTP_EXPIRED).toBe('OTP_EXPIRED');
    expect(TECHNICIAN_ERROR_CODES.OTP_INVALID).toBe('OTP_INVALID');
    expect(TECHNICIAN_ERROR_CODES.OTP_MAX_ATTEMPTS).toBe('OTP_MAX_ATTEMPTS');
    expect(TECHNICIAN_ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
    expect(TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED).toBe('SERVICE_NOT_ASSIGNED');
    expect(TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED).toBe('JOB_CARD_NOT_ASSIGNED');
    expect(TECHNICIAN_ERROR_CODES.PAYMENT_NOT_ALLOWED).toBe('PAYMENT_NOT_ALLOWED');
  });

  describe('authenticateTechnician Middleware Guard', () => {
    let mockReply: any;
    let mockRequest: any;

    beforeEach(() => {
      mockReply = {
        statusCode: 200,
        status: vi.fn().mockImplementation((code) => {
          mockReply.statusCode = code;
          return mockReply;
        }),
        send: vi.fn(),
      };
      mockRequest = {
        cookies: {},
        headers: {},
        log: { error: vi.fn() },
      };
    });

    it('rejects with 401 when no session cookie or bearer token is provided', async () => {
      await authenticateTechnician(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
          }),
        })
      );
      expect(mockRequest.technician).toBeUndefined();
    });

    it('rejects with 401 when session does not exist in Redis', async () => {
      mockRequest.cookies[TECHNICIAN_AUTH_COOKIE_NAME] = 'non-existent-session-id';

      await authenticateTechnician(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
          }),
        })
      );
    });

    it('rejects with 403 when session role is not Technician', async () => {
      const redis = getRedisClient();
      const fakeSessionId = 'admin-hijack-session';
      await redis.set(
        `${TECH_REDIS_KEYS.SESSION_PREFIX}${fakeSessionId}`,
        JSON.stringify({
          sessionId: fakeSessionId,
          technicianId: 'tech-123',
          fullName: 'Fake Admin',
          role: 'Admin', // NOT Technician
          portalEnabled: true,
        }),
        'EX',
        60
      );

      mockRequest.cookies[TECHNICIAN_AUTH_COOKIE_NAME] = fakeSessionId;

      await authenticateTechnician(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: TECHNICIAN_ERROR_CODES.FORBIDDEN,
          }),
        })
      );
    });

    it('rejects with 403 when portal access is disabled', async () => {
      const redis = getRedisClient();
      const disabledSessionId = 'disabled-tech-session';
      await redis.set(
        `${TECH_REDIS_KEYS.SESSION_PREFIX}${disabledSessionId}`,
        JSON.stringify({
          sessionId: disabledSessionId,
          technicianId: 'tech-456',
          fullName: 'Disabled Tech',
          role: 'Technician',
          portalEnabled: false, // Disabled by Admin
        }),
        'EX',
        60
      );

      mockRequest.cookies[TECHNICIAN_AUTH_COOKIE_NAME] = disabledSessionId;

      await authenticateTechnician(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
          }),
        })
      );
    });

    it('authenticates valid technician session and sets request.technician', async () => {
      const redis = getRedisClient();
      const validSessionId = 'valid-tech-session-id';
      const sessionPayload = {
        sessionId: validSessionId,
        technicianId: 'tech-789',
        fullName: 'Rahul Patil',
        phone: '+91 98765 43210',
        role: 'Technician' as const,
        portalEnabled: true,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      await redis.set(
        `${TECH_REDIS_KEYS.SESSION_PREFIX}${validSessionId}`,
        JSON.stringify(sessionPayload),
        'EX',
        60
      );

      mockRequest.cookies[TECHNICIAN_AUTH_COOKIE_NAME] = validSessionId;

      await authenticateTechnician(mockRequest, mockReply);

      expect(mockReply.status).not.toHaveBeenCalledWith(401);
      expect(mockReply.status).not.toHaveBeenCalledWith(403);
      expect(mockRequest.technician).toBeDefined();
      expect(mockRequest.technician?.technicianId).toBe('tech-789');
      expect(mockRequest.technician?.fullName).toBe('Rahul Patil');
    });
  });

  describe('requireSelfTechnician Scoping Guard', () => {
    it('prevents cross-technician access (Technician A accessing Technician B)', async () => {
      const guard = requireSelfTechnician((req) => (req as any).params?.id);

      const mockRequest: any = {
        technician: {
          technicianId: 'tech-A',
          fullName: 'Technician A',
          role: 'Technician',
          portalEnabled: true,
        },
        params: { id: 'tech-B' }, // Target belongs to Technician B
      };

      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await guard(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: TECHNICIAN_ERROR_CODES.FORBIDDEN,
          }),
        })
      );
    });

    it('allows access when target resource matches authenticated technician', async () => {
      const guard = requireSelfTechnician((req) => (req as any).params?.id);

      const mockRequest: any = {
        technician: {
          technicianId: 'tech-A',
          fullName: 'Technician A',
          role: 'Technician',
          portalEnabled: true,
        },
        params: { id: 'tech-A' }, // Target matches self
      };

      const mockReply: any = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await guard(mockRequest, mockReply);

      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });
});
