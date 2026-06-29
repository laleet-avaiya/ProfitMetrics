/** Display pricing by business country (billing handled via support for now). */

export interface SubscriptionPlan {
  name: string;
  description: string;
  yearlyPrice: number;
  features: string[];
}

export interface SubscriptionPricingRegion {
  currency: string;
  billingNote: string;
  trialDays: number;
  plan: SubscriptionPlan;
}

const INDIA_PRICING: SubscriptionPricingRegion = {
  currency: 'INR',
  trialDays: 7,
  billingNote:
    '₹9,999 per year, exclusive of GST. Pay once yearly via UPI, bank transfer, or invoice. Contact support to subscribe or renew.',
  plan: {
    name: 'Profit Metrics',
    description: 'Full access for small ecommerce sellers — one simple annual price.',
    yearlyPrice: 9999,
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
  currency: 'AED',
  trialDays: 7,
  billingNote:
    'AED 1,299 per year, exclusive of VAT where applicable. Contact support to subscribe or renew.',
  plan: {
    name: 'Profit Metrics',
    description: 'Full access for small ecommerce sellers — one simple annual price.',
    yearlyPrice: 1299,
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
