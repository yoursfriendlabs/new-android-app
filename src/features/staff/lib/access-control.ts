export type AccessLevel = 'none' | 'view' | 'manage';

export const PERMISSION_KEYS = [
  'dashboard',
  'inventory',
  'quickPos',
  'sales',
  'services',
  'purchases',
  'quickExpenses',
  'parties',
  'tasks',
  'reports',
  'analytics',
  'settings',
  'staff',
  'banking',
  'tables',
  'orders',
  'billing',
  'attendance',
  'purchasePrice',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'manage'];
const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

const INVENTORY_DEPENDENT_PERMISSION_KEYS: PermissionKey[] = [
  'quickPos',
  'sales',
  'services',
  'purchases',
  'orders',
  'billing',
];

const PARTY_DEPENDENT_PERMISSION_KEYS: PermissionKey[] = [
  'quickPos',
  'sales',
  'services',
  'purchases',
  'billing',
];

const CAFE_PERMISSION_KEYS = new Set<string>(['tables', 'orders', 'billing']);

const STAFF_PERMISSION_UI_HIDDEN_KEYS = new Set<string>([
  'analytics',
  'tables',
  'orders',
  'billing',
]);

const STAFF_PERMISSION_UI_ORDER: string[] = [
  'dashboard',
  'quickPos',
  'sales',
  'services',
  'inventory',
  'purchasePrice',
  'purchases',
  'quickExpenses',
  'parties',
  'tasks',
  'reports',
  'banking',
  'staff',
  'attendance',
  'settings',
  'tables',
  'orders',
  'billing',
];

const FEATURE_PERMISSION_MAP: Record<string, PermissionKey> = {
  dashboard: 'dashboard',
  orders: 'orders',
  inventory: 'inventory',
  pos: 'quickPos',
  quickPos: 'quickPos',
  sales: 'sales',
  services: 'services',
  purchases: 'purchases',
  quickExpenses: 'quickExpenses',
  parties: 'parties',
  tasks: 'tasks',
  ledger: 'reports',
  reports: 'reports',
  analytics: 'reports',
  settings: 'settings',
  staff: 'staff',
  banks: 'banking',
  banking: 'banking',
  billing: 'billing',
  tables: 'tables',
  attendance: 'attendance',
  purchasePrice: 'purchasePrice',
};

