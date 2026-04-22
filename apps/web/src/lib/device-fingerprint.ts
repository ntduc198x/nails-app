export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
}

export async function getDeviceFingerprint(): Promise<string> {
  const info = await getDeviceInfo();
  const raw = [
    info.userAgent,
    info.screen,
    info.timezone,
    info.language,
    info.platform,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    fingerprint: '',
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
  };
}
