import React, { useEffect } from 'react';
import { PauseCircle, X, Wrench, User, Calendar, FileText } from 'lucide-react';
import { Button } from './Button';

export interface HoldStatusData {
  serviceNumber?: string | null;
  jobCardNumber?: string | null;
  technicianName?: string | null;
  technicianPhone?: string | null;
  customerName?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
}

export interface HoldStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HoldStatusData | null;
}

/**
 * Extracts the explicit hold reason from notes if formatted as "[Hold reason]: <text>",
 * otherwise returns the cleaned notes or a friendly fallback.
 */
export function extractHoldReason(notes?: string | null): { reason: string; fullNotes: string | null } {
  if (!notes || !notes.trim()) {
    return {
      reason: 'No detailed reason provided when placed on hold.',
      fullNotes: null,
    };
  }

  const match = notes.match(/\[?Hold reason\]?:\s*([^\n\r]+)/i);
  if (match && match[1] && match[1].trim()) {
    const reason = match[1].trim();
    // Check if there are other lines in notes
    const remaining = notes
      .split('\n')
      .filter((line) => !line.match(/\[?Hold reason\]?:/i) && line.trim())
      .join('\n')
      .trim();

    return {
      reason,
      fullNotes: remaining.length > 0 ? remaining : null,
    };
  }

  return {
    reason: notes.trim(),
    fullNotes: null,
  };
}

export const HoldStatusModal: React.FC<HoldStatusModalProps> = ({ isOpen, onClose, data }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const { reason, fullNotes } = extractHoldReason(data.notes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-status-modal-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-amber-200/80 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 px-5 py-4 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
              <PauseCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="hold-status-modal-title" className="text-base font-bold text-slate-900">
                  Service On Hold
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ON HOLD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.serviceNumber || 'Service'}
                {data.jobCardNumber ? ` • Job Card ${data.jobCardNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Reason Card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span>Hold Status Note</span>
            </div>
            <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
              {reason}
            </p>
            {fullNotes && (
              <div className="mt-3 pt-3 border-t border-amber-200/60 text-xs text-slate-600 space-y-1">
                <span className="font-semibold text-slate-700">Additional Notes:</span>
                <p className="whitespace-pre-wrap text-slate-600">{fullNotes}</p>
              </div>
            )}
          </div>

          {/* Context Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {data.customerName && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Customer</div>
                  <div className="font-medium text-slate-800 truncate">{data.customerName}</div>
                </div>
              </div>
            )}

            {data.technicianName && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                <Wrench className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Technician</div>
                  <div className="font-medium text-slate-800 truncate">
                    {data.technicianName}
                    {data.technicianPhone ? ` (${data.technicianPhone})` : ''}
                  </div>
                </div>
              </div>
            )}

            {data.updatedAt && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2 col-span-full">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Last Updated</div>
                  <div className="font-medium text-slate-700">
                    {new Date(data.updatedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 px-4 border-slate-200 hover:bg-slate-100 text-slate-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
