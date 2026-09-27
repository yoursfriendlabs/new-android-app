import type { ReactNode } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/src/shared/ui/BrandMark';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { a11y, spacing, typography } from '@/src/theme';

const segmentTitleKeyMap: Record<string, string> = {
  home: 'nav.home',
  pos: 'nav.pos',
  'quick-entry': 'quickEntry.title',
  services: 'inventory.services',
  more: 'nav.more',
  expenses: 'money.expenses',
  purchases: 'nav.purchases',
  parties: 'parties.title',
  banks: 'money.bankAccounts',
  ledger: 'money.ledger',
  inventory: 'inventory.title',
  settings: 'settings.title',
  workspaces: 'auth.workspaceSelect',
  'change-password': 'settings.changePassword',
  'owner-tools': 'nav.ownerTools',
  'service-create': 'inventory.services',
  'purchase-create': 'nav.purchases',
  'expense-categories': 'money.categories',
  invoice: 'pos.shareInvoice',
  'print-preview': 'pos.printReceipt',
  orders: 'nav.orders',
  tasks: 'nav.tasks',
  staff: 'nav.staff',
  'staff-salary': 'nav.salaries',
  attendance: 'nav.attendance',
  tables: 'nav.tables',
  coins: 'nav.coins',
};

/** "money-insights" -> "Money insights", so an unmapped route never shows a raw slug. */
function prettifySegment(segment: string) {
  const words = segment.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

interface TopAppBarProps {
  currentSegment?: string;
  showBack?: boolean;
  titleOverride?: string;
  right?: ReactNode;
  leadingMode?: 'auto' | 'brand' | 'back' | 'none';
}

export function TopAppBar({
  currentSegment,
  leadingMode = 'auto',
  right,
  showBack = false,
  titleOverride,
}: TopAppBarProps) {
  const colors = usePalette();
  const { t } = useTranslation();
  const title =
    titleOverride ??
    (currentSegment && segmentTitleKeyMap[currentSegment]
      ? t(segmentTitleKeyMap[currentSegment])
      : currentSegment
        ? prettifySegment(currentSegment)
        : 'PM');
  const resolvedLeadingMode =
    leadingMode === 'auto' ? (showBack ? 'back' : 'brand') : leadingMode;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        {resolvedLeadingMode === 'back' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/home');
              }
            }}>
            <MaterialCommunityIcons accessible={false} importantForAccessibility="no" color={colors.text} name="arrow-left" size={22} />
          </Pressable>
        ) : resolvedLeadingMode === 'brand' ? (
          <BrandMark size={40} />
        ) : (
          <View style={styles.leadingSpacer} />
        )}
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  iconButton: {
    width: a11y.minTouchTarget,
    height: a11y.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: a11y.minTouchTarget / 2,
    borderWidth: 1,
  },
  leadingSpacer: {
    width: 4,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
});
