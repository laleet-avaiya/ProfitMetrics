import type { TaxMode, TaxType } from './tax';

export interface Company {
  id: string;
  orgId: string;
  createdBy: string;
  name: string;
  country: string;
  timezone?: string;
  trn?: string;
  address?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  logo?: string;
  currency: string;
  defaultTaxType: TaxType;
  defaultTaxMode: TaxMode;
  defaultTaxPercentage: number;
  marketplaces?: string[];
  createdAt: Date;
  updatedAt: Date;
}
