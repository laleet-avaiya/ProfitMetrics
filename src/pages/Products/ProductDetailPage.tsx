import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, History, Layers, Package, Pencil, Tag, Warehouse } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid, detailLinkClass } from '../../components/DetailPage/DetailField';
import { DetailMetaChip, DetailMetaRow, DetailNotes } from '../../components/DetailPage/DetailMeta';
import { DetailSection } from '../../components/DetailPage/DetailSection';
import { DetailStatStrip, type DetailStatItem } from '../../components/DetailPage/DetailStatStrip';
import { EntityAttachmentsDetailSection } from '../../components/EntityAttachments';
import { Button } from '../../components/Button/Button';
import { AppModule } from '../../constants/permissions';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { useModuleAccess } from '../../hooks/usePermissions';
import { firestoreService } from '../../services/firestore';
import { PlatformFeeKind, type ProductStock, type StockMovement } from '../../types';
import { amountIncludesTaxLabel, resolveListingTax, taxPercentLabel } from '../../utils/listingTax';
import {
  computeLineEconomics,
  formatMoney,
  formatPercent,
  lineEconomicsInputFromListing,
} from '../../utils/profit';
import { formatDateLocalSafe } from '../../utils/date';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const { canUpdate } = useModuleAccess(AppModule.PRODUCTS);
  const currency = company?.currency ?? 'AED';

  const { entity: product, loading, notFound, reload } = useEntityDetail({
    id: productId,
    fetch: firestoreService.products.get,
    errorMessage: 'Failed to load product',
  });

  const [stock, setStock] = useState<ProductStock | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (!company || !productId) return;
    firestoreService.stock.getByProductId(company.id, productId).then(setStock);
    firestoreService.stockMovements
      .listByProduct(company.id, productId)
      .then(setMovements)
      .catch((err) => console.error('Failed to load stock history:', err));
  }, [company, productId]);

  const listings = product?.platformListings ?? [];

  const persistAttachments = async (attachments: NonNullable<typeof product>['attachments']) => {
    if (!company || !product || !user) return;
    await firestoreService.products.update(company.id, product.id, { attachments }, user.uid);
    reload();
  };

  const bestListing = listings.reduce<(typeof listings)[0] | null>((best, listing) => {
    const profit = computeLineEconomics(lineEconomicsInputFromListing(listing, 1)).profit;
    if (!best) return listing;
    const bestProfit = computeLineEconomics(lineEconomicsInputFromListing(best, 1)).profit;
    return profit > bestProfit ? listing : best;
  }, null);

  const bestPreview = bestListing
    ? computeLineEconomics(lineEconomicsInputFromListing(bestListing, 1))
    : null;

  const statItems = useMemo((): DetailStatItem[] => {
    const items: DetailStatItem[] = [
      {
        label: 'Stock on hand',
        value: String(stock?.quantityOnHand ?? 0),
        subtext: stock
          ? `Avg cost ${formatMoney(stock.avgPurchasePrice, currency)}`
          : 'No stock received yet',
        icon: Warehouse,
        tone: (stock?.quantityOnHand ?? 0) > 0 ? 'emerald' : 'slate',
      },
    ];
    if (bestPreview && bestListing) {
      items.push(
        {
          label: 'Best margin platform',
          value: bestListing.platform,
          subtext: 'Highest unit profit across listings',
          icon: Layers,
          tone: 'indigo',
        },
        {
          label: 'Unit profit (ITC)',
          value: formatMoney(bestPreview.profit, currency),
          tone: bestPreview.profit >= 0 ? 'emerald' : 'rose',
          valueClassName:
            bestPreview.profit >= 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400',
        }
      );
    }
    return items;
  }, [stock, bestPreview, bestListing, currency]);

  return (
    <EntityDetailShell
      loading={loading}
      loadingLabel="Loading product…"
      notFound={notFound}
      notFoundTitle="Product not found"
      notFoundDescription="This product may have been deleted."
      backTo="/products"
      backLabel="Back to products"
      title={product?.name ?? 'Product'}
      description={
        product?.category
          ? `${product.category}${product.sku ? ` · SKU ${product.sku}` : ''}`
          : product?.sku
            ? `SKU: ${product.sku}`
            : undefined
      }
      meta={
        product ? (
          <DetailMetaRow>
            {product.sku ? (
              <DetailMetaChip tone="indigo" icon={<Tag className="w-3 h-3" />}>
                {product.sku}
              </DetailMetaChip>
            ) : null}
            <DetailMetaChip tone="gray">
              {listings.length} platform{listings.length === 1 ? '' : 's'}
            </DetailMetaChip>
            {product.category ? <DetailMetaChip tone="gray">{product.category}</DetailMetaChip> : null}
          </DetailMetaRow>
        ) : undefined
      }
      actions={
        product && canUpdate ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit product
          </Button>
        ) : null
      }
    >
      {product && (
        <>
          <DetailStatStrip stats={statItems} />

          {stock && stock.quantityOnHand > 0 ? (
            <DetailSection
              icon={Warehouse}
              iconTone="emerald"
              title="Inventory"
              description="Weighted average stock from purchase receipts."
            >
              <DetailGrid columns={3}>
                <DetailField label="Quantity" value={String(stock.quantityOnHand)} />
                <DetailField
                  label="Avg purchase price"
                  value={formatMoney(stock.avgPurchasePrice, currency)}
                />
                <DetailField
                  label="Avg selling price"
                  value={formatMoney(stock.avgSellingPrice, currency)}
                />
                <DetailField
                  label="Stock value"
                  value={formatMoney(stock.totalValue, currency)}
                  valueClassName="font-semibold"
                />
              </DetailGrid>
            </DetailSection>
          ) : null}

          {movements.length > 0 ? (
            <DetailSection
              icon={History}
              iconTone="amber"
              title="Stock adjustment history"
              description="Manual on-hand corrections — most recent first."
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-700/70">
                {movements.map((m) => {
                  const positive = m.delta >= 0;
                  return (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {m.reason}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDateLocalSafe(m.createdAt)} · {m.previousQty} → {m.newQty}
                        </p>
                        {m.note ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                            {m.note}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                          positive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}
                      >
                        {positive ? '+' : ''}
                        {m.delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection
            icon={Package}
            iconTone="indigo"
            title="Product details"
            description="Catalog identity and audit timestamps."
          >
            <DetailGrid columns={3}>
              <DetailField label="Name" value={product.name} valueClassName="font-semibold" />
              <DetailField label="SKU" value={product.sku} valueClassName="font-mono text-xs" />
              <DetailField label="Category" value={product.category} />
              <DetailField label="HSN / SAC code" value={product.hsnCode} valueClassName="font-mono text-xs" />
              <DetailField
                label="Low stock alert at"
                value={
                  product.lowStockThreshold && product.lowStockThreshold > 0
                    ? `${product.lowStockThreshold} units`
                    : 'Off'
                }
              />
              <DetailField label="Created" value={formatDateLocalSafe(product.createdAt)} />
              <DetailField label="Updated" value={formatDateLocalSafe(product.updatedAt)} />
            </DetailGrid>
            {product.description ? <DetailNotes label="Description">{product.description}</DetailNotes> : null}
          </DetailSection>

          <DetailSection
            icon={Layers}
            iconTone="violet"
            title="Platform listings"
            description={`${listings.length} marketplace configuration${listings.length === 1 ? '' : 's'} — economics used when logging sales.`}
          >
            {listings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">No platform listings configured.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/products/${product.id}/edit`)}
                >
                  Add platforms
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {listings.map((listing) => {
                  const tax = resolveListingTax(listing);
                  const preview = computeLineEconomics(lineEconomicsInputFromListing(listing, 1));
                  const pctLabel = taxPercentLabel(tax.taxType);
                  const feeLabel =
                    tax.platformFeeKind === PlatformFeeKind.PERCENT
                      ? `${listing.platformFeePercent ?? 0}%`
                      : formatMoney(listing.platformFee ?? 0, currency);
                  const profitPositive = preview.profit >= 0;

                  return (
                    <article
                      key={listing.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{listing.platform}</p>
                          {listing.platformSku ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                              {listing.platformSku}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                              profitPositive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {formatMoney(preview.profit, currency)} profit
                          </span>
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 tabular-nums">
                            {formatPercent(preview.profitMarginPercent)} margin
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <DetailGrid columns={3}>
                          <DetailField
                            label="Purchase"
                            value={formatMoney(listing.purchasePrice, currency)}
                            valueClassName="tabular-nums font-medium"
                          />
                          <DetailField
                            label={`${pctLabel} (purchase)`}
                            value={`${tax.purchaseTaxPercentage}% · Includes tax: ${amountIncludesTaxLabel(tax.purchaseTaxMode)}`}
                          />
                          <DetailField
                            label="Selling"
                            value={formatMoney(listing.sellingPrice, currency)}
                            valueClassName="tabular-nums font-medium"
                          />
                          <DetailField
                            label={`${pctLabel} (selling)`}
                            value={`${tax.sellingTaxPercentage}% · Includes tax: ${amountIncludesTaxLabel(tax.sellingTaxMode)}`}
                          />
                          <DetailField label="Platform fee" value={feeLabel} />
                          <DetailField
                            label="Delivery fee"
                            value={formatMoney(listing.shippingCost, currency)}
                            valueClassName="tabular-nums"
                          />
                          <DetailField
                            label="Profit (with ITC)"
                            value={formatMoney(preview.profit, currency)}
                            valueClassName={`tabular-nums font-semibold ${profitPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                          />
                          <DetailField
                            label="Profit (without ITC)"
                            value={formatMoney(preview.profitWithoutItc, currency)}
                            valueClassName="tabular-nums"
                          />
                          <DetailField
                            label="Margin (with ITC)"
                            value={formatPercent(preview.profitMarginPercent)}
                            valueClassName="tabular-nums"
                          />
                        </DetailGrid>
                        {(listing.platformSku || listing.listingUrl || listing.notes) && (
                          <div className="mt-4 pt-4 border-t border-gray-200/80 dark:border-gray-700/80">
                            <DetailGrid columns={3}>
                              <DetailField label="Platform SKU" value={listing.platformSku} />
                              <DetailField
                                label="Listing URL"
                                value={
                                  listing.listingUrl ? (
                                    <a
                                      href={listing.listingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1 ${detailLinkClass} break-all`}
                                    >
                                      Open listing
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                  ) : null
                                }
                              />
                              <DetailField label="Notes" value={listing.notes} />
                            </DetailGrid>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </DetailSection>

          <EntityAttachmentsDetailSection
            orgId={company!.orgId}
            companyId={company!.id}
            collection="products"
            entityId={product.id}
            userId={user!.uid}
            attachments={product.attachments ?? []}
            onAttachmentsChange={persistAttachments}
            canEdit={canUpdate}
          />
        </>
      )}
    </EntityDetailShell>
  );
}
