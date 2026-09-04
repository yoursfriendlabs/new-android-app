import type { BusinessProfile, BusinessSettings, SessionData } from '@/src/types/models';

export const SESSION_TOKEN_KEY = 'counterflow.auth.token';
export const SESSION_DRAFT_KEY = 'persist.session';
export const PROFILE_DRAFT_KEY = 'persist.profile';
export const SETTINGS_DRAFT_KEY = 'persist.settings';

export const LEGACY_SESSION_KEY = 'counterflow.session';
export const LEGACY_PROFILE_KEY = 'counterflow.profile';
export const LEGACY_SETTINGS_KEY = 'counterflow.settings';

type JsonRecord = Record<string, unknown>;

function pickDefined<T extends JsonRecord>(input: T, keys: Array<keyof T>) {
  return keys.reduce<Partial<T>>((result, key) => {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
    return result;
  }, {});
}

export function sanitizeSession(session: SessionData | null) {
  if (!session) return null;

  return {
    token: session.token,
    businessId: session.businessId,
    role: session.role ?? null,
    accessControl: session.accessControl
      ? (pickDefined(session.accessControl as JsonRecord, [
          'permissions',
          'staffCategory',
          'role',
          'membershipId',
          'category',
          'jobTitle',
        ]) as SessionData['accessControl'])
      : null,
    business: session.business
      ? (pickDefined(session.business as JsonRecord, ['id', 'businessId', 'name', 'businessName', 'businessType']) as SessionData['business'])
      : null,
    businesses: Array.isArray(session.businesses)
      ? session.businesses.map((item) => ({
          id: item.id,
          businessId: item.businessId ?? item.id,
          name: item.name,
          type: item.type,
          label: item.label,
          role: item.role,
          isOwner: Boolean(item.isOwner),
          isPersonal: Boolean(item.isPersonal),
          membershipId: item.membershipId ?? null,
          isActive: item.isActive !== false,
        }))
      : [],
    canCreateBusiness: Boolean(session.canCreateBusiness),
    subscription: session.subscription
      ? (pickDefined(session.subscription as JsonRecord, [
          'id',
          'status',
          'planName',
          'planCode',
          'billingCycle',
          'renewalDate',
          'expiryDate',
          'isActive',
          'role',
        ]) as SessionData['subscription'])
      : null,
    user: session.user
      ? (pickDefined(session.user as JsonRecord, ['id', 'name', 'email', 'phone', 'role', 'permissions', 'businessId']) as SessionData['user'])
      : null,
  } satisfies SessionData;
}

export function sanitizeBusinessProfile(profile: BusinessProfile | null) {
  if (!profile) return null;

  return pickDefined(profile as JsonRecord, [
    'id',
    'businessId',
    'businessName',
    'businessType',
    'enabledModules',
    'salesRoute',
    'servicesRoute',
    'currencyCode',
  ]) as BusinessProfile;
}

export function sanitizeBusinessSettings(settings: BusinessSettings | null) {
  if (!settings) return null;

  return pickDefined(settings as JsonRecord, [
    'businessName',
    'quickEntryDefaults',
    'counterMode',
    'taxEnabled',
    'lowStockAlert',
  ]) as BusinessSettings;
}

export function splitSessionForStorage(session: SessionData | null) {
  const sanitized = sanitizeSession(session);
  if (!sanitized) {
    return { token: null as string | null, meta: null as Omit<SessionData, 'token'> | null };
  }

  const { token, ...meta } = sanitized;
  return {
    token: token ?? null,
    meta,
  };
}

export function mergeStoredSession(token: string | null, meta: Omit<SessionData, 'token'> | null): SessionData | null {
  if (!meta && !token) return null;
  if (!meta) {
    return token ? ({ token } as SessionData) : null;
  }
  return {
    ...meta,
    token: token ?? '',
  };
}

export function migrateLegacySecureSession(raw: string): { token: string | null; meta: Omit<SessionData, 'token'> | null } {
  try {
    const parsed = JSON.parse(raw) as SessionData;
    return splitSessionForStorage(parsed);
  } catch {
    return { token: null, meta: null };
  }
}
