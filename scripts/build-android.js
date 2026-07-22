const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment variables from .env files
function loadEnv() {
  const envFiles = ['.env.local', '.env.production', '.env'];
  const env = { ...process.env };
  
  for (const file of envFiles) {
    const filePath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          if (env[key] === undefined) {
            env[key] = value.trim();
          }
        }
      });
    }
  }
  return env;
}

const env = loadEnv();

// Detect Java 17 Home
let javaHome;
try {
  javaHome = execSync('/usr/libexec/java_home -v 17', { encoding: 'utf8' }).trim();
} catch (e) {
  console.log('Warning: Java 17 not found via java_home. Using system default Java.');
}

if (javaHome) {
  console.log(`Setting JAVA_HOME environment variable to Java 17: ${javaHome}`);
  process.env.JAVA_HOME = javaHome;
}

console.log('Starting Android release build preparation...');

// 1. Run expo prebuild
console.log('Running expo prebuild...');
execSync('npx expo prebuild --platform android --clean', { stdio: 'inherit' });

// Configure local.properties with Android SDK location
const localPropertiesPath = path.resolve(__dirname, '..', 'android', 'local.properties');
const macSdkPath = path.join(os.homedir(), 'Library', 'Android', 'sdk');
if (fs.existsSync(macSdkPath)) {
  fs.writeFileSync(localPropertiesPath, `sdk.dir=${macSdkPath}\n`, 'utf8');
  console.log(`Configured Android SDK location: ${macSdkPath}`);
} else {
  console.log('Warning: Android SDK location not automatically configured. Ensure ANDROID_HOME is set.');
}

// 2. Configure gradle properties (Java 17 home & signing configs if available)
const gradlePropertiesPath = path.resolve(__dirname, '..', 'android', 'gradle.properties');
let gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');

// Limit architectures to arm64-v8a for release build to resolve compilation failures and reduce size
gradleProperties = gradleProperties.replace(/reactNativeArchitectures=.*/, 'reactNativeArchitectures=arm64-v8a');

gradleProperties += `\n`;
if (javaHome) {
  console.log(`Setting Gradle JVM (org.gradle.java.home) to Java 17: ${javaHome}`);
  gradleProperties += `org.gradle.java.home=${javaHome}\n`;
}

const keystoreFile = env.RELEASE_KEYSTORE_FILE;
const keystorePassword = env.RELEASE_KEYSTORE_PASSWORD;
const keyAlias = env.RELEASE_KEY_ALIAS;
const keyPassword = env.RELEASE_KEY_PASSWORD;

if (keystoreFile && keystorePassword && keyAlias && keyPassword) {
  console.log('Configuring signing properties for release build...');
  
  const absoluteKeystorePath = path.isAbsolute(keystoreFile)
    ? keystoreFile
    : path.resolve(__dirname, '..', keystoreFile);
    
  if (!fs.existsSync(absoluteKeystorePath)) {
    console.error(`Error: Keystore file not found at ${absoluteKeystorePath}`);
    process.exit(1);
  }
  
  // Append signing properties
  gradleProperties += `android.injected.signing.store.file=${absoluteKeystorePath}\n`;
  gradleProperties += `android.injected.signing.store.password=${keystorePassword}\n`;
  gradleProperties += `android.injected.signing.key.alias=${keyAlias}\n`;
  gradleProperties += `android.injected.signing.key.password=${keyPassword}\n`;
  
  console.log('Signing properties configured successfully.');
} else {
  console.log('Warning: Release signing environment variables not complete. Build will be signed with debug key.');
}

fs.writeFileSync(gradlePropertiesPath, gradleProperties, 'utf8');

// 3. Clean Gradle cache
console.log('Stopping Gradle daemon and clearing build cache...');
try {
  execSync('cd android && ./gradlew --stop', { stdio: 'inherit' });
} catch (e) {
  console.log('Warning: Failed to stop Gradle daemon.');
}

const appBuildDir = path.resolve(__dirname, '..', 'android', 'app', 'build');
if (fs.existsSync(appBuildDir)) {
  console.log('Manually removing app build folder to prevent lock errors...');
  try {
    fs.rmSync(appBuildDir, { recursive: true, force: true });
  } catch (e) {
    console.log('Warning: Failed to manually delete app build folder. Proceeding to gradlew clean.');
  }
}

execSync('cd android && ./gradlew clean', { stdio: 'inherit' });

// 4. Build AAB / APK
const isApk = process.argv.includes('apk');
const buildType = isApk ? 'assembleRelease' : 'bundleRelease';
console.log(`Building Android ${isApk ? 'APK' : 'AAB'} (limiting architectures to arm64-v8a for speed and stability)...`);
execSync(`cd android && ./gradlew ${buildType} -PreactNativeArchitectures=arm64-v8a`, { stdio: 'inherit' });

console.log('Android build completed successfully!');
