import type { ReactNode } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/src/shared/ui/BrandMark';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

const titleMap: Record<string, string> = {
  home: 'Dashboard',
  pos: 'Sale',
  'quick-entry': 'Quick Entry',
  services: 'Services',
  more: 'Profile',
  expenses: 'Expenses',
  purchases: 'Purchases',
  parties: 'Parties',
  banks: 'Banks',
  ledger: 'Ledger',
  inventory: 'Inventory',
  settings: 'Settings',
  workspaces: 'Workspaces',
  'change-password': 'Change Password',
  'owner-tools': 'Owner Tools',
  'service-create': 'New Service',
  'purchase-create': 'New Purchase',
  'expense-categories': 'Categories',
  invoice: 'Invoice',
  'print-preview': 'Print Preview',
};

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
  const title =
    titleOverride ??
    (currentSegment ? titleMap[currentSegment] ?? currentSegment : 'PasalManager');
  const resolvedLeadingMode =
    leadingMode === 'auto' ? (showBack ? 'back' : 'brand') : leadingMode;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        {resolvedLeadingMode === 'back' ? (
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/home');
              }
            }}>
            <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
          </Pressable>
        ) : resolvedLeadingMode === 'brand' ? (
          <BrandMark size={40} />
        ) : (
          <View style={styles.leadingSpacer} />
        )}
        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
