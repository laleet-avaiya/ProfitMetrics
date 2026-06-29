import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select } from '../../components/Select/Select';
import { FormActions } from '../../components/FormActions/FormActions';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Vendor } from '../../types';
import {
  buildVendorFromForm,
  emptyVendorForm,
  vendorToForm,
  type VendorFormState,
} from '../../utils/vendorHelpers';

export function VendorFormPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(vendorId);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<VendorFormState>(() => emptyVendorForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isEditing || !company || !vendorId) {
      setForm(emptyVendorForm());
      setVendor(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    firestoreService.vendors
      .get(company.id, vendorId)
      .then((found) => {
        if (cancelled) return;
        if (found?.deleted) {
          setVendor(null);
          setForm(emptyVendorForm());
          return;
        }
        setVendor(found);
        setForm(found ? vendorToForm(found) : emptyVendorForm());
      })
      .catch((err) => {
        console.error('Failed to load vendor:', err);
        if (!cancelled) notification.error('Failed to load vendor');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company, isEditing, vendorId]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Vendor name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildVendorFromForm(form, company.id, vendor ?? undefined);

      if (isEditing && vendor) {
        await firestoreService.vendors.update(company.id, vendor.id, payload);
        notification.success('Vendor updated');
        navigate(`/vendors/${vendor.id}`);
      } else {
        const created = await firestoreService.vendors.create(company.id, payload);
        notification.success('Vendor added');
        navigate(`/vendors/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to save vendor:', err);
      notification.error('Failed to save vendor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading vendor…</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !vendor) {
    return (
      <Layout>
        <PageShell>
          <PageHeader title="Vendor not found" description="This vendor may have been deleted." />
          <Button type="button" variant="outline" onClick={() => navigate('/vendors')}>
            Back to vendors
          </Button>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit vendor' : 'Add vendor'}
          description={
            isEditing
              ? `Update details for ${vendor?.name ?? 'vendor'}.`
              : 'Add a supplier or payee to link with expenses.'
          }
        />

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <Input
            label="Vendor name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
            required
            placeholder="e.g. Amazon Ads, Shopify, packaging supplier"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact name"
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Website"
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <Select
            label="Status"
            value={form.status}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
            onChange={(e) => {
              const nextStatus = e.target.value as Vendor['status'];
              if (nextStatus === form.status) return;

              const archiving = nextStatus === 'archived';
              notification.confirm({
                title: archiving ? 'Archive vendor?' : 'Restore vendor?',
                message: archiving
                  ? 'This vendor will be archived and hidden from new expense entries.'
                  : 'This vendor will be restored and available for new expenses.',
                confirmLabel: archiving ? 'Archive' : 'Restore',
                variant: 'primary',
                onConfirm: () => setForm((f) => ({ ...f, status: nextStatus })),
              });
            }}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional — payment terms, account numbers, etc."
            rows={2}
          />

          <FormActions layout="end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditing && vendor ? `/vendors/${vendor.id}` : '/vendors')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {isEditing ? 'Save changes' : 'Add vendor'}
            </Button>
          </FormActions>
        </form>
      </PageShell>
    </Layout>
  );
}
