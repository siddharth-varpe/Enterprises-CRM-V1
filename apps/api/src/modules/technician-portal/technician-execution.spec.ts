import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianExecutionService } from './technician-execution.service';
import { jobCardsRepository } from '../job-cards/job-cards.repository';
import { productRepository } from '../products/product.repository';
import { TECHNICIAN_ERROR_CODES, HTTP_STATUS } from '@crm/shared';

describe('Technician Portal Phase 5: Job Execution Service Suite', () => {
  const mockTechAId = 'tech-uuid-alpha-101';
  const mockTechBId = 'tech-uuid-beta-202';

  const mockJobAId = 'jc-uuid-alpha-001';
  const mockJobBId = 'jc-uuid-beta-002';
  const mockUnassignedJobId = 'jc-uuid-unassigned-003';

  let jobStore: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    jobStore = {
      [mockJobAId]: {
        id: mockJobAId,
        jobCardNumber: 'JC-2026-0001',
        serviceId: 'srv-001',
        technicianId: mockTechAId,
        customerId: 'cust-001',
        status: 'ASSIGNED',
        problemReported: 'Motor vibrating excessively',
        diagnosis: null,
        workPerformed: null,
        technicianNotes: null,
        customerRemarks: null,
        partsReplaced: [],
        startedAt: null,
        completedAt: null,
      },
      [mockJobBId]: {
        id: mockJobBId,
        jobCardNumber: 'JC-2026-0002',
        serviceId: 'srv-002',
        technicianId: mockTechBId,
        customerId: 'cust-002',
        status: 'ASSIGNED',
        problemReported: 'Filter replacement requested',
        diagnosis: null,
        workPerformed: null,
        technicianNotes: null,
        customerRemarks: null,
        partsReplaced: [],
        startedAt: null,
        completedAt: null,
      },
      [mockUnassignedJobId]: {
        id: mockUnassignedJobId,
        jobCardNumber: 'JC-2026-0003',
        serviceId: 'srv-003',
        technicianId: null,
        customerId: 'cust-003',
        status: 'SCHEDULED',
        problemReported: 'Unassigned service ticket',
        diagnosis: null,
        workPerformed: null,
        technicianNotes: null,
        customerRemarks: null,
        partsReplaced: [],
      },
    };

    // Mock resolveAuthorizedJobCard internal database queries or fallback to jobStore
    vi.spyOn(technicianExecutionService, 'resolveAuthorizedJobCard').mockImplementation(
      async (id: string, technicianId: string) => {
        if (!technicianId) {
          const error: any = new Error('Authentication required');
          error.statusCode = HTTP_STATUS.UNAUTHORIZED;
          error.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
          throw error;
        }

        const jc = jobStore[id];
        if (!jc) {
          const error: any = new Error('Job Card record not found');
          error.statusCode = HTTP_STATUS.NOT_FOUND;
          error.code = 'NOT_FOUND';
          throw error;
        }

        if (!jc.technicianId || jc.technicianId !== technicianId) {
          const error: any = new Error(
            'Access denied: This job card is not assigned to your technician account.'
          );
          error.statusCode = HTTP_STATUS.FORBIDDEN;
          error.code = TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED;
          throw error;
        }

        return { ...jc };
      }
    );

    // Mock jobCardsRepository actions
    vi.spyOn(jobCardsRepository, 'performWorkflowAction').mockImplementation(
      async (id: string, input: any) => {
        const jc = jobStore[id];
        if (!jc) throw new Error('Not found');

        if (input.action === 'start') {
          jc.status = 'IN_PROGRESS';
          jc.startedAt = new Date().toISOString();
        } else if (input.action === 'hold') {
          jc.status = 'ON_HOLD';
        } else if (input.action === 'resume') {
          jc.status = 'IN_PROGRESS';
        }
        return { ...jc };
      }
    );

    vi.spyOn(jobCardsRepository, 'updateWork').mockImplementation(
      async (id: string, input: any) => {
        const jc = jobStore[id];
        if (!jc) throw new Error('Not found');
        Object.assign(jc, input);
        return { ...jc };
      }
    );

    vi.spyOn(jobCardsRepository, 'completeJobCard').mockImplementation(
      async (id: string, input: any) => {
        const jc = jobStore[id];
        if (!jc) throw new Error('Not found');
        jc.status = 'COMPLETED';
        jc.completedAt = new Date().toISOString();
        Object.assign(jc, input);
        return { jobCard: { ...jc } };
      }
    );
  });

  describe('1. Security & Cross-Technician Isolation Matrix', () => {
    it('allows Technician A to mutate their own assigned job', async () => {
      const res = await technicianExecutionService.startJob(mockJobAId, mockTechAId);
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('IN_PROGRESS');
    });

    it('rejects Technician A attempting to start Technician B job with 403 Forbidden', async () => {
      await expect(
        technicianExecutionService.startJob(mockJobBId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects Technician A attempting to hold Technician B job with 403 Forbidden', async () => {
      await expect(
        technicianExecutionService.holdJob(mockJobBId, { reason: 'Spare part missing' }, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects Technician A attempting to resume Technician B job with 403 Forbidden', async () => {
      await expect(
        technicianExecutionService.resumeJob(mockJobBId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects Technician A attempting to save execution data on Technician B job', async () => {
      await expect(
        technicianExecutionService.updateExecution(
          mockJobBId,
          { diagnosis: 'Tampered diagnosis' },
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects Technician A attempting to complete Technician B job', async () => {
      await expect(
        technicianExecutionService.completeJob(
          mockJobBId,
          { workPerformed: 'Completed by unauthorized technician' },
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects mutations on unassigned jobs with 403 Forbidden', async () => {
      await expect(
        technicianExecutionService.startJob(mockUnassignedJobId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      await expect(
        technicianExecutionService.startJob(mockJobAId, '')
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
      });
    });
  });

  describe('2. State Machine & Transitions', () => {
    it('successfully starts an assigned job and records server timestamp', async () => {
      const res = await technicianExecutionService.startJob(mockJobAId, mockTechAId);
      expect(res.success).toBe(true);
      expect(res.message).toBe('Job started successfully');
      expect(res.data.status).toBe('IN_PROGRESS');
      expect(res.data.startedAt).toBeDefined();
    });

    it('puts an in-progress job on hold and appends the hold reason', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      const res = await technicianExecutionService.holdJob(
        mockJobAId,
        { reason: 'Waiting for specialized membrane' },
        mockTechAId
      );

      expect(res.success).toBe(true);
      expect(res.message).toBe('Job put on hold');
      expect(res.data.status).toBe('ON_HOLD');
      expect(jobStore[mockJobAId].technicianNotes).toContain('Waiting for specialized membrane');
    });

    it('rejects holding an assigned job that has not been started yet', async () => {
      jobStore[mockJobAId].status = 'ASSIGNED';

      await expect(
        technicianExecutionService.holdJob(mockJobAId, { reason: 'Not ready' }, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION,
      });
    });

    it('resumes an on-hold job back to IN_PROGRESS', async () => {
      jobStore[mockJobAId].status = 'ON_HOLD';

      const res = await technicianExecutionService.resumeJob(mockJobAId, mockTechAId);
      expect(res.success).toBe(true);
      expect(res.message).toBe('Job resumed successfully');
      expect(res.data.status).toBe('IN_PROGRESS');
    });

    it('rejects resuming a job that is not on hold', async () => {
      jobStore[mockJobAId].status = 'ASSIGNED';

      await expect(
        technicianExecutionService.resumeJob(mockJobAId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION,
      });
    });

    it('completes an in-progress job with valid work performed description', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      const res = await technicianExecutionService.completeJob(
        mockJobAId,
        {
          workPerformed: 'Replaced faulty sediment pre-filter and flushed membrane',
          diagnosis: 'Clogged sediment pre-filter cartridge',
          partsReplaced: [{ itemName: 'Sediment Filter 10-inch', quantity: 1, isWarrantyCovered: true }],
        },
        mockTechAId
      );

      expect(res.success).toBe(true);
      expect(res.message).toBe('Job completed successfully');
      expect(res.data.status).toBe('COMPLETED');
      expect(res.data.completedAt).toBeDefined();
    });

    it('rejects completing a job without work performed description', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      await expect(
        technicianExecutionService.completeJob(
          mockJobAId,
          { workPerformed: '   ' } as any,
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.VALIDATION_ERROR,
      });
    });

    it('rejects starting or completing a cancelled job card', async () => {
      jobStore[mockJobAId].status = 'CANCELLED';

      await expect(
        technicianExecutionService.startJob(mockJobAId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION,
      });

      await expect(
        technicianExecutionService.completeJob(
          mockJobAId,
          { workPerformed: 'Trying to finish cancelled work' },
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION,
      });
    });
  });

  describe('3. Concurrency & Duplicate Submission Idempotency', () => {
    it('START × 2: second start is idempotent and returns 200 without duplicate state transition', async () => {
      const first = await technicianExecutionService.startJob(mockJobAId, mockTechAId);
      expect(first.success).toBe(true);
      expect(first.data.status).toBe('IN_PROGRESS');

      // Second identical call
      const second = await technicianExecutionService.startJob(mockJobAId, mockTechAId);
      expect(second.success).toBe(true);
      expect(second.message).toBe('Job is already in progress');
      expect(second.data.status).toBe('IN_PROGRESS');
    });

    it('HOLD × 2: second hold is idempotent and returns 200 without error', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';
      await technicianExecutionService.holdJob(mockJobAId, { reason: 'First hold' }, mockTechAId);

      const second = await technicianExecutionService.holdJob(mockJobAId, { reason: 'Second hold' }, mockTechAId);
      expect(second.success).toBe(true);
      expect(second.message).toBe('Job is already on hold');
      expect(second.data.status).toBe('ON_HOLD');
    });

    it('RESUME × 2: second resume is idempotent and returns 200 without error', async () => {
      jobStore[mockJobAId].status = 'ON_HOLD';
      await technicianExecutionService.resumeJob(mockJobAId, mockTechAId);

      const second = await technicianExecutionService.resumeJob(mockJobAId, mockTechAId);
      expect(second.success).toBe(true);
      expect(second.message).toBe('Job is already active');
      expect(second.data.status).toBe('IN_PROGRESS');
    });

    it('COMPLETE × 2: second complete is idempotent and returns 200 without re-running transactions', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';
      const first = await technicianExecutionService.completeJob(
        mockJobAId,
        { workPerformed: 'Completed full servicing' },
        mockTechAId
      );
      expect(first.success).toBe(true);

      const second = await technicianExecutionService.completeJob(
        mockJobAId,
        { workPerformed: 'Repeated complete call' },
        mockTechAId
      );
      expect(second.success).toBe(true);
      expect(second.message).toBe('Job has already been completed');
      expect(second.data.status).toBe('COMPLETED');
    });
  });

  describe('4. Whitelist Enforcement & Business-Specific Fields', () => {
    it('updates execution fields while discarding administrative tampering', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      const updateInput: any = {
        diagnosis: 'Carbon block clogged with organic sediment',
        workPerformed: 'Flushed system and replaced cartridge',
        technicianNotes: 'Advised customer on weekly backwash',
        // Attempting to inject administrative fields:
        technicianId: mockTechBId,
        customerId: 'cust-hacked-999',
        laborCharges: 50000,
        partsCharges: 99999,
        totalCharges: 149999,
        invoiceId: 'inv-tampered',
      };

      const res = await technicianExecutionService.updateExecution(
        mockJobAId,
        updateInput,
        mockTechAId
      );

      expect(res.success).toBe(true);
      // Legitimate fields updated
      expect(jobStore[mockJobAId].diagnosis).toBe(updateInput.diagnosis);
      expect(jobStore[mockJobAId].workPerformed).toBe(updateInput.workPerformed);
      expect(jobStore[mockJobAId].technicianNotes).toBe(updateInput.technicianNotes);

      // Sensitive administrative fields remained untouched
      expect(jobStore[mockJobAId].technicianId).toBe(mockTechAId);
      expect(jobStore[mockJobAId].customerId).toBe('cust-001');
      expect(jobStore[mockJobAId].laborCharges).toBeUndefined();
      expect(jobStore[mockJobAId].totalCharges).toBeUndefined();
    });

    it('supports configurable business-specific fields generically', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      const res = await technicianExecutionService.updateExecution(
        mockJobAId,
        {
          technicianNotes: 'Routine inspection',
          businessFields: {
            rawWaterTds: 450,
            purifiedWaterTds: 28,
            membranePressureBar: 4.8,
            temperatureC: 26,
          },
        },
        mockTechAId
      );

      expect(res.success).toBe(true);
      expect(jobStore[mockJobAId].technicianNotes).toContain('[Business Fields]:');
      expect(jobStore[mockJobAId].technicianNotes).toContain('rawWaterTds: 450');
      expect(jobStore[mockJobAId].technicianNotes).toContain('membranePressureBar: 4.8');
    });

    it('rejects consumed parts with invalid quantities (<= 0)', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      await expect(
        technicianExecutionService.updateExecution(
          mockJobAId,
          {
            partsReplaced: [{ itemName: 'Sediment Filter', quantity: 0 }] as any,
          },
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: TECHNICIAN_ERROR_CODES.VALIDATION_ERROR,
      });
    });
  });

  describe('5. Inventory Catalog Picker (Sanitized)', () => {
    it('returns spare parts list with cost and profit metrics sanitized out', async () => {
      vi.spyOn(productRepository, 'findPaginated').mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            name: 'Sediment Filter 10-inch',
            sku: 'SP-SED-10',
            brand: 'Kemflo',
            model: 'KF-10',
            productType: 'SPARE_PART',
            costPrice: '120.00',
            purchaseCost: '115.00',
            profitMargin: '45%',
            stockQuantity: 42,
          },
        ],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      } as any);

      const materials = await technicianExecutionService.getAvailableMaterials('filter');
      expect(materials.length).toBe(1);
      const item = materials[0];

      expect(item.id).toBe('p1');
      expect(item.name).toBe('Sediment Filter 10-inch');
      expect(item.sku).toBe('SP-SED-10');
      expect(item.brand).toBe('Kemflo');

      // Crucial security guarantee: NO purchase cost or profit margin leaked!
      expect((item as any).costPrice).toBeUndefined();
      expect((item as any).purchaseCost).toBeUndefined();
      expect((item as any).profitMargin).toBeUndefined();
      expect((item as any).stockQuantity).toBeUndefined();
    });
  });

  describe('6. Reassignment Race Condition', () => {
    it('rejects Technician A when admin reassigns job to Technician B mid-execution', async () => {
      jobStore[mockJobAId].status = 'IN_PROGRESS';

      // Admin reassigns to Technician B in database
      jobStore[mockJobAId].technicianId = mockTechBId;

      // Technician A attempts to complete the job
      await expect(
        technicianExecutionService.completeJob(
          mockJobAId,
          { workPerformed: 'Trying to complete after reassignment' },
          mockTechAId
        )
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });

      // Technician B is now authorized to complete it
      const res = await technicianExecutionService.completeJob(
        mockJobAId,
        { workPerformed: 'Legitimately completed by Technician B' },
        mockTechBId
      );
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('COMPLETED');
    });
  });
});
