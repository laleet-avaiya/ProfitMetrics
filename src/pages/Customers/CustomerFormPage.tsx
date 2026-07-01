import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, UserCircle } from 'lucide-react';
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
import { firestoreService } from '../../services/firestore';
import type { Customer } from '../../types';
import {
  buildCustomerFromForm,
  customerToForm,
  emptyCustomerForm,
  type CustomerFormState,
} from '../../utils/customerHelpers';

export function CustomerFormPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(customerId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<CustomerFormState>(() => emptyCustomerForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isEditing || !company || !customerId) {
      setForm(emptyCustomerForm());
      setLoading(false);
      return;
    }
    firestoreService.customers.get(company.id, customerId).then((found) => {
      if (found?.deleted) {
        setCustomer(null);
        setForm(emptyCustomerForm());
      } else {
        setCustomer(found);
        setForm(found ? customerToForm(found) : emptyCustomerForm());
      }
      setLoading(false);
    });
  }, [company, isEditing, customerId]);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Customer name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !validate()) return;
    setSaving(true);
    try {
      const payload = buildCustomerFromForm(form, company.id, customer ?? undefined);
      if (isEditing && customer) {
        await firestoreService.customers.update(company.id, customer.id, payload);
        notification.success('Customer updated');
        navigate(`/customers/${customer.id}`);
      } else {
        const created = await firestoreService.customers.create(company.id, payload);
        notification.success('Customer added');
        navigate(`/customers/${created.id}`);
      }
    } catch {
      notification.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <p className="text-center py-20 text-gray-500">Loading…</p>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit customer' : 'New customer'}
          description="Contact details for offline sales."
        />
        <form onSubmit={handleSubmit} className="space-y-6 pb-24">
          <FormSection icon={UserCircle} title="Customer details" description="Name and contact info.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} error={errors.name} required />
              <Input label="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Tax ID (TRN/GSTIN)" value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Customer['status'] }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </div>
            <div className="mt-4">
              <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="mt-4">
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </FormSection>
          <FormStickyActions>
            <Button type="button" variant="outline" onClick={() => navigate(isEditing && customer ? `/customers/${customer.id}` : '/customers')} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {!saving && <CheckCircle2 className="w-4 h-4" />}
              {isEditing ? 'Save changes' : 'Add customer'}
            </Button>
          </FormStickyActions>
        </form>
      </PageShell>
    </Layout>
  );
}
