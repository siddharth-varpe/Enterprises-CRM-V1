import React, { useState } from 'react';
import {
  Wrench,
  User,
  Phone,
  Calendar,
  ChevronRight,
  UserPlus,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Cpu,
  PauseCircle,
} from 'lucide-react';
import { HoldStatusModal, type HoldStatusData } from '../../../components/ui/HoldStatusModal';
import type { JobCardItem } from '../job-cards.api';

export interface JobCardTableProps {
  jobCards?: JobCardItem[];
  isLoading?: boolean;
  onViewDetail: (id: string) => void;
  onAssignTech: (jobCard: JobCardItem) => void;
  onStartJob?: (id: string) => void;
  onCompleteJob?: (jobCard: JobCardItem) => void;
}

export const JobCardTable: React.FC<JobCardTableProps> = ({
  jobCards = [],
  isLoading,
  onViewDetail,
  onAssignTech,
  onStartJob,
  onCompleteJob,
}) => {
  const [selectedHoldJob, setSelectedHoldJob] = useState<HoldStatusData | null>(null);

  const getStatusBadge = (status: string, jc?: JobCardItem) => {
    switch (status) {
      case 'SCHEDULED':
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Scheduled
          </span>
        );
      case 'ASSIGNED':
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <User className="w-3 h-3 text-blue-500" />
            Assigned
          </span>
        );
      case 'STARTED':
      case 'DIAGNOSIS':
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Play className="w-3 h-3 text-amber-600 fill-amber-600" />
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHoldJob({
                serviceNumber: jc?.serviceNumber,
                jobCardNumber: jc?.jobCardNumber,
                technicianName: jc?.technicianName,
                technicianPhone: jc?.technicianPhone,
                customerName: jc?.customerName,
                notes: jc?.technicianNotes || (jc as any)?.internalNotes || (jc as any)?.notes,
                updatedAt: jc?.updatedAt,
              });
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 transition-all cursor-pointer shadow-xs group"
            title="Click to view hold status note"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
            <span>On Hold</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          </button>
        );
      case 'COMPLETED':
      case 'CUSTOMER_CONFIRMED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 uppercase tracking-wide">Urgent</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">High</span>;
      case 'NORMAL':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase tracking-wide">Normal</span>;
      case 'LOW':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">Low</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100/80 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (jobCards.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
          <Wrench className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">No Job Cards Found</h3>
        <p className="text-sm text-slate-700 mt-1 max-w-sm mx-auto">
          No operational work orders match your selected filters. Try changing filter criteria or create a new job card.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Job Card #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Asset / Machine</th>
              <th className="py-3 px-4">Technician</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Schedule</th>
              <th className="py-3 px-4 text-right">Charges</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {jobCards.map((jc) => {
              const totalAmount = parseFloat(jc.totalCharges || '0');

              return (
                <tr
                  key={jc.id}
                  className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                  onClick={() => onViewDetail(jc.id)}
                >
                  {/* Job Card # + Priority */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {jc.jobCardNumber}
                          {getPriorityBadge(jc.priority)}
                        </div>
                        <div className="text-xs text-slate-700 truncate max-w-[160px]">
                          {jc.problemReported || jc.serviceType || 'General service'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="font-semibold text-slate-900">{jc.customerName}</div>
                      <div className="text-xs text-slate-700 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {jc.customerPhone}
                      </div>
                    </div>
                  </td>

                  {/* Machine / Asset */}
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="font-medium text-slate-900 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        {jc.productName}
                      </div>
                      <div className="text-xs text-slate-700">
                        {jc.serialNumber ? `S/N: ${jc.serialNumber}` : `Asset: ${jc.assetNumber}`}
                      </div>
                    </div>
                  </td>

                  {/* Technician */}
                  <td className="py-3.5 px-4">
                    {jc.technicianName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {jc.technicianName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 text-xs">{jc.technicianName}</div>
                          <div className="text-[11px] text-slate-700">{jc.technicianPhone}</div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignTech(jc);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        Assign Tech
                      </button>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">{getStatusBadge(jc.status, jc)}</td>

                  {/* Scheduled Date */}
                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(jc.scheduledDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    {jc.scheduledTimeSlot && (
                      <div className="text-[11px] text-slate-700 mt-0.5">{jc.scheduledTimeSlot}</div>
                    )}
                  </td>

                  {/* Charges */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-bold text-slate-900">
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {parseFloat(jc.partsCharges || '0') > 0 && (
                      <div className="text-[10px] text-slate-700">
                        Parts: ₹{parseFloat(jc.partsCharges).toLocaleString('en-IN')}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {/* Fast action: Start if assigned */}
                      {(jc.status === 'ASSIGNED' || jc.status === 'SCHEDULED') && onStartJob && (
                        <button
                          type="button"
                          onClick={() => onStartJob(jc.id)}
                          title="Start Work"
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-amber-700" />
                        </button>
                      )}

                      {/* Fast action: Complete if In Progress */}
                      {jc.status === 'IN_PROGRESS' && onCompleteJob && (
                        <button
                          type="button"
                          onClick={() => onCompleteJob(jc)}
                          title="Complete Job"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewDetail(jc.id)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title="View Full Detail"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HoldStatusModal
        isOpen={Boolean(selectedHoldJob)}
        onClose={() => setSelectedHoldJob(null)}
        data={selectedHoldJob}
      />
    </div>
  );
};
