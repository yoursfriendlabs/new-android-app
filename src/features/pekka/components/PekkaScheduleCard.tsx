import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { formatClockTime } from '@/src/features/habits/lib/daily-money-reminder';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { useTranslation } from '@/src/i18n';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

import type { PekkaScheduleSettings } from '../lib/schedule';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Turn one of Pekka's daily moments on or off and pick its time. Hidden where notifications can't run. */
export function PekkaScheduleCard({
  icon,
  titleKey,
  onKey,
  offKey,
  times,
  settings,
  onChange,
}: {
  icon: IconName;
  titleKey: string;
  onKey: string;
  offKey: string;
  times: Array<{ hour: number; minute: number }>;
  settings: PekkaScheduleSettings;
  onChange: (patch: Partial<PekkaScheduleSettings>) => Promise<void>;
}) {
  const colors = usePalette();
  const { t } = useTranslation();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!nativeRemindersAvailable()) return null;

  const toggle = async (next: boolean) => {
    void Haptics.selectionAsync();
    if (!next) {
      await onChange({ enabled: false });
      return;
    }
    setBusy(true);
    try {
      const { requestReminderPermission } = await import('@/src/features/habits/lib/interval-reminders');
      const allowed = await requestReminderPermission();
      setBlocked(!allowed);
      if (allowed) await onChange({ enabled: true });
    } finally {
      setBusy(false);
    }
  };

  const time = formatClockTime(settings.hour, settings.minute);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text variant="bodyStrong">{t(titleKey)}</Text>
          <Text variant="caption" tone="muted">
            {settings.enabled ? t(onKey, { time }) : t(offKey)}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t(titleKey)}
          value={settings.enabled}
          disabled={busy}
          onValueChange={(value) => void toggle(value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      {blocked ? (
        <Text variant="caption" tone="danger">
          {t('pekka.morning.permission')}
        </Text>
      ) : null}

      {settings.enabled ? (
        <View style={styles.times}>
          {times.map((option) => {
            const active = option.hour === settings.hour && option.minute === settings.minute;
            return (
              <Pressable
                key={`${option.hour}:${option.minute}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  void onChange({ hour: option.hour, minute: option.minute });
                }}
                style={[
                  styles.time,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                ]}>
                <Text variant="label" color={active ? colors.onPrimary : colors.text}>
                  {formatClockTime(option.hour, option.minute)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  time: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
