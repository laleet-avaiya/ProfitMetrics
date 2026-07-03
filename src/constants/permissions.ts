import { CompanyRole, type CompanyRole as CompanyRoleType } from './roles';

/** App feature modules — each supports view / create / update / delete. */
export const AppModule = {
  DASHBOARD: 'dashboard',
  REPORTS: 'reports',
  AI_ASSISTANT: 'ai_assistant',
  CUSTOMERS: 'customers',
  SALES: 'sales',
  PAYMENTS: 'payments',
  PURCHASES: 'purchases',
  EXPENSES: 'expenses',
  VENDORS: 'vendors',
  PRODUCTS: 'products',
  TEAM: 'team',
  SETTINGS: 'settings',
  CONFIGURATION: 'configuration',
  SUBSCRIPTION: 'subscription',
} as const;

export type AppModule = (typeof AppModule)[keyof typeof AppModule];

export const PermissionAction = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export type ModulePermissionKey = `${AppModule}.${PermissionAction}`;

export type ModulePermissionMap = Record<ModulePermissionKey, boolean>;

export const PERMISSION_ACTIONS: PermissionAction[] = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
];

export const MODULE_DEFINITIONS: {
  id: AppModule;
  label: string;
  description: string;
  group: 'overview' | 'sales' | 'purchase' | 'inventory' | 'account';
}[] = [
  { id: AppModule.DASHBOARD, label: 'Dashboard', description: 'View dashboard', group: 'overview' },
  { id: AppModule.REPORTS, label: 'Reports', description: 'View and export reports', group: 'overview' },
  { id: AppModule.AI_ASSISTANT, label: 'AI Assistant', description: 'Use AI chat', group: 'overview' },
  { id: AppModule.CUSTOMERS, label: 'Customers', description: 'Customer records', group: 'sales' },
  { id: AppModule.SALES, label: 'Sales', description: 'Customer sales & orders', group: 'sales' },
  { id: AppModule.PAYMENTS, label: 'Payments', description: 'Payment records', group: 'sales' },
  { id: AppModule.PURCHASES, label: 'Purchases', description: 'Purchase orders', group: 'purchase' },
  { id: AppModule.EXPENSES, label: 'Expenses', description: 'Business expenses', group: 'purchase' },
  { id: AppModule.VENDORS, label: 'Vendors', description: 'Supplier records', group: 'purchase' },
  { id: AppModule.PRODUCTS, label: 'Products', description: 'Products & stock', group: 'inventory' },
  { id: AppModule.TEAM, label: 'Team', description: 'Users and role management', group: 'account' },
  { id: AppModule.SETTINGS, label: 'Settings', description: 'Company profile & account', group: 'account' },
  { id: AppModule.CONFIGURATION, label: 'Configuration', description: 'App configuration', group: 'account' },
  { id: AppModule.SUBSCRIPTION, label: 'Subscription', description: 'Billing & subscription', group: 'account' },
];

export function permissionKey(module: AppModule, action: PermissionAction): ModulePermissionKey {
  return `${module}.${action}`;
}

export function actionLabel(action: PermissionAction): string {
  switch (action) {
    case PermissionAction.VIEW:
      return 'View';
    case PermissionAction.CREATE:
      return 'Add';
    case PermissionAction.UPDATE:
      return 'Edit';
    case PermissionAction.DELETE:
      return 'Delete';
    default:
      return action;
  }
}

function allPermissions(value: boolean): ModulePermissionMap {
  const map = {} as ModulePermissionMap;
  for (const module of MODULE_DEFINITIONS) {
    for (const action of PERMISSION_ACTIONS) {
      map[permissionKey(module.id, action)] = value;
    }
  }
  return map;
}

function businessModulesFull(): Partial<ModulePermissionMap> {
  const modules: AppModule[] = [
    AppModule.CUSTOMERS,
    AppModule.SALES,
    AppModule.PAYMENTS,
    AppModule.PURCHASES,
    AppModule.EXPENSES,
    AppModule.VENDORS,
    AppModule.PRODUCTS,
  ];
  const map: Partial<ModulePermissionMap> = {};
  for (const module of modules) {
    for (const action of PERMISSION_ACTIONS) {
      map[permissionKey(module, action)] = true;
    }
  }
  return map;
}

