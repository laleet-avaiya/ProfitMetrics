import type { AiDataDomain } from './constants';

export type HeuristicIntent = 'analysis' | 'mutation' | 'general';

export interface HeuristicClassification {
  intent: HeuristicIntent;
  domains: AiDataDomain[];
  confidence: 'high' | 'medium';
}

const MUTATION_PATTERNS = [
  /\b(delete|remove|erase|drop|destroy|cancel|void)\b/i,
  /\b(update|edit|modify|change|alter|rename|adjust)\b/i,
  /\b(create|add|insert|new|register|record)\b/i,
  /\b(set|mark|assign|convert|transfer)\b/i,
  /\b(हटा|मिटा|बदल|अपडेट|जोड़|बनाओ|रद्द)\b/,
  /\b(حذف|ازل|تعديل|غير|اضف|انشئ|الغ)\b/,
];

const GENERAL_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good evening)\b/i,
  /^(what can you do|who are you|help me|how do you work)\b/i,
  /^(مرحبا|السلام|شكرا|مساعدة)\b/,
  /^(नमस्ते|धन्यवाद|मदद)\b/,
];

const DOMAIN_KEYWORDS: Array<{ domain: AiDataDomain; patterns: RegExp[] }> = [
  {
    domain: 'sales',
    patterns: [/\b(sale|sales|order|orders|revenue|marketplace|platform|margin)\b/i],
  },
  {
    domain: 'products',
    patterns: [/\b(product|products|sku|listing|catalog|item)\b/i],
  },
  {
    domain: 'expenses',
    patterns: [/\b(expense|expenses|cost|costs|spending|overhead)\b/i],
  },
  {
    domain: 'purchases',
    patterns: [/\b(purchase|purchases|po|purchase order|procurement)\b/i],
  },
  {
    domain: 'invoices',
    patterns: [/\b(invoice|invoices|billing|receivable)\b/i],
  },
  {
    domain: 'payments',
    patterns: [/\b(payment|payments|payout|collection|received)\b/i],
  },
  {
    domain: 'stock',
    patterns: [/\b(stock|inventory|quantity|on hand|warehouse)\b/i],
  },
  {
    domain: 'customers',
    patterns: [/\b(customer|customers|client|clients|buyer)\b/i],
  },
  {
    domain: 'vendors',
    patterns: [/\b(vendor|vendors|supplier|suppliers)\b/i],
  },
];

function uniqueDomains(domains: AiDataDomain[]): AiDataDomain[] {
  return [...new Set(domains)].slice(0, 3);
}

export function analyzeQueryHeuristically(message: string): HeuristicClassification {
  const text = message.trim();

  if (MUTATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: 'mutation', domains: [], confidence: 'high' };
  }

  if (text.length < 80 && GENERAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: 'general', domains: ['overview'], confidence: 'high' };
  }

  const matchedDomains = DOMAIN_KEYWORDS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text))
  ).map(({ domain }) => domain);

  if (matchedDomains.length === 0) {
    return { intent: 'analysis', domains: ['overview'], confidence: 'medium' };
  }

  if (!matchedDomains.includes('overview') && matchedDomains.length <= 2) {
    return { intent: 'analysis', domains: uniqueDomains(matchedDomains), confidence: 'high' };
  }

  return { intent: 'analysis', domains: uniqueDomains(matchedDomains), confidence: 'medium' };
}

export function buildChatTitleFromMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.length > 56 ? `${cleaned.slice(0, 53)}…` : cleaned;
}
