import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearDraft, readDraft, saveDraft } from '@/src/data/database';

interface DraftOptions {
  /**
   * Throw the saved copy away when the screen closes, so the form opens empty
   * next time. The draft still survives the app being killed mid-entry, which
   * is the only thing it is really there for.
   */
  discardOnUnmount?: boolean;
}

export function useDraftState<T>(draftKey: string, initialValue: T, options: DraftOptions = {}) {
  const initialValueRef = useRef(initialValue);
  const discardOnUnmountRef = useRef(options.discardOnUnmount ?? false);
  discardOnUnmountRef.current = options.discardOnUnmount ?? false;
  const [value, setValue] = useState(initialValueRef.current);
  const [isReady, setIsReady] = useState(false);
  const isResettingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initialValueRef.current = initialValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsReady(false);

    readDraft<T>(draftKey)
      .then((draft) => {
        if (!isMounted) return;
        setValue(draft ?? initialValueRef.current);
      })
      .finally(() => {
        if (isMounted) {
          setIsReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!isReady || isResettingRef.current) return;

    timerRef.current = setTimeout(() => {
      if (!isResettingRef.current) {
        saveDraft(draftKey, value).catch(() => null);
      }
    }, 180);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draftKey, isReady, value]);

  useEffect(
    () => () => {
      // Runs after the save timer above has been cleared, so nothing writes the
      // draft back out behind this.
      if (discardOnUnmountRef.current) {
        clearDraft(draftKey).catch(() => null);
      }
    },
    [draftKey],
  );

  const reset = useCallback(async (nextValue?: T) => {
    const resolvedValue = nextValue ?? initialValueRef.current;
    isResettingRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    initialValueRef.current = resolvedValue;
    setValue(resolvedValue);
    await clearDraft(draftKey);
    isResettingRef.current = false;
  }, [draftKey]);

  // Memoize return value so consumers can safely include it in dependency arrays
  return useMemo(() => ({
    isReady,
    value,
    setValue,
    reset,
  }), [isReady, value, reset]);
}
