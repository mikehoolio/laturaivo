import Phaser from "phaser";
import { screenSize, debugConfig, renderConfig } from "./gameConfig.json";
import "./styles/tailwind.css";
import { Preloader } from "./scenes/Preloader";
import { applyGameMasterVolumeToSoundManager, ensureSceneAudioReady, isSfxAllowed, pickPreferredAudioUrl } from "./utils";
import { getPlatformCapabilities } from "./platform";

declare global {
  interface Window {
    isLowPowerMode?: boolean;
    __laturaivoBooted?: boolean;
    __laturaivoDeviceProfile?: {
      isMobile: boolean;
      isIOS: boolean;
      isCapacitorIOS: boolean;
      isLowEndMobile: boolean;
      hasTouch: boolean;
      hasKeyboard: boolean;
      lowPowerMode: boolean;
      resolution: number;
      fpsTarget: number;
      physicsFps: number;
      qualityTier: "high" | "medium" | "low";
    };
  }
}

const platform = getPlatformCapabilities();
const isMobile = platform.isMobile;
const isIOS = platform.isIOS;
const IOS_AUDIO_BACKEND_KEY = "laturaivo_ios_audio_backend";
const IOS_AUDIO_BACKEND_SWITCH_GUARD_KEY = "laturaivo_ios_audio_backend_switch_guard";
const IOS_AUDIO_BACKEND_PREF_VERSION_KEY = "laturaivo_ios_audio_backend_pref_version";
const IOS_AUDIO_BACKEND_PREF_VERSION = "2";
type IOSAudioBackend = "webaudio" | "html5";

const normalizeIOSAudioBackendPreference = (): void => {
  if (!isIOS) return;
  try {
    const prefVersion = window.localStorage?.getItem(IOS_AUDIO_BACKEND_PREF_VERSION_KEY);
    if (prefVersion !== IOS_AUDIO_BACKEND_PREF_VERSION) {
      // Reset old persisted iOS HTML5 fallback so fresh builds retry WebAudio first.
      window.localStorage?.setItem(IOS_AUDIO_BACKEND_KEY, "webaudio");
      window.localStorage?.setItem(IOS_AUDIO_BACKEND_PREF_VERSION_KEY, IOS_AUDIO_BACKEND_PREF_VERSION);
    }
  } catch {
    // Ignore storage errors and continue with runtime defaults.
  }
};

normalizeIOSAudioBackendPreference();

window.__laturaivoBooted = false;

const getStoredIOSAudioBackend = (): IOSAudioBackend => {
  if (!isIOS) return "webaudio";
  try {
    const stored = window.localStorage?.getItem(IOS_AUDIO_BACKEND_KEY);
    if (stored === "webaudio" || stored === "html5") return stored;
    return "webaudio";
  } catch {
    return "webaudio";
  }
};

const selectedIOSAudioBackend: IOSAudioBackend = getStoredIOSAudioBackend();
// Reliability-first policy for native iOS app builds:
// keep Phaser on HTML5 audio backend and route critical playback via native fallbacks.
const useHTML5AudioBackend = isIOS ? true : selectedIOSAudioBackend === "html5";

const formatUnknownError = (value: unknown): string => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

