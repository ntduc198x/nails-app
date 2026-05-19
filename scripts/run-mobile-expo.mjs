import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import {
  getMergedEnv,
  mobileDir,
  repoRoot,
  syncMobileEnvLocalFromRoot,
} from "./shared-env.mjs";

const expoCliPath = path.resolve(repoRoot, "node_modules", "expo", "bin", "cli");

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
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
const mergedEnv = getMergedEnv(process.env);
const { derived: mobilePublicEnv } = syncMobileEnvLocalFromRoot(mergedEnv);

function hasExplicitPort(args) {
  return args.includes("--port") || args.some((arg) => arg.startsWith("--port="));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function resolveExpoArgs() {
  const args = [...rawArgs];
  const command = args[0];

  if (command !== "start" || hasExplicitPort(args)) {
    return args;
  }

  const preferredPorts = [8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8090];
  for (const port of preferredPorts) {
    // Preselect a free non-default port so Expo never prompts in non-interactive shells.
    if (await isPortAvailable(port)) {
      console.log(`Using Expo dev server port ${port}.`);
      return [...args, "--port", String(port)];
    }
  }

  return args;
}

const expoArgs = await resolveExpoArgs();

const child = spawn(process.execPath, [expoCliPath, ...expoArgs], {
  cwd: mobileDir,
  stdio: "inherit",
  env: {
    ...mergedEnv,
    ...mobilePublicEnv,
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    EXPO_ROUTER_APP_ROOT: mergedEnv.EXPO_ROUTER_APP_ROOT ?? "app",
    ...(javaBinPath ? { Path: `${mergedEnv.Path ?? ""};${javaBinPath}` } : {}),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
