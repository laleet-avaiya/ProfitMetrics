import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { PaymentAmountField } from '../../components/PaymentAmountField/PaymentAmountField';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import {
  FormFieldGroup,
  FormFieldGroupDivider,
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPanel,
  FormSidebarRow,
  FormSidebarSection,
} from '../../components/FormPage';
import { FormTabs } from '../../components/ui/FormTabs';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { PAYMENT_KIND_OPTIONS } from '../../constants/paymentKinds';
import { PAYMENT_MODE_OPTIONS } from '../../constants/paymentModes';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { firestoreService } from '../../services/firestore';
import type { Customer, Invoice, Payment } from '../../types';
import { PaymentKind, PaymentMode } from '../../types';
import { getActiveCustomers } from '../../utils/customerHelpers';
import {
  buildPaymentFromForm,
  emptyPaymentForm,
  paymentToForm,
  syncInvoicePaymentRollup,
  type PaymentFormState,
} from '../../utils/paymentHelpers';
import { formatMoney } from '../../utils/profit';

type PaymentFormTab = 'details';

export function PaymentFormPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const { getPayoutPlatformOptions } = useCompanyMarketplaces();
  const currency = company?.currency ?? 'AED';
  const isEditing = Boolean(paymentId);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PaymentFormState>(() => emptyPaymentForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentFormTab>('details');

  const marketplacePlatformOptions = useMemo(
    () => getPayoutPlatformOptions(form.platform ? [form.platform] : undefined),
    [form.platform, getPayoutPlatformOptions]
  );

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
    return () => {
      cancelled = true;
    };
  }, [company, isEditing, paymentId, searchParams]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === form.invoiceId),
    [invoices, form.invoiceId]
  );

  const amountNum = parseFloat(form.amount);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!hasAmount) {
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
        await firestoreService.payments.update(company.id, payment.id, payload, user!.uid);
      } else {
        await firestoreService.payments.create(company.id, payload, user!.uid);
      }

      if (payload.invoiceId) {
        await syncInvoicePaymentRollup(company.id, payload.invoiceId, user!.uid);
      }
      if (prevInvoiceId && prevInvoiceId !== payload.invoiceId) {
        await syncInvoicePaymentRollup(company.id, prevInvoiceId, user!.uid);
      }

      notification.success(isEditing ? 'Payment updated' : 'Payment recorded');
      navigate(isEditing && payment ? `/payments/${payment.id}` : '/payments');
    } catch {
      notification.error('Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const cancelTo = isEditing && payment ? `/payments/${payment.id}` : '/payments';

  const formTabs = [{ id: 'details' as const, label: 'Details', icon: Wallet }];

  const sidebar = (
    <FormSidebarSection title="Payment">
      <FormSidebarRow
        label="Amount"
        value={hasAmount ? formatMoney(amountNum, currency) : '—'}
        emphasize
      />
      {form.kind === PaymentKind.INVOICE && selectedInvoice ? (
        <FormSidebarRow
          label="Invoice due"
          value={formatMoney(selectedInvoice.balanceDue, currency)}
        />
      ) : null}
    </FormSidebarSection>
  );

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading payment…" />
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit payment' : 'Record payment'}
          description="Invoice payment, direct receipt, or marketplace payout."
          actions={
            <FormPageHeaderActions
              formId="payment-form"
              onCancel={() => navigate(cancelTo)}
              saving={saving}
              isEditing={isEditing}
              createLabel="Record payment"
              editLabel="Save"
              showSparkle={false}
            />
          }
        />

        <FormPageBody id="payment-form" onSubmit={handleSubmit}>
          <FormTabs
            tabs={formTabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as PaymentFormTab)}
            ariaLabel="Payment form sections"
          />

          <FormPageGrid sidebar={sidebar}>
            <FormPanel role="tabpanel">
              {activeTab === 'details' ? (
                <>
              <FormFieldGroup title="Payment details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Payment date"
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  />
                  {form.kind === PaymentKind.INVOICE ? (
                    <PaymentAmountField
                      value={form.amount}
                      onChange={(amount) => setForm((p) => ({ ...p, amount }))}
                      pendingAmount={selectedInvoice?.balanceDue ?? 0}
                      currency={currency}
                      required
                    />
                  ) : (
                    <Input
                      label="Amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                    />
                  )}
                  <Select
                    label="Payment type"
                    value={form.kind}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, kind: e.target.value as PaymentKind }))
                    }
                    options={PAYMENT_KIND_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                  <Select
                    label="Payment mode"
                    value={form.paymentMode}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, paymentMode: e.target.value as PaymentMode }))
                    }
                    options={PAYMENT_MODE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                  <Input
                    label="Reference"
                    value={form.reference}
                    onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder="Transfer ref, cheque no."
                  />
                </div>
              </FormFieldGroup>

              {(form.kind === PaymentKind.INVOICE ||
                form.kind === PaymentKind.MARKETPLACE_PAYOUT ||
                form.kind === PaymentKind.DIRECT) && <FormFieldGroupDivider />}

              {form.kind === PaymentKind.INVOICE ? (
                <FormFieldGroup title="Invoice link">
                  <Select
                    label="Invoice"
                    value={form.invoiceId}
                    onChange={(e) => setForm((p) => ({ ...p, invoiceId: e.target.value }))}
                    options={[
                      { value: '', label: 'Select invoice…' },
                      ...openInvoices.map((i) => ({
                        value: i.id,
                        label: `${i.invoiceNumber} — ${i.customerName} (${i.balanceDue} due)`,
                      })),
                    ]}
                  />
                </FormFieldGroup>
              ) : null}

              {form.kind === PaymentKind.MARKETPLACE_PAYOUT ? (
                <FormFieldGroup title="Marketplace">
                  <Select
                    label="Platform"
                    value={form.platform}
                    onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                    options={marketplacePlatformOptions}
                  />
                </FormFieldGroup>
              ) : null}

              {form.kind === PaymentKind.DIRECT || form.kind === PaymentKind.MARKETPLACE_PAYOUT ? (
                <FormFieldGroup title="Customer (optional)">
                  <Select
                    label="Customer"
                    value={form.customerId}
                    onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                    options={[
                      { value: '', label: 'None' },
                      ...activeCustomers.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </FormFieldGroup>
              ) : null}

              <FormFieldGroupDivider />

              <Textarea
                label="Notes"
                optional
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Optional notes"
              />
                </>
              ) : null}
            </FormPanel>
          </FormPageGrid>

          <FormPageMobileActions
            onCancel={() => navigate(cancelTo)}
            saving={saving}
            isEditing={isEditing}
            createLabel="Record payment"
            editLabel="Save"
          />
        </FormPageBody>
      </PageShell>
    </Layout>
  );
}
