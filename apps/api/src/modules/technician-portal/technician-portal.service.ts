import { technicianPortalRepository } from './technician-portal.repository';
import { paymentsService } from '../payments/payments.service';
import { jobCardsService } from '../job-cards/job-cards.service';
import type {
  TechnicianAssignedService,
  TechnicianPaymentSummary,
  TechnicianRecordPaymentInput,
} from '@crm/types';

export class TechnicianPortalService {
  /**
   * Safe access check
   */
  async checkPortalAccess(technicianId: string): Promise<boolean> {
    return technicianPortalRepository.getPortalAccessStatus(technicianId);
  }

  /**
   * Get assigned services for authenticated technician
   */
  async getAssignedServices(technicianId: string, filterStatus?: string): Promise<TechnicianAssignedService[]> {
    return technicianPortalRepository.findAssignedServices(technicianId, filterStatus);
  }

  /**
   * Get payment summary for assigned job card
   */
  async getPaymentSummary(jobCardId: string, technicianId: string): Promise<TechnicianPaymentSummary | null> {
    return technicianPortalRepository.getPaymentSummaryForJobCard(jobCardId, technicianId);
  }

  /**
   * Record payment from technician portal
   * Reuses the existing authoritative paymentsService after enforcing technician ownership
   */
  async recordTechnicianPayment(
    jobCardId: string,
    technicianId: string,
    input: TechnicianRecordPaymentInput,
    technicianName: string
  ) {
    // 1. Verify job card belongs strictly to the authenticated technician
    const summary = await technicianPortalRepository.getPaymentSummaryForJobCard(jobCardId, technicianId);
    if (!summary || !summary.invoiceId) {
      const err: any = new Error('No authorized invoice found for this assigned job card');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (summary.invoiceId !== input.invoiceId) {
      const err: any = new Error('Invoice ID mismatch for assigned job card');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // 2. Delegate to existing authoritative payment engine without altering it
    return paymentsService.recordPayment(
      {
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        notes: `[Technician Portal]: ${input.notes || ''}`.trim(),
      },
      technicianId,
      technicianName
    );
  }

  /**
   * Trigger workflow action on job card (start, hold, resume)
   * Reuses existing jobCardsService after enforcing technician ownership
   */
  async performJobAction(
    jobCardId: string,
    technicianId: string,
    action: 'start' | 'hold' | 'resume' | 'cancel',
    reason?: string
  ) {
    const summary = await technicianPortalRepository.getPaymentSummaryForJobCard(jobCardId, technicianId);
    if (!summary) {
      const err: any = new Error('Job card not assigned to authenticated technician');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    return jobCardsService.performWorkflowAction(
      jobCardId,
      { action, reason },
      { id: technicianId, role: 'Technician' } as any
    );
  }
}

export const technicianPortalService = new TechnicianPortalService();
