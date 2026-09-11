import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { WinMoment } from '@/src/features/habits/components/WinMoment';
import {
  useNoteDetail,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '@/src/features/notes/hooks/useNoteQueries';
import { COIN_REWARDS, plusCoins } from '@/src/features/habits/lib/coins';
import { buildCoinWin, type HabitWin } from '@/src/features/habits/lib/habits';
import { formatDueStamp } from '@/src/features/notes/lib/notes';
import { useHabitStore } from '@/src/stores/habit-store';
import { prettyDate } from '@/src/shared/lib/format';
import { radius, spacing, typography, shadows } from '@/src/theme';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export function PersonalNoteDetail() {
  const colors = usePalette();
  const toast = useToast();
  const confirm = useConfirm();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [win, setWin] = useState<HabitWin | null>(null);

  const { data: note, isLoading } = useNoteDetail(id);
  const updateNoteMutation = useUpdateNoteMutation(id || '');
  const deleteNoteMutation = useDeleteNoteMutation();

  if (isLoading) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Note" topBarLeading="back">
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!note) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Note" topBarLeading="back">
        <View style={styles.centerWrap}>
          <MaterialCommunityIcons color={colors.textMuted} name="notebook-remove-outline" size={44} />
          <Text style={styles.emptyTitle}>We couldn't open this note</Text>
          <Text style={styles.emptyBody}>It may still be syncing, or it was removed. Pull back and try again.</Text>
          <Pressable style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.emptyBtnLabel, { color: colors.onPrimary }]}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const isNote = note.kind === 'note';
  const open = note.status !== 'done';
  const dueMoment = note.remindAt ? new Date(note.remindAt) : null;
  const overdue = Boolean(!isNote && dueMoment && dueMoment.getTime() < Date.now() && open);

  const topBarRight = (
    <Pressable
      style={styles.headerButton}
      onPress={() => router.push({ pathname: '/tasks/form' as any, params: { id: note.id } })}>
      <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={20} />
    </Pressable>
  );

  async function handleToggleDone() {
    if (!note) return;
    const nextStatus = open ? 'done' : 'open';
    try {
      await updateNoteMutation.mutateAsync({ status: nextStatus });
      if (open) {
        // Was open, now completing — reward and cancel any pending reminder ping.
        const coins = await useHabitStore.getState().awardCoins(COIN_REWARDS.complete, {
          claimId: `complete:${note.id}`,
          reason: 'complete',
          label: isNote ? 'Closed a note' : 'Finished a reminder',
        });
        await useHabitStore.getState().cancelPing(`note:${note.id}`);
        setWin(
          buildCoinWin({
            title: isNote ? 'Note closed' : 'Reminder done',
            message: coins ? `Follow-through pays. ${plusCoins(coins)}.` : 'Already collected for this one.',
            coins,
            icon: 'check-decagram',
          }),
        );
      } else {
        toast.success(isNote ? 'Note reopened' : 'Reminder reopened');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleDelete() {
    if (!note) return;
    const ok = await confirm({
      title: isNote ? 'Delete this note?' : 'Delete this reminder?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      icon: 'trash-can-outline',
    });
    if (!ok) return;
    try {
      await useHabitStore.getState().cancelPing(`note:${note.id}`);
      await deleteNoteMutation.mutateAsync(note.id);
      toast.success(isNote ? 'Note deleted' : 'Reminder deleted');
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete. Please try again.');
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={isNote ? 'Note' : 'Reminder'}
      topBarRight={topBarRight}
      topBarLeading="back"
      footer={
        <StickyActionBar
          secondary={{ label: 'Delete', tone: 'danger', onPress: () => void handleDelete() }}
          primary={{
            label: open ? (isNote ? `Mark done · ${plusCoins(COIN_REWARDS.complete)}` : `Done · ${plusCoins(COIN_REWARDS.complete)}`) : 'Reopen',
            tone: open ? 'primary' : 'secondary',
            onPress: () => void handleToggleDone(),
          }}
        />
      }>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.kindPill, { backgroundColor: isNote ? colors.purpleSoft : colors.accentSoft }]}>
          <MaterialCommunityIcons
            color={isNote ? colors.purple : colors.accent}
            name={isNote ? 'notebook-outline' : 'bell-outline'}
            size={15}
          />
          <Text style={[styles.kindPillLabel, { color: isNote ? colors.purple : colors.accent }]}>
            {isNote ? 'Note' : 'Reminder'}
          </Text>
          {!open ? (
            <View style={styles.donePill}>
              <MaterialCommunityIcons color={colors.success} name="check" size={12} />
              <Text style={[styles.donePillLabel, { color: colors.success }]}>Done</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{note.title}</Text>

        {!isNote && dueMoment ? (
          <View style={[styles.dueRow, overdue && { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
            <MaterialCommunityIcons
              color={overdue ? colors.dangerBright : colors.accent}
              name={overdue ? 'clock-alert-outline' : 'clock-outline'}
              size={18}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.dueLabel}>{overdue ? 'Overdue' : 'Reminder set for'}</Text>
              <Text style={[styles.dueValue, overdue && { color: colors.dangerBright }]}>
                {formatDueStamp(dueMoment)}
              </Text>
            </View>
          </View>
        ) : null}

        {note.body ? (
          <Text style={styles.body}>{note.body}</Text>
        ) : (
          <Text style={styles.bodyMuted}>No additional detail.</Text>
        )}

        <View style={styles.metaRow}>
          <MaterialCommunityIcons color={colors.textMuted} name="calendar-blank-outline" size={14} />
          <Text style={styles.metaText}>
            {note.createdAt ? `Created ${prettyDate(note.createdAt)}` : 'Saved to your workspace'}
          </Text>
        </View>
      </ScrollView>

      <WinMoment
        win={win}
        onClose={() => {
          setWin(null);
          router.back();
        }}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    content: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
      marginTop: spacing.xs,
    },
    emptyBody: {
      fontSize: typography.body,
      color: colors.textSoft,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyBtn: {
      marginTop: spacing.md,
      minHeight: 46,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyBtnLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kindPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    kindPillLabel: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    donePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginLeft: spacing.xs,
      paddingLeft: spacing.xs,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    donePillLabel: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.text,
      lineHeight: 32,
    },
    dueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dueLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    dueValue: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    body: {
      fontSize: typography.subheading,
      color: colors.text,
      lineHeight: 26,
    },
    bodyMuted: {
      fontSize: typography.body,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metaText: {
      fontSize: typography.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
