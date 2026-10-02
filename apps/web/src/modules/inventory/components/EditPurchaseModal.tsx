import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ShoppingBag, Info, Calculator, Check } from 'lucide-react';
import type { InventoryPurchase } from '../inventory.api';

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: InventoryPurchase | null;
  onSubmit: (data: {
    id: string;
    supplierName?: string;
    purchaseDate?: string;
    quantity?: number;
    purchasePricePerUnit?: number;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSubmit,
  isLoading = false,
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (purchase) {
      setSupplierName(purchase.supplierName || '');
      setPurchaseDate(purchase.purchaseDate ? purchase.purchaseDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setQuantity(String(purchase.quantity || '1'));
      setUnitCost(String(purchase.purchasePricePerUnit || '0'));
      setNotes(purchase.notes || '');
      setError(null);
    }
  }, [purchase, isOpen]);

  if (!isOpen || !purchase) return null;

  const oldQty = Number(purchase.quantity || 0);
  const qtyNum = parseInt(quantity, 10) || 0;
  const costNum = parseFloat(unitCost) || 0;
  const totalAmount = qtyNum * costNum;
  const qtyDelta = qtyNum - oldQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (qtyNum <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (costNum < 0) {
      setError('Unit purchase price cannot be negative');
      return;
    }

    try {
      await onSubmit({
        id: purchase.id,
        supplierName: supplierName.trim() || undefined,
        purchaseDate: new Date(purchaseDate).toISOString(),
        quantity: qtyNum,
        purchasePricePerUnit: costNum,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update purchase record'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Edit Purchase Record</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 text-blue-800">
                  {purchase.purchaseNumber}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Item: <strong className="text-gray-700">{purchase.itemName || 'Inventory Item'}</strong>
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

          {/* Recalculation Alert */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Stock & Calculation Notice:</strong> Changing the quantity or unit cost will automatically recalculate the item's live stock, FIFO batch remaining balance, and total purchase expenditure.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Supplier Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. National Components & Supplies Ltd."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Purchase Date *</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
              />
              {/* Stock Delta Indicator */}
              <div className="mt-1.5 text-[11px]">
                {qtyDelta > 0 && (
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block">
                    +{qtyDelta} units will be added to stock
                  </span>
                )}
                {qtyDelta < 0 && (
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                    {Math.abs(qtyDelta)} units will be deducted from stock
                  </span>
                )}
                {qtyDelta === 0 && (
                  <span className="text-gray-400">Stock count unchanged ({oldQty} units)</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Unit Purchase Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="mt-1.5 text-[11px] text-gray-400">
                Original: ₹{Number(purchase.purchasePricePerUnit).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Live Calculated Total Box */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-gray-500 text-[11px]">Recalculated Inward Amount</div>
                <div className="text-xs text-gray-400 font-mono">{qtyNum} units × ₹{costNum.toFixed(2)}</div>
              </div>
            </div>
            <div className="text-base font-extrabold text-blue-700">
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Invoice #, warranty info, or reason for edit..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
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
