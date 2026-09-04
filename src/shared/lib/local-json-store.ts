import * as SecureStore from 'expo-secure-store';

import { clearDraft, initializeDatabase, readDraft, saveDraft } from '@/src/data/database';

export async function readLocalJson<T>(draftKey: string, legacySecureKey?: string): Promise<T | null> {
  await initializeDatabase();
  const current = await readDraft<T>(draftKey);
  if (current !== null) return current;

  if (!legacySecureKey) return null;

  const legacyRaw = await SecureStore.getItemAsync(legacySecureKey);
  if (!legacyRaw) return null;

  try {
    const parsed = JSON.parse(legacyRaw) as T;
    await saveDraft(draftKey, parsed);
    await SecureStore.deleteItemAsync(legacySecureKey);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLocalJson<T>(draftKey: string, value: T): Promise<void> {
  await initializeDatabase();
  await saveDraft(draftKey, value);
}

export async function deleteLocalJson(draftKey: string, legacySecureKey?: string): Promise<void> {
  await initializeDatabase();
  await clearDraft(draftKey);
  if (!legacySecureKey) return;
  try {
    await SecureStore.deleteItemAsync(legacySecureKey);
  } catch {
    // Ignore missing legacy keys.
  }
}
