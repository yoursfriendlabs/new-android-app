import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * How much of the screen the keyboard covers, in points.
 *
 * The keyboard controller is the accurate source, but it listens on the main
 * window and can stay silent inside a native modal on some Android builds. When
 * it reports nothing we fall back to React Native's own keyboard events, so a
 * sheet always knows to move out of the way.
 */
export function useKeyboardHeight(): number {
  const controllerHeight = useKeyboardState((state) => state.height);
  const [fallbackHeight, setFallbackHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setFallbackHeight(event.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setFallbackHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return controllerHeight > 0 ? controllerHeight : fallbackHeight;
}
