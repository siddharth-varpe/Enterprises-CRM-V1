import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  ListTodo,
  CheckCircle2,
  User,
  Bell,
} from 'lucide-react';
import {
  TECHNICIAN_PORTAL_ROUTE_PREFIX,
  TECHNICIAN_SERVICES_ROUTE,
  TECHNICIAN_COMPLETED_ROUTE,
  TECHNICIAN_PROFILE_ROUTE,
  TECHNICIAN_NOTIFICATIONS_ROUTE,
} from '@crm/shared';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const navItems: NavItem[] = [
  {
    to: TECHNICIAN_PORTAL_ROUTE_PREFIX,
    label: 'My Work',
    icon: Briefcase,
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
  },
  {
    to: TECHNICIAN_COMPLETED_ROUTE,
    label: 'Done',
    icon: CheckCircle2,
  },
  {
    to: TECHNICIAN_PROFILE_ROUTE,
    label: 'Profile',
    icon: User,
  },
];

export const TechnicianBottomNav: React.FC = () => {
  return (
    <nav
      aria-label="Technician Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-elevated px-2 py-1 select-none safe-area-bottom"
    >
      <div className="grid grid-cols-5 h-14 items-center">
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
                    className={`p-1 rounded-lg transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-600' : 'bg-transparent text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
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
