import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MessageSquare,
  CreditCard,
  RotateCcw,
  Eye,
  Trash2,
  Calendar,
  IndianRupee,
  Users,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Package,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RentalKpiCards } from './components/RentalKpiCards';
import { RentalStatusBadge } from './components/RentalStatusBadge';
import { RentalCreateModal } from './components/RentalCreateModal';
import { RentalPaymentModal } from './components/RentalPaymentModal';
import { RentalReturnModal } from './components/RentalReturnModal';
import { RentalDetailModal } from './components/RentalDetailModal';
import {
  useRentalsQuery,
  useDeleteRentalMutation,
  type RentalItem,
  type RentalQueryParams,
} from './rentals.api';
import { useToast } from '../../providers/ToastProvider';
import { formatCurrency, formatINR } from '../../lib/formatters';
import { sendRentalWhatsAppReminder } from './rentals.whatsapp';

export const RentalsPage: React.FC = () => {
  const toast = useToast();
  const deleteRentalMutation = useDeleteRentalMutation();

  // State
  const [activeTab, setActiveTab] = useState<'active' | 'due' | 'overdue' | 'returned' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('ALL');
  const [billingFreqFilter, setBillingFreqFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'dueDate' | 'outstanding' | 'customer'>('newest');
  const [page, setPage] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState<RentalItem | null>(null);
  const [selectedRentalForReturn, setSelectedRentalForReturn] = useState<RentalItem | null>(null);
  const [selectedRentalForDetail, setSelectedRentalForDetail] = useState<string | null>(null);
  const [rentalToDelete, setRentalToDelete] = useState<RentalItem | null>(null);

  // Query Params
  const queryParams: RentalQueryParams = {
    tab: activeTab,
    search: search.trim() || undefined,
    machineType: machineTypeFilter !== 'ALL' ? machineTypeFilter : undefined,
    billingFrequency: billingFreqFilter !== 'ALL' ? billingFreqFilter : undefined,
    sortBy,
    page,
    limit: 20,
  };

  const { data: rentalsResponse, isLoading, isFetching, refetch } = useRentalsQuery(queryParams);

  const rentalList = rentalsResponse?.data || [];
  const pagination = rentalsResponse?.pagination;
  const summary = rentalsResponse?.summary;

  const handleTabChange = (tab: 'active' | 'due' | 'overdue' | 'returned' | 'all') => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleWhatsAppReminder = (rental: RentalItem) => {
    const result = sendRentalWhatsAppReminder(rental);
    if (!result.success) {
      toast.error(result.error || 'Customer phone number is not available.', 'WhatsApp Error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!rentalToDelete) return;
    try {
      await deleteRentalMutation.mutateAsync(rentalToDelete.id);
      toast.success(`Rental ${rentalToDelete.rentalNumber} deleted successfully.`, 'Rental Deleted');
      setRentalToDelete(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete rental agreement', 'Delete Error');
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-150">
      {/* 1. Global Page Header */}
      <PageHeader
        title="Rent Management"
        description="Manage recurring equipment and product rentals, track monthly payments, schedule maintenance, and handle returns."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-md text-xs font-semibold px-4"
            >
              + Add Rental
            </Button>
          </div>
        }
      />

      {/* 2. KPI Summary Cards */}
      <RentalKpiCards summary={summary} isLoading={isLoading} />

      {/* 3. Main Card with Tabs, Search, and Data Table */}
      <Card className="rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200/80 px-4 sm:px-6 pt-3 flex items-center justify-between overflow-x-auto bg-slate-50/50">
          <div className="flex items-center gap-1.5 -mb-px">
            <button
              type="button"
              onClick={() => handleTabChange('active')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'active'
                  ? 'border-primary-600 text-primary-700 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Active Rentals</span>
              {summary && summary.totalActive > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 font-extrabold">
                  {summary.totalActive}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('due')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'due'
                  ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Payment Due</span>
              {summary && summary.totalDue > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-extrabold">
                  {summary.totalDue}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('overdue')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'overdue'
                  ? 'border-rose-600 text-rose-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Overdue</span>
              {summary && summary.totalOverdue > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800 font-extrabold animate-pulse">
                  {summary.totalOverdue}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('returned')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'returned'
                  ? 'border-slate-600 text-slate-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Returned / Completed</span>
              {summary && summary.totalReturned > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700 font-extrabold">
                  {summary.totalReturned}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'border-primary-600 text-primary-700 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>All Rentals</span>
              {summary && summary.totalRentals > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600 font-extrabold">
                  {summary.totalRentals}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by customer name, phone, serial number, machine model..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50/80 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
            />
          </div>

          {/* Filter Selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Type:</span>
              <select
                value={machineTypeFilter}
                onChange={(e) => {
                  setMachineTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="STANDARD">Standard Equipment</option>
                <option value="PREMIUM">Premium Unit</option>
                <option value="COMMERCIAL">Commercial Unit</option>
                <option value="HEAVY_DUTY">Heavy Duty Unit</option>
                <option value="PORTABLE">Portable / Compact Unit</option>
                <option value="CUSTOM">Custom Product / Equipment</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none cursor-pointer font-mono"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="dueDate">Due Date</option>
                <option value="customer">Customer Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 text-xs animate-pulse">
              Loading rental database records...
            </div>
          ) : rentalList.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Repeat className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-800">No rental agreements found</div>
              <div className="text-xs text-slate-500 max-w-sm mx-auto">
                {search ? `No rentals matching search "${search}".` : 'No rental records currently registered in this view.'}
              </div>
              {!search && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-3 text-xs"
                >
                  + Add First Rental
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Agreement</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Rented Equipment / Product</th>
                  <th className="py-3 px-4 font-mono text-right">Monthly Rent</th>
                  <th className="py-3 px-4">Deposit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Next Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rentalList.map((rental: RentalItem) => (
                  <tr key={rental.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Agreement ID & Start Date */}
                    <td className="py-3 px-4">
                      <div
                        onClick={() => setSelectedRentalForDetail(rental.id)}
                        className="font-mono font-bold text-primary-700 hover:underline cursor-pointer"
                      >
                        {rental.rentalNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Started: {new Date(rental.rentalStartDate).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {rental.customer?.fullName || 'Customer'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <span>📞</span>
                        <span>{rental.customer?.phone || 'No phone registered'}</span>
                      </div>
                    </td>

                    {/* Rented Machine & Serial */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{rental.machineModel}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        SN: <span className="text-purple-700 font-bold">{rental.serialNumber}</span> • {rental.machineType}
                      </div>
                    </td>

                    {/* Monthly Rent */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                      {formatINR(Number(rental.monthlyRent))}
                    </td>

                    {/* Security Deposit */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-teal-800">
                        {formatINR(Number(rental.securityDeposit))}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {rental.depositStatus.replace(/_/g, ' ')}
                      </div>
                    </td>

                    {/* Status Badges */}
                    <td className="py-3 px-4 space-y-1">
                      <RentalStatusBadge status={rental.rentalStatus} type="rental" />
                      <div>
                        <RentalStatusBadge status={rental.paymentStatus} type="payment" />
                      </div>
                    </td>

                    {/* Next Due Date */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-800">
                        {new Date(rental.nextDueDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-500">{rental.billingFrequency}</div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* WhatsApp Reminder Button */}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppReminder(rental)}
                          title="Send WhatsApp Payment Reminder"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Record Payment Button */}
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

                        {/* Return Machine Button */}
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

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedRentalForDetail(rental.id)}
                          title="View Agreement Details"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setRentalToDelete(rental)}
                          title="Delete Rental"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-bold text-slate-800">{pagination.page}</span> of{' '}
              <span className="font-bold text-slate-800">{pagination.totalPages}</span> ({pagination.total} total rentals)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs px-2.5"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 text-xs px-2.5"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Modals */}
      <RentalCreateModal
        isOpen={isCreateModalOpen}
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

      <ConfirmDialog
        isOpen={Boolean(rentalToDelete)}
        onClose={() => setRentalToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Rental Agreement"
        message={`Are you sure you want to delete rental ${rentalToDelete?.rentalNumber} for ${rentalToDelete?.customer?.fullName}? This action cannot be undone.`}
        confirmLabel="Delete Rental"
        variant="danger"
        isLoading={deleteRentalMutation.isPending}
      />
    </div>
  );
};
