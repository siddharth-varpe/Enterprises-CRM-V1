import { eq, or, and } from 'drizzle-orm';
import { db } from '../../database/client';
import { jobCards, services } from '../../database/schema/index';
import { jobCardsRepository, memoryJobCards } from '../job-cards/job-cards.repository';
import { memoryServices } from '../services/services.repository';
import { productRepository } from '../products/product.repository';
import { TECHNICIAN_ERROR_CODES, HTTP_STATUS } from '@crm/shared';
import type {
  TechnicianJobExecutionInput,
  TechnicianJobHoldInput,
  TechnicianJobCompleteInput,
} from '@crm/validation';

export class TechnicianExecutionService {
  /**
   * Resolve and verify that a job card exists and belongs strictly to the authenticated technician
   * Supports resolving by Job Card ID, Job Card Number, or linked Service ID
   */
  async resolveAuthorizedJobCard(
    id: string,
    technicianId: string,
    database = db
  ): Promise<any> {
    if (!technicianId || typeof technicianId !== 'string') {
      const error: any = new Error('Authentication required');
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;
      error.code = TECHNICIAN_ERROR_CODES.SESSION_EXPIRED;
      throw error;
    }

    if (!id || typeof id !== 'string') {
      const error: any = new Error('Job Card identifier is required');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    try {
      // 1. Check if id directly matches a job card
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const [directJc] = await database
          .select()
          .from(jobCards)
          .where(isUuid ? or(eq(jobCards.id, id), eq(jobCards.jobCardNumber, id)) : eq(jobCards.jobCardNumber, id))
          .limit(1);

        if (directJc) {
          if (!directJc.technicianId || directJc.technicianId !== technicianId) {
            const error: any = new Error(
              'Access denied: This job card is not assigned to your technician account.'
            );
            error.statusCode = HTTP_STATUS.FORBIDDEN;
            error.code = TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED;
            throw error;
          }
          return directJc;
        }
      } catch (dbErr: any) {
        if (dbErr.statusCode) throw dbErr;
      }

      // 2. Check if id matches a linked service
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const [serviceRow] = await database
          .select()
          .from(services)
          .where(isUuid ? or(eq(services.id, id), eq(services.serviceNumber, id)) : eq(services.serviceNumber, id))
          .limit(1);

        if (serviceRow) {
          if (!serviceRow.technicianId || serviceRow.technicianId !== technicianId) {
            const error: any = new Error(
              'Access denied: This service is not assigned to your technician account.'
            );
            error.statusCode = HTTP_STATUS.FORBIDDEN;
            error.code = TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED;
            throw error;
          }

          // Find linked job card for this service
          const [linkedJc] = await database
            .select()
            .from(jobCards)
            .where(eq(jobCards.serviceId, serviceRow.id))
            .limit(1);

          if (linkedJc) {
            if (!linkedJc.technicianId || linkedJc.technicianId !== technicianId) {
              const error: any = new Error(
                'Access denied: This job card is not assigned to your technician account.'
              );
              error.statusCode = HTTP_STATUS.FORBIDDEN;
              error.code = TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED;
              throw error;
            }
            return linkedJc;
          }

          // Create job card on demand for this service if one does not exist yet
          const createdJc = await jobCardsRepository.createJobCard({
            serviceId: serviceRow.id,
            customerId: serviceRow.customerId,
            assetId: serviceRow.assetId || '',
            technicianId,
            problemReported: serviceRow.customerNotes || 'Service order execution',
          });
          return createdJc;
        }
      } catch (dbErr: any) {
        if (dbErr.statusCode) throw dbErr;
      }

      // 3. Fallback to memoryJobCards for tests / offline mode
      const memJc = memoryJobCards.find(
        (j) => j.id === id || j.jobCardNumber === id || j.serviceId === id
      );
      if (memJc) {
        if (!memJc.technicianId || memJc.technicianId !== technicianId) {
          const error: any = new Error(
            'Access denied: This job card is not assigned to your technician account.'
          );
          error.statusCode = HTTP_STATUS.FORBIDDEN;
          error.code = TECHNICIAN_ERROR_CODES.JOB_CARD_NOT_ASSIGNED;
          throw error;
        }
        return memJc;
      }

      const memSrv = memoryServices.find((s) => s.id === id || s.serviceNumber === id);
      if (memSrv) {
        if (!memSrv.technicianId || memSrv.technicianId !== technicianId) {
          const error: any = new Error(
            'Access denied: This service is not assigned to your technician account.'
          );
          error.statusCode = HTTP_STATUS.FORBIDDEN;
          error.code = TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED;
          throw error;
        }
        return {
          id: `jc-${memSrv.id}`,
          jobCardNumber: `JC-${memSrv.serviceNumber || '2026-0001'}`,
          serviceId: memSrv.id,
          technicianId,
          status: memSrv.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ASSIGNED',
          problemReported: memSrv.customerNotes || 'Service order execution',
          diagnosis: null,
          workPerformed: null,
          partsReplaced: [],
        };
      }

      const error: any = new Error('Job Card record not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      error.code = 'NOT_FOUND';
      throw error;
    } catch (err: any) {
      if (err.statusCode) throw err;
      const notFound: any = new Error('Job Card record not found');
      notFound.statusCode = HTTP_STATUS.NOT_FOUND;
      notFound.code = 'NOT_FOUND';
      throw notFound;
    }
  }

