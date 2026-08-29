import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { tasksApi } from '@/src/api';
import { ActionSheet } from '@/src/shared/feedback/ActionSheet';
import { CoinChip } from '@/src/features/habits/components/CoinChip';
import { WinMoment } from '@/src/features/habits/components/WinMoment';
import { Screen } from '@/src/shared/layout/Screen';
import { IntervalHabitSheet } from '@/src/features/notes/components/IntervalHabitSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { useTasks } from '@/src/features/notes/hooks/useTaskQueries';
import { COIN_REWARDS, plusCoins } from '@/src/features/habits/lib/coins';
import { buildCoinWin, type HabitWin } from '@/src/features/habits/lib/habits';
import {
  canCheckIn,
  formatInterval,
  INTERVAL_TEMPLATES,
  intervalCheckInBucket,
  type IntervalHabit,
  type IntervalTemplate,
} from '@/src/features/habits/lib/interval-habits';
import { decodeNoteBody, formatDueStamp, isOpenTask, reminderDueAt, taskKind } from '@/src/features/notes/lib/notes';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { Task } from '@/src/types/models';

type InboxTab = 'open' | 'notes' | 'done';

export function PersonalNotesInbox() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const coins = useHabitStore((state) => state.coins);
  const intervalHabits = useHabitStore((state) => state.intervalHabits);
  const [tab, setTab] = useState<InboxTab>('open');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<IntervalHabit | null>(null);
  const [pickedTemplate, setPickedTemplate] = useState<IntervalTemplate | null>(null);
  const [win, setWin] = useState<HabitWin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: tasksData, isLoading, refetch, isFetching } = useTasks({ q: search });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const items = tasksData?.items ?? [];
  const visible = useMemo(() => {
    return items.filter((task) => {
      const kind = taskKind(task);
      const open = isOpenTask(task.status);
      if (tab === 'notes') return kind === 'note';
      if (tab === 'done') return !open;
      return open;
    });
  }, [items, tab]);

  const showWin = (next: HabitWin) => {
    setWin(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const completeTask = async (task: Task) => {
    if (!isOpenTask(task.status)) return;
    setBusyId(task.id);
    try {
      await tasksApi.update(task.id, { status: 'completed' });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      const coinsAwarded = await useHabitStore.getState().awardCoins(COIN_REWARDS.complete, {
        claimId: `complete:${task.id}`,
        reason: 'complete',
        label: taskKind(task) === 'note' ? 'Closed a note' : 'Finished a reminder',
      });
      await useHabitStore.getState().cancelPing(`task:${task.id}`);
      showWin(
        buildCoinWin({
          title: taskKind(task) === 'note' ? 'Note closed' : 'Reminder done',
          message: coinsAwarded ? `Nice follow-through. ${plusCoins(coinsAwarded)}.` : 'Already collected for this one.',
          coins: coinsAwarded,
          icon: 'check-decagram',
        }),
      );
    } catch (error) {
      Alert.alert('Could not complete', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const checkIn = async (habit: IntervalHabit) => {
    if (!canCheckIn(habit)) {
      Alert.alert('Too soon', `Wait for the ${formatInterval(habit.intervalMinutes)} window, then check in again.`);
      return;
    }
    setBusyId(habit.id);
    try {
      await useHabitStore.getState().checkInInterval(habit.id);
      const coinsAwarded = await useHabitStore.getState().awardCoins(COIN_REWARDS.intervalCheckIn, {
        claimId: intervalCheckInBucket(habit),
        reason: 'checkin',
        label: habit.title,
      });
      showWin(
        buildCoinWin({
          title: habit.title,
          message: coinsAwarded ? `Checked in. ${plusCoins(coinsAwarded)}.` : 'Already counted this interval.',
          coins: coinsAwarded,
          icon: INTERVAL_TEMPLATES.find((item) => item.kind === habit.kind)?.icon ?? 'timer-outline',
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  const openInterval = (template?: IntervalTemplate, habit?: IntervalHabit) => {
    setPickedTemplate(template ?? null);
    setEditingHabit(habit ?? null);
    setIntervalOpen(true);
  };

  const renderTask = ({ item }: { item: Task }) => {
    const kind = taskKind(item);
    const decoded = decodeNoteBody(item.description);
    const open = isOpenTask(item.status);
    const due = reminderDueAt(item);
    const overdue = Boolean(due && due.getTime() < Date.now() && open && kind === 'reminder');
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/tasks/detail' as any, params: { id: item.id } })}>
        <View style={styles.cardTop}>
          <View style={[styles.kindDot, { backgroundColor: kind === 'note' ? colors.purpleSoft : colors.accentSoft }]}>
            <MaterialCommunityIcons
              color={kind === 'note' ? colors.purple : colors.accent}
              name={kind === 'note' ? 'notebook-outline' : 'bell-outline'}
              size={16}
            />
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.cardMeta, { color: overdue ? colors.danger : colors.textMuted }]}>
              {kind === 'note' ? 'Note' : due ? formatDueStamp(due) : 'Reminder'}
              {overdue ? ' · overdue' : ''}
              {open ? '' : ' · done'}
            </Text>
          </View>
          {open ? (
            <Pressable
              hitSlop={8}
              onPress={() => void completeTask(item)}
              style={[styles.checkBtn, { backgroundColor: colors.successSoft }]}>
              {busyId === item.id ? (
                <ActivityIndicator color={colors.success} size="small" />
              ) : (
                <MaterialCommunityIcons color={colors.success} name="check" size={18} />
              )}
            </Pressable>
          ) : (
            <Text style={[styles.coinHint, { color: colors.warning }]}>{plusCoins(COIN_REWARDS.complete)}</Text>
          )}
        </View>
        {decoded.body ? (
          <Text numberOfLines={2} style={[styles.cardBody, { color: colors.textSoft }]}>
            {decoded.body}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Notes & reminders"
      topBarLeading="back"
      topBarRight={<CoinChip coins={coins} compact />}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.lead, { color: colors.textMuted }]}>
              Capture a thought. Set a ping. Drink water, focus, or relax on any interval — and earn coins for following through.
            </Text>

            <View style={styles.habitRow}>
              {INTERVAL_TEMPLATES.map((template) => {
                const existing = intervalHabits.find((item) => item.kind === template.kind);
                const live = existing?.enabled ? existing : undefined;
                return (
                  <Pressable
                    key={template.kind}
                    onPress={() => (live ? void checkIn(live) : openInterval(template, existing))}
                    onLongPress={() => openInterval(template, existing)}
                    style={[
                      styles.habitCard,
                      {
                        backgroundColor: live ? colors.accentSoft : colors.surface,
                        borderColor: live ? colors.accent : colors.border,
                      },
                    ]}>
                    <MaterialCommunityIcons color={live ? colors.accent : colors.textSoft} name={template.icon} size={22} />
                    <Text style={[styles.habitTitle, { color: colors.text }]}>{template.title}</Text>
                    <Text style={[styles.habitMeta, { color: colors.textMuted }]}>
                      {live ? formatInterval(live.intervalMinutes) : 'Set interval'}
                    </Text>
                    <Text style={[styles.habitAction, { color: live ? colors.accent : colors.textSoft }]}>
                      {live ? 'Check in' : 'Start'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {intervalHabits
              .filter((habit) => {
                const featured = INTERVAL_TEMPLATES.some(
                  (template) => intervalHabits.find((item) => item.kind === template.kind)?.id === habit.id,
                );
                return !featured;
              })
              .map((habit) => (
                <Pressable
                  key={habit.id}
                  onPress={() => void checkIn(habit)}
                  onLongPress={() => openInterval(undefined, habit)}
                  style={[styles.customHabit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialCommunityIcons color={colors.accent} name="timer-outline" size={18} />
                  <Text style={[styles.customTitle, { color: colors.text }]}>{habit.title}</Text>
                  <Text style={[styles.habitMeta, { color: colors.textMuted }]}>{formatInterval(habit.intervalMinutes)}</Text>
                </Pressable>
              ))}

            <SegmentedTabs
              value={tab}
              onChange={setTab}
              options={[
                { label: 'Open', value: 'open' },
                { label: 'Notes', value: 'notes' },
                { label: 'Done', value: 'done' },
              ]}
            />
            <SearchField placeholder="Search notes and reminders" value={search} onChangeText={setSearch} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons color={colors.textSoft} name="notebook-outline" size={40} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing captured yet</Text>
              <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                A note, a reminder, or a water ping. Each one pays coins.
              </Text>
            </View>
          )
        }
      />

      <Pressable style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setComposerOpen(true)}>
        <MaterialCommunityIcons color={colors.white} name="plus" size={26} />
      </Pressable>

      <ActionSheet
        visible={composerOpen}
        title="Capture"
        subtitle={`Notes and reminders feel considered. ${plusCoins(COIN_REWARDS.note)} to write, ${plusCoins(COIN_REWARDS.complete)} to finish.`}
        onClose={() => setComposerOpen(false)}
        actions={[
          {
            id: 'note',
            label: 'New note',
            icon: 'notebook-outline',
            onPress: () => router.push({ pathname: '/tasks/form' as any, params: { kind: 'note' } }),
          },
          {
            id: 'reminder',
            label: 'New reminder',
            icon: 'bell-plus-outline',
            onPress: () => router.push({ pathname: '/tasks/form' as any, params: { kind: 'reminder' } }),
          },
          {
            id: 'interval',
            label: 'Interval ping',
            icon: 'timer-outline',
            onPress: () => openInterval(),
          },
        ]}
      />

      <IntervalHabitSheet
        visible={intervalOpen}
        habit={editingHabit}
        template={pickedTemplate}
        onClose={() => {
          setIntervalOpen(false);
          setEditingHabit(null);
          setPickedTemplate(null);
        }}
      />

      <WinMoment win={win} onClose={() => setWin(null)} />
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    list: {
      padding: spacing.lg,
      paddingBottom: 120,
      gap: spacing.sm,
    },
    header: {
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    lead: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    habitRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    habitCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.sm,
      gap: 4,
      minHeight: 118,
      ...shadows.card,
    },
    habitTitle: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    habitMeta: {
      fontSize: 11,
    },
    habitAction: {
      marginTop: 'auto',
      fontSize: 11,
      fontWeight: '800',
    },
    customHabit: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    customTitle: {
      flex: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    kindDot: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardCopy: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    cardMeta: {
      fontSize: 11,
      fontWeight: '600',
    },
    cardBody: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    checkBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinHint: {
      fontSize: 10,
      fontWeight: '800',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.caption,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      lineHeight: 18,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.floating,
    },
  });
