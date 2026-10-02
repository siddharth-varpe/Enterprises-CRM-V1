import { describe, it, expect, beforeEach } from 'vitest';
import { technicianPaymentService } from './technician-payment.service';
import { technicianBillingService } from './technician-billing.service';
import { memoryInvoices } from '../invoices/invoices.repository';
import { memoryPayments } from '../payments/payments.repository';
import { memoryJobCards } from '../job-cards/job-cards.repository';
import { memoryServices } from '../services/services.repository';
import type { TechnicianSessionData } from '@crm/types';

describe('Technician Portal Phase 7: Payment Collection & Receipt Suite', () => {
  const sessionTechA: TechnicianSessionData = {
    sessionId: 'sess-tech-a',
    technicianId: 'tech-uuid-1111',
    fullName: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul@example.com',
    role: 'Technician',
    portalEnabled: true,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  const sessionTechB: TechnicianSessionData = {
    sessionId: 'sess-tech-b',
    technicianId: 'tech-uuid-2222',
    fullName: 'Amit Patel',
    phone: '9876543211',
    email: 'amit@example.com',
    role: 'Technician',
    portalEnabled: true,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  beforeEach(() => {
    // Reset in-memory test stores
    memoryServices.length = 0;
    memoryJobCards.length = 0;
    memoryInvoices.length = 0;
    memoryPayments.length = 0;

    // Service A -> Tech A
    memoryServices.push({
      id: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      serviceType: 'Regular Maintenance',
      technicianId: 'tech-uuid-1111',
      customerId: 'cust-uuid-001',
      customerNotes: 'Water purifier maintenance',
      status: 'IN_PROGRESS',
    } as any);

    // Job Card A -> Tech A
    memoryJobCards.push({
      id: 'jc-uuid-001',
      jobCardNumber: 'JC-2026-001',
      serviceId: 'svc-uuid-001',
      technicianId: 'tech-uuid-1111',
      status: 'IN_PROGRESS',
    } as any);

    // Invoice A -> linked to Job Card A (Total: ₹2,000.00, Outstanding: ₹2,000.00)
    memoryInvoices.push({
      id: 'inv-uuid-001',
      invoiceNumber: 'INV-2026-0001',
      jobCardId: 'jc-uuid-001',
      serviceId: 'svc-uuid-001',
      customerId: 'cust-uuid-001',
      customerName: 'Aarav Mehta',
      customerPhone: '9876500001',
      totalAmount: '2000.00',
      paidAmount: '0.00',
      outstandingAmount: '2000.00',
      status: 'ISSUED',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      dueDate: new Date('2026-03-15T10:00:00Z'),
    } as any);

    // Service B -> Tech B
    memoryServices.push({
      id: 'svc-uuid-002',
      serviceNumber: 'SRV-2026-002',
      serviceType: 'Filter Replacement',
      technicianId: 'tech-uuid-2222',
      customerId: 'cust-uuid-002',
      status: 'COMPLETED',
    } as any);

    // Job Card B -> Tech B
    memoryJobCards.push({
      id: 'jc-uuid-002',
      jobCardNumber: 'JC-2026-002',
      serviceId: 'svc-uuid-002',
      technicianId: 'tech-uuid-2222',
      status: 'COMPLETED',
    } as any);

    // Invoice B -> linked to Job Card B (Total: ₹5,000.00, Outstanding: ₹5,000.00)
    memoryInvoices.push({
      id: 'inv-uuid-002',
      invoiceNumber: 'INV-2026-0002',
      jobCardId: 'jc-uuid-002',
      serviceId: 'svc-uuid-002',
      customerId: 'cust-uuid-002',
      customerName: 'Pooja Verma',
      customerPhone: '9876500002',
      totalAmount: '5000.00',
      paidAmount: '0.00',
      outstandingAmount: '5000.00',
      status: 'ISSUED',
      createdAt: new Date('2026-03-02T10:00:00Z'),
      dueDate: new Date('2026-03-16T10:00:00Z'),
    } as any);
  });

  describe('1. Payment Summary & Business Payment Details', () => {
    it('returns authoritative payment summary with business details for authorized job card', async () => {
      const summary = await technicianBillingService.getPaymentSummary('jc-uuid-001', 'tech-uuid-1111');
      expect(summary.success).toBe(true);
      expect(summary.data).not.toBeNull();
      expect(summary.data?.invoiceNumber).toBe('INV-2026-0001');
      expect(summary.data?.totalAmount).toBe(2000);
      expect(summary.data?.paidAmount).toBe(0);
      expect(summary.data?.outstandingAmount).toBe(2000);
      expect(summary.data?.status).toBe('ISSUED');
      expect(summary.data?.businessName).toBeDefined();
    });

    it('rejects cross-technician access to payment summary with 403 Forbidden', async () => {
      await expect(
        technicianBillingService.getPaymentSummary('jc-uuid-002', 'tech-uuid-1111')
      ).rejects.toThrow();
    });
  });

  describe('2. Authorized Payment Recording (Partial & Full Payments)', () => {
    it('records partial payment correctly and reflects updated authoritative outstanding balance', async () => {
      const result = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        {
          amount: 800,
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-REF-889911',
          notes: 'Customer paid via Google Pay',
        },
        sessionTechA
      );

      expect(result.success).toBe(true);
      expect(result.data.amount).toBe(800);
      expect(result.data.paymentMethod).toBe('UPI');
      expect(result.data.referenceNumber).toBe('UPI-REF-889911');
      expect(result.data.paymentNumber).toMatch(/^PAY-/);
      expect(result.data.remainingOutstanding).toBe(1200);
      expect(result.data.paymentStatus).toBe('PARTIALLY_PAID');

      // Verify the payment was written to the authoritative CRM payment ledger
      const ledgerEntry = memoryPayments.find((p) => p.id === result.data.paymentId);
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry.amount).toBe('800');
      expect(ledgerEntry.invoiceId).toBe('inv-uuid-001');
    });

    it('records consecutive partial payments reaching full payment state', async () => {
      // Payment 1: ₹1,000
      const p1 = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        { amount: 1000, paymentMethod: 'CASH' },
        sessionTechA
      );
      expect(p1.data.remainingOutstanding).toBe(1000);
      expect(p1.data.paymentStatus).toBe('PARTIALLY_PAID');

      // Payment 2: ₹1,000 (Remaining ₹0)
      const p2 = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        { amount: 1000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'IMPS-998877' },
        sessionTechA
      );
      expect(p2.data.remainingOutstanding).toBe(0);
      expect(p2.data.paymentStatus).toBe('PAID');

      // Subsequent payment attempt must be rejected (cannot overpay when balance is 0)
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001',
          { amount: 100, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();
    });

    it('supports all standard payment methods: CASH, UPI, BANK_TRANSFER, CHEQUE, OTHER', async () => {
      const methods: ('CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER')[] = [
        'CASH',
        'UPI',
        'BANK_TRANSFER',
        'CHEQUE',
        'OTHER',
      ];

      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        const res = await technicianPaymentService.recordPayment(
          'jc-uuid-002',
          {
            amount: 500,
            paymentMethod: method,
            referenceNumber: method !== 'CASH' ? `REF-${method}-${i}` : undefined,
          },
          sessionTechB
        );
        expect(res.success).toBe(true);
        expect(res.data.paymentMethod).toBe(method);
      }

      // 5 * 500 = 2500 paid on 5000 invoice
      const invoice = memoryInvoices.find((i) => i.id === 'inv-uuid-002');
      expect(Number(invoice.outstandingAmount)).toBe(2500);
    });
  });

  describe('3. Strict Overpayment & Amount Validation', () => {
    it('rejects payment amount exceeding current outstanding balance with 422', async () => {
      // Invoice 1 has ₹2,000 outstanding; technician attempts ₹2,001
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001',
          { amount: 2001, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();

      // Ensure no payment was added to the ledger
      expect(memoryPayments.length).toBe(0);
      const inv = memoryInvoices.find((i) => i.id === 'inv-uuid-001');
      expect(Number(inv.outstandingAmount)).toBe(2000);
    });

    it('rejects zero amount payment', async () => {
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001',
          { amount: 0, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();
    });

    it('rejects negative amount payment', async () => {
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001',
          { amount: -500, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();
    });
  });

  describe('4. Cross-Technician & IDOR Authorization Defense', () => {
    it('Technician A cannot record payment for Technician B assigned job card (403 Forbidden)', async () => {
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-002', // Belongs to Tech B
          { amount: 500, paymentMethod: 'UPI' },
          sessionTechA
        )
      ).rejects.toThrow();

      expect(memoryPayments.length).toBe(0);
    });

    it('Technician A cannot specify an unrelated invoice ID to bypass job card linkage', async () => {
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001', // Job Card belongs to Tech A
          {
            invoiceId: 'inv-uuid-002', // Invoice belongs to Job Card B!
            amount: 500,
            paymentMethod: 'CASH',
          },
          sessionTechA
        )
      ).rejects.toThrow();
    });

    it('Technician A cannot record payment on an unassigned service', async () => {
      memoryJobCards.push({
        id: 'jc-unassigned',
        jobCardNumber: 'JC-UNASSIGNED',
        serviceId: 'svc-unassigned',
        technicianId: null,
      } as any);

      await expect(
        technicianPaymentService.recordPayment(
          'jc-unassigned',
          { amount: 500, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();
    });
  });

  describe('5. Idempotency & Duplicate Submission Protection', () => {
    it('submitting the same payment with identical idempotencyKey returns cached response without duplicate ledger entries', async () => {
      const idempotencyKey = 'req-token-xyz-12345';

      // First submission
      const first = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        {
          amount: 500,
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-IDEM-001',
          idempotencyKey,
        },
        sessionTechA
      );

      expect(first.success).toBe(true);
      expect(first.data.amount).toBe(500);
      expect(memoryPayments.length).toBe(1);

      // Duplicate submission (e.g. mobile connection retry or double-tap)
      const second = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        {
          amount: 500,
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-IDEM-001',
          idempotencyKey,
        },
        sessionTechA
      );

      expect(second.success).toBe(true);
      expect(second.data.paymentId).toBe(first.data.paymentId);
      expect(second.data.paymentNumber).toBe(first.data.paymentNumber);

      // Verify that exactly ONE payment record exists in the authoritative ledger
      expect(memoryPayments.length).toBe(1);
      const inv = memoryInvoices.find((i) => i.id === 'inv-uuid-001');
      expect(Number(inv.outstandingAmount)).toBe(1500); // 2000 - 500 = 1500 (NOT 1000)
    });
  });

  describe('6. Reassignment Invalidation', () => {
    it('reassigning job from Tech A to Tech B immediately revokes Tech A payment permission and grants Tech B', async () => {
      // Tech A can record payment initially
      const p1 = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        { amount: 500, paymentMethod: 'CASH' },
        sessionTechA
      );
      expect(p1.success).toBe(true);

      // Admin reassigns Job Card A to Tech B
      const jc = memoryJobCards.find((j) => j.id === 'jc-uuid-001');
      jc.technicianId = 'tech-uuid-2222';
      const svc = memoryServices.find((s) => s.id === 'svc-uuid-001');
      svc.technicianId = 'tech-uuid-2222';

      // Tech A attempts to record payment -> Rejected with 403 Forbidden
      await expect(
        technicianPaymentService.recordPayment(
          'jc-uuid-001',
          { amount: 500, paymentMethod: 'CASH' },
          sessionTechA
        )
      ).rejects.toThrow();

      // Tech B attempts to record payment -> Succeeded
      const p2 = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        { amount: 500, paymentMethod: 'CASH' },
        sessionTechB
      );
      expect(p2.success).toBe(true);
      expect(p2.data.remainingOutstanding).toBe(1000);
    });
  });

  describe('7. Authoritative Receipt Retrieval & Authorization', () => {
    it('allows authorized technician to retrieve receipt for their recorded payment', async () => {
      const paymentRes = await technicianPaymentService.recordPayment(
        'jc-uuid-001',
        {
          amount: 1200,
          paymentMethod: 'UPI',
          referenceNumber: 'UTR-99112233',
        },
        sessionTechA
      );

      const receipt = await technicianPaymentService.getPaymentReceipt(
        paymentRes.data.paymentId,
        'tech-uuid-1111'
      );

      expect(receipt.success).toBe(true);
      expect(receipt.data.receiptNumber).toBe(paymentRes.data.paymentNumber);
      expect(receipt.data.amount).toBe(1200);
      expect(receipt.data.paymentMethod).toBe('UPI');
      expect(receipt.data.referenceNumber).toBe('UTR-99112233');
      expect(receipt.data.invoiceNumber).toBe('INV-2026-0001');
      expect(receipt.data.customerName).toBe('Aarav Mehta');
      expect(receipt.data.outstandingBalance).toBe(800);
      expect(receipt.data.businessDetails?.businessName).toBeDefined();
    });

    it('rejects unauthorized cross-technician receipt retrieval with 403 Forbidden', async () => {
      // Tech B records payment on Job B
      const paymentB = await technicianPaymentService.recordPayment(
        'jc-uuid-002',
        { amount: 1500, paymentMethod: 'CASH' },
        sessionTechB
      );

      // Tech A attempts to view Tech B's receipt
      await expect(
        technicianPaymentService.getPaymentReceipt(paymentB.data.paymentId, 'tech-uuid-1111')
      ).rejects.toThrow();
    });

    it('returns 404 Not Found for non-existent payment ID', async () => {
      await expect(
        technicianPaymentService.getPaymentReceipt('non-existent-pay-id', 'tech-uuid-1111')
      ).rejects.toThrow();
    });
  });

  describe('8. Concurrency & Overpayment Race Condition Safety', () => {
    it('concurrent payment submissions competing for remaining balance do not allow overpayment', async () => {
      // Invoice 2 has ₹5,000 outstanding.
      // Two concurrent requests attempt to record ₹4,000 each.
      // Total attempted: ₹8,000.
      // Invariant: Total recorded payments must NOT exceed ₹5,000.
      const attempts = await Promise.allSettled([
        technicianPaymentService.recordPayment(
          'jc-uuid-002',
          { amount: 4000, paymentMethod: 'UPI', referenceNumber: 'RACE-1' },
          sessionTechB
        ),
        technicianPaymentService.recordPayment(
          'jc-uuid-002',
          { amount: 4000, paymentMethod: 'UPI', referenceNumber: 'RACE-2' },
          sessionTechB
        ),
      ]);

      const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
      const rejected = attempts.filter((a) => a.status === 'rejected');

      // Exactly one of the ₹4,000 payments should succeed, and the second must be rejected
      // because ₹4,000 > ₹1,000 remaining
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const inv = memoryInvoices.find((i) => i.id === 'inv-uuid-002');
      expect(Number(inv.outstandingAmount)).toBe(1000); // 5000 - 4000 = 1000
      expect(Number(inv.paidAmount)).toBe(4000);
    });
  });
});

