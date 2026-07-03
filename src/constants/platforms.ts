import type { Company } from '../types';

/** Default marketplace names for new companies and when none are configured. */
export const DEFAULT_MARKETPLACES = [
  'Amazon',
  'Shopify',
  'Noon',
  'eBay',
  'Flipkart',
  'Etsy',
  'Walmart',
  'Daraz',
  'WhatsApp',
  'Instagram',
  'Facebook',
] as const;

/** Reserved option in product platform listings for free-text names. */
export const CUSTOM_MARKETPLACE_OPTION = 'Custom' as const;

/** @deprecated Use getCompanyMarketplaces(company) instead. */
export const PLATFORM_PRESETS = [...DEFAULT_MARKETPLACES, CUSTOM_MARKETPLACE_OPTION] as const;

export type PlatformPreset = (typeof PLATFORM_PRESETS)[number];

export function normalizeMarketplaceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeMarketplaceList(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of names) {
    const name = normalizeMarketplaceName(raw);
    if (!name) continue;
    if (name.toLowerCase() === CUSTOM_MARKETPLACE_OPTION.toLowerCase()) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

export function getCompanyMarketplaces(company: Company | null | undefined): string[] {
  const configured = company?.marketplaces;
  if (configured && configured.length > 0) {
    return normalizeMarketplaceList(configured);
  }
  return [...DEFAULT_MARKETPLACES];
}

export function isConfiguredMarketplace(
  platform: string,
  marketplaces: readonly string[] = DEFAULT_MARKETPLACES
): boolean {
  const key = normalizeMarketplaceName(platform).toLowerCase();
  return marketplaces.some((m) => m.toLowerCase() === key);
}

export function mergeMarketplaceNames(
  configured: readonly string[],
  ...extraGroups: (readonly string[] | string | undefined)[]
): string[] {
  const extras: string[] = [];
  for (const group of extraGroups) {
    if (!group) continue;
    if (typeof group === 'string') {
      extras.push(group);
    } else {
      extras.push(...group);
    }
  }
  return normalizeMarketplaceList([...configured, ...extras]);
}

export function formatMarketplaceSummary(marketplaces: readonly string[], max = 4): string {
  if (marketplaces.length === 0) return 'your marketplaces';
  if (marketplaces.length <= max) return marketplaces.join(', ');
  return `${marketplaces.slice(0, max).join(', ')}, and more`;
}

export function getMarketplaceSelectOptions(
  marketplaces: readonly string[],
  options?: {
    includeCustom?: boolean;
    includeEmpty?: boolean;
    emptyLabel?: string;
    extraValues?: readonly string[];
  }
): { value: string; label: string }[] {
  const merged = options?.extraValues?.length
    ? mergeMarketplaceNames(marketplaces, options.extraValues)
    : [...marketplaces];

  const result: { value: string; label: string }[] = [];

  if (options?.includeEmpty !== false) {
    result.push({ value: '', label: options?.emptyLabel ?? 'Select platform…' });
  }

  for (const marketplace of merged) {
    result.push({ value: marketplace, label: marketplace });
  }

  if (options?.includeCustom) {
    result.push({ value: CUSTOM_MARKETPLACE_OPTION, label: CUSTOM_MARKETPLACE_OPTION });
  }

  return result;
}
