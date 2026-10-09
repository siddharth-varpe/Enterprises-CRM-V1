import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Shield,
  Briefcase,
  LogOut,
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
  const tech: any = profileData?.technician || {
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
    address: 'Service Operations Hub',
    emergencyContact: 'Registered on file',
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
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Technician Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Official employee credentials and field operational record.
        </p>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Classic Identity Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-bold tracking-wider shadow-sm border-2 border-slate-200 shrink-0">
            {getInitials(tech.fullName || tech.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {tech.fullName || tech.name}
              </h2>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {tech.technicianId || 'TECH-004'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  tech.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : tech.status === 'ON_LEAVE'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
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
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Field Service Technician • Technical Operations
            </p>
          </div>
        </div>

        {/* Structured Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <Phone className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Contact Phone
              </span>
              {tech.phone ? (
                <a
                  href={`tel:${tech.phone}`}
                  className="text-xs font-semibold text-slate-800 hover:text-primary-600 transition-colors"
                >
                  {tech.phone}
                </a>
              ) : (
                <span className="text-xs text-slate-400">Not recorded</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <Mail className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Email Address
              </span>
              {tech.email ? (
                <a
                  href={`mailto:${tech.email}`}
                  className="text-xs font-semibold text-slate-800 hover:text-primary-600 transition-colors truncate block"
                >
                  {tech.email}
                </a>
              ) : (
                <span className="text-xs text-slate-400">Not registered</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Base Location
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {tech.address || 'Service Operations Hub'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <Shield className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Emergency Contact
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {tech.emergencyContact || 'Registered on file'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Skills & Competencies */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Award className="w-4 h-4 text-slate-500" />
          <span>Skills & Competencies</span>
        </h2>

        {tech.skills && tech.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {tech.skills.map((skill: string, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-800 border border-slate-200"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No verified skills recorded on roster.</p>
        )}
      </div>

      {/* 4. Personal Work Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-500" />
            <span>Personal Work Summary</span>
          </h2>
          <span className="text-[11px] text-slate-400">All-Time Performance</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-slate-900">{summary.assigned}</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">Assigned</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-slate-900">{summary.inProgress}</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">In Progress</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-slate-900">{summary.completed}</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">Completed</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-slate-900">{summary.completionRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">Success Rate</div>
          </div>
        </div>
      </div>

      {/* 5. Account Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <button
          type="button"
          onClick={logout}
          className="w-full py-2.5 px-4 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout Technician Session</span>
        </button>
      </div>
    </div>
  );
};
