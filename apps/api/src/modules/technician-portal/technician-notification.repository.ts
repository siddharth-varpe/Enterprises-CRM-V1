import { eq, and, desc, sql, count } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../database/client';
import { technicianPortalNotifications } from '../../database/schema/technician-portal';
import type { TechnicianPortalNotification } from '@crm/types';
import type { TechnicianNotificationQueryInput } from '@crm/validation';

/**
 * In-memory fallback & mock store for testing and offline execution
 */
export const memoryTechnicianNotifications: TechnicianPortalNotification[] = [];

export interface CreateNotificationParams {
  technicianId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  dedupKey?: string | null;
}

export class TechnicianNotificationRepository {
  /**
   * Find notification by ID
   */
  async findById(id: string, database = db): Promise<TechnicianPortalNotification | null> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const [row] = await database
          .select()
          .from(technicianPortalNotifications)
          .where(eq(technicianPortalNotifications.id, id))
          .limit(1);
        if (row) return row as TechnicianPortalNotification;
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.findById] DB query notice, using memory fallback:', err?.message);
    }

    const mem = memoryTechnicianNotifications.find((n) => n.id === id);
    return mem || null;
  }

  /**
   * Find notification by deterministic deduplication key
   */
  async findByDedupKey(
    technicianId: string,
    dedupKey: string,
    database = db
  ): Promise<TechnicianPortalNotification | null> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(technicianId);
      if (isUuid) {
        const [row] = await database
          .select()
          .from(technicianPortalNotifications)
          .where(
            and(
              eq(technicianPortalNotifications.technicianId, technicianId),
              eq(technicianPortalNotifications.dedupKey, dedupKey)
            )
          )
          .limit(1);
        if (row) return row as TechnicianPortalNotification;
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.findByDedupKey] DB query notice, using memory fallback:', err?.message);
    }

    const mem = memoryTechnicianNotifications.find(
      (n) => n.technicianId === technicianId && n.dedupKey === dedupKey
    );
    return mem || null;
  }

  /**
   * Find paginated notifications scoped strictly to technician
   */
  async findByTechnicianId(
    technicianId: string,
    filters: TechnicianNotificationQueryInput,
    database = db
  ): Promise<{
    items: TechnicianPortalNotification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(technicianId);
      if (isUuid) {
        const conditions = [eq(technicianPortalNotifications.technicianId, technicianId)];

        if (filters.isRead !== undefined) {
          conditions.push(eq(technicianPortalNotifications.isRead, Boolean(filters.isRead)));
        }
        if (filters.type) {
          conditions.push(eq(technicianPortalNotifications.type, filters.type));
        }

        const whereClause = and(...conditions);

        // Fetch paginated items
        const rows = await database
          .select()
          .from(technicianPortalNotifications)
          .where(whereClause)
          .orderBy(desc(technicianPortalNotifications.createdAt))
          .limit(limit)
          .offset(offset);

        // Fetch total count matching filters
        const [countRow] = await database
          .select({ count: count() })
          .from(technicianPortalNotifications)
          .where(whereClause);
        const total = Number(countRow?.count || 0);

        // Fetch total unread count for technician
        const [unreadRow] = await database
          .select({ count: count() })
          .from(technicianPortalNotifications)
          .where(
            and(
              eq(technicianPortalNotifications.technicianId, technicianId),
              eq(technicianPortalNotifications.isRead, false)
            )
          );
        const unreadCount = Number(unreadRow?.count || 0);

        if (rows && rows.length > 0) {
          return {
            items: rows as TechnicianPortalNotification[],
            total,
            unreadCount,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          };
        }
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.findByTechnicianId] DB query notice, using memory fallback:', err?.message);
    }

    // Memory store fallback
    const techItems = memoryTechnicianNotifications.filter((n) => {
      if (n.technicianId !== technicianId) return false;
      if (filters.isRead !== undefined && n.isRead !== Boolean(filters.isRead)) return false;
      if (filters.type && n.type !== filters.type) return false;
      return true;
    });

    const total = techItems.length;
    const sorted = [...techItems].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    const items = sorted.slice(offset, offset + limit);
    const unreadCount = memoryTechnicianNotifications.filter(
      (n) => n.technicianId === technicianId && !n.isRead
    ).length;

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get unread notification count for technician
   */
  async getUnreadCount(technicianId: string, database = db): Promise<number> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(technicianId);
      if (isUuid) {
        const [row] = await database
          .select({ count: count() })
          .from(technicianPortalNotifications)
          .where(
            and(
              eq(technicianPortalNotifications.technicianId, technicianId),
              eq(technicianPortalNotifications.isRead, false)
            )
          );
        if (row) return Number(row.count || 0);
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.getUnreadCount] DB query notice, using memory fallback:', err?.message);
    }

    return memoryTechnicianNotifications.filter(
      (n) => n.technicianId === technicianId && !n.isRead
    ).length;
  }

  /**
   * Create notification with deduplication protection
   */
  async create(
    params: CreateNotificationParams,
    database = db
  ): Promise<TechnicianPortalNotification> {
    // 1. If dedupKey provided, check if it already exists
    if (params.dedupKey) {
      const existing = await this.findByDedupKey(params.technicianId, params.dedupKey, database);
      if (existing) {
        return existing;
      }
    }

    const notificationId = randomUUID();
    const newRecord: TechnicianPortalNotification = {
      id: notificationId,
      technicianId: params.technicianId,
      type: params.type,
      title: params.title,
      message: params.message,
      referenceType: params.referenceType || null,
      referenceId: params.referenceId || null,
      dedupKey: params.dedupKey || null,
      isRead: false,
      createdAt: new Date(),
      readAt: null,
    };

    let created: any = null;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.technicianId);
      if (isUuid) {
        const [dbRow] = await database
          .insert(technicianPortalNotifications)
          .values({
            id: notificationId,
            technicianId: params.technicianId,
            type: params.type,
            title: params.title,
            message: params.message,
            referenceType: params.referenceType || null,
            referenceId: params.referenceId || null,
            dedupKey: params.dedupKey || null,
            isRead: false,
            createdAt: newRecord.createdAt as Date,
            readAt: null,
          })
          .returning();
        created = dbRow;
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.create] DB insert notice, using memory fallback:', err?.message);
    }

    // Always keep memory store updated
    memoryTechnicianNotifications.unshift(created || newRecord);
    return created || newRecord;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    id: string,
    technicianId: string,
    database = db
  ): Promise<TechnicianPortalNotification | null> {
    const readAt = new Date();
    let updated: any = null;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const [row] = await database
          .update(technicianPortalNotifications)
          .set({
            isRead: true,
            readAt,
          })
          .where(
            and(
              eq(technicianPortalNotifications.id, id),
              eq(technicianPortalNotifications.technicianId, technicianId)
            )
          )
          .returning();
        updated = row;
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.markAsRead] DB update notice, using memory fallback:', err?.message);
    }

    // Update memory mirror
    const mem = memoryTechnicianNotifications.find(
      (n) => n.id === id && n.technicianId === technicianId
    );
    if (mem) {
      mem.isRead = true;
      mem.readAt = readAt;
      if (!updated) updated = mem;
    }

    return updated || null;
  }

  /**
   * Mark all notifications for a technician as read
   */
  async markAllAsRead(technicianId: string, database = db): Promise<number> {
    const readAt = new Date();
    let affectedCount = 0;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(technicianId);
      if (isUuid) {
        const rows = await database
          .update(technicianPortalNotifications)
          .set({
            isRead: true,
            readAt,
          })
          .where(
            and(
              eq(technicianPortalNotifications.technicianId, technicianId),
              eq(technicianPortalNotifications.isRead, false)
            )
          )
          .returning();
        affectedCount = rows.length;
      }
    } catch (err: any) {
      console.warn('[TechnicianNotificationRepository.markAllAsRead] DB update notice, using memory fallback:', err?.message);
    }

    // Update memory mirror
    memoryTechnicianNotifications.forEach((n) => {
      if (n.technicianId === technicianId && !n.isRead) {
        n.isRead = true;
        n.readAt = readAt;
        if (!affectedCount) affectedCount++;
      }
    });

    return affectedCount;
  }
}

export const technicianNotificationRepository = new TechnicianNotificationRepository();
