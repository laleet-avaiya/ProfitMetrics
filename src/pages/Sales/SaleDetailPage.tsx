import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid } from '../../components/DetailPage/DetailField';
import { Button } from '../../components/Button/Button';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { firestoreService } from '../../services/firestore';
import { PlatformFeeKind, SaleStatus } from '../../types';
import { amountIncludesTaxLabel, taxPercentLabel } from '../../utils/listingTax';
import { formatMoney, formatPercent } from '../../utils/profit';
import { formatDateLocal } from '../../utils/date';

export function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const currency = company?.currency ?? 'AED';

  const { entity: sale, loading, notFound } = useEntityDetail({
    id: saleId,
    fetch: firestoreService.sales.get,
    errorMessage: 'Failed to load sale',
  });

  const e = sale?.economics;
  const pctLabel = e ? taxPercentLabel(e.taxType) : 'Tax %';
  const feeKind = e?.platformFeeKind ?? PlatformFeeKind.FIXED;
  const feeDisplay =
    feeKind === PlatformFeeKind.PERCENT
      ? `${e?.platformFeePercent ?? 0}%`
      : formatMoney(e?.platformFee ?? 0, currency);

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading sale…"
      notFound={notFound}
      notFoundTitle="Sale not found"
      notFoundDescription="This order may have been deleted."
      backTo="/sales"
      backLabel="Back to sales"
      title={sale ? `Order ${sale.orderId}` : 'Sale'}
      description={sale ? `${sale.productName} · ${sale.platform}` : undefined}
      actions={
        sale ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/sales/${sale.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        ) : null
      }
    >
      {sale && e && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <StatCard label="Revenue" value={formatMoney(sale.grossRevenue, currency)} />
            <StatCard label="Total costs" value={formatMoney(sale.totalCosts, currency)} />
            <StatCard
              label="Profit"
              value={formatMoney(sale.profit, currency)}
              valueClassName={
                sale.profit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            />
            <StatCard
              label="Margin"
              value={formatPercent(sale.profitMarginPercent)}
              valueClassName={
                sale.profit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            />
          </div>

          <Card>
            <CardHeader title="Order details" />
            <DetailGrid columns={3}>
              <DetailField label="Order ID" value={sale.orderId} />
              <DetailField label="Order date" value={formatDateLocal(sale.orderDate)} />
              <DetailField label="Quantity" value={String(sale.quantity)} />
              <DetailField
                label="Product"
                value={
                  <Link
                    to={`/products/${sale.productId}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {sale.productName}
                  </Link>
                }
              />
              <DetailField label="Platform" value={sale.platform} />
              <DetailField label="Status" value={<SaleStatusBadge status={sale.status} />} />
              <DetailField label="Tracking ID" value={sale.trackingId} />
              {sale.status === SaleStatus.RETURNED && (
                <>
                  <DetailField
                    label="Return date"
                    value={sale.returnedAt ? formatDateLocal(sale.returnedAt) : null}
                  />
                  <DetailField
                    label="Return charges"
                    value={
                      sale.returnCharges ? formatMoney(sale.returnCharges, currency) : null
                    }
                  />
                  <DetailField
                    label={`${pctLabel} (return)`}
                    value={
                      sale.returnCharges
                        ? `${sale.returnTaxPercentage ?? 0}% · Includes tax: ${amountIncludesTaxLabel(sale.returnTaxMode)}`
                        : null
                    }
                  />
                  <DetailField
                    label="ITC (return charges)"
                    value={
                      sale.returnTaxAmount
                        ? formatMoney(sale.returnTaxAmount, currency)
                        : null
                    }
                  />
                </>
              )}
              {sale.status === SaleStatus.CANCELLED && (
                <>
                  <DetailField
                    label="Cancellation date"
                    value={sale.cancelledAt ? formatDateLocal(sale.cancelledAt) : null}
                  />
                  <DetailField
                    label="Cancellation charges"
                    value={
                      sale.cancellationCharges
                        ? formatMoney(sale.cancellationCharges, currency)
                        : null
                    }
                  />
                  <DetailField
                    label={`${pctLabel} (cancellation)`}
                    value={
                      sale.cancellationCharges
                        ? `${sale.cancellationTaxPercentage ?? 0}% · Includes tax: ${amountIncludesTaxLabel(sale.cancellationTaxMode)}`
                        : null
                    }
                  />
                  <DetailField
                    label="ITC (cancellation)"
                    value={
                      sale.cancellationTaxAmount
                        ? formatMoney(sale.cancellationTaxAmount, currency)
                        : null
                    }
                  />
                </>
              )}
            </DetailGrid>
            {sale.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <DetailField label="Notes" value={sale.notes} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Economics & tax" description="Snapshot at time of sale" />
            <DetailGrid columns={3}>
              <DetailField label="Purchase price" value={formatMoney(e.purchasePrice, currency)} />
              <DetailField
                label={`${pctLabel} (purchase)`}
                value={`${e.purchaseTaxPercentage ?? 0}% · Includes tax: ${amountIncludesTaxLabel(e.purchaseTaxMode)}`}
              />
              <DetailField label="Selling price" value={formatMoney(e.sellingPrice, currency)} />
              <DetailField
                label={`${pctLabel} (selling)`}
                value={`${e.sellingTaxPercentage ?? e.taxPercentage}% · Includes tax: ${amountIncludesTaxLabel(e.sellingTaxMode ?? e.taxMode)}`}
              />
              <DetailField label="Platform fee" value={feeDisplay} />
              <DetailField label="Delivery fee" value={formatMoney(e.shippingCost, currency)} />
              <DetailField label="Platform fees (total)" value={formatMoney(sale.platformFees, currency)} />
              <DetailField label="Output tax" value={formatMoney(e.taxAmount, currency)} />
              <DetailField
                label="Input tax (ITC)"
                value={formatMoney(e.inputTaxAmount ?? 0, currency)}
              />
            </DetailGrid>
          </Card>
        </>
      )}
    </EntityDetailShell>
  );
}
