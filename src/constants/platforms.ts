/** Common ecommerce marketplaces — users can also enter custom names. */
export const PLATFORM_PRESETS = [
  'Amazon',
  'Shopify',
  'Noon',
  'eBay',
  'Flipkart',
  'Etsy',
  'Walmart',
  'Daraz',
  'Custom',
] as const;

export type PlatformPreset = (typeof PLATFORM_PRESETS)[number];
