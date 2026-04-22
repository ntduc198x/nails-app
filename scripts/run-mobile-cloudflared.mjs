import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileDir = path.resolve(__dirname, "..", "apps", "mobile");
const expoCliPath = path.resolve(__dirname, "..", "node_modules", "expo", "bin", "cli");
const port = 8083;
const outputPath = path.resolve(__dirname, "..", "tmp", "mobile-cloudflare-url.txt");
let expo;
let cloudflared;
let announcedUrl = false;
let restartingExpo = false;

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

function waitForPort(targetPort, timeoutMs = 120000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port: targetPort });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for Metro on port ${targetPort}.`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

const javaHome = resolveJavaHome();
const javaBinPath = javaHome ? path.join(javaHome, "bin") : null;

function startExpo(proxyUrl = "") {
  const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
  const memoryFlag = "--max-old-space-size=8192";
  const nodeOptions = existingNodeOptions.includes(memoryFlag)
    ? existingNodeOptions
    : `${existingNodeOptions} ${memoryFlag}`.trim();

  const child = spawn(
    process.execPath,
    [expoCliPath, "start", "--clear", "--port", String(port)],
    {
      cwd: mobileDir,
      stdio: ["inherit", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(javaHome ? { JAVA_HOME: javaHome } : {}),
        NODE_OPTIONS: nodeOptions,
        EXPO_ROUTER_APP_ROOT: process.env.EXPO_ROUTER_APP_ROOT ?? "app",
        ...(proxyUrl ? { EXPO_PACKAGER_PROXY_URL: proxyUrl } : {}),
        ...(javaBinPath ? { Path: `${process.env.Path ?? ""};${javaBinPath}` } : {}),
      },
    },
  );

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  child.on("exit", (code) => {
    if (restartingExpo) {
      return;
    }
    if (cloudflared && !cloudflared.killed) {
      cloudflared.kill();
    }
    process.exit(code ?? 0);
  });

  return child;
}

function shutdown(code = 0) {
  if (cloudflared && !cloudflared.killed) {
    cloudflared.kill();
  }
  if (!expo.killed) {
    expo.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
expo = startExpo();
try {
  await waitForPort(port);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}

cloudflared = spawn("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"], {
  cwd: mobileDir,
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

const announceTunnelUrl = async (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (announcedUrl) {
    return;
  }

  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (!match) {
    return;
  }

  announcedUrl = true;
  const httpsUrl = match[0];
  const expoGoUrl = httpsUrl.replace(/^https:\/\//i, "exps://");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${expoGoUrl}\n`, "utf8");

  restartingExpo = true;
  const previousExpo = expo;
  previousExpo.kill();
  await new Promise((resolve) => previousExpo.once("exit", resolve));
  expo = startExpo(httpsUrl);
  await waitForPort(port);
  restartingExpo = false;

  console.log("");
  console.log("Cloudflared tunnel ready for Expo Go:");
  console.log(expoGoUrl);
  console.log("");
  console.log("Open Expo Go on iPhone and paste/open this URL if QR scan is inconvenient.");
}

cloudflared.stdout.on("data", (chunk) => {
  void announceTunnelUrl(chunk);
});
cloudflared.stderr.on("data", (chunk) => {
  void announceTunnelUrl(chunk);
});

cloudflared.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`cloudflared exited with code ${code}.`);
    shutdown(code);
  }
});
