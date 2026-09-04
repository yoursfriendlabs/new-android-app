import * as SecureStore from 'expo-secure-store';

import { deleteLocalJson, readLocalJson, writeLocalJson } from '@/src/shared/lib/local-json-store';
import {
  LEGACY_PROFILE_KEY,
  LEGACY_SESSION_KEY,
  LEGACY_SETTINGS_KEY,
  mergeStoredSession,
  migrateLegacySecureSession,
  PROFILE_DRAFT_KEY,
  sanitizeBusinessProfile,
  sanitizeBusinessSettings,
  SESSION_DRAFT_KEY,
  SESSION_TOKEN_KEY,
  SETTINGS_DRAFT_KEY,
  splitSessionForStorage,
} from '@/src/shared/lib/session-storage';
import type { BusinessProfile, BusinessSettings, SessionData } from '@/src/types/models';

let sessionCache: SessionData | null = null;
let profileCache: BusinessProfile | null = null;
let settingsCache: BusinessSettings | null = null;

async function readSecureToken() {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeSecureToken(token: string | null) {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    // Token persistence failed; session meta may still load for retry.
  }
}

async function loadSessionMeta() {
  const meta = await readLocalJson<Omit<SessionData, 'token'>>(SESSION_DRAFT_KEY);
  if (meta) return meta;

  const legacyRaw = await SecureStore.getItemAsync(LEGACY_SESSION_KEY);
  if (!legacyRaw) return null;

  const migrated = migrateLegacySecureSession(legacyRaw);
  if (migrated.meta) {
    await writeLocalJson(SESSION_DRAFT_KEY, migrated.meta);
  }
  if (migrated.token) {
    await writeSecureToken(migrated.token);
  }
  try {
    await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
  } catch {
    // Ignore.
  }
  return migrated.meta;
}

function applySessionGlobals(session: SessionData | null) {
  if (session?.token) {
    (global as any).apiToken = session.token;
  } else {
    delete (global as any).apiToken;
  }
  if (session?.businessId) {
    (global as any).apiBusinessId = session.businessId;
  } else {
    delete (global as any).apiBusinessId;
  }
}

export async function loadSession() {
  if (sessionCache) {
    applySessionGlobals(sessionCache);
    return sessionCache;
  }

  const [token, meta] = await Promise.all([readSecureToken(), loadSessionMeta()]);
  sessionCache = mergeStoredSession(token, meta);
  applySessionGlobals(sessionCache);
  return sessionCache;
}

export async function persistSession(session: SessionData | null) {
  const { token, meta } = splitSessionForStorage(session);
  sessionCache = mergeStoredSession(token, meta);
  applySessionGlobals(sessionCache);

  await Promise.all([
    writeSecureToken(token),
    meta ? writeLocalJson(SESSION_DRAFT_KEY, meta) : deleteLocalJson(SESSION_DRAFT_KEY, LEGACY_SESSION_KEY),
  ]);
}

export async function loadBusinessProfile() {
  if (profileCache) return profileCache;
  profileCache = await readLocalJson<BusinessProfile>(PROFILE_DRAFT_KEY, LEGACY_PROFILE_KEY);
  return profileCache;
}

export async function persistBusinessProfile(profile: BusinessProfile | null) {
  const sanitized = sanitizeBusinessProfile(profile);
  profileCache = sanitized;
  if (sanitized) {
    await writeLocalJson(PROFILE_DRAFT_KEY, sanitized);
    try {
      await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY);
    } catch {
      // Ignore.
    }
    return;
  }
  await deleteLocalJson(PROFILE_DRAFT_KEY, LEGACY_PROFILE_KEY);
}

export async function loadBusinessSettings() {
  if (settingsCache) return settingsCache;
  settingsCache = await readLocalJson<BusinessSettings>(SETTINGS_DRAFT_KEY, LEGACY_SETTINGS_KEY);
  return settingsCache;
}

export async function persistBusinessSettings(settings: BusinessSettings | null) {
  const sanitized = sanitizeBusinessSettings(settings);
  settingsCache = sanitized;
  if (sanitized) {
    await writeLocalJson(SETTINGS_DRAFT_KEY, sanitized);
    try {
      await SecureStore.deleteItemAsync(LEGACY_SETTINGS_KEY);
    } catch {
      // Ignore.
    }
    return;
  }
  await deleteLocalJson(SETTINGS_DRAFT_KEY, LEGACY_SETTINGS_KEY);
}

export async function clearSessionStorage() {
  sessionCache = null;
  profileCache = null;
  settingsCache = null;
  applySessionGlobals(null);
  await Promise.all([
    writeSecureToken(null),
    deleteLocalJson(SESSION_DRAFT_KEY, LEGACY_SESSION_KEY),
    deleteLocalJson(PROFILE_DRAFT_KEY, LEGACY_PROFILE_KEY),
    deleteLocalJson(SETTINGS_DRAFT_KEY, LEGACY_SETTINGS_KEY),
  ]);
}
