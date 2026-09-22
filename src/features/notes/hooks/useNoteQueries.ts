import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/src/api';
import { normalizeNote } from '@/src/api/normalize';
import { toPage, usePagedList } from '@/src/shared/hooks/usePagedList';
import type { Note } from '@/src/types/models';
import type { NoteCreatePayload, NoteUpdatePayload } from '@/src/types/contracts';

/**
 * Notes 30 at a time as the user scrolls, filtered on the server so every tab
 * reaches its oldest entries. Shares the ['notes'] key, so saves refresh it.
 */
export function usePagedNotes(filters: { q?: string; kind?: 'note' | 'reminder'; status?: 'open' | 'done' } = {}) {
  return usePagedList<Note>({
    queryKey: ['notes', 'paged', filters],
    fetchPage: async (page) => toPage<Note>(await notesApi.list({ ...filters, ...page }), (raw) => normalizeNote(raw)),
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
