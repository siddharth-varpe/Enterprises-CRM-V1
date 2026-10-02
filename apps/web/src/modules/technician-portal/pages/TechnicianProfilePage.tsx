import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Shield,
  Clock,
  Briefcase,
  LogOut,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  Wrench,
  Activity,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useTechnicianAuth } from '../guards/TechnicianAuthGuard';
import type { Technician360ResponseData } from '@crm/types';

export const TechnicianProfilePage: React.FC = () => {
  const { technician: authTech, logout } = useTechnicianAuth();
  const [profileData, setProfileData] = useState<Technician360ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Technician360ResponseData>('/technician/me');
      if (response && response.data) {
        setProfileData(response.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load technician profile.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Merge live profile data with authenticated context fallback
  const tech = profileData?.technician || {
    id: authTech?.id || '',
    technicianId: authTech?.technicianId || authTech?.id || '',
    fullName: authTech?.fullName || 'Technician',
    name: authTech?.fullName || 'Technician',
    phone: authTech?.phone || '',
    email: authTech?.email || '',
    status: (authTech as any)?.status || ('ACTIVE' as const),
    availability: 'AVAILABLE' as const,
    skills: (((authTech as any)?.skills as string[]) || []) as string[],
    portalAccess: 'ENABLED' as const,
    portalEnabled: true,
  };

  const summary = profileData?.workSummary || {
    assigned: 0,
    inProgress: 0,
    completed: 0,
    upcoming: 0,
    completionRate: 0,
  };

  const getInitials = (name: string) => {
    if (!name) return 'TP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'TP').toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span>Technician Profile</span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700">
            Technician 360
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Authoritative field roster identity, certified competencies, and personal work summary.
        </p>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-card bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            className="flex items-center gap-1 px-2.5 py-1 rounded-btn bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Identity & Status Card */}
      <div className="bg-white border border-slate-200/90 rounded-card p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-sky-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {getInitials(tech.fullName || tech.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{tech.fullName || tech.name}</h2>
                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-primary-700 border border-slate-200/90">
                  {tech.technicianId || 'TECH-004'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Certified Field Service Specialist</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    tech.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : tech.status === 'ON_LEAVE'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200/90'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      tech.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : tech.status === 'ON_LEAVE'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {tech.status === 'ACTIVE'
                      ? 'Active'
                      : tech.status === 'ON_LEAVE'
                      ? 'On Leave'
                      : 'Inactive'}
                  </span>
                </span>

                {/* Availability Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    tech.availability === 'AVAILABLE'
                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                      : tech.availability === 'BUSY'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200/90'
                  }`}
                >
                  <Activity className="w-3 h-3 text-primary-600" />
                  <span>
                    {tech.availability === 'AVAILABLE'
                      ? 'Available'
                      : tech.availability === 'BUSY'
                      ? 'Job In Progress'
                      : tech.availability === 'ON_LEAVE'
                      ? 'On Leave'
                      : 'Off Duty'}
                  </span>
                </span>

                {/* Portal Access Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    tech.portalAccess === 'ENABLED' || tech.portalEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>
                    {tech.portalAccess === 'ENABLED' || tech.portalEnabled
                      ? 'Portal Enabled'
                      : 'Portal Disabled'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/90">
            <Phone className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Contact Number</div>
              <div className="font-semibold text-slate-800">{tech.phone || 'Not recorded'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/90">
            <Mail className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Email Dispatch</div>
              <div className="font-semibold text-slate-800">{tech.email || 'Not registered'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Personal Work Summary */}
      <div className="bg-white border border-slate-200/90 rounded-card p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary-600" />
            <span>Personal Work Summary</span>
          </h2>
          <span className="text-[11px] text-slate-400">Personal Metrics Only</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Assigned */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-slate-900">{summary.assigned}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Assigned</div>
          </div>

          {/* Current Workload */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-amber-600">{summary.currentWorkload ?? (summary.assigned + summary.inProgress)}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Workload</div>
          </div>

          {/* In Progress */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-amber-600">{summary.inProgress}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">In Progress</div>
          </div>

          {/* Completed */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-emerald-600">{summary.completed}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Completed</div>
          </div>

          {/* Completion Rate */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-primary-600">{summary.completionRate}%</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Rate</div>
          </div>

          {/* Avg Completion Time */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
            <div className="text-xl font-bold text-slate-700">
              {summary.isAverageCompletionTimeReliable ? summary.averageCompletionTimeFormatted : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Avg Time</div>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Overall Completion Progress</span>
            <span className="font-bold text-primary-700">{summary.completionRate}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-sky-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, summary.completionRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Skills & Competencies */}
      <div className="bg-white border border-slate-200/90 rounded-card p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Certified Skills & Competencies</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            {tech.skills?.length || 0} Verified
          </span>
        </div>

        {tech.skills && tech.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tech.skills.map((skill: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200/90 flex items-center gap-1.5 shadow-2xs"
              >
                <Wrench className="w-3.5 h-3.5 text-primary-600" />
                <span>{skill}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No verified skills recorded on roster.</p>
        )}
      </div>

      {/* 5. Session Actions */}
      <div className="bg-white border border-slate-200/90 rounded-card p-4 shadow-2xs">
        <div>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 px-4 rounded-btn bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Technician Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
