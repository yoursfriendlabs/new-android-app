/** Where a tapped notification should land. Note reminders open the note itself. */
export function reminderTargetUrl(id?: string | null) {
  const value = String(id ?? '');
  if (value.startsWith('note:')) {
    const noteId = value.slice('note:'.length);
    // Ids made from Date.now() are placeholders for notes the server never confirmed.
    if (noteId && !/^\d+$/.test(noteId)) {
      return `/tasks/detail?id=${encodeURIComponent(noteId)}&scope=note`;
    }
  }
  if (value.startsWith('task:')) {
    return `/tasks/detail?id=${encodeURIComponent(value.slice('task:'.length))}`;
  }
  return '/notes';
}
