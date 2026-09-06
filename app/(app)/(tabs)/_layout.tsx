import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canAccessSegment, isGeneralStaffUser, isPersonalWorkspace } from '@/src/shared/lib/business';
import { MoneyEntrySheet } from '@/src/features/money/components/MoneyEntrySheet';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { spacing } from '@/src/theme';
import { useState } from 'react';

type TabDef = {
  name: string;
  titleKey: string;
  fallbackTitle: string;
  inactiveIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
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
            elevation: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
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
                    setLogMoneyVisible(true);
                  },
                }}
                options={{
                  title: '',
                  tabBarLabel: () => null,
                  tabBarIcon: () => (
                    <View style={[styles.centerFab, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                      <MaterialCommunityIcons name="plus" size={28} color="#ffffff" />
                    </View>
                  ),
                }}
              />
            );
          }

          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: t(def.titleKey) || def.fallbackTitle,
                tabBarIcon: ({ color, focused }) => (
                  <View style={[styles.iconWrap, focused && { backgroundColor: colors.accentSoft }]}>
                    <MaterialCommunityIcons
                      color={focused ? colors.primary : color}
                      name={focused ? def.activeIcon : def.inactiveIcon}
                      size={22}
                    />
                  </View>
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
  centerFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginTop: -20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
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
