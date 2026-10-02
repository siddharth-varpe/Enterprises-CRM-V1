import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ShoppingCart, Info, Calculator, Check, User } from 'lucide-react';
import type { InventorySale, InventoryItem } from '../inventory.api';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: InventorySale | null;
  items: InventoryItem[];
  onSubmit: (data: {
    id: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    saleDate?: string;
    quantity?: number;
    sellingPricePerUnit?: number;
    paymentStatus?: string;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  onClose,
  sale,
  items,
  onSubmit,
  isLoading = false,
}) => {
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState('COMPLETED');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch active customers from existing CRM customer database for selection
  const { data: customerList } = useQuery({
    queryKey: ['customers', 'simple-list'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/customers', { params: { limit: 100 } });
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (sale) {
      setCustomerId(sale.customerId || '');
      setCustomerName(sale.customerName || '');
      setCustomerPhone(sale.customerPhone || '');
      setSaleDate(sale.saleDate ? sale.saleDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setQuantity(String(sale.quantity || '1'));
      setSellingPrice(String(sale.sellingPricePerUnit || '0'));
      setPaymentStatus(sale.paymentStatus || 'COMPLETED');
      setNotes(sale.notes || '');
      setError(null);
    }
  }, [sale, isOpen]);

  if (!isOpen || !sale) return null;

  const item = items.find((i) => i.id === sale.itemId);
  const currentAvailableStock = Number(item?.currentStock || 0);

  const oldQty = Number(sale.quantity || 0);
  const qtyNum = parseInt(quantity, 10) || 0;
  const sellNum = parseFloat(sellingPrice) || 0;
  const unitCost = Number(sale.purchaseCostPerUnit || 0);

  const deltaQty = qtyNum - oldQty;
  const totalSaleAmount = qtyNum * sellNum;
  const totalCostAmount = qtyNum * unitCost;
  const profit = totalSaleAmount - totalCostAmount;
  const marginPercent = totalSaleAmount > 0 ? ((profit / totalSaleAmount) * 100).toFixed(1) : '0';

  const handleCustomerSelect = (id: string) => {
    setCustomerId(id);
    if (!id) return;
    const c = customerList?.find((cust: any) => cust.id === id);
    if (c) {
      setCustomerName(c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim());
      setCustomerPhone(c.mobileNumber || c.phoneNumber || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (qtyNum <= 0) {
      setError('Quantity must be at least 1');
      return;
    }

    if (deltaQty > 0 && deltaQty > currentAvailableStock) {
      setError(
        `Cannot increase sale by ${deltaQty} units. Current available stock is only ${currentAvailableStock}.`
      );
      return;
    }

    if (sellNum < 0) {
      setError('Selling price cannot be negative');
      return;
    }

    try {
      await onSubmit({
        id: sale.id,
        customerId: customerId.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        saleDate: new Date(saleDate).toISOString(),
        quantity: qtyNum,
        sellingPricePerUnit: sellNum,
        paymentStatus,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update sale record'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/70 to-teal-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Edit Sale Record</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  {sale.saleNumber}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Item: <strong className="text-gray-700">{sale.itemName || 'Inventory Item'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Recalculation Notice */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2.5 text-emerald-900">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Recalculation Notice:</strong> Modifying quantity or selling price automatically updates live stock, sales revenue, cost of goods, and net profit across all charts and reports.
            </div>
          </div>

          {/* Customer Selection (Optional) */}
          <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-500" />
                Customer Details (Optional)
              </label>
              <span className="text-[10px] text-gray-400">Optional for direct/walk-in sales</span>
            </div>

            {customerList && customerList.length > 0 && (
              <div>
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-xs"
                >
                  <option value="">-- Choose Existing CRM Customer or leave blank --</option>
                  {customerList.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim()} ({c.mobileNumber || c.phoneNumber || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="Customer Phone (Optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Sale Date *</label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-semibold"
              >
                <option value="COMPLETED">COMPLETED (Paid)</option>
                <option value="PENDING">PENDING (Unpaid)</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Quantity (Units) *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
              />
              {/* Stock Delta Indicator */}
              <div className="mt-1.5 text-[11px]">
                {deltaQty > 0 && (
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                    +{deltaQty} more units will be deducted from stock
                  </span>
                )}
                {deltaQty < 0 && (
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block">
                    {Math.abs(deltaQty)} units will be returned to stock
                  </span>
                )}
                {deltaQty === 0 && (
                  <span className="text-gray-400">Stock count unchanged ({oldQty} units)</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Selling Price Per Unit (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
              />
              <div className="mt-1.5 text-[11px] text-gray-400">
                Original: ₹{Number(sale.sellingPricePerUnit).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Real-time Recalculated Financial Summary */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50/60 rounded-xl border border-emerald-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-900">Recalculated Financial Impact</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded">
                {marginPercent}% margin
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <div className="text-[10px] text-gray-500">Total Sale</div>
                <div className="text-xs font-bold text-gray-900">₹{totalSaleAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Unit Cost Basis</div>
                <div className="text-xs font-semibold text-gray-600">₹{unitCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500">Recalculated Profit</div>
                <div className={`text-xs font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {profit >= 0 ? '+' : ''}₹{profit.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Warranty details, delivery notes, or edit reason..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                'Recalculating...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save Changes & Recalculate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
