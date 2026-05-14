import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..");
export const mobileDir = path.resolve(repoRoot, "apps", "mobile");

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function getRootEnvEntries() {
  return {
    ...parseEnvFile(path.join(repoRoot, ".env")),
    ...parseEnvFile(path.join(repoRoot, ".env.local")),
  };
}

function getMobileEnvEntries() {
  return {
    ...parseEnvFile(path.join(mobileDir, ".env")),
    ...parseEnvFile(path.join(mobileDir, ".env.local")),
  };
}

export function getMergedEnv(baseEnv = process.env) {
  return {
    ...getRootEnvEntries(),
    ...getMobileEnvEntries(),
    ...baseEnv,
  };
}

export function getDerivedMobilePublicEnv(sourceEnv = process.env) {
  const mergedEnv = getMergedEnv(sourceEnv);

  return {
    EXPO_PUBLIC_SUPABASE_URL:
      mergedEnv.EXPO_PUBLIC_SUPABASE_URL || mergedEnv.NEXT_PUBLIC_SUPABASE_URL || "",
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      mergedEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    EXPO_PUBLIC_API_BASE_URL:
      mergedEnv.EXPO_PUBLIC_API_BASE_URL || mergedEnv.NEXT_PUBLIC_APP_URL || "",
    EXPO_PUBLIC_PASSWORD_RESET_URL:
      mergedEnv.EXPO_PUBLIC_PASSWORD_RESET_URL ||
      (mergedEnv.NEXT_PUBLIC_APP_URL ? `${mergedEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/reset-password` : ""),
  };
}

export function syncMobileEnvLocalFromRoot(sourceEnv = process.env) {
  const derived = getDerivedMobilePublicEnv(sourceEnv);
  const targetPath = path.join(mobileDir, ".env.local");
  const content = [
    "EXPO_ROUTER_APP_ROOT=app",
    ...Object.entries(derived).map(([key, value]) => `${key}=${value}`),
    "",
  ].join("\n");

  const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  if (currentContent !== content) {
    fs.writeFileSync(targetPath, content, "utf8");
  }

  return { targetPath, derived };
}
