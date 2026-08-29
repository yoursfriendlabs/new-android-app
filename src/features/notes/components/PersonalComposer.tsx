import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { WinMoment } from '@/src/features/habits/components/WinMoment';
import { Screen } from '@/src/shared/layout/Screen';
import { IntervalHabitSheet } from '@/src/features/notes/components/IntervalHabitSheet';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { useCreateTaskMutation, useTaskDetail, useUpdateTaskMutation } from '@/src/features/notes/hooks/useTaskQueries';
import { COIN_REWARDS, plusCoins } from '@/src/features/habits/lib/coins';
import { localIsoDate } from '@/src/shared/lib/format';
import { buildCoinWin, type HabitWin } from '@/src/features/habits/lib/habits';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import {
  createdRecordId,
  decodeNoteBody,
  encodeNoteBody,
  formatDueStamp,
  reminderPresets,
  roundToNextHour,
  type NoteKind,
} from '@/src/features/notes/lib/notes';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type ComposerKind = NoteKind | 'interval';

export function PersonalComposer() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const isEdit = Boolean(params.id);
  const { data: task, isLoading } = useTaskDetail(params.id);
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation(params.id || '');

  const [kind, setKind] = useState<ComposerKind>(params.kind === 'note' ? 'note' : params.kind === 'interval' ? 'interval' : 'reminder');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState(() => roundToNextHour());
  const [duePreset, setDuePreset] = useState('1h');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [win, setWin] = useState<HabitWin | null>(null);
  const [intervalOpen, setIntervalOpen] = useState(params.kind === 'interval' && !params.id);

  const dueOptions = useMemo(() => reminderPresets(), []);
  const reward = kind === 'note' ? COIN_REWARDS.note : kind === 'interval' ? COIN_REWARDS.intervalCheckIn : COIN_REWARDS.reminder;

  useEffect(() => {
    if (params.kind === 'note' || params.kind === 'reminder' || params.kind === 'interval') {
      setKind(params.kind);
    }
  }, [params.kind]);

  useEffect(() => {
    if (isEdit && task && !initialized) {
      const decoded = decodeNoteBody(task.description);
      setKind(decoded.kind);
      setTitle(task.title);
      setBody(decoded.body);
      if (decoded.dueAt) {
        const parsed = new Date(decoded.dueAt);
        if (!Number.isNaN(parsed.getTime())) {
          setDueAt(parsed);
          setDuePreset('custom');
        }
      }
      setInitialized(true);
    }
  }, [initialized, isEdit, task]);

  const handleSave = async () => {
    if (kind === 'interval') {
      setIntervalOpen(true);
      return;
    }
    if (!title.trim()) {
      Alert.alert('Add a title', kind === 'note' ? 'What is this note about?' : 'What should we remind you?');
      return;
    }

    if (kind === 'reminder' && dueAt.getTime() <= Date.now() + 4000) {
      Alert.alert('Pick a future time', 'Choose a date and time ahead of now so we can notify you.');
      return;
    }

    setSaving(true);
    try {
      const dueIso = dueAt.toISOString();
      const payload = {
        title: title.trim(),
        description: encodeNoteBody(kind, body, kind === 'reminder' ? dueIso : undefined),
        priority: kind === 'note' ? 'low' : 'medium',
        status: 'open',
        dueDate: kind === 'reminder' ? localIsoDate(dueAt) : localIsoDate(),
      };

      if (isEdit) {
        await updateTaskMutation.mutateAsync(payload);
        if (kind === 'reminder' && params.id) {
          await useHabitStore.getState().schedulePing({
            id: `task:${params.id}`,
            title: payload.title,
            body: body.trim() || payload.title,
            at: dueIso,
            native: nativeRemindersAvailable(),
          });
        }
      } else {
        const created = await createTaskMutation.mutateAsync(payload);
        const createdId = createdRecordId(created);
        const coins = await useHabitStore.getState().awardCoins(reward, {
          claimId: createdId ? `create:${createdId}` : undefined,
          reason: kind === 'note' ? 'note' : 'reminder',
          label: kind === 'note' ? 'Captured a note' : 'Set a reminder',
        });
        if (kind === 'reminder') {
          await useHabitStore.getState().schedulePing({
            id: `task:${createdId || Date.now()}`,
            title: payload.title,
            body: body.trim() || payload.title,
            at: dueIso,
            native: nativeRemindersAvailable(),
          });
        }
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Optional on web.
        }
        setWin(
          buildCoinWin({
            title: kind === 'note' ? 'Note captured' : 'Reminder set',
            message:
              kind === 'note'
                ? 'A quiet place for the thought. Coins for showing up.'
                : nativeRemindersAvailable()
                  ? `Notification set for ${formatDueStamp(dueAt)}.`
                  : `We'll ping you at ${formatDueStamp(dueAt)}. Lock-screen alerts need a development build.`,
            coins,
            icon: kind === 'note' ? 'notebook-outline' : 'bell-ring-outline',
          }),
        );
        return;
      }
      router.back();
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Edit" topBarLeading="back">
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={isEdit ? 'Edit' : kind === 'note' ? 'New note' : kind === 'interval' ? 'Interval' : 'New reminder'}
      topBarLeading="back"
      footer={
        <StickyActionBar
          leading={<Text style={[styles.reward, { color: colors.warning }]}>{plusCoins(reward)}</Text>}
          primary={{
            label: saving ? 'Saving…' : kind === 'interval' ? 'Choose interval' : isEdit ? 'Save' : kind === 'note' ? 'Capture note' : 'Set reminder',
            onPress: () => void handleSave(),
          }}
        />
      }>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.kindRow}>
          {(
            [
              { id: 'note', label: 'Note', icon: 'notebook-outline' as const },
              { id: 'reminder', label: 'Reminder', icon: 'bell-outline' as const },
              { id: 'interval', label: 'Interval', icon: 'timer-outline' as const },
            ] as const
          ).map((item) => {
            const active = kind === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setKind(item.id);
                  if (item.id === 'interval' && !isEdit) setIntervalOpen(true);
                }}
                style={[
                  styles.kindChip,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                ]}>
                <MaterialCommunityIcons color={active ? colors.white : colors.textSoft} name={item.icon} size={18} />
                <Text style={[styles.kindLabel, { color: active ? colors.white : colors.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {kind !== 'interval' ? (
          <>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={kind === 'note' ? 'Title this thought' : 'Remind me to…'}
              placeholderTextColor={colors.textSoft}
              style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={kind === 'note' ? 'The note itself. Unhurried.' : 'Optional detail'}
              placeholderTextColor={colors.textSoft}
              multiline
              style={[styles.bodyInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          </>
        ) : (
          <Pressable
            onPress={() => setIntervalOpen(true)}
            style={[styles.intervalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons color={colors.accent} name="timer-outline" size={28} />
            <View style={styles.intervalCopy}>
              <Text style={[styles.intervalTitle, { color: colors.text }]}>Water, focus, or relax</Text>
              <Text style={[styles.intervalHint, { color: colors.textMuted }]}>Any interval. Minutes or hours. Check in for coins.</Text>
            </View>
          </Pressable>
        )}

        {kind === 'reminder' ? (
          <View style={styles.when}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>When</Text>
            <View style={styles.whenRow}>
              {dueOptions.map((item) => {
                const active = duePreset === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setDuePreset(item.id);
                      setDueAt(item.at);
                    }}
                    style={[
                      styles.whenChip,
                      { backgroundColor: active ? colors.accentSoft : colors.backgroundAlt, borderColor: active ? colors.accent : colors.border },
                    ]}>
                    <Text style={[styles.whenLabel, { color: active ? colors.accent : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setPickerMode('date')}
              style={[styles.stampRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons color={colors.accent} name="calendar" size={20} />
              <View style={styles.intervalCopy}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Date</Text>
                <Text style={[styles.intervalTitle, { color: colors.text }]}>{localIsoDate(dueAt)}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setPickerMode('time')}
              style={[styles.stampRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons color={colors.accent} name="clock-outline" size={20} />
              <View style={styles.intervalCopy}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Time</Text>
                <Text style={[styles.intervalTitle, { color: colors.text }]}>
                  {`${`${dueAt.getHours()}`.padStart(2, '0')}:${`${dueAt.getMinutes()}`.padStart(2, '0')}`}
                </Text>
              </View>
            </Pressable>
            {pickerMode ? (
              <View>
                <DateTimePicker
                  value={dueAt}
                  mode={pickerMode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    if (Platform.OS !== 'ios') setPickerMode(null);
                    if (!date) return;
                    setDuePreset('custom');
                    setDueAt((current) => {
                      const next = new Date(current);
                      if (pickerMode === 'date') {
                        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      } else {
                        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      }
                      return next;
                    });
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable onPress={() => setPickerMode(null)} style={styles.doneBtn}>
                    <Text style={[styles.whenLabel, { color: colors.accent }]}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text style={[styles.intervalHint, { color: colors.textMuted }]}>
              Notification at {formatDueStamp(dueAt)}
              {nativeRemindersAvailable() ? '.' : '. In Expo Go we’ll alert in-app; a development build sends lock-screen pings.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <IntervalHabitSheet
        visible={intervalOpen}
        onClose={() => setIntervalOpen(false)}
        onSaved={() => {
          if (!isEdit) router.back();
        }}
      />
      <WinMoment
        win={win}
        onClose={() => {
          setWin(null);
          router.back();
        }}
        onAgain={() => {
          setWin(null);
          setTitle('');
          setBody('');
          setSaving(false);
        }}
      />
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    container: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kindRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    kindChip: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    kindLabel: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    titleInput: {
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      fontSize: typography.subheading,
      fontWeight: '700',
    },
    bodyInput: {
      minHeight: 160,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      fontSize: typography.body,
      lineHeight: 22,
      textAlignVertical: 'top',
    },
    intervalCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      ...shadows.card,
    },
    intervalCopy: {
      flex: 1,
      gap: 4,
    },
    intervalTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    intervalHint: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    when: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    whenRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    whenChip: {
      minHeight: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whenLabel: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    stampRow: {
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    doneBtn: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reward: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
  });
