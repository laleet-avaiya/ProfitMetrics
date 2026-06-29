export const EXPENSE_CATEGORIES = [
  'Advertising & Marketing',
  'Software & Subscriptions',
  'Storage & Warehouse',
  'Packaging Supplies',
  'Shipping Supplies',
  'Platform Fees',
  'Delivery & Shipping',
  'Salaries & Contractors',
  'Professional Services',
  'Bank & Payment Fees',
  'Office & Admin',
  'Inventory Purchase',
  'Returns & Refunds',
  'Cancellation Fees',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
