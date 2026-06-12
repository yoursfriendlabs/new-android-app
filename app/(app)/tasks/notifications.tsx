import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
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
import {
  useTaskNotificationSummary,
  useMarkNotificationsReadMutation,
} from '@/src/hooks/useTaskQueries';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import { prettyDate } from '@/src/lib/format';
import type { TaskActivity } from '@/src/types/models';

export default function TaskNotificationsScreen() {
  const { data: summary, isLoading, refetch, isFetching } = useTaskNotificationSummary();
  const markReadMutation = useMarkNotificationsReadMutation();

  // Mark all notifications read when this screen is visited/focused
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void markReadMutation.mutateAsync();
    }, [refetch, markReadMutation.mutateAsync])
  );

  const handleNotificationPress = (item: TaskActivity) => {
    router.push({
      pathname: '/tasks/detail' as any,
      params: { id: item.taskId },
    });
  };

  const getIconForActivity = (type: string) => {
    switch (type.toLowerCase()) {
      case 'comment':
        return 'comment-text-outline';
      case 'status_change':
      case 'status':
        return 'progress-check';
      case 'assignment':
        return 'account-plus';
      case 'create':
        return 'plus-circle-outline';
      default:
        return 'bell-outline';
    }
  };

  const renderNotificationItem = ({ item }: { item: TaskActivity }) => {
    return (
      <Pressable style={styles.notificationCard} onPress={() => handleNotificationPress(item)}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            color={palette.accent}
            name={getIconForActivity(item.type) as never}
            size={18}
          />
        </View>
        <View style={styles.copyWrap}>
          <View style={styles.headerRow}>
            <Text style={styles.actorName}>{item.actor.name}</Text>
            <Text style={styles.timeText}>{prettyDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.contentText}>{item.content}</Text>
          {item.taskTitle ? (
            <View style={styles.taskBadge}>
              <Text numberOfLines={1} style={styles.taskTitleText}>
                Task: {item.taskTitle}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Task Updates" topBarLeading="back">
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={summary?.recentActivities ?? []}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons color={palette.textMuted} name="bell-off-outline" size={48} />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No recent task activities or updates found.</Text>
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
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actorName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  timeText: {
    fontSize: 10,
    color: palette.textMuted,
  },
  contentText: {
    fontSize: typography.caption,
    color: palette.textSoft,
    lineHeight: 18,
  },
  taskBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    backgroundColor: palette.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    maxWidth: '90%',
  },
  taskTitleText: {
    fontSize: 10,
    color: palette.textSoft,
    fontWeight: '700',
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
  },
});
