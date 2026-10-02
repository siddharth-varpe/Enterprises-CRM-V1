import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianBillingService } from './technician-billing.service';
import { technicianExecutionService } from './technician-execution.service';
import { invoicesRepository, memoryInvoices } from '../invoices/invoices.repository';
import { TECHNICIAN_ERROR_CODES, HTTP_STATUS } from '@crm/shared';

describe('Technician Portal Phase 6: Billing Visibility Service Suite', () => {
  const mockTechAId = 'tech-uuid-alpha-101';
  const mockTechBId = 'tech-uuid-beta-202';

  const mockJobAId = 'jc-uuid-alpha-001';
  const mockJobBId = 'jc-uuid-beta-002';
  const mockUnassignedJobId = 'jc-uuid-unassigned-003';
  const mockJobNoInvoiceId = 'jc-uuid-no-inv-004';

  const mockInvoiceAId = 'inv-uuid-alpha-001';
  const mockInvoiceBId = 'inv-uuid-beta-002';

  let jobStore: Record<string, any>;
  let invoiceStore: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    jobStore = {
      [mockJobAId]: {
        id: mockJobAId,
        jobCardNumber: 'JC-2026-0001',
        serviceId: 'srv-001',
        technicianId: mockTechAId,
        status: 'IN_PROGRESS',
      },
      [mockJobBId]: {
        id: mockJobBId,
        jobCardNumber: 'JC-2026-0002',
        serviceId: 'srv-002',
        technicianId: mockTechBId,
        status: 'IN_PROGRESS',
      },
      [mockUnassignedJobId]: {
        id: mockUnassignedJobId,
        jobCardNumber: 'JC-2026-0003',
        serviceId: 'srv-003',
        technicianId: null,
        status: 'SCHEDULED',
      },
      [mockJobNoInvoiceId]: {
        id: mockJobNoInvoiceId,
        jobCardNumber: 'JC-2026-0004',
        serviceId: 'srv-004',
        technicianId: mockTechAId,
        status: 'COMPLETED',
      },
    };

    invoiceStore = {
      [mockInvoiceAId]: {
        id: mockInvoiceAId,
        invoiceNumber: 'INV-2026-0001',
        jobCardId: mockJobAId,
        serviceId: 'srv-001',
        totalAmount: '2500.00',
        paidAmount: '1000.00',
        outstandingAmount: '1500.00',
        status: 'PARTIALLY_PAID',
        dueDate: '2026-10-15T00:00:00.000Z',
        invoiceDate: '2026-09-30T00:00:00.000Z',
      },
      [mockInvoiceBId]: {
        id: mockInvoiceBId,
        invoiceNumber: 'INV-2026-0002',
        jobCardId: mockJobBId,
        serviceId: 'srv-002',
        totalAmount: '4200.00',
        paidAmount: '4200.00',
        outstandingAmount: '0.00',
        status: 'PAID',
        dueDate: '2026-10-20T00:00:00.000Z',
        invoiceDate: '2026-09-29T00:00:00.000Z',
      },
    };

    // Populate memoryInvoices for lookup fallback
    memoryInvoices.length = 0;
    memoryInvoices.push(invoiceStore[mockInvoiceAId], invoiceStore[mockInvoiceBId]);

    // Mock resolveAuthorizedJobCard to reflect test scenario
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

    // Mock authoritative invoicesRepository.findById
    vi.spyOn(invoicesRepository, 'findById').mockImplementation(
      async (targetId: string) => {
        const inv = invoiceStore[targetId];
        return inv ? { ...inv } : null;
      }
    );
  });

  describe('1. Authorized Billing Visibility', () => {
    it('returns exact authoritative billing summary for Technician A assigned job', async () => {
      const res = await technicianBillingService.getPaymentSummary(mockJobAId, mockTechAId);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.invoiceNumber).toBe('INV-2026-0001');
      expect(res.data?.totalAmount).toBe(2500);
      expect(res.data?.paidAmount).toBe(1000);
      expect(res.data?.outstandingAmount).toBe(1500);
      expect(res.data?.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('returns exact authoritative billing summary for Technician B assigned job', async () => {
      const res = await technicianBillingService.getPaymentSummary(mockJobBId, mockTechBId);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.invoiceNumber).toBe('INV-2026-0002');
      expect(res.data?.totalAmount).toBe(4200);
      expect(res.data?.paidAmount).toBe(4200);
      expect(res.data?.outstandingAmount).toBe(0);
      expect(res.data?.paymentStatus).toBe('PAID');
    });
  });

  describe('2. Cross-Technician & IDOR Security Matrix', () => {
    it('rejects Technician A attempting to view Technician B billing data with 403 Forbidden', async () => {
      await expect(
        technicianBillingService.getPaymentSummary(mockJobBId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects Technician B attempting to view Technician A billing data with 403 Forbidden', async () => {
      await expect(
        technicianBillingService.getPaymentSummary(mockJobAId, mockTechBId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects access to unassigned job billing with 403 Forbidden', async () => {
      await expect(
        technicianBillingService.getPaymentSummary(mockUnassignedJobId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      await expect(
        technicianBillingService.getPaymentSummary(mockJobAId, '')
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
      });
    });

    it('rejects non-existent job ID with 404 Not Found', async () => {
      await expect(
        technicianBillingService.getPaymentSummary('non-existent-id', mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('3. Financial Consistency & Zero Duplicate Calculations', () => {
    it('mirrors CRM invoice total, paid, and outstanding without floating point drift', async () => {
      // Create a test invoice with complex decimal amounts on an isolated job
      const complexJobId = 'jc-uuid-complex-001';
      jobStore[complexJobId] = {
        id: complexJobId,
        jobCardNumber: 'JC-2026-9999',
        serviceId: 'srv-999',
        technicianId: mockTechAId,
        status: 'IN_PROGRESS',
      };

      const complexInvId = 'inv-complex-001';
      invoiceStore[complexInvId] = {
        id: complexInvId,
        invoiceNumber: 'INV-2026-9999',
        jobCardId: complexJobId,
        serviceId: 'srv-999',
        totalAmount: '1475.50',
        paidAmount: '475.50',
        outstandingAmount: '1000.00',
        status: 'PARTIALLY_PAID',
      };
      memoryInvoices.push(invoiceStore[complexInvId]);

      const billing = await technicianBillingService.getBillingSummary(complexJobId, mockTechAId);

      expect(billing).not.toBeNull();
      expect(billing?.totalAmount).toBe(1475.5);
      expect(billing?.paidAmount).toBe(475.5);
      expect(billing?.outstandingAmount).toBe(1000.0);
      expect(billing?.paymentStatus).toBe('PARTIALLY_PAID');
    });

    it('handles unpaid (ISSUED) invoice accurately', async () => {
      invoiceStore[mockInvoiceAId].paidAmount = '0.00';
      invoiceStore[mockInvoiceAId].outstandingAmount = '2500.00';
      invoiceStore[mockInvoiceAId].status = 'ISSUED';

      const res = await technicianBillingService.getPaymentSummary(mockJobAId, mockTechAId);

      expect(res.data?.paidAmount).toBe(0);
      expect(res.data?.outstandingAmount).toBe(2500);
      expect(res.data?.paymentStatus).toBe('ISSUED');
    });
  });

  describe('4. Missing & Non-Invoiced Service Handling', () => {
    it('gracefully returns null data when no invoice exists yet (not an application error)', async () => {
      const res = await technicianBillingService.getPaymentSummary(mockJobNoInvoiceId, mockTechAId);

      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
      expect(res.message).toContain('Invoice not yet available');
    });
  });

  describe('5. Admin Reassignment Scenario', () => {
    it('immediately denies former technician and authorizes new technician upon admin reassignment', async () => {
      // Initially, Tech A is authorized for Job A
      const initialRes = await technicianBillingService.getPaymentSummary(mockJobAId, mockTechAId);
      expect(initialRes.success).toBe(true);

      // Admin reassigns Job A to Tech B in CRM database
      jobStore[mockJobAId].technicianId = mockTechBId;

      // Tech A attempts to access billing again -> 403 Forbidden
      await expect(
        technicianBillingService.getPaymentSummary(mockJobAId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED,
      });

      // Tech B now accesses billing -> 200 OK
      const reassignedRes = await technicianBillingService.getPaymentSummary(mockJobAId, mockTechBId);
      expect(reassignedRes.success).toBe(true);
      expect(reassignedRes.data?.invoiceNumber).toBe('INV-2026-0001');
    });
  });

  describe('6. Concurrent Read Isolation', () => {
    it('simultaneously serves multiple technicians without cross-contamination', async () => {
      const [resA, resB] = await Promise.all([
        technicianBillingService.getPaymentSummary(mockJobAId, mockTechAId),
        technicianBillingService.getPaymentSummary(mockJobBId, mockTechBId),
      ]);

      expect(resA.data?.invoiceNumber).toBe('INV-2026-0001');
      expect(resA.data?.totalAmount).toBe(2500);

      expect(resB.data?.invoiceNumber).toBe('INV-2026-0002');
      expect(resB.data?.totalAmount).toBe(4200);
    });
  });
});