let fatalOverlayShown = false;
const showFatalErrorOverlay = (message: string): void => {
  if (fatalOverlayShown) return;
  fatalOverlayShown = true;

  try {
    const overlay = document.createElement("div");
    overlay.id = "fatal-error-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.92)";
    overlay.style.color = "#ffffff";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.padding = "24px";
    overlay.style.zIndex = "99999";
    overlay.style.fontFamily = "sans-serif";
    overlay.innerHTML = `
      <div style="max-width: 680px; text-align: center;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px;">Peli keskeytyi virheeseen</h2>
        <p style="margin: 0 0 18px 0; opacity: 0.9;">Yrita kaynnistaa peli uudelleen.</p>
        <pre style="max-height: 180px; overflow: auto; background: #111; padding: 10px; border: 1px solid #333; border-radius: 8px; text-align: left; font-size: 12px; white-space: pre-wrap;">${message.replace(/</g, "&lt;")}</pre>
        <button id="fatal-error-reload" style="margin-top: 16px; padding: 10px 16px; border-radius: 8px; border: 1px solid #777; background: #1f6feb; color: #fff; font-weight: 700;">Lataa uudelleen</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const reloadButton = document.getElementById("fatal-error-reload");
    reloadButton?.addEventListener("click", () => window.location.reload());
  } catch {
    // Ignore overlay rendering failures.
  }
};

const installGlobalErrorReporter = (): void => {
  window.addEventListener("error", (event) => {
    const detail = event.error
      ? formatUnknownError(event.error)
      : `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
    console.error(`[UnhandledError] ${detail}`);
    showFatalErrorOverlay(detail);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const detail = formatUnknownError(event.reason);
    console.error(`[UnhandledRejection] ${detail}`);
    showFatalErrorOverlay(detail);

    // iOS WebAudio may fail on certain devices/routes with:
    // "InvalidStateError: Failed to start the audio device"
    // Automatically switch to HTML5 audio backend and reload once.
    if (!isIOS || useHTML5AudioBackend) return;
    const lower = detail.toLowerCase();
    if (!lower.includes("failed to start the audio device")) return;

    try {
      const alreadySwitched =
        window.sessionStorage?.getItem(IOS_AUDIO_BACKEND_SWITCH_GUARD_KEY) === "1";
      if (alreadySwitched) return;
      window.sessionStorage?.setItem(IOS_AUDIO_BACKEND_SWITCH_GUARD_KEY, "1");
      window.localStorage?.setItem(IOS_AUDIO_BACKEND_KEY, "html5");
      console.error("[AudioBackendFallback] WebAudio failed on iOS. Switching to HTML5 backend and reloading once.");
      window.setTimeout(() => {
        window.location.reload();
      }, 120);
    } catch {
      // Ignore storage/reload fallback errors.
    }
  });
};

installGlobalErrorReporter();

const stringifyConsoleArg = (value: any): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : "";
  } catch {
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "[unprintable]";
    }
  }
};

const shouldSuppressConsoleNoise = (args: any[]): boolean => {
  let text = "";
  try {
    text = args.map(stringifyConsoleArg).join(" ");
  } catch {
    return false;
  }
  const suppressedPatterns: RegExp[] = [
    /Texture "%s" not found peter_sync_/i,
    /Cannot pause non-running Scene TitleScreen/i,
    /\[Preloader\] Missing texture "peter_sync_/i,
  ];
  return suppressedPatterns.some((pattern) => pattern.test(text));
};

const isDebugLogsEnabled = (): boolean => {
  if (import.meta.env.DEV) return true;
  try {
    return window.localStorage?.getItem("laturaivo_debug_logs") === "1";
  } catch {
    return false;
  }
};

const installConsoleNoiseFilter = (): void => {
  if (!isIOS) return;
  const debugLogsEnabled = isDebugLogsEnabled();
  const originalWarn = console.warn.bind(console);
  const originalLog = console.log.bind(console);
  const originalDebug = console.debug.bind(console);

  console.warn = (...args: any[]) => {
    let shouldSuppress = false;
    try {
      shouldSuppress = shouldSuppressConsoleNoise(args);
    } catch {
      shouldSuppress = false;
    }
    if (shouldSuppress) return;
    originalWarn(...args);
  };

  console.log = (...args: any[]) => {
    let shouldSuppress = false;
    try {
      shouldSuppress = shouldSuppressConsoleNoise(args);
    } catch {
      shouldSuppress = false;
    }
    if (shouldSuppress) return;
    originalLog(...args);
  };

  console.debug = (...args: any[]) => {
    if (!debugLogsEnabled) return;
    let shouldSuppress = false;
    try {
      shouldSuppress = shouldSuppressConsoleNoise(args);
    } catch {
      shouldSuppress = false;
    }
    if (shouldSuppress) return;
    originalDebug(...args);
  };
};

installConsoleNoiseFilter();

