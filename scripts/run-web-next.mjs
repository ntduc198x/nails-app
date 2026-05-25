import path from "node:path";
import { spawn } from "node:child_process";
import { getMergedEnv, repoRoot } from "./shared-env.mjs";

const webDir = path.resolve(repoRoot, "apps", "web");
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const command = process.argv[2] ?? "dev";
// Turbopack can spawn runaway PostCSS workers on Windows in this repo.
const nextArgs = process.platform === "win32" && command === "dev"
  ? [command, "--webpack"]
  : [command];

const env = {
  ...getMergedEnv(process.env),
  LANG: process.env.LANG || "C.UTF-8",
  LC_ALL: process.env.LC_ALL || "C.UTF-8",
  PYTHONIOENCODING: "utf-8",
};

function exitWithChildCode(code, signal) {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
}

if (process.platform === "win32") {
  const utf8Bootstrap = [
    "$utf8 = [System.Text.UTF8Encoding]::new($false)",
    "[Console]::InputEncoding = $utf8",
    "[Console]::OutputEncoding = $utf8",
    "$OutputEncoding = $utf8",
    "chcp 65001 > $null",
    `node "${nextBin}" ${nextArgs.join(" ")}`,
  ].join("; ");

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", utf8Bootstrap],
    { cwd: webDir, stdio: "inherit", env },
  );

  child.on("exit", exitWithChildCode);
} else {
  const child = spawn(process.execPath, [nextBin, ...nextArgs], {
    cwd: webDir,
    stdio: "inherit",
    env,
  });

  child.on("exit", exitWithChildCode);
}
