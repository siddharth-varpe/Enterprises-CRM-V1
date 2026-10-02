import { technicianPortalRepository } from './technician-portal.repository';
import { TECHNICIAN_ERROR_CODES } from '@crm/shared';
import type { Technician360ResponseData } from '@crm/types';

/**
 * Service handling Technician 360 Profile retrieval and personal work summary calculations
 * Phase 3: Isolated Technician Profile Boundary
 */
export class TechnicianProfileService {
  /**
   * Retrieve the Technician 360 Profile and personal work summary
   * Strictly derived from the authenticated technician's session identity
   * Enforces zero cross-technician data leakage
   */
  async getProfile(technicianId: string): Promise<Technician360ResponseData> {
    if (!technicianId) {
      const err: any = new Error('Authenticated technician identity is required.');
      err.statusCode = 401;
      err.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
      throw err;
    }

    const data = await technicianPortalRepository.getTechnician360Profile(technicianId);
    if (!data) {
      const err: any = new Error('Technician record not found.');
      err.statusCode = 404;
      err.code = TECHNICIAN_ERROR_CODES.TECHNICIAN_NOT_FOUND;
      throw err;
    }

    return data;
  }
}

export const technicianProfileService = new TechnicianProfileService();
