export const DEFAULT_AI_MESSAGE_QUOTA = 30;

export const OPENAI_MODEL = 'gpt-4o-mini';

/** Cloud Functions region — Mumbai */
export const FUNCTIONS_REGION = 'asia-south1';

export const AI_DATA_DOMAINS = [
  'sales',
  'products',
  'expenses',
  'purchases',
  'invoices',
  'payments',
  'stock',
  'customers',
  'vendors',
  'overview',
] as const;

export type AiDataDomain = (typeof AI_DATA_DOMAINS)[number];
