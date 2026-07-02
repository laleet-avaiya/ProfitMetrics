export const CompanyRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VIEWER: 'viewer',
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
];

export type Permission =
  | 'read'
  | 'write'
  | 'manage_team'
  | 'manage_company'
  | 'manage_subscription';

const ROLE_PERMISSIONS: Record<CompanyRole, Permission[]> = {
  [CompanyRole.ADMIN]: ['read', 'write', 'manage_team', 'manage_company', 'manage_subscription'],
  [CompanyRole.MANAGER]: ['read', 'write'],
  [CompanyRole.VIEWER]: ['read'],
};

export function roleHasPermission(role: CompanyRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function roleLabel(role: CompanyRole): string {
  return COMPANY_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
