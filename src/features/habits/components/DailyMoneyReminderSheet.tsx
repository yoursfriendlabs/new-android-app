import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import {
  DAILY_REMINDER_CHIPS,
  formatClockTime,
  type DailyMoneyReminderSettings,
} from '@/src/features/habits/lib/daily-money-reminder';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

interface DailyMoneyReminderSheetProps {
  visible: boolean;
  value: DailyMoneyReminderSettings;
  onClose: () => void;
  onSave: (next: Pick<DailyMoneyReminderSettings, 'enabled' | 'hour' | 'minute'>) => Promise<void> | void;
}

export function DailyMoneyReminderSheet({ onClose, onSave, value, visible }: DailyMoneyReminderSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [enabled, setEnabled] = useState(value.enabled);
  const [hour, setHour] = useState(value.hour);
  const [minute, setMinute] = useState(value.minute);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEnabled(value.enabled);
    setHour(value.hour);
    setMinute(value.minute);
    setPickerOpen(false);
  }, [value.enabled, value.hour, value.minute, visible]);

  const pickerValue = useMemo(() => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }, [hour, minute]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ enabled, hour, minute });
      onClose();
    } catch {
      Alert.alert('Could not save reminder', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="Daily money reminder"
      subtitle="One ping a day. Water and focus stays extra, not louder than this."
      onClose={onClose}
      footer={
        <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
          <Text style={styles.saveLabel}>{saving ? 'Saving…' : enabled ? 'Save reminder' : 'Turn off'}</Text>
        </Pressable>
      }>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Remind me to log</Text>
          <Text style={styles.hint}>
            {nativeRemindersAvailable()
              ? 'A lock-screen ping at the time you pick.'
              : 'In Expo Go this alerts in-app. A development build can ping the lock screen.'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      <Text style={styles.sectionLabel}>Time</Text>
      <View style={styles.chips}>
        {DAILY_REMINDER_CHIPS.map((chip) => {
          const active = hour === chip.hour && minute === chip.minute;
          return (
            <Pressable
              key={chip.label}
              onPress={() => {
                setHour(chip.hour);
                setMinute(chip.minute);
                setEnabled(true);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.backgroundAlt,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}>
              <Text style={[styles.chipLabel, { color: active ? colors.onPrimary : colors.text }]}>{chip.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.chip, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <Text style={[styles.chipLabel, { color: colors.text }]}>Custom</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        style={[styles.timeRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Chosen time</Text>
        <Text style={[styles.timeValue, { color: colors.text }]}>{formatClockTime(hour, minute)}</Text>
      </Pressable>

      {pickerOpen ? (
        <View>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS !== 'ios') setPickerOpen(false);
              if (!date) return;
              setHour(date.getHours());
              setMinute(date.getMinutes());
              setEnabled(true);
            }}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setPickerOpen(false)} style={styles.doneBtn}>
              <Text style={[styles.chipLabel, { color: colors.primary }]}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    copy: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    hint: {
      fontSize: typography.caption,
      lineHeight: 18,
      color: colors.textMuted,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
      marginTop: spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
    },
    chipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    timeRow: {
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timeLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    timeValue: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    doneBtn: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: colors.white,
      fontWeight: '800',
      fontSize: typography.body,
    },
  });
