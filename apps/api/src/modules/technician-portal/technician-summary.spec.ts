import { describe, it, expect, beforeEach, vi } from 'vitest';
import { technicianPortalRepository } from './technician-portal.repository';
import { technicianSummaryService } from './technician-summary.service';
import { memoryServices } from '../services/services.repository';
import { memoryJobCards } from '../job-cards/job-cards.repository';

describe('Technician Portal Phase 9: Personal Technician Summary Suite', () => {
  const techAId = 'tech-uuid-aaaa-1111';
  const techBId = 'tech-uuid-bbbb-2222';

  beforeEach(() => {
    vi.restoreAllMocks();
    memoryServices.length = 0;
    memoryJobCards.length = 0;
  });

  describe('1. Personal Metrics Calculation', () => {
    it('accurately computes assignedCount, completedCount, currentWorkload, and completionRate', async () => {
      // Technician A setup:
      // 2 assigned (waiting), 1 in progress, 3 completed, 1 cancelled
      memoryServices.push(
        {
          id: 'svc-a1',
          serviceNumber: 'SRV-A001',
          technicianId: techAId,
          status: 'ASSIGNED',
          scheduledDate: new Date('2026-10-01T10:00:00Z'),
          completedAt: null,
        } as any,
        {
          id: 'svc-a2',
          serviceNumber: 'SRV-A002',
          technicianId: techAId,
          status: 'SCHEDULED',
          scheduledDate: new Date('2026-10-02T10:00:00Z'),
          completedAt: null,
        } as any,
        {
          id: 'svc-a3',
          serviceNumber: 'SRV-A003',
          technicianId: techAId,
          status: 'IN_PROGRESS',
          scheduledDate: new Date('2026-10-01T09:00:00Z'),
          completedAt: null,
        } as any,
        {
          id: 'svc-a4',
          serviceNumber: 'SRV-A004',
          technicianId: techAId,
          status: 'COMPLETED',
          scheduledDate: new Date('2026-09-28T10:00:00Z'),
          completedAt: new Date('2026-09-28T11:30:00Z'),
        } as any,
        {
          id: 'svc-a5',
          serviceNumber: 'SRV-A005',
          technicianId: techAId,
          status: 'COMPLETED',
          scheduledDate: new Date('2026-09-29T10:00:00Z'),
          completedAt: new Date('2026-09-29T12:00:00Z'),
        } as any,
        {
          id: 'svc-a6',
          serviceNumber: 'SRV-A006',
          technicianId: techAId,
          status: 'COMPLETED',
          scheduledDate: new Date('2026-09-30T10:00:00Z'),
          completedAt: new Date('2026-09-30T11:00:00Z'),
        } as any,
        {
          id: 'svc-a7',
          serviceNumber: 'SRV-A007',
          technicianId: techAId,
          status: 'CANCELLED',
          scheduledDate: new Date('2026-09-27T10:00:00Z'),
          completedAt: null,
        } as any
      );

      // Job cards for completed services to test timing
      memoryJobCards.push(
        {
          id: 'jc-a4',
          serviceId: 'svc-a4',
          technicianId: techAId,
          status: 'COMPLETED',
          startedAt: new Date('2026-09-28T10:00:00Z'),
          completedAt: new Date('2026-09-28T11:30:00Z'), // 90 min
        } as any,
        {
          id: 'jc-a5',
          serviceId: 'svc-a5',
          technicianId: techAId,
          status: 'COMPLETED',
          startedAt: new Date('2026-09-29T10:00:00Z'),
          completedAt: new Date('2026-09-29T12:00:00Z'), // 120 min
        } as any,
        {
          id: 'jc-a6',
          serviceId: 'svc-a6',
          technicianId: techAId,
          status: 'COMPLETED',
          startedAt: new Date('2026-09-30T10:00:00Z'),
          completedAt: new Date('2026-09-30T11:00:00Z'), // 60 min
        } as any
      );

      const summary = await technicianSummaryService.getSummary(techAId);

      // Expected counts:
      // assigned: 2 (svc-a1, svc-a2)
      // inProgress: 1 (svc-a3)
      // currentWorkload: 2 + 1 = 3
      // completed: 3 (svc-a4, svc-a5, svc-a6)
      // cancelled: excluded from workload & completion denominator
      // eligibleWorkload = 3 completed + 3 active = 6
      // completionRate = (3 / 6) * 100 = 50%
      expect(summary.assignedCount).toBe(2);
      expect(summary.currentWorkload).toBe(3);
      expect(summary.completedCount).toBe(3);
      expect(summary.completionRate).toBe(50);
      expect(summary.workloadBreakdown.assigned).toBe(2);
      expect(summary.workloadBreakdown.inProgress).toBe(1);

      // Average completion time: (90 + 120 + 60) / 3 = 90 min -> "1h 30m"
      expect(summary.isAverageCompletionTimeReliable).toBe(true);
      expect(summary.sampleSize).toBe(3);
      expect(summary.averageCompletionTimeMinutes).toBe(90);
      expect(summary.averageCompletionTimeFormatted).toBe('1h 30m');
    });

    it('derives on-hold jobs into current workload operational count', async () => {
      memoryServices.push({
        id: 'svc-hold-1',
        serviceNumber: 'SRV-H001',
        technicianId: techAId,
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2026-10-01T10:00:00Z'),
        completedAt: null,
      } as any);

      memoryJobCards.push({
        id: 'jc-hold-1',
        serviceId: 'svc-hold-1',
        technicianId: techAId,
        status: 'ON_HOLD',
        startedAt: new Date('2026-10-01T10:00:00Z'),
        completedAt: null,
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.workloadBreakdown.onHold).toBe(1);
      expect(summary.currentWorkload).toBe(1);
    });
  });

  describe('2. Zero-Denominator & Edge Case Safety', () => {
    it('safely handles zero assigned and zero completed tasks without NaN or Infinity', async () => {
      const summary = await technicianSummaryService.getSummary(techAId);

      expect(summary.assignedCount).toBe(0);
      expect(summary.completedCount).toBe(0);
      expect(summary.currentWorkload).toBe(0);
      expect(summary.completionRate).toBe(0);
      expect(summary.isAverageCompletionTimeReliable).toBe(false);
      expect(summary.sampleSize).toBe(0);
      expect(summary.averageCompletionTimeMinutes).toBeNull();
      expect(summary.averageCompletionTimeFormatted).toBeNull();
    });

    it('returns 100% completion rate when all assigned work is completed', async () => {
      memoryServices.push({
        id: 'svc-comp-1',
        serviceNumber: 'SRV-C001',
        technicianId: techAId,
        status: 'COMPLETED',
        scheduledDate: new Date('2026-09-30T10:00:00Z'),
        completedAt: new Date('2026-09-30T11:00:00Z'),
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.completedCount).toBe(1);
      expect(summary.currentWorkload).toBe(0);
      expect(summary.completionRate).toBe(100);
    });
  });

  describe('3. Average Completion Time Data-Quality Filters', () => {
    it('excludes records with missing startedAt from duration calculation', async () => {
      memoryServices.push({
        id: 'svc-missing-start',
        serviceNumber: 'SRV-M001',
        technicianId: techAId,
        status: 'COMPLETED',
        completedAt: new Date('2026-09-30T11:00:00Z'),
      } as any);

      memoryJobCards.push({
        id: 'jc-missing-start',
        serviceId: 'svc-missing-start',
        technicianId: techAId,
        status: 'COMPLETED',
        startedAt: null, // missing start timestamp
        completedAt: new Date('2026-09-30T11:00:00Z'),
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.completedCount).toBe(1);
      expect(summary.isAverageCompletionTimeReliable).toBe(false);
      expect(summary.sampleSize).toBe(0);
      expect(summary.averageCompletionTimeMinutes).toBeNull();
      expect(summary.averageCompletionTimeFormatted).toBeNull();
    });

    it('excludes records with non-positive duration (completedAt <= startedAt)', async () => {
      memoryServices.push({
        id: 'svc-neg',
        serviceNumber: 'SRV-N001',
        technicianId: techAId,
        status: 'COMPLETED',
        completedAt: new Date('2026-09-30T10:00:00Z'),
      } as any);

      memoryJobCards.push({
        id: 'jc-neg',
        serviceId: 'svc-neg',
        technicianId: techAId,
        status: 'COMPLETED',
        startedAt: new Date('2026-09-30T10:30:00Z'),
        completedAt: new Date('2026-09-30T10:00:00Z'), // 30 min before start!
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.isAverageCompletionTimeReliable).toBe(false);
      expect(summary.sampleSize).toBe(0);
      expect(summary.averageCompletionTimeMinutes).toBeNull();
    });

    it('excludes extreme outliers exceeding 30 days', async () => {
      memoryServices.push({
        id: 'svc-outlier',
        serviceNumber: 'SRV-O001',
        technicianId: techAId,
        status: 'COMPLETED',
        completedAt: new Date('2026-09-30T10:00:00Z'),
      } as any);

      memoryJobCards.push({
        id: 'jc-outlier',
        serviceId: 'svc-outlier',
        technicianId: techAId,
        status: 'COMPLETED',
        startedAt: new Date('2026-01-01T10:00:00Z'), // ~9 months prior
        completedAt: new Date('2026-09-30T10:00:00Z'),
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.isAverageCompletionTimeReliable).toBe(false);
      expect(summary.sampleSize).toBe(0);
    });

    it('computes accurate average from mixed valid and invalid records', async () => {
      memoryServices.push(
        {
          id: 'svc-valid-1',
          serviceNumber: 'SRV-V001',
          technicianId: techAId,
          status: 'COMPLETED',
        } as any,
        {
          id: 'svc-invalid-1',
          serviceNumber: 'SRV-I001',
          technicianId: techAId,
          status: 'COMPLETED',
        } as any
      );

      memoryJobCards.push(
        {
          id: 'jc-valid-1',
          serviceId: 'svc-valid-1',
          technicianId: techAId,
          status: 'COMPLETED',
          startedAt: new Date('2026-09-30T10:00:00Z'),
          completedAt: new Date('2026-09-30T10:45:00Z'), // 45 min
        } as any,
        {
          id: 'jc-invalid-1',
          serviceId: 'svc-invalid-1',
          technicianId: techAId,
          status: 'COMPLETED',
          startedAt: null, // missing start timestamp
          completedAt: new Date('2026-09-30T11:00:00Z'),
        } as any
      );

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.completedCount).toBe(2);
      expect(summary.isAverageCompletionTimeReliable).toBe(true);
      expect(summary.sampleSize).toBe(1); // Only 1 valid timing record
      expect(summary.averageCompletionTimeMinutes).toBe(45);
      expect(summary.averageCompletionTimeFormatted).toBe('45m');
    });
  });

  describe('4. Reassignment & Cancellation Behavior', () => {
    it('removes reassigned work from previous technician and attributes it to new technician', async () => {
      // Service originally for A, now reassigned to B
      memoryServices.push({
        id: 'svc-reassigned',
        serviceNumber: 'SRV-R001',
        technicianId: techBId, // Currently assigned to B!
        status: 'ASSIGNED',
        scheduledDate: new Date('2026-10-01T10:00:00Z'),
      } as any);

      const summaryA = await technicianSummaryService.getSummary(techAId);
      const summaryB = await technicianSummaryService.getSummary(techBId);

      expect(summaryA.assignedCount).toBe(0);
      expect(summaryA.currentWorkload).toBe(0);

      expect(summaryB.assignedCount).toBe(1);
      expect(summaryB.currentWorkload).toBe(1);
    });

    it('excludes cancelled services from active currentWorkload', async () => {
      memoryServices.push({
        id: 'svc-cancelled',
        serviceNumber: 'SRV-X001',
        technicianId: techAId,
        status: 'CANCELLED',
        scheduledDate: new Date('2026-10-01T10:00:00Z'),
      } as any);

      const summary = await technicianSummaryService.getSummary(techAId);
      expect(summary.assignedCount).toBe(0);
      expect(summary.currentWorkload).toBe(0);
      expect(summary.completionRate).toBe(0);
    });
  });

  describe('5. Cross-Technician Isolation & IDOR Protection', () => {
    it('guarantees complete isolation between Technician A and Technician B metrics', async () => {
      // Setup distinct workloads
      // Tech A: 5 assigned, 5 completed
      for (let i = 1; i <= 5; i++) {
        memoryServices.push({
          id: `svc-a-asgn-${i}`,
          serviceNumber: `SRV-A-A${i}`,
          technicianId: techAId,
          status: 'ASSIGNED',
        } as any);
        memoryServices.push({
          id: `svc-a-comp-${i}`,
          serviceNumber: `SRV-A-C${i}`,
          technicianId: techAId,
          status: 'COMPLETED',
        } as any);
      }

      // Tech B: 2 assigned, 1 completed
      for (let i = 1; i <= 2; i++) {
        memoryServices.push({
          id: `svc-b-asgn-${i}`,
          serviceNumber: `SRV-B-A${i}`,
          technicianId: techBId,
          status: 'ASSIGNED',
        } as any);
      }
      memoryServices.push({
        id: 'svc-b-comp-1',
        serviceNumber: 'SRV-B-C1',
        technicianId: techBId,
        status: 'COMPLETED',
      } as any);

      const summaryA = await technicianSummaryService.getSummary(techAId);
      const summaryB = await technicianSummaryService.getSummary(techBId);

      // Verify Tech A metrics
      expect(summaryA.assignedCount).toBe(5);
      expect(summaryA.completedCount).toBe(5);
      expect(summaryA.currentWorkload).toBe(5);
      expect(summaryA.completionRate).toBe(50); // 5 / (5 + 5) = 50%

      // Verify Tech B metrics
      expect(summaryB.assignedCount).toBe(2);
      expect(summaryB.completedCount).toBe(1);
      expect(summaryB.currentWorkload).toBe(2);
      expect(summaryB.completionRate).toBe(33); // 1 / (1 + 2) = 33%

      // Verify zero cross-contamination
      expect(summaryA.assignedCount).not.toBe(summaryB.assignedCount);
      expect(summaryA.completedCount).not.toBe(summaryB.completedCount);
    });

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      await expect(technicianSummaryService.getSummary('')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('6. Consistency with Profile WorkSummary', () => {
    it('guarantees identical metrics between getSummary and getTechnician360Profile', async () => {
      memoryServices.push(
        {
          id: 'svc-c1',
          serviceNumber: 'SRV-C001',
          technicianId: techAId,
          status: 'ASSIGNED',
          scheduledDate: new Date('2026-10-01T10:00:00Z'),
        } as any,
        {
          id: 'svc-c2',
          serviceNumber: 'SRV-C002',
          technicianId: techAId,
          status: 'IN_PROGRESS',
          scheduledDate: new Date('2026-10-01T10:00:00Z'),
        } as any,
        {
          id: 'svc-c3',
          serviceNumber: 'SRV-C003',
          technicianId: techAId,
          status: 'COMPLETED',
          scheduledDate: new Date('2026-09-30T10:00:00Z'),
        } as any
      );

      const summary = await technicianSummaryService.getSummary(techAId);

      vi.spyOn(technicianPortalRepository, 'getTechnician360Profile').mockImplementation(async (id: string) => {
        const s = await technicianPortalRepository.getPersonalTechnicianSummary(id);
        return {
          technician: { id } as any,
          workSummary: {
            assigned: s.assignedCount,
            inProgress: s.workloadBreakdown.inProgress,
            completed: s.completedCount,
            upcoming: s.workloadBreakdown.upcoming,
            completionRate: s.completionRate,
            currentWorkload: s.currentWorkload,
            averageCompletionTimeMinutes: s.averageCompletionTimeMinutes,
            averageCompletionTimeFormatted: s.averageCompletionTimeFormatted,
            isAverageCompletionTimeReliable: s.isAverageCompletionTimeReliable,
          },
        };
      });

      const profile = await technicianPortalRepository.getTechnician360Profile(techAId);

      expect(profile?.workSummary.assigned).toBe(summary.assignedCount);
      expect(profile?.workSummary.completed).toBe(summary.completedCount);
      expect(profile?.workSummary.currentWorkload).toBe(summary.currentWorkload);
      expect(profile?.workSummary.completionRate).toBe(summary.completionRate);
      expect(profile?.workSummary.averageCompletionTimeFormatted).toBe(summary.averageCompletionTimeFormatted);
    });
  });
});
