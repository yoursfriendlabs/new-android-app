# Play Store release

Build and submission notes. This is not a production sign-off: deploy the backend, finish real-device checks, and resolve the release gates below first.

## Current verification — 20 September 2026

- App: typecheck and 43 tests pass; production web and Android JavaScript exports build.
- Browser: personal and business login, session reload, Pekka tour, exact/ambiguous answers, Banks paging, Money Insights and Ledger pass in Chrome using controlled API fixtures. This checks the UI, not the live production API.
- Backend: new money-feed and Pekka database checks pass on temporary local tables, including 300+ records, partial payments, services, workspace isolation, misspelled names and Nepali names. No application records are changed by those tests.
- Full backend suite: 44 failures also occur on the unchanged HEAD baseline. Do not treat these as a clean production test result. The extra ledger failure from the interrupted work was an outdated response assertion; it now checks the new totals.
- The production backend is **not deployed**, as confirmed by the owner. Production API: `https://api.yoursfriend.com/`.
- No signed AAB/APK, installed-device speech recognition, background reminder delivery or native account deletion was verified in this pass.

```text
Backend + migration → web/Android build → installed-device checks → Play testing → public release
```

### Backend endpoints needed by this app

Deploy both repositories together. The app now needs `/api/reports/money-feed`, ledger response totals, bank response `totalBalance`, `/api/dashboard/activity`, `/api/budgets/impact`, saving goals, `/api/pekka/ask`, and the in-app/public account-deletion routes. Existing API response fields remain available for older clients.

### Caching

The app already caches query results for 30–60 seconds and refreshes affected queries after writes and offline sync. Dashboard projections also have a bounded server cache, separated by business and invalidated after writes. New money queries include the workspace in their cache keys; Pekka fetches current prices and balances for each question. No additional cache service is needed for this release. The new reports require a connection for their first load; do not promise offline availability for every screen.

### Web hosting

SQLite on web needs the following response headers on the exported site (HTML and worker/assets):

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

