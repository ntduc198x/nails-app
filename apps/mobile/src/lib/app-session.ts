import { safeStorage } from "./safe-storage";

const APP_SESSION_TOKEN_KEY = "nails-mobile-app-session-token";

export async function getStoredAppSessionToken() {
  return safeStorage.getItem(APP_SESSION_TOKEN_KEY);
}

export async function setStoredAppSessionToken(token: string) {
  await safeStorage.setItem(APP_SESSION_TOKEN_KEY, token);
}

export async function clearStoredAppSessionToken() {
  await safeStorage.removeItem(APP_SESSION_TOKEN_KEY);
}
