const OFFLINE_STORAGE_KEY = "laturaivo_force_offline";

/**
 * Online mode is enabled by default.
 * You can override at runtime from devtools:
 * localStorage.setItem('laturaivo_force_offline', '0') // online
 * localStorage.setItem('laturaivo_force_offline', '1') // offline
 */
export function isOfflineModeEnabled(): boolean {
  try {
    const override = window.localStorage?.getItem(OFFLINE_STORAGE_KEY);
    if (override === "0") return false;
    if (override === "1") return true;
  } catch {
    // Ignore storage access issues and keep safe default.
  }
  return false;
}
