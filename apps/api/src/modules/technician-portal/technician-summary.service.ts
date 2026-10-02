/**
 * SR Enterprises CRM - Technician Portal
 * Phase 9: Personal Technician Summary Service
 * Strictly isolated read layer providing authoritative personal operational metrics.
 * No global business analytics or company-wide metrics are exposed.
 */

import { technicianPortalRepository } from './technician-portal.repository';
import type { TechnicianPersonalSummary } from '@crm/types';
import { HTTP_STATUS, TECHNICIAN_ERROR_CODES } from './technician-portal.constants';

export class TechnicianSummaryService {
  /**
   * Retrieve the personal operational summary strictly for the authenticated technician
   *
   * @param technicianId Authenticated technician ID derived from session
   */
  async getSummary(technicianId: string): Promise<TechnicianPersonalSummary> {
    if (!technicianId || typeof technicianId !== 'string') {
      const error: any = new Error('Authenticated technician identity is required');
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;
      error.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
      throw error;
    }

    const summary = await technicianPortalRepository.getPersonalTechnicianSummary(technicianId);
    return summary;
  }
}

export const technicianSummaryService = new TechnicianSummaryService();
