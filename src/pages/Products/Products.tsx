import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Layers,
  Package,
  Pencil,
  Plus,
  Target,
} from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { StockReconciliationPanel } from '../../components/StockReconciliation/StockReconciliationPanel';
import { Button } from '../../components/Button/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingView } from '../../components/AppLoader/AppLoader';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { useModuleAccess } from '../../hooks/usePermissions';
import { AppModule } from '../../constants/permissions';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { notDeleted, useEntityList } from '../../hooks/useEntityList';
import { firestoreService } from '../../services/firestore';
import type { Product, ProductStock } from '../../types';
import { computeLineEconomics, formatPercent, lineEconomicsInputFromListing } from '../../utils/profit';
import { computeProductQuantityStats } from '../../utils/productQuantityStats';
import { getStockMap } from '../../utils/stockHelpers';


function averageListingMargin(product: Product): number | null {
  const listings = product.platformListings;
  if (listings.length === 0) return null;

  let total = 0;
  for (const listing of listings) {
    const preview = computeLineEconomics(lineEconomicsInputFromListing(listing, 1));
    total += preview.profitMarginPercent;
  }
  return total / listings.length;
}

function productOnHand(
  product: Product,
  stockMap: Map<string, ProductStock>,
  stockTotals: Map<string, number>
): number {
  const variantCount = product.variants?.length ?? 0;
  const stock = stockMap.get(product.id);
  return variantCount > 0 ? stockTotals.get(product.id) ?? 0 : stock?.quantityOnHand ?? 0;
}

