import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

const PALETTE_COLORS = [
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#0284c7', // Sky
  '#ea580c', // Orange
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#64748b', // Slate
];

const CATEGORY_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'Food': 'food-fork-drink',
  'Shopping': 'shopping',
  'Transport': 'car',
  'Housing': 'home',
  'Rent': 'home-city',
  'Entertainment': 'movie-open',
  'Education': 'school',
  'Salary': 'briefcase',
  'Investments': 'chart-line',
  'Allowance': 'wallet-giftcard',
  'Gift': 'gift',
  'Bonus': 'trophy',
  'Health': 'heart-pulse',
  'Bills': 'receipt',
  'Freelance': 'laptop',
  'Family': 'account-child',
  'Refund': 'cash-refund',
  'Other': 'dots-horizontal-circle-outline',
};

export interface CategoryBreakdownItem {
  id: string;
  kind: 'in' | 'out';
  title: string;
  amount: number;
}

interface CategoryBreakdownProps {
  items: CategoryBreakdownItem[];
  currency?: string;
}

export function CategoryBreakdown({ items, currency = 'NPR' }: CategoryBreakdownProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<'out' | 'in'>('out');

  const filteredItems = useMemo(() => items.filter((i) => i.kind === tab), [items, tab]);

  const { groups, total } = useMemo(() => {
    const map = new Map<string, { title: string; total: number; count: number }>();
    let sum = 0;

    for (const item of filteredItems) {
      const cat = item.title || 'Other';
      const existing = map.get(cat) || { title: cat, total: 0, count: 0 };
      existing.total += item.amount;
      existing.count += 1;
      map.set(cat, existing);
      sum += item.amount;
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return { groups: sorted, total: sum };
  }, [filteredItems]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>Category Breakdown</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {formatCurrency(total, currency)}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabWrap, { backgroundColor: colors.backgroundAlt }]}>
          <Pressable
            style={[styles.tabBtn, tab === 'out' && [styles.tabBtnActive, { backgroundColor: colors.surface }]]}
            onPress={() => setTab('out')}>
            <Text style={[styles.tabLabel, { color: tab === 'out' ? colors.danger : colors.textMuted }]}>
              Expense
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'in' && [styles.tabBtnActive, { backgroundColor: colors.surface }]]}
            onPress={() => setTab('in')}>
            <Text style={[styles.tabLabel, { color: tab === 'in' ? colors.success : colors.textMuted }]}>
              Income
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Segmented Distribution Bar */}
      {total > 0 && groups.length > 0 ? (
        <View style={[styles.barTrack, { backgroundColor: colors.backgroundAlt }]}>
          {groups.map((group, idx) => {
            const pct = Math.max(group.total / total, 0.02);
            const color = PALETTE_COLORS[idx % PALETTE_COLORS.length];
            return (
              <View
                key={group.title}
                style={{
                  flex: pct,
                  backgroundColor: color,
                  height: '100%',
                }}
              />
            );
          })}
        </View>
      ) : null}

      {/* Category List */}
      {!groups.length ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No {tab === 'out' ? 'expenses' : 'income'} recorded for this period.
        </Text>
      ) : (
        <View style={styles.list}>
          {groups.map((group, idx) => {
            const color = PALETTE_COLORS[idx % PALETTE_COLORS.length];
            const icon = CATEGORY_ICONS[group.title] || 'tag-outline';
            const pct = total > 0 ? ((group.total / total) * 100).toFixed(1) : '0';

            return (
              <View key={group.title} style={[styles.row, { borderColor: colors.border }]}>
                <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
                  <MaterialCommunityIcons name={icon} size={18} color={color} />
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.categoryTitle, { color: colors.text }]} numberOfLines={1}>
                      {group.title}
                    </Text>
                    <Text style={[styles.amountText, { color: tab === 'out' ? colors.danger : colors.success }]}>
                      {formatCurrency(group.total, currency)}
                    </Text>
                  </View>

                  {/* Progress Line */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.backgroundAlt }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.max(4, Number(pct)))}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={[styles.countText, { color: colors.textMuted }]}>
                      {group.count} {group.count === 1 ? 'entry' : 'entries'}
                    </Text>
                    <Text style={[styles.pctText, { color: color }]}>{pct}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      ...shadows.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    kicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: typography.heading,
      fontWeight: '800',
      marginTop: 2,
    },
    tabWrap: {
      flexDirection: 'row',
      borderRadius: radius.pill,
      padding: 3,
      gap: 2,
    },
    tabBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    tabBtnActive: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    barTrack: {
      height: 8,
      borderRadius: radius.pill,
      overflow: 'hidden',
      flexDirection: 'row',
      gap: 2,
    },
    list: {
      gap: spacing.sm,
      marginTop: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoCol: {
      flex: 1,
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    amountText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    progressTrack: {
      height: 4,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: radius.pill,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    countText: {
      fontSize: 11,
    },
    pctText: {
      fontSize: 11,
      fontWeight: '800',
    },
    emptyText: {
      fontSize: typography.label,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
  });
