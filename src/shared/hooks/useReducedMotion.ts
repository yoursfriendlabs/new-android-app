import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Follow the device preference, including changes made while the app is open. */
export function useReducedMotion() {
  // Avoid starting motion before the asynchronous preference check completes.
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true;
      setReduced(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changed) setReduced(enabled);
    }).catch(() => {
      // Keep the static presentation if the platform cannot read the setting.
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
