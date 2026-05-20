import fs from "node:fs";
import path from "node:path";

export function resolveJavaHome() {
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

export function getJavaBinPath(javaHome) {
  return javaHome ? path.join(javaHome, "bin") : null;
}
