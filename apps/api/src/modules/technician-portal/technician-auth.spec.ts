import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianAuthService } from './technician-auth.service';
import { technicianPortalRepository } from './technician-portal.repository';
import { getRedisClient } from '../../redis/client';
import {
  TECH_REDIS_KEYS,
  TECHNICIAN_ERROR_CODES,
  TECHNICIAN_OTP_CONFIG,
} from '@crm/shared';

// Mock repository methods for controlled unit testing
vi.spyOn(technicianPortalRepository, 'findByPhoneAndName');
vi.spyOn(technicianPortalRepository, 'getPortalAccessStatus');

describe('Technician Portal Phase 2: Authentication & OTP Concurrency Suite', () => {
  const redis = getRedisClient();

  const mockTechnicianA = {
    id: 'tech-uuid-001',
    fullName: 'Rahul Patil',
    phone: '9876543210',
    email: 'rahul.patil@srenterprises.com',
    status: 'ACTIVE' as const,
    skills: ['Maintenance'],
    address: 'MIDC Pune',
    emergencyContact: '9876500000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTechnicianB = {
    id: 'tech-uuid-002',
    fullName: 'Amit Shinde',
    phone: '9876543211',
    email: 'amit.shinde@srenterprises.com',
    status: 'ACTIVE' as const,
    skills: ['Overhaul'],
    address: 'Bhosari Pune',
    emergencyContact: '9876500001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await redis.del(
      `${TECH_REDIS_KEYS.RATE_LIMIT_TECH_PREFIX}${mockTechnicianA.id}`,
      `${TECH_REDIS_KEYS.RATE_LIMIT_TECH_PREFIX}${mockTechnicianB.id}`,
      `${TECH_REDIS_KEYS.RATE_LIMIT_IP_PREFIX}127.0.0.1`,
      `${TECH_REDIS_KEYS.RATE_LIMIT_EMAIL_PREFIX}${mockTechnicianA.email.toLowerCase()}`,
      `${TECH_REDIS_KEYS.RATE_LIMIT_EMAIL_PREFIX}${mockTechnicianB.email.toLowerCase()}`
    );
  });

  describe('1. Identity & Portal Access Validation', () => {
    it('rejects authentication if technician is not found by phone and name', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(null);

      await expect(
        technicianAuthService.requestOtp({
          phone: '9999999999',
          fullName: 'Unknown Person',
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: TECHNICIAN_ERROR_CODES.TECHNICIAN_NOT_FOUND,
      });
    });

    it('rejects authentication if technician status is INACTIVE or ON_LEAVE', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce({
        ...mockTechnicianA,
        status: 'INACTIVE' as any,
      });

      await expect(
        technicianAuthService.requestOtp({
          phone: mockTechnicianA.phone,
          fullName: mockTechnicianA.fullName,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.FORBIDDEN,
      });
    });

    it('rejects authentication if technician has no registered email', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce({
        ...mockTechnicianA,
        email: null,
      });

      await expect(
        technicianAuthService.requestOtp({
          phone: mockTechnicianA.phone,
          fullName: mockTechnicianA.fullName,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.EMAIL_DELIVERY_FAILED,
      });
    });

    it('rejects authentication if technician portal access is disabled', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(false);

      await expect(
        technicianAuthService.requestOtp({
          phone: mockTechnicianA.phone,
          fullName: mockTechnicianA.fullName,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.PORTAL_ACCESS_DISABLED,
      });
    });

    it('successfully initiates OTP request when technician is active and portal is enabled', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);

      const result = await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });

      expect(result.success).toBe(true);
      expect(result.data.challengeId).toBeDefined();
      expect(result.data.maskedEmail).toBe('r***l@srenterprises.com');
      expect(result.data.expiresInSeconds).toBe(TECHNICIAN_OTP_CONFIG.VALIDITY_SECONDS);
    });
  });

  describe('2. Independent OTP Challenges & Hashing', () => {
    it('stores OTP as HMAC-SHA256 hash and never in plaintext', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);

      const result = await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });

      const raw = await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${result.data.challengeId}`);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw!);

      expect(stored.otpHash).toBeDefined();
      expect(stored.otpHash).toHaveLength(64); // 256-bit hex hash
      expect((stored as any).otp).toBeUndefined(); // NO PLAINTEXT
    });

    it('invalidates previous OTP challenge when same technician requests a new OTP', async () => {
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValue(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);

      // Request 1
      const req1 = await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });
      const challenge1Key = `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${req1.data.challengeId}`;
      expect(await redis.get(challenge1Key)).not.toBeNull();

      // Request 2 (Resend / new OTP for same technician)
      const req2 = await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });
      const challenge2Key = `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${req2.data.challengeId}`;

      // Challenge 1 MUST BE INVALIDATED
      expect(await redis.get(challenge1Key)).toBeNull();
      // Challenge 2 MUST BE ACTIVE
      expect(await redis.get(challenge2Key)).not.toBeNull();
    });

    it('does NOT invalidate other technicians active OTP challenges when one technician requests a new OTP', async () => {
      // Tech A requests OTP
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);
      const reqA1 = await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });

      // Tech B requests OTP
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianB);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);
      const reqB1 = await technicianAuthService.requestOtp({
        phone: mockTechnicianB.phone,
        fullName: mockTechnicianB.fullName,
      });

      // Tech A requests another OTP (A2)
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce(mockTechnicianA);
      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);
      await technicianAuthService.requestOtp({
        phone: mockTechnicianA.phone,
        fullName: mockTechnicianA.fullName,
      });

      // Tech A1 is invalidated
      expect(await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${reqA1.data.challengeId}`)).toBeNull();
      // Tech B1 REMAINS VALID!
      expect(await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${reqB1.data.challengeId}`)).not.toBeNull();
    });
  });

  describe('3. Verification, Single-Use & Attempt Limits', () => {
    it('verifies correct OTP, destroys challenge atomically (single-use), and creates session', async () => {
      const challengeId = 'test-challenge-success-1';
      const plainOtp = '482910';
      const otpHash = technicianAuthService.hashOtp(challengeId, plainOtp);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`,
        JSON.stringify({
          challengeId,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);

      const verificationResult = await technicianAuthService.verifyOtp({
        challengeId,
        otp: plainOtp,
      });

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.data.sessionToken).toBeDefined();
      expect(verificationResult.data.technician.technicianId).toBe(mockTechnicianA.id);

      // Challenge MUST BE DELETED (single-use)
      const challengeAfter = await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`);
      expect(challengeAfter).toBeNull();

      // Session MUST EXIST in Redis
      const sessionKey = `${TECH_REDIS_KEYS.SESSION_PREFIX}${verificationResult.data.sessionToken}`;
      const sessionData = await redis.get(sessionKey);
      expect(sessionData).not.toBeNull();
      expect(JSON.parse(sessionData!).role).toBe('Technician');
    });

    it('rejects reused OTP submission (cannot verify same challenge twice)', async () => {
      const challengeId = 'test-challenge-reused';
      const plainOtp = '112233';
      const otpHash = technicianAuthService.hashOtp(challengeId, plainOtp);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`,
        JSON.stringify({
          challengeId,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);

      // First verification succeeds
      await technicianAuthService.verifyOtp({ challengeId, otp: plainOtp });

      // Second verification MUST FAIL
      await expect(
        technicianAuthService.verifyOtp({ challengeId, otp: plainOtp })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_EXPIRED,
      });
    });

    it('tracks failed attempts and invalidates challenge on 3rd failure (Brute-Force Guard)', async () => {
      const challengeId = 'test-challenge-bruteforce';
      const realOtp = '777888';
      const otpHash = technicianAuthService.hashOtp(challengeId, realOtp);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`,
        JSON.stringify({
          challengeId,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      // Attempt 1: Wrong OTP
      await expect(
        technicianAuthService.verifyOtp({ challengeId, otp: '000001' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_INVALID,
      });

      // Attempt 2: Wrong OTP
      await expect(
        technicianAuthService.verifyOtp({ challengeId, otp: '000002' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_INVALID,
      });

      // Attempt 3: Wrong OTP (Exhausts limit)
      await expect(
        technicianAuthService.verifyOtp({ challengeId, otp: '000003' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_MAX_ATTEMPTS,
      });

      // Challenge is now destroyed
      expect(await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`)).toBeNull();

      // Attempt 4 even with CORRECT OTP must now fail
      await expect(
        technicianAuthService.verifyOtp({ challengeId, otp: realOtp })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_EXPIRED,
      });
    });
  });

  describe('4. Rate Limiting Isolation', () => {
    it('enforces per-technician rate limits without blocking other technicians', async () => {
      const techAId = 'rate-limited-tech-A';
      const techBId = 'unaffected-tech-B';

      const techKeyA = `${TECH_REDIS_KEYS.RATE_LIMIT_TECH_PREFIX}${techAId}`;
      const techKeyB = `${TECH_REDIS_KEYS.RATE_LIMIT_TECH_PREFIX}${techBId}`;

      // Simulate Tech A exceeding window limit
      await redis.set(techKeyA, '10', 'EX', 900);
      // Tech B has 0 requests
      await redis.del(techKeyB);

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);

      // Tech A is blocked
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce({
        ...mockTechnicianA,
        id: techAId,
      });

      await expect(
        technicianAuthService.requestOtp({
          phone: mockTechnicianA.phone,
          fullName: mockTechnicianA.fullName,
          ipAddress: '10.0.0.1',
        })
      ).rejects.toMatchObject({
        statusCode: 429,
        code: TECHNICIAN_ERROR_CODES.OTP_RATE_LIMITED,
      });

      // Tech B is NOT blocked!
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockResolvedValueOnce({
        ...mockTechnicianB,
        id: techBId,
      });

      const resB = await technicianAuthService.requestOtp({
        phone: mockTechnicianB.phone,
        fullName: mockTechnicianB.fullName,
        ipAddress: '10.0.0.2',
      });

      expect(resB.success).toBe(true);
      expect(resB.data.challengeId).toBeDefined();
    });
  });

  describe('5. Concurrency Validation (5 & 20+ Technicians)', () => {
    it('simultaneous OTP requests across 5 technicians produce independent challenges and zero cross-contamination', async () => {
      const technicians = [1, 2, 3, 4, 5].map((i) => ({
        id: `tech-concurrent-${i}`,
        fullName: `Technician Number ${i}`,
        phone: `987000000${i}`,
        email: `tech${i}@srenterprises.com`,
        status: 'ACTIVE' as const,
        skills: ['Field Ops'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);
      technicians.forEach((t) => {
        vi.mocked(technicianPortalRepository.findByPhoneAndName).mockImplementation(async (phone) => {
          return technicians.find((tech) => tech.phone === phone) as any;
        });
      });

      // Fire 5 simultaneous OTP requests
      const results = await Promise.all(
        technicians.map((t, idx) =>
          technicianAuthService.requestOtp({
            phone: t.phone,
            fullName: t.fullName,
            ipAddress: `192.168.1.${idx + 10}`,
          })
        )
      );

      // Verify all 5 succeeded
      expect(results).toHaveLength(5);
      const challengeIds = results.map((r) => r.data.challengeId);

      // Verify all challenge IDs are strictly distinct (no shared challenge)
      const uniqueChallengeIds = new Set(challengeIds);
      expect(uniqueChallengeIds.size).toBe(5);

      // Verify each challenge belongs to the correct technician in Redis
      for (let i = 0; i < 5; i++) {
        const raw = await redis.get(`${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeIds[i]}`);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.technicianId).toBe(technicians[i].id);
        expect(parsed.email).toBe(technicians[i].email);
      }
    });

    it('concurrency scale test: 25 simultaneous technician OTP dispatches succeed independently', async () => {
      const technicians = Array.from({ length: 25 }, (_, i) => ({
        id: `tech-scale-${i + 1}`,
        fullName: `Scale Tech ${i + 1}`,
        phone: `99900000${i < 10 ? '0' + i : i}`,
        email: `scale.tech${i + 1}@srenterprises.com`,
        status: 'ACTIVE' as const,
        skills: ['Diagnostics'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);
      vi.mocked(technicianPortalRepository.findByPhoneAndName).mockImplementation(async (phone) => {
        return technicians.find((t) => t.phone === phone) as any;
      });

      const responses = await Promise.all(
        technicians.map((t, idx) =>
          technicianAuthService.requestOtp({
            phone: t.phone,
            fullName: t.fullName,
            ipAddress: `172.16.0.${idx + 1}`,
          })
        )
      );

      expect(responses).toHaveLength(25);
      const challengeSet = new Set(responses.map((r) => r.data.challengeId));
      expect(challengeSet.size).toBe(25);
    });

    it('cross-technician authorization isolation: Technician A OTP CANNOT authenticate Technician B', async () => {
      const challengeA = 'challenge-tech-A';
      const otpA = '123456';
      const otpAHash = technicianAuthService.hashOtp(challengeA, otpA);

      const challengeB = 'challenge-tech-B';
      const otpB = '654321';
      const otpBHash = technicianAuthService.hashOtp(challengeB, otpB);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeA}`,
        JSON.stringify({
          challengeId: challengeA,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash: otpAHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeB}`,
        JSON.stringify({
          challengeId: challengeB,
          technicianId: mockTechnicianB.id,
          technicianName: mockTechnicianB.fullName,
          phone: mockTechnicianB.phone,
          email: mockTechnicianB.email,
          otpHash: otpBHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);

      // Attacker tries to use OTP A on Challenge B
      await expect(
        technicianAuthService.verifyOtp({
          challengeId: challengeB,
          otp: otpA, // WRONG OTP FOR CHALLENGE B
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: TECHNICIAN_ERROR_CODES.OTP_INVALID,
      });
    });

    it('race condition protection: simultaneous verify requests for the exact same challenge allow at most ONE success', async () => {
      const challengeId = 'race-condition-challenge';
      const validOtp = '556677';
      const otpHash = technicianAuthService.hashOtp(challengeId, validOtp);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`,
        JSON.stringify({
          challengeId,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValue(true);

      // Fire 3 simultaneous verification requests for the EXACT SAME challenge
      const [res1, res2, res3] = await Promise.allSettled([
        technicianAuthService.verifyOtp({ challengeId, otp: validOtp }),
        technicianAuthService.verifyOtp({ challengeId, otp: validOtp }),
        technicianAuthService.verifyOtp({ challengeId, otp: validOtp }),
      ]);

      const fulfilled = [res1, res2, res3].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2, res3].filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed
      expect(fulfilled).toHaveLength(1);
      // Remaining requests MUST BE REJECTED
      expect(rejected).toHaveLength(2);
    });
  });

  describe('6. Session Lifecycle & Logout', () => {
    it('creates isolated session and invalidates on logout', async () => {
      const challengeId = 'test-challenge-session-lifecycle';
      const validOtp = '998877';
      const otpHash = technicianAuthService.hashOtp(challengeId, validOtp);

      await redis.set(
        `${TECH_REDIS_KEYS.OTP_CHALLENGE_PREFIX}${challengeId}`,
        JSON.stringify({
          challengeId,
          technicianId: mockTechnicianA.id,
          technicianName: mockTechnicianA.fullName,
          phone: mockTechnicianA.phone,
          email: mockTechnicianA.email,
          otpHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attemptCount: 0,
          maxAttempts: 3,
        }),
        'EX',
        300
      );

      vi.mocked(technicianPortalRepository.getPortalAccessStatus).mockResolvedValueOnce(true);

      const login = await technicianAuthService.verifyOtp({
        challengeId,
        otp: validOtp,
      });

      const sessionToken = login.data.sessionToken;

      // 1. Get Me should return authenticated state
      const meBefore = await technicianAuthService.getMe(sessionToken);
      expect(meBefore.authenticated).toBe(true);
      expect((meBefore as any).technician.fullName).toBe(mockTechnicianA.fullName);
      expect((meBefore as any).technician.role).toBe('Technician');

      // 2. Logout
      const logoutResult = await technicianAuthService.logout(sessionToken);
      expect(logoutResult.success).toBe(true);

      // 3. Get Me after logout should return unauthenticated
      const meAfter = await technicianAuthService.getMe(sessionToken);
      expect(meAfter.authenticated).toBe(false);
    });
  });
});