// Detect older iOS versions and lower-end hardware for performance scaling.
const parseIOSMajor = (): number => {
  if (!isIOS) return 0;
  const match = navigator.userAgent.match(/OS (\d+)_/i);
  return match ? Number.parseInt(match[1], 10) || 0 : 0;
};

const cpuCores = navigator.hardwareConcurrency || 4;
const memoryGb = (navigator as any).deviceMemory || 4;
const isLowPowerMode = !!window.isLowPowerMode;
const iosMajor = parseIOSMajor();
const isOlderIOS = isIOS && iosMajor > 0 && iosMajor <= 15;
const isLowEndMobile = isMobile && (cpuCores <= 4 || memoryGb <= 3 || isOlderIOS);
const maxResolution = isIOS
  ? 1.0
  : isLowEndMobile ? 1.25 : isMobile ? 1.5 : 2;
const resolution = Math.min(window.devicePixelRatio || 1, maxResolution);
const physicsFps = isIOS
  ? (isLowPowerMode ? 35 : 40)
  : isLowPowerMode ? 45 : isLowEndMobile ? 50 : isMobile ? 60 : 120;
const fpsTarget = isIOS
  ? (isLowPowerMode ? 32 : 40)
  : isLowPowerMode ? 40 : isLowEndMobile ? 45 : isMobile ? 50 : 60;
const qualityTier: "high" | "medium" | "low" = isLowPowerMode || isLowEndMobile
  ? "low"
  : isMobile || isIOS
    ? "medium"
    : "high";

const getViewportAspect = (): number => {
  const longSide = Math.max(window.innerWidth, window.innerHeight);
  const shortSide = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
  return longSide / shortSide;
};

const computeGameSize = (): { width: number; height: number } => {
  const baseHeight = screenSize.height.value;
  const baseAspect = screenSize.width.value / screenSize.height.value;
  const viewportAspect = getViewportAspect();
  const maxMobileAspect = 2.35;
  const targetAspect = isMobile
    ? Math.min(Math.max(viewportAspect, baseAspect), maxMobileAspect)
    : baseAspect;

  return {
    width: Math.round(baseHeight * targetAspect),
    height: baseHeight
  };
};

const initialGameSize = computeGameSize();
// iOS WebView can intermittently fail WebGL context creation on some devices/simulator states.
// Force Canvas renderer on iOS to avoid startup black screens from GPU context failures.
const phaserRendererType = isIOS ? Phaser.CANVAS : Phaser.AUTO;

window.__laturaivoDeviceProfile = {
  isMobile,
  isIOS,
  isCapacitorIOS: platform.isCapacitorIOS,
  isLowEndMobile,
  hasTouch: platform.hasTouch,
  hasKeyboard: platform.hasKeyboard,
  lowPowerMode: isLowPowerMode,
  resolution,
  fpsTarget,
  physicsFps,
  qualityTier
};

const config: Phaser.Types.Core.GameConfig & { resolution?: number } = {
  type: phaserRendererType,
  banner: false,
  width: initialGameSize.width,
  height: initialGameSize.height,
  backgroundColor: "#000000", // Black background to avoid visible edges
  parent: 'game-container',
  dom: {
    createContainer: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      fps: physicsFps,
      debug: debugConfig.debug.value,
      debugShowBody: debugConfig.debug.value,
      debugShowStaticBody: debugConfig.debug.value,
      debugShowVelocity: debugConfig.debug.value,
    },
  },
  pixelArt: renderConfig.pixelArt.value,
  resolution,
  // Mobile performance optimizations
  render: {
    antialias: false,
    roundPixels: true,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    batchSize: isIOS ? 768 : isLowEndMobile ? 1024 : isMobile ? 2048 : 4096,
  },
  audio: {
    // Default to WebAudio, but auto-fallback to HTML5 backend on iOS
    // if "Failed to start the audio device" is detected.
    disableWebAudio: useHTML5AudioBackend,
    noAudio: false,
  },
  fps: {
    target: fpsTarget,
    min: 25,
    forceSetTimeOut: isMobile && !isIOS,
  },
};

