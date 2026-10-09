import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { createSession } from '../security/session';
import { getRedisClient } from '../redis/client';
import { AUTH_COOKIE_NAME } from '../security/cookies';
import { mapsTrackingRedisService } from '../modules/maps/maps-tracking.redis';
import { techniciansRepository } from '../modules/technicians/technicians.repository';
import { env } from '../config/env';
import { createCaptchaChallenge } from '../security/captcha';

describe('Enterprises CRM Security Policy Hardening Verification Suite', () => {
  let app: FastifyInstance;
  const redis = getRedisClient();

  let superAdminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create authentic test sessions directly in Redis
    const superAdminSession = await createSession(redis, {
      userId: 'usr-sec-superadmin-01',
      username: 'sec_superadmin',
      displayName: 'Sec Super Admin',
      role: 'Super Admin',
      email: 'sec_superadmin@srenterprises.com',
    });
    superAdminCookie = `${AUTH_COOKIE_NAME}=${superAdminSession.sessionId}`;

    const staffSession = await createSession(redis, {
      userId: 'usr-sec-staff-01',
      username: 'sec_staff',
      displayName: 'Sec Staff',
      role: 'Staff',
      email: 'sec_staff@srenterprises.com',
    });
    staffCookie = `${AUTH_COOKIE_NAME}=${staffSession.sessionId}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Destructive System Endpoints — Super Admin Role Enforcement', () => {
    it('rejects unauthenticated requests to purge-seeded-data with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/system/purge-seeded-data',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects Staff role from purge-seeded-data with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/system/purge-seeded-data',
        headers: {
          cookie: staffCookie,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Super Admin');
    });

    it('rejects Staff role from delete-crm-database with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/system/delete-crm-database',
        headers: {
          cookie: staffCookie,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Super Admin');
    });
  });

  describe('2. Payment Integrity — Refund/Cancellation Privilege Separation', () => {
    it('rejects Staff from cancelling payments because Staff lacks payments.refund', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/pay-sec-test-01/cancel',
        headers: {
          cookie: staffCookie,
        },
        payload: { reason: 'Unauthorized cancellation attempt' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('rejects Staff from reversing payments because Staff lacks payments.refund', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/pay-sec-test-01/reverse',
        headers: {
          cookie: staffCookie,
        },
        payload: { reason: 'Unauthorized reversal attempt' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('rejects Staff from refunding payments because Staff lacks payments.refund', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/pay-sec-test-01/refund',
        headers: {
          cookie: staffCookie,
        },
        payload: { refundAmount: 500, reason: 'Unauthorized refund attempt' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Database Backup Exfiltration Defense', () => {
    it('rejects unauthenticated backup download with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/backups/backup-2026-test/download',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects user without backups.manage from downloading database archive with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/backups/backup-2026-test/download',
        headers: {
          cookie: staffCookie,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. GPS Tracking Sanitization & Deactivation Cleanup', () => {
    it('clears live tracking in Redis when technician portal access is disabled', async () => {
      const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
      const tech = await techniciansRepository.create({
        fullName: 'Audit GPS Technician',
        phone: uniquePhone,
        portalEnabled: true,
      });
      const techId = tech.id;

      // Seed tracking in Redis
      await mapsTrackingRedisService.updateLocation(
        techId,
        'Audit GPS Technician',
        undefined,
        { lat: 18.5204, lng: 73.8567 },
        undefined,
        'ONLINE'
      );

      const beforeDeactivation = await mapsTrackingRedisService.getLocation(techId);
      expect(beforeDeactivation).not.toBeNull();
      expect(beforeDeactivation?.technicianId).toBe(techId);

      // Disable portal access via repository
      await techniciansRepository.setPortalAccess(techId, false);

      // Verify tracking is purged from Redis
      const afterDeactivation = await mapsTrackingRedisService.getLocation(techId);
      expect(afterDeactivation).toBeNull();
    });
  });

  describe('5. Production Credentials Defense', () => {
    it('strictly enforces password hash verification when NODE_ENV is production and rejects invalid passwords', async () => {
      const originalEnv = env.NODE_ENV;
      try {
        (env as any).NODE_ENV = 'production';

        const challenge = await createCaptchaChallenge(redis);
        const validAnswer = await redis.get(`crm:captcha:${challenge.challengeId}`);

        const loginRes = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            username: 'admin',
            password: 'WRONG_UNAUTHORIZED_PASSWORD',
            challengeId: challenge.challengeId,
            captchaAnswer: validAnswer || '12345',
          },
        });

        expect(loginRes.statusCode).toBe(401);
        const body = JSON.parse(loginRes.payload);
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
      } finally {
        (env as any).NODE_ENV = originalEnv;
      }
    });
  });
});
