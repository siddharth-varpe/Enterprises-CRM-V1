import { technicianNotificationRepository } from './technician-notification.repository';
import type {
  TechnicianNotificationListResponse,
  TechnicianPortalNotificationItem,
  TechnicianMarkNotificationReadResponse,
  TechnicianNotificationType,
} from '@crm/types';
import type { TechnicianNotificationQueryInput } from '@crm/validation';

export class TechnicianNotificationService {
  /**
   * List notifications scoped to the authenticated technician
   */
  async getNotifications(
    technicianId: string,
    query: TechnicianNotificationQueryInput
  ): Promise<TechnicianNotificationListResponse> {
    if (!technicianId) {
      const error: any = new Error('Technician identity is required.');
      error.statusCode = 400;
      throw error;
    }

    const { items, total, unreadCount, page, limit, totalPages } =
      await technicianNotificationRepository.findByTechnicianId(technicianId, query);

    const formattedNotifications: TechnicianPortalNotificationItem[] = items.map((n) => {
      let actionUrl: string | null = null;
      if (n.referenceType === 'SERVICE' && n.referenceId) {
        actionUrl = `/technician/services/${n.referenceId}`;
      } else if (n.referenceType === 'JOB_CARD' && n.referenceId) {
        actionUrl = `/technician/services/${n.referenceId}`;
      }

      return {
        id: n.id,
        type: n.type as TechnicianNotificationType,
        title: n.title,
        message: n.message,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
        readAt: n.readAt ? (n.readAt instanceof Date ? n.readAt.toISOString() : String(n.readAt)) : null,
      };
    });

    return {
      notifications: formattedNotifications,
      unreadCount,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Mark notification as read with strict technician authorization and idempotency
   */
  async markAsRead(
    notificationId: string,
    technicianId: string
  ): Promise<TechnicianMarkNotificationReadResponse> {
    if (!notificationId) {
      const error: any = new Error('Notification ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const existing = await technicianNotificationRepository.findById(notificationId);
    if (!existing) {
      const error: any = new Error('Notification not found.');
      error.statusCode = 404;
      throw error;
    }

    // Strict cross-technician IDOR protection: Technician A cannot read Technician B's notification
    if (existing.technicianId !== technicianId) {
      const error: any = new Error('Access denied: You cannot view or modify another technician\'s notification.');
      error.statusCode = 403;
      throw error;
    }

    // Safely idempotent if already read
    if (existing.isRead) {
      const unreadCount = await technicianNotificationRepository.getUnreadCount(technicianId);
      return {
        success: true,
        notificationId: existing.id,
        isRead: true,
        readAt: existing.readAt ? (existing.readAt instanceof Date ? existing.readAt.toISOString() : String(existing.readAt)) : new Date().toISOString(),
        unreadCount,
      };
    }

    const updated = await technicianNotificationRepository.markAsRead(notificationId, technicianId);
    const unreadCount = await technicianNotificationRepository.getUnreadCount(technicianId);

    return {
      success: true,
      notificationId: updated?.id || notificationId,
      isRead: true,
      readAt: updated?.readAt ? (updated.readAt instanceof Date ? updated.readAt.toISOString() : String(updated.readAt)) : new Date().toISOString(),
      unreadCount,
    };
  }

  /**
   * Mark all notifications read for the authenticated technician
   */
  async markAllAsRead(technicianId: string): Promise<{ success: boolean; affectedCount: number }> {
    const affectedCount = await technicianNotificationRepository.markAllAsRead(technicianId);
    return {
      success: true,
      affectedCount,
    };
  }

  /**
   * Get unread count for the authenticated technician
   */
  async getUnreadCount(technicianId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await technicianNotificationRepository.getUnreadCount(technicianId);
    return { unreadCount };
  }

  // ==========================================
  // AUTHORITATIVE BUSINESS EVENT NOTIFIERS
  // ==========================================

  /**
   * 1. New Service Assignment Notification
   */
  async notifyAssignment(params: {
    technicianId: string;
    serviceId: string;
    serviceNumber: string;
    scheduledDate?: Date | string | null;
    scheduledTimeSlot?: string | null;
    priority?: string | null;
  }) {
    if (!params.technicianId || !params.serviceId) return null;

    const dateStr = params.scheduledDate
      ? new Date(params.scheduledDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })
      : 'Today';

    const slotStr = params.scheduledTimeSlot ? ` · ${params.scheduledTimeSlot}` : '';
    const prioStr = params.priority ? ` · Priority: ${params.priority}` : '';

    return technicianNotificationRepository.create({
      technicianId: params.technicianId,
      type: 'NEW_ASSIGNMENT',
      title: 'New Service Assigned',
      message: `${params.serviceNumber} • Scheduled: ${dateStr}${slotStr}${prioStr}`,
      referenceType: 'SERVICE',
      referenceId: params.serviceId,
      dedupKey: `assign_${params.serviceId}_${params.technicianId}`,
    });
  }

  /**
   * 2. Schedule Change Notification
   */
  async notifyScheduleChange(params: {
    technicianId: string;
    serviceId: string;
    serviceNumber: string;
    newDate?: Date | string | null;
    newTimeSlot?: string | null;
    reason?: string | null;
  }) {
    if (!params.technicianId || !params.serviceId) return null;

    const dateStr = params.newDate
      ? new Date(params.newDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })
      : 'Updated Date';

    const slotStr = params.newTimeSlot ? ` (${params.newTimeSlot})` : '';
    const reasonStr = params.reason ? ` • ${params.reason}` : '';

    // Legitimate distinct schedule updates have unique dedup keys per date/slot
    const dedupKey = `sched_${params.serviceId}_${params.technicianId}_${params.newDate || 'd'}_${params.newTimeSlot || 't'}`;

    return technicianNotificationRepository.create({
      technicianId: params.technicianId,
      type: 'SCHEDULE_CHANGE',
      title: 'Schedule Changed',
      message: `${params.serviceNumber} • New Time: ${dateStr}${slotStr}${reasonStr}`,
      referenceType: 'SERVICE',
      referenceId: params.serviceId,
      dedupKey,
    });
  }

  /**
   * 3. Service Cancellation Notification
   */
  async notifyCancellation(params: {
    technicianId: string;
    serviceId: string;
    serviceNumber: string;
    reason?: string | null;
  }) {
    if (!params.technicianId || !params.serviceId) return null;

    const reasonStr = params.reason ? `: ${params.reason}` : '.';

    return technicianNotificationRepository.create({
      technicianId: params.technicianId,
      type: 'CANCELLATION',
      title: 'Service Cancelled',
      message: `${params.serviceNumber} • The assigned service has been cancelled${reasonStr}`,
      referenceType: 'SERVICE',
      referenceId: params.serviceId,
      dedupKey: `cancel_${params.serviceId}_${params.technicianId}`,
    });
  }

  /**
   * 4. Service Reassignment Notification
   */
  async notifyReassignment(params: {
    oldTechnicianId?: string | null;
    newTechnicianId?: string | null;
    serviceId: string;
    serviceNumber: string;
    scheduledDate?: Date | string | null;
    scheduledTimeSlot?: string | null;
    priority?: string | null;
  }) {
    const results: any = {};

    // Notify old technician that service was reassigned away
    if (params.oldTechnicianId) {
      results.oldTechNotification = await technicianNotificationRepository.create({
        technicianId: params.oldTechnicianId,
        type: 'REASSIGNMENT',
        title: 'Service Reassigned',
        message: `${params.serviceNumber} has been reassigned to another technician.`,
        referenceType: 'SERVICE',
        referenceId: params.serviceId,
        dedupKey: `reassign_old_${params.serviceId}_${params.oldTechnicianId}`,
      });
    }

    // Notify new technician that service is assigned to them
    if (params.newTechnicianId) {
      results.newTechNotification = await this.notifyAssignment({
        technicianId: params.newTechnicianId,
        serviceId: params.serviceId,
        serviceNumber: params.serviceNumber,
        scheduledDate: params.scheduledDate,
        scheduledTimeSlot: params.scheduledTimeSlot,
        priority: params.priority,
      });
    }

    return results;
  }

  /**
   * 5. Job Card / Service Operational Update Notification
   */
  async notifyJobUpdate(params: {
    technicianId: string;
    serviceId: string;
    jobCardId?: string | null;
    serviceNumber: string;
    jobCardNumber?: string | null;
    updateType?: string | null;
    summary?: string | null;
  }) {
    if (!params.technicianId || !params.serviceId) return null;

    const summaryStr = params.summary || params.updateType || 'Important work updates recorded';
    const refNumber = params.serviceNumber || params.jobCardNumber || 'Job';

    const dedupKey = `job_update_${params.serviceId}_${params.technicianId}_${params.updateType || 'upd'}_${params.summary || ''}`;

    return technicianNotificationRepository.create({
      technicianId: params.technicianId,
      type: 'JOB_UPDATE',
      title: 'Job Updated',
      message: `${refNumber} • ${summaryStr}`,
      referenceType: 'SERVICE',
      referenceId: params.serviceId,
      dedupKey,
    });
  }
}

export const technicianNotificationService = new TechnicianNotificationService();
