import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  ListTodo,
  User,
  Bell,
} from 'lucide-react';
import {
  TECHNICIAN_PORTAL_ROUTE_PREFIX,
  TECHNICIAN_SERVICES_ROUTE,
  TECHNICIAN_PROFILE_ROUTE,
  TECHNICIAN_NOTIFICATIONS_ROUTE,
} from '@crm/shared';
import { apiClient } from '../../../lib/api-client';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  hasBadge?: boolean;
}

const navItems: NavItem[] = [
  {
    to: TECHNICIAN_PORTAL_ROUTE_PREFIX,
    label: 'My Work',
    icon: Home,
    end: true,
  },
  {
    to: TECHNICIAN_SERVICES_ROUTE,
    label: 'Assigned',
    icon: ListTodo,
  },
  {
    to: TECHNICIAN_NOTIFICATIONS_ROUTE,
    label: 'Alerts',
    icon: Bell,
    hasBadge: true,
  },
  {
    to: TECHNICIAN_PROFILE_ROUTE,
    label: 'Profile',
    icon: User,
  },
];

export const TechnicianBottomNav: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await apiClient.get<{ unreadCount: number }>(
          '/technician/me/notifications/unread-count'
        );
        if (mounted && res?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      } catch {}
    };

    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <nav
      aria-label="Technician Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-elevated px-2 py-1 select-none safe-area-bottom"
    >
      <div className="grid grid-cols-4 h-14 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-full py-1 px-1 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'text-primary-600 font-semibold scale-105'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`relative p-1 rounded-lg transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-600' : 'bg-transparent text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.hasBadge && unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] leading-tight mt-0.5 tracking-tight">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
