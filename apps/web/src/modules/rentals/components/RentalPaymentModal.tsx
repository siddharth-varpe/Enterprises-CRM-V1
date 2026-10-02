import React, { useState } from 'react';
import { IndianRupee, CreditCard, Calendar, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useRecordRentalPaymentMutation, type RentalItem } from '../rentals.api';
import { useToast } from '../../../providers/ToastProvider';
import { formatCurrency, formatINR } from '../../../lib/formatters';

export interface RentalPaymentModalProps {
  isOpen: boolean;
  rental?: RentalItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RentalPaymentModal: React.FC<RentalPaymentModalProps> = ({
  isOpen,
  rental,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const recordPaymentMutation = useRecordRentalPaymentMutation(rental?.id || '');

  const [amount, setAmount] = useState<number>(rental ? Number(rental.monthlyRent || 0) : 0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [paymentType, setPaymentType] = useState<'MONTHLY_RENT' | 'SECURITY_DEPOSIT' | 'ADVANCE_RENT' | 'DAMAGE_CHARGE' | 'OTHER'>('MONTHLY_RENT');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Update default amount if rental changes
  React.useEffect(() => {
    if (rental) {
      setAmount(Number(rental.monthlyRent || 0));
    }
  }, [rental]);

  if (!rental) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        amount: Number(amount),
        paymentDate,
        paymentMethod,
        paymentType,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(
        `Payment of ${formatINR(amount)} recorded successfully for ${rental.customer?.fullName || 'customer'}.`,
        'Payment Recorded'
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment', 'Payment Error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Record Rental Payment"
      description={`Record recurring monthly rent or deposit collection for ${rental.rentalNumber}`}
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
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-500 border-t border-slate-200/60 mt-1">
            <span>Monthly Rent: {formatCurrency(Number(rental.monthlyRent))}</span>
            <span>Next Due: {new Date(rental.nextDueDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Payment Amount (₹) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value));
                setError('');
              }}
              className="w-full pl-9 pr-3.5 py-2 text-sm font-bold font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          {error && <p className="text-[11px] text-rose-600 font-medium mt-0.5">{error}</p>}
        </div>

        {/* Payment Type & Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none"
            >
              <option value="MONTHLY_RENT">Monthly Rent</option>
              <option value="ADVANCE_RENT">Advance Rent</option>
              <option value="SECURITY_DEPOSIT">Security Deposit</option>
              <option value="DAMAGE_CHARGE">Damage Charge</option>
              <option value="OTHER">Other Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none"
            >
              <option value="UPI">UPI / GPay / PhonePe</option>
              <option value="CASH">Cash Payment</option>
              <option value="BANK_TRANSFER">Bank IMPS / NEFT</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Debit / Credit Card</option>
            </select>
          </div>
        </div>

        {/* Payment Date & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref # (optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / Bank UTR / Cheque No."
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none font-mono"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
          <input
            type="text"
            placeholder="e.g. Payment remarks or transaction note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            isLoading={recordPaymentMutation.isPending}
            className="px-6 shadow-md"
          >
            Record Payment ({formatINR(amount)})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
