import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { staffApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, spacing, radius, typography, shadows, layout } from '@/src/theme';
import type { StaffSalaryRecord } from '@/src/types/models';

export default function StaffSalaryBookScreen() {
  const { membershipId, name } = useLocalSearchParams<{ membershipId: string; name: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);

  const userRole = session?.role ?? user?.role ?? 'staff';
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  // Fetch salary records
  const { data: salaryData, isLoading } = useQuery({
    queryKey: ['staff-salary', membershipId],
    queryFn: async () => {
      const res = await staffApi.listSalaryRecords(membershipId);
      return res as unknown as { records: StaffSalaryRecord[] };
    },
    enabled: !!membershipId,
  });

  const [formSheetVisible, setFormSheetVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'salary' | 'advance'>('salary');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mutations
  const createRecordMutation = useMutation({
    mutationFn: (payload: any) => staffApi.createSalaryRecord(membershipId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-salary', membershipId] });
      setFormSheetVisible(false);
      resetForm();
      Alert.alert('Success', 'Salary record logged successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to log salary record');
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (recordId: string) => staffApi.deleteSalaryRecord(membershipId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-salary', membershipId] });
      Alert.alert('Success', 'Record deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to delete record');
    },
  });

  const resetForm = () => {
    setAmount('');
    setType('salary');
    setDate(new Date().toISOString().split('T')[0]);
    setMonthYear(new Date().toISOString().slice(0, 7));
    setNote('');
  };

  const handleSave = async () => {
    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a positive numeric amount');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
      Alert.alert('Invalid Month', 'Month must be in YYYY-MM format');
      return;
    }

    setSubmitting(true);
    try {
      await createRecordMutation.mutateAsync({
        amount: amtNum,
        type,
        date,
        monthYear,
        note: note.trim() || undefined,
      });
    } catch {
      // Handled in mutation
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (recordId: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this salary record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecordMutation.mutate(recordId);
          },
        },
      ]
    );
  };

  // Summarize statistics
  const stats = useMemo(() => {
    const records = salaryData?.records || [];
    let totalSalary = 0;
    let totalAdvance = 0;
    
    // Monthly stats for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    let monthSalary = 0;
    let monthAdvance = 0;

    records.forEach((r) => {
      const amt = Number(r.amount);
      if (r.type === 'salary') {
        totalSalary += amt;
        if (r.monthYear === currentMonth) monthSalary += amt;
      } else if (r.type === 'advance') {
        totalAdvance += amt;
        if (r.monthYear === currentMonth) monthAdvance += amt;
      }
    });

    return {
      totalSalary,
      totalAdvance,
      monthSalary,
      monthAdvance,
      currentMonth,
    };
  }, [salaryData?.records]);

  return (
    <Screen
      topBarTitle="Salary & Advance Book"
      footer={
        isOwnerOrAdmin ? (
          <StickyActionBar
            primary={{
              label: 'Log New Payment',
              onPress: () => {
                resetForm();
                setFormSheetVisible(true);
              },
            }}
          />
        ) : undefined
      }>
      <PageHeading title={name || 'Staff Salary'} subtitle="Bookkeeping for salary payments and cash advances." />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.loadingText}>Fetching salary records...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Summary tiles */}
          <View style={styles.statsRow}>
            <SurfaceCard style={styles.statsCard}>
              <Text style={styles.statsLabel}>Total Advances Given</Text>
              <Text style={[styles.statsValue, { color: palette.danger }]}>
                रू {stats.totalAdvance.toLocaleString()}
              </Text>
            </SurfaceCard>
            <View style={{ width: spacing.md }} />
            <SurfaceCard style={styles.statsCard}>
              <Text style={styles.statsLabel}>Paid (Current Month)</Text>
              <Text style={[styles.statsValue, { color: palette.success }]}>
                रू {stats.monthSalary.toLocaleString()}
              </Text>
            </SurfaceCard>
          </View>

          <Text style={styles.sectionHeader}>History logs</Text>

          {(salaryData?.records || []).map((record) => {
            const isSal = record.type === 'salary';
            return (
              <View key={record.id} style={styles.recordRow}>
                <View style={[styles.indicator, isSal ? styles.indicatorSalary : styles.indicatorAdvance]}>
                  <MaterialCommunityIcons
                    name={isSal ? 'cash-check' : 'cash-refund'}
                    size={22}
                    color={isSal ? palette.success : palette.danger}
                  />
                </View>
                <View style={styles.recordCopy}>
                  <View style={styles.recordTitleRow}>
                    <Text style={styles.recordType}>
                      {isSal ? 'Salary Payout' : 'Cash Advance'}
                    </Text>
                    <Text style={styles.recordAmount}>
                      रू {Number(record.amount).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.recordMeta}>
                    Date: {record.date}  •  For Month: {record.monthYear}
                  </Text>
                  {record.note ? (
                    <Text style={styles.recordNote}>{record.note}</Text>
                  ) : null}
                </View>
                {isOwnerOrAdmin ? (
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(record.id)}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={palette.textSoft} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {!salaryData?.records?.length ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="notebook-outline" size={48} color={palette.textSoft} />
              <Text style={styles.emptyText}>No salary or advance records logged yet.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Log Payment Bottom Sheet */}
      <BottomSheet
        visible={formSheetVisible}
        title="Log Payment or Advance"
        subtitle="Log base salary payouts or quick cash advances. Logs map to monthly bookkeeping accounts."
        onClose={() => setFormSheetVisible(false)}
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>Log Record</Text>
            )}
          </Pressable>
        }>
        <View style={styles.formWrap}>
          <FormField
            label="Payment Amount (रू) *"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="e.g. 5000"
          />

          <Text style={styles.fieldLabel}>Transaction Type</Text>
          <View style={styles.typeSelector}>
            <Pressable
              style={[styles.typeOption, type === 'salary' && styles.typeOptionActive]}
              onPress={() => setType('salary')}>
              <Text style={[styles.typeText, type === 'salary' && styles.typeTextActive]}>Salary Payment</Text>
            </Pressable>
            <Pressable
              style={[styles.typeOption, type === 'advance' && styles.typeOptionActive, type === 'advance' && styles.typeOptionActiveAdvance]}
              onPress={() => setType('advance')}>
              <Text style={[styles.typeText, type === 'advance' && styles.typeTextActive]}>Cash Advance</Text>
            </Pressable>
          </View>

          <FormField
            label="Transaction Date (YYYY-MM-DD) *"
            value={date}
            onChangeText={setDate}
            placeholder="e.g. 2026-06-27"
          />

          <FormField
            label="Salary Book Month (YYYY-MM) *"
            value={monthYear}
            onChangeText={setMonthYear}
            placeholder="e.g. 2026-06"
            helperText="Maps this payment to a specific accounting salary month"
          />

          <FormField
            label="Remarks / Notes"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Medical emergency or Monthly base salary payout"
            multiline
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  content: {
    gap: spacing.md,
    paddingBottom: layout.stickyBarOffset,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statsCard: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textSoft,
    textTransform: 'uppercase',
  },
  statsValue: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    ...shadows.card,
    gap: spacing.md,
  },
  indicator: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSalary: {
    backgroundColor: palette.successSoft,
  },
  indicatorAdvance: {
    backgroundColor: palette.dangerSoft,
  },
  recordCopy: {
    flex: 1,
    gap: 2,
  },
  recordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordType: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  recordAmount: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  recordMeta: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  recordNote: {
    fontSize: typography.caption,
    color: palette.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  formWrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
    marginBottom: spacing.xxs,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    overflow: 'hidden',
    padding: 3,
  },
  typeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  typeOptionActive: {
    backgroundColor: palette.primary,
  },
  typeOptionActiveAdvance: {
    backgroundColor: palette.danger,
  },
  typeText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.textMuted,
  },
  typeTextActive: {
    color: palette.white,
  },
});
