import type { FastifyPluginAsync } from 'fastify';
import { techniciansService } from './technicians.service';
import {
  TechnicianQueryFilterSchema,
  CreateTechnicianSchema,
  UpdateTechnicianSchema,
  TogglePortalAccessSchema,
} from '@crm/validation';
import { requirePermission } from '../../middleware/rbac';
import { authenticate } from '../../middleware/auth';

export const techniciansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/v1/technicians/kpis
   * Workforce metrics (active, on-leave, inactive)
   */
  fastify.get('/kpis', { preHandler: [requirePermission('services.view')] }, async (_request, reply) => {
    const kpis = await techniciansService.getKPIs();
    return reply.send({
      success: true,
      data: kpis,
    });
  });

  /**
   * GET /api/v1/technicians
   * List paginated technicians with filters
   */
  fastify.get('/', { preHandler: [requirePermission('services.view')] }, async (request, reply) => {
    const query = TechnicianQueryFilterSchema.parse(request.query);
    const result = await techniciansService.getTechnicians(query);
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * GET /api/v1/technicians/:id
   * Get single technician profile with job history
   */
  fastify.get('/:id', { preHandler: [requirePermission('services.view')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tech = await techniciansService.getTechnicianById(id);
    return reply.send({
      success: true,
      data: tech,
    });
  });

  /**
   * GET /api/v1/technicians/:id/360
   * Get dedicated Admin-side 360° Technician Profile
   * Live aggregated from authoritative CRM records (identity, portal access, services, job cards, customers, assets, parts, payments)
   */
  fastify.get('/:id/360', { preHandler: [requirePermission('services.view')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const profile = await techniciansService.getTechnician360Profile(id);
      return reply.send({
        success: true,
        data: profile,
      });
    } catch (err: any) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'TECHNICIAN_NOT_FOUND',
          message: err?.message || 'Technician not found',
        },
      });
    }
  });

  /**
   * POST /api/v1/technicians
   * Create a new technician
   */
  fastify.post('/', { preHandler: [requirePermission('users.manage')] }, async (request, reply) => {
    const body = CreateTechnicianSchema.parse(request.body);
    const user = (request as any).user;
    const result = await techniciansService.createTechnician(body, user?.id);
    return reply.status(201).send({
      success: true,
      data: result,
      message: 'Technician created successfully',
    });
  });

  /**
   * PATCH /api/v1/technicians/:id
   * Update technician profile or status
   */
  fastify.patch('/:id', { preHandler: [requirePermission('users.manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateTechnicianSchema.parse(request.body);
    const user = (request as any).user;
    const updated = await techniciansService.updateTechnician(id, body, user?.id);
    return reply.send({
      success: true,
      data: updated,
      message: 'Technician updated successfully',
    });
  });

  /**
   * PATCH /api/v1/technicians/:id/portal-access
   * Enable or disable Technician Portal access for an individual technician
   * Authoritative administrative control guarded by users.manage permission
   */
  fastify.patch('/:id/portal-access', { preHandler: [requirePermission('users.manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = TogglePortalAccessSchema.parse(request.body);
    const user = (request as any).user;
    const result = await techniciansService.togglePortalAccess(id, body.portalEnabled, user?.id);
    return reply.send({
      success: true,
      data: result,
      message: result.message,
    });
  });

  /**
   * DELETE /api/v1/technicians/:id
   * Safe delete technician with dependency checks
   */
  fastify.delete('/:id', { preHandler: [requirePermission('users.manage')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    try {
      const result = await techniciansService.deleteTechnician(id, user?.id);
      return reply.send({
        success: true,
        data: result,
        message: 'Technician deleted successfully',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'TECHNICIAN_DELETE_FAILED',
          message: err?.message || 'Failed to delete technician',
        },
      });
    }
  });
};