let game: Phaser.Game | null = null;
let iosNativeSfxBridgeInstalled = false;
let iosAudioUrlCache: Map<string, string> | null = null;
const iosActiveNativeSfx = new Set<HTMLAudioElement>();
const iosNativeSfxPool = new Map<string, HTMLAudioElement[]>();
const iosNativeSfxLastTriggerAt = new Map<string, number>();
const RUNTIME_SFX_GAIN = 1.75;
const RUNTIME_MUSIC_GAIN = 0.62;
const IOS_NATIVE_SFX_MAX_ACTIVE = 14;
const IOS_NATIVE_SFX_POOL_PER_KEY = 4;
const IOS_NATIVE_SFX_RETRIGGER_GUARD_MS = 28;

const IOS_BACKGROUND_MUSIC_KEYS = new Set<string>([
  "laturaivo_theme",
  "level_1_theme",
  "level_2_theme",
  "level_2_boss_theme",
  "level_3_theme",
  "elsa_mixdown_1",
  "level_4_theme",
  "lahti_level_4_boss_theme",
  "level_5_theme",
  "lahti_level_5_boss_theme",
  "level_6_theme",
  "level_7_theme",
  "level_8_theme",
  "level_9_theme",
  "level_10_theme",
  "level_11_theme",
  "lahti_level_2_theme",
  "lahti_level_3_theme",
  "lahti_level_4_theme",
  "lahti_level_5_theme",
  "lahti_level_6_theme",
  "lahti_level_7_theme",
  "lahti_level_8_theme",
  "lahti_level_9_theme",
  "lahti_level_10_theme",
  "lahti_story_ending_theme",
  "ice_club_arena_theme",
  "level_1_2_theme",
  "level_3_4_theme",
  "level_5_6_theme",
  "level_7_8_theme",
  "level_9_10_theme",
  "miniboss_theme",
  "final_boss_theme",
  "victory_fanfare",
  "game_over_music"
]);

const applyRuntimeAudioMix = (soundKey: string, config?: any): any => {
  const nextConfig = config && typeof config === "object" ? { ...config } : {};
  const isMusic = IOS_BACKGROUND_MUSIC_KEYS.has(soundKey);
  const gain = isMusic ? RUNTIME_MUSIC_GAIN : RUNTIME_SFX_GAIN;
  const requestedVolume = Number.isFinite(nextConfig.volume) ? Number(nextConfig.volume) : 1;
  const baseVolume = isMusic ? requestedVolume : Math.max(0.16, requestedVolume);
  nextConfig.volume = Math.max(0, Math.min(1, baseVolume * gain));
  return nextConfig;
};

const rebuildIOSAudioUrlCache = (): void => {
  if (!game) return;
  const nextCache = new Map<string, string>();
  const pack = (game.cache as any)?.json?.get?.("assetPack");
  if (!pack || typeof pack !== "object") {
    iosAudioUrlCache = nextCache;
    return;
  }

  for (const section of Object.values(pack)) {
    const files = Array.isArray((section as any)?.files) ? (section as any).files : [];
    for (const file of files) {
      if (file?.type !== "audio") continue;
      if (typeof file?.key !== "string") continue;

      const resolved = pickPreferredAudioUrl(file?.url, true);
      if (resolved) {
        nextCache.set(file.key, resolved);
      }
    }
  }

  iosAudioUrlCache = nextCache;
};

const getIOSAudioUrlForKey = (key: string): string | null => {
  if (!iosAudioUrlCache || !iosAudioUrlCache.has(key)) {
    rebuildIOSAudioUrlCache();
  }
  return iosAudioUrlCache?.get(key) || null;
};

