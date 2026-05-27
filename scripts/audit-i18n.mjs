import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const targets = [
  "apps/mobile/app/(customer)",
  "apps/mobile/app/(auth)",
  "apps/mobile/src/features/customer",
  "apps/web/src/app",
  "apps/web/src/components/landing",
];
const customerMobileTargets = [
  "apps/mobile/app/(customer)",
  "apps/mobile/src/features/customer",
];
const adminMobileTargets = [
  "apps/mobile/app/(admin)",
  "apps/mobile/src/features/admin",
];

const ignoredPathParts = [
  `${join("apps", "web", "src", "app", "manage")}${join("", "")}`,
  `${join("apps", "mobile", "app", "(admin)")}${join("", "")}`,
  `${join("apps", "mobile", "src", "features", "customer", "localize.ts")}`,
  `${join("apps", "mobile", "src", "features", "customer", "data.ts")}`,
];

const filePattern = /\.(ts|tsx|js|jsx)$/;
const hardcodedLiteralPattern = /(["'`])([^"'`\n]*[A-Za-zÀ-ỹ][^"'`\n]*)\1/g;
const allowedSnippets = [
  "use client",
  "Loading...",
  "Loading",
  "CHAM BEAUTY",
  "ACCOUNT",
  "RESET PASSWORD",
  "GOOGLE",
  "USER",
  "ADMIN",
  "OWNER",
  "BOOKED",
  "CHECKED_IN",
  "IN_SERVICE",
  "DONE",
  "CANCELLED",
  "NO_SHOW",
  "NEW",
  "CONFIRMED",
  "CONVERTED",
  "EXPIRED_UNCONFIRMED",
  "NEEDS_RESCHEDULE",
];
const strictMode = process.argv.includes("--strict");
const customerMobileMode = process.argv.includes("--customer-mobile");
const adminMobileMode = process.argv.includes("--admin-mobile");

function shouldIgnoreFile(filePath) {
  return ignoredPathParts.some((part) => filePath.includes(part));
}

function walk(dirPath, results = []) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, results);
      continue;
    }

    if (!filePattern.test(fullPath) || shouldIgnoreFile(fullPath)) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function isAllowedLiteral(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (allowedSnippets.includes(trimmed)) return true;
  if (/^[A-Z0-9_ -]+$/.test(trimmed)) return true;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return true;
  if (/^rgba?\(/i.test(trimmed)) return true;
  if (/^(center|row|column|wrap|hidden|relative|absolute|space-between|flex-start|flex-end|stretch|top|bottom|left|right|default|spinner|fade|button|text|email|calendar|clock|heart|shield|star|tag|navigation|search|award|hexagon|zap|briefcase|phone|camera|avatar|ios|android|dismissed|none|tel|lazy)$/i.test(trimmed)) return true;
  if (/^[a-z_]+(,[a-z_]+)+$/i.test(trimmed)) return true;
  if (/^[a-z0-9_.:/?#=&-]+$/i.test(trimmed) && !/\s/.test(trimmed)) return true;
  if (/^https?:\/\//.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true;
  if (trimmed === "\\n") return true;
  if (trimmed.includes("replace(/[") || trimmed.includes(")[0]?.trim()")) return true;
  if (trimmed === "not found") return true;
  if (trimmed.includes("normalized.includes(")) return true;
  if (trimmed.includes("{") || trimmed.includes("}")) return true;
  return false;
}

const findings = [];

const activeTargets = customerMobileMode
  ? customerMobileTargets
  : adminMobileMode
    ? adminMobileTargets
    : targets;

for (const target of activeTargets) {
  const dirPath = join(rootDir, target);
  for (const filePath of walk(dirPath)) {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (
        trimmedLine.startsWith("import ") ||
        trimmedLine.startsWith("export ") ||
        trimmedLine.includes(" from ") ||
        trimmedLine.includes("console.error(") ||
        trimmedLine.includes("<Tabs.Screen") ||
        trimmedLine.includes("<Stack.Screen") ||
        trimmedLine.includes("className=") ||
        trimmedLine.includes("style=") ||
        trimmedLine.includes("normalized.includes(") ||
        trimmedLine.includes("source.uri?.trim() ??") ||
        trimmedLine.includes("targetHref.replace(") ||
        trimmedLine.includes("pathname === ") ||
        trimmedLine.includes(".select(") ||
        trimmedLine.includes(".includes(\"lên hạng\")") ||
        trimmedLine.includes(".includes('lên hạng')") ||
        trimmedLine.includes("password:") ||
        trimmedLine.includes("confirmPassword:") ||
        trimmedLine.includes(": value ??") ||
        trimmedLine.includes("fontWeight:") ||
        trimmedLine.includes("textAlign:") ||
        trimmedLine.includes("letterSpacing:") ||
        trimmedLine.includes("textTransform:") ||
        trimmedLine.includes("aspectRatio:") ||
        trimmedLine.includes("maxHeight:") ||
        trimmedLine.includes("icon:") ||
        trimmedLine.includes("roleLabel:") ||
        trimmedLine.includes("avatarUrl:") ||
        trimmedLine.includes("bio:") ||
        trimmedLine.includes("displayOrder:") ||
        trimmedLine.includes("does not exist") ||
        trimmedLine.includes("could not find the table") ||
        trimmedLine.includes("schema cache")
      ) {
        return;
      }

      if (
        line.includes("translate(") ||
        line.includes("useCustomerStrings(") ||
        line.includes("useAdminStrings(") ||
        line.includes("strings.")
      ) {
        return;
      }

      let match;
      while ((match = hardcodedLiteralPattern.exec(line)) !== null) {
        const literal = match[2];
        if (isAllowedLiteral(literal)) {
          continue;
        }

        findings.push({
          file: relative(rootDir, filePath),
          line: index + 1,
          literal: literal.trim(),
        });
      }
    });
  }
}

if (findings.length) {
  const printer = strictMode ? console.error : console.warn;
  printer("i18n audit found potential hardcoded user-facing strings:\n");
  for (const finding of findings) {
    printer(`- ${finding.file}:${finding.line} -> ${finding.literal}`);
  }
  if (strictMode) {
    process.exit(1);
  }
  console.warn(
    `\nAudit completed in advisory mode. Re-run with \`npm run i18n:audit -- ${customerMobileMode ? "--customer-mobile " : adminMobileMode ? "--admin-mobile " : ""}--strict\` to fail on findings.`,
  );
  process.exit(0);
}

console.log("i18n audit passed.");
