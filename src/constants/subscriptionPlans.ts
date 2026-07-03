/** Subscription plan display (pricing discussed via support). */

export interface SubscriptionPlan {
  name: string;
  description: string;
  features: string[];
}

export interface SubscriptionPricingRegion {
  billingNote: string;
  trialDays: number;
  plan: SubscriptionPlan;
}

const INDIA_PRICING: SubscriptionPricingRegion = {
  trialDays: 7,
  billingNote:
    'Pricing is tailored to your business. Message us on WhatsApp to discuss plans and payment options.',
  plan: {
    name: 'Profit Metrics',
    description: 'Full access for small ecommerce sellers.',
    features: [
      'Unlimited products, sales & expenses',
      'Per-platform fee, GST & profit templates',
      'Dashboard, P&L, tax ledger & trend reports',
      'Returns, cancellations & ITC-aware calculations',
      'Email & WhatsApp support',
    ],
  },
};

const UAE_PRICING: SubscriptionPricingRegion = {
  trialDays: 7,
  billingNote:
    'Pricing is tailored to your business. Message us on WhatsApp to discuss plans and subscription options.',
  plan: {
    name: 'Profit Metrics',
    description: 'Full access for small ecommerce sellers.',
    features: [
      'Unlimited products, sales & expenses',
      'Per-platform fee, VAT & profit templates',
      'Dashboard, P&L, tax ledger & trend reports',
      'Returns, cancellations & tax-aware calculations',
      'Email & WhatsApp support',
    ],
  },
};

export function getSubscriptionPricing(country?: string): SubscriptionPricingRegion {
  return country === 'IN' ? INDIA_PRICING : UAE_PRICING;
}
