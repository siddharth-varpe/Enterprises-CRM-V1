import React, { useState, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import {
  Wrench,
  Briefcase,
  ListTodo,
  CheckCircle2,
  User,
  Bell,
  MapPinOff,
  ShieldAlert,
  AlertTriangle,
  Compass,
  Lock,
} from 'lucide-react';
import {
  TECHNICIAN_PORTAL_ROUTE_PREFIX,
  TECHNICIAN_SERVICES_ROUTE,
  TECHNICIAN_COMPLETED_ROUTE,
  TECHNICIAN_PROFILE_ROUTE,
  TECHNICIAN_NOTIFICATIONS_ROUTE,
} from '@crm/shared';
import { apiClient } from '../../../lib/api-client';
import { CRM_OFFICIAL_LOGO_B64 } from '../../../assets/invoiceAssets';
import { TechnicianBottomNav } from './TechnicianBottomNav';
import { TechnicianTrackingProvider, useTechnicianTracking } from '../hooks/useTechnicianTracking';
import { useTechnicianAuth } from '../guards/TechnicianAuthGuard';

const TechnicianPortalLayoutContent: React.FC = () => {
  const { technician } = useTechnicianAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const tracking = useTechnicianTracking();

  useEffect(() => {
    let mounted = true;
    const fetchUnreadCount = async () => {
      try {
        const res = await apiClient.get<{ unreadCount: number }>(
          '/technician/me/notifications/unread-count'
        );
        if (mounted && res?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      } catch {}
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-workspace text-slate-900 flex flex-col font-sans selection:bg-primary-500 selection:text-white">
      {/* Super Admin Bypass Banner */}
      {(technician?.isSuperAdmin || technician?.role === 'Super Admin') && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-medium border-b border-amber-600 shadow-2xs z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-slate-950 text-amber-300 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded tracking-wider">
                Bypass Mode
              </span>
              <span className="font-semibold text-slate-950 text-xs">
                Super Admin Access Active: {technician.fullName}
              </span>
            </div>
            <Link
              to="/"
              className="text-[11px] font-bold text-slate-950 underline hover:text-white transition-colors"
            >
              Return to CRM Dashboard →
            </Link>
          </div>
        </div>
      )}

      {/* 1. Header (Mobile & Desktop) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Portal Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-2xs border border-slate-200/90">
              <img
                src={CRM_OFFICIAL_LOGO_B64}
                alt="Enterprises CRM Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 uppercase">
                  Enterprises CRM
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Technician Workspace</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <NavLink
              to={TECHNICIAN_PORTAL_ROUTE_PREFIX}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <div className="flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>My Work</span>
              </div>
            </NavLink>

            <NavLink
              to={TECHNICIAN_SERVICES_ROUTE}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <div className="flex items-center space-x-1.5">
                <ListTodo className="w-3.5 h-3.5" />
                <span>Assigned</span>
              </div>
            </NavLink>

            <NavLink
              to={TECHNICIAN_NOTIFICATIONS_ROUTE}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <div className="flex items-center space-x-1.5">
                <Bell className="w-3.5 h-3.5" />
                <span>Alerts</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
            </NavLink>

            <NavLink
              to={TECHNICIAN_PROFILE_ROUTE}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`
              }
            >
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </div>
            </NavLink>
          </nav>

          {/* Right Section: Notification Bell */}
          <div className="flex items-center space-x-2">
            <Link
              to={TECHNICIAN_NOTIFICATIONS_ROUTE}
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary-600 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Geolocation Banners: Section 9 Precise Diagnostics */}
      {/* 1. Insecure Context Banner */}
      {tracking.diagnosticReason === 'INSECURE_CONTEXT' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-rose-950">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950 text-xs sm:text-sm">Secure Connection (HTTPS) Required</p>
                <p className="mt-0.5 text-rose-800 leading-relaxed">
                  Browser security blocks GPS geolocation over unencrypted HTTP ({typeof window !== 'undefined' ? window.location.origin : 'http://...'}). To enable technician location tracking, access the CRM via HTTPS.
                </p>
                {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
                  <p className="mt-1 text-rose-700">
                    Expected URL: <code className="font-mono bg-rose-100 px-1.5 py-0.5 rounded text-rose-900 font-semibold">https://{window.location.host}{window.location.pathname}</code>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
                <a
                  href={`https://${window.location.host}${window.location.pathname}${window.location.search}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Switch to HTTPS
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="px-2.5 py-1.5 text-rose-700 hover:text-rose-900 font-medium hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
              >
                {showDiagnostics ? 'Hide Info' : 'Diagnostics'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Permission Denied Banner */}
      {tracking.diagnosticReason === 'PERMISSION_DENIED' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-amber-950">
              <MapPinOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950 text-xs sm:text-sm">Location Permission Denied</p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  Browser location permission was denied. In Chrome/Brave/Edge, click the site lock/settings icon next to the address bar and set <strong>Location</strong> to <strong>Allow</strong>. In iOS Safari, open Settings &rarr; Safari &rarr; Location.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => tracking.requestPermission()}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="px-2.5 py-1.5 text-amber-700 hover:text-amber-900 font-medium hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
              >
                {showDiagnostics ? 'Hide Info' : 'Diagnostics'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Position Unavailable Banner */}
      {tracking.diagnosticReason === 'POSITION_UNAVAILABLE' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950 text-xs sm:text-sm">Device GPS Fix Unavailable</p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  Unable to determine device position. Please ensure your device Location/GPS toggle is enabled in system quick settings.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => tracking.requestPermission()}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              Retry GPS Fix
            </button>
          </div>
        </div>
      )}

      {/* 4. Location Prompt Banner (Informational when permission is still prompt) */}
      {tracking.permissionState === 'prompt' && !tracking.isWatching && !tracking.diagnosticReason && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-3 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-sky-950">
              <Compass className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sky-950 text-xs sm:text-sm">Enable Technician Location Tracking</p>
                <p className="mt-0.5 text-sky-800 leading-relaxed">
                  Enable device GPS so dispatch can see real-time transit status and navigate you to assigned customer job sites.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => tracking.requestPermission()}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              Enable Location
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics Drawer (Non-sensitive, no coordinates) */}
      {showDiagnostics && (
        <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-3 sm:px-6 text-xs">
          <div className="max-w-5xl mx-auto space-y-2">
            <div className="flex items-center justify-between font-mono font-bold text-slate-300">
              <span>CONNECTION &amp; GEOLOCATION DIAGNOSTICS</span>
              <button
                type="button"
                onClick={() => setShowDiagnostics(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                Close &times;
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-slate-400 block">Secure Context:</span>
                <span className={tracking.diagnostics.isSecureContext ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {tracking.diagnostics.isSecureContext ? 'YES (Secure Origin)' : 'NO (Insecure Context)'}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-slate-400 block">Protocol &amp; Origin:</span>
                <span className="text-slate-200 truncate block">
                  {tracking.diagnostics.protocol} {typeof window !== 'undefined' ? window.location.host : ''}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-slate-400 block">Permission State:</span>
                <span className="text-slate-200 capitalize">
                  {tracking.permissionState}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded">
                <span className="text-slate-400 block">Backend Push Sync:</span>
                <span className={tracking.diagnostics.lastUpdateReachedBackend ? 'text-emerald-400' : 'text-slate-400'}>
                  {tracking.diagnostics.lastUpdateReachedBackend ? 'Reachable' : 'Pending Fix'}
                </span>
              </div>
            </div>
            {tracking.diagnosticReason && (
              <p className="text-amber-300 text-[11px]">
                Active Diagnostic: <span className="font-semibold">{tracking.diagnosticReason}</span> &mdash; {tracking.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 animate-in fade-in duration-150">
        <Outlet />
      </main>

      {/* 3. Mobile Bottom Touch Navigation */}
      <TechnicianBottomNav />
    </div>
  );
};

export const TechnicianPortalLayout: React.FC = () => {
  return (
    <TechnicianTrackingProvider>
      <TechnicianPortalLayoutContent />
    </TechnicianTrackingProvider>
  );
};
