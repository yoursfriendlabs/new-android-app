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

import { Screen } from '@/src/shared/layout/Screen';
import {
  useTaskNotificationSummary,
  useMarkNotificationsReadMutation,
} from '@/src/features/notes/hooks/useTaskQueries';
import { radius, spacing, typography, shadows } from '@/src/theme';
import { prettyDate } from '@/src/shared/lib/format';
import type { TaskActivity } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function TaskNotificationsScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
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
            color={colors.accent}
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
            <ActivityIndicator color={colors.accent} size="large" />
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
                <MaterialCommunityIcons color={colors.textMuted} name="bell-off-outline" size={48} />
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

const createStyles = (colors: AppPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
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
    color: colors.text,
  },
  timeText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  contentText: {
    fontSize: typography.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  taskBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    maxWidth: '90%',
  },
  taskTitleText: {
    fontSize: 10,
    color: colors.textSoft,
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
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
