import { Platform } from "react-native";
import { safeStorage } from "./safe-storage";

const DEVICE_FINGERPRINT_KEY = "nails-mobile-device-fingerprint";

function createRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getMobileDeviceFingerprint() {
  const existing = await safeStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = `mobile-${Platform.OS}-${createRandomId()}`;
  await safeStorage.setItem(DEVICE_FINGERPRINT_KEY, nextValue);
  return nextValue;
}

export async function getMobileDeviceInfo() {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    appChannel: "expo-mobile",
  };
}
