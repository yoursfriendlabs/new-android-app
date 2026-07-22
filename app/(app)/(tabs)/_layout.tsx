import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canAccessSegment } from '@/src/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, radius, spacing } from '@/src/theme';

export function GlobalImeLogo({ size = 24 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: size * 1.5,
          height: size * 1.5,
          transform: [{ rotate: '-35deg' }],
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#d32f2f' }} />
        <View style={{ width: size * 0.1, backgroundColor: '#ffffff' }} />
        <View style={{ flex: 1, backgroundColor: '#0263f9' }} />
      </View>
    </View>
  );
}

/**
 * Tab definitions:
 * [segment, label, inactiveIcon, activeIcon]
 */
type TabDef = [string, string, string, string];

const PRIMARY_TABS: TabDef[] = [
  ['home', 'Dashboard', 'home-outline', 'home'],
  ['orders', 'Seating Map', 'table-chair', 'table-chair'],
  ['inventory', 'Inventory', 'package-variant-closed', 'package-variant-closed'],
  ['tasks', 'Tasks', 'checkbox-marked-circle-outline', 'checkbox-marked-circle'],
  ['expenses', 'Expenses', 'wallet-outline', 'wallet'],
  ['more', 'More', 'menu', 'menu'],
];

const HIDDEN_TABS = ['quick-entry', 'pos', 'parties'];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
  };

  const role = session?.role ?? user?.role ?? null;
  const isGeneralStaff = role === 'staff' || accessControl?.staffCategory === 'general_staff';

  const visiblePrimaryTabs = isGeneralStaff
    ? ([
        ['attendance-tab', 'Attendance', 'map-marker-radius', 'map-marker-radius'],
        ['salary-tab', 'Salary', 'wallet-outline', 'wallet'],
      ] as TabDef[])
    : PRIMARY_TABS.filter(([name]) => canAccessSegment(accessContext, name));

  const hiddenTabs = isGeneralStaff
    ? [
        'home',
        'orders',
        'inventory',
        'tasks',
        'expenses',
        'more',
        'quick-entry',
        'pos',
        'parties',
      ]
    : [
        ...HIDDEN_TABS.filter((name) => canAccessSegment(accessContext, name)),
        'attendance-tab',
        'salary-tab',
      ];

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSoft,
        tabBarStyle: {
          height: 64 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          paddingHorizontal: spacing.xs,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      {/* Primary visible tabs */}
      {visiblePrimaryTabs.map(([name, title, inactiveIcon, activeIcon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => {
              if (name === 'home' && focused) {
                return (
                  <View style={[styles.iconWrap, styles.iconWrapActive]}>
                    <GlobalImeLogo size={24} />
                  </View>
                );
              }
              if (name === 'home') {
                return (
                  <View style={styles.iconWrap}>
                    <GlobalImeLogo size={22} />
                  </View>
                );
              }

              return (
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <MaterialCommunityIcons
                    color={focused ? palette.primary : color}
                    name={
                      (focused ? activeIcon : inactiveIcon) as keyof typeof MaterialCommunityIcons.glyphMap
                    }
                    size={22}
                  />
                </View>
              );
            },
            tabBarLabel: ({ focused, color }) => (
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: focused ? palette.primary : color },
                  focused && styles.tabLabelActive,
                ]}>
                {title}
              </Text>
            ),
          }}
        />
      ))}

      {/* Hidden tabs — still rendered for routing but not shown in tab bar */}
      {hiddenTabs.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null, // hides from tab bar
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 50,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconWrapActive: {
    backgroundColor: palette.accentSoft,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});

