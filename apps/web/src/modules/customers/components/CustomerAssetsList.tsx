import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCustomerAssetsQuery } from '../customer.api';
import { Droplets, ShieldCheck, Calendar, Hash, Wrench } from 'lucide-react';
import { formatDate } from '../../../lib/formatters';

export interface CustomerAssetsListProps {
  customerId: string;
}

export const CustomerAssetsList: React.FC<CustomerAssetsListProps> = ({ customerId }) => {
  const { data: assets, isLoading, isError } = useCustomerAssetsQuery(customerId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError || !assets || assets.length === 0) {
    return (
      <EmptyState
        icon={<Droplets className="w-6 h-6 text-slate-400" />}
        title="No assets registered"
        description="This customer currently has no product units or serialized items registered in the CRM."
      />
    );
  }

  return (
    <div className="space-y-4">
      {assets.map((asset) => {
        const activeWarranty = asset.warranties?.find((w) => w.status === 'ACTIVE' || w.status === 'EXPIRING_SOON');
        const isRoMachine = asset.assetType === 'RO_MACHINE';

        return (
          <Card key={asset.id} className="border-slate-200 hover:border-slate-300 transition-colors">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    {isRoMachine ? <Droplets className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {asset.customName || (asset as any).product?.name || asset.productName || 'Product Asset'}
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      SKU: {(asset as any).product?.sku || asset.productSku || 'N/A'} {(asset as any).product?.brand || asset.productBrand ? `• ${(asset as any).product?.brand || asset.productBrand}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={asset.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                {asset.serialNumber && (
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Serial Number</span>
                      <span className="font-mono font-medium text-slate-800">{asset.serialNumber}</span>
                    </div>
                  </div>
                )}

                {asset.purchaseDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purchase Date</span>
                      <span className="font-medium text-slate-800">
                        {formatDate(asset.purchaseDate)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Warranty Status</span>
                    {activeWarranty ? (
                      <span className="font-medium text-emerald-600">
                        Active (Expires {formatDate(activeWarranty.endDate)})
                      </span>
                    ) : (
                      <span className="font-medium text-slate-500">No active warranty</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