function businessModulesViewOnly(): Partial<ModulePermissionMap> {
  const modules: AppModule[] = [
    AppModule.CUSTOMERS,
    AppModule.SALES,
    AppModule.PAYMENTS,
    AppModule.PURCHASES,
    AppModule.EXPENSES,
    AppModule.VENDORS,
    AppModule.PRODUCTS,
  ];
  const map: Partial<ModulePermissionMap> = {};
  for (const module of modules) {
    map[permissionKey(module, PermissionAction.VIEW)] = true;
  }
  return map;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<CompanyRoleType, ModulePermissionMap> = {
  [CompanyRole.ADMIN]: allPermissions(true),
  [CompanyRole.MANAGER]: {
    ...allPermissions(false),
    [permissionKey(AppModule.DASHBOARD, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.REPORTS, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.AI_ASSISTANT, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.AI_ASSISTANT, PermissionAction.CREATE)]: true,
    [permissionKey(AppModule.SETTINGS, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.SETTINGS, PermissionAction.UPDATE)]: true,
    [permissionKey(AppModule.SUBSCRIPTION, PermissionAction.VIEW)]: true,
    ...businessModulesFull(),
  } as ModulePermissionMap,
  [CompanyRole.VIEWER]: {
    ...allPermissions(false),
    [permissionKey(AppModule.DASHBOARD, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.REPORTS, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.AI_ASSISTANT, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.AI_ASSISTANT, PermissionAction.CREATE)]: true,
    [permissionKey(AppModule.SETTINGS, PermissionAction.VIEW)]: true,
    [permissionKey(AppModule.SUBSCRIPTION, PermissionAction.VIEW)]: true,
    ...businessModulesViewOnly(),
  } as ModulePermissionMap,
  [CompanyRole.ACCOUNTANT]: {
    ...allPermissions(false),
    [permissionKey(AppModule.REPORTS, PermissionAction.VIEW)]: true,
  } as ModulePermissionMap,
};

export function hasModulePermission(
  role: CompanyRoleType | undefined,
  permissions: ModulePermissionMap | null | undefined,
  module: AppModule,
  action: PermissionAction
): boolean {
  if (!role) return false;
  if (role === CompanyRole.ADMIN) return true;
  const key = permissionKey(module, action);
  if (permissions && key in permissions) return permissions[key] === true;
  return DEFAULT_ROLE_PERMISSIONS[role]?.[key] === true;
}

const HOME_MODULE_ORDER: AppModule[] = [
  AppModule.DASHBOARD,
  AppModule.REPORTS,
  AppModule.AI_ASSISTANT,
  AppModule.CUSTOMERS,
  AppModule.SALES,
  AppModule.PAYMENTS,
  AppModule.PURCHASES,
  AppModule.EXPENSES,
  AppModule.VENDORS,
  AppModule.PRODUCTS,
  AppModule.TEAM,
  AppModule.CONFIGURATION,
  AppModule.SETTINGS,
  AppModule.SUBSCRIPTION,
];

const MODULE_HOME_PATHS: Partial<Record<AppModule, string>> = {
  [AppModule.DASHBOARD]: '/',
  [AppModule.REPORTS]: '/reports',
  [AppModule.AI_ASSISTANT]: '/ai-assistant',
  [AppModule.CUSTOMERS]: '/customers',
  [AppModule.SALES]: '/sales',
  [AppModule.PAYMENTS]: '/payments',
  [AppModule.PURCHASES]: '/purchases',
  [AppModule.EXPENSES]: '/expenses',
  [AppModule.VENDORS]: '/vendors',
  [AppModule.PRODUCTS]: '/products',
  [AppModule.TEAM]: '/team',
  [AppModule.CONFIGURATION]: '/configuration',
  [AppModule.SETTINGS]: '/settings',
  [AppModule.SUBSCRIPTION]: '/subscription',
};

/** First route the signed-in member can access (e.g. accountants land on /reports). */
export function getDefaultAppPath(
  role: CompanyRoleType | undefined,
  permissions: ModulePermissionMap | null | undefined
): string {
  for (const module of HOME_MODULE_ORDER) {
    const path = MODULE_HOME_PATHS[module];
    if (path && hasModulePermission(role, permissions, module, PermissionAction.VIEW)) {
      return path;
    }
  }
  return '/companies';
}

/** Maps Firestore collection names to permission modules. */
export const COLLECTION_MODULE_MAP: Record<string, AppModule> = {
  products: AppModule.PRODUCTS,
  stock: AppModule.PRODUCTS,
  sales: AppModule.SALES,
  payments: AppModule.PAYMENTS,
  purchases: AppModule.PURCHASES,
  expenses: AppModule.EXPENSES,
  vendors: AppModule.VENDORS,
  customers: AppModule.CUSTOMERS,
  aiChats: AppModule.AI_ASSISTANT,
};
