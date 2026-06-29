import type { User } from 'firebase/auth';
import type { Company } from '../types';
import type { BusinessCountry } from '../constants/countries';

export interface SignUpCompanyDetails {
  companyName: string;
  country: BusinessCountry;
}

export interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  signUp: (email: string, password: string, details: SignUpCompanyDetails) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateCompany: (updates: Partial<Company>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}
