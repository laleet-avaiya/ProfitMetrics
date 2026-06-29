import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { EntityDetailShell } from '../../components/DetailPage/EntityDetailShell';
import { DetailField, DetailGrid } from '../../components/DetailPage/DetailField';
import { Button } from '../../components/Button/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useEntityDetail } from '../../hooks/useEntityDetail';
import { firestoreService } from '../../services/firestore';
import { PlatformFeeKind } from '../../types';
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
  const { company } = useAuth();
  const currency = company?.currency ?? 'AED';

  const { entity: product, loading, notFound } = useEntityDetail({
    id: productId,
    fetch: firestoreService.products.get,
    errorMessage: 'Failed to load product',
  });

  const listings = product?.platformListings ?? [];

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
      description={product?.sku ? `SKU: ${product.sku}` : undefined}
      actions={
        product ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        ) : null
      }
    >
      {product && (
        <>
          <Card>
            <CardHeader title="Product details" />
            <DetailGrid columns={3}>
              <DetailField label="Name" value={product.name} />
              <DetailField label="SKU" value={product.sku} />
              <DetailField label="Category" value={product.category} />
              <DetailField label="Created" value={formatDateLocalSafe(product.createdAt)} />
              <DetailField label="Updated" value={formatDateLocalSafe(product.updatedAt)} />
            </DetailGrid>
            {product.description && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <DetailField label="Description" value={product.description} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Platform listings"
              description={`${listings.length} marketplace configuration(s)`}
            />
            <div className="space-y-3">
              {listings.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No platform listings configured.</p>
              ) : (
              listings.map((listing) => {
                const tax = resolveListingTax(listing);
                const preview = computeLineEconomics(lineEconomicsInputFromListing(listing, 1));
                const pctLabel = taxPercentLabel(tax.taxType);
                const feeLabel =
                  tax.platformFeeKind === PlatformFeeKind.PERCENT
                    ? `${listing.platformFeePercent ?? 0}%`
                    : formatMoney(listing.platformFee ?? 0, currency);

                return (
                  <div
                    key={listing.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 dark:text-white">{listing.platform}</p>
                    </div>
                    <DetailGrid columns={3}>
                      <DetailField label="Purchase" value={formatMoney(listing.purchasePrice, currency)} />
                      <DetailField
                        label={`${pctLabel} (purchase)`}
                        value={`${tax.purchaseTaxPercentage}% · Includes tax: ${amountIncludesTaxLabel(tax.purchaseTaxMode)}`}
                      />
                      <DetailField label="Selling" value={formatMoney(listing.sellingPrice, currency)} />
                      <DetailField
                        label={`${pctLabel} (selling)`}
                        value={`${tax.sellingTaxPercentage}% · Includes tax: ${amountIncludesTaxLabel(tax.sellingTaxMode)}`}
                      />
                      <DetailField label="Platform fee" value={feeLabel} />
                      <DetailField label="Delivery fee" value={formatMoney(listing.shippingCost, currency)} />
                      <DetailField label="Profit (with ITC)" value={formatMoney(preview.profit, currency)} />
                      <DetailField
                        label="Profit (without ITC)"
                        value={formatMoney(preview.profitWithoutItc, currency)}
                      />
                      <DetailField label="Margin (with ITC)" value={formatPercent(preview.profitMarginPercent)} />
                    </DetailGrid>
                    {(listing.platformSku || listing.listingUrl || listing.notes) && (
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
                                className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                              >
                                {listing.listingUrl}
                              </a>
                            ) : null
                          }
                        />
                        <DetailField label="Notes" value={listing.notes} />
                      </DetailGrid>
                    )}
                  </div>
                );
              })
              )}
            </div>
          </Card>
        </>
      )}
    </EntityDetailShell>
  );
}
