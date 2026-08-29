import { localIsoDate, todayIso } from '@/src/shared/lib/format';
import type { Task } from '@/src/types/models';

export type NoteKind = 'note' | 'reminder';

const NOTE_MARK = '[[note]]';
const REMINDER_MARK = '[[reminder]]';
const AT_MARK = /^\[\[at:([^\]]+)\]\]\s*/;

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

export function createdRecordId(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id === 'string' && record.id) return record.id;
  const nested = record.data ?? record.task;
  if (nested && typeof nested === 'object') {
    const id = (nested as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

export function encodeNoteBody(kind: NoteKind, body: string, dueAt?: string | null) {
  const mark = kind === 'note' ? NOTE_MARK : REMINDER_MARK;
  const at = kind === 'reminder' && dueAt ? `[[at:${dueAt}]]\n` : '';
  const trimmed = body.trim();
  return trimmed ? `${mark}\n${at}${trimmed}` : `${mark}\n${at}`.trimEnd();
}

export function decodeNoteBody(description?: string | null): { kind: NoteKind; body: string; dueAt?: string } {
  let text = String(description || '').trim();
  let kind: NoteKind = 'reminder';
  if (text.startsWith(NOTE_MARK)) {
    kind = 'note';
    text = text.slice(NOTE_MARK.length).trim();
  } else if (text.startsWith(REMINDER_MARK)) {
    kind = 'reminder';
    text = text.slice(REMINDER_MARK.length).trim();
  }
  const atMatch = text.match(AT_MARK);
  const dueAt = atMatch?.[1];
  if (atMatch) text = text.slice(atMatch[0].length).trim();
  return { kind, body: text, dueAt };
}

export function taskKind(task: Pick<Task, 'description' | 'dueDate'>): NoteKind {
  const decoded = decodeNoteBody(task.description);
  if (decoded.kind === 'note') return 'note';
  if (!task.dueDate && !decoded.dueAt) return 'note';
  return 'reminder';
}

export function isOpenTask(status: string) {
  const value = status.toLowerCase();
  return value !== 'completed' && value !== 'cancelled' && value !== 'canceled' && value !== 'done';
}

export function reminderDueAt(task: Pick<Task, 'description' | 'dueDate'>) {
  const decoded = decodeNoteBody(task.description);
  if (decoded.kind === 'note') return null;
  if (decoded.dueAt) {
    const parsed = new Date(decoded.dueAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (task.dueDate) {
    const parsed = new Date(`${String(task.dueDate).slice(0, 10)}T09:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function roundToNextHour(from = new Date()) {
  const next = new Date(from);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export function reminderPresets(from = new Date()) {
  const today = todayIso();
  const tonight = new Date(from);
  tonight.setHours(20, 0, 0, 0);
  if (tonight.getTime() <= from.getTime()) tonight.setDate(tonight.getDate() + 1);

  const in30 = new Date(from.getTime() + 30 * 60_000);
  const in60 = new Date(from.getTime() + 60 * 60_000);
  const tomorrowMorning = new Date(from);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);
  const nextWeek = new Date(from);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);

  return [
    { id: '30m', label: '30 min', at: in30, dueDate: localIsoDate(in30) },
    { id: '1h', label: '1 hour', at: in60, dueDate: localIsoDate(in60) },
    { id: 'tonight', label: 'Tonight', at: tonight, dueDate: localIsoDate(tonight) },
    { id: 'tomorrow', label: 'Tomorrow 9:00', at: tomorrowMorning, dueDate: shiftIso(today, 1) },
    { id: 'week', label: 'Next week', at: nextWeek, dueDate: localIsoDate(nextWeek) },
  ];
}

export function formatDueStamp(value: Date) {
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  return `${localIsoDate(value)} · ${hours}:${minutes}`;
}
