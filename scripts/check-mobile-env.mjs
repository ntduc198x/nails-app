import fs from "node:fs";
import path from "node:path";
import { getDerivedMobilePublicEnv, getMergedEnv, repoRoot, syncMobileEnvLocalFromRoot } from "./shared-env.mjs";

const rootDir = process.cwd();
const envFile = path.join(repoRoot, ".env.local");

const requiredKeys = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_PASSWORD_RESET_URL",
];

const legacyKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const mergedEnv = getMergedEnv(process.env);
const derivedMobileEnv = getDerivedMobilePublicEnv(mergedEnv);
const readValue = (key) => derivedMobileEnv[key] ?? mergedEnv[key] ?? "";

const missingKeys = requiredKeys.filter((key) => !readValue(key));
const legacyOnlyKeys = legacyKeys.filter((key) => readValue(key));

if (!fs.existsSync(envFile)) {
  console.error("Missing .env.local at repo root. Create it before running the mobile Android lane.");
  process.exit(1);
}

const { targetPath } = syncMobileEnvLocalFromRoot(mergedEnv);

console.log(`Mobile env contract check (${path.relative(rootDir, envFile)})`);
for (const key of requiredKeys) {
  console.log(`${readValue(key) ? "OK " : "MISS"} ${key}`);
}

if (missingKeys.length > 0) {
  console.error("");
  console.error("The mobile app reads EXPO_PUBLIC_* keys only. Add the missing keys to the repo root .env.local or their NEXT_PUBLIC_* equivalents.");
  if (legacyOnlyKeys.length > 0) {
    console.error("Legacy web env keys detected. They will be mapped for mobile only when the matching EXPO_PUBLIC_* values are absent:");
    for (const key of legacyOnlyKeys) {
      console.error(`- ${key}`);
    }
  }
  process.exit(1);
}

console.log("");
console.log(`Synced mobile env file: ${path.relative(rootDir, targetPath)}`);
if (readValue("EXPO_PUBLIC_API_BASE_URL").includes("localhost")) {
  console.warn("WARN EXPO_PUBLIC_API_BASE_URL points to localhost. Real devices and most Android emulators will not reach your Next API on that host.");
  console.warn("WARN Use a LAN IP or reachable host if the mobile app must call /api/customer/* endpoints directly.");
}
console.log("Android shell variables expected in the shell that launches Expo/Gradle:");
console.log("- ANDROID_HOME");
console.log("- ANDROID_SDK_ROOT");
console.log("- %ANDROID_SDK_ROOT%\\platform-tools on PATH");
