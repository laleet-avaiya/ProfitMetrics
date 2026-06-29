import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Sparkles,
  UserCircle,
} from 'lucide-react';
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

  const cancelTo = isEditing && vendor ? `/vendors/${vendor.id}` : '/vendors';
  const isReady = !isEditing && form.name.trim().length > 0;

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading vendor…</p>
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
          actions={
            <div className="hidden lg:flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(cancelTo)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="vendor-form" variant="primary" loading={saving}>
                {!isEditing && !saving ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Add vendor
                  </>
                ) : isEditing ? (
                  'Save changes'
                ) : (
                  'Add vendor'
                )}
              </Button>
            </div>
          }
        />

        <form id="vendor-form" onSubmit={handleSubmit} className="w-full space-y-5 pb-2">
          <FormSection
            icon={Building2}
            iconTone="indigo"
            step={isEditing ? undefined : 1}
            title="Vendor details"
            description="Name and status for this payee."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8">
                <Input
                  label="Vendor name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={errors.name}
                  required
                  placeholder="e.g. Amazon Ads, Shopify, packaging supplier"
                />
              </div>
              <div className="lg:col-span-4">
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
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={UserCircle}
            iconTone="violet"
            step={isEditing ? undefined : 2}
            title="Contact"
            description="Optional contact details for this vendor."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-3">
                <Input
                  label="Contact name"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="lg:col-span-3">
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="lg:col-span-3">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="lg:col-span-3">
                <Input
                  label="Website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="lg:col-span-12">
                <Textarea
                  label="Notes"
                  optional
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Payment terms, account numbers, etc."
                  rows={2}
                />
              </div>
            </div>
          </FormSection>

          {isReady && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <span className="font-medium">{form.name.trim()}</span> is ready — add contact details if
                needed, then create your vendor.
              </p>
            </div>
          )}

          <FormStickyActions className="lg:hidden">
            <Button type="button" variant="outline" onClick={() => navigate(cancelTo)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {!isEditing && !saving ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Add vendor
                </>
              ) : isEditing ? (
                'Save changes'
              ) : (
                'Add vendor'
              )}
            </Button>
          </FormStickyActions>
        </form>
      </PageShell>
    </Layout>
  );
}
