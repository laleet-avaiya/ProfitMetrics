import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { PAYMENT_KIND_OPTIONS } from '../../constants/paymentKinds';
import { PLATFORM_PRESETS } from '../../constants/platforms';
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice, Payment } from '../../types';
import { PaymentKind } from '../../types';
import { getActiveCustomers } from '../../utils/customerHelpers';
import {
  buildPaymentFromForm,
  emptyPaymentForm,
  paymentToForm,
  syncInvoicePaymentRollup,
  type PaymentFormState,
} from '../../utils/paymentHelpers';

export function PaymentFormPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(paymentId);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PaymentFormState>(() => emptyPaymentForm());
  const [saving, setSaving] = useState(false);

  const activeCustomers = useMemo(() => getActiveCustomers(customers), [customers]);
  const openInvoices = useMemo(
    () => invoices.filter((i) => i.balanceDue > 0),
    [invoices]
  );

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      firestoreService.customers.getAll(company.id),
      firestoreService.invoices.getAll(company.id),
      isEditing && paymentId ? firestoreService.payments.get(company.id, paymentId) : Promise.resolve(null),
    ]).then(([customerList, invoiceList, foundPayment]) => {
      if (cancelled) return;
      setCustomers(customerList.filter((c) => !c.deleted));
      setInvoices(invoiceList.filter((i) => !i.deleted));
      if (foundPayment?.deleted) {
        setPayment(null);
        setForm(emptyPaymentForm());
      } else if (foundPayment) {
        setPayment(foundPayment);
        setForm(paymentToForm(foundPayment));
      } else {
        setPayment(null);
        const initial = emptyPaymentForm(
          (searchParams.get('kind') as PaymentKind) || PaymentKind.DIRECT
        );
        const invoiceFromUrl = searchParams.get('invoice');
        const customerFromUrl = searchParams.get('customer');
        if (invoiceFromUrl) {
          initial.kind = PaymentKind.INVOICE;
          initial.invoiceId = invoiceFromUrl;
        } else if (customerFromUrl) {
          initial.customerId = customerFromUrl;
        }
        setForm(initial);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [company, isEditing, paymentId, searchParams]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === form.invoiceId),
    [invoices, form.invoiceId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notification.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      const payload = buildPaymentFromForm(
        form,
        company.id,
        selectedInvoice,
        customer,
        payment ?? undefined
      );
      const prevInvoiceId = payment?.invoiceId;

      if (isEditing && payment) {
        await firestoreService.payments.update(company.id, payment.id, payload);
      } else {
        await firestoreService.payments.create(company.id, payload);
      }

      if (payload.invoiceId) {
        await syncInvoicePaymentRollup(company.id, payload.invoiceId);
      }
      if (prevInvoiceId && prevInvoiceId !== payload.invoiceId) {
        await syncInvoicePaymentRollup(company.id, prevInvoiceId);
      }

      notification.success(isEditing ? 'Payment updated' : 'Payment recorded');
      navigate(isEditing && payment ? `/payments/${payment.id}` : '/payments');
    } catch {
      notification.error('Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Layout><PageShell><p className="text-center py-20">Loading…</p></PageShell></Layout>;
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader title={isEditing ? 'Edit payment' : 'Record payment'} description="Invoice payment, direct receipt, or marketplace payout." />
        <form onSubmit={handleSubmit} className="space-y-6 pb-24">
          <FormSection icon={Wallet} title="Payment details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Payment date" type="date" value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} />
              <Input label="Amount" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required />
              <Select label="Payment type" value={form.kind} onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as PaymentKind }))}
                options={PAYMENT_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <Input label="Reference" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Transfer ref, cheque no." />
            </div>
          </FormSection>

          {form.kind === PaymentKind.INVOICE && (
            <FormSection icon={Wallet} title="Invoice">
              <Select label="Invoice" value={form.invoiceId} onChange={(e) => setForm((p) => ({ ...p, invoiceId: e.target.value }))}
                options={[{ value: '', label: 'Select invoice…' }, ...openInvoices.map((i) => ({ value: i.id, label: `${i.invoiceNumber} — ${i.customerName} (${i.balanceDue} due)` }))]} />
            </FormSection>
          )}

          {form.kind === PaymentKind.MARKETPLACE_PAYOUT && (
            <FormSection icon={Wallet} title="Marketplace">
              <Select label="Platform" value={form.platform} onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                options={[{ value: '', label: 'Select platform…' }, ...PLATFORM_PRESETS.map((p) => ({ value: p, label: p }))]} />
            </FormSection>
          )}

          {(form.kind === PaymentKind.DIRECT || form.kind === PaymentKind.MARKETPLACE_PAYOUT) && (
            <FormSection icon={Wallet} title="Customer (optional)">
              <Select label="Customer" value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                options={[{ value: '', label: 'None' }, ...activeCustomers.map((c) => ({ value: c.id, label: c.name }))]} />
            </FormSection>
          )}

          <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Notes" />

          <FormStickyActions>
            <Button type="button" variant="outline" onClick={() => navigate(isEditing && payment ? `/payments/${payment.id}` : '/payments')} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>{isEditing ? 'Save' : 'Record payment'}</Button>
          </FormStickyActions>
        </form>
      </PageShell>
    </Layout>
  );
}