Serve `.wasm` as `application/wasm` over HTTPS (localhost is allowed for testing). The Expo Router config supplies the headers for compatible Expo hosting; configure them separately on other hosts. See [Expo SQLite web setup](https://docs.expo.dev/versions/latest/sdk/sqlite/). Browser login uses tab session storage; native login keeps using SecureStore.

## 1. One-time setup

### Upload key

Create it once and back it up somewhere safe (password manager + offline copy). Every future update must be signed with it.

```sh
mkdir -p ~/keys
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/keys/pasalmanager-upload.jks \
  -alias pasalmanager -keyalg RSA -keysize 2048 -validity 10000
```

### `.env.local` (git-ignored, never commit it)

```sh
EXPO_PUBLIC_API_BASE_URL=https://api.yoursfriend.com/
RELEASE_KEYSTORE_FILE=/Users/<you>/keys/pasalmanager-upload.jks
RELEASE_KEYSTORE_PASSWORD=<store password>
RELEASE_KEY_ALIAS=pasalmanager
RELEASE_KEY_PASSWORD=<key password>
```

`.env.local` wins over `.env.production`. The build prints a warning if the API address still looks like a dev server.

### Backend

Deploy `backendformagemyshop` first, then run `yarn migrate` on the server. Set these on the server:

```sh
PUBLIC_APP_NAME=PasalManager
PUBLIC_SUPPORT_EMAIL=<support email>
```

Check that these open in a browser — Play Console needs both links:

- `https://api.yoursfriend.com/privacy`
- `https://api.yoursfriend.com/delete-account`

## 2. Every release

1. Bump the version in `app.json`: `expo.android.versionCode` **must go up by 1** on every upload; `expo.version` is what users see (for example 1.0.1).
2. Check the code:
   ```sh
   npm run verify
   ```
3. Build:
   ```sh
   # For Play Console (signed bundle, needs the upload key)
   npm run build:android-aab
   # → android/app/build/outputs/bundle/release/app-release.aab

   # For testing on a phone (signed with the upload key if set, else the debug key)
   npm run build:android-apk
   # → android/app/build/outputs/apk/release/app-release.apk
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```
4. Upload the `.aab` in Play Console → Test and release → the track you want → Create new release.

## 3. Play Console answers

### App access

The app needs a login. Give reviewers a working demo account (email + password) with some sample data, or the review will be rejected.

### Ads

No, the app has no ads.

### Account deletion

- Can users create an account? **Yes**
- Delete account URL: `https://api.yoursfriend.com/delete-account`
- In-app path: More → Settings → Delete account

### Data safety

Data is encrypted in transit: **Yes**. Users can request deletion: **Yes**. Data is not sold or shared for advertising.

| Data type | Collected | Why | Optional |
|---|---|---|---|
| Name, email, phone | Yes | Account management | Phone is optional |
| Photos | Yes | App functionality (product, receipt, profile photos) | Yes |
| Contacts | Yes | App functionality (only the contact the user picks as a party) | Yes |
| Approximate + precise location | Yes | App functionality (staff attendance check-in) | Yes |
| Purchase history / financial info | Yes | App functionality (the user's own business and money records) | No |
| Other user-generated content (notes and Pekka questions) | Yes | App functionality | Yes |
| Voice/audio | Check the device/browser speech provider’s processing before submitting | Optional voice input; microphone starts only on tap, recording files are not retained by PM | Yes |

Pekka’s speech provider can send audio off-device. The privacy page explains this and the app shows a notice beside the microphone. Verify the final Data safety answers against the services enabled in the signed build; do not submit this draft blindly.

Review data sharing against the deployed hosting, speech recognition and payment providers. Service-provider exclusions depend on actual processing arrangements.

### Other forms

- **Target audience:** 18 and over.
- **Content rating:** fill the questionnaire; no violence, gambling or user-to-user chat, so it should come out as "Everyone".
- **Financial features:** do not automatically select “no financial features.” PM includes coins/rewards and a shares/portfolio screen. Check the actual released features against Google’s [financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en), including rewards/incentives and portfolio management.
- **Subscription billing:** the Android app hides manual bank/payment instructions in Owner Tools. Web keeps them. Do not add paid digital subscriptions or external checkout links to the Play build without implementing a permitted billing approach; [Google’s payment policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en) covers business software subscriptions.
- **Government app:** No. **News app:** No. **Health:** No.

## 4. Store listing (drafts)

- **App name (30 max):** PasalManager: Shop & Money
- **Short description (80 max):** Shop billing, stock, parties & expenses. Personal income, expenses & budgets.
- **Full description:**

  > PasalManager helps shop owners in Nepal run their business from their phone, and helps anyone keep track of their own money.
  >
  > For your shop
  > • Quick billing and sales with printable and shareable invoices
  > • Stock and inventory with low-stock alerts
  > • Purchases, expenses and services in one place
  > • Parties: see who owes you and who you owe
  > • Staff with their own logins and permissions
  > • Works offline and syncs when you are back online
  >
  > For your personal money
  > • Track income and expenses in seconds
  > • Budgets that show how much you can safely spend each day
  > • Reminders and notes
  > • Nepali (BS) dates and Nepali language
  >
  > Your data stays yours: delete your account any time from Settings.

- **Graphics:** 512×512 icon, 1024×500 feature graphic, and at least 2 phone screenshots (4–8 recommended: Home, POS, Inventory, Parties, Money, Budgets).

## 5. Release order

1. **Internal testing** — upload the AAB, add your own Gmail, install from the Play link, run the checks below.
2. **Closed testing** — new personal developer accounts must run a closed test with **12+ testers for 14 days** before applying for production access; approval is not automatic. This means Monday can be a testing launch, but a brand-new personal account cannot promise a Monday public release. [Google testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).
3. **Production** — roll out to 10–20% first, watch crashes in Play Console → Quality, then 100%.

### Phone checks before production

- Sign up, sign in, sign out.
- Personal: add income and expense, add a budget, add a party payment.
- Shop: POS sale, purchase, expense, service job, stock change, print an invoice.
- Set a reminder 2 minutes ahead, close the app, tap the notification when it arrives.
- Settings → Delete account on a test account; confirm you cannot sign in again.

### Pekka and final phone checks

- Build a new native app after installing `expo-speech-recognition`; an old APK or Expo Go cannot verify the new native module.
- Grant and deny microphone access. Test English and Nepali voice on a real phone. Confirm closing Pekka or backgrounding the app stops listening. Review the transcript before sending.
- Ask a known item’s price, a misspelled item name, two contacts with the same name, a contact who owes you, and one you owe. Confirm staff cannot read features they lack permission for.
- Confirm Personal’s introduction/tour stays about money, contacts, budgets and notes; business shows its shop tools.
- Confirm saving a bill/payment refreshes Banks, Ledger and Home. Test offline entry sync; no unverified money coins are granted locally.
- Keep LLM provider keys on the backend when adding advice later. The current Pekka endpoint uses controlled record lookups; it does not call an LLM or provide generated financial advice.
- Current Android build script targets `arm64-v8a`. Verify the intended device coverage before claiming support for other architectures.
