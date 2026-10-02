import React from 'react';
import {
  Repeat,
  Users,
  Package,
  Calendar,
  IndianRupee,
  Wrench,
  Receipt,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { RentalStatusBadge } from './RentalStatusBadge';
import { useRentalDetailQuery, type RentalItem } from '../rentals.api';
import { formatCurrency, formatINR, formatDate } from '../../../lib/formatters';
import { sendRentalWhatsAppReminder } from '../rentals.whatsapp';
import { useToast } from '../../../providers/ToastProvider';

export interface RentalDetailModalProps {
  isOpen: boolean;
  rentalId?: string | null;
  onClose: () => void;
  onRecordPayment?: (rental: RentalItem) => void;
  onReturnMachine?: (rental: RentalItem) => void;
}

export const RentalDetailModal: React.FC<RentalDetailModalProps> = ({
  isOpen,
  rentalId,
  onClose,
  onRecordPayment,
  onReturnMachine,
}) => {
  const toast = useToast();
  const { data: rental, isLoading } = useRentalDetailQuery(rentalId || undefined);

  if (!isOpen) return null;

  const handleWhatsAppReminder = () => {
    if (!rental) return;
    const result = sendRentalWhatsAppReminder(rental);
    if (!result.success) {
      toast.error(result.error || 'Customer phone number is not available.', 'WhatsApp Error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <span>Rental Agreement: {rental?.rentalNumber || 'Details'}</span>
          {rental && <RentalStatusBadge status={rental.rentalStatus} type="rental" />}
        </div>
      }
      description="Authoritative subscription records, product & equipment details, and recurring payment ledger."
    >
      {isLoading || !rental ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Loading rental agreement details...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Quick Stats & WhatsApp Reminder Header */}
          <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Monthly Rent</div>
                <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {formatINR(Number(rental.monthlyRent))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Deposit Held</div>
                <div className="text-base font-extrabold text-teal-800 font-mono mt-0.5">
                  {formatINR(Number(rental.securityDeposit))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Payment Status</div>
                <div className="mt-0.5">
                  <RentalStatusBadge status={rental.paymentStatus} type="payment" />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Next Due Date</div>
                <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                  {new Date(rental.nextDueDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleWhatsAppReminder}
                className="text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Reminder</span>
              </Button>
            </div>
          </div>

          {/* 2. Customer & Machine Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Information */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Users className="w-4 h-4 text-primary-600" />
                <span>Customer Information</span>
              </div>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name:</span>
                  <span className="font-bold text-slate-900">{rental.customer?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer ID:</span>
                  <span className="font-mono text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded border border-primary-200">
                    {rental.customer?.customerNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mobile Phone:</span>
                  <span className="font-mono text-slate-800 font-bold">{rental.customer?.phone}</span>
                </div>
                {rental.customer?.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-800">{rental.customer?.email}</span>
                  </div>
                )}
                {rental.installationAddress && (
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Installation Address:</span>
                    <span className="text-slate-800 text-right max-w-[200px]">{rental.installationAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Machine & Hardware Specifications */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Package className="w-4 h-4 text-purple-600" />
                <span>Rented Product &amp; Equipment Details</span>
              </div>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Product / Model:</span>
                  <span className="font-bold text-slate-900">{rental.machineModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial Number:</span>
                  <span className="font-mono font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                    {rental.serialNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category / Type:</span>
                  <span className="text-slate-800 font-semibold">{rental.machineType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Specifications / Capacity:</span>
                  <span className="text-slate-800 font-mono">{rental.capacityLph || 'Standard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Condition at Install:</span>
                  <span className="text-slate-800 font-medium">{rental.machineCondition.replace(/_/g, ' ')}</span>
                </div>
                {rental.accessories && (
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Accessories:</span>
                    <span className="text-slate-700 text-right max-w-[200px] text-[11px] truncate">
                      {rental.accessories}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Agreement & Installation Records */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Rental Agreement &amp; Field Installation</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Rental Start Date</span>
                <span className="font-mono font-bold text-slate-900">
                  {new Date(rental.rentalStartDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Billing Cycle</span>
                <span className="font-bold text-slate-800">{rental.billingFrequency}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Assigned Technician</span>
                <span className="font-medium text-slate-900">
                  {rental.technician?.fullName || 'Self Installed'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Paid to Date</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatINR(Number(rental.totalPaid))}
                </span>
              </div>
            </div>

            {rental.rentalStatus === 'RETURNED' && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs mt-2">
                <div className="font-bold text-slate-800">Equipment Return Record</div>
                <div className="text-slate-600 text-[11px]">
                  Returned on {rental.returnDate ? new Date(rental.returnDate).toLocaleDateString() : 'N/A'} • Condition: {rental.returnCondition || 'Good'}
                </div>
                <div className="text-slate-600 text-[11px] font-mono">
                  Damage: {formatINR(Number(rental.damageCharges || 0))} • Net Refund: {formatINR(Number(rental.refundAmount || 0))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Payment Ledger History */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Receipt className="w-4 h-4 text-primary-600" />
                <span>Recurring Payment Ledger ({rental.payments?.length || 0})</span>
              </div>
              {rental.rentalStatus !== 'RETURNED' && onRecordPayment && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onRecordPayment(rental)}
                  className="text-xs h-7 px-2.5 shadow-2xs"
                >
                  + Record Payment
                </Button>
              )}
            </div>

            {(!rental.payments || rental.payments.length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs font-medium">
                No payment transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <th className="py-2 px-2">Payment Date</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Method</th>
                      <th className="py-2 px-2">Reference</th>
                      <th className="py-2 px-2 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rental.payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-2 font-mono text-slate-800">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-700">
                          {p.paymentType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-slate-600">{p.paymentMethod}</td>
                        <td className="py-2.5 px-2 font-mono text-slate-500 text-[11px]">
                          {p.referenceNumber || '—'}
                        </td>
                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-800 text-right">
                          {formatINR(Number(p.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
