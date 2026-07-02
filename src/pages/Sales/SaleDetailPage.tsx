import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Layers,
  Pencil,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { Button } from '../../components/Button/Button';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { paymentModeLabel } from '../../constants/paymentModes';
import {
  purchasePaymentStatusLabel,
  normalizeSalePaymentStatus,
  salePaymentStatusBadgeClass,
} from '../../constants/purchaseStatuses';
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
  const profitPositive = (sale?.profit ?? 0) >= 0;

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading sale…"
      loadingIcon={ShoppingCart}
      notFound={notFound}
      notFoundTitle="Sale not found"
      notFoundDescription="This order may have been deleted."
      backTo="/sales"
      backLabel="Back to sales"
      title={sale ? `Order ${sale.orderId}` : 'Sale'}
      description={sale ? `${sale.productName} · ${sale.platform}` : undefined}
      meta={
        sale ? (
          <DetailMetaRow>
            <DetailMetaChip tone="indigo" icon={<Calendar className="w-3 h-3" />}>
              {formatDateLocal(sale.orderDate)}
            </DetailMetaChip>
            <DetailMetaChip tone="gray">{sale.platform}</DetailMetaChip>
            <DetailMetaChip tone="gray">Qty {sale.quantity}</DetailMetaChip>
            <SaleStatusBadge status={sale.status} />
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        sale ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/sales/${sale.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit sale
          </Button>
        ) : null
      }
    >
      {sale && e && (
        <>
          <DetailStatStrip
            stats={[
              {
                label: 'Revenue',
                value: formatMoney(sale.grossRevenue, currency),
                icon: Receipt,
                tone: 'indigo',
              },
              {
                label: 'Total costs',
                value: formatMoney(sale.totalCosts, currency),
                icon: Layers,
                tone: 'slate',
              },
              {
                label: 'Profit',
                value: formatMoney(sale.profit, currency),
                icon: profitPositive ? TrendingUp : TrendingDown,
                tone: profitPositive ? 'emerald' : 'rose',
                valueClassName: profitPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              },
              {
                label: 'Margin',
                value: formatPercent(sale.profitMarginPercent),
                tone: profitPositive ? 'emerald' : 'rose',
                valueClassName: profitPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              },
            ]}
          />

          <DetailSection
            icon={ShoppingCart}
            iconTone="indigo"
            title="Order details"
            description="Marketplace order, product, and delivery info."
          >
            <DetailGrid columns={3}>
              <DetailField label="Order ID" value={sale.orderId} valueClassName="font-mono text-xs" />
              <DetailField label="Order date" value={formatDateLocal(sale.orderDate)} />
              <DetailField label="Quantity" value={String(sale.quantity)} />
              <DetailField
                label="Product"
                value={
                  <Link to={`/products/${sale.productId}`} className={detailLinkClass}>
                    {sale.productName}
                  </Link>
                }
              />
              <DetailField label="Platform" value={sale.platform} />
              <DetailField label="Status" value={<SaleStatusBadge status={sale.status} />} />
              <DetailField label="Payment mode" value={paymentModeLabel(sale.paymentMode)} />
              <DetailField
                label="Payment status"
                value={
                  <span
                    className={`inline-flex text-xs px-2 py-0.5 rounded-full ${salePaymentStatusBadgeClass(sale.paymentStatus)}`}
                  >
                    {purchasePaymentStatusLabel(normalizeSalePaymentStatus(sale.paymentStatus))}
                  </span>
                }
              />
              <DetailField label="Tracking ID" value={sale.trackingId} valueClassName="font-mono text-xs" />
              {sale.status === SaleStatus.RETURNED && (
                <>
                  <DetailField
                    label="Return date"
                    value={sale.returnedAt ? formatDateLocal(sale.returnedAt) : null}
                  />
                  <DetailField
                    label="Return charges"
                    value={sale.returnCharges ? formatMoney(sale.returnCharges, currency) : null}
                    valueClassName="tabular-nums font-medium"
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
                    value={sale.returnTaxAmount ? formatMoney(sale.returnTaxAmount, currency) : null}
                    valueClassName="tabular-nums"
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
                      sale.cancellationCharges ? formatMoney(sale.cancellationCharges, currency) : null
                    }
                    valueClassName="tabular-nums font-medium"
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
                    valueClassName="tabular-nums"
                  />
                </>
              )}
            </DetailGrid>
            {sale.notes ? <DetailNotes>{sale.notes}</DetailNotes> : null}
          </DetailSection>

          <DetailSection
            icon={Layers}
            iconTone="violet"
            title="Economics & tax"
            description="Cost snapshot recorded when this sale was logged."
          >
            <DetailGrid columns={3}>
              <DetailField
                label="Purchase price"
                value={formatMoney(e.purchasePrice, currency)}
                valueClassName="tabular-nums font-medium"
              />
              <DetailField
                label={`${pctLabel} (purchase)`}
                value={`${e.purchaseTaxPercentage ?? 0}% · Includes tax: ${amountIncludesTaxLabel(e.purchaseTaxMode)}`}
              />
              <DetailField
                label="Selling price"
                value={formatMoney(e.sellingPrice, currency)}
                valueClassName="tabular-nums font-medium"
              />
              <DetailField
                label={`${pctLabel} (selling)`}
                value={`${e.sellingTaxPercentage ?? e.taxPercentage}% · Includes tax: ${amountIncludesTaxLabel(e.sellingTaxMode ?? e.taxMode)}`}
              />
              <DetailField label="Platform fee" value={feeDisplay} />
              <DetailField
                label="Delivery fee"
                value={formatMoney(e.shippingCost, currency)}
                valueClassName="tabular-nums"
              />
              <DetailField
                label="Platform fees (total)"
                value={formatMoney(sale.platformFees, currency)}
                valueClassName="tabular-nums font-medium"
              />
              <DetailField
                label="Output tax"
                value={formatMoney(e.taxAmount, currency)}
                valueClassName="tabular-nums"
              />
              <DetailField
                label="Input tax (ITC)"
                value={formatMoney(e.inputTaxAmount ?? 0, currency)}
                valueClassName="tabular-nums text-emerald-700 dark:text-emerald-400"
              />
            </DetailGrid>
          </DetailSection>

          {sale.trackingId ? (
            <DetailSection
              icon={Truck}
              iconTone="amber"
              title="Delivery"
              description="Shipment tracking for this order."
            >
              <DetailField label="Tracking ID" value={sale.trackingId} valueClassName="font-mono text-sm" />
            </DetailSection>
          ) : null}
        </>
      )}
    </EntityDetailShell>
  );
}
