import {
  canViewFeature,
  getFeatureAccessLevel,
  isElevatedAccessRole,
} from '@/src/features/staff/lib/access-control';
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
  featureKey: string;
}

export const capabilityDefinitions: CapabilityDefinition[] = [
  {
    key: 'dashboard',
    label: 'Quick stats',
    description: 'Home dashboard, counters, and summary cards',
    aliases: ['dashboard', 'home', 'analytics', 'reports'],
    featureKey: 'dashboard',
  },
  {
    key: 'pos',
    label: 'Quick POS',
    description: 'Counter billing and print-ready sale entry',
    aliases: ['pos', 'quick-pos', 'sale', 'sales', 'billing', 'counter'],
    featureKey: 'quickPos',
  },
  {
    key: 'quick-entry',
    label: 'Quick entry',
    description: 'Fast expense and quick purchase capture',
    aliases: ['quick-entry', 'quick_entry', 'payment', 'payments', 'expense', 'expenses'],
    featureKey: 'quickExpenses',
  },
  {
    key: 'services',
    label: 'Services',
    description: 'Service jobs, delivery tracking, and received amounts',
    aliases: ['service', 'services', 'workshop'],
    featureKey: 'services',
  },
  {
    key: 'purchases',
    label: 'Purchases',
    description: 'Supplier purchases, expenses, and full purchase flow',
    aliases: ['purchase', 'purchases', 'supplier-purchases'],
    featureKey: 'purchases',
  },
  {
    key: 'parties',
    label: 'Parties',
    description: 'Customer, supplier, and contact records',
    aliases: ['party', 'parties', 'customers', 'suppliers', 'contacts'],
    featureKey: 'parties',
  },
  {
    key: 'banks',
    label: 'Banks',
    description: 'Bank accounts and payment destinations',
    aliases: ['bank', 'banks', 'accounts', 'banking'],
    featureKey: 'banking',
  },
  {
    key: 'ledger',
    label: 'Ledger',
    description: 'Balances, statements, and receivable/payable history',
    aliases: ['ledger', 'statement', 'statements', 'balances', 'reports'],
    featureKey: 'reports',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock lookup and product browsing',
    aliases: ['inventory', 'products', 'stock'],
    featureKey: 'inventory',
  },
  {
    key: 'owner-tools',
    label: 'Owner tools',
    description: 'Staff, subscription, and custom field administration',
    aliases: ['owner-tools', 'owner_tools', 'staff', 'subscription', 'custom-fields', 'order-attributes', 'admin'],
    featureKey: 'staff',
  },
  {
    key: 'tasks',
    label: 'Tasks & notes',
    description: 'To-dos, reminders, and notes for the workspace',
    aliases: ['tasks', 'task', 'notes', 'note', 'notifications', 'activities', 'activity'],
    featureKey: 'tasks',
  },
  {
    key: 'tables',
    label: 'Table Management',
    description: 'Manage dining/cafe tables and seat assignments',
    aliases: ['tables', 'table', 'seating', 'orders', 'billing'],
    featureKey: 'tables',
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

function resolveAccessControl(user: PermissionCarrier) {
  if (user && typeof user === 'object' && 'accessControl' in user) {
    return user.accessControl ?? null;
  }
  return null;
}

function resolvePermissionTokens(user: PermissionCarrier) {
  const fromAccessControl = parsePermissionTokens(resolveAccessControl(user)?.permissions as never);
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

export function resolveBusinessType(user: PermissionCarrier) {
  if (!user || typeof user !== 'object') return '';
  const rawType =
    ('businessType' in user ? (user as AccessContext).businessType : null) ??
    ('type' in user ? (user as any).type : null);
  return String(rawType || '')
    .trim()
    .toLowerCase();
}

export function isPersonalWorkspace(user: PermissionCarrier) {
  const type = resolveBusinessType(user);
  return type === 'personal' || type === 'household' || type === 'individual';
}

export function isCafeWorkspace(user: PermissionCarrier) {
  const type = resolveBusinessType(user);
  if (type === 'cafe' || type === 'hospitality') return true;
  const modules = resolveEnabledModules(user);
  return modules.includes('tables') || modules.includes('orders') || modules.includes('billing');
}

function isModuleEnabled(user: PermissionCarrier, capability: AppCapability) {
  if (capability === 'tables') {
    return isCafeWorkspace(user);
  }

  if (capability === 'services' && isCafeWorkspace(user)) {
    const modules = resolveEnabledModules(user);
    return modules.includes('services') || modules.includes('service');
  }

  if (!isModuleScopedCapability(capability)) {
    return true;
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

const PERSONAL_CAPABILITIES = new Set<AppCapability>([
  'dashboard',
  'parties',
  'ledger',
  'banks',
  'tasks',
]);

const PERSONAL_BLOCKED_SEGMENTS = new Set([
  'pos',
  'orders',
  'seating',
  'tables',
  'cashier',
  'quick-entry',
  'sales',
  'services',
  'service-create',
  'purchases',
  'purchase-create',
  'inventory',
  'owner-tools',
  'staff',
  'staff-salary',
  'attendance',
  'attendance-tab',
  'salary-tab',
]);

export function isOwnerUser(user: PermissionCarrier) {
  const role = String(user?.role ?? '').toLowerCase();
  return isElevatedAccessRole(role) || role === '';
}

export function isGeneralStaffUser(user: PermissionCarrier) {
  const accessControl = resolveAccessControl(user);
  return String(accessControl?.staffCategory ?? '').toLowerCase() === 'general_staff';
}

function hasGrantedFeature(user: PermissionCarrier, featureKey: string) {
  if (isOwnerUser(user)) return true;

  const accessControl = resolveAccessControl(user);
  const role = String(user?.role ?? '');
  const level = getFeatureAccessLevel(accessControl, featureKey, role);
  if (level !== null) return level !== 'none';

  const viewed = canViewFeature(accessControl, featureKey, role);
  if (viewed !== null) return viewed;

  const permissions = resolvePermissionTokens(user);
  if (!permissions.length) return false;
  if (permissions.includes('*') || permissions.includes('all') || permissions.includes('full-access')) {
    return true;
  }

  const aliases = capabilityDefinitions
    .filter((definition) => definition.featureKey === featureKey)
    .flatMap((definition) => definition.aliases)
    .map(normalizePermissionToken);

  return permissions.some((permission) =>
    aliases.some((alias) => permission === alias || permission.startsWith(`${alias}.`)),
  );
}

export function hasAppCapability(user: PermissionCarrier, capability: AppCapability) {
  if (isPersonalWorkspace(user)) {
    return PERSONAL_CAPABILITIES.has(capability);
  }

  if (!isModuleEnabled(user, capability)) {
    return false;
  }

  if (isOwnerUser(user)) {
    return true;
  }

  const definition = capabilityDefinitions.find((item) => item.key === capability);
  if (!definition) return false;

  if (hasGrantedFeature(user, definition.featureKey)) return true;

  if (capability === 'pos') {
    return hasGrantedFeature(user, 'sales') || hasGrantedFeature(user, 'billing');
  }

  if (capability === 'tables') {
    return hasGrantedFeature(user, 'orders') || hasGrantedFeature(user, 'billing');
  }

  return false;
}

export function getCapabilitySummary(user: PermissionCarrier) {
  if (isPersonalWorkspace(user)) {
    return ['Income', 'Expenses', 'Contacts', 'Reminders'];
  }

  if (isOwnerUser(user)) {
    return ['All mobile tools'];
  }

  const matched = capabilityDefinitions
    .filter((definition) => hasAppCapability(user, definition.key))
    .map((definition) => definition.label);

  return matched.length ? matched : ['Limited access'];
}

export function canAccessSegment(user: PermissionCarrier, segment?: string) {
  if (isGeneralStaffUser(user)) {
    return (
      segment === 'attendance-tab' ||
      segment === 'salary-tab' ||
      segment === 'attendance' ||
      segment === 'staff-salary' ||
      segment === 'change-password' ||
      segment === 'more' ||
      segment === 'settings'
    );
  }

  if (isPersonalWorkspace(user)) {
    return !PERSONAL_BLOCKED_SEGMENTS.has(segment || '');
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
    case 'staff':
      return hasAppCapability(user, 'owner-tools');
    case 'tasks':
    case 'tasks/inbox':
    case 'tasks/detail':
    case 'tasks/form':
    case 'tasks/notifications':
      return hasAppCapability(user, 'tasks');
    case 'attendance':
    case 'attendance-tab':
      return isOwnerUser(user) || hasGrantedFeature(user, 'attendance');
    case 'salary-tab':
    case 'staff-salary':
      return isOwnerUser(user);
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
