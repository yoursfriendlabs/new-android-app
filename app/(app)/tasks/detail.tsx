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

import { Screen } from '@/src/components/layout/Screen';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import {
  useTaskDetail,
  useTaskMetadata,
  useUpdateTaskMutation,
  useAddTaskCommentMutation,
} from '@/src/hooks/useTaskQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import { prettyDate } from '@/src/lib/format';
import type { TaskAssignment, TaskActivity } from '@/src/types/models';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const role = session?.role ?? user?.role;
  const isOwner = role === 'owner' || role === 'admin' || !role;
  const permissions = accessControl?.permissions;
  const tasksPermission = permissions && typeof permissions === 'object' && !Array.isArray(permissions)
    ? (permissions as Record<string, string>).tasks
    : undefined;
  const canManage = isOwner || tasksPermission === 'manage';

  // State
  const [commentText, setCommentText] = useState('');
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);

  // Queries & Mutations
  const { data: task, isLoading, refetch } = useTaskDetail(id);
  const { data: metadata } = useTaskMetadata();
  const updateTaskMutation = useUpdateTaskMutation(id || '');
  const addCommentMutation = useAddTaskCommentMutation(id || '');

  if (isLoading || !task) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Task Details" topBarLeading="back">
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.loadingText}>Loading task details...</Text>
        </View>
      </Screen>
    );
  }

  const isCreator = task.creator?.id === user?.id;
  const canEditTask = isOwner || isCreator; // Only creator or owner can edit task metadata fields

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTaskMutation.mutateAsync({ status: newStatus });
      setStatusSheetVisible(false);
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
        return palette.danger;
      case 'medium':
        return palette.warning;
      case 'low':
        return palette.success;
      default:
        return palette.textSoft;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return palette.success;
      case 'in_progress':
        return palette.accent;
      case 'todo':
      case 'open':
        return palette.primary;
      default:
        return palette.textSoft;
    }
  };

  const topBarRight = canEditTask ? (
    <Pressable
      style={styles.headerButton}
      onPress={() => router.push({ pathname: '/tasks/form' as any, params: { id: task.id } })}>
      <MaterialCommunityIcons color={palette.white} name="pencil" size={20} />
    </Pressable>
  ) : undefined;

  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  // Separate comments/activities for timeline
  const timelineActivities = task.activities || [];

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Task Detail" topBarRight={topBarRight} topBarLeading="back">
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
            {task.description ? (
              <Text style={styles.description}>{task.description}</Text>
            ) : (
              <Text style={styles.descriptionMuted}>No description provided.</Text>
            )}

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons color={palette.textSoft} name="calendar" size={18} />
                <View>
                  <Text style={styles.metaLabel}>Due Date</Text>
                  <Text style={[styles.metaValue, overdue && styles.overdueValue]}>
                    {task.dueDate ? prettyDate(task.dueDate) : 'No due date'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons color={palette.textSoft} name="account-circle-outline" size={18} />
                <View>
                  <Text style={styles.metaLabel}>Created By</Text>
                  <Text style={styles.metaValue}>{task.creator?.name || 'System'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Assignees Card */}
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
                          color={isComment ? palette.white : palette.textSoft}
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
              placeholder="Write a comment..."
              placeholderTextColor={palette.textSoft}
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
                <ActivityIndicator color={palette.white} size="small" />
              ) : (
                <MaterialCommunityIcons color={palette.white} name="send" size={18} />
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
                  <MaterialCommunityIcons color={palette.white} name="check" size={18} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </BottomSheet>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
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
    color: palette.textSoft,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
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
    color: palette.text,
  },
  description: {
    fontSize: typography.body,
    color: palette.textSoft,
    lineHeight: 22,
  },
  descriptionMuted: {
    fontSize: typography.body,
    color: palette.textMuted,
    fontStyle: 'italic',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: palette.border,
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
    color: palette.textMuted,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  overdueValue: {
    color: palette.dangerBright,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
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
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.accent,
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
    color: palette.text,
  },
  assigneeRole: {
    fontSize: typography.caption,
    color: palette.textSoft,
  },
  assigneeStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundAlt,
  },
  assigneeStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textSoft,
    textTransform: 'capitalize',
  },
  assigneeStatusCompleted: {
    backgroundColor: palette.successSoft,
  },
  assigneeStatusCompletedLabel: {
    color: palette.success,
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
    backgroundColor: palette.accent,
  },
  systemTimelineIcon: {
    backgroundColor: palette.backgroundAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: palette.border,
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
    color: palette.text,
  },
  timelineTime: {
    fontSize: 10,
    color: palette.textMuted,
  },
  commentBubble: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  commentBody: {
    fontSize: typography.body,
    color: palette.text,
    lineHeight: 20,
  },
  systemActivityText: {
    fontSize: typography.caption,
    color: palette.textSoft,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textMuted,
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
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: palette.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    color: palette.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sendButtonDisabled: {
    backgroundColor: palette.backgroundAlt,
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
    backgroundColor: palette.backgroundAlt,
    paddingHorizontal: spacing.md,
  },
  statusSheetItemActive: {
    backgroundColor: palette.accent,
  },
  statusSheetLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  statusSheetLabelActive: {
    color: palette.white,
  },
});
