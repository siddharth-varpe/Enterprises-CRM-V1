import { domainEventBus, type DomainEvent } from '../notifications/events/event-bus';
import { technicianNotificationService } from './technician-notification.service';

/**
 * Technician Notification Adapter
 * Bridges CRM domain events into technician-scoped portal notifications with failure isolation.
 */
export class TechnicianNotificationAdapter {
  private isSubscribed = false;

  public initializeSubscriptions(): void {
    if (this.isSubscribed) return;

    // 1. Service Assigned
    domainEventBus.subscribe('SERVICE_ASSIGNED', async (event: DomainEvent) => {
      try {
        const { serviceNumber, technicianId, scheduledDate, scheduledTimeSlot, priority } = event.payload || {};
        if (technicianId && event.entityId) {
          await technicianNotificationService.notifyAssignment({
            technicianId,
            serviceId: event.entityId,
            serviceNumber: serviceNumber || 'Service',
            scheduledDate,
            scheduledTimeSlot,
            priority,
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle SERVICE_ASSIGNED event:', err);
      }
    });

    // 2. Service Schedule Changed
    domainEventBus.subscribe('SERVICE_SCHEDULE_CHANGED', async (event: DomainEvent) => {
      try {
        const { serviceNumber, technicianId, scheduledDate, scheduledTimeSlot, reason } = event.payload || {};
        if (technicianId && event.entityId) {
          await technicianNotificationService.notifyScheduleChange({
            technicianId,
            serviceId: event.entityId,
            serviceNumber: serviceNumber || 'Service',
            newDate: scheduledDate,
            newTimeSlot: scheduledTimeSlot,
            reason,
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle SERVICE_SCHEDULE_CHANGED event:', err);
      }
    });

    // 3. Service Cancelled
    domainEventBus.subscribe('SERVICE_CANCELLED', async (event: DomainEvent) => {
      try {
        const { serviceNumber, technicianId, cancelReason } = event.payload || {};
        if (technicianId && event.entityId) {
          await technicianNotificationService.notifyCancellation({
            technicianId,
            serviceId: event.entityId,
            serviceNumber: serviceNumber || 'Service',
            reason: cancelReason,
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle SERVICE_CANCELLED event:', err);
      }
    });

    // 4. Service Reassigned
    domainEventBus.subscribe('SERVICE_REASSIGNED', async (event: DomainEvent) => {
      try {
        const {
          serviceNumber,
          oldTechnicianId,
          newTechnicianId,
          scheduledDate,
          scheduledTimeSlot,
          priority,
        } = event.payload || {};
        if (event.entityId) {
          await technicianNotificationService.notifyReassignment({
            oldTechnicianId,
            newTechnicianId,
            serviceId: event.entityId,
            serviceNumber: serviceNumber || 'Service',
            scheduledDate,
            scheduledTimeSlot,
            priority,
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle SERVICE_REASSIGNED event:', err);
      }
    });

    // 5. Job Card Assigned
    domainEventBus.subscribe('JOB_CARD_ASSIGNED', async (event: DomainEvent) => {
      try {
        const { jobCardNumber, technicianId, serviceId } = event.payload || {};
        if (technicianId) {
          await technicianNotificationService.notifyAssignment({
            technicianId,
            serviceId: serviceId || event.entityId,
            serviceNumber: jobCardNumber || 'Job Card',
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle JOB_CARD_ASSIGNED event:', err);
      }
    });

    // 6. Job Card / Service Updated
    domainEventBus.subscribe('JOB_CARD_UPDATED', async (event: DomainEvent) => {
      try {
        const { serviceNumber, jobCardNumber, technicianId, serviceId, updateType, summary } =
          event.payload || {};
        if (technicianId && (serviceId || event.entityId)) {
          await technicianNotificationService.notifyJobUpdate({
            technicianId,
            serviceId: serviceId || event.entityId,
            jobCardId: event.entityType === 'JOB_CARD' ? event.entityId : null,
            serviceNumber: serviceNumber || jobCardNumber || 'Job Card',
            jobCardNumber,
            updateType,
            summary,
          });
        }
      } catch (err) {
        console.error('[TechnicianNotificationAdapter] Failed to handle JOB_CARD_UPDATED event:', err);
      }
    });

    this.isSubscribed = true;
  }
}

export const technicianNotificationAdapter = new TechnicianNotificationAdapter();
// Auto-initialize subscriptions upon module load
technicianNotificationAdapter.initializeSubscriptions();
