import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SearchField } from '@/src/components/ui/SearchField';
import { useTasks, useTaskMetadata } from '@/src/hooks/useTaskQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import type { Task } from '@/src/types/models';

type TabType = 'assigned-to-me' | 'created-by-me' | 'all';

export default function TaskInboxScreen() {
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

  // Filters state
  const [tab, setTab] = useState<TabType>('assigned-to-me');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedDue, setSelectedDue] = useState<string | null>(null);

  // Queries
  const { data: metadata } = useTaskMetadata();

  const queryParams = {
    q: search,
    status: selectedStatus || undefined,
    priority: selectedPriority || undefined,
    due: selectedDue || undefined,
    assignedTo: tab === 'assigned-to-me' ? 'me' : undefined,
    createdBy: tab === 'created-by-me' ? 'me' : undefined,
    participation: tab === 'all' ? undefined : undefined, // list default behavior handled by me params
  };

  const { data: tasksData, isLoading, refetch, isFetching } = useTasks(queryParams);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

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

  const renderTaskItem = ({ item }: { item: Task }) => {
    const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'completed';
    return (
      <Pressable
        style={styles.taskCard}
        onPress={() => router.push({ pathname: '/tasks/detail' as any, params: { id: item.id } })}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.taskTitle}>
            {item.title}
          </Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: `${getPriorityColor(item.priority)}12` },
            ]}>
            <Text style={[styles.priorityLabel, { color: getPriorityColor(item.priority) }]}>
              {item.priority.toUpperCase()}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text numberOfLines={2} style={styles.taskDesc}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <MaterialCommunityIcons color={palette.textSoft} name="calendar-clock" size={14} />
            <Text style={[styles.dueDateText, isOverdue && styles.overdueText]}>
              {item.dueDate ? prettyDate(item.dueDate) : 'No due date'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status)}12` },
            ]}>
            <Text style={[styles.statusLabel, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooterSub}>
          <Text style={styles.metaText}>
            Creator: {item.creator?.name || 'Unknown'}
          </Text>
          <Text style={styles.metaText}>
            Assignees: {item.assigneeCount || 0}
          </Text>
        </View>
      </Pressable>
    );
  };

  const topBarRight = canManage ? (
    <Pressable
      style={styles.headerButton}
      onPress={() => router.push('/tasks/form' as any)}>
      <MaterialCommunityIcons color={palette.white} name="plus" size={24} />
    </Pressable>
  ) : undefined;

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Task Inbox" topBarRight={topBarRight} topBarLeading="back">
      <View style={styles.container}>
        <SegmentedTabs
          value={tab}
          onChange={(v) => setTab(v as TabType)}
          style={styles.segmentedTabs}
          contentContainerStyle={styles.tabBar}
          activeBackgroundColor={palette.accent}
          options={[
            { label: 'Assigned to me', value: 'assigned-to-me' },
            { label: 'Created by me', value: 'created-by-me' },
            { label: 'All tasks', value: 'all' },
          ]}
        />

        <View style={styles.searchBlock}>
          <SearchField
            placeholder="Search tasks by title/desc..."
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter chips */}
        <View style={styles.filtersScrollWrap}>
          <FlatList
            horizontal
            data={[
              // Statuses
              ...(metadata?.statuses || []).map((s) => ({
                type: 'status',
                key: s.key,
                label: s.label,
                selected: selectedStatus === s.key,
              })),
              // Priorities
              ...(metadata?.priorities || []).map((p) => ({
                type: 'priority',
                key: p.key,
                label: `${p.label} Prio`,
                selected: selectedPriority === p.key,
              })),
              // Due
              ...[
                { key: 'overdue', label: 'Overdue' },
                { key: 'today', label: 'Due Today' },
                { key: 'upcoming', label: 'Upcoming' },
              ].map((d) => ({
                type: 'due',
                key: d.key,
                label: d.label,
                selected: selectedDue === d.key,
              })),
            ]}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
            keyExtractor={(item) => `${item.type}-${item.key}`}
            renderItem={({ item }) => {
              const handlePress = () => {
                if (item.type === 'status') {
                  setSelectedStatus(item.selected ? null : item.key);
                } else if (item.type === 'priority') {
                  setSelectedPriority(item.selected ? null : item.key);
                } else if (item.type === 'due') {
                  setSelectedDue(item.selected ? null : item.key);
                }
              };

              return (
                <Pressable
                  style={[styles.filterChip, item.selected && styles.filterChipActive]}
                  onPress={handlePress}>
                  <Text style={[styles.filterChipLabel, item.selected && styles.filterChipLabelActive]}>
                    {item.label}
                  </Text>
                  {item.selected ? (
                    <MaterialCommunityIcons color={palette.white} name="close-circle" size={14} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Fetching tasks...</Text>
          </View>
        ) : (
          <FlatList
            data={tasksData?.items ?? []}
            renderItem={renderTaskItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons color={palette.textMuted} name="checkbox-marked-circle-outline" size={48} />
                <Text style={styles.emptyTitle}>No tasks found</Text>
                <Text style={styles.emptySubtitle}>Adjust your filters or create a new task to get started.</Text>
              </View>
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabs: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabBar: {
    minHeight: 46,
  },
  searchBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  filtersScrollWrap: {
    height: 54,
    paddingVertical: spacing.sm,
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterChipLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.textSoft,
  },
  filterChipLabelActive: {
    color: palette.white,
  },
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  taskCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  taskTitle: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  priorityLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  taskDesc: {
    fontSize: typography.caption,
    color: palette.textSoft,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dueDateText: {
    fontSize: typography.caption,
    color: palette.textSoft,
    fontWeight: '600',
  },
  overdueText: {
    color: palette.dangerBright,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardFooterSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xxs,
  },
  metaText: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '500',
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  emptySubtitle: {
    fontSize: typography.caption,
    color: palette.textSoft,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
