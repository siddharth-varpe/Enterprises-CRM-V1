import React from 'react';
import { Badge, type BadgeVariant } from './Badge';

export type CRMStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'DRAFT'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'UNPAID'
  | 'OVERDUE'
  | 'CLAIMED'
  | 'EXPIRED'
  | 'ASSIGNED'
  | 'RESOLVED'
  | 'OPEN'
  | 'CLOSED'
  | string;

export interface StatusBadgeProps {
  status: CRMStatus;
  label?: string;
  className?: string;
  dot?: boolean;
}

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Positive / Successful
  ACTIVE: 'success',
  COMPLETED: 'success',
  PAID: 'success',
  RESOLVED: 'success',
  CLAIMED: 'success',

  // Warning / In-Progress / Attention
  PENDING: 'warning',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'warning',
  PARTIALLY_PAID: 'warning',
  ISSUED: 'warning',
  ASSIGNED: 'warning',
  OPEN: 'info',

  // Negative / Terminal / Danger
  CANCELLED: 'danger',
  OVERDUE: 'danger',
  EXPIRED: 'danger',
  SUSPENDED: 'danger',
  UNPAID: 'danger',

  // Neutral / Draft
  DRAFT: 'neutral',
  INACTIVE: 'neutral',
  CLOSED: 'neutral',
};

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  ON_HOLD: 'On Hold',
  ISSUED: 'Not Paid',
  UNPAID: 'Not Paid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
};

const formatStatusLabel = (status: string): string => {
  const upper = status.toUpperCase();
  if (CUSTOM_STATUS_LABELS[upper]) {
    return CUSTOM_STATUS_LABELS[upper];
  }
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className,
  dot = true,
}) => {
  const normalizedKey = status.toUpperCase();
  const variant = STATUS_VARIANT_MAP[normalizedKey] || 'neutral';
  const displayLabel = label || formatStatusLabel(status);

  return (
    <Badge variant={variant} dot={dot} className={className}>
      {displayLabel}
    </Badge>
  );
};
