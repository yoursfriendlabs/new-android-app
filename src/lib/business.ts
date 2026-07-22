import type { AccessControl, StaffMember, User } from '@/src/types/models';

export type AppCapability =
  | 'dashboard'
  | 'pos'
  | 'quick-entry'
  | 'services'
  | 'purchases'
  | 'parties'
  | 'banks'
  | 'ledger'
  | 'inventory'
  | 'owner-tools'
  | 'tasks'
  | 'tables';

export interface AccessContext {
  role?: string | null;
  permissions?: string[] | Record<string, string> | string | null;
  enabledModules?: string[] | string | null;
  accessControl?: AccessControl | null;
  businessType?: string | null;
}

type PermissionCarrier =
  | (Pick<User, 'role' | 'permissions'> & { enabledModules?: string[] | null; accessControl?: AccessControl | null; businessType?: string | null })
  | Pick<StaffMember, 'role' | 'permissions'>
  | AccessContext
  | null
  | undefined;


interface CapabilityDefinition {
  key: AppCapability;
  label: string;
  description: string;
  aliases: string[];
}

export const capabilityDefinitions: CapabilityDefinition[] = [
  {
    key: 'dashboard',
    label: 'Quick stats',
    description: 'Home dashboard, counters, and summary cards',
    aliases: ['dashboard', 'home', 'analytics', 'reports'],
  },
  {
    key: 'pos',
    label: 'Quick POS',
    description: 'Counter billing and print-ready sale entry',
    aliases: ['pos', 'quick-pos', 'sale', 'sales', 'billing', 'counter'],
  },
  {
    key: 'quick-entry',
    label: 'Quick entry',
    description: 'Fast expense and quick purchase capture',
    aliases: ['quick-entry', 'quick_entry', 'payment', 'payments', 'expense', 'expenses'],
  },
  {
    key: 'services',
    label: 'Services',
    description: 'Service jobs, delivery tracking, and received amounts',
    aliases: ['service', 'services', 'workshop'],
  },
  {
    key: 'purchases',
    label: 'Purchases',
    description: 'Supplier purchases, expenses, and full purchase flow',
    aliases: ['purchase', 'purchases', 'supplier-purchases'],
  },
  {
    key: 'parties',
    label: 'Parties',
    description: 'Customer, supplier, and contact records',
    aliases: ['party', 'parties', 'customers', 'suppliers', 'contacts'],
  },
  {
    key: 'banks',
    label: 'Banks',
    description: 'Bank accounts and payment destinations',
    aliases: ['bank', 'banks', 'accounts'],
  },
  {
    key: 'ledger',
    label: 'Ledger',
    description: 'Balances, statements, and receivable/payable history',
    aliases: ['ledger', 'statement', 'statements', 'balances'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock lookup and product browsing',
    aliases: ['inventory', 'products', 'stock'],
  },
  {
    key: 'owner-tools',
    label: 'Owner tools',
    description: 'Staff, subscription, and custom field administration',
    aliases: ['owner-tools', 'owner_tools', 'staff', 'subscription', 'custom-fields', 'order-attributes', 'admin'],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    description: 'Collaborate on team tasks and check updates',
    aliases: ['tasks', 'task', 'notifications', 'activities', 'activity'],
  },
  {
    key: 'tables',
    label: 'Table Management',
    description: 'Manage dining/cafe tables and seat assignments',
    aliases: ['tables', 'table', 'seating', 'orders'],
  },
];

function normalizePermissionToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function formatPermissionToken(value: string) {
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function parsePermissionTokens(input: string[] | Record<string, string> | string | null | undefined) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const rawValues: string[] = [];
    for (const [key, val] of Object.entries(input)) {
      rawValues.push(key);
      if (val) {
        rawValues.push(`${key}.${val}`);
      }
    }
    return Array.from(new Set(rawValues.map(normalizePermissionToken).filter(Boolean)));
  }

  const rawValues = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean);

  return Array.from(new Set(rawValues.map(normalizePermissionToken).filter(Boolean)));
}

function resolvePermissionTokens(user: PermissionCarrier) {
  const accessControl =
    user && typeof user === 'object' && 'accessControl' in user
      ? user.accessControl
      : null;
  const fromAccessControl = parsePermissionTokens(accessControl?.permissions);
  const directPermissions = parsePermissionTokens(user?.permissions);
  return Array.from(new Set([...fromAccessControl, ...directPermissions]));
}

function resolveEnabledModules(user: PermissionCarrier) {
  const enabledModules =
    user && typeof user === 'object' && 'enabledModules' in user
      ? user.enabledModules
      : null;
  return parsePermissionTokens(enabledModules);
}