  /**
   * POST /api/v1/technician/job-cards/:id/start
   * Start execution on an authorized assigned job card
   * Authoritative server timestamp is attached
   */
  async startJob(id: string, technicianId: string) {
    const jobCard = await this.resolveAuthorizedJobCard(id, technicianId);

    // Concurrency / Duplicate Start Protection:
    // If already in progress, return existing active state idempotently
    if (['IN_PROGRESS', 'STARTED', 'DIAGNOSIS'].includes(jobCard.status)) {
      return {
        success: true,
        message: 'Job is already in progress',
        data: jobCard,
      };
    }

    // Invalid transition guards
    if (['COMPLETED', 'CUSTOMER_CONFIRMED', 'CLOSED'].includes(jobCard.status)) {
      const error: any = new Error('Cannot start a completed or closed job card');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    if (jobCard.status === 'CANCELLED') {
      const error: any = new Error('Cannot start a cancelled job card');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    const updated = await jobCardsRepository.performWorkflowAction(
      jobCard.id,
      { action: 'start' },
      technicianId
    );

    return {
      success: true,
      message: 'Job started successfully',
      data: updated,
    };
  }

  /**
   * POST /api/v1/technician/job-cards/:id/hold
   * Put an active job on hold with optional hold reason
   */
  async holdJob(id: string, input: TechnicianJobHoldInput, technicianId: string) {
    const jobCard = await this.resolveAuthorizedJobCard(id, technicianId);

    // Duplicate Hold Protection: idempotent if already on hold
    if (jobCard.status === 'ON_HOLD') {
      return {
        success: true,
        message: 'Job is already on hold',
        data: jobCard,
      };
    }

    // Must be in progress to be put on hold
    if (!['IN_PROGRESS', 'STARTED', 'DIAGNOSIS'].includes(jobCard.status)) {
      const error: any = new Error(
        `Job cannot be put on hold from its current status: ${jobCard.status}. Job must be started first.`
      );
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    const reason = input?.reason || input?.holdReason || '';
    if (reason.trim()) {
      await jobCardsRepository.updateWork(
        jobCard.id,
        {
          technicianNotes: jobCard.technicianNotes
            ? `${jobCard.technicianNotes}\n[Hold reason]: ${reason.trim()}`
            : `[Hold reason]: ${reason.trim()}`,
        },
        technicianId
      );
    }

    const updated = await jobCardsRepository.performWorkflowAction(
      jobCard.id,
      { action: 'hold' },
      technicianId
    );

    return {
      success: true,
      message: 'Job put on hold',
      data: updated,
    };
  }

  /**
   * POST /api/v1/technician/job-cards/:id/resume
   * Resume an on-hold job card
   */
  async resumeJob(id: string, technicianId: string) {
    const jobCard = await this.resolveAuthorizedJobCard(id, technicianId);

    // Duplicate Resume Protection: idempotent if already active
    if (['IN_PROGRESS', 'STARTED', 'DIAGNOSIS'].includes(jobCard.status)) {
      return {
        success: true,
        message: 'Job is already active',
        data: jobCard,
      };
    }

    // Must be on hold to be resumed
    if (jobCard.status !== 'ON_HOLD') {
      const error: any = new Error(
        `Only on-hold jobs can be resumed. Current status is ${jobCard.status}.`
      );
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    const updated = await jobCardsRepository.performWorkflowAction(
      jobCard.id,
      { action: 'resume' },
      technicianId
    );

    return {
      success: true,
      message: 'Job resumed successfully',
      data: updated,
    };
  }

  /**
   * PATCH /api/v1/technician/job-cards/:id
   * Save partial execution data (diagnosis, notes, parts consumed, business fields)
   * Strictly enforces whitelist: technician cannot alter administrative fields
   */
  async updateExecution(
    id: string,
    input: TechnicianJobExecutionInput,
    technicianId: string
  ) {
    const jobCard = await this.resolveAuthorizedJobCard(id, technicianId);

    // Guard: completed or cancelled jobs cannot be updated
    if (['COMPLETED', 'CUSTOMER_CONFIRMED', 'CLOSED', 'CANCELLED'].includes(jobCard.status)) {
      const error: any = new Error(
        `Cannot update execution data for a ${jobCard.status.toLowerCase()} job card.`
      );
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    // Whitelist extraction (no administrative fields permitted)
    const updatePayload: Record<string, any> = {};

    if (input.diagnosis !== undefined) updatePayload.diagnosis = input.diagnosis;
    if (input.workPerformed !== undefined) updatePayload.workPerformed = input.workPerformed;
    if (input.technicianNotes !== undefined) updatePayload.technicianNotes = input.technicianNotes;
    if (input.customerRemarks !== undefined) updatePayload.customerRemarks = input.customerRemarks;
    if (input.problemReported !== undefined) updatePayload.problemReported = input.problemReported;

    // Validate parts consumed (Item & Quantity)
    if (input.partsReplaced !== undefined) {
      if (!Array.isArray(input.partsReplaced)) {
        const error: any = new Error('Parts replaced must be a valid array');
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
        throw error;
      }

      for (const part of input.partsReplaced) {
        if (!part.itemName || typeof part.itemName !== 'string') {
          const error: any = new Error('Each consumed part must have a valid item name');
          error.statusCode = HTTP_STATUS.BAD_REQUEST;
          error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
          throw error;
        }
        if (!part.quantity || typeof part.quantity !== 'number' || part.quantity <= 0) {
          const error: any = new Error(`Quantity for part "${part.itemName}" must be greater than 0`);
          error.statusCode = HTTP_STATUS.BAD_REQUEST;
          error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
          throw error;
        }
      }
      updatePayload.partsReplaced = input.partsReplaced;
    }

    // Support configurable business-specific fields generically (JSON representation)
    if (input.businessFields && typeof input.businessFields === 'object') {
      const existingNotes = updatePayload.technicianNotes || jobCard.technicianNotes || '';
      const customFieldEntries = Object.entries(input.businessFields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (customFieldEntries) {
        updatePayload.technicianNotes = `${existingNotes}\n[Business Fields]: { ${customFieldEntries} }`.trim();
      }
    }

    if (input.customerSignatureFileId) {
      updatePayload.customerSignatureFileId = input.customerSignatureFileId;
    }

    const updated = await jobCardsRepository.updateWork(jobCard.id, updatePayload, technicianId);

    return {
      success: true,
      message: 'Execution details saved successfully',
      data: updated,
    };
  }

  /**
   * POST /api/v1/technician/job-cards/:id/complete
   * Complete job card atomically, update linked service, and validate mandatory execution fields
   */
  async completeJob(
    id: string,
    input: TechnicianJobCompleteInput,
    technicianId: string
  ) {
    const jobCard = await this.resolveAuthorizedJobCard(id, technicianId);

    // Duplicate Completion Protection (Idempotent):
    // If already completed, return existing completed record
    if (['COMPLETED', 'CUSTOMER_CONFIRMED', 'CLOSED'].includes(jobCard.status)) {
      return {
        success: true,
        message: 'Job has already been completed',
        data: jobCard,
      };
    }

    if (jobCard.status === 'CANCELLED') {
      const error: any = new Error('Cannot complete a cancelled job card');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.INVALID_STATE_TRANSITION;
      throw error;
    }

    // Validate mandatory completion fields per specification:
    // Work performed is required for completing a job
    const workPerformed = input.workPerformed?.trim();
    if (!workPerformed) {
      const error: any = new Error(
        'Work performed description is required to complete this job card.'
      );
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
      throw error;
    }

    // Validate parts if provided
    if (input.partsReplaced && Array.isArray(input.partsReplaced)) {
      for (const part of input.partsReplaced) {
        if (!part.itemName || typeof part.itemName !== 'string') {
          const error: any = new Error('Each consumed part must have a valid item name');
          error.statusCode = HTTP_STATUS.BAD_REQUEST;
          error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
          throw error;
        }
        if (!part.quantity || typeof part.quantity !== 'number' || part.quantity <= 0) {
          const error: any = new Error(`Quantity for part "${part.itemName}" must be greater than 0`);
          error.statusCode = HTTP_STATUS.BAD_REQUEST;
          error.code = TECHNICIAN_ERROR_CODES.VALIDATION_ERROR;
          throw error;
        }
      }
    }

    // Build complete payload
    const completePayload: any = {
      workPerformed,
      diagnosis: input.diagnosis || jobCard.diagnosis || 'Standard service completed',
      partsReplaced: input.partsReplaced || jobCard.partsReplaced || [],
      technicianNotes: input.technicianNotes || jobCard.technicianNotes,
      customerRemarks: input.customerRemarks || jobCard.customerRemarks,
    };

    // Generic business-specific fields appended if present
    if (input.businessFields && typeof input.businessFields === 'object') {
      const existingNotes = completePayload.technicianNotes || '';
      const customFieldEntries = Object.entries(input.businessFields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (customFieldEntries) {
        completePayload.technicianNotes = `${existingNotes}\n[Business Fields]: { ${customFieldEntries} }`.trim();
      }
    }

    const result = await jobCardsRepository.completeJobCard(
      jobCard.id,
      completePayload,
      technicianId
    );

    // Tracking Termination: Clear active tracking context upon job completion
    try {
      const { mapsTrackingRedisService } = await import('../maps/maps-tracking.redis.js');
      const { broadcastTechnicianTrackingStopped } = await import('../maps/maps-socket.service.js');
      const activeDest = await mapsTrackingRedisService.getActiveDestination(technicianId);
      if (activeDest && (activeDest.serviceId === jobCard.serviceId || activeDest.jobCardId === jobCard.id)) {
        await mapsTrackingRedisService.clearTracking(technicianId);
        broadcastTechnicianTrackingStopped(technicianId);
      }
    } catch {}

    return {
      success: true,
      message: 'Job completed successfully',
      data: result?.jobCard || result,
    };
  }

  /**
   * GET /api/v1/technician/catalog/materials
   * Returns list of spare parts and materials available for selection
   * Strictly sanitizes out purchase costs, FIFO costs, margins, and profit metrics
   */
  async getAvailableMaterials(search?: string) {
    try {
      const result = await productRepository.findPaginated({
        search,
        limit: 50,
        page: 1,
      });

      return (result.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        model: p.model,
        productType: p.productType,
      }));
    } catch {
      return [];
    }
  }
}

export const technicianExecutionService = new TechnicianExecutionService();
