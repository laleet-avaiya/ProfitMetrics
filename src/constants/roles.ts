export const CompanyRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VIEWER: 'viewer',
  ACCOUNTANT: 'accountant',
} as const;

export type CompanyRole = (typeof CompanyRole)[keyof typeof CompanyRole];

export const COMPANY_ROLE_OPTIONS: { value: CompanyRole; label: string; description: string }[] = [
  {
    value: CompanyRole.ADMIN,
    label: 'Admin',
    description: 'Full access, team management, and company settings',
  },
  {
    value: CompanyRole.MANAGER,
    label: 'Manager',
    description: 'Create and edit business data',
  },
  {
    value: CompanyRole.VIEWER,
    label: 'Viewer',
    description: 'Read-only access to business data',
  },
  {
    value: CompanyRole.ACCOUNTANT,
    label: 'Accountant',
    description: 'View reports only — no access to transactions or settings',
  },
];

export type Permission =
  | 'read'
  | 'write'
  | 'manage_team'
  | 'manage_company'
  | 'manage_subscription';

/** @deprecated Use module permissions from constants/permissions.ts */
export function roleHasPermission(role: CompanyRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const legacy: Record<CompanyRole, Permission[]> = {
    [CompanyRole.ADMIN]: ['read', 'write', 'manage_team', 'manage_company', 'manage_subscription'],
    [CompanyRole.MANAGER]: ['read', 'write'],
    [CompanyRole.VIEWER]: ['read'],
    [CompanyRole.ACCOUNTANT]: ['read'],
  };
  return legacy[role].includes(permission);
}

export function roleLabel(role: CompanyRole): string {
  return COMPANY_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
