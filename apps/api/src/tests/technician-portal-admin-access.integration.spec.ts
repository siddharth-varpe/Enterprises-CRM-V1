import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, ensureDatabaseInitialized, closeDatabaseConnections } from '../database/client';
import { technicians, technicianPortalAccess, auditLogs } from '../database/schema';
import { techniciansRepository } from '../modules/technicians/technicians.repository';
import { techniciansService } from '../modules/technicians/technicians.service';
import { technicianAuthService } from '../modules/technician-portal/technician-auth.service';
import { technicianPortalRepository } from '../modules/technician-portal/technician-portal.repository';
import { getRedisClient } from '../redis/client';
import {
  TECH_REDIS_KEYS,
  TECHNICIAN_ERROR_CODES,
  TECHNICIAN_SESSION_TTL_SECONDS,
} from '@crm/shared';
import type { TechnicianSessionData } from '@crm/types';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('Technician Portal Access Control Integration Suite', () => {
  const redis = getRedisClient();

  beforeAll(async () => {
    await ensureDatabaseInitialized();
  });

  afterAll(async () => {
    await closeDatabaseConnections();
  });

  beforeEach(async () => {
    // Clean up test keys if needed
  });

  it('TEST 1 & 3: Technician with no portal access record or disabled portal access is safely denied login', async () => {
    const techId = randomUUID();
    const phone = `9811${Math.floor(100000 + Math.random() * 900000)}`;
    const fullName = 'Rohan Deshmukh';
    const email = `rohan.${Date.now()}@srenterprises.com`;

    // 1. Create technician directly in DB without a portal access record
    await db.insert(technicians).values({
      id: techId,
      fullName,
      phone,
      email,
      status: 'ACTIVE',
      skills: ['RO Installation'],
    });

    // 2. Verify repository returns default portalEnabled: false
    const fetched = await techniciansRepository.findById(techId);
    expect(fetched).toBeDefined();
    expect(fetched?.portalEnabled).toBe(false);

    // 3. Attempt to request OTP -> must be denied with 403 PORTAL_ACCESS_DISABLED
    await expect(
      technicianAuthService.requestOtp({
        phone,
        fullName,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
      message: 'Technician Portal access has not been activated for your account.',
    });
  });

  it('TEST 4 & 1: Admin enables portal access -> technician can immediately request OTP', async () => {
    const techId = randomUUID();
    const phone = `9822${Math.floor(100000 + Math.random() * 900000)}`;
    const fullName = 'Kishore Patil';
    const email = `kishore.${Date.now()}@srenterprises.com`;

    await db.insert(technicians).values({
      id: techId,
      fullName,
      phone,
      email,
      status: 'ACTIVE',
      skills: ['Filter Replacement'],
    });

    // Admin enables portal access
    const result = await techniciansService.togglePortalAccess(techId, true, 'admin-user-01');
    expect(result).toBeDefined();
    expect(result.portalEnabled).toBe(true);

    // Verify DB state
    const fetched = await techniciansRepository.findById(techId);
    expect(fetched?.portalEnabled).toBe(true);

    // Verify login request succeeds and generates OTP challenge
    const otpRes = await technicianAuthService.requestOtp({
      phone,
      fullName,
    });

    expect(otpRes.success).toBe(true);
    expect(otpRes.data?.challengeId).toBeDefined();
    expect(otpRes.data?.maskedEmail).toBeDefined();
  });

  it('TEST 5 & 9: Admin disables portal access -> new login denied & existing active sessions immediately revoked', async () => {
    const techId = randomUUID();
    const phone = `9833${Math.floor(100000 + Math.random() * 900000)}`;
    const fullName = 'Suresh Shinde';
    const email = `suresh.${Date.now()}@srenterprises.com`;

    await db.insert(technicians).values({
      id: techId,
      fullName,
      phone,
      email,
      status: 'ACTIVE',
      skills: ['Commercial RO'],
    });

    // 1. Enable portal access
    await techniciansService.togglePortalAccess(techId, true, 'admin-user-01');

    // 2. Simulate active session in Redis
    const sessionId = randomUUID();
    const sessionKey = `${TECH_REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    const userSessionsKey = `${TECH_REDIS_KEYS.USER_SESSIONS_PREFIX}${techId}`;

    const sessionData: TechnicianSessionData = {
      sessionId,
      technicianId: techId,
      fullName,
      phone,
      email,
      role: 'Technician',
      portalEnabled: true,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await redis.set(sessionKey, JSON.stringify(sessionData), 'EX', TECHNICIAN_SESSION_TTL_SECONDS);
    await redis.sadd(userSessionsKey, sessionId);

    // Verify session exists
    const preCheck = await redis.get(sessionKey);
    expect(preCheck).not.toBeNull();

    // 3. Admin disables portal access
    const toggleRes = await techniciansService.togglePortalAccess(techId, false, 'admin-user-01');
    expect(toggleRes.portalEnabled).toBe(false);

    // 4. Verify session key was immediately purged from Redis
    const postCheck = await redis.get(sessionKey);
    expect(postCheck).toBeNull();

    const postSessions = await redis.smembers(userSessionsKey);
    expect(postSessions.length).toBe(0);

    // 5. Subsequent OTP request denied
    await expect(
      technicianAuthService.requestOtp({
        phone,
        fullName,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
    });
  });

  it('TEST 10: Cross-Technician Isolation — Technician A enabled and Technician B disabled are completely independent', async () => {
    const techIdA = randomUUID();
    const phoneA = `9844${Math.floor(100000 + Math.random() * 900000)}`;
    const nameA = 'Mahesh Joshi';
    const emailA = `mahesh.${Date.now()}@srenterprises.com`;

    const techIdB = randomUUID();
    const phoneB = `9855${Math.floor(100000 + Math.random() * 900000)}`;
    const nameB = 'Ganesh Kadam';
    const emailB = `ganesh.${Date.now()}@srenterprises.com`;

    await db.insert(technicians).values([
      {
        id: techIdA,
        fullName: nameA,
        phone: phoneA,
        email: emailA,
        status: 'ACTIVE',
        skills: ['RO Installation'],
      },
      {
        id: techIdB,
        fullName: nameB,
        phone: phoneB,
        email: emailB,
        status: 'ACTIVE',
        skills: ['General Service'],
      },
    ]);

    // Admin enables A, disables B
    await techniciansService.togglePortalAccess(techIdA, true, 'admin-user-01');
    await techniciansService.togglePortalAccess(techIdB, false, 'admin-user-01');

    // A can log in
    const reqA = await technicianAuthService.requestOtp({
      phone: phoneA,
      fullName: nameA,
    });
    expect(reqA.success).toBe(true);

    // B cannot log in
    await expect(
      technicianAuthService.requestOtp({
        phone: phoneB,
        fullName: nameB,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
    });

    // Invert: Disable A, Enable B
    await techniciansService.togglePortalAccess(techIdA, false, 'admin-user-01');
    await techniciansService.togglePortalAccess(techIdB, true, 'admin-user-01');

    // A cannot log in
    await expect(
      technicianAuthService.requestOtp({
        phone: phoneA,
        fullName: nameA,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
    });

    // B can log in
    const reqB = await technicianAuthService.requestOtp({
      phone: phoneB,
      fullName: nameB,
    });
    expect(reqB.success).toBe(true);
  });

  it('TEST 8: Technicians list pagination includes portalEnabled flag without affecting existing CRM workforce fields', async () => {
    const listRes = await techniciansService.getTechnicians({
      page: 1,
      limit: 10,
    });

    expect(listRes).toBeDefined();
    expect(listRes.data).toBeDefined();
    expect(Array.isArray(listRes.data)).toBe(true);

    for (const tech of listRes.data) {
      expect(typeof tech.portalEnabled).toBe('boolean');
      expect(tech.fullName).toBeDefined();
      expect(tech.phone).toBeDefined();
      expect(tech.status).toBeDefined();
      expect(typeof tech.activeJobsCount).toBe('number');
      expect(typeof tech.completedJobsCount).toBe('number');
    }
  });
});
