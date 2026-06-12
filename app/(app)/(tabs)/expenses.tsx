import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { purchasesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { Screen } from '@/src/components/layout/Screen';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import { usePurchases } from '@/src/hooks/useAppQueries';
import { palette, radius, shadows, spacing, typography } from '@/src/theme';
import type { Purchase } from '@/src/types/models';

function expenseTitle(item: Purchase) {
  return item.partyName || item.invoiceNo || item.notes || 'Expense entry';
}

export default function ExpensesTabScreen() {
  const { data: expenses } = usePurchases('expense');
  const [selectedExpense, setSelectedExpense] = useState<Purchase | null>(null);

  const totalExpense = (expenses ?? []).reduce((sum, item) => sum + Number(item.grandTotal ?? 0), 0);
  const paidExpense = (expenses ?? []).reduce((sum, item) => sum + Number(item.amountReceived ?? 0), 0);
  const pendingExpense = Math.max(0, totalExpense - paidExpense);

  const categoryTotals: Record<string, number> = {};
  let totalCalculated = 0;
  
  (expenses ?? []).forEach((item) => {
    const catName = item.items?.[0]?.description || item.partyName || 'Uncategorized';
    const amount = Number(item.grandTotal ?? 0);
    categoryTotals[catName] = (categoryTotals[catName] || 0) + amount;
    totalCalculated += amount;
  });

  const calculatedBreakdown = Object.entries(categoryTotals)
    .map(([categoryName, total]) => ({
      categoryName,
      total,
      shareOfTotal: totalCalculated > 0 ? total / totalCalculated : 0,
      categoryKey: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }))
    .sort((a, b) => b.total - a.total);

  async function deleteExpense() {
    if (!selectedExpense?.id) return;

    try {
      await purchasesApi.remove(selectedExpense.id);
      setSelectedExpense(null);
      Alert.alert('Expense deleted', 'The entry was removed successfully.');
    } catch {
      Alert.alert('Unable to delete expense', 'Please try again in a moment.');
    }
  }

  return (
    <Screen scrollable={false} padded={false} showTopBar={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <Pressable style={styles.headerButton} onPress={() => router.push('/(app)/(tabs)/quick-entry?tab=expense')}>
          <MaterialCommunityIcons color={palette.white} name="plus" size={22} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>THIS MONTH EXPENSES</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalExpense)}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Paid {formatCurrency(paidExpense)}</Text>
            </View>
            <View style={[styles.heroMetaChip, styles.heroMetaChipMuted]}>
              <Text style={[styles.heroMetaLabel, styles.heroMetaLabelMuted]}>
                Pending {formatCurrency(pendingExpense)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entries</Text>
            <Text style={styles.summaryValue}>{String(expenses?.length ?? 0)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>{formatCurrency(paidExpense)}</Text>
          </View>
        </View>

        {calculatedBreakdown.length > 0 ? (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Expense Breakdown</Text>
            <View style={styles.chartList}>
              {calculatedBreakdown.slice(0, 5).map((item, index) => {
                const colors = [
                  palette.primary,
                  '#8c643f',
                  '#c29b74',
                  '#eeddc8',
                  '#d5bca4'
                ];
                const barColor = colors[index % colors.length];
                const percentage = item.shareOfTotal ? Math.round(item.shareOfTotal * 100) : 0;
                
                return (
                  <View key={item.categoryKey} style={styles.chartRow}>
                    <View style={styles.chartRowHeader}>
                      <Text style={styles.chartCategoryName}>{item.categoryName}</Text>
                      <Text style={styles.chartCategoryValue}>
                        {formatCurrency(item.total)} ({percentage}%)
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { width: `${Math.max(3, percentage)}%`, backgroundColor: barColor }
                        ]} 
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <Pressable onPress={() => router.push({ pathname: '/(app)/purchases', params: { filter: 'expense' } })}>
            <Text style={styles.sectionLink}>View All</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {(expenses ?? []).slice(0, 12).map((item) => (
            <Pressable key={item.id} style={styles.expenseCard} onPress={() => setSelectedExpense(item)}>
              <View style={styles.expenseIcon}>
                <MaterialCommunityIcons color={palette.danger} name="cash-minus" size={18} />
              </View>
              <View style={styles.expenseCopy}>
                <Text numberOfLines={1} style={styles.expenseTitle}>
                  {expenseTitle(item)}
                </Text>
                <Text style={styles.expenseMeta}>
                  {prettyDate(item.purchaseDate)}  •  {item.paymentMethod === 'bank' ? 'Online' : 'Cash'}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>-{formatCurrency(item.grandTotal)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selectedExpense)}
        title={selectedExpense ? expenseTitle(selectedExpense) : 'Expense details'}
        subtitle={selectedExpense?.notes || 'Expense entry details'}
        onClose={() => setSelectedExpense(null)}
        footer={
          <Pressable style={[styles.sheetPrimary, { flex: 0 }]} onPress={() => void deleteExpense()}>
            <Text style={styles.sheetPrimaryLabel}>Delete Expense</Text>
          </Pressable>
        }>
        <View style={styles.sheetBody}>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Date</Text>
            <Text style={styles.sheetValue}>{prettyDate(selectedExpense?.purchaseDate)}</Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Status</Text>
            <Text style={styles.sheetValue}>{selectedExpense?.status || 'received'}</Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Amount</Text>
            <Text style={styles.sheetValue}>{formatCurrency(selectedExpense?.grandTotal ?? 0)}</Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Payment</Text>
            <Text style={styles.sheetValue}>{selectedExpense?.paymentMethod === 'bank' ? 'Online / Bank' : 'Cash'}</Text>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    color: '#1e293b',
    fontSize: 20,
    fontWeight: '800',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0263f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
    backgroundColor: '#f8fafd',
  },
  heroCard: {
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: '#004ebd',
    ...shadows.card,
    gap: spacing.sm,
  },
  heroKicker: {
    color: '#93c5fd',
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroValue: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroMetaChip: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  heroMetaChipMuted: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroMetaLabel: {
    color: '#ffffff',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  heroMetaLabelMuted: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: palette.surface,
    padding: spacing.md,
    ...shadows.card,
    gap: spacing.xs,
  },
  summaryLabel: {
    color: palette.textSoft,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  summaryValue: {
    color: palette.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sectionLink: {
    color: '#0263f9',
    fontSize: typography.caption,
    fontWeight: '800',
  },
  list: {
    gap: spacing.sm,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fde8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  expenseTitle: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  expenseMeta: {
    color: palette.textSoft,
    fontSize: typography.caption,
  },
  expenseAmount: {
    color: '#d32f2f',
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  sheetPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetBody: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetLabel: {
    color: palette.textSoft,
    fontSize: typography.body,
  },
  sheetValue: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  chartCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: spacing.md,
    ...shadows.card,
    gap: spacing.sm,
  },
  chartTitle: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  chartList: {
    gap: spacing.md,
  },
  chartRow: {
    gap: spacing.xxs,
  },
  chartRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartCategoryName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: palette.text,
  },
  chartCategoryValue: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.textMuted,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
