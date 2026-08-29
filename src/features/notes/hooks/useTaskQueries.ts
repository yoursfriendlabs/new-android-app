import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tasksApi } from '@/src/api';
import {
  normalizeTask,
  normalizeTaskMetadata,
  normalizeTaskNotificationSummary,
  extractListItems,
  normalizePaginated,
} from '@/src/api/normalize';
import type { Task, TaskMetadata, TaskNotificationSummary } from '@/src/types/models';
import type { TaskCreatePayload, TaskUpdatePayload } from '@/src/types/contracts';

export function useTaskMetadata() {
  return useQuery<TaskMetadata>({
    queryKey: ['task-metadata'],
    queryFn: async () => {
      try {
        return normalizeTaskMetadata(await tasksApi.meta());
      } catch {
        return {
          statuses: [
            { key: 'open', label: 'Open', tone: 'info' },
            { key: 'in_progress', label: 'In Progress', tone: 'warning' },
            { key: 'completed', label: 'Completed', tone: 'success' },
          ],
          priorities: [
            { key: 'low', label: 'Low', tone: 'info' },
            { key: 'medium', label: 'Medium', tone: 'warning' },
            { key: 'high', label: 'High', tone: 'danger' },
          ],
          activityTypes: [],
        };
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useTasks(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      try {
        const response = await tasksApi.list(filters);
        const items = extractListItems<Task>(response).map(normalizeTask);
        return normalizePaginated(response, items);
      } catch {
        return { items: [], total: 0 };
      }
    },
    staleTime: 10_000,
  });
}

export function useTaskDetail(id?: string) {
  const queryClient = useQueryClient();
  const query = useQuery<Task | null>({
    queryKey: ['task', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      try {
        const response = await tasksApi.get(id);
        return normalizeTask(response);
      } catch {
        return null;
      }
    },
    staleTime: 5000,
  });

  const isSuccess = query.isSuccess;
  const data = query.data;

  useEffect(() => {
    if (isSuccess && data) {
      void queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
    }
  }, [isSuccess, data, queryClient]);

  return query;
}

export function useTaskNotificationSummary(options: { enabled?: boolean } = {}) {
  return useQuery<TaskNotificationSummary>({
    queryKey: ['task-notifications'],
    queryFn: async () => {
      try {
        return normalizeTaskNotificationSummary(await tasksApi.notificationsSummary());
      } catch {
        return {
          unreadActivityCount: 0,
          counters: {
            assignedToMeOpen: 0,
            assignedToMeOverdue: 0,
            createdByMeOpen: 0,
          },
          recentActivities: [],
        };
      }
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
    ...options,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
    },
  });
}

export function useUpdateTaskMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskUpdatePayload) => tasksApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task', id] });
      void queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
    },
  });
}

export function useAddTaskCommentMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => tasksApi.addComment(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', id] });
      void queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
    },
  });
}

export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.markNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-notifications'] });
    },
  });
}
