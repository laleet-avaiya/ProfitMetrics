import { AI_DATA_DOMAINS, type AiDataDomain } from './constants';

const PII_FIELD_NAMES = new Set([
  'email',
  'phone',
  'phone2',
  'address',
  'contactName',
  'trn',
  'taxId',
  'gstin',
  'website',
  'trackingId',
  'notes',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactValue(
  key: string,
  value: unknown,
  customerIndex?: Map<string, string>
): unknown {
  if (value == null) return value;

  const lowerKey = key.toLowerCase();

  if (lowerKey === 'customerid' && typeof value === 'string' && customerIndex) {
    return customerIndex.get(value) ?? 'Customer (anonymized)';
  }

  if (lowerKey === 'customername' || (lowerKey === 'name' && key === 'customerName')) {
    return 'Customer (anonymized)';
  }

  if (PII_FIELD_NAMES.has(lowerKey)) {
    return '[redacted]';
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      isPlainObject(item) ? sanitizeRecord(item, customerIndex) : item
    );
  }

  if (isPlainObject(value)) {
    return sanitizeRecord(value, customerIndex);
  }

  return value;
}

function sanitizeRecord(
  record: Record<string, unknown>,
  customerIndex?: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'companyId' || key === 'userId' || key === 'legalAcceptedByUserId') {
      continue;
    }
    result[key] = redactValue(key, value, customerIndex);
  }

  return result;
}

export function buildCustomerIndex(customers: Array<{ id: string }>): Map<string, string> {
  const map = new Map<string, string>();
  customers.forEach((customer, index) => {
    map.set(customer.id, `Customer #${index + 1}`);
  });
  return map;
}

export function sanitizeBusinessData(
  data: Record<string, unknown>,
  customerIndex?: Map<string, string>
): Record<string, unknown> {
  return sanitizeRecord(data, customerIndex);
}

export function isValidDomain(value: string): value is AiDataDomain {
  return (AI_DATA_DOMAINS as readonly string[]).includes(value);
}
