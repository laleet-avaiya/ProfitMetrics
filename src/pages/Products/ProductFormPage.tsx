import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layers, Package, Paperclip } from 'lucide-react';
import { Layout } from '../../components/Layout/Layout';
import { PageHeader, PageShell } from '../../components/PageShell/PageShell';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { PlatformListingEditor } from '../../components/PlatformListingEditor/PlatformListingEditor';
import { FormTabs } from '../../components/ui/FormTabs';
import {
  EntityAttachmentsPanel,
  type PendingFile,
} from '../../components/EntityAttachments';
import {
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPageNotFound,
  FormPanel,
  FormReadyBanner,
  FormSummaryStrip,
} from '../../components/FormPage';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { isConfiguredMarketplace } from '../../constants/platforms';
import { useNotification } from '../../hooks/useNotification';
import { createListingId, normalizeListings } from '../../utils/productDefaults';
import { firestoreService } from '../../services/firestore';
import type { Product, ProductPlatformListing } from '../../types';
import type { EntityAttachment } from '../../models/attachment';
import { finalizePendingAttachments } from '../../utils/entityAttachments';
import { nowUtc } from '../../utils/firestoreDates';
import { formatMarketplaceSummary } from '../../constants/platforms';

interface FormState {
  name: string;
  sku: string;
  description: string;
  category: string;
  status: Product['status'];
  platformListings: ProductPlatformListing[];
}

type ProductFormTab = 'details' | 'platforms' | 'documents';

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
  const { company, user } = useAuth();
  const { marketplaces } = useCompanyMarketplaces();
  const notification = useNotification();
  const isEditing = Boolean(productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProductFormTab>('details');
  const [errors, setErrors] = useState<{ name?: string; listings?: string }>({});
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

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
        setAttachments(found?.attachments ?? []);
        setPendingFiles([]);
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
  }, [company, isEditing, productId, notification]);

  const platformSummary = useMemo(
    () => formatMarketplaceSummary(marketplaces),
    [marketplaces]
  );

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) {
      next.name = 'Product name is required';
    }
    const marketplacesForValidation = marketplaces;
    for (const listing of form.platformListings) {
      if (!listing.platform.trim()) {
        next.listings = 'Select a platform for each listing';
        break;
      }
      if (!isConfiguredMarketplace(listing.platform, marketplacesForValidation)) {
        next.listings = `"${listing.platform}" is not in your marketplace list — add it under Configuration or pick another platform`;
        break;
      }
    }
    setErrors(next);

    if (next.name) {
      setActiveTab('details');
      return false;
    }
    if (next.listings) {
      setActiveTab('platforms');
      return false;
    }
    return true;
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
          attachments,
          updatedAt: now,
        }, user!.uid);
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
        await firestoreService.products.create(company.id, newProduct, user!.uid);
        const uploaded = await finalizePendingAttachments(
          company.orgId,
          company.id,
          'products',
          id,
          pendingFiles.map((item) => item.file),
          user!.uid
        );
        if (uploaded.length > 0) {
          await firestoreService.products.update(company.id, id, { attachments: uploaded }, user!.uid);
        }
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
  const isReady = !isEditing && Boolean(form.name.trim());
  const cancelTo = '/products';

  const formTabs = [
    { id: 'details' as const, label: 'Details', icon: Package },
    {
      id: 'platforms' as const,
      label: 'Platforms',
      icon: Layers,
      badge: form.platformListings.length || undefined,
    },
    {
      id: 'documents' as const,
      label: 'Documents',
      icon: Paperclip,
      badge: attachments.length + pendingFiles.length || undefined,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <PageShell>
          <FormPageLoading message="Loading product…" />
        </PageShell>
      </Layout>
    );
  }

  if (isEditing && !product) {
    return (
      <Layout>
        <PageShell>
          <FormPageNotFound
            title="Product not found"
            description="This product may have been deleted."
            backLabel="Back to products"
            onBack={() => navigate('/products')}
          />
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
              : 'Set up once — sales auto-fill costs and tax from here.'
          }
          actions={
            <FormPageHeaderActions
              formId="product-form"
              onCancel={() => navigate(cancelTo)}
              saving={saving}
              isEditing={isEditing}
              createLabel="Create product"
            />
          }
        />

        <FormPageBody id="product-form" onSubmit={handleSubmit}>
          <FormSummaryStrip>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {form.name.trim() || 'Untitled product'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {form.platformListings.length > 0
                  ? `${form.platformListings.length} platform${form.platformListings.length === 1 ? '' : 's'} · ${platformSummary}`
                  : 'No platform listings yet'}
              </p>
            </div>
          </FormSummaryStrip>

          <FormTabs
            tabs={formTabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as ProductFormTab)}
            ariaLabel="Product form sections"
          />

          <FormPageGrid>
            <FormPanel role="tabpanel">
              {activeTab === 'details' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Product name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      error={errors.name}
                      required
                      placeholder="e.g. Wireless earbuds"
                    />
                  </div>
                  <Input
                    label="SKU"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Optional"
                  />
                  <Input
                    label="Category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Electronics"
                  />
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Textarea
                      label="Description"
                      optional
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Internal notes — supplier, season…"
                      rows={2}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === 'platforms' ? (
                <PlatformListingEditor
                  embedded
                  listings={form.platformListings}
                  onChange={(platformListings) => setForm((f) => ({ ...f, platformListings }))}
                  company={company}
                  currency={currency}
                  error={errors.listings}
                />
              ) : null}

              {activeTab === 'documents' ? (
                <EntityAttachmentsPanel
                  orgId={company!.orgId}
                  companyId={company!.id}
                  collection="products"
                  entityId={product?.id ?? null}
                  userId={user!.uid}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  pendingFiles={pendingFiles}
                  onPendingFilesChange={setPendingFiles}
                  disabled={saving}
                />
              ) : null}
            </FormPanel>
          </FormPageGrid>

          {isReady ? (
            <FormReadyBanner>
              <span className="font-medium">{form.name.trim()}</span>
              {form.platformListings.length > 0
                ? ` with ${form.platformListings.length} platform${form.platformListings.length === 1 ? '' : 's'}`
                : ''}{' '}
              — ready to create.
            </FormReadyBanner>
          ) : null}

          <FormPageMobileActions
            onCancel={() => navigate(cancelTo)}
            saving={saving}
            isEditing={isEditing}
            createLabel="Create product"
          />
        </FormPageBody>
      </PageShell>
    </Layout>
  );
}
