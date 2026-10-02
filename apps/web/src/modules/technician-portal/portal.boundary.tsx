import React from 'react';
import { TECHNICIAN_PORTAL_ROUTE_PREFIX } from '@crm/shared';

/**
 * Technician Portal Isolation Boundary Placeholder
 * Phase 0: Scaffolding Boundary
 * Actual UI components (Login, Profile, Assigned Services, Execution, Payments)
 * will be implemented in subsequent authorized phases.
 */
export const TechnicianPortalBoundary: React.FC = () => {
  return (
    <div className="min-h-screen bg-workspace text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-card shadow-2xs p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto border border-primary-200">
          <span className="text-2xl font-bold">TP</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Technician Portal</h1>
        <p className="text-sm text-slate-500">
          Isolated namespace mounted at <code className="text-primary-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/90">{TECHNICIAN_PORTAL_ROUTE_PREFIX}</code>.
          Phase 0 preparation verified.
        </p>
      </div>
    </div>
  );
};
