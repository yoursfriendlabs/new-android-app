import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Semantic haptics. Call these instead of expo-haptics directly so the same
 * action feels the same everywhere, and so web/simulator failures stay silent.
 */

function run(effect: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  void effect().catch(() => undefined);
}

/** A row, chip or tab was tapped. */
export function tapLight() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A primary button was pressed — save, checkout, confirm. */
export function tapMedium() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Something was created or completed. */
export function success() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Validation failed or an action needs attention. */
export function warning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** A request failed or a destructive action was blocked. */
export function error() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** A value crossed a step — quantity stepper, slider notch. */
export function selection() {
  run(() => Haptics.selectionAsync());
}

export const haptics = {
  error,
  selection,
  success,
  tapLight,
  tapMedium,
  warning,
};
