import type { User } from 'firebase/auth';
import type {
  Company,
  CompanyMember,
  Organization,
  OrgMember,
  UserProfile,
} from '../types';
import type { ModulePermissionMap } from '../constants/permissions';
import type { BusinessCountry } from '../constants/countries';

export interface SignUpDetails {
  displayName: string;
}

export interface CreateCompanyDetails {
  companyName: string;
  country: BusinessCountry;
}

export interface UserOrgAccess {
  org: Organization;
  membership: OrgMember;
  companyCount: number;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  org: Organization | null;
  orgMembership: OrgMember | null;
  company: Company | null;
  membership: CompanyMember | null;
  rolePermissions: ModulePermissionMap | null;
  userCompanies: Company[];
  accessibleOrgs: UserOrgAccess[];
  loading: boolean;
  signUp: (email: string, password: string, details: SignUpDetails) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => Promise<void>;
  selectOrg: (orgId: string) => Promise<void>;
  createCompany: (details: CreateCompanyDetails) => Promise<Company>;
  createOwnOrganization: (displayName?: string) => Promise<Organization>;
  updateCompany: (updates: Partial<Company>) => Promise<void>;
  updateOrg: (updates: Partial<Organization>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshRolePermissions: () => Promise<void>;
  refreshCompanies: () => Promise<number>;
}