const getOrCreateIOSNativeSfxAudio = (key: string, url: string): HTMLAudioElement => {
  let pool = iosNativeSfxPool.get(key);
  if (!pool) {
    pool = [];
    iosNativeSfxPool.set(key, pool);
  }

  const reusable = pool.find((audio) => audio.paused || audio.ended);
  if (reusable) {
    return reusable;
  }

  if (pool.length >= IOS_NATIVE_SFX_POOL_PER_KEY) {
    const fallback = pool[0];
    try {
      fallback.pause();
      fallback.currentTime = 0;
    } catch {
      // Ignore per-audio reset failures.
    }
    iosActiveNativeSfx.delete(fallback);
    return fallback;
  }

  const audio = new Audio(url);
  audio.preload = "auto";
  (audio as any).playsInline = true;
  (audio as any).webkitPlaysInline = true;

  const release = () => {
    iosActiveNativeSfx.delete(audio);
  };
  audio.addEventListener("ended", release);
  audio.addEventListener("error", release);
  audio.addEventListener("abort", release);
  audio.addEventListener("pause", () => {
    if (!audio.loop || audio.ended || audio.currentTime <= 0.001) {
      release();
    }
  });

  pool.push(audio);
  return audio;
};

const playIOSNativeSfx = (
  key: string,
  manager: any,
  config?: any,
  onPlayRejected?: (error: unknown) => void
): boolean => {
  const url = getIOSAudioUrlForKey(key);
  if (!url || manager?.mute) return false;
  if (iosActiveNativeSfx.size >= IOS_NATIVE_SFX_MAX_ACTIVE) return false;

  const now = performance.now();
  const lastAt = iosNativeSfxLastTriggerAt.get(key) ?? -Infinity;
  if (now - lastAt < IOS_NATIVE_SFX_RETRIGGER_GUARD_MS) {
    // Treat as handled to prevent excessive per-frame retriggers on iOS.
    return true;
  }
  iosNativeSfxLastTriggerAt.set(key, now);

  try {
    const audio = getOrCreateIOSNativeSfxAudio(key, url);
    audio.loop = !!config?.loop;
    audio.muted = !!manager?.mute;
    const managerVolume = typeof manager?.volume === "number" ? manager.volume : 1;
    const soundVolume = typeof config?.volume === "number" ? config.volume : 1;
    audio.volume = Math.max(0, Math.min(1, managerVolume * soundVolume));

    const rate = typeof config?.rate === "number" ? config.rate : 1;
    const detuneFactor = typeof config?.detune === "number"
      ? Math.pow(2, config.detune / 1200)
      : 1;
    audio.playbackRate = Math.max(0.25, Math.min(4, rate * detuneFactor));
    audio.currentTime = 0;
    iosActiveNativeSfx.add(audio);
    const playPromise = audio.play();
    if (playPromise && typeof (playPromise as Promise<void>).catch === "function") {
      void (playPromise as Promise<void>).catch((error) => {
        iosActiveNativeSfx.delete(audio);
        console.debug(`[NativeSfxBridge] play failed key=${key}`, error);
        try {
          onPlayRejected?.(error);
        } catch (fallbackError) {
          console.debug(`[NativeSfxBridge] fallback trigger failed key=${key}`, fallbackError);
        }
      });
    }
    return true;
  } catch (error) {
    console.debug(`[NativeSfxBridge] setup failed key=${key}`, error);
    return false;
  }
};

const installIOSNativeSfxBridge = (): void => {
  if (!game || !game.sound || iosNativeSfxBridgeInstalled) return;
  const manager: any = game.sound;
  const originalPlay = manager.play?.bind(manager);
  if (typeof originalPlay !== "function") return;

  manager.play = (key: string, config?: any): boolean => {
    const soundKey = typeof key === "string" ? key : String(key || "");
    if (!soundKey) return false;
    const isMusicKey = IOS_BACKGROUND_MUSIC_KEYS.has(soundKey);
    if (!isMusicKey && !isSfxAllowed(soundKey)) {
      return false;
    }
    const isLoopingSound = !!config?.loop;
    const mixedConfig = applyRuntimeAudioMix(soundKey, config);

    // Keep music keys on scene-specific handling to avoid duplicates.
    // Keep looped effects on Phaser manager so stopByKey/stopAll continue to work.
    // Route one-shot SFX through native bridge on iOS for reliable audibility.
    if (isIOS && !isMusicKey && !isLoopingSound) {
      const nativePlayed = playIOSNativeSfx(
        soundKey,
        manager,
        mixedConfig,
        () => {
          if (manager?.mute) return;
          try {
            void originalPlay(soundKey, mixedConfig);
          } catch (fallbackError) {
            console.debug(`[NativeSfxBridge] async fallback failed key=${soundKey}`, fallbackError);
          }
        }
      );
      if (nativePlayed) {
        return true;
      }
    }

    try {
      return !!originalPlay(soundKey, mixedConfig);
    } catch (error) {
      console.debug(`[NativeSfxBridge] manager.play fallback failed key=${soundKey}`, error);
      return false;
    }
  };

  iosNativeSfxBridgeInstalled = true;
  console.log("[NativeSfxBridge] installed");
};

