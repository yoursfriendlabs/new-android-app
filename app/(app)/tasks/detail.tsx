import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { WinMoment } from '@/src/features/habits/components/WinMoment';
import {
  useTaskDetail,
  useTaskMetadata,
  useUpdateTaskMutation,
  useAddTaskCommentMutation,
} from '@/src/features/notes/hooks/useTaskQueries';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { COIN_REWARDS, plusCoins } from '@/src/features/habits/lib/coins';
import { buildCoinWin, type HabitWin } from '@/src/features/habits/lib/habits';
import { decodeNoteBody, formatDueStamp, isOpenTask, reminderDueAt, taskKind } from '@/src/features/notes/lib/notes';
import { useAuthStore } from '@/src/stores/auth-store';
import { useHabitStore } from '@/src/stores/habit-store';
import { radius, spacing, typography, shadows } from '@/src/theme';
import { prettyDate } from '@/src/shared/lib/format';
import type { TaskAssignment, TaskActivity } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function TaskDetailScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  });
  const role = session?.role ?? user?.role;
  const isOwner = role === 'owner' || role === 'admin' || !role;
  const permissions = accessControl?.permissions;
  const tasksPermission = permissions && typeof permissions === 'object' && !Array.isArray(permissions)
    ? (permissions as Record<string, string>).tasks
    : undefined;
  const canManage = personal || isOwner || tasksPermission === 'manage';

  // State
  const [commentText, setCommentText] = useState('');
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [win, setWin] = useState<HabitWin | null>(null);

  // Queries & Mutations
  const { data: task, isLoading, refetch } = useTaskDetail(id);
  const { data: metadata } = useTaskMetadata();
  const updateTaskMutation = useUpdateTaskMutation(id || '');
  const addCommentMutation = useAddTaskCommentMutation(id || '');

  if (isLoading || !task) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Task Details" topBarLeading="back">
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading task details...</Text>
        </View>
      </Screen>
    );
  }

  const isCreator = task.creator?.id === user?.id;
  const canEditTask = personal || isOwner || isCreator;
  const decoded = decodeNoteBody(task.description);
  const kind = taskKind(task);
  const open = isOpenTask(task.status);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTaskMutation.mutateAsync({ status: newStatus });
      setStatusSheetVisible(false);
      if (personal && (newStatus === 'completed' || newStatus === 'done')) {
        const coins = await useHabitStore.getState().awardCoins(COIN_REWARDS.complete, {
          claimId: `complete:${task.id}`,
          reason: 'complete',
          label: taskKind(task) === 'note' ? 'Closed a note' : 'Finished a reminder',
        });
        await useHabitStore.getState().cancelPing(`task:${task.id}`);
        setWin(
          buildCoinWin({
            title: taskKind(task) === 'note' ? 'Note closed' : 'Reminder done',
            message: coins ? `Follow-through pays. ${plusCoins(coins)}.` : 'Already collected for this one.',
            coins,
            icon: 'check-decagram',
          }),
        );
        return;
      }
      Alert.alert('Status updated', `Task status is now ${newStatus.replace('_', ' ')}.`);
    } catch (error) {
      Alert.alert('Failed to update status', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addCommentMutation.mutateAsync(commentText.trim());
      setCommentText('');
    } catch (error) {
      Alert.alert('Failed to add comment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const getPriorityColor = (prio: string) => {
    switch (prio.toLowerCase()) {
      case 'high':
        return colors.danger;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.success;
      default:
        return colors.textSoft;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return colors.success;
      case 'in_progress':
        return colors.accent;
      case 'todo':
      case 'open':
        return colors.primary;
      default:
        return colors.textSoft;
    }
  };

  const topBarRight = canEditTask ? (
    <Pressable
      style={styles.headerButton}
      onPress={() => router.push({ pathname: '/tasks/form' as any, params: { id: task.id } })}>
      <MaterialCommunityIcons color={colors.white} name="pencil" size={20} />
    </Pressable>
  ) : undefined;

  const dueMoment = reminderDueAt(task);
  const overdue = Boolean(
    kind === 'reminder' && dueMoment && dueMoment.getTime() < Date.now() && task.status !== 'completed',
  );

  // Separate comments/activities for timeline
  const timelineActivities = task.activities || [];

  return (
    <Screen scrollable={false} padded={false} topBarTitle={personal ? (kind === 'note' ? 'Note' : 'Reminder') : 'Task Detail'} topBarRight={topBarRight} topBarLeading="back">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(task.priority)}12` }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                  {task.priority.toUpperCase()} PRIORITY
                </Text>
              </View>
              <Pressable
                disabled={!canManage}
                style={[styles.statusBadge, { backgroundColor: `${getStatusColor(task.status)}12` }]}
                onPress={() => setStatusSheetVisible(true)}>
                <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                  {task.status.replace('_', ' ').toUpperCase()}
                </Text>
                {canManage ? (
                  <MaterialCommunityIcons color={getStatusColor(task.status)} name="chevron-down" size={14} style={{ marginLeft: 4 }} />
                ) : null}
              </Pressable>
            </View>

            <Text style={styles.title}>{task.title}</Text>
            {decoded.body ? (
              <Text style={styles.description}>{decoded.body}</Text>
            ) : (
              <Text style={styles.descriptionMuted}>{personal ? 'No extra note.' : 'No description provided.'}</Text>
            )}

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons color={colors.textSoft} name="calendar" size={18} />
                <View>
                  <Text style={styles.metaLabel}>{personal ? 'When' : 'Due Date'}</Text>
                  <Text style={[styles.metaValue, overdue && styles.overdueValue]}>
                    {personal && dueMoment
                      ? formatDueStamp(dueMoment)
                      : task.dueDate
                        ? prettyDate(task.dueDate)
                        : 'No due date'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons color={colors.textSoft} name="account-circle-outline" size={18} />
                <View>
                  <Text style={styles.metaLabel}>Created By</Text>
                  <Text style={styles.metaValue}>{task.creator?.name || 'System'}</Text>
                </View>
              </View>
            </View>
          </View>

          {!personal ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assignees ({task.assignments?.length || 0})</Text>
            <View style={styles.assigneesList}>
              {task.assignments?.map((assign) => (
                <View key={assign.id} style={styles.assigneeRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {assign.assignee.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.assigneeInfo}>
                    <Text style={styles.assigneeName}>{assign.assignee.name}</Text>
                    <Text style={styles.assigneeRole}>
                      {assign.assignee.phone || assign.assignee.email || 'Team member'}
                    </Text>
                  </View>
                  <View style={[styles.assigneeStatus, assign.status === 'completed' && styles.assigneeStatusCompleted]}>
                    <Text style={[styles.assigneeStatusLabel, assign.status === 'completed' && styles.assigneeStatusCompletedLabel]}>
                      {assign.status}
                    </Text>
                  </View>
                </View>
              ))}
              {!task.assignments?.length ? (
                <Text style={styles.emptyText}>No staff assigned to this task.</Text>
              ) : null}
            </View>
          </View>
          ) : open ? (
            <Pressable
              onPress={() => void handleStatusChange('completed')}
              style={[styles.completeBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.completeLabel, { color: colors.white }]}>
                Mark done · {plusCoins(COIN_REWARDS.complete)}
              </Text>
            </Pressable>
          ) : null}

          {/* Timeline / Activities */}
          <View style={styles.timelineContainer}>
            <Text style={styles.sectionTitle}>Timeline & Comments</Text>
            <View style={styles.timelineList}>
              {timelineActivities.map((act) => {
                const isComment = act.type === 'comment';
                return (
                  <View key={act.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineIcon, isComment ? styles.commentTimelineIcon : styles.systemTimelineIcon]}>
                        <MaterialCommunityIcons
                          color={isComment ? colors.white : colors.textSoft}
                          name={isComment ? 'comment-text-outline' : 'history'}
                          size={14}
                        />
                      </View>
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.actorName}>{act.actor.name}</Text>
                        <Text style={styles.timelineTime}>{prettyDate(act.createdAt)}</Text>
                      </View>
                      {isComment ? (
                        <View style={styles.commentBubble}>
                          <Text style={styles.commentBody}>{act.content}</Text>
                        </View>
                      ) : (
                        <Text style={styles.systemActivityText}>{act.content}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {!timelineActivities.length ? (
                <Text style={styles.emptyText}>No activity or comments recorded yet.</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        {/* Comment box */}
        {canManage ? (
          <View style={styles.commentBoxContainer}>
            <TextInput
              placeholder={personal ? 'Add a thought…' : 'Write a comment...'}
              placeholderTextColor={colors.textSoft}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              disabled={!commentText.trim() || addCommentMutation.isPending}
              style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
              onPress={() => void handleAddComment()}>
              {addCommentMutation.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <MaterialCommunityIcons color={colors.white} name="send" size={18} />
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Status selection bottom sheet */}
        <BottomSheet
          visible={statusSheetVisible}
          title="Change Task Status"
          subtitle="Choose the current progress state of the task."
          onClose={() => setStatusSheetVisible(false)}
          fullHeight>
          <View style={styles.statusSheetList}>
            {metadata?.statuses.map((status) => (
              <Pressable
                key={status.key}
                style={[styles.statusSheetItem, task.status === status.key && styles.statusSheetItemActive]}
                onPress={() => void handleStatusChange(status.key)}>
                <Text style={[styles.statusSheetLabel, task.status === status.key && styles.statusSheetLabelActive]}>
                  {status.label}
                </Text>
                {task.status === status.key ? (
                  <MaterialCommunityIcons color={colors.white} name="check" size={18} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </BottomSheet>
        <WinMoment win={win} onClose={() => setWin(null)} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 48,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.body,
    color: colors.textSoft,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  completeLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    fontSize: typography.body,
    color: colors.textSoft,
    lineHeight: 22,
  },
  descriptionMuted: {
    fontSize: typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  overdueValue: {
    color: colors.dangerBright,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  assigneesList: {
    gap: spacing.md,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: typography.body,
  },
  assigneeInfo: {
    flex: 1,
    gap: 2,
  },
  assigneeName: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  assigneeRole: {
    fontSize: typography.caption,
    color: colors.textSoft,
  },
  assigneeStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundAlt,
  },
  assigneeStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'capitalize',
  },
  assigneeStatusCompleted: {
    backgroundColor: colors.successSoft,
  },
  assigneeStatusCompletedLabel: {
    color: colors.success,
  },
  timelineContainer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  timelineList: {
    paddingLeft: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
  },
  timelineIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  commentTimelineIcon: {
    backgroundColor: colors.accent,
  },
  systemTimelineIcon: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actorName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  timelineTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  commentBubble: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentBody: {
    fontSize: typography.body,
    color: colors.text,
    lineHeight: 20,
  },
  systemActivityText: {
    fontSize: typography.caption,
    color: colors.textSoft,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.md,
    fontStyle: 'italic',
  },
  commentBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sendButtonDisabled: {
    backgroundColor: colors.backgroundAlt,
  },
  statusSheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  statusSheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.md,
  },
  statusSheetItemActive: {
    backgroundColor: colors.accent,
  },
  statusSheetLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  statusSheetLabelActive: {
    color: colors.white,
  },
});
