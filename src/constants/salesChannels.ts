export const SalesChannelFilter = {
  ALL: 'all',
  MARKETPLACE: 'marketplace',
  OFFLINE: 'offline',
} as const;

export type SalesChannelFilter =
  (typeof SalesChannelFilter)[keyof typeof SalesChannelFilter];

export const SALES_CHANNEL_FILTER_OPTIONS = [
  { value: SalesChannelFilter.ALL, label: 'All sales' },
  { value: SalesChannelFilter.MARKETPLACE, label: 'Marketplace' },
  { value: SalesChannelFilter.OFFLINE, label: 'Offline' },
] as const;

export function salesChannelFilterLabel(filter: SalesChannelFilter): string {
  return SALES_CHANNEL_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'All sales';
}

export function normalizeSalesChannelFilter(value: string | null): SalesChannelFilter {
  if (value === SalesChannelFilter.MARKETPLACE) return SalesChannelFilter.MARKETPLACE;
  if (value === SalesChannelFilter.OFFLINE) return SalesChannelFilter.OFFLINE;
  return SalesChannelFilter.ALL;
}

export function salesKindLabel(kind: 'marketplace' | 'offline'): string {
  return kind === 'marketplace' ? 'Marketplace' : 'Offline';
}
