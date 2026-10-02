import React, { useState } from 'react';
import { RotateCcw, ShieldAlert, IndianRupee, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useReturnRentalMutation, type RentalItem } from '../rentals.api';
import { useToast } from '../../../providers/ToastProvider';
import { formatCurrency, formatINR } from '../../../lib/formatters';

export interface RentalReturnModalProps {
  isOpen: boolean;
  rental?: RentalItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RentalReturnModal: React.FC<RentalReturnModalProps> = ({
  isOpen,
  rental,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const returnRentalMutation = useReturnRentalMutation(rental?.id || '');

  const depositHeld = rental ? Number(rental.securityDeposit || 0) : 0;

  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnCondition, setReturnCondition] = useState<string>('Good Condition — Complete with Accessories');
  const [damageCharges, setDamageCharges] = useState<number>(0);
  const [depositAdjustment, setDepositAdjustment] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(depositHeld);
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Recalculate default refund if deposit changes
  React.useEffect(() => {
    if (rental) {
      const dep = Number(rental.securityDeposit || 0);
      setRefundAmount(Math.max(0, dep - damageCharges - depositAdjustment));
    }
  }, [rental, damageCharges, depositAdjustment]);

  if (!rental) return null;

  const handleDamageChange = (val: number) => {
    setDamageCharges(val);
    setRefundAmount(Math.max(0, depositHeld - val - depositAdjustment));
  };

  const handleAdjustmentChange = (val: number) => {
    setDepositAdjustment(val);
    setRefundAmount(Math.max(0, depositHeld - damageCharges - val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await returnRentalMutation.mutateAsync({
        returnDate,
        returnCondition,
        damageCharges: Number(damageCharges),
        depositAdjustment: Number(depositAdjustment),
        refundAmount: Number(refundAmount),
        returnNotes: returnNotes.trim() || undefined,
      });

      toast.success(
        `Equipment ${rental.machineModel} (Serial: ${rental.serialNumber}) marked as RETURNED. Refund: ${formatINR(refundAmount)}.`,
        'Equipment Returned'
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record equipment return', 'Return Error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Return Rented Equipment"
      description={`Record return & deposit settlement for ${rental.rentalNumber}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rental Context Card */}
        <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/90 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">{rental.customer?.fullName}</span>
            <span className="text-[11px] font-mono text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
              {rental.rentalNumber}
            </span>
          </div>
          <div className="text-[11px] text-slate-600">
            {rental.machineModel} (Serial: <span className="font-mono">{rental.serialNumber}</span>)
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-700 border-t border-slate-200/60 mt-1 font-bold">
            <span>Security Deposit Held: {formatINR(depositHeld)}</span>
            <span>Monthly Rent: {formatINR(Number(rental.monthlyRent))}</span>
          </div>
        </div>

        {/* Return Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Return Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none font-mono"
          />
        </div>

        {/* Return Condition */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Physical Condition upon Return <span className="text-rose-500">*</span>
          </label>
          <select
            value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none"
          >
            <option value="Good Condition — Complete with Accessories">
              Good Condition — Complete with Accessories
            </option>
            <option value="Minor Scratches / Normal Wear & Tear">Minor Scratches / Normal Wear &amp; Tear</option>
            <option value="Missing Accessories / Cables / Parts">Missing Accessories / Cables / Parts</option>
            <option value="Requires Servicing / Maintenance">Requires Servicing / Maintenance</option>
            <option value="Damaged Housing / Parts Broken">Damaged Housing / Parts Broken</option>
          </select>
        </div>

        {/* Settlement Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Damage Charges (₹)</label>
            <input
              type="number"
              min="0"
              value={damageCharges}
              onChange={(e) => handleDamageChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Adjustment (₹)</label>
            <input
              type="number"
              min="0"
              value={depositAdjustment}
              onChange={(e) => handleAdjustmentChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none font-mono"
            />
          </div>
        </div>

        {/* Net Refund Amount */}
        <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200/90 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-900">Net Refund to Customer</div>
            <div className="text-[10px] text-emerald-700">Security Deposit − Damages − Adjustments</div>
          </div>
          <div className="text-lg font-extrabold text-emerald-900 font-mono">
            {formatINR(refundAmount)}
          </div>
        </div>

        {/* Return Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Return Notes / Handover Remarks</label>
          <input
            type="text"
            placeholder="e.g. Equipment inspected and verified upon return, deposit settled."
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={returnRentalMutation.isPending}
            className="px-6 shadow-md"
          >
            Confirm Equipment Return
          </Button>
        </div>
      </form>
    </Modal>
  );
};
