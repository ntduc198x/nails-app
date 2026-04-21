import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const envFile = path.join(rootDir, ".env.local");

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

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const entries = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

const envFromFile = parseDotEnvFile(envFile);
const readValue = (key) => process.env[key] ?? envFromFile[key] ?? "";

const missingKeys = requiredKeys.filter((key) => !readValue(key));
const legacyOnlyKeys = legacyKeys.filter((key) => readValue(key));

if (!fs.existsSync(envFile)) {
  console.error("Missing .env.local at repo root. Create it before running the mobile Android lane.");
  process.exit(1);
}

console.log("Mobile env contract check");
for (const key of requiredKeys) {
  console.log(`${readValue(key) ? "OK " : "MISS"} ${key}`);
}

if (missingKeys.length > 0) {
  console.error("");
  console.error("The mobile app reads EXPO_PUBLIC_* keys only. Add the missing keys to .env.local.");
  if (legacyOnlyKeys.length > 0) {
    console.error("Legacy web env keys detected, but they are not sufficient for Expo mobile runtime:");
    for (const key of legacyOnlyKeys) {
      console.error(`- ${key}`);
    }
  }
  process.exit(1);
}

console.log("");
console.log("Android shell variables expected in the shell that launches Expo/Gradle:");
console.log("- ANDROID_HOME");
console.log("- ANDROID_SDK_ROOT");
console.log("- %ANDROID_SDK_ROOT%\\platform-tools on PATH");
