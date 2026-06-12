import type { ReactNode } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '@/src/theme';

const titleMap: Record<string, string> = {
  home: 'Dashboard',
  pos: 'Quick POS',
  'quick-entry': 'Quick Entry',
  services: 'Services',
  more: 'Profile',
  purchases: 'Purchases & Expenses',
  parties: 'Parties',
  banks: 'Banks',
  ledger: 'Ledger',
  inventory: 'Inventory',
  settings: 'Settings',
  'change-password': 'Change Password',
  'owner-tools': 'Owner Tools',
  'service-create': 'New Service',
  'purchase-create': 'New Purchase',
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
  const title =
    titleOverride ??
    (currentSegment ? titleMap[currentSegment] ?? currentSegment : 'PasalManager');
  const resolvedLeadingMode =
    leadingMode === 'auto' ? (showBack ? 'back' : 'brand') : leadingMode;

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {resolvedLeadingMode === 'back' ? (
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/home');
              }
            }}>
            <MaterialCommunityIcons color={palette.text} name="arrow-left" size={22} />
          </Pressable>
        ) : resolvedLeadingMode === 'brand' ? (
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>PM</Text>
          </View>
        ) : (
          <View style={styles.leadingSpacer} />
        )}
        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.title}>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  brandBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  brandBadgeText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: typography.label,
  },
  leadingSpacer: {
    width: 4,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: typography.subheading,
    color: palette.text,
    fontWeight: '800',
  },
});
