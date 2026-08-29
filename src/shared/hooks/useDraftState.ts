import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearDraft, readDraft, saveDraft } from '@/src/data/database';

export function useDraftState<T>(draftKey: string, initialValue: T) {
  const initialValueRef = useRef(initialValue);
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
