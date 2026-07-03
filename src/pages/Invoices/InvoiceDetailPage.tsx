import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Package, Pencil, Printer, Truck, UserCircle, Wallet } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip } from '../../components/DetailPage/DetailStatStrip';
import { SaleStatusBadge } from '../../components/ui/SaleStatusBadge';
import { Button } from '../../components/Button/Button';
import { PaymentAmountField } from '../../components/PaymentAmountField/PaymentAmountField';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { useModuleAccess } from '../../hooks/usePermissions';
import { invoiceStatusLabel } from '../../constants/invoiceStatuses';
import { PAYMENT_MODE_OPTIONS, paymentModeLabel } from '../../constants/paymentModes';
import { purchasePaymentStatusLabel } from '../../constants/purchaseStatuses';
import { firestoreService } from '../../services/firestore';
import type { Payment } from '../../types';
import { InvoiceStatus, PaymentKind, PaymentMode, PurchasePaymentStatus } from '../../types';
import { formatDateLocal } from '../../utils/date';
import { buildPaymentFromForm, emptyPaymentForm, syncInvoicePaymentRollup } from '../../utils/paymentHelpers';
import { utcToLocalDateInput } from '../../utils/firestoreDates';
import { formatMoney } from '../../utils/profit';

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { canUpdate } = useModuleAccess(AppModule.INVOICES);
  const notification = useNotification();
  const currency = company?.currency ?? 'AED';

  const { entity: invoice, loading, notFound, reload } = useEntityDetail({
    id: invoiceId,
    fetch: firestoreService.invoices.get,
    errorMessage: 'Failed to load invoice',
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentForm, setPaymentForm] = useState(() => emptyPaymentForm(PaymentKind.INVOICE));
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (!company || !invoiceId) return;
    firestoreService.payments.getAll(company.id).then((list) => {
      setPayments(list.filter((p) => !p.deleted && p.invoiceId === invoiceId));
    });
  }, [company, invoiceId, invoice?.totalPaid]);

  const isVoid = invoice?.status === InvoiceStatus.VOID;

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !invoice || isVoid) return;
    const amount = Math.max(0, parseFloat(paymentForm.amount) || 0);
    if (amount <= 0) return;

    setSavingPayment(true);
    try {
      const form = { ...paymentForm, kind: PaymentKind.INVOICE, invoiceId: invoice.id, customerId: invoice.customerId ?? '' };
      const payload = buildPaymentFromForm(form, company.id, invoice);
      await firestoreService.payments.create(company.id, payload, user!.uid);
      await syncInvoicePaymentRollup(company.id, invoice.id, user!.uid);
      setPaymentForm({ ...emptyPaymentForm(PaymentKind.INVOICE), paymentDate: utcToLocalDateInput(new Date()) });
      reload();
      const updatedPayments = await firestoreService.payments.getAll(company.id);
      setPayments(updatedPayments.filter((p) => !p.deleted && p.invoiceId === invoice.id));
      notification.success('Payment recorded');
    } catch {
      notification.error('Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const paymentProgress = useMemo(() => {
    if (!invoice || invoice.total <= 0) return 0;
    return Math.min(100, Math.round((invoice.totalPaid / invoice.total) * 100));
  }, [invoice]);

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading invoice…"
      notFound={notFound}
      notFoundTitle="Invoice not found"
      notFoundDescription="This invoice may have been deleted."
      backTo="/sales"
      backLabel="Back to sales"
      title={invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice'}
      description={invoice?.customerName ?? undefined}
      meta={
        invoice ? (
          <DetailMetaRow>
            <DetailMetaChip tone="indigo">{formatDateLocal(invoice.invoiceDate)}</DetailMetaChip>
            <DetailMetaChip tone="gray">{invoiceStatusLabel(invoice.status)}</DetailMetaChip>
            <DetailMetaChip tone="gray">{purchasePaymentStatusLabel(invoice.paymentStatus)}</DetailMetaChip>
            <SaleStatusBadge status={invoice.deliveryStatus} />
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        invoice && !isVoid ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/invoices/${invoice.id}/print`)}>
              <Printer className="w-4 h-4" />
              Print invoice
            </Button>
            {canUpdate ? (
              <Button variant="outline" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {invoice && (
        <>
          <DetailStatStrip
            stats={[
              { label: 'Total', value: formatMoney(invoice.total, currency), icon: FileText, tone: 'indigo' },
              { label: 'Paid', value: formatMoney(invoice.totalPaid, currency), subtext: `${paymentProgress}%`, icon: Wallet, tone: 'emerald' },
              { label: 'Balance', value: formatMoney(invoice.balanceDue, currency), icon: UserCircle, tone: invoice.balanceDue > 0 ? 'amber' : 'emerald' },
              { label: 'Profit', value: formatMoney(invoice.profit, currency), icon: Package, tone: invoice.profit >= 0 ? 'emerald' : 'rose' },
            ]}
          />

          <DetailSection icon={Package} iconTone="indigo" title="Line items">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500">
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2"><Link to={`/products/${line.productId}`} className={detailLinkClass}>{line.productName}</Link></td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.unitPrice, currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(line.lineTotal, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DetailGrid columns={3}>
              <DetailField label="Subtotal" value={formatMoney(invoice.subtotal, currency)} />
              <DetailField label="Tax" value={formatMoney(invoice.taxAmount, currency)} />
              <DetailField label="COGS" value={formatMoney(invoice.totalCogs, currency)} />
            </DetailGrid>
          </DetailSection>

          {invoice.customerId ? (
            <DetailSection icon={UserCircle} iconTone="violet" title="Customer">
              <Link to={`/customers/${invoice.customerId}`} className={`text-sm ${detailLinkClass}`}>{invoice.customerName} →</Link>
            </DetailSection>
          ) : null}

          <DetailSection icon={Truck} iconTone="indigo" title="Delivery" description="Fulfillment status and courier tracking for this offline order.">
            <DetailGrid columns={3}>
              <DetailField label="Delivery status" value={<SaleStatusBadge status={invoice.deliveryStatus} />} />
              <DetailField label="Carrier" value={invoice.carrier || '—'} />
              <DetailField label="Tracking ID" value={invoice.trackingId || '—'} />
            </DetailGrid>
          </DetailSection>

          {!isVoid && (
            <DetailSection icon={Wallet} iconTone="emerald" title="Payments" description="Record customer payments — each appears in the Payments list.">
              {payments.length > 0 && (
                <div className="mb-4 overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs uppercase text-gray-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2">{formatDateLocal(p.paymentDate)}</td>
                          <td className="px-3 py-2">{paymentModeLabel(p.paymentMode)}</td>
                          <td className="px-3 py-2">{p.reference ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(p.amount, currency)}</td>
                          <td className="px-3 py-2"><Link to={`/payments/${p.id}`} className={detailLinkClass}>View</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {invoice.paymentStatus !== PurchasePaymentStatus.PAID && (
                <form onSubmit={handleAddPayment} className="rounded-lg border p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Payment date" type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                    <PaymentAmountField
                      value={paymentForm.amount}
                      onChange={(amount) => setPaymentForm((p) => ({ ...p, amount }))}
                      pendingAmount={invoice.balanceDue}
                      currency={currency}
                    />
                    <Select
                      label="Payment mode"
                      value={paymentForm.paymentMode}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMode: e.target.value as PaymentMode }))}
                      options={PAYMENT_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    />
                    <Input label="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))} />
                  </div>
                  <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notes" />
                  <Button type="submit" variant="primary" loading={savingPayment}>Record payment</Button>
                </form>
              )}
            </DetailSection>
          )}

          {invoice.notes ? <DetailNotes>{invoice.notes}</DetailNotes> : null}
        </>
      )}
    </EntityDetailShell>
  );
}
