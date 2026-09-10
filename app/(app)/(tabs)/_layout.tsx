import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canAccessSegment, isGeneralStaffUser, isPersonalWorkspace } from '@/src/shared/lib/business';
import { MoneyEntrySheet } from '@/src/features/money/components/MoneyEntrySheet';
import { useTaskNotificationSummary } from '@/src/features/notes/hooks/useTaskQueries';
import { haptics } from '@/src/shared/lib/haptics';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { motion, radius, shadows, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type TabDef = {
  name: string;
  titleKey: string;
  fallbackTitle: string;
  inactiveIcon: IconName;
  activeIcon: IconName;
  isCenterFab?: boolean;
};

const PRIMARY_TABS: TabDef[] = [
  { name: 'home', titleKey: 'nav.home', fallbackTitle: 'Home', inactiveIcon: 'home-outline', activeIcon: 'home' },
  { name: 'pos', titleKey: 'nav.pos', fallbackTitle: 'Sale', inactiveIcon: 'cash-register', activeIcon: 'cash-register' },
  { name: 'quick-entry', titleKey: 'common.add', fallbackTitle: 'Add', inactiveIcon: 'plus', activeIcon: 'plus', isCenterFab: true },
  { name: 'parties', titleKey: 'nav.parties', fallbackTitle: 'Parties', inactiveIcon: 'account-group-outline', activeIcon: 'account-group' },
  { name: 'more', titleKey: 'nav.more', fallbackTitle: 'More', inactiveIcon: 'dots-horizontal', activeIcon: 'dots-horizontal-circle' },
];

const PERSONAL_TABS: TabDef[] = [
  { name: 'home', titleKey: 'nav.home', fallbackTitle: 'Home', inactiveIcon: 'home-outline', activeIcon: 'home' },
  { name: 'expenses', titleKey: 'money.title', fallbackTitle: 'Money', inactiveIcon: 'wallet-outline', activeIcon: 'wallet' },
  { name: 'quick-entry', titleKey: 'common.add', fallbackTitle: 'Add', inactiveIcon: 'plus', activeIcon: 'plus', isCenterFab: true },
  { name: 'parties', titleKey: 'parties.title', fallbackTitle: 'Contacts', inactiveIcon: 'account-outline', activeIcon: 'account' },
  { name: 'more', titleKey: 'nav.more', fallbackTitle: 'More', inactiveIcon: 'dots-horizontal', activeIcon: 'dots-horizontal-circle' },
];

const STAFF_TABS: TabDef[] = [
  { name: 'attendance-tab', titleKey: 'nav.attendance', fallbackTitle: 'Attendance', inactiveIcon: 'map-marker-radius', activeIcon: 'map-marker-radius' },
  { name: 'salary-tab', titleKey: 'nav.salaries', fallbackTitle: 'Salary', inactiveIcon: 'wallet-outline', activeIcon: 'wallet' },
];

const ALL_TAB_SCREENS = [
  'home',
  'pos',
  'expenses',
  'quick-entry',
  'parties',
  'more',
  'orders',
  'inventory',
  'tasks',
  'services',
  'attendance-tab',
  'salary-tab',
] as const;

/** Tab icon with a pill that springs in behind it when the tab becomes active. */
function TabIcon({
  activeIcon,
  badge = 0,
  colors,
  focused,
  inactiveColor,
  inactiveIcon,
}: {
  activeIcon: IconName;
  badge?: number;
  colors: AppPalette;
  focused: boolean;
  inactiveColor: ColorValue;
  inactiveIcon: IconName;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      damping: motion.spring.snappy.damping,
      mass: motion.spring.snappy.mass,
      stiffness: motion.spring.snappy.stiffness,
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.iconPill,
          {
            backgroundColor: colors.accentSoft,
            opacity: progress,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      />
      <MaterialCommunityIcons
        color={focused ? colors.primary : inactiveColor}
        name={focused ? activeIcon : inactiveIcon}
        size={22}
      />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <Text style={[styles.badgeLabel, { color: colors.onDanger }]}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The raised centre button. Presses scale it down instead of just flashing. */
function CenterFab({ colors, onPress }: { colors: AppPalette; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.spring(scale, {
      damping: motion.spring.snappy.damping,
      mass: motion.spring.snappy.mass,
      stiffness: motion.spring.snappy.stiffness,
      toValue: value,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add entry"
      onPressIn={() => animateTo(motion.pressScale - 0.05)}
      onPressOut={() => animateTo(1)}
      onPress={onPress}>
      <Animated.View
        style={[
          styles.centerFab,
          { backgroundColor: colors.primary, borderColor: colors.surface, transform: [{ scale }] },
        ]}>
        <MaterialCommunityIcons name="plus" size={28} color={colors.onPrimary} />
      </Animated.View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = usePalette();
  const { t } = useTranslation();
  const [logMoneyVisible, setLogMoneyVisible] = useState(false);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  };

  const isGeneralStaff = isGeneralStaffUser(accessContext);
  const visibleTabs = isGeneralStaff
    ? STAFF_TABS
    : isPersonalWorkspace(accessContext)
      ? PERSONAL_TABS
      : PRIMARY_TABS.filter((tab) => canAccessSegment(accessContext, tab.name));
  const visibleNames = new Set(visibleTabs.map((tab) => tab.name));
  const tabByName = new Map([...PRIMARY_TABS, ...PERSONAL_TABS, ...STAFF_TABS].map((tab) => [tab.name, tab]));
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);

  // Unread task activity rides on the More tab, which is where notifications live.
  const canSeeTasks = canAccessSegment(accessContext, 'tasks');
  const notifications = useTaskNotificationSummary({ enabled: canSeeTasks });
  const unreadCount = canSeeTasks ? Number(notifications.data?.unreadActivityCount ?? 0) : 0;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSoft,
          tabBarStyle: {
            height: 62 + bottomPadding,
            paddingTop: 8,
            paddingBottom: bottomPadding,
            paddingHorizontal: spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            ...shadows.sheet,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
        }}>
        {ALL_TAB_SCREENS.map((name) => {
          const def = tabByName.get(name);
          const visible = visibleNames.has(name);

          if (!visible || !def) {
            return (
              <Tabs.Screen
                key={name}
                name={name}
                options={{ href: null }}
              />
            );
          }

          if (def.isCenterFab) {
            return (
              <Tabs.Screen
                key={name}
                name={name}
                listeners={{
                  tabPress: (e) => {
                    e.preventDefault();
                    haptics.tapMedium();
                    setLogMoneyVisible(true);
                  },
                }}
                options={{
                  title: '',
                  tabBarLabel: () => null,
                  tabBarIcon: () => (
                    <CenterFab
                      colors={colors}
                      onPress={() => {
                        haptics.tapMedium();
                        setLogMoneyVisible(true);
                      }}
                    />
                  ),
                }}
              />
            );
          }

          return (
            <Tabs.Screen
              key={name}
              name={name}
              listeners={{ tabPress: () => haptics.tapLight() }}
              options={{
                title: t(def.titleKey) || def.fallbackTitle,
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    activeIcon={def.activeIcon}
                    inactiveIcon={def.inactiveIcon}
                    badge={name === 'more' ? unreadCount : 0}
                    colors={colors}
                    focused={focused}
                    inactiveColor={color}
                  />
                ),
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      { color: focused ? colors.primary : color },
                      focused && styles.tabLabelActive,
                    ]}>
                    {t(def.titleKey) || def.fallbackTitle}
                  </Text>
                ),
              }}
            />
          );
        })}
      </Tabs>

      <MoneyEntrySheet
        visible={logMoneyVisible}
        kind="expense"
        compact
        onClose={() => setLogMoneyVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  centerFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginTop: -20,
    ...shadows.floating,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
