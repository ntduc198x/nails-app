import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileDir = path.resolve(__dirname, "..", "apps", "mobile");
const expoCliPath = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Missing Expo CLI arguments.");
  process.exit(1);
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const candidates = process.platform === "win32"
    ? [
        "D:\\Program Files\\Android\\Android Studio\\jbr",
        "C:\\Program Files\\Android\\Android Studio\\jbr",
        "D:\\Program Files\\Android\\Android Studio\\jre",
        "C:\\Program Files\\Android\\Android Studio\\jre",
      ]
    : [];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

const javaHome = resolveJavaHome();
const javaBinPath = javaHome ? path.join(javaHome, "bin") : null;

const child = spawn(process.execPath, [expoCliPath, ...args], {
  cwd: mobileDir,
  stdio: "inherit",
  env: {
    ...process.env,
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    EXPO_ROUTER_APP_ROOT: process.env.EXPO_ROUTER_APP_ROOT ?? "app",
    ...(javaBinPath ? { Path: `${process.env.Path ?? ""};${javaBinPath}` } : {}),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
