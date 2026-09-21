import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { env } from '@/src/shared/lib/env';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

// Google puts the Web client ID in the ID token as the audience, and the
// backend accepts tokens for it (GOOGLE_CLIENT_IDS).
const webClientId = env.googleWebClientId;

let googleModule: GoogleSignInModule | null | undefined;

function google(): GoogleSignInModule | null {
  if (googleModule !== undefined) return googleModule;
  if (
    !webClientId ||
    Platform.OS === 'web' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  ) {
    googleModule = null;
    return null;
  }
  try {
    // Native module: only present in a real build, never in Expo Go.
    googleModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    googleModule.GoogleSignin.configure({ webClientId });
    return googleModule;
  } catch {
    googleModule = null;
    return null;
  }
}

/** Whether to show "Continue with Google" at all. */
export function isGoogleSignInAvailable() {
  return Boolean(google());
}

/**
 * Opens the Google account picker and returns an ID token for the backend.
 * Returns null when the person closes the picker.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  const native = google();
  if (!native) throw new Error('Google sign-in is not available in this version of the app.');
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = native;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Forget the last account so the picker always shows and people can switch.
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new Error('Google did not return a sign-in token. Please try again.');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services is needed to sign in with Google.');
      }
    }
    throw error;
  }
}
