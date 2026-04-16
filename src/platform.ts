export interface PlatformCapabilities {
  isWeb: boolean;
  isIOS: boolean;
  isCapacitorIOS: boolean;
  isElectron: boolean;
  isSteam: boolean;
  isMobile: boolean;
  hasTouch: boolean;
  hasCoarsePointer: boolean;
  hasKeyboard: boolean;
  supportsGameCenter: boolean;
  supportsSteamServices: boolean;
  isWebReleaseBuild: boolean;
  isSteamBuild: boolean;
}

interface DesktopRuntimeBridge {
  isElectron?: boolean;
  isSteam?: boolean;
  platform?: string;
}

const getNavigator = (): Navigator | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return navigator;
};

export const isIOSLike = (): boolean => {
  const nav = getNavigator();
  if (!nav) return false;

  const ua = nav.userAgent || "";
  const platform = nav.platform || "";
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOSDesktopUA = platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1;
  return (isClassicIOS || isIPadOSDesktopUA) && !(window as any).MSStream;
};

export const isCapacitorNativePlatform = (): boolean => {
  try {
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;
  } catch {
    // Fall through to protocol detection.
  }

  try {
    return window.location.protocol === "capacitor:";
  } catch {
    return false;
  }
};

export const isCapacitorIOS = (): boolean => {
  if (!isCapacitorNativePlatform()) return false;

  try {
    const platform = (window as any).Capacitor?.getPlatform?.();
    if (platform) return platform === "ios";
  } catch {
    // Fall through to iOS UA detection.
  }

  return isIOSLike();
};

const hasCoarsePointer = (): boolean => {
  try {
    return window.matchMedia?.("(pointer: coarse)")?.matches === true;
  } catch {
    return false;
  }
};

export const hasTouchInput = (): boolean => {
  const nav = getNavigator();
  return hasCoarsePointer() || (nav?.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
};

export const isMobileWebRuntime = (): boolean => {
  const nav = getNavigator();
  const ua = nav?.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (isIOSLike()) return true;

  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return hasTouchInput() && shortSide > 0 && shortSide < 700;
};

export const isWebReleaseBuild = (): boolean => {
  return import.meta.env.VITE_LATURAIVO_WEB_RELEASE === "1";
};

export const isSteamBuild = (): boolean => {
  return import.meta.env.VITE_LATURAIVO_STEAM === "1";
};

const getDesktopRuntimeBridge = (): DesktopRuntimeBridge | undefined => {
  try {
    return (window as unknown as { laturaivoDesktop?: DesktopRuntimeBridge }).laturaivoDesktop;
  } catch {
    return undefined;
  }
};

export const isElectronRuntime = (): boolean => {
  const bridge = getDesktopRuntimeBridge();
  return bridge?.isElectron === true || /Electron/i.test(getNavigator()?.userAgent || "");
};

export const isSteamRuntime = (): boolean => {
  const bridge = getDesktopRuntimeBridge();
  return bridge?.isSteam === true || isSteamBuild();
};

export const getPlatformCapabilities = (): PlatformCapabilities => {
  const ios = isIOSLike();
  const capacitorIOS = isCapacitorIOS();
  const electron = isElectronRuntime();
  const steam = isSteamRuntime();
  const touch = hasTouchInput();
  const coarse = hasCoarsePointer();
  const mobile = capacitorIOS || isMobileWebRuntime();

  return {
    isWeb: !isCapacitorNativePlatform(),
    isIOS: ios,
    isCapacitorIOS: capacitorIOS,
    isElectron: electron,
    isSteam: steam,
    isMobile: mobile,
    hasTouch: touch,
    hasCoarsePointer: coarse,
    hasKeyboard: !coarse || !mobile,
    supportsGameCenter: capacitorIOS,
    supportsSteamServices: steam,
    isWebReleaseBuild: isWebReleaseBuild(),
    isSteamBuild: isSteamBuild()
  };
};

export const resolvePlatformVideoUrl = (url: string): string => {
  if (!isWebReleaseBuild() || isCapacitorIOS()) return url;
  return url.replace(/\.mov($|\?)/i, ".mp4$1");
};

export const shouldIgnoreKeyboardEvent = (event: KeyboardEvent): boolean => {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;

  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  return target.isContentEditable === true;
};
