import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { env } from '@/src/shared/lib/env';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

// Google puts the Web client ID in the ID token as the audience, and the
// backend accepts tokens for it (GOOGLE_CLIENT_IDS).
const webClientId = env.googleWebClientId;

/**
 * Google rejects the sign-in with this code when the app asking for it is not
 * one it knows: no Android OAuth client in the Cloud project whose package name
 * and signing-certificate fingerprint match this build. Nothing in the app can
 * fix it, so it is called out separately from a bad connection.
 */
const DEVELOPER_ERROR_CODE = '10';

let googleModule: GoogleSignInModule | null | undefined;

function google(): GoogleSignInModule | null {
  if (googleModule !== undefined) return googleModule;
  if (
    !webClientId ||
    Platform.OS === 'web' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    googleModule = null;
    return null;
  }
  try {
    // Native module: only present in a real build, never in Expo Go.
    googleModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    googleModule.GoogleSignin.configure({ webClientId });
    return googleModule;
  } catch (error) {
    console.warn('Google sign-in module is not in this build', error);
    googleModule = null;
    return null;
  }
}

/** Whether to show "Continue with Google" at all. */
export function isGoogleSignInAvailable() {
  return Boolean(google());
}

function errorCodeOf(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return code === undefined || code === null ? '' : String(code);
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
    const code = errorCodeOf(error);

    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services is needed to sign in with Google.');
      }
    }

    if (code === DEVELOPER_ERROR_CODE) {
      // Printed in full because only a developer can act on it: the build's
      // signing certificate has to be registered as an Android OAuth client,
      // and a Play-distributed build is re-signed by Play App Signing, so that
      // fingerprint has to be registered too.
      console.error(
        '[google-signin] DEVELOPER_ERROR: this build is not registered in Google Cloud. ' +
          `Register package ${Constants.expoConfig?.android?.package ?? 'com.yoursfriend.pasalmanager'} ` +
          'with this build’s signing SHA-1 as an Android OAuth client, in the same project as ' +
          `web client ${webClientId.slice(0, 24)}… (see docs/google-sign-in.md).`,
      );
      throw new Error(
        __DEV__
          ? 'Google sign-in is not set up for this build (DEVELOPER_ERROR). Register the signing SHA-1 in Google Cloud — see docs/google-sign-in.md.'
          : 'Google sign-in is not available yet. Please use your email and password.',
      );
    }

    // Google's own errors are meant for us, not for shop owners.
    console.warn(`Google sign-in failed${code ? ` (code ${code})` : ''}`, error);
    throw new Error('Google sign-in is not working right now. Please use your email and password.');
  }
}