function isModuleScopedCapability(capability: AppCapability) {
  return (
    capability === 'pos' ||
    capability === 'quick-entry' ||
    capability === 'services' ||
    capability === 'purchases' ||
    capability === 'parties' ||
    capability === 'inventory' ||
    capability === 'tables'
  );
}

function isModuleEnabled(user: PermissionCarrier, capability: AppCapability) {
  if (!isModuleScopedCapability(capability)) {
    return true;
  }

  if (capability === 'tables') {
    const bizType = user && typeof user === 'object' && 'businessType' in user ? (user as any).businessType : null;
    if (bizType === 'cafe') {
      return true;
    }
  }

  const enabledModules = resolveEnabledModules(user);
  if (!enabledModules.length) {
    return true;
  }

  const aliases = capabilityDefinitions.find((definition) => definition.key === capability)?.aliases ?? [];
  const normalizedAliases = aliases.map(normalizePermissionToken);
  return normalizedAliases.some((alias) => enabledModules.includes(alias));
}

export function formatPermissionTokens(tokens: string[] | Record<string, string> | string | null | undefined) {
  return parsePermissionTokens(tokens).join(', ');
}

export function isOwnerUser(user: PermissionCarrier) {
  const role = String(user?.role ?? '').toLowerCase();
  return role === 'owner' || role === 'admin' || role === '';
}

export function hasAppCapability(user: PermissionCarrier, capability: AppCapability) {
  if (!isModuleEnabled(user, capability)) {
    return false;
  }

  if (isOwnerUser(user)) {
    return true;
  }

  const permissions = resolvePermissionTokens(user);
  if (!permissions.length) {
    return true;
  }

  if (permissions.includes('*') || permissions.includes('all') || permissions.includes('full-access')) {
    return true;
  }

  const aliases = capabilityDefinitions.find((definition) => definition.key === capability)?.aliases ?? [];
  return permissions.some((permission) =>
    aliases.some((alias) => permission === alias || permission.startsWith(`${alias}.`)),
  );
}

export function getCapabilitySummary(user: PermissionCarrier) {
  if (isOwnerUser(user)) {
    return ['All mobile tools'];
  }

  const permissions = resolvePermissionTokens(user);
  if (!permissions.length) {
    return ['All mobile tools'];
  }

  const matched = capabilityDefinitions
    .filter((definition) => hasAppCapability(user, definition.key))
    .map((definition) => definition.label);

  return matched.length ? matched : permissions.map(formatPermissionToken);
}

export function canAccessSegment(user: PermissionCarrier, segment?: string) {
  const role = user && typeof user === 'object' && 'role' in user ? (user as any).role : null;
  const accessControl = user && typeof user === 'object' && 'accessControl' in user ? (user as any).accessControl : null;
  const isGeneralStaff = role === 'staff' || accessControl?.staffCategory === 'general_staff';

  if (isGeneralStaff) {
    return (
      segment === 'attendance-tab' ||
      segment === 'salary-tab' ||
      segment === 'attendance' ||
      segment === 'staff-salary'
    );
  }

  switch (segment) {
    case 'pos':
    case 'invoice':
    case 'print-preview':
      return hasAppCapability(user, 'pos');
    case 'orders':
    case 'seating':
    case 'tables':
    case 'cashier':
      return hasAppCapability(user, 'tables');
    case 'quick-entry':
    case 'sales':
      return hasAppCapability(user, 'quick-entry') || hasAppCapability(user, 'pos');
    case 'expenses':
      return hasAppCapability(user, 'quick-entry') || hasAppCapability(user, 'purchases');
    case 'services':
    case 'service-create':
      return hasAppCapability(user, 'services');
    case 'purchases':
    case 'purchase-create':
      return hasAppCapability(user, 'purchases');
    case 'parties':
      return hasAppCapability(user, 'parties');
    case 'banks':
      return hasAppCapability(user, 'banks');
    case 'ledger':
      return hasAppCapability(user, 'ledger');
    case 'inventory':
      return hasAppCapability(user, 'inventory');
    case 'owner-tools':
      return hasAppCapability(user, 'owner-tools');
    case 'tasks':
    case 'tasks/inbox':
    case 'tasks/detail':
    case 'tasks/form':
    case 'tasks/notifications':
      return hasAppCapability(user, 'tasks');
    case 'home':
    case 'more':
    case 'settings':
    case 'change-password':
    default:
      return true;
  }
}

export function isRemoteAttachment(uri: string) {
  return /^https?:\/\//i.test(uri);
}
