import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Layers,
  Package,
  Sparkles,
} from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { FormSection } from '../../components/FormSection/FormSection';
import { FormStickyActions } from '../../components/FormStickyActions/FormStickyActions';
import { Button } from '../../components/Button/Button';
import { PlatformListingEditor } from '../../components/PlatformListingEditor/PlatformListingEditor';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, ProductPlatformListing } from '../../types';
import { createListingId, normalizeListings, platformToFormValues } from '../../utils/productDefaults';
import { nowUtc } from '../../utils/firestoreDates';

interface FormState {
  name: string;
  sku: string;
  description: string;
  category: string;
  status: Product['status'];
  platformListings: ProductPlatformListing[];
}

function emptyForm(): FormState {
  return {
    name: '',
    sku: '',
    description: '',
    category: '',
    status: 'active',
    platformListings: [],
  };
}

function productToForm(product: Product): FormState {
  return {
    name: product.name,
    sku: product.sku ?? '',
    description: product.description ?? '',
    category: product.category ?? '',
    status: product.status,
    platformListings: normalizeListings(product.platformListings ?? []),
  };
}

export function ProductFormPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { company } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; listings?: string }>({});

  useEffect(() => {
    if (!isEditing || !company || !productId) {
      setForm(emptyForm());
      setProduct(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    firestoreService.products
      .get(company.id, productId)
      .then((found) => {
        if (cancelled) return;
        if (found?.deleted) {
          setProduct(null);
          setForm(emptyForm());
          return;
        }
        setProduct(found);
        setForm(found ? productToForm(found) : emptyForm());
      })
      .catch((err) => {
        console.error('Failed to load product:', err);
        if (!cancelled) notification.error('Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company, isEditing, productId]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) {
      next.name = 'Product name is required';
    }
    if (form.platformListings.length === 0) {
      next.listings = 'Add at least one platform listing';
    }
    for (const listing of form.platformListings) {
      const { preset, customName } = platformToFormValues(listing.platform);
      if (!preset) {
        next.listings = 'Select a platform for each listing';
        break;
      }
      if (preset === 'Custom' && !customName.trim()) {
        next.listings = 'Enter a name for custom platforms';
        break;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const listings = normalizeListings(form.platformListings);
      const now = nowUtc();

      if (isEditing && product) {
        await firestoreService.products.update(company.id, product.id, {
          name: form.name.trim(),
          sku: form.sku.trim() || undefined,
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          status: 'active',
          platformListings: listings,
          updatedAt: now,
        });
        notification.success('Product updated');
      } else {
        const id = createListingId();
        const newProduct: Product = {
          id,
          companyId: company.id,
          name: form.name.trim(),
          sku: form.sku.trim() || undefined,
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          status: 'active',
          platformListings: listings,
          createdAt: now,
          updatedAt: now,
        };
        await firestoreService.products.create(company.id, newProduct);
        notification.success('Product created');
      }

      navigate('/products');
    } catch (err) {
      console.error('Failed to save product:', err);
      notification.error('Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currency = company?.currency ?? 'AED';

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading product…</p>
          </div>
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !product) {
    return (
      <Layout>
        <PageShell>
          <PageHeader title="Product not found" description="This product may have been deleted." />
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Back to products
          </Button>
        </PageShell>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageShell>
        <PageHeader
          title={isEditing ? 'Edit product' : 'Add product'}
          description={
            isEditing
              ? `Update ${product?.name ?? 'product'} details and platform economics.`
              : 'Set up once — every sale auto-fills costs and tax from here.'
          }
          actions={
            <div className="hidden lg:flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/products')}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" form="product-form" variant="primary" loading={saving}>
                {!isEditing && !saving ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create product
                  </>
                ) : isEditing ? (
                  'Save changes'
                ) : (
                  'Create product'
                )}
              </Button>
            </div>
          }
        />

        <form id="product-form" onSubmit={handleSubmit} className="w-full space-y-5 pb-2">
          <FormSection
            icon={Package}
            iconTone="indigo"
            step={isEditing ? undefined : 1}
            title="Product details"
            description="Catalog name, SKU, and notes."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <Input
                  label="Product name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={errors.name}
                  required
                  placeholder="e.g. Wireless earbuds"
                />
              </div>
              <div className="lg:col-span-2">
                <Input
                  label="SKU"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="Optional internal code"
                />
              </div>
              <div className="lg:col-span-2">
                <Input
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="lg:col-span-4">
                <Textarea
                  label="Description"
                  optional
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  helperText="Internal catalog notes — not shown on marketplaces."
                  placeholder="e.g. Bundle SKU, supplier link, season…"
                  rows={2}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={Layers}
            iconTone="violet"
            step={isEditing ? undefined : 2}
            title="Platforms"
            description="Add a row per marketplace — purchase, selling, fees, and tax."
          >
            <PlatformListingEditor
              embedded
              listings={form.platformListings}
              onChange={(platformListings) => setForm((f) => ({ ...f, platformListings }))}
              company={company}
              currency={currency}
              error={errors.listings}
            />
          </FormSection>

          {!isEditing && form.name.trim() && form.platformListings.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <span className="font-medium">{form.name.trim()}</span> is ready — review platform
                profit previews, then create your product.
              </p>
            </div>
          )}

          <FormStickyActions className="lg:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/products')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {!isEditing && !saving ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create product
                </>
              ) : isEditing ? (
                'Save changes'
              ) : (
                'Create product'
              )}
            </Button>
          </FormStickyActions>
        </form>
      </PageShell>
    </Layout>
  );
}
