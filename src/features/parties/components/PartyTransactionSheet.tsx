import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { isInvalidSessionError } from '@/src/api/client';
import { partyTransactionsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { invalidatePartyQueries, useBanks } from '@/src/shared/hooks/useAppQueries';
import { todayIso } from '@/src/shared/lib/format';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { Party, PartyTransaction } from '@/src/types/models';

function createTransactionForm(party: Party | null, transaction?: PartyTransaction | null) {
  return {
    direction: (transaction?.direction ?? 'receive') as PartyTransaction['direction'],
    amount: transaction ? String(transaction.amount ?? 0) : '',
    txDate: transaction?.txDate ?? todayIso(),
    paymentMethod: (transaction?.paymentMethod ?? 'cash') as PartyTransaction['paymentMethod'],
    bankId: String(transaction?.bankId ?? ''),
    note: String(transaction?.note ?? ''),
  };
}

interface PartyTransactionSheetProps {
  visible: boolean;
  party: Party | null;
  transaction?: PartyTransaction | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function PartyTransactionSheet({
  onClose,
  onSaved,
  party,
  transaction,
  visible,
}: PartyTransactionSheetProps) {
  const colors = usePalette();
  const queryClient = useQueryClient();
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
  });
  const { data: banks } = useBanks();
  const [form, setForm] = useState(createTransactionForm(party, transaction));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(transaction?.id);
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  useEffect(() => {
    if (visible) {
      setForm(createTransactionForm(party, transaction));
      setError('');
    }
  }, [party, transaction, visible]);

  async function handleSave() {
    if (!party?.id) {
      setError(personal ? 'Choose a contact first.' : 'Choose a party first.');
      return;
    }
    if (Number(form.amount || 0) <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (form.paymentMethod === 'bank' && !form.bankId.trim()) {
      setError('Choose the bank account used for this payment.');
      return;
    }

    setSaving(true);
    setError('');
    const payload = {
      partyId: party.id,
      direction: form.direction,
      amount: Number(form.amount || 0),
      txDate: form.txDate,
      paymentMethod: form.paymentMethod,
      bankId: form.paymentMethod === 'bank' ? form.bankId || undefined : undefined,
      note: form.note || undefined,
    };

    try {
      if (transaction?.id) {
        const transactionId = transaction.id;
        await withWorkspaceRetry(() => partyTransactionsApi.update(transactionId, payload));
      } else {
        await withWorkspaceRetry(() => partyTransactionsApi.create(payload));
      }
      await invalidatePartyQueries(queryClient, [party.id, transaction?.partyId ?? '']);
      onSaved?.();
      onClose();
    } catch (nextError) {
      if (isInvalidSessionError(nextError)) return;
      setError(workspaceAccessMessage(nextError, 'Unable to save the payment.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={isEditing ? 'Edit payment' : personal ? 'Record money' : 'Record payment'}
      subtitle={
        party?.name
          ? `For ${party.name}`
          : personal
            ? 'Money received from them, or money you paid them.'
            : 'Payment in or payment out against this party.'
      }
      onClose={onClose}
      fullHeight
      footer={
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={() => void handleSave()}
          disabled={saving}>
          <Text style={[styles.saveLabel, { color: colors.white }]}>
            {saving ? 'Saving…' : isEditing ? 'Save payment' : 'Record payment'}
          </Text>
        </Pressable>
      }>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <SegmentedTabs
        value={form.direction}
        onChange={(direction) => setForm((current) => ({ ...current, direction }))}
        options={[
          { label: personal ? 'Received' : 'Payment in', value: 'receive' },
          { label: personal ? 'Paid' : 'Payment out', value: 'give' },
        ]}
      />
      <FormField
        label="Amount"
        value={form.amount}
        onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
        keyboardType="numeric"
        placeholder="0"
      />
      <PaymentMethodSelector
        value={form.paymentMethod}
        bankId={form.bankId}
        onChange={(paymentMethod, bankId) =>
          setForm((current) => ({
            ...current,
            paymentMethod,
            bankId: bankId ?? current.bankId,
          }))
        }
      />
      <FormField
        label="Date"
        value={form.txDate}
        onChangeText={(txDate) => setForm((current) => ({ ...current, txDate }))}
      />
      <FormField
        label="Note"
        value={form.note}
        onChangeText={(note) => setForm((current) => ({ ...current, note }))}
        multiline
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  saveButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  error: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  helper: {
    fontSize: typography.label,
    lineHeight: 20,
  },
  bankWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bankChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  bankChipLabel: {
    fontWeight: '700',
  },
});
