import { pgTable, uuid, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { technicians } from './technicians';

/**
 * Technician Portal Access Control Table
 * Phase 0: Isolated Additive Table
 * Strictly additive - Does not alter existing technicians table schema.
 */
export const technicianPortalAccess = pgTable(
  'technician_portal_access',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    technicianId: uuid('technician_id')
      .notNull()
      .unique()
      .references(() => technicians.id, { onDelete: 'cascade' }),
    portalEnabled: boolean('portal_enabled').default(false).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('tech_portal_access_tech_idx').on(table.technicianId),
    index('tech_portal_access_enabled_idx').on(table.portalEnabled),
  ]
);

/**
 * Technician Portal-Scoped Notifications
 * Phase 0: Isolated Additive Table
 */
export const technicianPortalNotifications = pgTable(
  'technician_portal_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    technicianId: uuid('technician_id')
      .notNull()
      .references(() => technicians.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'NEW_ASSIGNMENT' | 'SCHEDULE_CHANGE' | 'CANCELLATION' | 'REASSIGNMENT' | 'JOB_UPDATE'
    title: text('title').notNull(),
    message: text('message').notNull(),
    referenceType: text('reference_type'), // 'SERVICE' | 'JOB_CARD' | 'PAYMENT' | 'GENERAL'
    referenceId: text('reference_id'),
    dedupKey: text('dedup_key'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('tech_portal_notifications_tech_idx').on(table.technicianId),
    index('tech_portal_notifications_unread_idx').on(table.technicianId, table.isRead),
    index('tech_portal_notifications_dedup_idx').on(table.technicianId, table.dedupKey),
  ]
);

/**
 * Technician OTP Challenges (Durable Audit & PostgreSQL Fallback)
 * Primary short-lived storage is Redis; this table provides durable challenge tracking.
 * Phase 0: Isolated Additive Table
 */
export const technicianOtpChallenges = pgTable(
  'technician_otp_challenges',
  {
    challengeId: uuid('challenge_id').defaultRandom().primaryKey(),
    technicianId: uuid('technician_id')
      .notNull()
      .references(() => technicians.id, { onDelete: 'cascade' }),
    otpHash: text('otp_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('tech_otp_challenges_tech_exp_idx').on(table.technicianId, table.expiresAt),
  ]
);
