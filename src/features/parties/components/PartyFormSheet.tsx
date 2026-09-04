import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { isInvalidSessionError } from '@/src/api/client';
import { partiesApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { DeviceContactSheet } from '@/src/features/parties/components/DeviceContactSheet';
import { cachePartyRecord } from '@/src/data/cache';
import { pickNativeDeviceContact, type DeviceContactDraft } from '@/src/features/parties/lib/device-contacts';
import { generateId } from '@/src/shared/lib/id';
import { invalidatePartyQueries } from '@/src/shared/hooks/useAppQueries';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';

function createPartyForm(party?: Party | null, seed?: DeviceContactDraft | null, personal = false) {
  return {
    name: seed?.name ?? party?.name ?? '',
    phone: seed?.phone ?? party?.phone ?? '',
    email: seed?.email ?? String(party?.email ?? ''),
    address: String(party?.address ?? ''),
    type: String(party?.type ?? (personal ? 'both' : 'customer')),
    openingBalance: String(party?.openingBalance ?? 0),
    balanceType: String(party?.balanceType ?? 'receive'),
  };
}

interface PartyFormSheetProps {
  visible: boolean;
  party?: Party | null;
  seed?: DeviceContactDraft | null;
  onClose: () => void;
  onSaved?: (party: Party) => void;
  onDeleted?: (partyId: string) => void;
}

export function PartyFormSheet({ onClose, onDeleted, onSaved, party, seed, visible }: PartyFormSheetProps) {
  const colors = usePalette();
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
  });
  const queryClient = useQueryClient();
  const [form, setForm] = useState(createPartyForm(party, seed, personal));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  const isEditing = Boolean(party?.id);

  useEffect(() => {
    if (visible) {
      setForm(createPartyForm(party, seed, personal));
      setError('');
    }
  }, [party, personal, seed, visible]);

  async function handleSave() {
    if (!form.name.trim()) {
      setError(personal ? 'Contact name is required.' : 'Party name is required.');
      return;
    }

    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      type: form.type,
      openingBalance: Number(form.openingBalance || 0),
      balanceType: form.balanceType,
    };

    try {
      const response = party?.id
        ? await withWorkspaceRetry(() => partiesApi.update(party.id, payload))
        : await withWorkspaceRetry(() => partiesApi.create(payload));

      const saved = {
        ...(party ?? {}),
        ...(response as Party),
        id: (response as Party).id ?? party?.id ?? generateId('party'),
        ...payload,
      } as Party;

      await cachePartyRecord(saved);
      await invalidatePartyQueries(queryClient, [saved.id]);
      onSaved?.(saved);
      onClose();
    } catch (nextError) {
      if (isInvalidSessionError(nextError)) return;
      setError(workspaceAccessMessage(nextError, personal ? 'Unable to save the contact.' : 'Unable to save the party.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!party?.id) return;
    Alert.alert(personal ? 'Delete contact' : 'Delete party', `Remove ${party.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError('');
            try {
              await partiesApi.remove(party.id);
              await invalidatePartyQueries(queryClient, [party.id]);
              onDeleted?.(party.id);
              onClose();
            } catch (nextError) {
              if (isInvalidSessionError(nextError)) return;
              setError(nextError instanceof Error ? nextError.message : 'Unable to remove this contact.');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  function applyDeviceContact(draft: DeviceContactDraft) {
    setForm((current) => ({
      ...current,
      name: draft.name || current.name,
      phone: draft.phone || current.phone,
      email: draft.email || current.email,
      type: personal ? 'both' : current.type,
    }));
  }

  async function importFromPhone() {
    const native = await pickNativeDeviceContact();
    if (native) {
      applyDeviceContact(native);
      return;
    }
    if (native === undefined) setPhoneSheetVisible(true);
  }

  return (
    <>
    <BottomSheet
      visible={visible}
      title={isEditing ? (personal ? 'Edit contact' : 'Edit party') : personal ? 'New contact' : 'New party'}
      subtitle={
        personal
          ? isEditing
            ? 'Update this person and any opening balance they already have.'
            : 'Add someone you pay, get paid by, or just want on record.'
          : isEditing
            ? 'Update contact details and opening balance.'
            : 'Add a customer or supplier to track dues.'
      }
      onClose={onClose}
      fullHeight
      footer={
        <View style={styles.footer}>
          {isEditing ? (
            <Pressable
              style={[styles.button, { backgroundColor: colors.dangerSoft }]}
              onPress={() => void handleDelete()}
              disabled={saving}>
              <Text style={[styles.buttonLabel, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary, flex: 1.4 }]}
            onPress={() => void handleSave()}
            disabled={saving}>
            <Text style={[styles.buttonLabel, { color: colors.white }]}>
              {saving ? 'Saving…' : isEditing ? (personal ? 'Save contact' : 'Save party') : personal ? 'Save contact' : 'Create party'}
            </Text>
          </Pressable>
        </View>
      }>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {!isEditing ? (
        <Pressable
          style={[styles.importBtn, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
          onPress={() => void importFromPhone()}>
          <MaterialCommunityIcons name="contacts-outline" size={20} color={colors.primary} />
          <Text style={[styles.importLabel, { color: colors.text }]}>
            {personal ? 'Add from phone contacts' : 'Choose from phone contacts'}
          </Text>
        </Pressable>
      ) : null}
      <FormField
        label="Name"
        value={form.name}
        onChangeText={(name) => setForm((current) => ({ ...current, name }))}
        autoCapitalize="words"
      />
      <FormField
        label="Phone"
        value={form.phone}
        onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
        keyboardType="phone-pad"
      />
      <FormField
        label="Email"
        value={form.email}
        onChangeText={(email) => setForm((current) => ({ ...current, email }))}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField
        label="Address"
        value={form.address}
        onChangeText={(address) => setForm((current) => ({ ...current, address }))}
        multiline
      />
      {!personal ? (
        <SegmentedTabs
          value={form.type as 'customer' | 'supplier'}
          onChange={(value) => setForm((current) => ({ ...current, type: value }))}
          options={[
            { label: 'Customer', value: 'customer' },
            { label: 'Supplier', value: 'supplier' },
          ]}
        />
      ) : null}
      <FormField
        label={personal ? 'Opening amount' : 'Opening balance'}
        value={form.openingBalance}
        onChangeText={(openingBalance) => setForm((current) => ({ ...current, openingBalance }))}
        keyboardType="numeric"
      />
      <SegmentedTabs
        value={form.balanceType as 'receive' | 'give'}
        onChange={(balanceType) => setForm((current) => ({ ...current, balanceType }))}
        options={[
          { label: 'They owe me', value: 'receive' },
          { label: 'I owe them', value: 'give' },
        ]}
      />
    </BottomSheet>
    <DeviceContactSheet
      visible={phoneSheetVisible}
      onClose={() => setPhoneSheetVisible(false)}
      onPick={applyDeviceContact}
    />
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  error: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  importBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  importLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
});
