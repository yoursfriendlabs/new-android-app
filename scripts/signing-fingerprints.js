#!/usr/bin/env node
/**
 * Prints the SHA-1 fingerprints Google Cloud needs for "Continue with Google".
 *
 * Google only hands an ID token to an app it recognises, and it recognises an
 * Android app by package name plus the SHA-1 of the certificate that signed the
 * running build. Register the wrong one (or none) and every attempt fails with
 * DEVELOPER_ERROR, which no amount of app code can recover from.
 *
 * There are up to three certificates in play, and each needs its own Android
 * OAuth client in the same Cloud project as the web client ID:
 *   - debug     for `expo run:android` on your machine
 *   - upload    for an APK built by scripts/build-android.js
 *   - Play      for anything installed from Play, which re-signs with its own
 *               key (Play Console > Test and release > App integrity)
 *
 * Usage:
 *   node scripts/signing-fingerprints.js
 *   RELEASE_KEYSTORE_FILE=... RELEASE_KEYSTORE_PASSWORD=... RELEASE_KEY_ALIAS=... \
 *     node scripts/signing-fingerprints.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', '.env.production', '.env']) {
    const filePath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
      if (env[match[1]] === undefined) env[match[1]] = value;
    }
  }
  return env;
}

function readFingerprint({ keystore, storepass, alias }) {
  const args = ['-list', '-v', '-keystore', keystore, '-storepass:env', 'PM_KEYSTORE_PASSWORD'];
  if (alias) args.push('-alias', alias);
  const output = execFileSync('keytool', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PM_KEYSTORE_PASSWORD: storepass },
  });
  const sha1 = /SHA1:\s*([0-9A-F:]+)/i.exec(output);
  const sha256 = /SHA256:\s*([0-9A-F:]+)/i.exec(output);
  return { sha1: sha1 && sha1[1], sha256: sha256 && sha256[1] };
}

function report(label, hint, config) {
  if (!config.keystore || !fs.existsSync(config.keystore)) {
    console.log(`\n${label}: keystore not found${config.keystore ? ` at ${config.keystore}` : ''}`);
    if (hint) console.log(`  ${hint}`);
    return;
  }
  try {
    const { sha1, sha256 } = readFingerprint(config);
    console.log(`\n${label}  (${config.keystore})`);
    console.log(`  SHA-1  : ${sha1 || 'not found in keytool output'}`);
    if (sha256) console.log(`  SHA-256: ${sha256}`);
  } catch {
    console.log(`\n${label}: could not read it. Check Java, the keystore path, alias and password.`);
    if (hint) console.log(`  ${hint}`);
  }
}

const env = loadEnv();
const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app.json'), 'utf8'));

console.log('Google sign-in needs these registered in Google Cloud > Credentials,');
console.log('as an Android OAuth client, in the same project as the web client ID.');
console.log(`\nPackage name   : ${appJson.expo.android.package}`);
console.log(`Web client ID  : ${env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '(not set)'}`);

const projectDebugKey = path.resolve(__dirname, '..', 'android', 'app', 'debug.keystore');

report('Debug key   (expo run:android)', 'Build the app once with `expo run:android` to create it.', {
  keystore: fs.existsSync(projectDebugKey) ? projectDebugKey : path.join(os.homedir(), '.android', 'debug.keystore'),
  storepass: 'android',
  alias: 'androiddebugkey',
});

report('Upload key  (local release build)', 'Set RELEASE_KEYSTORE_FILE, RELEASE_KEYSTORE_PASSWORD and RELEASE_KEY_ALIAS.', {
  keystore: env.RELEASE_KEYSTORE_FILE
    ? (env.RELEASE_KEYSTORE_FILE.startsWith('~/')
      ? path.join(os.homedir(), env.RELEASE_KEYSTORE_FILE.slice(2))
      : path.resolve(__dirname, '..', env.RELEASE_KEYSTORE_FILE))
    : '',
  storepass: env.RELEASE_KEYSTORE_PASSWORD || '',
  alias: env.RELEASE_KEY_ALIAS || '',
});

console.log('\nPlay signing key (anything installed from Play)');
console.log('  Play re-signs your upload with its own key, so this fingerprint is');
console.log('  different from the upload one above and must also be registered.');
console.log('  Copy it from Play Console > Test and release > App integrity >');
console.log('  App signing key certificate > SHA-1 certificate fingerprint.');
console.log('');
