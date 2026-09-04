import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { COIN_REWARDS, plusCoins } from '@/src/features/habits/lib/coins';
import {
  ALL_INTERVAL_TEMPLATES,
  clampIntervalMinutes,
  CUSTOM_INTERVAL_CHIPS,
  formatInterval,
  makeIntervalHabit,
  nativeRemindersAvailable,
  type IntervalHabit,
  type IntervalKind,
  type IntervalTemplate,
} from '@/src/features/habits/lib/interval-habits';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface IntervalHabitSheetProps {
  visible: boolean;
  habit?: IntervalHabit | null;
  template?: IntervalTemplate | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function IntervalHabitSheet({ habit, onClose, onSaved, template, visible }: IntervalHabitSheetProps) {
  const colors = usePalette();
  const [kind, setKind] = useState<IntervalKind>('water');
  const [title, setTitle] = useState('Drink water');
  const [message, setMessage] = useState('A glass now. Your body will thank you.');
  const [unit, setUnit] = useState<'min' | 'hours'>('min');
  const [raw, setRaw] = useState('45');
  const [saving, setSaving] = useState(false);

  const selectedTemplate = ALL_INTERVAL_TEMPLATES.find((item) => item.kind === kind);
  const chips = unit === 'hours' ? [1, 2, 3, 4, 6, 8] : (selectedTemplate?.chips ?? CUSTOM_INTERVAL_CHIPS);

  useEffect(() => {
    if (!visible) return;
    if (habit) {
      setKind(habit.kind);
      setTitle(habit.title);
      setMessage(habit.message || '');
      setUnit(habit.intervalMinutes >= 120 && habit.intervalMinutes % 60 === 0 ? 'hours' : 'min');
      setRaw(
        habit.intervalMinutes >= 120 && habit.intervalMinutes % 60 === 0
          ? String(habit.intervalMinutes / 60)
          : String(habit.intervalMinutes),
      );
      return;
    }
    const next = template ?? ALL_INTERVAL_TEMPLATES[0];
    setKind(next.kind);
    setTitle(next.title);
    setMessage(next.message || '');
    setUnit('min');
    setRaw(String(next.defaultMinutes));
  }, [habit, template, visible]);

  const minutes = useMemo(() => {
    const value = Number(raw.replace(/[^0-9.]/g, ''));
    const asMinutes = unit === 'hours' ? value * 60 : value;
    return clampIntervalMinutes(asMinutes || selectedTemplate?.defaultMinutes || 30);
  }, [raw, selectedTemplate?.defaultMinutes, unit]);

  const handleKind = (next: IntervalTemplate) => {
    setKind(next.kind);
    setTitle(next.title);
    setMessage(next.message);
    setUnit('min');
    setRaw(String(next.defaultMinutes));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = habit
        ? {
            ...habit,
            kind,
            title: title.trim() || selectedTemplate?.title || 'Reminder',
            message: (message.trim() || selectedTemplate?.message || 'Time for your check-in.').trim(),
            intervalMinutes: minutes,
            enabled: true,
          }
        : makeIntervalHabit({
            kind,
            title: title.trim() || selectedTemplate?.title || 'Reminder',
            message: message.trim() || selectedTemplate?.message,
            intervalMinutes: minutes,
          });
      await useHabitStore.getState().upsertIntervalHabit(payload);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title={habit ? 'Edit interval ping' : 'Interval reminder'}
      subtitle={
        nativeRemindersAvailable()
          ? 'Scheduled notifications repeat on your chosen interval. Tap notification to claim coins.'
          : 'Works in the app now. Lock-screen notification pings activate in a native build.'
      }
      onClose={onClose}
      fullHeight
      footer={
        <View style={{ gap: spacing.sm }}>
          <Pressable
            disabled={saving}
            onPress={() => void handleSave()}
            style={[styles.save, { backgroundColor: colors.primary }]}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.saveLabel, { color: colors.white }]}>
                {habit ? 'Save interval ping' : `Start · ${plusCoins(COIN_REWARDS.intervalCheckIn)} per check-in`}
              </Text>
            )}
          </Pressable>
          {habit ? (
            <Pressable
              onPress={() => {
                void useHabitStore.getState().setIntervalEnabled(habit.id, false);
                onClose();
              }}>
              <Text style={[styles.pause, { color: colors.textMuted }]}>Pause pings</Text>
            </Pressable>
          ) : null}
        </View>
      }>
      <View style={styles.kinds}>
        {ALL_INTERVAL_TEMPLATES.map((item) => {
          const active = kind === item.kind;
          return (
            <Pressable
              key={item.kind}
              onPress={() => handleKind(item)}
              style={[
                styles.kind,
                { backgroundColor: active ? colors.accentSoft : colors.backgroundAlt, borderColor: active ? colors.accent : colors.border },
              ]}>
              <MaterialCommunityIcons color={active ? colors.accent : colors.textSoft} name={item.icon} size={20} />
              <Text style={[styles.kindLabel, { color: active ? colors.accent : colors.text }]}>{item.title}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>Ping Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Drink water, Take a stretch"
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>Notification Description / Message</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="e.g. Drink 500ml water to stay hydrated and focused"
        placeholderTextColor={colors.textSoft}
        style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.microHint, { color: colors.textSoft }]}>
        Shown directly on your phone notification. Tapping opens your reminder page.
      </Text>

      <View style={styles.unitRow}>
        <Text style={[styles.label, { color: colors.textMuted, flex: 1 }]}>Repeat frequency</Text>
        {(['min', 'hours'] as const).map((item) => {
          const active = unit === item;
          return (
            <Pressable
              key={item}
              onPress={() => {
                if (item === unit) return;
                if (item === 'hours') {
                  setRaw(String(Math.max(1, Math.round(minutes / 60) || 1)));
                } else {
                  setRaw(String(minutes));
                }
                setUnit(item);
              }}
              style={[styles.unit, { backgroundColor: active ? colors.primary : colors.backgroundAlt }]}>
              <Text style={[styles.unitLabel, { color: active ? colors.white : colors.text }]}>
                {item === 'min' ? 'Minutes' : 'Hours'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chips}>
        {chips.map((chip) => {
          const selected = unit === 'hours' ? minutes === chip * 60 : minutes === chip;
          return (
            <Pressable
              key={`${unit}-${chip}`}
              onPress={() => setRaw(String(chip))}
              style={[
                styles.chip,
                { backgroundColor: selected ? colors.accentSoft : colors.backgroundAlt, borderColor: selected ? colors.accent : colors.border },
              ]}>
              <Text style={[styles.chipLabel, { color: selected ? colors.accent : colors.text }]}>
                {chip}
                {unit === 'hours' ? 'h' : 'm'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={raw}
        onChangeText={setRaw}
        keyboardType="decimal-pad"
        placeholder={unit === 'hours' ? 'Hours' : 'Minutes'}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      
      <View style={[styles.ruleCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.accent} />
        <View style={styles.ruleCopy}>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>On-Time Coin Policy</Text>
          <Text style={[styles.ruleBody, { color: colors.textMuted }]}>
            Check in during your active ping window to earn {plusCoins(COIN_REWARDS.intervalCheckIn)}. If you miss a notification window, you cannot claim coins for that cycle and must respond to the next ping.
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  kinds: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kind: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  kindLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 72,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    textAlignVertical: 'top',
    marginBottom: spacing.xs,
  },
  microHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  unit: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
  hint: {
    fontSize: typography.caption,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  ruleCopy: {
    flex: 1,
    gap: 2,
  },
  ruleTitle: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
  ruleBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  save: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  pause: {
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