export interface StaffPermissionFeature {
  key: string;
  label: string;
  description: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function isElevatedAccessRole(role = '') {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'owner' || normalized === 'admin' || normalized === 'super_admin';
}

export function normalizeAccessLevel(value: unknown): AccessLevel {
  const normalized = String(value || '').trim().toLowerCase();
  return ACCESS_LEVELS.includes(normalized as AccessLevel) ? (normalized as AccessLevel) : 'none';
}

function accessLevelRank(level: unknown) {
  return ACCESS_LEVEL_RANK[normalizeAccessLevel(level)] ?? 0;
}

export function maxAccessLevel(...levels: unknown[]): AccessLevel {
  return levels.reduce<AccessLevel>((highest, level) => (
    accessLevelRank(level) > accessLevelRank(highest) ? normalizeAccessLevel(level) : highest
  ), 'none');
}

export function getPermissionKeyForFeature(featureKey = '') {
  return FEATURE_PERMISSION_MAP[featureKey] || null;
}

function hasInventoryDependentAccess(permissions: Record<string, AccessLevel>) {
  return INVENTORY_DEPENDENT_PERMISSION_KEYS.some((key) => normalizeAccessLevel(permissions[key]) !== 'none');
}

function getRequiredPartiesAccessLevel(permissions: Record<string, unknown>): AccessLevel {
  let required: AccessLevel = 'none';
  for (const key of PARTY_DEPENDENT_PERMISSION_KEYS) {
    const level = normalizeAccessLevel(permissions[key]);
    if (level === 'manage') return 'manage';
    if (level !== 'none') required = 'view';
  }
  return required;
}

export function normalizePermissionMap(permissions: unknown): Record<string, AccessLevel> {
  const source = asObject(permissions) || {};
  const normalized = PERMISSION_KEYS.reduce<Record<string, AccessLevel>>((accumulator, key) => {
    accumulator[key] = normalizeAccessLevel(source[key]);
    return accumulator;
  }, {});

  const sourceHasAnyPermission = Object.keys(source).some(
    (key) => PERMISSION_KEYS.includes(key as PermissionKey) || key === 'analytics',
  );

  if (sourceHasAnyPermission) {
    if (!Object.prototype.hasOwnProperty.call(source, 'quickPos')) {
      normalized.quickPos = maxAccessLevel(source.sales, source.billing);
    }
    if (!Object.prototype.hasOwnProperty.call(source, 'attendance')) {
      normalized.attendance = 'manage';
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, 'reports')) {
    normalized.analytics = normalized.reports;
  } else if (Object.prototype.hasOwnProperty.call(source, 'analytics')) {
    normalized.reports = maxAccessLevel(normalized.reports, source.analytics);
    normalized.analytics = normalized.reports;
  } else {
    normalized.analytics = normalized.reports;
  }

  return normalized;
}

export function enforcePermissionDependencies(permissions: unknown) {
  const next = normalizePermissionMap(permissions);

  if (hasInventoryDependentAccess(next) && next.inventory === 'none') {
    next.inventory = 'view';
  }

  const requiredParties = getRequiredPartiesAccessLevel(next);
  if (accessLevelRank(next.parties) < accessLevelRank(requiredParties)) {
    next.parties = requiredParties;
  }

  return next;
}

export function applyPermissionChange(permissions: unknown, permissionKey: string, level: string) {
  const key = String(permissionKey || '').trim();
  const next = { ...normalizePermissionMap(permissions) };

  if (!PERMISSION_KEYS.includes(key as PermissionKey)) {
    return enforcePermissionDependencies(next);
  }

  next[key] = normalizeAccessLevel(level);

  if (key === 'reports') next.analytics = next.reports;
  if (key === 'analytics') next.reports = next.analytics;

  if (key === 'inventory' && next.inventory === 'none') {
    INVENTORY_DEPENDENT_PERMISSION_KEYS.forEach((dependentKey) => {
      next[dependentKey] = 'none';
    });
    return enforcePermissionDependencies(next);
  }

  if (key === 'parties' && next.parties === 'none') {
    PARTY_DEPENDENT_PERMISSION_KEYS.forEach((dependentKey) => {
      next[dependentKey] = 'none';
    });
    return enforcePermissionDependencies(next);
  }

  return enforcePermissionDependencies(next);
}

export function getFeatureAccessLevel(
  accessControl: { role?: string | null; permissions?: unknown } | null | undefined,
  featureKey: string,
  fallbackRole = '',
): AccessLevel | null {
  if (isElevatedAccessRole(fallbackRole) || isElevatedAccessRole(accessControl?.role || '')) {
    return 'manage';
  }

  const permissionKey = getPermissionKeyForFeature(featureKey);
  if (!permissionKey) return null;

  const permissions = asObject(accessControl?.permissions);
  if (!permissions) return null;

  const level = normalizeAccessLevel(permissions[permissionKey]);

  if (
    level !== 'none' &&
    INVENTORY_DEPENDENT_PERMISSION_KEYS.includes(permissionKey) &&
    normalizeAccessLevel(permissions.inventory) === 'none'
  ) {
    return 'none';
  }

  if (
    level !== 'none' &&
    PARTY_DEPENDENT_PERMISSION_KEYS.includes(permissionKey) &&
    normalizeAccessLevel(permissions.parties) === 'none'
  ) {
    return 'none';
  }

  return level;
}

export function hasAccessControlPayload(accessControl?: { permissions?: unknown; staffCategory?: unknown; role?: unknown; membershipId?: unknown } | null) {
  if (!accessControl) return false;
  if (accessControl.staffCategory || accessControl.membershipId || accessControl.role) return true;
  const permissions = accessControl.permissions;
  if (Array.isArray(permissions)) return permissions.length > 0;
  return Boolean(permissions && typeof permissions === 'object');
}

export function resolveStoredPermissions(
  accessControl?: { permissions?: unknown } | null,
  fallback?: string[] | Record<string, string>,
) {
  const permissions = accessControl?.permissions;
  if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
    return permissions as Record<string, string>;
  }
  if (Array.isArray(permissions) && permissions.length) {
    return permissions as string[];
  }
  return fallback;
}

export function canViewFeature(
  accessControl: { role?: string | null; permissions?: unknown } | null | undefined,
  featureKey: string,
  fallbackRole = '',
) {
  const level = getFeatureAccessLevel(accessControl, featureKey, fallbackRole);
  return level === null ? null : level !== 'none';
}

export function getStaffPermissionUiFeatures(
  features: Array<{ key?: string; label?: string; description?: string }> = [],
  { includeCafeModules = false } = {},
): StaffPermissionFeature[] {
  const byKey = new Map<string, StaffPermissionFeature>();

  features.forEach((feature) => {
    const rawKey = String(feature?.key || '').trim();
    if (!rawKey) return;

    let permissionKey = getPermissionKeyForFeature(rawKey) || rawKey;
    if (permissionKey === 'analytics' || rawKey === 'analytics') permissionKey = 'reports';
    if (rawKey === 'ledger') permissionKey = 'reports';

    const isCafeKey = CAFE_PERMISSION_KEYS.has(permissionKey) || CAFE_PERMISSION_KEYS.has(rawKey);
    if (
      (STAFF_PERMISSION_UI_HIDDEN_KEYS.has(permissionKey) || STAFF_PERMISSION_UI_HIDDEN_KEYS.has(rawKey)) &&
      !(includeCafeModules && isCafeKey)
    ) {
      return;
    }

    if (byKey.has(permissionKey)) return;

    byKey.set(permissionKey, {
      key: permissionKey,
      label:
        permissionKey === 'reports'
          ? pickString(feature.label).toLowerCase().includes('report')
            ? pickString(feature.label, 'Reports')
            : 'Reports'
          : pickString(feature.label, permissionKey),
      description: pickString(feature.description),
    });
  });

  const ordered = STAFF_PERMISSION_UI_ORDER.map((key) => byKey.get(key)).filter(Boolean) as StaffPermissionFeature[];
  const extras = [...byKey.keys()]
    .filter((key) => !STAFF_PERMISSION_UI_ORDER.includes(key))
    .map((key) => byKey.get(key))
    .filter(Boolean) as StaffPermissionFeature[];

  return [...ordered, ...extras];
}
