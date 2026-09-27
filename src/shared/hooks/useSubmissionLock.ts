import { useCallback, useRef, useState } from 'react';

/** Blocks a second submission immediately, before React renders the busy state. */
export function useSubmissionLock() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const tryStart = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }, []);
  const finish = useCallback(() => {
    locked.current = false;
    setBusy(false);
  }, []);
  const isBusy = useCallback(() => locked.current, []);
  return { busy, tryStart, finish, isBusy };
}