// ========== iOS SPECIFIC HANDLERS ==========

// Handle WebGL context loss (iOS may lose context when app goes to background)
const handleContextLost = () => {
  console.debug('WebGL context lost - iOS background detected');
};

const handleContextRestored = () => {
  console.debug('WebGL context restored');
};

const wakeGameAudio = () => {
  if (!game || !game.sound) return;
  applyGameMasterVolumeToSoundManager(game.sound);

  try {
    const scenes = game.scene.getScenes(true);
    for (const scene of scenes) {
      ensureSceneAudioReady(scene);
    }
  } catch {
    // Continue with direct manager wake path below.
  }

  try {
    if (game.sound.locked) {
      game.sound.unlock();
    }
  } catch {
    // Keep trying on next user interaction.
  }

  try {
    const ctx = (game.sound as any)?.context as AudioContext | undefined;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    // Ignore context resume errors.
  }

  try {
    game.sound.resumeAll();
  } catch {
    // Ignore if sound manager is not fully ready yet.
  }
};

const cleanupOrphanedSceneDomNodes = () => {
  if (!game) return;

  const scenePlugin: any = game.scene;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-laturaivo-ui-scene]")
  );
  if (nodes.length === 0) return;

  const nodesByScene = new Map<string, HTMLElement[]>();
  for (const node of nodes) {
    const sceneKey = node.getAttribute("data-laturaivo-ui-scene");
    if (!sceneKey) continue;
    const list = nodesByScene.get(sceneKey);
    if (list) {
      list.push(node);
    } else {
      nodesByScene.set(sceneKey, [node]);
    }
  }

  for (const [sceneKey, sceneNodes] of nodesByScene.entries()) {
    const isActive = !!scenePlugin?.isActive?.(sceneKey);
    const isPaused = !!scenePlugin?.isPaused?.(sceneKey);
    const isSleeping = !!scenePlugin?.isSleeping?.(sceneKey);
    const shouldKeep = isActive || isPaused || isSleeping;

    if (!shouldKeep) {
      sceneNodes.forEach((node) => node.remove());
      continue;
    }

    // If duplicates exist for an active scene, keep the newest one only.
    for (let i = 0; i < sceneNodes.length - 1; i++) {
      sceneNodes[i].remove();
    }
  }
};

// Handle visibility change (iOS pauses JS when app is backgrounded)
const handleVisibilityChange = () => {
  if (document.hidden) {
    // App went to background - pause audio to prevent iOS issues
    if (game && game.sound) {
      game.sound.pauseAll();
    }
  } else {
    // App came to foreground - aggressively wake audio stack.
    wakeGameAudio();
    cleanupOrphanedSceneDomNodes();
    window.setTimeout(cleanupOrphanedSceneDomNodes, 180);
    window.setTimeout(cleanupOrphanedSceneDomNodes, 520);
  }
};

// Listen for visibility changes
document.addEventListener('visibilitychange', handleVisibilityChange);

// Listen for page being paused (iOS specific)
window.addEventListener('pagehide', () => {
  if (game && game.sound) {
    game.sound.pauseAll();
  }
});

window.addEventListener('pageshow', () => {
  wakeGameAudio();
  cleanupOrphanedSceneDomNodes();
  window.setTimeout(cleanupOrphanedSceneDomNodes, 180);
  window.setTimeout(cleanupOrphanedSceneDomNodes, 520);
});

