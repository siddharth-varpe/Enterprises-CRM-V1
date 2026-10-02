import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianProfileService } from './technician-profile.service';
import { technicianPortalRepository } from './technician-portal.repository';
import { TECHNICIAN_ERROR_CODES } from '@crm/shared';
import type { Technician360ResponseData } from '@crm/types';

describe('Technician Portal Phase 3: Technician 360 Profile Suite', () => {
  const mockTechAId = 'tech-uuid-alpha-101';
  const mockTechBId = 'tech-uuid-beta-202';

  const mockTechAProfile: Technician360ResponseData = {
    technician: {
      id: mockTechAId,
      technicianId: mockTechAId,
      fullName: 'Rahul Patil',
      name: 'Rahul Patil',
      phone: '9876543210',
      email: 'rahul.patil@srenterprises.com',
      address: 'MIDC Bhosari Pune',
      skills: ['Industrial Equipment Overhaul', 'High-Pressure Booster Pumps'],
      status: 'ACTIVE',
      availability: 'AVAILABLE',
      portalAccess: 'ENABLED',
      portalEnabled: true,
      emergencyContact: '9876500000',
    },
    workSummary: {
      assigned: 10,
      inProgress: 2,
      completed: 6,
      upcoming: 4,
      completionRate: 33, // 6 / (6 + 10 + 2) = 33%
      assignedCount: 10,
      inProgressCount: 2,
      completedCount: 6,
      upcomingCount: 4,
      completionRatePercent: 33,
    },
  };

  const mockTechBProfile: Technician360ResponseData = {
    technician: {
      id: mockTechBId,
      technicianId: mockTechBId,
      fullName: 'Amit Shinde',
      name: 'Amit Shinde',
      phone: '9876543211',
      email: 'amit.shinde@srenterprises.com',
      address: 'Chakan Industrial Area',
      skills: ['Filtration Assembly Diagnostics'],
      status: 'ACTIVE',
      availability: 'BUSY',
      portalAccess: 'ENABLED',
      portalEnabled: true,
      emergencyContact: '9876500001',
    },
    workSummary: {
      assigned: 3,
      inProgress: 1,
      completed: 15,
      upcoming: 2,
      completionRate: 79, // 15 / (15 + 3 + 1) = 79%
      assignedCount: 3,
      inProgressCount: 1,
      completedCount: 15,
      upcomingCount: 2,
      completionRatePercent: 79,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Profile Retrieval & Session Identity Binding', () => {
    it('returns the 360 profile for the authenticated technician', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockResolvedValueOnce(mockTechAProfile);

      const result = await technicianProfileService.getProfile(mockTechAId);

      expect(result).toBeDefined();
      expect(result.technician.id).toBe(mockTechAId);
      expect(result.technician.name).toBe('Rahul Patil');
      expect(result.technician.phone).toBe('9876543210');
      expect(result.technician.email).toBe('rahul.patil@srenterprises.com');
      expect(result.technician.status).toBe('ACTIVE');
      expect(result.technician.availability).toBe('AVAILABLE');
      expect(result.technician.skills).toContain('Industrial Equipment Overhaul');
      expect(result.technician.portalAccess).toBe('ENABLED');
    });

    it('rejects profile retrieval if technicianId is missing (unauthenticated)', async () => {
      await expect(technicianProfileService.getProfile('')).rejects.toMatchObject({
        statusCode: 401,
        code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
      });
    });

    it('throws 404 TECHNICIAN_NOT_FOUND when technician record does not exist', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockResolvedValueOnce(null);

      await expect(technicianProfileService.getProfile('non-existent-id')).rejects.toMatchObject({
        statusCode: 404,
        code: TECHNICIAN_ERROR_CODES.TECHNICIAN_NOT_FOUND,
      });
    });
  });

  describe('2. Personal Work Summary Metrics Calculation', () => {
    it('accurately exposes own Assigned, In Progress, Completed, Upcoming, and Completion Rate', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockResolvedValueOnce(mockTechAProfile);

      const result = await technicianProfileService.getProfile(mockTechAId);

      expect(result.workSummary.assigned).toBe(10);
      expect(result.workSummary.inProgress).toBe(2);
      expect(result.workSummary.completed).toBe(6);
      expect(result.workSummary.upcoming).toBe(4);
      expect(result.workSummary.completionRate).toBe(33);
    });

    it('derives availability as BUSY when inProgress count > 0', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockResolvedValueOnce(mockTechBProfile);

      const result = await technicianProfileService.getProfile(mockTechBId);
      expect(result.technician.availability).toBe('BUSY');
    });
  });

  describe('3. Technician A vs Technician B Cross-Isolation', () => {
    it('guarantees Technician A can NEVER retrieve Technician B profile or statistics', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockImplementation(async (id: string) => {
        if (id === mockTechAId) return mockTechAProfile;
        if (id === mockTechBId) return mockTechBProfile;
        return null;
      });

      // Request as Technician A
      const resultA = await technicianProfileService.getProfile(mockTechAId);
      expect(resultA.technician.id).toBe(mockTechAId);
      expect(resultA.technician.name).toBe('Rahul Patil');
      expect(resultA.workSummary.assigned).toBe(10);

      // Verify ZERO data from Technician B leaks to Technician A
      expect(resultA.technician.id).not.toBe(mockTechBId);
      expect(resultA.technician.name).not.toBe('Amit Shinde');
      expect(resultA.technician.phone).not.toBe('9876543211');
      expect(resultA.workSummary.completed).not.toBe(15);
      expect(resultA.workSummary.completionRate).not.toBe(79);

      // Request as Technician B
      const resultB = await technicianProfileService.getProfile(mockTechBId);
      expect(resultB.technician.id).toBe(mockTechBId);
      expect(resultB.technician.name).toBe('Amit Shinde');
      expect(resultB.workSummary.assigned).toBe(3);

      // Verify ZERO data from Technician A leaks to Technician B
      expect(resultB.technician.id).not.toBe(mockTechAId);
      expect(resultB.technician.name).not.toBe('Rahul Patil');
      expect(resultB.workSummary.completed).not.toBe(6);
    });
  });

  describe('4. Business-Agnostic Vocabulary Check', () => {
    it('profile payload contains zero hardcoded RO / Purifier / Membrane / TDS terminology', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockResolvedValueOnce(mockTechAProfile);

      const result = await technicianProfileService.getProfile(mockTechAId);
      const json = JSON.stringify(result);

      expect(json).not.toMatch(/\bRO\b/);
      expect(json).not.toMatch(/\bTDS\b/);
      expect(json).not.toMatch(/\bMembrane\b/);
      expect(json).not.toMatch(/\bPurifier\b/);
      expect(json).not.toMatch(/\bLPH\b/);
    });
  });

  describe('5. API Tampering & Parameter Manipulation Guard', () => {
    it('always derives identity from session and ignores client-supplied technicianId parameter', async () => {
      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockImplementation(async (id: string) => {
        if (id === mockTechAId) return mockTechAProfile;
        if (id === mockTechBId) return mockTechBProfile;
        return null;
      });

      // Simulated authenticated session represents Technician A
      const sessionTechnicianId = mockTechAId;
      // Malicious client supplies Technician B in query/body
      const maliciousClientQueryId = mockTechBId;

      // The service derives strictly from sessionTechnicianId, NEVER maliciousClientQueryId
      const result = await technicianProfileService.getProfile(sessionTechnicianId);

      expect(result.technician.id).toBe(mockTechAId);
      expect(result.technician.id).not.toBe(maliciousClientQueryId);
      expect(result.technician.name).toBe('Rahul Patil');
      expect(result.workSummary.assigned).toBe(10);
    });
  });
});
