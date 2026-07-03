import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Layers,
  Pencil,
  Printer,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { EntityAttachmentsDetailSection } from '../../components/EntityAttachments';
import { Button } from '../../components/Button/Button';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { useModuleAccess } from '../../hooks/usePermissions';
import { paymentModeLabel } from '../../constants/paymentModes';
import {
  purchasePaymentStatusLabel,
  normalizeSalePaymentStatus,
  salePaymentStatusBadgeClass,
} from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import { SaleStatus } from '../../types';
import { amountIncludesTaxLabel, taxPercentLabel } from '../../utils/listingTax';
import { formatMoney, formatPercent } from '../../utils/profit';
import { formatDateLocal } from '../../utils/date';
import { deliveryModeLabel } from '../../constants/deliveryModes';
import {
  getSaleDeliveryTotal,
  getSaleDisplayProductName,
  getSaleLineCount,
  getSaleLines,
  getSaleTotalQuantity,
} from '../../utils/saleLines';

export function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { canUpdate } = useModuleAccess(AppModule.SALES);
  const currency = company?.currency ?? 'AED';

  const { entity: sale, loading, notFound, reload } = useEntityDetail({
    id: saleId,
    fetch: firestoreService.sales.get,
    errorMessage: 'Failed to load sale',
  });

  const e = sale?.economics;
  const saleLines = sale ? getSaleLines(sale) : [];
  const lineCount = sale ? getSaleLineCount(sale) : 0;
  const pctLabel = e ? taxPercentLabel(e.taxType) : 'Tax %';
  const profitPositive = (sale?.profit ?? 0) >= 0;

  const persistAttachments = async (attachments: NonNullable<typeof sale>['attachments']) => {
    if (!company || !sale || !user) return;
    await firestoreService.sales.update(company.id, sale.id, { attachments }, user.uid);
    reload();
  };

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading sale…"
      notFound={notFound}
      notFoundTitle="Sale not found"
      notFoundDescription="This order may have been deleted."
      backTo="/sales"
      backLabel="Back to sales"
      title={sale ? `Order ${sale.orderNumber ?? sale.orderId ?? ''}` : 'Sale'}
      description={
        sale
          ? `${getSaleDisplayProductName(sale)} · ${sale.platform}${lineCount > 1 ? ` · ${lineCount} items` : ''}`
          : undefined
      }
      meta={
        sale ? (
          <DetailMetaRow>
            <DetailMetaChip tone="indigo" icon={<Calendar className="w-3 h-3" />}>
              {formatDateLocal(sale.orderDate)}
            </DetailMetaChip>
            <DetailMetaChip tone="gray">{sale.platform}</DetailMetaChip>
            <DetailMetaChip tone="gray">
              {lineCount > 1 ? `${lineCount} items` : `Qty ${getSaleTotalQuantity(sale)}`}
            </DetailMetaChip>
            <SaleStatusBadge status={sale.status} />
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        sale ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/sales/${sale.id}/print`)}
            >
              <Printer className="w-4 h-4" />
              Print invoice
            </Button>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/sales/${sale.id}/edit`)}
              >
                <Pencil className="w-4 h-4" />
                Edit sale
              </Button>
            ) : null}
            {(sale.balanceDue ??
              Math.max(0, (sale.total ?? sale.grossRevenue) - (sale.totalPaid ?? 0))) > 0 ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate(`/payments/new?sale=${sale.id}`)}
              >
                <Wallet className="w-4 h-4" />
                Record payment
              </Button>
            ) : null}
          </div>
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
              <DetailField
                label="Order number"
                value={sale.orderNumber ?? '—'}
                valueClassName="font-mono text-xs"
              />
              <DetailField
                label="Marketplace order ID"
                value={sale.orderId}
                valueClassName="font-mono text-xs"
              />
              <DetailField label="Order date" value={formatDateLocal(sale.orderDate)} />
              <DetailField
                label="Items"
                value={
                  lineCount > 1
                    ? `${lineCount} products · ${getSaleTotalQuantity(sale)} units`
                    : String(getSaleTotalQuantity(sale))
                }
              />
              <DetailField label="Delivery" value={deliveryModeLabel(sale.deliveryMode)} />
              <DetailField label="Platform" value={sale.platform} />
              <DetailField
                label="Customer"
                value={
                  sale.customerName ? (
                    sale.customerId ? (
                      <Link to={`/customers/${sale.customerId}`} className={`text-sm ${detailLinkClass}`}>
                        {sale.customerName} →
                      </Link>
                    ) : (
                      sale.customerName
                    )
                  ) : null
                }
              />
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
              <DetailField
                label="Received"
                value={formatMoney(sale.totalPaid ?? 0, currency)}
                valueClassName="tabular-nums"
              />
              <DetailField
                label="Balance due"
                value={formatMoney(
                  sale.balanceDue ?? Math.max(0, (sale.total ?? sale.grossRevenue) - (sale.totalPaid ?? 0)),
                  currency
                )}
                valueClassName="tabular-nums font-medium"
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
            icon={ShoppingCart}
            iconTone="indigo"
            title="Order items"
            description="Products included in this marketplace order."
          >
            <div className="overflow-x-auto -mx-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 px-3 font-medium text-right">Qty</th>
                    <th className="py-2 px-3 font-medium text-right">Selling</th>
                    <th className="py-2 px-3 font-medium text-right">Purchase</th>
                    <th className="py-2 pl-3 font-medium text-right">Line revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {saleLines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-gray-100 dark:border-gray-800/80 last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <Link to={`/products/${line.productId}`} className={detailLinkClass}>
                          {line.productName}
                        </Link>
                        {line.variantLabel ? (
                          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {line.variantLabel}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatMoney(line.economics.sellingPrice, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatMoney(line.economics.purchasePrice, currency)}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium">
                        {formatMoney(line.economics.sellingPrice * line.quantity, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <DetailSection
            icon={Layers}
            iconTone="violet"
            title="Economics & tax"
            description="Order-level cost snapshot recorded when this sale was logged."
          >
            <DetailGrid columns={3}>
              <DetailField
                label="Delivery mode"
                value={deliveryModeLabel(sale.deliveryMode)}
              />
              <DetailField
                label="Delivery total"
                value={formatMoney(getSaleDeliveryTotal(sale), currency)}
                valueClassName="tabular-nums font-medium"
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

          <EntityAttachmentsDetailSection
            orgId={company!.orgId}
            companyId={company!.id}
            collection="sales"
            entityId={sale.id}
            userId={user!.uid}
            attachments={sale.attachments ?? []}
            onAttachmentsChange={persistAttachments}
            canEdit={canUpdate}
          />
        </>
      )}
    </EntityDetailShell>
  );
}
