import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  AlertTriangle,
  RotateCw,
  Inbox,
  Wrench,
  Layers,
  Navigation,
  FileText,
  Map,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useTechnicianTracking } from '../hooks/useTechnicianTracking';
import type { TechnicianAssignedService, TechnicianServiceViewTab } from '@crm/types';

export const TechnicianServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const tracking = useTechnicianTracking();
  const [filterTab, setFilterTab] = useState<TechnicianServiceViewTab>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [servicesList, setServicesList] = useState<TechnicianAssignedService[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [navigatingServiceId, setNavigatingServiceId] = useState<string | null>(null);
  const [currentNavigatedJobId, setCurrentNavigatedJobId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('technician_current_job_id') : null;
  });

  const handleNavigate = async (service: TechnicianAssignedService) => {
    const serviceId = service.serviceId || service.id;
    if (!serviceId) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('technician_current_job_id', serviceId);
      localStorage.setItem('technician_current_job_data', JSON.stringify(service));
    }
    setCurrentNavigatedJobId(serviceId);
    setNavigatingServiceId(serviceId);

    try {
      const res = await tracking.navigate(serviceId);
      if (!res?.success && !res?.conflict) {
        // Fallback to opening Google Maps with formatted address if coordinates/backend failed
        const formattedAddress = [
          service.serviceAddress,
          (service as any).addressLine2,
          service.landmark,
          service.city,
          (service as any).state,
          service.pincode,
        ]
          .filter(Boolean)
          .filter((p) => p !== 'Main Service Location')
          .join(', ') || service.customerName || 'Service Location';

        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`;
        if (typeof window !== 'undefined' && window.open) {
          window.open(mapsUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } finally {
      setNavigatingServiceId(null);
    }
  };

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<TechnicianAssignedService[]>(
        `/technician/me/services?view=${filterTab}`
      );
      if (response && response.data) {
        setServicesList(response.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load assigned services.');
    } finally {
      setIsLoading(false);
    }
  }, [filterTab]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Sort with newly assigned / created job at top, then apply search filtering
  const sortedAndFilteredList = [...servicesList]
    .sort((a, b) => {
      const timeA = new Date((a as any).createdAt || a.scheduledDate || 0).getTime();
      const timeB = new Date((b as any).createdAt || b.scheduledDate || 0).getTime();
      return timeB - timeA;
    })
    .filter((service) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        service.serviceNumber?.toLowerCase().includes(q) ||
        service.customerName?.toLowerCase().includes(q) ||
        service.serviceAddress?.toLowerCase().includes(q) ||
        service.city?.toLowerCase().includes(q) ||
        service.productName?.toLowerCase().includes(q) ||
        service.serviceType?.toLowerCase().includes(q)
      );
    });

  // Helper to parse scheduled time
  const parseJobTime = (slot?: string | null, dateVal?: string | Date | null) => {
    if (slot) {
      const match = slot.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/i);
      if (match) {
        return {
          time: match[1],
          period: (match[2] || 'AM').toUpperCase(),
        };
      }
    }
    if (dateVal) {
      try {
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const formatted = d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          const parts = formatted.split(' ');
          return {
            time: parts[0] || '10:00',
            period: (parts[1] || 'AM').toUpperCase(),
          };
        }
      } catch {}
    }
    return { time: '10:00', period: 'AM' };
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-4">
      {/* 1. Header matching Reference */}
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span>Assigned Services</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Your assigned work for today
        </p>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchServices}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 font-medium text-[11px] transition-colors cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Work-Status Segmented Filter Pills matching Reference */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar">
        {/* Today's Jobs Pill (Primary in Reference) */}
        <button
          type="button"
          onClick={() => setFilterTab('today')}
          className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'today'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <span>Today's Jobs</span>
          <span className="sr-only">Today's Services</span>
        </button>

        {/* Upcoming Pill */}
        <button
          type="button"
          onClick={() => setFilterTab('upcoming')}
          className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'upcoming'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          Upcoming
        </button>

        {/* In Progress Pill */}
        <button
          type="button"
          onClick={() => setFilterTab('in_progress')}
          className={`flex-1 min-w-[95px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'in_progress'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          In Progress
        </button>

        {/* All Work Pill */}
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'all'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          All Work
        </button>

        {/* On Hold Pill */}
        <button
          type="button"
          onClick={() => setFilterTab('on_hold')}
          className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'on_hold'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          On Hold
        </button>

        {/* Completed Pill */}
        <button
          type="button"
          onClick={() => setFilterTab('completed')}
          className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
            filterTab === 'completed'
              ? 'bg-primary-600 text-white shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          Completed
        </button>

        {/* Map View Pill (Direct link to Active Navigation Screen 3) */}
        <button
          type="button"
          onClick={() => navigate('/technician/navigation')}
          className="flex-1 min-w-[75px] py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-primary-700 hover:bg-slate-200/50 transition-all cursor-pointer text-center flex items-center justify-center gap-1 whitespace-nowrap"
        >
          <Map className="w-3.5 h-3.5" />
          <span>Map</span>
        </button>
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search by customer, WO number, address, or equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-2xs transition-colors"
        />
      </div>

      {/* 4. Assignment Cards List matching Reference */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 animate-pulse space-y-3 shadow-2xs"
            >
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-5 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sortedAndFilteredList.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-2xs">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            {filterTab === 'today'
              ? 'No Services Scheduled for Today'
              : filterTab === 'upcoming'
              ? 'No Upcoming Services Found'
              : filterTab === 'in_progress'
              ? 'No Jobs Currently In Progress'
              : filterTab === 'on_hold'
              ? 'No Jobs On Hold'
              : filterTab === 'completed'
              ? 'No Completed Services Found'
              : 'No Assigned Services'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No work orders matched your search criteria. Try a different query.'
              : 'New assignments dispatched by the CRM administrator will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAndFilteredList.map((service) => {
            const serviceId = service.serviceId || service.id;
            const { time, period } = parseJobTime(service.scheduledTimeSlot, service.scheduledDate);
            const isServiceCompleted =
              service.status === 'COMPLETED' ||
              (service as any).jobCardStatus === 'COMPLETED' ||
              (service as any).jobCardStatus === 'CUSTOMER_CONFIRMED' ||
              (service as any).jobCardStatus === 'CLOSED';

            const formattedAddress = [
              service.serviceAddress,
              (service as any).addressLine2,
              service.landmark,
              service.city,
              (service as any).state,
              service.pincode,
            ]
              .filter(Boolean)
              .filter((p) => p !== 'Main Service Location')
              .join(', ') || 'Service Location';

            const isCurrentActive =
              currentNavigatedJobId === serviceId || tracking.activeServiceId === serviceId;

            return (
              <div
                key={serviceId}
                className="bg-white hover:border-slate-300 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs transition-all space-y-3 group"
              >
                {/* Main Content Area: Split Time Box on Left, Details on Right */}
                <div className="flex items-start gap-3">
                  {/* Left Time Box matching Reference */}
                  <div className="bg-sky-50/70 border border-sky-100/90 rounded-xl px-2.5 py-3 text-center flex flex-col items-center justify-center min-w-[68px] shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                      {time}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                      {period}
                    </span>
                  </div>

                  {/* Right Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Top Row: Service Number + Priority + Status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold text-blue-700 bg-sky-50 border border-blue-200 px-1.5 py-0.2 rounded">
                        {service.serviceNumber}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                          service.priority === 'URGENT'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : service.priority === 'HIGH'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {service.priority}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                          service.status === 'ON_HOLD' || (service as any).jobCardStatus === 'ON_HOLD'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : service.status === 'IN_PROGRESS'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : isServiceCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {service.status === 'ON_HOLD' || (service as any).jobCardStatus === 'ON_HOLD'
                          ? 'ON HOLD'
                          : isServiceCompleted
                          ? 'COMPLETED'
                          : service.status?.replace('_', ' ') || 'Assigned'}
                      </span>
                    </div>

                    {/* Customer Name & Link */}
                    <Link
                      to={`/technician/services/${serviceId}`}
                      className="flex items-center justify-between group-hover:text-primary-700 transition-colors"
                    >
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary-700 transition-colors truncate">
                        {service.customerName}
                      </h2>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 shrink-0 ml-1 transition-transform group-hover:translate-x-0.5" />
                    </Link>

                    {/* Service Type */}
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-tight">
                      {service.serviceType?.replace('_', ' ')}
                    </p>

                    {/* Address Preview */}
                    <div className="flex items-start gap-1.5 text-xs text-slate-500 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{formattedAddress}</span>
                    </div>

                    {/* Asset Preview */}
                    {service.productName && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Asset: {service.productName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Buttons matching Reference */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <Link
                    to={`/technician/services/${serviceId}`}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer text-center"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Job Card</span>
                    <span className="sr-only">VIEW SERVICE</span>
                  </Link>

                  {!isServiceCompleted ? (
                    <button
                      type="button"
                      disabled={navigatingServiceId === serviceId}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNavigate(service);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer ${
                        isCurrentActive
                          ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white ring-2 ring-amber-300'
                          : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white'
                      } ${navigatingServiceId === serviceId ? 'opacity-75 cursor-wait' : ''}`}
                      title="Start Navigation & Live Tracking"
                    >
                      {navigatingServiceId === serviceId ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {navigatingServiceId === serviceId
                          ? 'Starting...'
                          : isCurrentActive
                          ? 'Navigating'
                          : 'Navigate'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                      Completed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Modal: Switch Active Destination */}
      {tracking.conflictModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Switch Active Destination?</h4>
                <p className="text-xs text-slate-500">Only one active navigation is permitted at a time.</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              You are currently navigating to <strong>{tracking.conflictModal.activeServiceNumber}</strong>. Switching destination will clear tracking for that service and start navigation for this service.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => tracking.dismissConflictModal()}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = tracking.conflictModal?.pendingServiceId;
                  tracking.dismissConflictModal();
                  if (pending) {
                    tracking.navigate(pending, true);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors cursor-pointer"
              >
                Switch & Navigate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
