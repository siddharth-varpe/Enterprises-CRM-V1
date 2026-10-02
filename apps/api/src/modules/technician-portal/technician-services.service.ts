import { technicianPortalRepository } from './technician-portal.repository';
import { TECHNICIAN_ERROR_CODES, HTTP_STATUS } from '@crm/shared';
import type { TechnicianAssignedService, TechnicianServiceDetail } from '@crm/types';

export class TechnicianServicesService {
  /**
   * Fetch services assigned exclusively to the authenticated technician
   * Identity derived exclusively from authenticated server session
   */
  async getAssignedServices(
    technicianId: string,
    view?: 'all' | 'today' | 'upcoming' | 'in_progress' | 'on_hold' | string
  ): Promise<TechnicianAssignedService[]> {
    if (!technicianId || typeof technicianId !== 'string') {
      const error: any = new Error('Authentication required to access assigned services');
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;
      error.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
      throw error;
    }

    return technicianPortalRepository.findAssignedServices(technicianId, view);
  }

  /**
   * Fetch authorized service detail strictly scoped to the authenticated technician
   * Enforces server-side authorization: returns 403 Forbidden if service is not assigned to this technician
   */
  async getServiceDetail(
    serviceId: string,
    technicianId: string
  ): Promise<TechnicianServiceDetail> {
    if (!technicianId || typeof technicianId !== 'string') {
      const error: any = new Error('Authentication required to access service detail');
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;
      error.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
      throw error;
    }

    if (!serviceId || typeof serviceId !== 'string') {
      const error: any = new Error('Service ID parameter is required');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    const result = await technicianPortalRepository.getAssignedServiceDetail(serviceId, technicianId);

    if (result.forbidden) {
      const error: any = new Error(
        'Access denied: This service work order is not assigned to your technician account.'
      );
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      error.code = TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED;
      throw error;
    }

    if (result.notFound || !result.data) {
      const error: any = new Error('Service work order record not found.');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      error.code = 'SERVICE_NOT_FOUND';
      throw error;
    }

    return result.data;
  }
}

export const technicianServicesService = new TechnicianServicesService();