game = new Phaser.Game(config);
(window as any).__laturaivoGame = game;
applyGameMasterVolumeToSoundManager(game.sound);
installIOSNativeSfxBridge();

const wakeAudioEvents: Array<keyof WindowEventMap> = [
  "touchstart",
  "touchend",
  "pointerdown",
  "click"
];

for (const eventName of wakeAudioEvents) {
  window.addEventListener(eventName, wakeGameAudio, { passive: true, capture: true });
}

window.addEventListener("focus", wakeGameAudio);
window.setTimeout(wakeGameAudio, 100);
window.setTimeout(wakeGameAudio, 500);

// Keep canvas scaling in sync when iOS/browser viewport changes.
let scaleRefreshRaf: number | null = null;
const updateViewportCssVars = () => {
  const vv = window.visualViewport;
  const width = Math.round(vv?.width || window.innerWidth);
  const height = Math.round(vv?.height || window.innerHeight);
  document.documentElement.style.setProperty("--vvw", `${width}px`);
  document.documentElement.style.setProperty("--vvh", `${height}px`);
};
const refreshScale = () => {
  if (scaleRefreshRaf !== null) return;
  scaleRefreshRaf = window.requestAnimationFrame(() => {
    scaleRefreshRaf = null;
    updateViewportCssVars();
    const nextSize = computeGameSize();
    if (
      game.scale.gameSize.width !== nextSize.width ||
      game.scale.gameSize.height !== nextSize.height
    ) {
      game.scale.setGameSize(nextSize.width, nextSize.height);
    }
    game.scale.refresh();
  });
};

const refreshScaleWithSettling = () => {
  // iOS viewport metrics can settle across multiple ticks after rotate/resume.
  refreshScale();
  window.setTimeout(refreshScale, 120);
  window.setTimeout(refreshScale, 360);
};

const refreshAfterForeground = () => {
  refreshScaleWithSettling();
  cleanupOrphanedSceneDomNodes();
  window.setTimeout(cleanupOrphanedSceneDomNodes, 180);
  window.setTimeout(cleanupOrphanedSceneDomNodes, 520);
};

updateViewportCssVars();
refreshScaleWithSettling();
window.setTimeout(refreshScaleWithSettling, 120);
window.setTimeout(refreshScaleWithSettling, 360);
window.addEventListener("resize", refreshScaleWithSettling);
window.addEventListener("orientationchange", () => {
  window.setTimeout(refreshScaleWithSettling, 120);
});
window.addEventListener("pageshow", refreshAfterForeground);
window.addEventListener("focus", refreshAfterForeground);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshAfterForeground();
  }
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", refreshScaleWithSettling);
  window.visualViewport.addEventListener("scroll", refreshScaleWithSettling);
}

game.events.once(Phaser.Core.Events.READY, () => {
  window.__laturaivoBooted = true;
  applyGameMasterVolumeToSoundManager(game.sound);
  installIOSNativeSfxBridge();
  cleanupOrphanedSceneDomNodes();
  if (isIOS) {
    // Preloader loads the asset pack JSON at runtime; refresh URL map when available.
    window.setTimeout(rebuildIOSAudioUrlCache, 1500);
  }

  const canvas = game.canvas;
  if (!canvas) return;

  try {
    const manager = game.sound as any;
    const managerName = manager?.constructor?.name || "unknown";
    const ctxState = manager?.context?.state || "n/a";
    console.log(
      `[AudioBootstrap] backend=${useHTML5AudioBackend ? "html5" : "webaudio"} manager=${managerName} locked=${String(manager?.locked)} mute=${String(manager?.mute)} volume=${String(manager?.volume)} ctx=${ctxState}`
    );
  } catch {
    // Ignore diagnostics failures.
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    handleContextLost();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    handleContextRestored();
    refreshScale();
  });

  refreshScaleWithSettling();
});

// Preloader scene is the only eager scene.
// It dynamically registers the rest of the scenes after core assets load.
game.scene.add("Preloader", Preloader, true);
