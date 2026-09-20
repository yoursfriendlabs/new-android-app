import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { usePekkaStore } from '../stores/pekka-store';

/**
 * Moves the Pekka button up by `lift` while this screen is showing, so it
 * stacks above the screen's own floating button instead of covering it.
 */
export function usePekkaLift(lift: number) {
  const setLift = usePekkaStore((state) => state.setLift);
  useFocusEffect(
    useCallback(() => {
      setLift(lift);
      return () => setLift(0);
    }, [lift, setLift])
  );
}
