import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarPlus,
  Clock,
  XCircle,
  RefreshCw,
  FileText,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  RotateCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import type {
  TechnicianPortalNotificationItem,
  TechnicianNotificationListResponse,
  TechnicianNotificationType,
} from '@crm/types';

export const TechnicianNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<TechnicianPortalNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParam = filterTab === 'unread' ? '?isRead=false' : '';
      const response = await apiClient.get<TechnicianNotificationListResponse>(
        `/technician/me/notifications${queryParam}`
      );
      if (response && response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [filterTab]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notification: TechnicianPortalNotificationItem) => {
    if (notification.isRead) {
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
      return;
    }

    // Optimistically update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await apiClient.post(`/technician/me/notifications/${notification.id}/read`, {});
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);

    // Optimistically mark all read
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await apiClient.post('/technician/me/notifications/read-all', {});
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      // Revert on failure
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  // Group notifications into Today vs Earlier
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayNotifications = notifications.filter((n) => {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const earlierNotifications = notifications.filter((n) => {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  });

  const renderNotificationCard = (item: TechnicianPortalNotificationItem) => {
    const typeConfig: Record<
      string,
      {
        icon: React.ComponentType<{ className?: string }>;
        badgeBg: string;
        badgeText: string;
        border: string;
        iconWrapper: string;
      }
    > = {
      NEW_ASSIGNMENT: {
        icon: CalendarPlus,
        badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
        badgeText: 'New Assignment',
        border: 'border-sky-200',
        iconWrapper: 'bg-sky-50 text-primary-600 border border-sky-200',
      },
      SCHEDULE_CHANGE: {
        icon: Clock,
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeText: 'Schedule Change',
        border: 'border-amber-200',
        iconWrapper: 'bg-amber-50 text-amber-700 border border-amber-200',
      },
      CANCELLATION: {
        icon: XCircle,
        badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
        badgeText: 'Cancelled',
        border: 'border-rose-200',
        iconWrapper: 'bg-rose-50 text-rose-700 border border-rose-200',
      },
      REASSIGNMENT: {
        icon: RefreshCw,
        badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
        badgeText: 'Reassigned',
        border: 'border-purple-200',
        iconWrapper: 'bg-purple-50 text-purple-700 border border-purple-200',
      },
      JOB_UPDATE: {
        icon: FileText,
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeText: 'Job Update',
        border: 'border-emerald-200',
        iconWrapper: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      },
    };

    const config = typeConfig[item.type] || {
      icon: Bell,
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-200/90',
      badgeText: 'Notice',
      border: 'border-slate-200/90',
      iconWrapper: 'bg-slate-100 text-slate-700 border border-slate-200/90',
    };

    const Icon = config.icon;
    const dateFormatted = new Date(item.createdAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        key={item.id}
        onClick={() => handleMarkAsRead(item)}
        className={`relative group p-4 rounded-card border transition-all duration-150 cursor-pointer ${
          item.isRead
            ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:bg-slate-50/50'
            : 'bg-white border-2 border-primary-500/40 shadow-xs hover:border-primary-500/70'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Visual Icon Badge */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconWrapper}`}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Notification Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${config.badgeBg}`}
                >
                  {config.badgeText}
                </span>
                {!item.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-400">{dateFormatted}</span>
            </div>

            <h3
              className={`text-sm font-semibold truncate ${
                item.isRead ? 'text-slate-800' : 'text-slate-900 font-bold'
              }`}
            >
              {item.title}
            </h3>

            <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words">
              {item.message}
            </p>

            {item.actionUrl && (
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
                <span>View Assigned Work</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Operational updates for your assigned services, schedule changes, and jobs.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5 text-primary-600" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* 2. Filter Navigation Pills */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'all'
              ? 'bg-white text-primary-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterTab('unread')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterTab === 'unread'
              ? 'bg-white text-primary-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filterTab === 'unread' ? 'bg-primary-50 text-primary-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Notification Stream */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-card border border-slate-200/90 shadow-2xs" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-card bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-10 rounded-card bg-white border border-slate-200/90 shadow-2xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">You're all caught up!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filterTab === 'unread'
              ? 'No unread notifications. Check the "All" tab to view recent history.'
              : 'You have no notifications right now. Operational updates will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today Group */}
          {todayNotifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Today
              </h2>
              <div className="space-y-2.5">
                {todayNotifications.map(renderNotificationCard)}
              </div>
            </div>
          )}

          {/* Earlier Group */}
          {earlierNotifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Earlier
              </h2>
              <div className="space-y-2.5">
                {earlierNotifications.map(renderNotificationCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
