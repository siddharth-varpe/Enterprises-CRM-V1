import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationQueryFilter,
  UnreadNotificationCountResponse,
} from '@crm/types';
import type { UpdateNotificationPreferencesInput } from '@crm/validation';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filter: NotificationQueryFilter) => [...notificationKeys.all, 'list', filter] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

// Empty Fallback Notifications (No seeded dummy data)
const FALLBACK_NOTIFICATIONS: NotificationItem[] = [];

export function useNotificationsQuery(filter: NotificationQueryFilter = {}) {
  return useQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          data: NotificationItem[];
          total: number;
          page: number;
          limit: number;
        }>('/notifications', {
          params: {
            page: filter.page || 1,
            limit: filter.limit || 20,
            isRead: filter.isRead,
            severity: filter.severity,
            notificationType: filter.notificationType,
            entityType: filter.entityType,
            search: filter.search,
          },
        });
        return response.data;
      } catch (err) {
        console.warn('Backend notifications unavailable, using local-first fallback', err);
        return {
          data: FALLBACK_NOTIFICATIONS,
          total: FALLBACK_NOTIFICATIONS.length,
          page: 1,
          limit: 20,
        };
      }
    },
    refetchInterval: 30000, // Poll every 30s in foreground
  });
}

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      try {
        const response = await apiClient.get<UnreadNotificationCountResponse>('/notifications/unread-count');
        return response.data;
      } catch (err) {
        console.warn('Backend notifications count unavailable, using local count', err);
        const unread = FALLBACK_NOTIFICATIONS.filter((n) => !n.isRead).length;
        return {
          unreadCount: unread,
          criticalCount: 0,
          warningCount: 1,
        };
      }
    },
    refetchInterval: 15000, // Frequent badge poll
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/notifications/${id}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notifications/read-all');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => {
      const response = await apiClient.get<NotificationPreferences>('/notifications/preferences');
      return response.data;
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateNotificationPreferencesInput) => {
      const response = await apiClient.put<NotificationPreferences>('/notifications/preferences', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences });
    },
  });
}

export function useSendAdminTestEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetEmail?: string) => {
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        error?: string;
        recipient?: string;
        messageId?: string;
      }>('/notifications/email/test', { targetEmail });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useEmailHistoryQuery(params: { page?: number; limit?: number; status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['notifications', 'email-history', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/notifications/email/history', { params });
      return res.data;
    },
  });
}

export function useTriggerEmailCronMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data?: any }>('/notifications/email/cron');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

