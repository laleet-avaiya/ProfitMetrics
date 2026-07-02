import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Target,
} from 'lucide-react';
import { SectionPage } from '../../components/SectionPage/SectionPage';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Card, StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  filterRowClass,
  tableCellClass,
  tableClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableTruncateCellClass,
  tableWrapClass,
  toolbarClass,
} from '../../constants/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyMarketplaces } from '../../hooks/useCompanyMarketplaces';
import { useNotification } from '../../hooks/useNotification';
import { firestoreService } from '../../services/firestore';
import type { Product, ProductStock } from '../../types';
import { computeLineEconomics, formatPercent, lineEconomicsInputFromListing } from '../../utils/profit';
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

export function Products() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { summary: marketplaceSummary } = useCompanyMarketplaces();
  const notification = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, ProductStock>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadProducts = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [list, stockList] = await Promise.all([
        firestoreService.products.getAll(company.id),
        firestoreService.stock.getAll(company.id),
      ]);
      setProducts(list.filter((p) => !p.deleted));
      setStockMap(getStockMap(stockList));
    } catch (err) {
      console.error('Failed to load products:', err);
      notification.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [company, notification]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

      <Card className="space-y-3">
          <div className={toolbarClass}>
            <div className={filterRowClass}>
              <div className="flex-1 min-w-[200px] max-w-md">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, or category"
                  leftIcon={<Search className="w-4 h-4" />}
                  aria-label="Search products"
                />
              </div>
            </div>
            <Button variant="primary" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add product
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading products…</p>
            </div>
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
              <div className={`hidden md:block ${tableWrapClass}`}>
                <table className={tableClass}>
                  <thead>
                    <tr className={tableHeadRowClass}>
                      <th className={tableHeadCellClass}>Product</th>
                      <th className={tableHeadCellClass}>SKU</th>
                      <th className={tableHeadCellClass}>Platforms</th>
                      <th className={`${tableHeadCellClass} text-right`}>Stock</th>
                      <th className={`${tableHeadCellClass} text-right`}>Avg margin</th>
                      <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filtered.map((product) => {
                      const avgMargin = averageListingMargin(product);
                      const stock = stockMap.get(product.id);

                      return (
                        <tr
                          key={product.id}
                          className="bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-750"
                        >
                          <td className={`${tableTruncateCellClass} font-medium text-gray-900 dark:text-white`}>
                            <Link
                              to={`/products/${product.id}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                            >
                              {product.name}
                            </Link>
                          </td>
                          <td className={`${tableCellClass} text-gray-600 dark:text-gray-400`}>
                            {product.sku ?? '—'}
                          </td>
                          <td
                            className={`${tableTruncateCellClass} text-gray-700 dark:text-gray-300`}
                            title={product.platformListings.map((l) => l.platform).join(', ')}
                          >
                            {product.platformListings.map((l) => l.platform).join(', ') || '—'}
                          </td>
                          <td className={`${tableCellClass} text-right tabular-nums font-medium`}>
                            {stock?.quantityOnHand ?? 0}
                          </td>
                          <td className={`${tableCellClass} text-right tabular-nums`}>
                            {avgMargin != null ? (
                              <span
                                className={
                                  avgMargin >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                                }
                              >
                                {formatPercent(avgMargin)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={tableCellClass}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openView(product)}
                                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label={`View ${product.name}`}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(product)}
                                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label={`Edit ${product.name}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {filtered.map((product) => {
                  const avgMargin = averageListingMargin(product);

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
