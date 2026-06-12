import * as SecureStore from 'expo-secure-store';

import type { BusinessProfile, BusinessSettings, SessionData } from '@/src/types/models';

const STORAGE_KEYS = {
  session: 'counterflow.session',
  profile: 'counterflow.profile',
  settings: 'counterflow.settings',
};

let sessionCache: SessionData | null = null;
let profileCache: BusinessProfile | null = null;
let settingsCache: BusinessSettings | null = null;

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

function sanitizeSession(session: SessionData | null) {
  if (!session) return null;

  return {
    token: session.token,
    businessId: session.businessId,
    role: session.role ?? null,
    accessControl: session.accessControl
      ? pickDefined(session.accessControl as JsonRecord, ['permissions']) as SessionData['accessControl']
      : null,
    business: session.business
      ? pickDefined(session.business as JsonRecord, ['id', 'businessId', 'name', 'businessName', 'businessType']) as SessionData['business']
      : null,
    subscription: session.subscription
      ? pickDefined(session.subscription as JsonRecord, ['id', 'status', 'planName', 'planCode', 'billingCycle', 'renewalDate', 'expiryDate', 'isActive', 'role']) as SessionData['subscription']
      : null,
    user: session.user
      ? pickDefined(session.user as JsonRecord, ['id', 'name', 'email', 'phone', 'role', 'permissions', 'businessId']) as SessionData['user']
      : null,
  } satisfies SessionData;
}

function sanitizeBusinessProfile(profile: BusinessProfile | null) {
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

function sanitizeBusinessSettings(settings: BusinessSettings | null) {
  if (!settings) return null;

  return pickDefined(settings as JsonRecord, [
    'businessName',
    'quickEntryDefaults',
    'counterMode',
    'taxEnabled',
    'lowStockAlert',
  ]) as BusinessSettings;
}

async function saveJson<T>(key: string, value: T | null) {
  if (!value) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

async function readJson<T>(key: string) {
  const storedValue = await SecureStore.getItemAsync(key);
  if (!storedValue) return null;

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return null;
  }
}

export async function loadSession() {
  if (sessionCache) {
    if (sessionCache.token) {
      (global as any).apiToken = sessionCache.token;
    }
    if (sessionCache.businessId) {
      (global as any).apiBusinessId = sessionCache.businessId;
    }
    return sessionCache;
  }
  sessionCache = await readJson<SessionData>(STORAGE_KEYS.session);
  if (sessionCache?.token) {
    (global as any).apiToken = sessionCache.token;
  }
  if (sessionCache?.businessId) {
    (global as any).apiBusinessId = sessionCache.businessId;
  }
  return sessionCache;
}

export async function persistSession(session: SessionData | null) {
  const sanitized = sanitizeSession(session);
  sessionCache = sanitized;
  if (sanitized?.token) {
    (global as any).apiToken = sanitized.token;
  } else {
    delete (global as any).apiToken;
  }
  if (sanitized?.businessId) {
    (global as any).apiBusinessId = sanitized.businessId;
  } else {
    delete (global as any).apiBusinessId;
  }
  await saveJson(STORAGE_KEYS.session, sanitized);
}

export async function loadBusinessProfile() {
  if (profileCache) return profileCache;
  profileCache = await readJson<BusinessProfile>(STORAGE_KEYS.profile);
  return profileCache;
}

export async function persistBusinessProfile(profile: BusinessProfile | null) {
  const sanitized = sanitizeBusinessProfile(profile);
  profileCache = sanitized;
  await saveJson(STORAGE_KEYS.profile, sanitized);
}

export async function loadBusinessSettings() {
  if (settingsCache) return settingsCache;
  settingsCache = await readJson<BusinessSettings>(STORAGE_KEYS.settings);
  return settingsCache;
}

export async function persistBusinessSettings(settings: BusinessSettings | null) {
  const sanitized = sanitizeBusinessSettings(settings);
  settingsCache = sanitized;
  await saveJson(STORAGE_KEYS.settings, sanitized);
}

export async function clearSessionStorage() {
  sessionCache = null;
  profileCache = null;
  settingsCache = null;
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.session),
    SecureStore.deleteItemAsync(STORAGE_KEYS.profile),
    SecureStore.deleteItemAsync(STORAGE_KEYS.settings),
  ]);
}
