import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Package,
  Pencil,
  Truck,
  Wallet,
} from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { PaymentAmountField } from '../../components/PaymentAmountField/PaymentAmountField';
import { Select } from '../../components/Select/Select';
import { Textarea } from '../../components/Textarea/Textarea';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import {
  purchasePaymentStatusLabel,
  purchaseStatusLabel,
} from '../../constants/purchaseStatuses';
import { PAYMENT_MODE_OPTIONS, paymentModeLabel } from '../../constants/paymentModes';
import { firestoreService } from '../../services/firestore';
import type { PurchaseOrder, PurchaseOrderLine } from '../../types';
import {
  PaymentMode,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
} from '../../types';
import { formatDateLocal } from '../../utils/date';
import {
  derivePaymentStatus,
  derivePurchaseStatus,
} from '../../utils/purchaseHelpers';
import { syncPurchaseExpenses } from '../../utils/purchaseExpenses';
import { syncPurchaseStockReceipts } from '../../utils/purchaseStock';
import { createListingId } from '../../utils/productDefaults';
import { localDateInputToUtc, nowUtc, utcToLocalDateInput } from '../../utils/firestoreDates';
import { formatMoney } from '../../utils/profit';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function PurchaseDetailPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const { entity: purchase, loading, notFound, reload } = useEntityDetail({
    id: purchaseId,
    fetch: firestoreService.purchases.get,
    errorMessage: 'Failed to load purchase order',
  });

  const [receivedQty, setReceivedQty] = useState<Record<string, string>>({});
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{
    paymentDate: string;
    amount: string;
    paymentMode: PaymentMode;
    reference: string;
    notes: string;
  }>({
    paymentDate: utcToLocalDateInput(new Date()),
    amount: '',
    paymentMode: PaymentMode.CASH,
    reference: '',
    notes: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (!purchase) return;
    const map: Record<string, string> = {};
    for (const line of purchase.lines) {
      map[line.id] = String(line.quantityReceived);
    }
    setReceivedQty(map);
  }, [purchase]);

  const isCancelled = purchase?.status === PurchaseOrderStatus.CANCELLED;

  const buildUpdatedLines = useCallback((): PurchaseOrderLine[] | null => {
    if (!purchase) return null;
    return purchase.lines.map((line) => {
      const raw = receivedQty[line.id] ?? String(line.quantityReceived);
      const parsed = Math.max(0, Math.floor(parseFloat(raw) || 0));
      const quantityReceived = Math.min(line.quantityOrdered, parsed);
      return { ...line, quantityReceived };
    });
  }, [purchase, receivedQty]);

  const handleSaveReceipts = async () => {
    if (!company || !purchase || isCancelled) return;
    const lines = buildUpdatedLines();
    if (!lines) return;

    setSavingReceipt(true);
    try {
      const status = derivePurchaseStatus(lines);
      const updated: PurchaseOrder = {
        ...purchase,
        lines,
        status,
        receivedAt:
          status === PurchaseOrderStatus.RECEIVED ? purchase.receivedAt ?? nowUtc() : purchase.receivedAt,
        updatedAt: nowUtc(),
      };

      await syncPurchaseStockReceipts(company.id, purchase, updated);
      await firestoreService.purchases.update(company.id, purchase.id, {
        lines,
        status,
        receivedAt: updated.receivedAt,
        updatedAt: updated.updatedAt,
      });
      reload();
      notification.success('Receipts updated and stock adjusted');
    } catch (err) {
      console.error(err);
      notification.error(err instanceof Error ? err.message : 'Failed to update receipts');
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleMarkAllReceived = async () => {
    if (!purchase) return;
    const map: Record<string, string> = {};
    for (const line of purchase.lines) {
      map[line.id] = String(line.quantityOrdered);
    }
    setReceivedQty(map);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !purchase || isCancelled) return;

    const amount = roundMoney(Math.max(0, parseFloat(paymentForm.amount) || 0));
    if (amount <= 0) return;

    setSavingPayment(true);
    try {
      const payment = {
        id: createListingId(),
        paymentDate: localDateInputToUtc(paymentForm.paymentDate),
        amount,
        paymentMode: paymentForm.paymentMode,
        reference: paymentForm.reference.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      };

      const payments = [...purchase.payments, payment];
      const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
      const balanceDue = roundMoney(Math.max(0, purchase.total - totalPaid));

      let updated: PurchaseOrder = {
        ...purchase,
        payments,
        totalPaid,
        balanceDue,
        paymentStatus: derivePaymentStatus(purchase.total, totalPaid),
        updatedAt: nowUtc(),
      };

      await firestoreService.purchases.update(company.id, purchase.id, {
        payments,
        totalPaid,
        balanceDue,
        paymentStatus: updated.paymentStatus,
        updatedAt: updated.updatedAt,
      });

      updated = await syncPurchaseExpenses(company.id, updated);

      setPaymentForm({
        paymentDate: utcToLocalDateInput(new Date()),
        amount: '',
        paymentMode: PaymentMode.CASH,
        reference: '',
        notes: '',
      });
      reload();
      notification.success('Payment recorded');
    } catch (err) {
      console.error(err);
      notification.error('Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const paymentProgress = useMemo(() => {
    if (!purchase || purchase.total <= 0) return 0;
    return Math.min(100, Math.round((purchase.totalPaid / purchase.total) * 100));
  }, [purchase]);

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading purchase order…"
      loadingIcon={ClipboardList}
      notFound={notFound}
      notFoundTitle="Purchase order not found"
      notFoundDescription="This PO may have been deleted."
      backTo="/purchases"
      backLabel="Back to purchases"
      title={purchase ? `PO ${purchase.poNumber}` : 'Purchase order'}
      description={purchase?.vendorName ?? undefined}
      meta={
        purchase ? (
          <DetailMetaRow>
            <DetailMetaChip tone="indigo">{formatDateLocal(purchase.purchaseDate)}</DetailMetaChip>
            <DetailMetaChip tone="gray">{purchaseStatusLabel(purchase.status)}</DetailMetaChip>
            <DetailMetaChip tone="gray">{purchasePaymentStatusLabel(purchase.paymentStatus)}</DetailMetaChip>
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        purchase && !isCancelled ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit PO
          </Button>
        ) : null
      }
    >
      {purchase && (
        <>
          <DetailStatStrip
            stats={[
              {
                label: 'Order total',
                value: formatMoney(purchase.total, currency),
                icon: ClipboardList,
                tone: 'indigo',
              },
              {
                label: 'Paid',
                value: formatMoney(purchase.totalPaid, currency),
                subtext: `${paymentProgress}% of total`,
                icon: Wallet,
                tone: 'emerald',
              },
              {
                label: 'Balance due',
                value: formatMoney(purchase.balanceDue, currency),
                icon: Building2,
                tone: purchase.balanceDue > 0 ? 'amber' : 'emerald',
              },
            ]}
          />

          <DetailSection
            icon={ClipboardList}
            iconTone="indigo"
            title="Order details"
          >
            <DetailGrid columns={3}>
              <DetailField label="PO number" value={purchase.poNumber} valueClassName="font-mono text-xs" />
              <DetailField label="Reference" value={purchase.reference ?? '—'} valueClassName="font-mono text-xs" />
              <DetailField
                label="Vendor"
                value={
                  purchase.vendorId ? (
                    <Link to={`/vendors/${purchase.vendorId}`} className={detailLinkClass}>
                      {purchase.vendorName}
                    </Link>
                  ) : (
                    purchase.vendorName ?? '—'
                  )
                }
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            icon={Package}
            iconTone="indigo"
            title="Line items"
            description="Products ordered with purchase and selling prices."
          >
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Purchase</th>
                    <th className="px-3 py-2 text-right">Selling</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {purchase.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <Link to={`/products/${line.productId}`} className={detailLinkClass}>
                          {line.productName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantityOrdered}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantityReceived}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(line.purchasePrice, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(line.sellingPrice, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatMoney(line.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DetailGrid columns={3}>
              <DetailField label="Subtotal" value={formatMoney(purchase.subtotal, currency)} />
              <DetailField label="Tax" value={formatMoney(purchase.taxAmount, currency)} />
              <DetailField label="Total" value={formatMoney(purchase.total, currency)} valueClassName="font-semibold" />
            </DetailGrid>
          </DetailSection>

          {!isCancelled ? (
            <DetailSection
              icon={Truck}
              iconTone="violet"
              title="Receive goods"
              description="Mark received quantities — stock is added automatically with weighted average pricing."
              headerAction={
                <Button type="button" variant="outline" size="sm" onClick={handleMarkAllReceived}>
                  Mark all received
                </Button>
              }
            >
              <div className="space-y-3">
                {purchase.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div aria-hidden="true" className="flex-1 min-w-[140px]">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{line.productName}</p>
                      <p className="text-xs text-gray-500">Ordered: {line.quantityOrdered}</p>
                    </div>
                    <div className="w-28">
                      <Input
                        label="Received"
                        type="number"
                        min={0}
                        max={line.quantityOrdered}
                        value={receivedQty[line.id] ?? '0'}
                        onChange={(e) =>
                          setReceivedQty((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveReceipts}
                  disabled={savingReceipt}
                >
                  {savingReceipt ? 'Saving…' : 'Update receipts & stock'}
                </Button>
              </div>
            </DetailSection>
          ) : null}

          {!isCancelled ? (
            <DetailSection
              icon={Wallet}
              iconTone="emerald"
              title="Payments"
              description="Record vendor payments — each payment auto-creates an expense."
            >
              {purchase.payments.length > 0 ? (
                <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Mode</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Expense</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {purchase.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-2">{formatDateLocal(payment.paymentDate)}</td>
                          <td className="px-3 py-2">{paymentModeLabel(payment.paymentMode)}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {payment.reference ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatMoney(payment.amount, currency)}
                          </td>
                          <td className="px-3 py-2">
                            {payment.expenseId ? (
                              <Link to={`/expenses/${payment.expenseId}`} className={detailLinkClass}>
                                View expense
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No payments recorded yet.</p>
              )}

              {purchase.paymentStatus !== PurchasePaymentStatus.PAID ? (
                <form onSubmit={handleAddPayment} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Add payment</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Payment date"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) =>
                        setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))
                      }
                    />
                    <PaymentAmountField
                      value={paymentForm.amount}
                      onChange={(amount) => setPaymentForm((p) => ({ ...p, amount }))}
                      pendingAmount={purchase.balanceDue}
                      currency={currency}
                    />
                    <Select
                      label="Payment mode"
                      value={paymentForm.paymentMode}
                      onChange={(e) =>
                        setPaymentForm((p) => ({ ...p, paymentMode: e.target.value as PaymentMode }))
                      }
                      options={PAYMENT_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    />
                    <Input
                      label="Reference"
                      value={paymentForm.reference}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                      placeholder="Cheque, transfer ref…"
                    />
                  </div>
                  <Textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    placeholder="Notes (optional)"
                  />
                  <Button type="submit" variant="primary" disabled={savingPayment}>
                    {savingPayment ? 'Saving…' : 'Record payment'}
                  </Button>
                </form>
              ) : null}
            </DetailSection>
          ) : null}

          {purchase.vendorId ? (
            <DetailSection
              icon={Building2}
              iconTone="indigo"
              title="Vendor"
              description="Linked supplier for this order."
            >
              <Link to={`/vendors/${purchase.vendorId}`} className={`text-sm ${detailLinkClass}`}>
                {purchase.vendorName} → View vendor ledger
              </Link>
            </DetailSection>
          ) : null}

          {purchase.notes ? <DetailNotes>{purchase.notes}</DetailNotes> : null}
        </>
      )}
    </EntityDetailShell>
  );
}
