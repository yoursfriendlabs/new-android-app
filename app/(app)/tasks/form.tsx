import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { FormField } from '@/src/components/forms/FormField';
import {
  useTaskDetail,
  useTaskMetadata,
  useCreateTaskMutation,
  useUpdateTaskMutation,
} from '@/src/hooks/useTaskQueries';
import { useStaff } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import { todayIso } from '@/src/lib/format';

export default function TaskFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  // Queries
  const { data: task, isLoading: isTaskLoading } = useTaskDetail(id);
  const { data: metadata } = useTaskMetadata();
  const { data: staffList } = useStaff();

  // Mutations
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation(id || '');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('open');
  const [dueDate, setDueDate] = useState(todayIso());
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load task details for Edit mode
  useEffect(() => {
    if (isEdit && task && !isInitialized) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate || todayIso());
      setAssignedUserIds((task.assignments || []).map((a) => a.assignee.id));
      setIsInitialized(true);
    }
  }, [isEdit, task, isInitialized]);

  const toggleAssignee = (userId: string) => {
    setAssignedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required field', 'Please enter a task title.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      dueDate,
      assigneeUserIds: assignedUserIds,
    };

    try {
      if (isEdit) {
        await updateTaskMutation.mutateAsync(payload);
        Alert.alert('Task updated', 'The task has been updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await createTaskMutation.mutateAsync(payload);
        Alert.alert('Task created', 'The task has been created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert('Failed to save task', error instanceof Error ? error.message : 'Please check your input and try again.');
    }
  };

  if (isEdit && isTaskLoading) {
    return (
      <Screen scrollable={false} padded={false} topBarTitle="Edit Task" topBarLeading="back">
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.loadingText}>Loading task data...</Text>
        </View>
      </Screen>
    );
  }

  const isSaving = createTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <Screen scrollable={true} padded={false} topBarTitle={isEdit ? 'Edit Task' : 'Create Task'} topBarLeading="back">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FormField
          label="Title *"
          value={title}
          placeholder="Enter task title"
          onChangeText={setTitle}
        />

        <FormField
          label="Description"
          value={description}
          placeholder="Provide detail instructions for staff"
          onChangeText={setDescription}
          multiline
        />

        <FormField
          label="Due Date (YYYY-MM-DD)"
          value={dueDate}
          placeholder="e.g. 2026-06-15"
          onChangeText={setDueDate}
        />

        {/* Priority Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.prioRow}>
            {(metadata?.priorities || [
              { key: 'low', label: 'Low' },
              { key: 'medium', label: 'Medium' },
              { key: 'high', label: 'High' },
            ]).map((p) => {
              const selected = priority === p.key;
              return (
                <Pressable
                  key={p.key}
                  style={[styles.prioChip, selected && styles.prioChipActive]}
                  onPress={() => setPriority(p.key)}>
                  <Text style={[styles.prioChipLabel, selected && styles.prioChipLabelActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Status Selector - Only show in Edit mode */}
        {isEdit ? (
          <View style={styles.section}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.prioRow}>
              {(metadata?.statuses || [
                { key: 'todo', label: 'To Do' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
              ]).map((s) => {
                const selected = status === s.key;
                return (
                  <Pressable
                    key={s.key}
                    style={[styles.prioChip, selected && styles.prioChipActive]}
                    onPress={() => setStatus(s.key)}>
                    <Text style={[styles.prioChipLabel, selected && styles.prioChipLabelActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Assignees Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Assign Staff Members</Text>
          <View style={styles.staffList}>
            {(staffList || []).map((staff) => {
              const isAssigned = assignedUserIds.includes(staff.id);
              return (
                <Pressable
                  key={staff.id}
                  style={[styles.staffRow, isAssigned && styles.staffRowActive]}
                  onPress={() => toggleAssignee(staff.id)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {staff.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{staff.name}</Text>
                    <Text style={styles.staffRole}>{staff.role || 'Staff member'}</Text>
                  </View>
                  <MaterialCommunityIcons
                    color={isAssigned ? palette.accent : palette.textMuted}
                    name={isAssigned ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                  />
                </Pressable>
              );
            })}
            {!(staffList || []).length ? (
              <Text style={styles.emptyText}>No staff members registered. Go to Settings &gt; Staff to add staff.</Text>
            ) : null}
          </View>
        </View>

        {/* Save button */}
        <Pressable
          disabled={isSaving}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={() => void handleSave()}>
          {isSaving ? (
            <ActivityIndicator color={palette.white} size="small" />
          ) : (
            <Text style={styles.saveButtonLabel}>{isEdit ? 'Save Changes' : 'Create Task'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
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
  section: {
    gap: spacing.xs,
    marginVertical: spacing.xxs,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  prioRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prioChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  prioChipLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.textSoft,
  },
  prioChipLabelActive: {
    color: palette.accent,
  },
  staffList: {
    gap: spacing.sm,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.card,
  },
  staffRowActive: {
    borderColor: palette.accent,
    backgroundColor: '#f6fbff',
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
  staffInfo: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  staffRole: {
    fontSize: typography.caption,
    color: palette.textSoft,
    textTransform: 'capitalize',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.card,
  },
  saveButtonDisabled: {
    backgroundColor: palette.backgroundAlt,
  },
  saveButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontStyle: 'italic',
  },
});
