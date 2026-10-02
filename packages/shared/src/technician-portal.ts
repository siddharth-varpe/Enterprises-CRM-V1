/**
 * SR Enterprises CRM - Technician Portal Shared Constants & Namespace Definitions
 * Phase 0: Isolated Preparation Boundary
 * Strictly additive - No existing CRM behavior is modified.
 */

// Route Namespaces
export const TECHNICIAN_PORTAL_ROUTE_PREFIX = '/technician';
export const TECHNICIAN_AUTH_ROUTE = '/technician/login';
export const TECHNICIAN_PROFILE_ROUTE = '/technician/profile';
export const TECHNICIAN_SERVICES_ROUTE = '/technician/services';
export const TECHNICIAN_COMPLETED_ROUTE = '/technician/completed-services';
export const TECHNICIAN_NOTIFICATIONS_ROUTE = '/technician/notifications';

// API Namespaces (v1)
export const TECHNICIAN_AUTH_API_PREFIX = '/technician-auth';
export const TECHNICIAN_PORTAL_API_PREFIX = '/technician';

// Cookie & Session Security
export const TECHNICIAN_AUTH_COOKIE_NAME = 'sr_tech_sid';
export const TECHNICIAN_SESSION_TTL_SECONDS = 86400; // 24 hours absolute
export const TECHNICIAN_SESSION_IDLE_SECONDS = 86400; // 24 hours

// Redis Key Namespaces for Complete Isolation
export const TECH_REDIS_KEYS = {
  OTP_CHALLENGE_PREFIX: 'crm:tech_otp:', // crm:tech_otp:<challengeId>
  ACTIVE_CHALLENGE_PREFIX: 'crm:tech_active_otp:', // crm:tech_active_otp:<technicianId> -> challengeId
  RATE_LIMIT_TECH_PREFIX: 'crm:tech_rl:tech:', // crm:tech_rl:tech:<technicianId>
  RATE_LIMIT_IP_PREFIX: 'crm:tech_rl:ip:', // crm:tech_rl:ip:<ipAddress>
  RATE_LIMIT_EMAIL_PREFIX: 'crm:tech_rl:email:', // crm:tech_rl:email:<email>
  SESSION_PREFIX: 'crm:tech_session:', // crm:tech_session:<sessionId>
  USER_SESSIONS_PREFIX: 'crm:tech_user_sessions:', // crm:tech_user_sessions:<technicianId>
} as const;

// Queue Namespaces
export const TECH_QUEUE_NAMES = {
  EMAIL_OTP: 'crm:queue:tech-email-otp',
  ASSIGNMENT_NOTIFICATION: 'crm:queue:tech-assignment-notification',
} as const;

// OTP Concurrency & Security Policy Rules
export const TECHNICIAN_OTP_CONFIG = {
  LENGTH: 6,
  VALIDITY_SECONDS: 300, // 5 minutes
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_SECONDS: 60, // 1 minute before resend
  MAX_REQUESTS_PER_TECH_WINDOW: 5,
  TECH_WINDOW_SECONDS: 900, // 15 minutes
  MAX_REQUESTS_PER_IP_WINDOW: 15,
  IP_WINDOW_SECONDS: 900, // 15 minutes
} as const;

// Technician-Specific Error Codes
export const TECHNICIAN_ERROR_CODES = {
  TECHNICIAN_NOT_FOUND: 'TECHNICIAN_NOT_FOUND',
  PORTAL_ACCESS_DISABLED: 'PORTAL_ACCESS_DISABLED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  OTP_ALREADY_USED: 'OTP_ALREADY_USED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  SERVICE_NOT_ASSIGNED: 'SERVICE_NOT_ASSIGNED',
  JOB_CARD_NOT_ASSIGNED: 'JOB_CARD_NOT_ASSIGNED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYMENT_NOT_ALLOWED: 'PAYMENT_NOT_ALLOWED',
  PAYMENT_AMOUNT_INVALID: 'PAYMENT_AMOUNT_INVALID',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
} as const;

// Portal-Specific Notification Types
export const TECHNICIAN_NOTIFICATION_TYPES = {
  NEW_SERVICE_ASSIGNED: 'NEW_SERVICE_ASSIGNED',
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  SERVICE_CANCELLED: 'SERVICE_CANCELLED',
  SERVICE_REASSIGNED: 'SERVICE_REASSIGNED',
  JOB_UPDATED: 'JOB_UPDATED',
  ADMINISTRATIVE_NOTICE: 'ADMINISTRATIVE_NOTICE',
} as const;
