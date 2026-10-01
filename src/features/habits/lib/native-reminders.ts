import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Whether this build can post a real lock-screen notification. Expo Go cannot,
 * and the web has no notion of one. Kept apart from the reminder rules so those
 * stay plain logic with nothing native behind them.
 */
export function nativeRemindersAvailable() {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  if (Constants.appOwnership === 'expo') return false;
  return true;
}
