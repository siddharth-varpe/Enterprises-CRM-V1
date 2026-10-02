import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  IndianRupee,
  Calendar,
  MessageSquare,
  CreditCard,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { RentalStatusBadge } from '../../rentals/components/RentalStatusBadge';
import { RentalCreateModal } from '../../rentals/components/RentalCreateModal';
import { RentalPaymentModal } from '../../rentals/components/RentalPaymentModal';
import { RentalReturnModal } from '../../rentals/components/RentalReturnModal';
import { RentalDetailModal } from '../../rentals/components/RentalDetailModal';
import { useCustomerRentalsQuery, type RentalItem } from '../../rentals/rentals.api';
import { formatCurrency, formatINR, formatDate } from '../../../lib/formatters';
import { sendRentalWhatsAppReminder } from '../../rentals/rentals.whatsapp';
import { useToast } from '../../../providers/ToastProvider';

export interface CustomerRentalsSectionProps {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
}

export const CustomerRentalsSection: React.FC<CustomerRentalsSectionProps> = ({
  customerId,
  customerName,
  customerPhone,
}) => {
  const toast = useToast();
  const { data: customerRentals = [], isLoading, refetch } = useCustomerRentalsQuery(customerId);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState<RentalItem | null>(null);
  const [selectedRentalForReturn, setSelectedRentalForReturn] = useState<RentalItem | null>(null);
  const [selectedRentalForDetail, setSelectedRentalForDetail] = useState<string | null>(null);

  const handleWhatsAppReminder = (rental: RentalItem) => {
    const result = sendRentalWhatsAppReminder(rental, customerPhone);
    if (!result.success) {
      toast.error(result.error || 'Customer phone number is not available.', 'WhatsApp Error');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-slate-200/90 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary-600" />
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Product Rentals &amp; Subscriptions
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Active and historical recurring rental agreements for this customer.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="shadow-2xs h-7 text-xs px-2.5"
          >
            New Rental Agreement
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              Loading customer rental records...
            </div>
          ) : customerRentals.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Repeat className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-800">No rentals found for this customer</div>
              <div className="text-xs text-slate-500">
                This customer does not have any active or past rental agreements.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3 text-xs h-7 px-3"
              >
                + New Rental Agreement
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-[11px]">
                    <th className="py-3 px-4">Agreement</th>
                    <th className="py-3 px-4">Rented Equipment / Product</th>
                    <th className="py-3 px-4 font-mono text-right">Monthly Rent</th>
                    <th className="py-3 px-4">Deposit</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Next Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerRentals.map((rental: RentalItem) => (
                    <tr key={rental.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary-700">
                        {rental.rentalNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{rental.machineModel}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          SN: <span className="text-purple-700 font-bold">{rental.serialNumber}</span> • {rental.machineType}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                        {formatINR(Number(rental.monthlyRent))}
                      </td>
                      <td className="py-3 px-4 font-mono text-teal-800 font-bold">
                        {formatINR(Number(rental.securityDeposit))}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <RentalStatusBadge status={rental.rentalStatus} type="rental" />
                        <div>
                          <RentalStatusBadge status={rental.paymentStatus} type="payment" />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800 font-bold">
                        {formatDate(rental.nextDueDate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleWhatsAppReminder(rental)}
                            title="Send WhatsApp Payment Reminder"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {rental.rentalStatus !== 'RETURNED' && (
                            <button
                              type="button"
                              onClick={() => setSelectedRentalForPayment(rental)}
                              title="Record Payment"
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

                          {rental.rentalStatus !== 'RETURNED' && (
                            <button
                              type="button"
                              onClick={() => setSelectedRentalForReturn(rental)}
                              title="Return Equipment / Item"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRentalForDetail(rental.id)}
                            title="View Agreement Details"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <RentalCreateModal
        isOpen={isCreateModalOpen}
        preselectedCustomerId={customerId}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsCreateModalOpen(false);
        }}
      />

      <RentalPaymentModal
        isOpen={Boolean(selectedRentalForPayment)}
        rental={selectedRentalForPayment}
        onClose={() => setSelectedRentalForPayment(null)}
        onSuccess={() => {
          refetch();
          setSelectedRentalForPayment(null);
        }}
      />

      <RentalReturnModal
        isOpen={Boolean(selectedRentalForReturn)}
        rental={selectedRentalForReturn}
        onClose={() => setSelectedRentalForReturn(null)}
        onSuccess={() => {
          refetch();
          setSelectedRentalForReturn(null);
        }}
      />

      <RentalDetailModal
        isOpen={Boolean(selectedRentalForDetail)}
        rentalId={selectedRentalForDetail}
        onClose={() => setSelectedRentalForDetail(null)}
        onRecordPayment={(r) => {
          setSelectedRentalForDetail(null);
          setSelectedRentalForPayment(r);
        }}
        onReturnMachine={(r) => {
          setSelectedRentalForDetail(null);
          setSelectedRentalForReturn(r);
        }}
      />
    </div>
  );
};
