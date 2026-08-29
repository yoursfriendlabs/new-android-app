import { Alert, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

export interface DeviceContactDraft {
  name: string;
  phone?: string;
  email?: string;
}

function contactName(contact: Contacts.Contact) {
  return (
    String(contact.name || '').trim() ||
    [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ').trim() ||
    String(contact.phoneNumbers?.[0]?.number || '').trim()
  );
}

export function toDeviceContactDraft(contact: Contacts.Contact | null | undefined): DeviceContactDraft | null {
  if (!contact) return null;
  const name = contactName(contact);
  if (!name) return null;
  const phone = String(contact.phoneNumbers?.[0]?.number || '').trim() || undefined;
  const email = String(contact.emails?.[0]?.email || '').trim() || undefined;
  return { name, phone, email };
}

export async function requestContactsAccess() {
  const current = await Contacts.getPermissionsAsync();
  const status = current.status === 'granted' ? current : await Contacts.requestPermissionsAsync();
  if (status.status === 'granted') return true;
  Alert.alert(
    'Contacts access needed',
    Platform.OS === 'ios'
      ? 'Allow contacts in Settings so you can add people you pay or get paid by.'
      : 'Allow contacts access so you can pick someone from your phone book.',
  );
  return false;
}

export async function pickNativeDeviceContact(): Promise<DeviceContactDraft | null | undefined> {
  const allowed = await requestContactsAccess();
  if (!allowed) return null;

  const picker = (Contacts as typeof Contacts & {
    presentContactPickerAsync?: () => Promise<Contacts.Contact | null>;
  }).presentContactPickerAsync;

  if (typeof picker !== 'function') return undefined;

  try {
    const selected = await picker();
    return selected ? toDeviceContactDraft(selected) : null;
  } catch {
    return undefined;
  }
}

export async function loadDeviceContacts(): Promise<DeviceContactDraft[]> {
  const allowed = await requestContactsAccess();
  if (!allowed) return [];

  const result = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    sort: Contacts.SortTypes.FirstName,
    pageSize: 500,
  });

  const unique = new Map<string, DeviceContactDraft>();
  for (const contact of result.data ?? []) {
    const draft = toDeviceContactDraft(contact);
    if (!draft) continue;
    const key = `${draft.name}|${draft.phone ?? ''}`;
    if (!unique.has(key)) unique.set(key, draft);
  }
  return [...unique.values()];
}
