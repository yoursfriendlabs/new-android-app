# Google sign-in

"Continue with Google" is finished in code on both sides. What it still needs is
registration in Google Cloud, which no app change can substitute for.

## Why it fails today

Google hands an ID token only to an app it recognises. On Android it recognises
an app by two things together:

```
  package name                    signing certificate SHA-1
  com.yoursfriend.pasalmanager  +  ??:??:??:  …  (of the build that is running)
           │                                │
           └──────────── both must match an ─┘
                Android OAuth client in the Cloud project
                that owns the web client ID
```

If no Android OAuth client matches the running build, Google fails the request
with `DEVELOPER_ERROR` (code 10) before any network call happens. The app logs
that case in full and tells the person to use email and password instead.

## What is already correct

- The web client ID in `.env` is a real, live client.
- The backend accepts tokens for it (`GOOGLE_CLIENT_IDS`), and the dev server has
  it set. A forged token is correctly rejected with 401.
- The app's own sign-in and sign-up paths work once a token arrives: a Google
  account that is new goes to the "How will you use PM?" step carrying a
  `signupToken`, and an existing one signs straight in.

## The three fingerprints

Each certificate that can sign the app needs its own Android OAuth client, in
the **same Cloud project** as the web client ID.

| Build | Signed with | Where the SHA-1 comes from |
| --- | --- | --- |
| `expo run:android` | debug key | `npm run signing:sha1` |
| local release APK | upload key | `npm run signing:sha1` with the release env vars set |
| installed from Play | Play's own key | Play Console, see below |

The Play one is the one that bites at launch: Play App Signing strips your
upload signature and re-signs with a key Google holds, so a build that signed in
fine as a local APK fails once it comes from Play. Copy it from **Play Console →
Test and release → App integrity → App signing key certificate → SHA-1**.

## Steps

1. Print the fingerprints you have locally:

   ```sh
   npm run signing:sha1
   # or, for the upload key:
   RELEASE_KEYSTORE_FILE=~/keys/pasalmanager-upload.jks \
   RELEASE_KEYSTORE_PASSWORD=… RELEASE_KEY_ALIAS=… \
     npm run signing:sha1
   ```

   A release build prints the upload key's SHA-1 on its own as it runs.

2. In Google Cloud → APIs & Services → Credentials, in the project that owns
   `102931942081-…apps.googleusercontent.com`, choose **Create credentials →
   OAuth client ID → Android**, and enter the package name and one SHA-1.
   Repeat for each fingerprint; one client per fingerprint.

3. Make sure the OAuth consent screen is published (not left in Testing), or
   only accounts on its test-user list can sign in.

4. Reinstall and try again. A change in Cloud takes effect within a few minutes;
   no rebuild is needed, because the app only ever sends the web client ID.

## Checking it worked

Watch the log while tapping the button:

```sh
adb logcat -s ReactNativeJS:V | grep -i google
```

- `DEVELOPER_ERROR` — the running build's fingerprint is still not registered.
- `code 12501` — the person closed the picker; nothing is wrong.
- Nothing, and the app moves on — it worked.

If the button does not appear at all, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was
empty at build time, or the native module is missing from the build.

## iOS

iOS needs its own iOS OAuth client and a URL scheme in `Info.plist`, added by
this plugin entry:

```json
["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<reversed iOS client id>" }]
```

That is not in `app.json`, so Google sign-in cannot complete on iOS yet. It is
deliberate — the launch is Android only.
