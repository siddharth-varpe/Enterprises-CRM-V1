import { describe, it, expect, beforeEach } from 'vitest';
import { technicianNotificationService } from './technician-notification.service';
import { technicianNotificationRepository, memoryTechnicianNotifications } from './technician-notification.repository';
import { technicianNotificationAdapter } from './technician-notification.adapter';
import { domainEventBus } from '../notifications/events/event-bus';
import { technicianServicesService } from './technician-services.service';
import { memoryServices } from '../services/services.repository';
import { memoryJobCards } from '../job-cards/job-cards.repository';
import type { TechnicianSessionData } from '@crm/types';

describe('Technician Portal Phase 8: Notifications Suite', () => {
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
    // Reset test memory stores
    memoryTechnicianNotifications.length = 0;
    memoryServices.length = 0;
    memoryJobCards.length = 0;

    // Service A initially assigned to Tech A
    memoryServices.push({
      id: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      serviceType: 'Regular Maintenance',
      technicianId: 'tech-uuid-1111',
      customerId: 'cust-uuid-001',
      scheduledDate: new Date('2026-10-01T10:00:00Z'),
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      status: 'ASSIGNED',
      priority: 'HIGH',
    } as any);

    // Job Card A
    memoryJobCards.push({
      id: 'jc-uuid-001',
      jobCardNumber: 'JC-2026-001',
      serviceId: 'svc-uuid-001',
      technicianId: 'tech-uuid-1111',
      status: 'ASSIGNED',
    } as any);
  });

  it('1. should create NEW_ASSIGNMENT notification with minimal payload', async () => {
    const notification = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      scheduledDate: '2026-10-01T10:00:00Z',
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'HIGH',
    });

    expect(notification).toBeDefined();
    expect(notification?.type).toBe('NEW_ASSIGNMENT');
    expect(notification?.technicianId).toBe('tech-uuid-1111');
    expect(notification?.title).toBe('New Service Assigned');
    expect(notification?.message).toContain('SRV-2026-001');
    expect(notification?.message).toContain('Priority: HIGH');
    expect(notification?.referenceType).toBe('SERVICE');
    expect(notification?.referenceId).toBe('svc-uuid-001');
    expect(notification?.isRead).toBe(false);
  });

  it('2. should create SCHEDULE_CHANGE notification with new timing', async () => {
    const notification = await technicianNotificationService.notifyScheduleChange({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      newDate: '2026-10-02T15:00:00Z',
      newTimeSlot: '03:00 PM - 05:00 PM',
      reason: 'Customer requested evening slot',
    });

    expect(notification).toBeDefined();
    expect(notification?.type).toBe('SCHEDULE_CHANGE');
    expect(notification?.title).toBe('Schedule Changed');
    expect(notification?.message).toContain('New Time:');
    expect(notification?.message).toContain('Customer requested evening slot');
    expect(notification?.referenceId).toBe('svc-uuid-001');
  });

  it('3. should create CANCELLATION notification when service is cancelled', async () => {
    const notification = await technicianNotificationService.notifyCancellation({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      reason: 'Customer rescheduled for next month',
    });

    expect(notification).toBeDefined();
    expect(notification?.type).toBe('CANCELLATION');
    expect(notification?.title).toBe('Service Cancelled');
    expect(notification?.message).toContain('Customer rescheduled for next month');
  });

  it('4. should handle REASSIGNMENT by notifying both previous and new technicians', async () => {
    const res = await technicianNotificationService.notifyReassignment({
      oldTechnicianId: 'tech-uuid-1111',
      newTechnicianId: 'tech-uuid-2222',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      scheduledDate: '2026-10-01T10:00:00Z',
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'HIGH',
    });

    expect(res.oldTechNotification).toBeDefined();
    expect(res.oldTechNotification.technicianId).toBe('tech-uuid-1111');
    expect(res.oldTechNotification.type).toBe('REASSIGNMENT');
    expect(res.oldTechNotification.message).toContain('reassigned to another technician');

    expect(res.newTechNotification).toBeDefined();
    expect(res.newTechNotification.technicianId).toBe('tech-uuid-2222');
    expect(res.newTechNotification.type).toBe('NEW_ASSIGNMENT');
  });

  it('5. should create JOB_UPDATE notification for meaningful operational changes', async () => {
    const notification = await technicianNotificationService.notifyJobUpdate({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      jobCardId: 'jc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      updateType: 'PARTS_UPDATED',
      summary: 'Replacement membrane approved by customer',
    });

    expect(notification).toBeDefined();
    expect(notification?.type).toBe('JOB_UPDATE');
    expect(notification?.title).toBe('Job Updated');
    expect(notification?.message).toContain('Replacement membrane approved by customer');
  });

  it('6. should enforce strict technician scoping (Technician A cannot see Technician B notifications)', async () => {
    // Notification for Tech A
    await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    // Notification for Tech B
    await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-2222',
      serviceId: 'svc-uuid-002',
      serviceNumber: 'SRV-2026-002',
    });

    const listA = await technicianNotificationService.getNotifications('tech-uuid-1111', { page: 1, limit: 10 });
    const listB = await technicianNotificationService.getNotifications('tech-uuid-2222', { page: 1, limit: 10 });

    expect(listA.notifications).toHaveLength(1);
    expect(listA.notifications[0].referenceId).toBe('svc-uuid-001');

    expect(listB.notifications).toHaveLength(1);
    expect(listB.notifications[0].referenceId).toBe('svc-uuid-002');
  });

  it('7. should mark notification as read and update unread count', async () => {
    const created = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    const initialCount = await technicianNotificationService.getUnreadCount('tech-uuid-1111');
    expect(initialCount.unreadCount).toBe(1);

    const markRes = await technicianNotificationService.markAsRead(created!.id, 'tech-uuid-1111');
    expect(markRes.success).toBe(true);
    expect(markRes.isRead).toBe(true);
    expect(markRes.unreadCount).toBe(0);

    const afterCount = await technicianNotificationService.getUnreadCount('tech-uuid-1111');
    expect(afterCount.unreadCount).toBe(0);
  });

  it('8. should be safely idempotent when marking an already-read notification as read', async () => {
    const created = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    const first = await technicianNotificationService.markAsRead(created!.id, 'tech-uuid-1111');
    expect(first.isRead).toBe(true);

    const second = await technicianNotificationService.markAsRead(created!.id, 'tech-uuid-1111');
    expect(second.success).toBe(true);
    expect(second.isRead).toBe(true);
  });

  it('9. should reject cross-technician mark-read with 403 Forbidden (IDOR Defense)', async () => {
    // Notification belongs to Tech B
    const createdForB = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-2222',
      serviceId: 'svc-uuid-002',
      serviceNumber: 'SRV-2026-002',
    });

    // Tech A tries to mark B's notification as read
    await expect(
      technicianNotificationService.markAsRead(createdForB!.id, 'tech-uuid-1111')
    ).rejects.toThrow('Access denied: You cannot view or modify another technician\'s notification.');
  });

  it('10. should return 404 when marking a non-existent notification ID', async () => {
    await expect(
      technicianNotificationService.markAsRead('00000000-0000-0000-0000-000000000000', 'tech-uuid-1111')
    ).rejects.toThrow('Notification not found.');
  });

  it('11. should prevent duplicate notifications for duplicate delivery of the same assignment event', async () => {
    // Deliver event 1
    const n1 = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    // Worker retry / delivery duplication
    const n2 = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    expect(n1?.id).toBe(n2?.id);
    const list = await technicianNotificationService.getNotifications('tech-uuid-1111', { page: 1, limit: 10 });
    expect(list.notifications).toHaveLength(1);
  });

  it('12. should allow legitimate sequential schedule change notifications', async () => {
    // Schedule change 1: to 4:00 PM
    const n1 = await technicianNotificationService.notifyScheduleChange({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      newDate: '2026-10-01',
      newTimeSlot: '04:00 PM',
    });

    // Schedule change 2: to 5:00 PM
    const n2 = await technicianNotificationService.notifyScheduleChange({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      newDate: '2026-10-01',
      newTimeSlot: '05:00 PM',
    });

    expect(n1?.id).not.toBe(n2?.id);
    const list = await technicianNotificationService.getNotifications('tech-uuid-1111', { page: 1, limit: 10 });
    expect(list.notifications).toHaveLength(2);
  });

  it('13. should verify that current CRM assignment always wins when opening a linked service', async () => {
    // 1. Tech A gets assignment notification for Service A
    const n = await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });

    // 2. Admin reassigns Service A to Tech B in the authoritative CRM
    const svc = memoryServices.find((s) => s.id === 'svc-uuid-001');
    svc.technicianId = 'tech-uuid-2222';

    // 3. Tech A attempts to access Service A using the link
    await expect(
      technicianServicesService.getServiceDetail('svc-uuid-001', 'tech-uuid-1111')
    ).rejects.toThrow(); // Access denied - reassigned

    // 4. Tech B accesses Service A successfully
    const techBService = await technicianServicesService.getServiceDetail('svc-uuid-001', 'tech-uuid-2222');
    expect(techBService.id).toBe('svc-uuid-001');
  });

  it('14. should mark all notifications read at once for authenticated technician', async () => {
    await technicianNotificationService.notifyAssignment({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
    });
    await technicianNotificationService.notifyJobUpdate({
      technicianId: 'tech-uuid-1111',
      serviceId: 'svc-uuid-001',
      serviceNumber: 'SRV-2026-001',
      updateType: 'IN_PROGRESS',
    });

    const before = await technicianNotificationService.getUnreadCount('tech-uuid-1111');
    expect(before.unreadCount).toBe(2);

    await technicianNotificationService.markAllAsRead('tech-uuid-1111');

    const after = await technicianNotificationService.getUnreadCount('tech-uuid-1111');
    expect(after.unreadCount).toBe(0);
  });

  it('15. should bridge domainEventBus events through technicianNotificationAdapter', async () => {
    // Ensure subscriptions active
    technicianNotificationAdapter.initializeSubscriptions();

    // Emit domain event
    await domainEventBus.publish('SERVICE_ASSIGNED', 'SERVICE', 'svc-uuid-bus-01', {
      serviceNumber: 'SRV-BUS-01',
      technicianId: 'tech-uuid-1111',
      scheduledDate: new Date('2026-10-05T10:00:00Z'),
      scheduledTimeSlot: '11:00 AM',
      priority: 'URGENT',
    });

    const list = await technicianNotificationService.getNotifications('tech-uuid-1111', { page: 1, limit: 10 });
    const match = list.notifications.find((n) => n.referenceId === 'svc-uuid-bus-01');

    expect(match).toBeDefined();
    expect(match?.type).toBe('NEW_ASSIGNMENT');
    expect(match?.title).toBe('New Service Assigned');
    expect(match?.message).toContain('SRV-BUS-01');
  });
});
