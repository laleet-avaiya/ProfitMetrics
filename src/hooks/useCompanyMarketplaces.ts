import { useCallback, useMemo } from 'react';
import {
  formatMarketplaceSummary,
  getCompanyMarketplaces,
  getMarketplaceSelectOptions,
  mergeMarketplaceNames,
} from '../constants/platforms';
import { useAuth } from './useAuth';

export function useCompanyMarketplaces() {
  const { company } = useAuth();

  const marketplaces = useMemo(() => getCompanyMarketplaces(company), [company]);
  const summary = useMemo(() => formatMarketplaceSummary(marketplaces), [marketplaces]);

  const getProductPlatformOptions = useCallback(
    (extraValues?: readonly string[]) =>
      getMarketplaceSelectOptions(marketplaces, {
        extraValues,
      }),
    [marketplaces]
  );

  const getPayoutPlatformOptions = useCallback(
    (extraValues?: readonly string[]) =>
      getMarketplaceSelectOptions(marketplaces, {
        includeCustom: false,
        extraValues,
      }),
    [marketplaces]
  );

  const getFilterPlatformOptions = useCallback(
    (extraValues?: readonly string[]) =>
      mergeMarketplaceNames(marketplaces, extraValues ?? []),
    [marketplaces]
  );

  return {
    marketplaces,
    summary,
    productPlatformOptions: getProductPlatformOptions(),
    payoutPlatformOptions: getPayoutPlatformOptions(),
    getProductPlatformOptions,
    getPayoutPlatformOptions,
    getFilterPlatformOptions,
    formatSummary: formatMarketplaceSummary,
  };
}