export function Products() {
  const navigate = useNavigate();
  const { canCreate, canUpdate } = useModuleAccess(AppModule.PRODUCTS);
  const { summary: marketplaceSummary } = useCompanyMarketplaces();

  const emptyData = useMemo(
    () => ({
      products: [] as Product[],
      stockMap: new Map<string, ProductStock>(),
      stockTotals: new Map<string, number>(),
      quantityStats: new Map<string, { purchased: number; sold: number }>(),
    }),
    []
  );

  const { data, loading, reload } = useEntityList({
    initialData: emptyData,
    errorMessage: 'Failed to load products',
    fetch: async (companyId) => {
      const [list, stockList, purchaseList, saleList] = await Promise.all([
        firestoreService.products.getAll(companyId),
        firestoreService.stock.getAll(companyId),
        firestoreService.purchases.getAll(companyId),
        firestoreService.sales.getAll(companyId),
      ]);
      // For variant products only count buckets for variants that still exist,
      // so orphaned stock (from renamed/removed options, or a leftover base
      // bucket after variants were enabled) never inflates the list total.
      const variantIdsByProduct = new Map<string, Set<string>>();
      for (const p of list) {
        if (p.variants && p.variants.length > 0) {
          variantIdsByProduct.set(p.id, new Set(p.variants.map((v) => v.id)));
        }
      }
      const stockTotals = new Map<string, number>();
      for (const s of stockList) {
        const variantIds = variantIdsByProduct.get(s.productId);
        if (variantIds) {
          if (s.variantId && variantIds.has(s.variantId)) {
            stockTotals.set(s.productId, (stockTotals.get(s.productId) ?? 0) + s.quantityOnHand);
          }
          continue;
        }
        stockTotals.set(s.productId, (stockTotals.get(s.productId) ?? 0) + s.quantityOnHand);
      }
      return {
        products: list.filter(notDeleted),
        stockMap: getStockMap(stockList),
        stockTotals,
        quantityStats: computeProductQuantityStats(
          purchaseList.filter(notDeleted),
          saleList.filter(notDeleted)
        ),
      };
    },
  });

  const { products, stockMap, stockTotals, quantityStats } = data;
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, search]);

  const summary = useMemo(() => {
    let listings = 0;
    let marginTotal = 0;
    let marginCount = 0;

    for (const product of filtered) {
      listings += product.platformListings.length;

      const margin = averageListingMargin(product);
      if (margin != null) {
        marginTotal += margin;
        marginCount += 1;
      }
    }

    return {
      count: filtered.length,
      listings,
      avgMargin: marginCount > 0 ? Math.round((marginTotal / marginCount) * 100) / 100 : null,
    };
  }, [filtered]);

  const openCreate = () => navigate('/products/new');

  const openView = (product: Product) => navigate(`/products/${product.id}`);

  const openEdit = (product: Product) => navigate(`/products/${product.id}/edit`);

  const columns: DataTableColumn<Product>[] = [
      {
        key: 'name',
        header: 'Product',
        sortable: true,
        sortValue: (product) => product.name,
        truncate: true,
        className: 'font-medium text-gray-900 dark:text-white',
        render: (product) => (
          <Link
            to={`/products/${product.id}`}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
          >
            {product.name}
          </Link>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        className: 'text-gray-600 dark:text-gray-400',
        render: (product) => product.sku ?? '—',
      },
      {
        key: 'platforms',
        header: 'Platforms',
        truncate: true,
        className: 'text-gray-700 dark:text-gray-300',
        render: (product) => {
          const platforms = product.platformListings.map((l) => l.platform).join(', ') || '—';
          return (
            <span title={platforms !== '—' ? platforms : undefined}>{platforms}</span>
          );
        },
      },
      {
        key: 'purchased',
        header: 'Purchased',
        align: 'right',
        sortable: true,
        sortValue: (product) => quantityStats.get(product.id)?.purchased ?? 0,
        className: 'text-gray-700 dark:text-gray-300',
        render: (product) => quantityStats.get(product.id)?.purchased ?? 0,
      },
      {
        key: 'sold',
        header: 'Sold',
        align: 'right',
        sortable: true,
        sortValue: (product) => quantityStats.get(product.id)?.sold ?? 0,
        render: (product) => {
          const sold = quantityStats.get(product.id)?.sold ?? 0;
          return (
            <span
              className={
                sold > 0
                  ? 'font-medium text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300'
              }
            >
              {sold}
            </span>
          );
        },
      },
      {
        key: 'onHand',
        header: 'On hand',
        align: 'right',
        sortable: true,
        sortValue: (product) => productOnHand(product, stockMap, stockTotals),
        render: (product) => {
          const onHand = productOnHand(product, stockMap, stockTotals);
          const variantCount = product.variants?.length ?? 0;
          return (
            <>
              <span className="font-medium">{onHand}</span>
              {variantCount > 0 ? (
                <span className="ml-1.5 text-[11px] font-normal text-gray-400 dark:text-gray-500">
                  {variantCount} var
                </span>
              ) : null}
            </>
          );
        },
      },
      {
        key: 'avgMargin',
        header: 'Avg margin',
        align: 'right',
        sortable: true,
        sortValue: (product) => averageListingMargin(product),
        render: (product) => {
          const avgMargin = averageListingMargin(product);
          if (avgMargin == null) return '—';
          return (
            <span
              className={
                avgMargin >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {formatPercent(avgMargin)}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (product) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => openView(product)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={`View ${product.name}`}
            >
              <Eye className="w-4 h-4" />
            </button>
            {canUpdate ? (
              <button
                type="button"
                onClick={() => openEdit(product)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={`Edit ${product.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ),
      },
];

  return (
    <SectionPage
      title="Products"
      description={`Manage SKUs and per-platform economics for ${marketplaceSummary}.`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Products', value: String(summary.count), tone: 'indigo' as const, icon: Package },
          { label: 'Platform listings', value: String(summary.listings), tone: 'violet' as const, icon: Layers },
          {
            label: 'Avg margin',
            value: summary.avgMargin != null ? formatPercent(summary.avgMargin) : '—',
            tone: 'emerald' as const,
            icon: Target,
          },
        ].map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} subtext="Filtered results" tone={stat.tone} icon={stat.icon} />
        ))}
      </div>

      <StockReconciliationPanel canReconcile={canUpdate} onReconciled={() => void reload()} />

      <Card className="space-y-3">
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name, SKU, or category"
            searchAriaLabel="Search products"
            actions={
              canCreate ? (
                <Button variant="primary" onClick={openCreate} className="flex-1 sm:flex-none">
                  <Plus className="w-4 h-4" />
                  Add product
                </Button>
              ) : undefined
            }
          />

          {loading ? (
            <LoadingView message="Loading products…" size="lg" className="py-12" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={products.length === 0 ? 'No products yet' : 'No products match your filters'}
              description={
                products.length === 0
                  ? 'Add your first product with platform-specific purchase price, selling price, fees, and tax.'
                  : 'Try a different search.'
              }
              action={
                products.length === 0 ? (
                  <Button variant="primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" />
                    Add product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(product) => product.id}
                defaultSort={{ key: 'name', direction: 'asc' }}
                rowClassName="bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-750"
              />

              <div className="md:hidden space-y-3">
                {filtered.map((product) => {
                  const avgMargin = averageListingMargin(product);
                  const stock = stockMap.get(product.id);
                  const variantCount = product.variants?.length ?? 0;
                  const onHand = variantCount > 0 ? stockTotals.get(product.id) ?? 0 : stock?.quantityOnHand ?? 0;
                  const stats = quantityStats.get(product.id);
                  const purchased = stats?.purchased ?? 0;
                  const sold = stats?.sold ?? 0;

                  return (
                    <div
                      key={product.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            <Link
                              to={`/products/${product.id}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                            >
                              {product.name}
                            </Link>
                          </p>
                          {(product.sku || product.category) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {[product.sku, product.category].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {product.platformListings.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            {l.platform}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5">
                          <p className="text-gray-500 dark:text-gray-400">Purchased</p>
                          <p className="mt-0.5 tabular-nums font-semibold text-gray-900 dark:text-white">
                            {purchased}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5">
                          <p className="text-gray-500 dark:text-gray-400">Sold</p>
                          <p className="mt-0.5 tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                            {sold}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-2 py-1.5">
                          <p className="text-gray-500 dark:text-gray-400">On hand</p>
                          <p className="mt-0.5 tabular-nums font-semibold text-gray-900 dark:text-white">
                            {onHand}
                          </p>
                        </div>
                      </div>

                      {avgMargin != null && (
                        <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                          Avg margin:{' '}
                          <span
                            className={
                              avgMargin >= 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-red-600 dark:text-red-400 font-medium'
                            }
                          >
                            {formatPercent(avgMargin)}
                          </span>
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openView(product)}>
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(product)}>
                          <Pencil className="w-4 h-4" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </Card>
    </SectionPage>
  );
}
