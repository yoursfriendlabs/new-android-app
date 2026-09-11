import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/src/api';
import { normalizeNote, extractListItems, normalizePaginated } from '@/src/api/normalize';
import type { Note } from '@/src/types/models';
import type { NoteCreatePayload, NoteUpdatePayload } from '@/src/types/contracts';

export function useNotes(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['notes', filters],
    queryFn: async () => {
      try {
        const response = await notesApi.list(filters);
        const items = extractListItems<Note>(response).map(normalizeNote);
        return normalizePaginated(response, items);
      } catch {
        return { items: [], total: 0 };
      }
    },
    staleTime: 10_000,
  });
}

export function useNoteDetail(id?: string) {
  return useQuery<Note | null>({
    queryKey: ['note', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      try {
        return normalizeNote(await notesApi.get(id));
      } catch {
        return null;
      }
    },
    staleTime: 5000,
  });
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NoteCreatePayload) => notesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useUpdateNoteMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NoteUpdatePayload) => notesApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      void queryClient.invalidateQueries({ queryKey: ['note', id] });
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      void queryClient.removeQueries({ queryKey: ['note', id] });
    },
  });
}
