import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { BusinessTypeOption } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { layout, radius, spacing, typography } from '@/src/theme';

export type AccountKind = 'personal' | 'business';

export interface WorkspaceOption {
  value: string;
  apiValue: string;
  label: string;
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export const ACCOUNT_KIND_OPTIONS: Array<{
  value: AccountKind;
  label: string;
  description: string;
  icon: WorkspaceOption['icon'];
}> = [
  {
    value: 'personal',
    label: 'Personal',
    description: 'Income, expenses, parties, and notes.',
    icon: 'wallet-outline',
  },
  {
    value: 'business',
    label: 'Business',
    description: 'Sales, stock, parties, and the rest of the shop tools.',
    icon: 'storefront-outline',
  },
];

const ICON_MAP: Record<string, WorkspaceOption['icon']> = {
  retail: 'storefront-outline',
  shop: 'storefront-outline',
  general: 'briefcase-outline',
  general_store: 'basket-outline',
  cafe: 'coffee-outline',
  hospitality: 'silverware-fork-knife',
  gym: 'dumbbell',
  jewellery: 'diamond-stone',
  jewelry: 'diamond-stone',
  service: 'wrench-outline',
};

const FALLBACK_BUSINESS_TYPES: WorkspaceOption[] = [
  {
    value: 'retail',
    apiValue: 'retail',
    label: 'Shop / Retail',
    description: 'Counter billing, stock, and party balances.',
    icon: 'storefront-outline',
  },
  {
    value: 'cafe',
    apiValue: 'cafe',
    label: 'Cafe / Restaurant',
    description: 'Tables, orders, and daily counter sales.',
    icon: 'coffee-outline',
  },
  {
    value: 'gym',
    apiValue: 'gym',
    label: 'Gym / Fitness',
    description: 'Memberships, check-ins, and member balances.',
    icon: 'dumbbell',
  },
];

function isPersonalType(value?: string | null) {
  return /personal|household|individual/i.test(String(value || ''));
}

function toWorkspaceOption(type: BusinessTypeOption): WorkspaceOption {
  return {
    value: type.value,
    apiValue: type.value,
    label: type.label,
    description: type.description || 'A workspace tailored to this kind of work.',
    icon: ICON_MAP[type.value] ?? 'briefcase-outline',
  };
}

export function buildBusinessTypeOptions(remote?: BusinessTypeOption[] | null): WorkspaceOption[] {
  const fromApi = (remote ?? [])
    .filter((item) => item.value && !isPersonalType(item.value) && !isPersonalType(item.label))
    .map(toWorkspaceOption);
  return fromApi.length ? fromApi : FALLBACK_BUSINESS_TYPES;
}

interface AccountKindPickerProps {
  value: AccountKind;
  onChange: (value: AccountKind) => void;
}

export function AccountKindPicker({ onChange, value }: AccountKindPickerProps) {
  const colors = usePalette();

  return (
    <View style={styles.kindWrap}>
      {ACCOUNT_KIND_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.kindCard,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.accentSoft : colors.surface,
              },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.kindIcon, { backgroundColor: active ? colors.primary : colors.backgroundAlt }]}>
              <MaterialCommunityIcons
                name={option.icon}
                size={22}
                color={active ? colors.white : colors.textMuted}
              />
            </View>
            <View style={styles.kindCopy}>
              <Text style={[styles.kindLabel, { color: active ? colors.primary : colors.text }]}>{option.label}</Text>
              <Text style={[styles.kindDescription, { color: colors.textMuted }]}>{option.description}</Text>
            </View>
            <MaterialCommunityIcons
              name={active ? 'check-circle' : 'circle-outline'}
              size={22}
              color={active ? colors.primary : colors.borderStrong}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

interface BusinessTypePickerProps {
  options: WorkspaceOption[];
  value: string;
  onChange: (value: string) => void;
}

export function BusinessTypePicker({ onChange, options, value }: BusinessTypePickerProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const columns = width >= layout.tabletBreakpoint ? 3 : 2;
  const frameWidth = Math.min(width - layout.screenPadding * 2, layout.authMaxWidth);
  const cardWidth = (frameWidth - spacing.sm * (columns - 1)) / columns;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionLabel, { color: colors.textSoft }]}>Business type</Text>
      <View style={styles.grid}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.card,
                {
                  width: cardWidth,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons
                name={option.icon}
                size={22}
                color={active ? colors.primary : colors.textMuted}
              />
              <Text numberOfLines={2} style={[styles.cardLabel, { color: active ? colors.primary : colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? <Text style={[styles.hint, { color: colors.textMuted }]}>{selected.description}</Text> : null}
    </View>
  );
}

/** @deprecated Use AccountKindPicker + BusinessTypePicker */
export const WorkspaceTypePicker = BusinessTypePicker;

const styles = StyleSheet.create({
  kindWrap: {
    gap: spacing.sm,
  },
  kindCard: {
    minHeight: 88,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  kindIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindCopy: {
    flex: 1,
    gap: 4,
  },
  kindLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  kindDescription: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  wrap: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    lineHeight: 18,
  },
  hint: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.88,
  },
});
