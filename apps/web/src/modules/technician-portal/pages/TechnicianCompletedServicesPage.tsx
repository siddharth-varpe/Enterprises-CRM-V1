import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Search,
  Wrench,
  Receipt,
  FileCheck,
  Inbox,
  Info,
  ExternalLink,
  ArrowUpRight,
  RotateCw,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import type { TechnicianAssignedService } from '@crm/types';

interface CompletedServiceRecord {
  id: string;
  workOrderNumber: string;
  customerName: string;
  serviceType: string;
  equipmentType: string;
  completedAt: string;
  address: string;
  duration: string;
  paymentStatus: 'collected' | 'billed' | 'amc_covered';
  amount?: string;
}

export const TechnicianCompletedServicesPage: React.FC = () => {
  const [completedServices, setCompletedServices] = useState<TechnicianAssignedService[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCompletedServices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<TechnicianAssignedService[]>('/technician/me/services?view=completed');
      if (res && res.data) {
        setCompletedServices(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load completed services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedServices();
  }, []);

  // Map live completed records from backend
  const liveRecords: CompletedServiceRecord[] = completedServices.map((s) => {
    const formattedAddress = [
      s.serviceAddress,
      (s as any).addressLine2,
      s.landmark,
      s.city,
      (s as any).state,
      s.pincode,
    ]
      .filter(Boolean)
      .filter((p) => p !== 'Main Service Location')
      .join(', ');

    const formattedDate = s.completedAt
      ? new Date(s.completedAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Completed';

    return {
      id: s.serviceId || s.id || '',
      workOrderNumber: s.serviceNumber || 'WO-COMPLETED',
      customerName: s.customerName || 'Customer',
      serviceType: s.serviceType || 'Field Service',
      equipmentType: s.productName ? `Asset: ${s.productName}` : 'Commercial Equipment Unit',
      completedAt: formattedDate,
      address: formattedAddress || 'Service Address on File',
      duration: 'Fulfilled',
      paymentStatus: 'collected',
    };
  });

  const displayedList = liveRecords.filter(
    (s) =>
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Completed Services</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
              Fulfillments
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            History of resolved field work orders, completed tasks, and fulfillment records.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchCompletedServices}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
          title="Refresh Completed Services"
        >
          <RotateCw className={`w-3.5 h-3.5 text-primary-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Architecture Notice */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary-600" />
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-900">Historical Records:</span> Services marked as completed in the field are archived here with customer sign-offs, executed parts, and billing status.
        </div>
      </div>

      {/* 3. Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search completed work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-2xs transition-colors"
          />
        </div>
      </div>

      {/* 4. Completed Records List or Empty State */}
      {isLoading && liveRecords.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200/90 rounded-card p-5 animate-pulse space-y-3 shadow-2xs"
            >
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-5 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-card p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No completed services yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No completed work orders matched your query.'
              : 'Fulfillments and closed work orders will be archived here upon successful completion.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedList.map((record) => (
            <div
              key={record.id}
              className="bg-white border border-slate-200/90 rounded-card p-5 shadow-2xs space-y-3.5"
            >
              {/* Top row: WO number + completion timestamp + duration */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-primary-700 border border-slate-200/90">
                    {record.workOrderNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Completed</span>
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{record.duration}</span>
                </div>
              </div>

              {/* Customer & Asset */}
              <div>
                <h2 className="text-base font-bold text-slate-900">{record.customerName}</h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {record.serviceType}
                </p>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  <span>{record.equipmentType}</span>
                </div>
              </div>

              {/* Completion details & address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fulfilled: {record.completedAt}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{record.address}</span>
                </div>
              </div>

              {/* Payment / Fulfillment Status & Details Link */}
              <div className="pt-2 flex items-center justify-between gap-2 text-xs border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-primary-600" />
                  <span className="text-slate-500">Settlement:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {record.paymentStatus.replace('_', ' ')}
                  </span>
                  {record.amount && (
                    <span className="font-bold text-emerald-700 ml-1">
                      ({record.amount})
                    </span>
                  )}
                </div>

                <Link
                  to={`/technician/services/${record.id}`}
                  className="py-1.5 px-3 rounded-btn bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View Details</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
