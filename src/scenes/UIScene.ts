import Phaser from "phaser";
import * as utils from "../utils";
import { LevelManager } from "../LevelManager";
import { normalizeDifficultyTier, shouldDifficultyShowVideos } from "../content/DifficultyPresentation";
import { abilityUnlockConfig, debugConfig } from "../gameConfig.json";
import { PAUSE_HEADLINES, PAUSE_PROMPTS, pickHumorLine } from "../humor/HumorPack";
import { FLAVOR_TEXT_ENABLED, sanitizePlayerFacingText } from "../content/PlayerTextPolicy";
import { getPlatformCapabilities, shouldIgnoreKeyboardEvent } from "../platform";
import {
  formatSkipHintLine,
  getConfirmAgainText,
  getContinuePromptText,
  getPausePromptText,
  shouldUseKeyboardControlCopy
} from "../controlPrompts";

export default class UIScene extends Phaser.Scene {
  public currentGameSceneKey: string | null;
  public uiContainer: Phaser.GameObjects.DOMElement | null;
  public currentLevel: number;
  public levelDistance: number;
  public isTutorial: boolean;
  
  // Lives system
  public lives: number;
  public maxLives: number;
  public isBossLevel: boolean;
  
  // Animation state for visual effects
  private lastScore: number;
  private scoreAnimating: boolean;
  private lastComboCount: number;
  private lastComboActive: boolean;
  private lastComboMeterVisible: boolean = false;
  private lastObjectiveHudText: string = "";
  private lastObjectiveHudProgress: string = "";
  private loadoutSelectedRouteId: string | null = null;
  private loadoutSelectedPassiveId: string | null = null;
  
  // Active power-ups tracking
  private activePowerUps: Map<string, { endTime: number; duration: number }>;
  private powerUpNotificationQueue: any[];
  
  // Voltti charge indicator state
  private rageReadySoundPlayed: boolean = false;
  private rageReadySince: number = 0;
  private rageReadyHintShown: boolean = false;
  
  // Store bound event handlers for proper cleanup
  private boundEventHandlers: Map<string, Function> = new Map();
  private swipeGestureTarget: HTMLElement | null = null;
  private swipeTouchStartHandler?: (e: TouchEvent) => void;
  private swipeTouchEndHandler?: (e: TouchEvent) => void;
  private touchControlCleanupCallbacks: Array<() => void> = [];
  private joystickTarget?: HTMLElement;
  private joystickTouchStartHandler?: (e: TouchEvent) => void;
  private joystickWindowTouchStartCaptureHandler?: (e: TouchEvent) => void;
  private joystickWindowTouchMoveCaptureHandler?: (e: TouchEvent) => void;
  private joystickWindowTouchEndCaptureHandler?: (e: TouchEvent) => void;
  private uiResizeHandler?: () => void;
  private uiViewportResizeHandler?: () => void;
  private uiViewportScrollHandler?: () => void;
  private lowPowerMode: boolean = false;
  private uiUpdateIntervalMs: number = 16;
  private lastUiDomUpdateTime: number = 0;
  private uiHeavyUpdateIntervalMs: number = 90;
  private lastUiHeavyUpdateTime: number = 0;
  private uiElementCache: Map<string, HTMLElement> = new Map();
  private jumpMarkerDotCache: HTMLElement | null = null;
  private lastKnownQualityTier: "high" | "medium" | "low" | null = null;
  private uiEmergencyLowFps: boolean = false;
  private lastHealthPercentRaw: number = -1;
  private lastHealthPercentText: number = -1;
  private lastHealthVisualState: string = "";
  private lastCriticalHealthVisible: boolean = false;
  private lastEnergyPercentRaw: number = -1;
  private lastEnergyPercentText: number = -1;
  private lastEnergyVisualState: string = "";
  private lastDistanceMeters: number = -1;
  private lastDistanceProgressPercent: number = -1;
  private lastDistanceVisualState: string = "";
  private lastSpeedKmh: number = -1;
  private lastSpeedVisualState: string = "";
  private lastWeatherState: string = "";
  private lastSpeedLinesVisible: boolean | null = null;
  private isCleanedUp: boolean = false;
  private pauseHeadlineText: string = "TAUKO";
  private pausePromptText: string = "Napauta jatkaaksesi";
  private pauseMainMenuConfirmArmedUntil: number = 0;
  private pauseMainMenuConfirmResetTimerId?: number;
  private lastLowEnergyDamageWarningAt: number = 0;
  private readonly touchAbilityUnavailableOpacity: number = 0.35;
  private readonly touchAbilityLockedOpacity: number = 0.3;
  private readonly touchAbilityReadyMultiplier: number = 1.75;
  private readonly touchAbilityReadyOpacityBoost: number = 0.75;
  private readonly dangerWarningScale: number = 0.5;
  private readonly dangerWarningPopScale: number = 0.62;
  private readonly dangerWarningHideScale: number = 0.38;
  private bossIntroActive: boolean = false;
  private bossIntroTapReady: boolean = false;
  private bossIntroTapEnableTimeoutId?: number;
  private bossIntroAutoHideTimeoutId?: number;
  private bossIntroTapHandler?: (event: Event) => void;
  private bossIntroForcedPause: boolean = false;
  private bossPreIntroVideoActive: boolean = false;
  private bossPreIntroVideoTapReady: boolean = false;
  private bossPreIntroVideoTapEnableTimeoutId?: number;
  private bossPreIntroVideoTapHandler?: (event: Event) => void;
  private bossPreIntroVideoEndedHandler?: () => void;
  private bossPreIntroVideoErrorHandler?: () => void;
  private bossPreIntroVideoPlayingHandler?: () => void;
  private bossPreIntroVideoStartGuardTimeoutId?: number;
  private bossMidfightVideoActive: boolean = false;
  private bossMidfightVideoTapReady: boolean = false;
  private bossMidfightVideoForcedPause: boolean = false;
  private bossMidfightVideoTapEnableTimeoutId?: number;
  private bossMidfightVideoTapHandler?: (event: Event) => void;
  private bossMidfightVideoEndedHandler?: () => void;
  private bossMidfightVideoErrorHandler?: () => void;
  private bossMidfightVideoPlayingHandler?: () => void;
  private bossMidfightVideoStartGuardTimeoutId?: number;
  private superGuideActive: boolean = false;
  private superGuideTapReady: boolean = false;
  private superGuideTapEnableTimeoutId?: number;
  private superGuideTapHandler?: (event: Event) => void;
  private superGuideForcedPause: boolean = false;
  private levelStartTwoSecondSuperGuideShown: boolean = false;
  private overlayKeydownHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super({
      key: "UIScene",
    });
    this.currentGameSceneKey = null;
    this.uiContainer = null;
    this.currentLevel = 1;
    this.levelDistance = 1000;
    this.isTutorial = false;
    this.lives = 3;
    this.maxLives = 5;
    this.isBossLevel = false;
    this.lastScore = 0;
    this.scoreAnimating = false;
    this.lastComboCount = 0;
    this.activePowerUps = new Map();
    this.powerUpNotificationQueue = [];
  }
  
  init(data: { gameSceneKey?: string; currentLevel?: number; levelDistance?: number; lives?: number; maxLives?: number; isBossLevel?: boolean; isTutorial?: boolean }) {
    this.currentGameSceneKey = data.gameSceneKey || null;
    this.currentLevel = data.currentLevel || 1;
    this.levelDistance = data.levelDistance || 1000;
    this.isTutorial = !!data.isTutorial;
    this.lives = data.lives !== undefined ? data.lives : 3;
    this.maxLives = data.maxLives !== undefined ? data.maxLives : 5;
    this.isBossLevel = data.isBossLevel || false;
    this.lastScore = 0;
    this.scoreAnimating = false;
    this.lastComboCount = 0;
    this.clearTouchControlListeners();
    this.lastComboActive = false;
    this.lastComboMeterVisible = false;
    this.lastObjectiveHudText = "";
    this.lastObjectiveHudProgress = "";
    this.loadoutSelectedRouteId = null;
    this.loadoutSelectedPassiveId = null;
    this.activePowerUps = new Map();
    this.powerUpNotificationQueue = [];
    this.lastUiDomUpdateTime = 0;
    this.lastUiHeavyUpdateTime = 0;
    this.clearUiElementCache();
    this.lastKnownQualityTier = null;
    this.uiEmergencyLowFps = false;
    this.lastHealthPercentRaw = -1;
    this.lastHealthPercentText = -1;
    this.lastHealthVisualState = "";
    this.lastCriticalHealthVisible = false;
    this.lastEnergyPercentRaw = -1;
    this.lastEnergyPercentText = -1;
    this.lastEnergyVisualState = "";
    this.lastDistanceMeters = -1;
    this.lastDistanceProgressPercent = -1;
    this.lastDistanceVisualState = "";
    this.lastSpeedKmh = -1;
    this.lastSpeedVisualState = "";
    this.lastWeatherState = "";
    this.lastSpeedLinesVisible = null;
    this.rageReadySoundPlayed = false;
    this.rageReadySince = 0;
    this.rageReadyHintShown = false;
    this.lastLowEnergyDamageWarningAt = 0;
    this.bossIntroActive = false;
    this.bossIntroTapReady = false;
    this.bossIntroTapHandler = undefined;
    this.bossIntroForcedPause = false;
    this.bossPreIntroVideoActive = false;
    this.bossPreIntroVideoTapReady = false;
    this.bossPreIntroVideoTapHandler = undefined;
    this.bossPreIntroVideoEndedHandler = undefined;
    this.bossPreIntroVideoErrorHandler = undefined;
    this.bossPreIntroVideoPlayingHandler = undefined;
    this.bossMidfightVideoActive = false;
    this.bossMidfightVideoTapReady = false;
    this.bossMidfightVideoForcedPause = false;
    this.bossMidfightVideoTapHandler = undefined;
    this.bossMidfightVideoEndedHandler = undefined;
    this.bossMidfightVideoErrorHandler = undefined;
    this.bossMidfightVideoPlayingHandler = undefined;
    this.superGuideActive = false;
    this.superGuideTapReady = false;
    this.superGuideTapHandler = undefined;
    this.superGuideForcedPause = false;
    this.levelStartTwoSecondSuperGuideShown = false;
    this.overlayKeydownHandler = undefined;
    this.isPaused = false;
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickRotationAccum = 0;
    this.joystickCircleStartTime = 0;
    this.joystickSecretTriggered = false;
    this.touchInputState = { left: false, right: false };
    this.touchJumpPressed = false;
    this.touchPolePressed = false;
    this.touchAxePressed = false;
    this.touchVolttiPressed = false;
    this.touchRagePressed = false;
    this.touchDodgePressed = false;
    this.swipeTrackingActive = false;
    this.swipeStartY = 0;
    this.swipeStartTime = 0;
    if (typeof window !== "undefined" && this.bossIntroTapEnableTimeoutId) {
      window.clearTimeout(this.bossIntroTapEnableTimeoutId);
      this.bossIntroTapEnableTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.bossIntroAutoHideTimeoutId) {
      window.clearTimeout(this.bossIntroAutoHideTimeoutId);
      this.bossIntroAutoHideTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.bossPreIntroVideoTapEnableTimeoutId) {
      window.clearTimeout(this.bossPreIntroVideoTapEnableTimeoutId);
      this.bossPreIntroVideoTapEnableTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.bossPreIntroVideoStartGuardTimeoutId) {
      window.clearTimeout(this.bossPreIntroVideoStartGuardTimeoutId);
      this.bossPreIntroVideoStartGuardTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.bossMidfightVideoTapEnableTimeoutId) {
      window.clearTimeout(this.bossMidfightVideoTapEnableTimeoutId);
      this.bossMidfightVideoTapEnableTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.bossMidfightVideoStartGuardTimeoutId) {
      window.clearTimeout(this.bossMidfightVideoStartGuardTimeoutId);
      this.bossMidfightVideoStartGuardTimeoutId = undefined;
    }
    if (typeof window !== "undefined" && this.superGuideTapEnableTimeoutId) {
      window.clearTimeout(this.superGuideTapEnableTimeoutId);
      this.superGuideTapEnableTimeoutId = undefined;
    }
  }

  // Pause state
  private isPaused: boolean = false;
  
  // Mobile touch state
  private isTouchDevice: boolean = false;
  private touchJumpPressed: boolean = false;
  private touchPolePressed: boolean = false;
  private touchAxePressed: boolean = false;
  private touchVolttiPressed: boolean = false;
  private touchRagePressed: boolean = false;
  private touchDodgePressed: boolean = false;
  
  create(): void {
    this.isCleanedUp = false;
    this.pauseHeadlineText = pickHumorLine(this, PAUSE_HEADLINES, this.pauseHeadlineText);
    this.pausePromptText = pickHumorLine(this, PAUSE_PROMPTS, getPausePromptText());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    this.createDOMUI();
    this.setupOverlayKeyboardDismissal();
    this.setupEventListeners();
    this.setupAudioToggle();
    this.setupTutorialSkipButton();
    this.setupMobileControls();
    this.setupResponsiveUILayout();
    this.scheduleLevelStartSuperGuide();
    
    // Note: Ability unlock notifications are handled by AbilityUnlockUIScene launched from GameScene
    // Do not show duplicate notifications here
  }

  private setupOverlayKeyboardDismissal(): void {
    if (!shouldUseKeyboardControlCopy() || typeof window === "undefined") return;

    this.overlayKeydownHandler = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;
      if (event.code !== "Enter" && event.code !== "Space") return;

      const consume = (): void => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      if (this.bossPreIntroVideoActive) {
        consume();
        if (this.bossPreIntroVideoTapReady && this.bossPreIntroVideoTapHandler) {
          this.bossPreIntroVideoTapHandler(event);
        }
        return;
      }

      if (this.bossMidfightVideoActive) {
        consume();
        if (this.bossMidfightVideoTapReady && this.bossMidfightVideoTapHandler) {
          this.bossMidfightVideoTapHandler(event);
        }
        return;
      }

      if (this.bossIntroActive) {
        consume();
        if (this.bossIntroTapReady && this.bossIntroTapHandler) {
          this.bossIntroTapHandler(event);
        }
        return;
      }

      if (this.superGuideActive) {
        consume();
        if (this.superGuideTapReady && this.superGuideTapHandler) {
          this.superGuideTapHandler(event);
        }
      }
    };

    window.addEventListener("keydown", this.overlayKeydownHandler, { capture: true });
  }
  
  // Show notifications for newly unlocked abilities at the start of levels 2, 3, 4
  showNewAbilityUnlocks(): void {
    const notifications: { delay: number; text: string; duration: number }[] = [];
    let currentDelay = 1000;
    
    // Level 2: Axe attack unlocked
    if (this.currentLevel === abilityUnlockConfig.axeAttackUnlockLevel.value) {
      notifications.push({ delay: currentDelay, text: "Uusi kyky: Kirves", duration: 3500 });
      currentDelay += 4000;
    }
    
    // Level 3: Rage/Laturaivo unlocked
    if (this.currentLevel === abilityUnlockConfig.rageUnlockLevel.value) {
      notifications.push({ delay: currentDelay, text: "Uusi kyky: Laturaivo", duration: 3500 });
      currentDelay += 4000;
    }
    
    // Level 4: Power-ups unlocked
    if (this.currentLevel === abilityUnlockConfig.powerUpsUnlockLevel.value) {
      notifications.push({ delay: currentDelay, text: "Uusi kyky: Power-upit", duration: 3500 });
      currentDelay += 4000;
    }
    
    // Show all unlock notifications using perfect display
    notifications.forEach(notification => {
      this.time.delayedCall(notification.delay, () => {
        this.showNotification(notification.text, notification.duration);
      });
    });
  }
  
  // Simple notification display for ability unlocks
  showNotification(text: string, duration: number): void {
    const perfectDisplay = this.getCachedElement("perfect-display");
    const perfectText = this.getCachedElement("perfect-text");
    const pointsPopup = this.getCachedElement("points-popup");
    
    if (perfectDisplay && perfectText && pointsPopup) {
      perfectText.textContent = text;
      pointsPopup.textContent = "";
      perfectDisplay.style.opacity = "1";
      perfectDisplay.style.transform = "translate(-50%, -50%) scale(1)";
      
      setTimeout(() => {
        perfectDisplay.style.opacity = "0";
        perfectDisplay.style.transform = "translate(-50%, -50%) scale(0.8)";
      }, duration);
    }
  }
  
  // ========== MOBILE CONTROLS SETUP ==========
  
  // Virtual joystick state
  private joystickActive: boolean = false;
  private joystickStartX: number = 0;
  private joystickStartY: number = 0;
  private joystickTouchId: number | null = null;
  private joystickLastAngle: number = 0;
  private joystickRotationAccum: number = 0;
  private joystickCircleStartTime: number = 0;
  private joystickSecretTriggered: boolean = false;
  
  // Gesture recognition state
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private swipeTrackingActive: boolean = false;
  private gestureHintShown: boolean = false;

  private detectTouchDevice(): boolean {
    return getPlatformCapabilities().hasTouch;
  }
  
  setupMobileControls(): void {
    this.clearTouchControlListeners();

    // Detect touch device
    this.isTouchDevice = this.detectTouchDevice();
    this.lowPowerMode = !!(window as any).isLowPowerMode;
    const profileTier = (window as any).__laturaivoDeviceProfile?.qualityTier as "high" | "medium" | "low" | undefined;
    this.tuneUiRefreshRate(profileTier);
    
    // Show gesture hint on first mobile play (only once per session)
    if (this.isTouchDevice && !sessionStorage.getItem('gestureHintShown')) {
      this.showGestureHint();
    }
    
    // ========== VIRTUAL JOYSTICK SETUP ==========
    this.setupVirtualJoystick();
    
    // ========== SWIPE GESTURE FOR JUMP ==========
    this.setupSwipeGestures();
    
    // ========== MOVEMENT CONTROLS (Left side) ==========
    
    // ========== ATTACK CONTROLS (Right side) ==========
    
    // Pole strike
    this.setupTouchButton("touch-pole-btn",
      () => { this.touchPolePressed = true; this.emitTouchInput("pole", true); },
      () => { this.touchPolePressed = false; this.emitTouchInput("pole", false); }
    );
    
    // Axe attack - unlocked in tutorial level, otherwise from level 2.
    const touchAxeBtn = this.getCachedElement("touch-axe-btn");
    const isAxeUnlocked = this.isTutorial || this.currentLevel >= abilityUnlockConfig.axeAttackUnlockLevel.value;
    if (isAxeUnlocked) {
      this.setupTouchButton("touch-axe-btn",
        () => { this.touchAxePressed = true; this.emitTouchInput("axe", true); },
        () => { this.touchAxePressed = false; this.emitTouchInput("axe", false); }
      );
    } else if (touchAxeBtn) {
      touchAxeBtn.style.opacity = "0.3";
      touchAxeBtn.style.pointerEvents = "none";
      touchAxeBtn.innerHTML = '<span class="text-xl">🔒</span><span class="text-white text-[7px] font-bold" style="text-shadow: 1px 1px 0px #000;">TASO 2</span>';
    }
    
    // Voltti
    this.setupTouchButton("touch-voltti-btn",
      () => { this.touchVolttiPressed = true; this.emitTouchInput("voltti", true); },
      () => { this.touchVolttiPressed = false; this.emitTouchInput("voltti", false); }
    );
    
    // Rage - unlocked in tutorial level, otherwise from level 3.
    const touchRageBtn = this.getCachedElement("touch-rage-btn");
    const isRageUnlocked = this.isTutorial || this.currentLevel >= abilityUnlockConfig.rageUnlockLevel.value;
    if (isRageUnlocked) {
      this.setupTouchButton("touch-rage-btn",
        () => { this.touchRagePressed = true; this.emitTouchInput("rage", true); },
        () => { this.touchRagePressed = false; this.emitTouchInput("rage", false); }
      );
    } else if (touchRageBtn) {
      touchRageBtn.style.opacity = "0.3";
      touchRageBtn.style.pointerEvents = "none";
      touchRageBtn.innerHTML = '<span class="text-xl">🔒</span><span class="text-white text-[7px] font-bold" style="text-shadow: 1px 1px 0px #000;">TASO 3</span>';
    }

    // Dodge backstep - always available.
    this.setupTouchButton("touch-dodge-btn",
      () => { this.touchDodgePressed = true; this.emitTouchInput("dodge", true); },
      () => { this.touchDodgePressed = false; this.emitTouchInput("dodge", false); }
    );

    // ========== CENTER CONTROLS (Pause & Sound) ==========
    
    this.setupTouchActionButton("touch-pause-btn", () => {
      this.togglePause();
    }, "light");
    
    this.setupTouchActionButton("touch-sound-btn", () => {
      this.setGlobalMute(!this.sound.mute);
    }, "light");

    this.updateMobileSoundIcon();
    this.applyTouchUILayout();
  }

  setupResponsiveUILayout(): void {
    this.removeResponsiveUILayoutListeners();

    const applyLayout = utils.throttle(() => {
      this.applyTouchUILayout();
    }, 80);

    this.uiResizeHandler = applyLayout;
    window.addEventListener("resize", this.uiResizeHandler);
    window.addEventListener("orientationchange", this.uiResizeHandler);

    if (window.visualViewport) {
      this.uiViewportResizeHandler = applyLayout;
      this.uiViewportScrollHandler = applyLayout;
      window.visualViewport.addEventListener("resize", this.uiViewportResizeHandler);
      window.visualViewport.addEventListener("scroll", this.uiViewportScrollHandler);
    }

    this.applyTouchUILayout();
  }

  removeResponsiveUILayoutListeners(): void {
    if (this.uiResizeHandler) {
      window.removeEventListener("resize", this.uiResizeHandler);
      window.removeEventListener("orientationchange", this.uiResizeHandler);
      this.uiResizeHandler = undefined;
    }

    if (window.visualViewport && this.uiViewportResizeHandler) {
      window.visualViewport.removeEventListener("resize", this.uiViewportResizeHandler);
      this.uiViewportResizeHandler = undefined;
    }

    if (window.visualViewport && this.uiViewportScrollHandler) {
      window.visualViewport.removeEventListener("scroll", this.uiViewportScrollHandler);
      this.uiViewportScrollHandler = undefined;
    }
  }

  private clearUiElementCache(): void {
    this.uiElementCache.clear();
    this.jumpMarkerDotCache = null;
  }

  private getCachedElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
    const cached = this.uiElementCache.get(id);
    if (cached && cached.isConnected) {
      return cached as T;
    }

    const element = document.getElementById(id) as T | null;
    if (element) {
      this.uiElementCache.set(id, element);
    }
    return element;
  }

  private getJumpMarkerDot(marker: HTMLElement): HTMLElement | null {
    if (
      this.jumpMarkerDotCache &&
      this.jumpMarkerDotCache.isConnected &&
      this.jumpMarkerDotCache.parentElement === marker
    ) {
      return this.jumpMarkerDotCache;
    }
    this.jumpMarkerDotCache = marker.querySelector("div") as HTMLElement | null;
    return this.jumpMarkerDotCache;
  }

  private setTextContentIfChanged(element: HTMLElement | null, value: string): void {
    if (!element || element.textContent === value) return;
    element.textContent = value;
  }

  private setClassNameIfChanged(element: HTMLElement | null, value: string): void {
    if (!element || element.className === value) return;
    element.className = value;
  }

  private setStyleIfChanged(
    element: HTMLElement | null,
    property: keyof CSSStyleDeclaration,
    value: string
  ): void {
    if (!element) return;
    const style = element.style as unknown as Record<string, string>;
    const key = property as string;
    if (style[key] === value) return;
    style[key] = value;
  }

  private updateTouchAbilityButtonOpacity(buttonId: string, isReady: boolean, unavailableOpacity: number): void {
    const button = this.getCachedElement(buttonId);
    if (!button) return;
    const boostedByMultiplier = unavailableOpacity * this.touchAbilityReadyMultiplier;
    const boostedByAbsolute = unavailableOpacity + this.touchAbilityReadyOpacityBoost;
    const readyOpacity = Phaser.Math.Clamp(
      Math.max(boostedByMultiplier, boostedByAbsolute),
      0,
      1
    );
    const targetOpacity = isReady ? readyOpacity : unavailableOpacity;
    this.setStyleIfChanged(button, "opacity", targetOpacity.toString());
  }

  private updateTouchAbilityButtonStates(player: any, gameScene: any): void {
    if (!this.isTouchDevice) return;

    const attackControls = this.getCachedElement("mobile-attack-controls");
    if (attackControls) {
      this.setStyleIfChanged(attackControls, "opacity", "1");
    }

    // Tutorial should present every ability as fully available.
    if (this.isTutorial) {
      this.setStyleIfChanged(this.getCachedElement("touch-pole-btn"), "opacity", "1");
      this.setStyleIfChanged(this.getCachedElement("touch-axe-btn"), "opacity", "1");
      this.setStyleIfChanged(this.getCachedElement("touch-voltti-btn"), "opacity", "1");
      this.setStyleIfChanged(this.getCachedElement("touch-rage-btn"), "opacity", "1");
      this.setStyleIfChanged(this.getCachedElement("touch-dodge-btn"), "opacity", "1");
      return;
    }

    const isAxeUnlocked = this.isTutorial || this.currentLevel >= abilityUnlockConfig.axeAttackUnlockLevel.value;
    const isRageUnlocked = this.isTutorial || this.currentLevel >= abilityUnlockConfig.rageUnlockLevel.value;
    const isBossFight = gameScene.bossActive === true && gameScene.bossDefeated !== true;
    const canAct = !player.isDead && !player.isHurting;
    const now = this.time?.now ?? 0;
    const ragePercent = typeof player.getRagePercentage === "function"
      ? player.getRagePercentage()
      : 0;
    const axeCooldownReady = typeof player.isAxeAbilityReady === "function"
      ? player.isAxeAbilityReady(now)
      : true;
    const volttiCooldownReady = typeof player.isVolttiAbilityReady === "function"
      ? player.isVolttiAbilityReady(now)
      : true;

    const poleReady = canAct && player.energy >= player.poleEnergyCost;
    const axeReady = isAxeUnlocked && canAct && player.energy >= player.axeEnergyCost && axeCooldownReady;
    const volttiReady = canAct
      && volttiCooldownReady
      && !player.isOnGround
      && !player.isAttacking
      && !player.isPerformingVoltti
      && player.currentTrick === null;
    const rageReady = isRageUnlocked
      && !isBossFight
      && !player.isRaging
      && !player.isDead
      && ragePercent >= 100;

    this.updateTouchAbilityButtonOpacity("touch-pole-btn", poleReady, this.touchAbilityUnavailableOpacity);
    this.updateTouchAbilityButtonOpacity(
      "touch-axe-btn",
      axeReady,
      isAxeUnlocked ? this.touchAbilityUnavailableOpacity : this.touchAbilityLockedOpacity
    );
    this.updateTouchAbilityButtonOpacity("touch-voltti-btn", volttiReady, this.touchAbilityUnavailableOpacity);
    this.updateTouchAbilityButtonOpacity(
      "touch-rage-btn",
      rageReady,
      isRageUnlocked ? this.touchAbilityUnavailableOpacity : this.touchAbilityLockedOpacity
    );
  }

  private applyWeatherWarningState(weatherRaw: string): void {
    const weatherWarning = this.getCachedElement("weather-warning");
    if (weatherWarning) {
      this.setStyleIfChanged(weatherWarning, "opacity", "0");
      this.setStyleIfChanged(weatherWarning, "display", "none");
      this.setStyleIfChanged(weatherWarning, "pointerEvents", "none");
    }

    const weather = typeof weatherRaw === "string" ? weatherRaw : "clear";
    this.lastWeatherState = weather !== "clear" ? weather : "clear";
  }

  private tuneUiRefreshRate(qualityTier?: "high" | "medium" | "low"): void {
    const tier = qualityTier || "medium";
    if (this.isTouchDevice) {
      if (this.lowPowerMode || tier === "low") {
        this.uiUpdateIntervalMs = 120;
        this.uiHeavyUpdateIntervalMs = 240;
      } else if (tier === "medium") {
        this.uiUpdateIntervalMs = 72;
        this.uiHeavyUpdateIntervalMs = 170;
      } else {
        this.uiUpdateIntervalMs = 56;
        this.uiHeavyUpdateIntervalMs = 130;
      }
      return;
    }

    if (this.lowPowerMode || tier === "low") {
      this.uiUpdateIntervalMs = 33;
      this.uiHeavyUpdateIntervalMs = 120;
    } else if (tier === "medium") {
      this.uiUpdateIntervalMs = 24;
      this.uiHeavyUpdateIntervalMs = 90;
    } else {
      this.uiUpdateIntervalMs = 20;
      this.uiHeavyUpdateIntervalMs = 75;
    }
  }

  private getViewportMetrics(): {
    width: number;
    height: number;
    insetTop: number;
    insetRight: number;
    insetBottom: number;
    insetLeft: number;
  } {
    const vv = window.visualViewport;
    const width = Math.round(vv?.width || window.innerWidth);
    const height = Math.round(vv?.height || window.innerHeight);
    const insetTop = Math.max(0, Math.round(vv?.offsetTop || 0));
    const insetLeft = Math.max(0, Math.round(vv?.offsetLeft || 0));
    const insetRight = Math.max(
      0,
      Math.round(window.innerWidth - ((vv?.width || window.innerWidth) + (vv?.offsetLeft || 0)))
    );
    const insetBottom = Math.max(
      0,
      Math.round(window.innerHeight - ((vv?.height || window.innerHeight) + (vv?.offsetTop || 0)))
    );

    return { width, height, insetTop, insetRight, insetBottom, insetLeft };
  }

  private parsePx(value: string | null | undefined): number {
    if (!value) return 0;
    const numeric = Number.parseFloat(value.replace("px", ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private rectsOverlap(a: DOMRect, b: DOMRect, gap: number = 0): boolean {
    return !(
      a.right + gap <= b.left ||
      a.left >= b.right + gap ||
      a.bottom + gap <= b.top ||
      a.top >= b.bottom + gap
    );
  }

  applyTouchUILayout(): void {
    const bottomHudContainer = this.getCachedElement("bottom-hud-container");
    const movementControls = this.getCachedElement("mobile-movement-controls");
    const attackControls = this.getCachedElement("mobile-attack-controls");
    const centerControls = this.getCachedElement("mobile-center-controls");
    if (!bottomHudContainer || !movementControls || !attackControls || !centerControls) return;

    this.isTouchDevice = this.detectTouchDevice();
    const topHudLeftColumn = this.getCachedElement("top-hud-left-column");
    const compactHealthRow = this.getCachedElement("compact-health-row");
    const compactEnergyRow = this.getCachedElement("compact-energy-row");
    const rageMeterContainer = this.getCachedElement("rage-meter-container");
    const rageMeterLargeContainer = this.getCachedElement("rage-meter-large-container");

    if (!this.isTouchDevice) {
      if (topHudLeftColumn) {
        topHudLeftColumn.style.marginLeft = "";
        topHudLeftColumn.style.gap = "";
      }
      if (compactHealthRow) compactHealthRow.style.display = "";
      if (compactEnergyRow) compactEnergyRow.style.display = "";
      if (rageMeterContainer) rageMeterContainer.style.display = "";
      if (rageMeterLargeContainer) rageMeterLargeContainer.style.display = "none";
      bottomHudContainer.style.display = "";
      bottomHudContainer.style.top = "";
      bottomHudContainer.style.right = "";
      bottomHudContainer.style.bottom = "";
      bottomHudContainer.style.left = "";
      bottomHudContainer.style.transform = "";
      bottomHudContainer.style.transformOrigin = "";

      movementControls.style.display = "none";
      movementControls.style.left = "";
      movementControls.style.bottom = "";
      movementControls.style.transform = "";
      movementControls.style.transformOrigin = "";

      attackControls.style.display = "none";
      attackControls.style.right = "";
      attackControls.style.bottom = "";
      attackControls.style.transform = "";
      attackControls.style.transformOrigin = "";

      const { insetBottom } = this.getViewportMetrics();
      centerControls.style.display = "flex";
      centerControls.style.flexDirection = "row";
      centerControls.style.alignItems = "center";
      centerControls.style.justifyContent = "center";
      centerControls.style.gap = "20px";
      centerControls.style.left = "50%";
      centerControls.style.right = "auto";
      centerControls.style.top = "auto";
      centerControls.style.bottom = `${insetBottom + 10}px`;
      centerControls.style.transform = "translateX(-50%) scale(0.95)";
      centerControls.style.transformOrigin = "bottom center";

      const weatherWarning = this.getCachedElement("weather-warning");
      if (weatherWarning) {
        const centerBottom = this.parsePx(centerControls.style.bottom);
        weatherWarning.style.left = "50%";
        weatherWarning.style.transform = "translateX(-50%)";
        weatherWarning.style.right = "auto";
        weatherWarning.style.top = "auto";
        weatherWarning.style.bottom = `${centerBottom + 58}px`;
        weatherWarning.style.zIndex = "1400";
      }
      return;
    }

    // Keep only one visible health/energy pair on touch devices.
    if (compactHealthRow) compactHealthRow.style.display = "none";
    if (compactEnergyRow) compactEnergyRow.style.display = "none";
    if (rageMeterContainer) rageMeterContainer.style.display = "none";
    if (rageMeterLargeContainer) rageMeterLargeContainer.style.display = "flex";

    movementControls.style.display = "flex";
    attackControls.style.display = "flex";
    centerControls.style.display = "flex";
    movementControls.style.opacity = "0.45";
    attackControls.style.opacity = "1";
    centerControls.style.gap = "20px";

    const { width: viewportWidth, height: viewportHeight, insetTop, insetRight, insetBottom, insetLeft } = this.getViewportMetrics();
    const topHudBar = this.getCachedElement("top-hud-bar");
    if (topHudLeftColumn) {
      topHudLeftColumn.style.marginLeft = `${Math.max(12, insetLeft + 12)}px`;
      topHudLeftColumn.style.gap = "8px";
    }
    const topHudBottom = Math.ceil(
      Math.max(
        topHudBar?.getBoundingClientRect().bottom || insetTop + 72,
        topHudLeftColumn?.getBoundingClientRect().bottom || 0
      )
    );
    const shortSide = Math.min(viewportWidth, viewportHeight);
    const hudScale = viewportHeight < 390 ? 0.84 : viewportHeight < 460 ? 0.94 : shortSide < 430 ? 0.96 : 1;
    const controlsScale = viewportHeight < 390 ? 0.74 : viewportHeight < 460 ? 0.82 : shortSide < 430 ? 0.9 : 1;
    const centerScale = viewportHeight < 390 ? 0.9 : viewportHeight < 460 ? 0.96 : 1;
    let finalControlsScale = controlsScale;

    bottomHudContainer.style.display = "flex";
    bottomHudContainer.style.position = "absolute";
    bottomHudContainer.style.top = `${Math.max(insetTop + 12, topHudBottom + 16)}px`;
    bottomHudContainer.style.left = `${insetLeft + 8}px`;
    bottomHudContainer.style.bottom = "auto";
    bottomHudContainer.style.right = "auto";
    bottomHudContainer.style.zIndex = "950";
    bottomHudContainer.style.transformOrigin = "top left";
    bottomHudContainer.style.transform = `scale(${hudScale})`;

    movementControls.style.left = `${insetLeft + 12}px`;
    movementControls.style.bottom = `${insetBottom + 12}px`;
    movementControls.style.transformOrigin = "bottom left";
    movementControls.style.transform = `scale(${finalControlsScale})`;

    attackControls.style.right = `${insetRight + 12}px`;
    attackControls.style.bottom = `${insetBottom + 12}px`;
    attackControls.style.transformOrigin = "bottom right";
    attackControls.style.transform = `scale(${finalControlsScale})`;

    centerControls.style.left = "50%";
    centerControls.style.right = "auto";
    centerControls.style.top = "auto";
    centerControls.style.bottom = `${insetBottom + 12}px`;
    centerControls.style.flexDirection = "row";
    centerControls.style.alignItems = "center";
    centerControls.style.justifyContent = "center";
    centerControls.style.transformOrigin = "bottom center";
    centerControls.style.transform = `translateX(-50%) scale(${centerScale})`;

    // Resolve edge clipping after transforms.
    const hudRect = bottomHudContainer.getBoundingClientRect();
    const rightLimit = viewportWidth - insetRight - 4;
    if (hudRect.right > rightLimit) {
      const overflow = hudRect.right - rightLimit;
      const currentLeft = this.parsePx(bottomHudContainer.style.left);
      bottomHudContainer.style.left = `${Math.max(insetLeft + 4, currentLeft - overflow)}px`;
    }

    // Keep left movement controls clear of health/energy HUD.
    const hudRectAfter = bottomHudContainer.getBoundingClientRect();
    const movementRect = movementControls.getBoundingClientRect();
    if (this.rectsOverlap(hudRectAfter, movementRect, 6)) {
      const needed = hudRectAfter.bottom + 8 - movementRect.top;
      if (needed > 0) {
        const currentBottom = this.parsePx(movementControls.style.bottom);
        movementControls.style.bottom = `${Math.max(insetBottom + 4, currentBottom - needed)}px`;
      }
    }

    // Keep left/right touch control clusters from colliding on narrow screens.
    const movementRectAfter = movementControls.getBoundingClientRect();
    const attackRectAfter = attackControls.getBoundingClientRect();
    const minHorizontalGap = 12;
    const availableControlWidth = Math.max(
      1,
      viewportWidth - insetLeft - insetRight - minHorizontalGap - 8
    );
    const usedControlWidth = movementRectAfter.width + attackRectAfter.width + minHorizontalGap;
    if (usedControlWidth > availableControlWidth) {
      const fitRatio = availableControlWidth / usedControlWidth;
      finalControlsScale = Math.max(0.6, finalControlsScale * fitRatio);
      movementControls.style.transform = `scale(${finalControlsScale})`;
      attackControls.style.transform = `scale(${finalControlsScale})`;
    }

    // Keep controls vertically within the gameplay area below top HUD.
    const movementRectFit = movementControls.getBoundingClientRect();
    const attackRectFit = attackControls.getBoundingClientRect();
    const controlTopLimit = Math.max(insetTop + 8, topHudBottom + 8);
    const availableControlHeight = Math.max(
      1,
      viewportHeight - (insetBottom + 8) - controlTopLimit
    );
    const tallestControlHeight = Math.max(movementRectFit.height, attackRectFit.height);
    if (tallestControlHeight > availableControlHeight) {
      const fitRatio = availableControlHeight / tallestControlHeight;
      finalControlsScale = Math.max(0.58, finalControlsScale * fitRatio);
      movementControls.style.transform = `scale(${finalControlsScale})`;
      attackControls.style.transform = `scale(${finalControlsScale})`;
    }

    const centerRectAfter = centerControls.getBoundingClientRect();
    if (this.rectsOverlap(centerRectAfter, movementRectAfter, 8) || this.rectsOverlap(centerRectAfter, attackRectAfter, 8)) {
      const tighterCenterScale = Math.max(0.8, centerScale * 0.86);
      centerControls.style.transform = `translateX(-50%) scale(${tighterCenterScale})`;
    }

    const weatherWarning = this.getCachedElement("weather-warning");
    if (weatherWarning) {
      const centerBottom = this.parsePx(centerControls.style.bottom);
      const weatherBottom = centerBottom + Math.round(58 * centerScale);
      weatherWarning.style.left = "50%";
      weatherWarning.style.transform = "translateX(-50%)";
      weatherWarning.style.right = "auto";
      weatherWarning.style.top = "auto";
      weatherWarning.style.bottom = `${weatherBottom}px`;
      weatherWarning.style.zIndex = "1400";
    }

  }
  
  // Update mobile sound button icon
  updateMobileSoundIcon(): void {
    const touchSoundIcon = this.getCachedElement("touch-sound-icon");
    if (touchSoundIcon) {
      touchSoundIcon.textContent = this.sound.mute ? "🔇" : "🔊";
    }
  }

  private syncSceneMuteState(sceneKey: string | null, muted: boolean): void {
    if (!sceneKey) return;

    let targetScene: any;
    try {
      targetScene = this.scene.get(sceneKey);
    } catch {
      return;
    }

    if (!targetScene) return;
    const applyGlobalMuteState = targetScene.applyGlobalMuteState;
    if (typeof applyGlobalMuteState === "function") {
      try {
        applyGlobalMuteState.call(targetScene, muted);
      } catch (error) {
        console.debug(`[UIScene] Failed to sync mute state for scene=${sceneKey}`, error);
      }
    }
  }

  setGlobalMute(muted: boolean): void {
    const nextMuted = !!muted;
    this.sound.mute = nextMuted;
    this.syncSceneMuteState(this.currentGameSceneKey, nextMuted);
    this.syncSceneMuteState("TitleScreen", nextMuted);
    this.updateAudioToggleUI();
    this.updateMobileSoundIcon();
  }
  
  // iOS Taptic Engine-style haptic feedback
  // Uses different patterns for immersive feedback
  triggerHapticFeedback(type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light"): void {
    // Try iOS-specific Taptic Engine first (if available via webkit)
    if ((window as any).webkit?.messageHandlers?.haptic) {
      try {
        (window as any).webkit.messageHandlers.haptic.postMessage({ type });
        return;
      } catch (e) {
        // Fall through to vibration API
      }
    }
    
    if (!navigator.vibrate) return;
    
    switch (type) {
      case "light":
        navigator.vibrate(8); // Very short tap - button press
        break;
      case "medium":
        navigator.vibrate(20); // Medium feedback - attacks
        break;
      case "heavy":
        navigator.vibrate([25, 15, 40]); // Strong pattern - special moves
        break;
      case "success":
        navigator.vibrate([15, 50, 15, 50, 30]); // Celebration pattern
        break;
      case "warning":
        navigator.vibrate([40, 30, 40]); // Warning double-tap
        break;
      case "error":
        navigator.vibrate([60, 20, 60, 20, 60]); // Error triple-pulse
        break;
    }
  }
  
  // ========== VIRTUAL JOYSTICK ==========
  private removeVirtualJoystickListeners(): void {
    if (this.joystickTarget && this.joystickTouchStartHandler) {
      this.joystickTarget.removeEventListener("touchstart", this.joystickTouchStartHandler);
    }
    if (this.joystickWindowTouchStartCaptureHandler) {
      window.removeEventListener("touchstart", this.joystickWindowTouchStartCaptureHandler, { capture: true } as EventListenerOptions);
    }
    if (this.joystickWindowTouchMoveCaptureHandler) {
      window.removeEventListener("touchmove", this.joystickWindowTouchMoveCaptureHandler, { capture: true } as EventListenerOptions);
    }
    if (this.joystickWindowTouchEndCaptureHandler) {
      window.removeEventListener("touchend", this.joystickWindowTouchEndCaptureHandler, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchcancel", this.joystickWindowTouchEndCaptureHandler, { capture: true } as EventListenerOptions);
    }

    this.joystickTarget = undefined;
    this.joystickTouchStartHandler = undefined;
    this.joystickWindowTouchStartCaptureHandler = undefined;
    this.joystickWindowTouchMoveCaptureHandler = undefined;
    this.joystickWindowTouchEndCaptureHandler = undefined;
  }

  private isTouchInsideRect(touch: Touch, rect: DOMRect): boolean {
    return (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    );
  }

  private findTouchById(touches: TouchList, identifier: number | null): Touch | undefined {
    if (identifier === null) return undefined;
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === identifier) {
        return touches[i];
      }
    }
    return undefined;
  }

  setupVirtualJoystick(): void {
    this.removeVirtualJoystickListeners();

    const joystick = this.getCachedElement('virtual-joystick');
    const knob = this.getCachedElement('joystick-knob');
    
    if (!joystick || !knob) return;

    this.joystickTarget = joystick;
    joystick.style.touchAction = "none";
    joystick.style.pointerEvents = "auto";
    knob.style.pointerEvents = "none";
    
    let joystickRadius = 80; // Half of container width
    let knobRadius = 30; // Half of knob width
    let deadzone = 15; // Pixels before registering input
    let jumpThreshold = -50; // Y offset to trigger jump
    
    let centerX = 0;
    let centerY = 0;

    const startJoystickTracking = (touch: Touch) => {
      const rect = joystick.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      joystickRadius = rect.width / 2;
      knobRadius = Math.max(20, knob.getBoundingClientRect().width / 2);
      deadzone = Math.max(8, joystickRadius * 0.14);
      jumpThreshold = -Math.max(30, joystickRadius * 0.5);
      
      this.joystickActive = true;
      this.joystickTouchId = touch.identifier;
      this.joystickStartX = touch.clientX;
      this.joystickStartY = touch.clientY;
      this.joystickCircleStartTime = performance.now();
      this.joystickRotationAccum = 0;
      this.joystickSecretTriggered = false;
      this.joystickLastAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
      
      knob.classList.add('active');
      this.triggerHapticFeedback('light');
      
      this.handleJoystickMove(touch.clientX, touch.clientY, centerX, centerY, knob, joystickRadius, knobRadius, deadzone, jumpThreshold);
    };

    const stopJoystickTracking = () => {
      if (!this.joystickActive) return;
      this.joystickActive = false;
      this.joystickTouchId = null;

      // Reset knob position
      knob.style.transform = "translate(-50%, -50%)";
      knob.classList.remove("active");

      // Release all movement inputs
      this.emitTouchInput("left", false);
      this.emitTouchInput("right", false);
      this.emitTouchInput("jump", false);
      this.touchInputState.left = false;
      this.touchInputState.right = false;
      this.touchJumpPressed = false;
    };

    this.joystickTouchStartHandler = (e: TouchEvent) => {
      const touch = e.changedTouches[0] || e.touches[0];
      if (!touch) return;
      e.preventDefault();
      startJoystickTracking(touch);
    };

    // Capture-phase fallback: start joystick tracking even if another overlay
    // unexpectedly receives the initial touch target.
    this.joystickWindowTouchStartCaptureHandler = (e: TouchEvent) => {
      if (this.joystickActive) return;
      const touch = e.changedTouches[0] || e.touches[0];
      if (!touch) return;

      const rect = joystick.getBoundingClientRect();
      if (!this.isTouchInsideRect(touch, rect)) return;

      e.preventDefault();
      startJoystickTracking(touch);
    };

    this.joystickWindowTouchMoveCaptureHandler = (e: TouchEvent) => {
      if (!this.joystickActive) return;
      const touch =
        this.findTouchById(e.touches, this.joystickTouchId) ||
        this.findTouchById(e.changedTouches, this.joystickTouchId);
      if (!touch) return;

      e.preventDefault();
      this.handleJoystickMove(touch.clientX, touch.clientY, centerX, centerY, knob, joystickRadius, knobRadius, deadzone, jumpThreshold);
    };

    this.joystickWindowTouchEndCaptureHandler = (e: TouchEvent) => {
      if (!this.joystickActive) return;

      const trackedTouch = this.findTouchById(e.touches, this.joystickTouchId);
      if (trackedTouch) return;

      e.preventDefault();
      stopJoystickTracking();
    };

    joystick.addEventListener("touchstart", this.joystickTouchStartHandler, { passive: false });
    window.addEventListener("touchstart", this.joystickWindowTouchStartCaptureHandler, { passive: false, capture: true });
    window.addEventListener("touchmove", this.joystickWindowTouchMoveCaptureHandler, { passive: false, capture: true });
    window.addEventListener("touchend", this.joystickWindowTouchEndCaptureHandler, { passive: false, capture: true });
    window.addEventListener("touchcancel", this.joystickWindowTouchEndCaptureHandler, { passive: false, capture: true });
  }
  
  private handleJoystickMove(
    touchX: number, 
    touchY: number, 
    centerX: number, 
    centerY: number, 
    knob: HTMLElement, 
    joystickRadius: number, 
    knobRadius: number, 
    deadzone: number,
    jumpThreshold: number
  ): void {
    let dx = touchX - centerX;
    let dy = touchY - centerY;
    
    // Limit to joystick bounds
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = joystickRadius - knobRadius;
    
    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    // Update knob visual position
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    
    // Determine input based on position
    const wasLeft = this.touchInputState?.left || false;
    const wasRight = this.touchInputState?.right || false;
    const wasJump = this.touchJumpPressed;

    // Secret input: rotate joystick in circles ~3 turns quickly.
    if (distance > deadzone) {
      const currentAngle = Math.atan2(dy, dx);
      let deltaAngle = currentAngle - this.joystickLastAngle;
      if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.joystickRotationAccum += deltaAngle;
      this.joystickLastAngle = currentAngle;

      const elapsed = performance.now() - this.joystickCircleStartTime;
      const turns = Math.abs(this.joystickRotationAccum) / (Math.PI * 2);
      if (!this.joystickSecretTriggered && elapsed <= 4000 && turns >= 3) {
        this.joystickSecretTriggered = true;
        this.triggerHapticFeedback("success");
        this.showNotification("🤫 tästä ei puhuta", 1800);
      }
    }
    
    // Horizontal movement
    if (dx < -deadzone) {
      if (!wasLeft) {
        this.triggerHapticFeedback('light');
      }
      this.emitTouchInput("left", true);
      this.emitTouchInput("right", false);
      this.touchInputState.left = true;
      this.touchInputState.right = false;
    } else if (dx > deadzone) {
      if (!wasRight) {
        this.triggerHapticFeedback('light');
      }
      this.emitTouchInput("right", true);
      this.emitTouchInput("left", false);
      this.touchInputState.left = false;
      this.touchInputState.right = true;
    } else {
      this.emitTouchInput("left", false);
      this.emitTouchInput("right", false);
      this.touchInputState.left = false;
      this.touchInputState.right = false;
    }
    
    // Vertical for jump (push up on joystick)
    if (dy < jumpThreshold) {
      if (!wasJump) {
        this.touchJumpPressed = true;
        this.emitTouchInput("jump", true);
        this.triggerHapticFeedback('medium');
      }
    } else {
      if (wasJump) {
        this.touchJumpPressed = false;
        this.emitTouchInput("jump", false);
      }
    }
  }
  
  // Touch input state reference
  private touchInputState: { left: boolean; right: boolean } = { left: false, right: false };
  
  // ========== SWIPE GESTURES ==========
  setupSwipeGestures(): void {
    this.removeSwipeGestureListeners();

    const gameContainer = this.getCachedElement('game-container');
    if (!gameContainer) return;
    
    const minSwipeDistance = 50;
    const maxSwipeTime = 300; // ms

    const isControlElementTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return !!target.closest('#mobile-movement-controls, #mobile-attack-controls, #mobile-center-controls');
    };
    
    // Track swipe on the game area (not on buttons)
    this.swipeTouchStartHandler = (e: TouchEvent) => {
      // Ignore if touching a control button
      if (isControlElementTarget(e.target)) {
        this.swipeTrackingActive = false;
        return;
      }
      
      this.swipeStartY = e.touches[0].clientY;
      this.swipeStartTime = Date.now();
      this.swipeTrackingActive = true;
    };
    
    this.swipeTouchEndHandler = (e: TouchEvent) => {
      // Ignore if touching a control button
      if (isControlElementTarget(e.target)) {
        this.swipeTrackingActive = false;
        return;
      }

      if (!this.swipeTrackingActive) {
        return;
      }
      this.swipeTrackingActive = false;
      
      const swipeEndY = e.changedTouches[0].clientY;
      const swipeTime = Date.now() - this.swipeStartTime;
      const swipeDistance = this.swipeStartY - swipeEndY;
      
      // Check for upward swipe (for jump)
      if (swipeTime < maxSwipeTime && swipeDistance > minSwipeDistance) {
        this.touchJumpPressed = true;
        this.emitTouchInput("jump", true);
        this.triggerHapticFeedback('medium');
        
        // Auto-release jump after short delay
        setTimeout(() => {
          this.touchJumpPressed = false;
          this.emitTouchInput("jump", false);
        }, 150);
      }
      
      // Check for downward swipe (for voltti/stomp)
      if (swipeTime < maxSwipeTime && swipeDistance < -minSwipeDistance) {
        this.touchVolttiPressed = true;
        this.emitTouchInput("voltti", true);
        this.triggerHapticFeedback('heavy');
        
        setTimeout(() => {
          this.touchVolttiPressed = false;
          this.emitTouchInput("voltti", false);
        }, 150);
      }
    };

    gameContainer.addEventListener('touchstart', this.swipeTouchStartHandler, { passive: true });
    gameContainer.addEventListener('touchend', this.swipeTouchEndHandler, { passive: true });
    this.swipeGestureTarget = gameContainer;
  }

  private removeSwipeGestureListeners(): void {
    if (this.swipeGestureTarget && this.swipeTouchStartHandler) {
      this.swipeGestureTarget.removeEventListener('touchstart', this.swipeTouchStartHandler);
    }
    if (this.swipeGestureTarget && this.swipeTouchEndHandler) {
      this.swipeGestureTarget.removeEventListener('touchend', this.swipeTouchEndHandler);
    }
    this.swipeGestureTarget = null;
    this.swipeTouchStartHandler = undefined;
    this.swipeTouchEndHandler = undefined;
    this.swipeTrackingActive = false;
  }

  private registerTouchControlListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, handler, options as AddEventListenerOptions);
    const capture =
      typeof options === "boolean" ? options : !!(options as AddEventListenerOptions | undefined)?.capture;
    this.touchControlCleanupCallbacks.push(() => {
      target.removeEventListener(type, handler, capture);
    });
  }

  private clearTouchControlListeners(): void {
    if (!this.touchControlCleanupCallbacks.length) return;
    this.touchControlCleanupCallbacks.forEach((cleanup) => cleanup());
    this.touchControlCleanupCallbacks = [];
  }

  private isTouchInsideElement(touch: Touch, element: HTMLElement): boolean {
    return this.isTouchInsideRect(touch, element.getBoundingClientRect());
  }
  
  // ========== GESTURE HINT ==========
  showGestureHint(): void {
    const hint = this.getCachedElement('swipe-gesture-hint');
    if (!hint) return;
    
    // Show hint after 1 second
    setTimeout(() => {
      hint.style.opacity = '1';
      
      // Hide after 3 seconds
      setTimeout(() => {
        hint.style.opacity = '0';
        sessionStorage.setItem('gestureHintShown', 'true');
      }, 3000);
    }, 1000);
  }
  
  setupTouchButton(buttonId: string, onPress: () => void, onRelease: () => void): void {
    const button = this.getCachedElement(buttonId);
    if (!button) return;
    
    // Determine haptic type based on button
    let hapticType: "light" | "medium" | "heavy" = "light";
    if (buttonId === "touch-axe-btn" || buttonId === "touch-rage-btn") {
      hapticType = "heavy";
    } else if (
      buttonId === "touch-pole-btn"
      || buttonId === "touch-voltti-btn"
      || buttonId === "touch-dodge-btn"
    ) {
      hapticType = "medium";
    }
    
    button.style.touchAction = "none";

    let pressed = false;
    let activeTouchId: number | null = null;

    const startFromTouch = (event: TouchEvent, touch: Touch, requireInside: boolean): void => {
      if (pressed) return;
      if (requireInside && !this.isTouchInsideElement(touch, button)) return;
      event.preventDefault();
      pressed = true;
      activeTouchId = touch.identifier;
      this.triggerHapticFeedback(hapticType);
      onPress();
    };

    const endPress = (event: TouchEvent): void => {
      if (!pressed) return;
      if (activeTouchId !== null && this.findTouchById(event.touches, activeTouchId)) return;
      event.preventDefault();
      pressed = false;
      activeTouchId = null;
      onRelease();
    };

    const elementTouchStartHandler = (event: Event): void => {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.changedTouches[0] || touchEvent.touches[0];
      if (!touch) return;
      startFromTouch(touchEvent, touch, false);
    };

    const elementTouchEndHandler = (event: Event): void => {
      endPress(event as TouchEvent);
    };

    const captureTouchStartHandler = (event: Event): void => {
      const touchEvent = event as TouchEvent;
      if (pressed) return;
      for (let i = 0; i < touchEvent.changedTouches.length; i++) {
        const touch = touchEvent.changedTouches[i];
        if (!touch) continue;
        if (!this.isTouchInsideElement(touch, button)) continue;
        startFromTouch(touchEvent, touch, true);
        break;
      }
    };

    const captureTouchEndHandler = (event: Event): void => {
      endPress(event as TouchEvent);
    };

    this.registerTouchControlListener(button, "touchstart", elementTouchStartHandler, { passive: false });
    this.registerTouchControlListener(button, "touchend", elementTouchEndHandler, { passive: false });
    this.registerTouchControlListener(button, "touchcancel", elementTouchEndHandler, { passive: false });

    // Capture fallback so buttons still work if another invisible layer steals targeting on iOS.
    this.registerTouchControlListener(window, "touchstart", captureTouchStartHandler, {
      passive: false,
      capture: true
    });
    this.registerTouchControlListener(window, "touchend", captureTouchEndHandler, {
      passive: false,
      capture: true
    });
    this.registerTouchControlListener(window, "touchcancel", captureTouchEndHandler, {
      passive: false,
      capture: true
    });

    // Desktop fallback removed in mobile-only build.
  }

  setupTouchActionButton(
    buttonId: string,
    onTap: () => void,
    hapticType: "light" | "medium" | "heavy" = "light"
  ): void {
    const button = this.getCachedElement(buttonId);
    if (!button) return;
    button.style.touchAction = "manipulation";

    let lastTouchStartAt = -1000;
    let lastHandledTouchId: number | null = null;
    let lastHandledTouchAt = -1000;

    const triggerTapFromTouch = (touchEvent: TouchEvent, touch: Touch, requireInside: boolean): boolean => {
      if (requireInside && !this.isTouchInsideElement(touch, button)) return false;
      const now = performance.now();
      if (lastHandledTouchId === touch.identifier && now - lastHandledTouchAt < 260) {
        return false;
      }
      lastHandledTouchId = touch.identifier;
      lastHandledTouchAt = now;
      touchEvent.preventDefault();
      lastTouchStartAt = now;
      this.triggerHapticFeedback(hapticType);
      onTap();
      return true;
    };

    const touchStartHandler = (event: Event): void => {
      const touchEvent = event as TouchEvent;
      for (let i = 0; i < touchEvent.changedTouches.length; i++) {
        const touch = touchEvent.changedTouches[i];
        if (!touch) continue;
        if (triggerTapFromTouch(touchEvent, touch, false)) break;
      }
    };

    const captureTouchStartHandler = (event: Event): void => {
      const touchEvent = event as TouchEvent;
      for (let i = 0; i < touchEvent.changedTouches.length; i++) {
        const touch = touchEvent.changedTouches[i];
        if (!touch) continue;
        if (triggerTapFromTouch(touchEvent, touch, true)) break;
      }
    };

    const clickHandler = (event: Event): void => {
      const clickEvent = event as MouseEvent;
      clickEvent.preventDefault();
      // Ignore synthetic click that often follows touchstart on iOS/Android.
      if (performance.now() - lastTouchStartAt < 450) return;
      onTap();
    };

    this.registerTouchControlListener(button, "touchstart", touchStartHandler, { passive: false });
    this.registerTouchControlListener(window, "touchstart", captureTouchStartHandler, {
      passive: false,
      capture: true
    });
    this.registerTouchControlListener(button, "click", clickHandler);
  }
  
  emitTouchInput(inputType: string, pressed: boolean): void {
    if (!this.currentGameSceneKey) return;
    
    const gameScene = this.scene.get(this.currentGameSceneKey);
    if (!gameScene) return;
    
    // Emit touch input event to game scene
    gameScene.events.emit("touchInput", { type: inputType, pressed });
  }

  private syncTutorialScenePauseState(paused: boolean): void {
    if (this.currentLevel !== 1) return;
    const tutorialSceneKey = "TutorialUIScene";
    try {
      const tutorialScene = this.scene.get(tutorialSceneKey) as any;
      const tutorialActive = this.scene.isActive(tutorialSceneKey);
      const tutorialPaused = this.scene.isPaused(tutorialSceneKey);
      if (paused) {
        tutorialScene?.setPausedPresentation?.(true);
        if (tutorialActive && !tutorialPaused) {
          this.scene.pause(tutorialSceneKey);
        }
      } else if (tutorialPaused) {
        this.scene.resume(tutorialSceneKey);
        tutorialScene?.setPausedPresentation?.(false);
      } else {
        tutorialScene?.setPausedPresentation?.(false);
      }
    } catch {
      // Keep pause flow robust even if tutorial scene is not available.
    }
  }
  
  togglePause(): void {
    if (!this.currentGameSceneKey) return;
    
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;

    const pauseOverlay = this.getCachedElement("pause-overlay");

    // Use GameScene's own pause path so music/native fallback pause+resume stays in sync.
    if (typeof gameScene.togglePause === "function") {
      gameScene.togglePause();
      this.isPaused = !!gameScene.isPaused;
    } else {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        if (!(gameScene.scene as any).isPaused()) {
          gameScene.scene.pause();
        }
      } else {
        if ((gameScene.scene as any).isPaused()) {
          gameScene.scene.resume();
        }
      }
    }

    if (pauseOverlay) {
      pauseOverlay.style.opacity = this.isPaused ? "1" : "0";
      pauseOverlay.style.pointerEvents = this.isPaused ? "auto" : "none";
    }

    this.syncTutorialScenePauseState(this.isPaused);
    if (!this.isPaused) {
      this.resetPauseMainMenuConfirmation();
    }
  }

  private setPauseMainMenuButtonPrompt(isConfirmArmed: boolean): void {
    const pauseMainMenuBtn = this.getCachedElement("pause-main-menu-btn");
    if (!pauseMainMenuBtn) return;
    const label = pauseMainMenuBtn.querySelector("span");
    if (!label) return;
    label.textContent = isConfirmArmed ? getConfirmAgainText() : "🏠 PÄÄVALIKKO";
  }

  private resetPauseMainMenuConfirmation(): void {
    this.pauseMainMenuConfirmArmedUntil = 0;
    if (typeof window !== "undefined" && this.pauseMainMenuConfirmResetTimerId) {
      window.clearTimeout(this.pauseMainMenuConfirmResetTimerId);
      this.pauseMainMenuConfirmResetTimerId = undefined;
    }
    this.setPauseMainMenuButtonPrompt(false);
  }
  
  setupAudioToggle(): void {
    const audioToggleBtn = this.getCachedElement("audio-toggle-btn");
    const audioIcon = this.getCachedElement("audio-icon");
    const audioText = this.getCachedElement("audio-text");
    const bindUnifiedTap = (
      element: HTMLElement,
      onTap: () => void,
      options: { backdropOnly?: boolean } = {}
    ): void => {
      let lastTouchAt = -1000;
      let lastTapAt = -1000;

      const isValidTarget = (event: Event): boolean => {
        if (options.backdropOnly && event.target !== element) return false;
        return true;
      };

      const handleTap = (now: number): void => {
        lastTapAt = now;
        onTap();
      };

      element.addEventListener(
        "touchend",
        (event) => {
          if (!isValidTarget(event)) return;
          const touchEvent = event as TouchEvent;
          if (!touchEvent.changedTouches.length) return;
          event.preventDefault();
          event.stopPropagation();
          const now = performance.now();
          lastTouchAt = now;
          handleTap(now);
        },
        { passive: false }
      );

      element.addEventListener("pointerup", (event) => {
        if (!isValidTarget(event)) return;
        const now = performance.now();
        const pointerEvent = event as PointerEvent;
        if (pointerEvent.pointerType === "touch" && now - lastTouchAt < 450) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        handleTap(now);
      });

      element.addEventListener("click", (event) => {
        if (!isValidTarget(event)) return;
        const now = performance.now();
        event.preventDefault();
        event.stopPropagation();
        if (now - lastTapAt < 280) return;
        if (now - lastTouchAt < 450) return;
        handleTap(now);
      });
    };
    
    if (audioToggleBtn && audioIcon && audioText) {
      // Initialize based on current sound manager state
      this.updateAudioToggleUI();
      
      audioToggleBtn.addEventListener("click", () => {
        this.setGlobalMute(!this.sound.mute);
      });
    }
    
    // Setup main menu button in pause overlay
    const pauseMainMenuBtn = this.getCachedElement("pause-main-menu-btn");
    if (pauseMainMenuBtn) {
      bindUnifiedTap(pauseMainMenuBtn, () => {
        const now = performance.now();
        if (now <= this.pauseMainMenuConfirmArmedUntil) {
          this.resetPauseMainMenuConfirmation();
          this.goToMainMenu();
          return;
        }

        this.pauseMainMenuConfirmArmedUntil = now + 1400;
        this.setPauseMainMenuButtonPrompt(true);
        this.sound.play("ui_click_sound", { volume: 0.25 });

        if (typeof window !== "undefined") {
          if (this.pauseMainMenuConfirmResetTimerId) {
            window.clearTimeout(this.pauseMainMenuConfirmResetTimerId);
          }
          this.pauseMainMenuConfirmResetTimerId = window.setTimeout(() => {
            this.resetPauseMainMenuConfirmation();
          }, 1450);
        }
      });
    }

    const pauseOverlay = this.getCachedElement("pause-overlay");
    if (pauseOverlay) {
      bindUnifiedTap(pauseOverlay, () => {
        if (!this.isPaused) return;
        this.togglePause();
      }, {
        backdropOnly: true
      });
    }

    const fakeReplyBtn = this.getCachedElement("pause-fake-reply-btn");
    if (fakeReplyBtn) {
      bindUnifiedTap(fakeReplyBtn, () => {
        this.sound.play("ui_click_sound", { volume: 0.35 });
        this.resetPauseMainMenuConfirmation();
        if (this.isPaused) this.togglePause();
      });
    }
  }

  setupTutorialSkipButton(): void {
    if (this.currentLevel !== 1) return;

    const skipTutorialBtn = this.getCachedElement("skip-tutorial-btn");
    if (!skipTutorialBtn) return;

    let lastTouchStartAt = -1000;
    const requestSkip = () => {
      if (!this.currentGameSceneKey) return;
      const gameScene = this.scene.get(this.currentGameSceneKey) as any;
      if (!gameScene || gameScene.levelCompleted || gameScene.player?.isDead) return;

      this.sound.play("ui_click_sound", { volume: 0.35 });
      gameScene.events.emit("skipTutorialRequested");
    };

    skipTutorialBtn.addEventListener("touchstart", (event) => {
      event.preventDefault();
      lastTouchStartAt = performance.now();
      this.triggerHapticFeedback("light");
      requestSkip();
    }, { passive: false });

    skipTutorialBtn.addEventListener("click", (event) => {
      event.preventDefault();
      if (performance.now() - lastTouchStartAt < 450) return;
      requestSkip();
    });
  }
  
  goToMainMenu(): void {
    this.resetPauseMainMenuConfirmation();
    // Play UI click sound
    this.sound.play("ui_click_sound", { volume: 0.5 });
    
    // Stop all sounds
    this.sound.stopAll();
    
    // Stop the game scene if running
    if (this.currentGameSceneKey) {
      const gameScene = this.scene.get(this.currentGameSceneKey);
      if (gameScene) {
        this.scene.stop(this.currentGameSceneKey);
      }
    }
    
    // Stop this UI scene
    this.scene.stop("UIScene");

    // Ensure tutorial overlay scene never lingers on top of main menu.
    if (this.scene.isActive("TutorialUIScene") || this.scene.isPaused("TutorialUIScene")) {
      this.scene.stop("TutorialUIScene");
    }
    
    // Start the title screen
    this.scene.start("TitleScreen");
  }
  
  updateAudioToggleUI(): void {
    const audioIcon = this.getCachedElement("audio-icon");
    const audioText = this.getCachedElement("audio-text");
    const audioToggleBtn = this.getCachedElement("audio-toggle-btn");
    
    if (audioIcon && audioText && audioToggleBtn) {
      if (this.sound.mute) {
        audioIcon.textContent = "🔇";
        audioText.textContent = "MYKISTETTY";
        audioToggleBtn.className = "game-pixel-container-clickable-red-700 px-3 py-2 flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity cursor-pointer";
      } else {
        audioIcon.textContent = "🔊";
        audioText.textContent = "ÄÄNI";
        audioToggleBtn.className = "game-pixel-container-clickable-gray-700 px-3 py-2 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity cursor-pointer";
      }
    }
  }
  
  setupEventListeners(): void {
    if (!this.currentGameSceneKey) return;
    
    const gameScene = this.scene.get(this.currentGameSceneKey);
    if (!gameScene) return;
    
    // Clear any existing handlers first
    this.removeEventListeners();
    
    // Create bound handlers for proper cleanup
    const trickCompleteHandler = (data: { trickType: string; points: number; tricksRemaining: number; rampBoost?: boolean }) => {
      this.showTrickCompleteEffect(data);
    };
    this.boundEventHandlers.set("trickComplete", trickCompleteHandler);
    gameScene.events.on("trickComplete", trickCompleteHandler);
    
    const livesChangedHandler = (lives: number) => {
      this.lives = lives;
      this.updateLivesDisplay();
    };
    this.boundEventHandlers.set("livesChanged", livesChangedHandler);
    gameScene.events.on("livesChanged", livesChangedHandler);
    
    const bossSpawnedHandler = (data: {
      bossName: string;
      isFinalBoss: boolean;
      bossDescription?: string;
      bossType?: string;
      bossRetryDeaths?: number;
    }) => {
      this.showBossWarning(data);
    };
    this.boundEventHandlers.set("bossSpawned", bossSpawnedHandler);
    gameScene.events.on("bossSpawned", bossSpawnedHandler);
    
    const bossDefeatedHandler = (data: { bossType: string; isFinalBoss: boolean; scoreValue: number }) => {
      this.showBossDefeated(data);
    };
    this.boundEventHandlers.set("bossDefeated", bossDefeatedHandler);
    gameScene.events.on("bossDefeated", bossDefeatedHandler);

    const bossMidfightVideoRequestedHandler = (data: { videoUrl?: string; hintText?: string }) => {
      this.showBossMidfightVideo(data);
    };
    this.boundEventHandlers.set("bossMidfightVideoRequested", bossMidfightVideoRequestedHandler);
    gameScene.events.on("bossMidfightVideoRequested", bossMidfightVideoRequestedHandler);

    const rageActivatedHandler = () => {
      this.showRageActivatedEffect();
    };
    this.boundEventHandlers.set("rageActivated", rageActivatedHandler);
    gameScene.events.on("rageActivated", rageActivatedHandler);

    const rageGainedHandler = (data: { currentRage: number; maxRage: number; percentage: number }) => {
      this.showRageGainEffect(data);
    };
    this.boundEventHandlers.set("rageGained", rageGainedHandler);
    gameScene.events.on("rageGained", rageGainedHandler);
    
    const powerUpCollectedHandler = (data: { 
      type: string; 
      name: string; 
      description: string; 
      icon: string; 
      duration: number; 
      endTime: number;
      color: string;
    }) => {
      this.onPowerUpCollected(data);
    };
    this.boundEventHandlers.set("powerUpCollected", powerUpCollectedHandler);
    gameScene.events.on("powerUpCollected", powerUpCollectedHandler);
    
    const attackPerformedHandler = (data: { attackType: string }) => {
      this.showKeyPressFeedback(data.attackType);
    };
    this.boundEventHandlers.set("attackPerformed", attackPerformedHandler);
    gameScene.events.on("attackPerformed", attackPerformedHandler);
    
    const playerHitHandler = (data: {
      damage: number;
      healthRemaining: number;
      healthPercent: number;
      lowEnergyDamagePenalty?: boolean;
      energyPercent?: number;
    }) => {
      this.showPlayerHitFeedback(data);
    };
    this.boundEventHandlers.set("playerHit", playerHitHandler);
    gameScene.events.on("playerHit", playerHitHandler);
    
    // Stomp combo display removed - ilmaketju feature disabled
    
    // New enemy announcement removed - enemies now speak for themselves with funny taunts!
    
    const bossPhaseChangedHandler = (data: { bossType: string; oldPhase: number; newPhase: number }) => {
      this.showBossPhaseChange(data);
    };
    this.boundEventHandlers.set("bossPhaseChanged", bossPhaseChangedHandler);
    gameScene.events.on("bossPhaseChanged", bossPhaseChangedHandler);

    const bossAttackTelegraphHandler = (data: { kind?: string; attackName?: string; bossType?: string }) => {
      const kind = data?.kind || "normal";
      if (kind === "normal") return;
      if (kind === "phase") {
        const phaseText = data?.attackName ? `VAIHEVAIHTO: ${data.attackName}` : "BOSSI RAAIVOUTUU!";
        this.showBossSpecialAttackWarning("⚠️", phaseText, "orange");
        return;
      }
      if (kind === "charge") {
        this.showBossSpecialAttackWarning("⚡", data?.attackName || "RYNNÄKKÖ!", "orange");
        return;
      }
      if (kind === "combo") {
        this.showBossSpecialAttackWarning("💥", data?.attackName || "COMBO!", "red");
        return;
      }
      if (kind === "leap" || kind === "aoe" || kind === "hazard" || kind === "barrage") {
        this.showBossSpecialAttackWarning("🌀", data?.attackName || "ALUEVAARA!", "blue");
        return;
      }
      if (kind === "super") {
        const superText = data?.attackName ? `ERIKOIS: ${data.attackName}` : "ERIKOISISKU!";
        this.showBossSpecialAttackWarning("☣️", superText, "red");
        return;
      }
      const extraText = data?.attackName || "BOSSIERIKOIS!";
      this.showBossSpecialAttackWarning("❗", extraText, "orange");
    };
    this.boundEventHandlers.set("bossAttackTelegraph", bossAttackTelegraphHandler);
    gameScene.events.on("bossAttackTelegraph", bossAttackTelegraphHandler);
    
    const bossChargingHandler = (data: { bossType: string }) => {
      this.showBossChargeWarning();
    };
    this.boundEventHandlers.set("bossCharging", bossChargingHandler);
    gameScene.events.on("bossCharging", bossChargingHandler);
    
    const bossComboAttackHandler = (data: { bossType: string }) => {
      this.showBossComboWarning();
    };
    this.boundEventHandlers.set("bossComboAttack", bossComboAttackHandler);
    gameScene.events.on("bossComboAttack", bossComboAttackHandler);

    const bossLowHealthPulseHandler = (data: { intensity?: "high" | "critical"; bossType?: string }) => {
      const pulseText = data?.intensity === "critical" ? "BOSSI PANIKOI!" : "BOSSI HEIKKONA!";
      this.showBossSpecialAttackWarning("❤️", pulseText, "red");
    };
    this.boundEventHandlers.set("bossLowHealthPulse", bossLowHealthPulseHandler);
    gameScene.events.on("bossLowHealthPulse", bossLowHealthPulseHandler);
    
    // Rage blocked handler - show warning when player tries to use rage during boss fight
    const rageBlockedHandler = (data: { message: string }) => {
      this.showRageBlockedWarning(data.message);
    };
    this.boundEventHandlers.set("rageBlocked", rageBlockedHandler);
    gameScene.events.on("rageBlocked", rageBlockedHandler);
    
    // Power-ups cancelled handler - show notification when boss fight starts
    const powerUpsCancelledHandler = () => {
      this.showPowerUpsCancelledNotice();
    };
    this.boundEventHandlers.set("powerUpsCancelled", powerUpsCancelledHandler);
    gameScene.events.on("powerUpsCancelled", powerUpsCancelledHandler);
    
    // Floating announcement handler - shows landmark names and other centered announcements
    const floatingAnnouncementHandler = (data: { text: string; duration?: number }) => {
      this.showFloatingAnnouncement(data.text, data.duration || 2000);
    };
    this.boundEventHandlers.set("floatingAnnouncement", floatingAnnouncementHandler);
    gameScene.events.on("floatingAnnouncement", floatingAnnouncementHandler);

    const gameplayTelegraphHandler = (data: { text?: string; color?: "orange" | "red" | "blue"; icon?: string; duration?: number }) => {
      const text = data?.text || "VARO!";
      const color = data?.color || "orange";
      const icon = data?.icon || "⚠️";
      this.showGameplayTelegraph(icon, text, color, data?.duration || 1400);
    };
    this.boundEventHandlers.set("gameplayTelegraph", gameplayTelegraphHandler);
    gameScene.events.on("gameplayTelegraph", gameplayTelegraphHandler);

    const weatherChangedHandler = (data: { type?: string; active?: boolean }) => {
      const weather = typeof data?.type === "string" ? data.type : "clear";
      this.applyWeatherWarningState(weather);
    };
    this.boundEventHandlers.set("weatherChanged", weatherChangedHandler);
    gameScene.events.on("weatherChanged", weatherChangedHandler);

    const lowFpsEmergencyHandler = (data: { enabled: boolean }) => {
      this.uiEmergencyLowFps = !!data?.enabled;
      if (this.uiEmergencyLowFps) {
        this.uiUpdateIntervalMs = Math.max(this.uiUpdateIntervalMs, 120);
        this.uiHeavyUpdateIntervalMs = Math.max(this.uiHeavyUpdateIntervalMs, 280);
      } else {
        this.tuneUiRefreshRate(this.lastKnownQualityTier || undefined);
      }
    };
    this.boundEventHandlers.set("lowFpsEmergency", lowFpsEmergencyHandler);
    gameScene.events.on("lowFpsEmergency", lowFpsEmergencyHandler);
  }
  
  // Remove all event listeners to prevent stacking
  removeEventListeners(): void {
    if (!this.currentGameSceneKey) return;
    
    const gameScene = this.scene.get(this.currentGameSceneKey);
    if (!gameScene) return;
    
    // Remove all bound handlers
    this.boundEventHandlers.forEach((handler, eventName) => {
      gameScene.events.off(eventName, handler);
    });
    this.boundEventHandlers.clear();
  }
  
  // Shutdown method for proper cleanup
  shutdown(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;
    this.hideSuperAbilityGuide(true);
    this.hideBossMidfightVideo();
    this.hideMonikaPreIntroVideo();
    this.hideBossIntroCard();
    this.resetPauseMainMenuConfirmation();
    if (this.overlayKeydownHandler && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.overlayKeydownHandler, { capture: true } as EventListenerOptions);
      this.overlayKeydownHandler = undefined;
    }

    // Remove event listeners
    this.removeEventListeners();
    this.clearTouchControlListeners();
    this.removeVirtualJoystickListeners();
    this.removeSwipeGestureListeners();
    this.removeResponsiveUILayoutListeners();
    
    // Clear active power-ups
    this.activePowerUps.clear();
    this.clearUiElementCache();
    this.lastKnownQualityTier = null;
    
    // Clear UI container
    if (this.uiContainer) {
      this.uiContainer.destroy();
      this.uiContainer = null;
    }
  }
  
  showKeyPressFeedback(attackType: string): void {
    // Key press feedback removed - no longer showing key indicators
  }
  
  // ========== STOMP COMBO DISPLAY - REMOVED ==========
  // Ilmaketju (stomp combo) display feature has been removed
  
  // ========== FLOATING ANNOUNCEMENT ==========
  // Shows landmark names and other centered announcements below combo box
  
  showFloatingAnnouncement(text: string, duration: number = 2000): void {
    const safeText = sanitizePlayerFacingText(text);
    if (!safeText) return;
    if (!FLAVOR_TEXT_ENABLED) {
      const isCriticalNotice =
        safeText.includes("BOSSI") ||
        safeText.includes("RAIVO") ||
        safeText.includes("VARO");
      if (!isCriticalNotice) return;
    }

    const floatingAnnouncement = this.getCachedElement("floating-announcement");
    const floatingAnnouncementText = this.getCachedElement("floating-announcement-text");
    
    if (floatingAnnouncement && floatingAnnouncementText) {
      // Set text content
      floatingAnnouncementText.textContent = safeText;
      
      // Show with animation
      floatingAnnouncement.style.opacity = "1";
      floatingAnnouncement.style.transform = "translateX(-50%) scale(1.1)";
      
      setTimeout(() => {
        floatingAnnouncement.style.transform = "translateX(-50%) scale(1)";
      }, 100);
      
      // Fade out after duration
      setTimeout(() => {
        floatingAnnouncement.style.opacity = "0";
        floatingAnnouncement.style.transform = "translateX(-50%) scale(0.8)";
      }, duration);
    }
  }

  // ========== BOSS PHASE CHANGE ===========
  
  showBossPhaseChange(data: { bossType: string; oldPhase: number; newPhase: number }): void {
    // Create a flash warning for phase change
    const phaseNames = ["", "VAIHE 1", "VAIHE 2 - VAARALLISEMPI!", "VAIHE 3 - RAIVOISA!", "VAIHE 4 - VIIMEINEN YRITYS!"];
    const phaseText = phaseNames[data.newPhase] || `VAIHE ${data.newPhase}`;
    
    // Show phase change in boss warning area
    const bossWarning = this.getCachedElement("boss-warning");
    const bossNameText = this.getCachedElement("boss-name-text");
    
    if (bossWarning && bossNameText) {
      bossNameText.textContent = phaseText;
      bossWarning.style.opacity = "1";
      
      // Hide after 2 seconds
      setTimeout(() => {
        bossWarning.style.opacity = "0";
      }, 2000);
    }
  }
  
  showBossChargeWarning(): void {
    this.showBossSpecialAttackWarning("⚡", "RYNNÄKKÖ!", "orange");
  }
  
  showBossComboWarning(): void {
    this.showBossSpecialAttackWarning("💥", "COMBO!", "red");
  }
  
  showBossSpecialAttackWarning(icon: string, text: string, color: "orange" | "red" | "blue", playSound: boolean = true): void {
    const gameScene = this.currentGameSceneKey ? this.scene.get(this.currentGameSceneKey) as any : undefined;
    const deathAssistMs = Math.min(900, Number(gameScene?.dynamicDifficulty?.consecutiveDeaths || 0) * 180);
    const warningDurationMs = 1600 + deathAssistMs; // Increase warning time if player is struggling.
    const warningContainer = this.getCachedElement("boss-attack-warning");
    const warningBg = this.getCachedElement("boss-attack-warning-bg");
    const warningIcon = this.getCachedElement("boss-attack-warning-icon");
    const warningText = this.getCachedElement("boss-attack-warning-text");
    const damageOverlay = this.getCachedElement("damage-overlay");
    
    if (warningContainer && warningBg && warningIcon && warningText) {
      // Set content
      warningIcon.textContent = icon;
      warningText.textContent = text;
      
      // Set color
      if (color === "red") {
        warningBg.className = "game-pixel-container-red-600 px-8 py-4 flex flex-col items-center gap-2";
        warningBg.style.backgroundColor = "";
        warningBg.style.animation = "bossAttackWarningPulse 0.12s infinite";
      } else if (color === "blue") {
        warningBg.className = "px-8 py-4 flex flex-col items-center gap-2";
        warningBg.style.backgroundColor = "#1d4ed8";
        warningBg.style.animation = "bossAttackWarningPulse 0.15s infinite";
      } else {
        warningBg.className = "game-pixel-container-orange-600 px-8 py-4 flex flex-col items-center gap-2";
        warningBg.style.backgroundColor = "";
        warningBg.style.animation = "bossAttackWarningPulse 0.15s infinite";
      }
      
      // Show warning with scale animation
      warningContainer.style.opacity = "1";
      warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningPopScale})`;
      
      // Play warning sound
      if (playSound) {
        utils.playManagedSound(this, "boss_attack", {
          volume: 0.4,
          rate: 1.5,
          pitchVariation: 0,
          detuneVariation: 0
        });
      }
      
      // Settle animation
      setTimeout(() => {
        warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningScale})`;
      }, 100);
      
      // Hide after delay
      setTimeout(() => {
        warningContainer.style.opacity = "0";
        warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningHideScale})`;
      }, warningDurationMs);
    }
    
    // Also flash screen edge
    if (damageOverlay) {
      damageOverlay.style.backgroundColor = color === "red" ? "#ff0000" : color === "blue" ? "#2a66ff" : "#ff8800";
      damageOverlay.style.opacity = "0.4";
      setTimeout(() => {
        damageOverlay.style.opacity = "0";
        damageOverlay.style.backgroundColor = "#dc2626";
      }, 400);
    }
  }

  showGameplayTelegraph(icon: string, text: string, color: "orange" | "red" | "blue", durationMs: number = 1400): void {
    const clampedDuration = Phaser.Math.Clamp(durationMs, 800, 2600);
    this.showBossSpecialAttackWarning(icon, text, color, false);

    // Override default warning visibility timing for normal gameplay telegraphs.
    const warningContainer = this.getCachedElement("boss-attack-warning");
    if (!warningContainer) return;
    window.setTimeout(() => {
      warningContainer.style.opacity = "0";
      warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningHideScale})`;
    }, clampedDuration);
  }

  showPreRunLoadoutPrompt(data: {
    routeChoices?: Array<{ id: string; label: string; description: string }>;
    passiveChoices?: Array<{ id: string; label: string; description: string }>;
    recommendedRoute?: string;
    recommendedPassive?: string;
  }): void {
    const overlay = this.getCachedElement("pre-run-loadout-overlay");
    const routeWrap = this.getCachedElement("pre-run-route-options");
    const passiveWrap = this.getCachedElement("pre-run-passive-options");
    const confirmBtn = this.getCachedElement("pre-run-confirm-btn") as HTMLButtonElement | null;
    if (!overlay || !routeWrap || !passiveWrap || !confirmBtn) return;

    const routeChoices = data?.routeChoices || [];
    const passiveChoices = data?.passiveChoices || [];
    this.loadoutSelectedRouteId = data?.recommendedRoute || routeChoices[0]?.id || null;
    this.loadoutSelectedPassiveId = data?.recommendedPassive || passiveChoices[0]?.id || null;

    const renderRouteOptions = (): void => {
      routeWrap.innerHTML = routeChoices.map((choice) => `
        <button data-route-id="${choice.id}" class="game-pixel-container-clickable-blue-700 px-2 py-2 text-left pointer-events-auto" style="min-width: 150px;">
          <div class="text-cyan-200 text-xs font-bold">${choice.label}</div>
          <div class="text-gray-200 text-[10px] mt-0.5">${choice.description}</div>
        </button>
      `).join("");
    };

    const renderPassiveOptions = (): void => {
      passiveWrap.innerHTML = passiveChoices.map((choice) => `
        <button data-passive-id="${choice.id}" class="game-pixel-container-clickable-green-600 px-2 py-2 text-left pointer-events-auto" style="min-width: 150px;">
          <div class="text-yellow-200 text-xs font-bold">${choice.label}</div>
          <div class="text-gray-200 text-[10px] mt-0.5">${choice.description}</div>
        </button>
      `).join("");
    };

    const refreshSelectionStyles = (): void => {
      routeWrap.querySelectorAll<HTMLButtonElement>("button[data-route-id]").forEach((button) => {
        const selected = button.dataset.routeId === this.loadoutSelectedRouteId;
        button.style.filter = selected ? "brightness(1.25)" : "brightness(0.92)";
        button.style.boxShadow = selected ? "0 0 14px rgba(34,211,238,0.55)" : "none";
      });
      passiveWrap.querySelectorAll<HTMLButtonElement>("button[data-passive-id]").forEach((button) => {
        const selected = button.dataset.passiveId === this.loadoutSelectedPassiveId;
        button.style.filter = selected ? "brightness(1.25)" : "brightness(0.92)";
        button.style.boxShadow = selected ? "0 0 14px rgba(250,204,21,0.55)" : "none";
      });

      const ready = !!this.loadoutSelectedRouteId && !!this.loadoutSelectedPassiveId;
      confirmBtn.disabled = !ready;
      confirmBtn.style.opacity = ready ? "1" : "0.5";
    };

    renderRouteOptions();
    renderPassiveOptions();

    routeWrap.querySelectorAll<HTMLButtonElement>("button[data-route-id]").forEach((button) => {
      button.onclick = () => {
        this.loadoutSelectedRouteId = button.dataset.routeId || null;
        refreshSelectionStyles();
      };
    });
    passiveWrap.querySelectorAll<HTMLButtonElement>("button[data-passive-id]").forEach((button) => {
      button.onclick = () => {
        this.loadoutSelectedPassiveId = button.dataset.passiveId || null;
        refreshSelectionStyles();
      };
    });

    confirmBtn.onclick = () => {
      const gameScene = this.currentGameSceneKey ? this.scene.get(this.currentGameSceneKey) as any : undefined;
      if (!gameScene || !this.loadoutSelectedRouteId || !this.loadoutSelectedPassiveId) return;
      gameScene.events.emit("preRunLoadoutSelected", {
        routeId: this.loadoutSelectedRouteId,
        passiveId: this.loadoutSelectedPassiveId
      });
      this.hidePreRunLoadoutPrompt();
    };

    refreshSelectionStyles();
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
    overlay.style.pointerEvents = "auto";
  }

  hidePreRunLoadoutPrompt(): void {
    const overlay = this.getCachedElement("pre-run-loadout-overlay");
    if (!overlay) return;
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
    window.setTimeout(() => {
      overlay.style.display = "none";
    }, 180);
  }
  

  showPlayerHitFeedback(data: {
    damage: number;
    healthRemaining: number;
    healthPercent: number;
    lowEnergyDamagePenalty?: boolean;
    energyPercent?: number;
  }): void {
    const damageOverlay = this.getCachedElement("damage-overlay");
    const damageText = this.getCachedElement("damage-text");
    
    if (damageOverlay) {
      // Flash red overlay on hit - intensity based on damage percentage
      const damagePercent = data.damage / (this.currentGameSceneKey ? 
        (this.scene.get(this.currentGameSceneKey) as any)?.player?.maxHealth : 100) || 0.1;
      const opacity = Math.min(0.7, 0.3 + damagePercent * 0.4); // Scale opacity with damage
      damageOverlay.style.opacity = opacity.toString();
      
      // Longer flash for more damage
      const flashDuration = Math.min(400, 150 + damagePercent * 250);
      setTimeout(() => {
        damageOverlay.style.opacity = "0";
      }, flashDuration);
    }
    
    if (damageText) {
      // Show damage number with size based on severity
      const damageSize = Math.min(7, 3 + data.damage / 10); // Larger text for more damage
      damageText.textContent = `-${data.damage}`;
      damageText.style.fontSize = `${damageSize}xl`;
      damageText.style.opacity = "1";
      damageText.style.transform = "translate(-50%, -50%) scale(1.5)";
      
      // Color based on damage severity
      if (data.damage >= 30) {
        damageText.style.color = "#ff0000"; // Red for high damage
      } else if (data.damage >= 15) {
        damageText.style.color = "#ff6600"; // Orange for medium damage
      } else {
        damageText.style.color = "#ffaa00"; // Yellow for low damage
      }
      
      setTimeout(() => {
        damageText.style.opacity = "0";
        damageText.style.transform = "translate(-50%, -50%) scale(0.8)";
      }, 600);
    }
    
    // Flash health bar red briefly
    const healthFill = this.getCachedElement("health-fill");
    if (healthFill) {
      const originalClass = healthFill.className;
      healthFill.className = "game-pixel-container-progress-fill-red-700 h-4 transition-all duration-100";
      setTimeout(() => {
        healthFill.className = originalClass; // Restore original styling
      }, 200);
    }
    
    // Add controller vibration for hit feedback on mobile
    this.triggerHapticFeedback("heavy");

    if (data.lowEnergyDamagePenalty) {
      const now = this.time.now || Date.now();
      if (now - this.lastLowEnergyDamageWarningAt > 1200) {
        this.showFloatingAnnouncement("VAROITUS! Energia vähissä! Enemmän damagea!", 1600);
        this.lastLowEnergyDamageWarningAt = now;
      }
    }
  }
  
  onPowerUpCollected(data: { 
    type: string; 
    name: string; 
    description: string; 
    icon: string; 
    duration: number; 
    endTime: number;
    color: string;
  }): void {
    // Show pickup notification
    this.showPowerUpNotification(data);
    
    // Track active power-ups with duration
    if (data.duration > 0) {
      this.activePowerUps.set(data.type, {
        endTime: data.endTime,
        duration: data.duration
      });
      
      // Show the power-up indicator
      this.showPowerUpIndicator(data.type, true);
    }
  }
  
  showPowerUpNotification(data: { 
    type: string; 
    name: string; 
    description: string; 
    icon: string; 
    color: string;
  }): void {
    const notification = this.getCachedElement("powerup-pickup-notification");
    const notificationBg = this.getCachedElement("powerup-notification-bg");
    const icon = this.getCachedElement("powerup-notification-icon");
    const name = this.getCachedElement("powerup-notification-name");
    const desc = this.getCachedElement("powerup-notification-desc");
    
    if (!notification || !notificationBg || !icon || !name || !desc) return;
    
    // Set content
    icon.textContent = data.icon;
    name.textContent = data.name;
    desc.textContent = data.description;
    
    // Set colors based on power-up type
    switch (data.color) {
      case "yellow":
        notificationBg.className = "game-pixel-container-yellow-500 px-6 py-4 flex flex-col items-center gap-2";
        name.style.color = "#000";
        desc.className = "text-yellow-900 text-lg font-bold";
        desc.style.textShadow = "none";
        break;
      case "cyan":
        notificationBg.className = "game-pixel-container-cyan-400 px-6 py-4 flex flex-col items-center gap-2";
        name.style.color = "#000";
        desc.className = "text-cyan-900 text-lg font-bold";
        desc.style.textShadow = "none";
        break;
      case "blue":
        notificationBg.className = "game-pixel-container-blue-500 px-6 py-4 flex flex-col items-center gap-2";
        name.style.color = "#fff";
        desc.className = "text-green-300 text-lg font-bold";
        desc.style.textShadow = "1px 1px 0px #000";
        break;
      default:
        notificationBg.className = "game-pixel-container-gray-800 px-6 py-4 flex flex-col items-center gap-2";
        name.style.color = "#fff";
        desc.className = "text-yellow-300 text-lg font-bold";
        desc.style.textShadow = "1px 1px 0px #000";
    }
    
    // Show with pop-up animation - starts big, then fades out
    notification.style.opacity = "1";
    notification.style.animation = "powerupNotificationPopBig 1.2s ease-out forwards";
  }
  
  showPowerUpIndicator(type: string, show: boolean): void {
    let containerId = "";
    
    switch (type) {
      case "euro20":
        containerId = "euro20-powerup-container";
        break;
      case "euro50":
        containerId = "euro50-powerup-container";
        break;
      default:
        return;
    }
    
    const container = this.getCachedElement(containerId);
    if (container) {
      if (show) {
        container.style.opacity = "1";
        container.style.transform = "translateX(0)";
        container.style.animation = "powerupSlideIn 0.3s ease-out forwards";
        container.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      } else {
        // Smooth fade-out with slide
        container.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        container.style.opacity = "0";
        container.style.transform = "translateX(-30px) scale(0.9)";
        container.style.animation = "none";
      }
    }
  }
  
  updatePowerUpTimers(currentTime: number): void {
    // Update each active power-up timer
    this.activePowerUps.forEach((powerUp, type) => {
      const remainingTime = powerUp.endTime - currentTime;
      const percentage = Math.max(0, (remainingTime / powerUp.duration) * 100);
      
      // Update timer fill
      let fillId = "";
      switch (type) {
        case "euro20":
          fillId = "euro20-timer-fill";
          break;
        case "euro50":
          fillId = "euro50-timer-fill";
          break;
      }
      
      const fill = this.getCachedElement(fillId);
      if (fill) {
        fill.style.width = `${percentage}%`;
        
        // Flash when about to expire
        if (percentage <= 20) {
          fill.style.animation = "powerupPulse 0.3s infinite";
        } else {
          fill.style.animation = "none";
        }
      }
      
      // Remove expired power-ups
      if (remainingTime <= 0) {
        this.activePowerUps.delete(type);
        this.showPowerUpIndicator(type, false);
      }
    });
  }

  showRageActivatedEffect(): void {
    const rageActivatedDisplay = this.getCachedElement("rage-activated-display");
    const rageEdgeGlow = this.getCachedElement("rage-edge-glow");
    const rageTagline = this.getCachedElement("rage-activated-tagline");
    this.rageReadySince = 0;
    this.rageReadyHintShown = false;
    
    if (rageActivatedDisplay) {
      if (rageTagline) {
        rageTagline.textContent = "LATU ON MINUN JA VAIN MINUN!";
      }
      
      rageActivatedDisplay.style.opacity = "1";
      rageActivatedDisplay.style.transform = "translate(-50%, -50%) scale(1.3)";
      
      setTimeout(() => {
        rageActivatedDisplay.style.opacity = "0";
        rageActivatedDisplay.style.transform = "translate(-50%, -50%) scale(0.8)";
      }, 2000);
    }
    
    // Show red edge glow during rage mode
    if (rageEdgeGlow) {
      rageEdgeGlow.style.opacity = "1";
      rageEdgeGlow.style.animation = "rageEdgeGlowPulse 0.3s infinite";
      
      // Hide after rage duration
      setTimeout(() => {
        rageEdgeGlow.style.opacity = "0";
        rageEdgeGlow.style.animation = "none";
      }, 2500);
    }
  }

  showRageGainEffect(data: { currentRage: number; maxRage: number; percentage: number }): void {
    const rageFill = this.getCachedElement("rage-fill");
    const rageContainer = this.getCachedElement("rage-meter-container");
    
    if (rageFill && rageContainer) {
      // Brief glow effect when gaining rage
      rageFill.style.boxShadow = "0 0 10px #ff0000";
      setTimeout(() => {
        rageFill.style.boxShadow = "none";
      }, 200);
      
      // Pulse when full
      if (data.percentage >= 100) {
        rageContainer.classList.add("rage-ready-pulse");
        if (!this.rageReadySoundPlayed) {
          const played = this.sound.play("powerup_collect", { volume: 0.35, rate: 1.08 });
          if (!played) {
            utils.safePlaySound(this, "powerup_collect", { volume: 0.35, rate: 1.08 });
          }
          this.rageReadySoundPlayed = true;
        }
      }
    }
  }
  
  updateLivesDisplay(): void {
    const livesContainer = this.getCachedElement("lives-container");
    if (livesContainer) {
      let livesHTML = "";
      // Only show heart slots for actual remaining lives
      for (let i = 0; i < this.lives; i++) {
        livesHTML += '<span class="text-lg">❤️</span>';
      }
      livesContainer.innerHTML = livesHTML;
    }
  }
  
  showBossWarning(data: {
    bossName: string;
    isFinalBoss: boolean;
    bossDescription?: string;
    bossType?: string;
    bossRetryDeaths?: number;
  }): void {
    const retryCount = Math.max(0, Math.floor(Number(data?.bossRetryDeaths || 0)));
    if (retryCount > 0) {
      this.showBossIntroCard(data);
      return;
    }
    if (this.getBossPreIntroVideoConfig(data)) {
      this.showMonikaPreIntroVideo(data);
      return;
    }
    this.showBossIntroCard(data);
  }

  private getBossPreIntroVideoConfig(data: {
    bossName: string;
    bossType?: string;
  }): { assetKey: string; fallbackUrl: string; hintText: string } | null {
    const difficulty = normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");
    if (!shouldDifficultyShowVideos(difficulty)) {
      return null;
    }

    const incomingBossType = String(data?.bossType || "").toLowerCase();

    const levelBossConfig = LevelManager.getBossConfig(this.currentLevel);
    const levelBossType = String(levelBossConfig?.bossType || "").toLowerCase();

    let resolvedBossConfig = levelBossConfig && levelBossConfig.bossIntroVideoUrl ? levelBossConfig : null;

    if (incomingBossType && levelBossType !== incomingBossType) {
      resolvedBossConfig = Object.values(LevelManager.BOSS_LEVELS).find((config) => {
        const configBossType = String(config?.bossType || "").toLowerCase();
        return !!config?.bossIntroVideoUrl && configBossType === incomingBossType;
      }) || resolvedBossConfig;
    }

    if (!resolvedBossConfig?.bossIntroVideoUrl) return null;

    const resolvedBossType = String(resolvedBossConfig.bossType || "").toLowerCase();

    const safeBossName = sanitizePlayerFacingText(data?.bossName || resolvedBossConfig.bossNameFi || "BOSSI") || "BOSSI";
    const hintName = safeBossName.toUpperCase();
    return {
      assetKey: `${resolvedBossType || "boss"}_intro_video`,
      fallbackUrl: resolvedBossConfig.bossIntroVideoUrl,
      hintText: formatSkipHintLine(`${hintName} SAAPUU - NAPAUTA OHITTAKSESI`),
    };
  }

  private resolveUiMediaUrl(url: string): string {
    try {
      return new URL(url, window.location.href).toString();
    } catch {
      return url;
    }
  }

  private clearBossPreIntroVideoTapTimeout(): void {
    if (typeof window === "undefined" || !this.bossPreIntroVideoTapEnableTimeoutId) return;
    window.clearTimeout(this.bossPreIntroVideoTapEnableTimeoutId);
    this.bossPreIntroVideoTapEnableTimeoutId = undefined;
  }

  private clearBossPreIntroVideoStartGuardTimeout(): void {
    if (typeof window === "undefined" || !this.bossPreIntroVideoStartGuardTimeoutId) return;
    window.clearTimeout(this.bossPreIntroVideoStartGuardTimeoutId);
    this.bossPreIntroVideoStartGuardTimeoutId = undefined;
  }

  private clearBossMidfightVideoTapTimeout(): void {
    if (typeof window === "undefined" || !this.bossMidfightVideoTapEnableTimeoutId) return;
    window.clearTimeout(this.bossMidfightVideoTapEnableTimeoutId);
    this.bossMidfightVideoTapEnableTimeoutId = undefined;
  }

  private clearBossMidfightVideoStartGuardTimeout(): void {
    if (typeof window === "undefined" || !this.bossMidfightVideoStartGuardTimeoutId) return;
    window.clearTimeout(this.bossMidfightVideoStartGuardTimeoutId);
    this.bossMidfightVideoStartGuardTimeoutId = undefined;
  }

  private hideMonikaPreIntroVideo(skipMediaReset: boolean = false): void {
    const overlay = this.getCachedElement("boss-preintro-video-overlay");
    const video = this.getCachedElement("boss-preintro-video") as HTMLVideoElement | null;
    const hint = this.getCachedElement("boss-preintro-video-hint");

    if (overlay && this.bossPreIntroVideoTapHandler) {
      overlay.removeEventListener("click", this.bossPreIntroVideoTapHandler);
      overlay.removeEventListener("touchend", this.bossPreIntroVideoTapHandler);
    }
    this.bossPreIntroVideoTapHandler = undefined;
    this.clearBossPreIntroVideoTapTimeout();
    this.clearBossPreIntroVideoStartGuardTimeout();

    if (video && this.bossPreIntroVideoEndedHandler) {
      video.removeEventListener("ended", this.bossPreIntroVideoEndedHandler);
    }
    this.bossPreIntroVideoEndedHandler = undefined;
    if (video && this.bossPreIntroVideoErrorHandler) {
      video.removeEventListener("error", this.bossPreIntroVideoErrorHandler);
    }
    this.bossPreIntroVideoErrorHandler = undefined;
    if (video && this.bossPreIntroVideoPlayingHandler) {
      video.removeEventListener("playing", this.bossPreIntroVideoPlayingHandler);
      video.removeEventListener("timeupdate", this.bossPreIntroVideoPlayingHandler);
    }
    this.bossPreIntroVideoPlayingHandler = undefined;

    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
    if (hint) {
      hint.style.opacity = "0.55";
    }

    if (video && !skipMediaReset) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // Ignore one-off media teardown failures.
      }
    }

    this.bossPreIntroVideoActive = false;
    this.bossPreIntroVideoTapReady = false;
  }

  private pauseGameForBossMidfightVideo(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;

    const alreadyPaused = (gameScene.scene as any).isPaused();
    if (!alreadyPaused) {
      if (typeof gameScene.togglePause === "function") {
        gameScene.togglePause();
      } else {
        gameScene.scene.pause();
      }
      this.bossMidfightVideoForcedPause = true;
    } else {
      this.bossMidfightVideoForcedPause = false;
    }
  }

  private resumeGameAfterBossMidfightVideo(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;

    if (this.bossMidfightVideoForcedPause && !this.isPaused && !this.bossIntroActive && !this.superGuideActive) {
      if (typeof gameScene.togglePause === "function") {
        if ((gameScene.scene as any).isPaused()) {
          gameScene.togglePause();
        }
      } else if ((gameScene.scene as any).isPaused()) {
        gameScene.scene.resume();
      }
    }

    this.bossMidfightVideoForcedPause = false;
  }

  private hideBossMidfightVideo(skipResume: boolean = false, skipMediaReset: boolean = false): void {
    const overlay = this.getCachedElement("boss-midfight-video-overlay");
    const video = this.getCachedElement("boss-midfight-video") as HTMLVideoElement | null;
    const hint = this.getCachedElement("boss-midfight-video-hint");

    if (overlay && this.bossMidfightVideoTapHandler) {
      overlay.removeEventListener("click", this.bossMidfightVideoTapHandler);
      overlay.removeEventListener("touchend", this.bossMidfightVideoTapHandler);
    }
    this.bossMidfightVideoTapHandler = undefined;
    this.clearBossMidfightVideoTapTimeout();
    this.clearBossMidfightVideoStartGuardTimeout();

    if (video && this.bossMidfightVideoEndedHandler) {
      video.removeEventListener("ended", this.bossMidfightVideoEndedHandler);
    }
    this.bossMidfightVideoEndedHandler = undefined;
    if (video && this.bossMidfightVideoErrorHandler) {
      video.removeEventListener("error", this.bossMidfightVideoErrorHandler);
    }
    this.bossMidfightVideoErrorHandler = undefined;
    if (video && this.bossMidfightVideoPlayingHandler) {
      video.removeEventListener("playing", this.bossMidfightVideoPlayingHandler);
      video.removeEventListener("timeupdate", this.bossMidfightVideoPlayingHandler);
    }
    this.bossMidfightVideoPlayingHandler = undefined;

    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
    if (hint) {
      hint.style.opacity = "0.55";
    }

    if (video && !skipMediaReset) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // Ignore one-off media teardown failures.
      }
    }

    const wasActive = this.bossMidfightVideoActive;
    this.bossMidfightVideoActive = false;
    this.bossMidfightVideoTapReady = false;

    if (!skipResume && wasActive) {
      this.resumeGameAfterBossMidfightVideo();
    }
  }

  private showBossMidfightVideo(data: { videoUrl?: string; hintText?: string }): void {
    const difficulty = normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");
    const videoUrlRaw = String(data?.videoUrl || "").trim();
    const gameScene = this.currentGameSceneKey ? this.scene.get(this.currentGameSceneKey) as any : null;
    if (!gameScene?.events) return;

    if (!videoUrlRaw || !shouldDifficultyShowVideos(difficulty)) {
      gameScene.events.emit("bossMidfightVideoFinished");
      return;
    }

    const overlay = this.getCachedElement("boss-midfight-video-overlay");
    const video = this.getCachedElement("boss-midfight-video") as HTMLVideoElement | null;
    const hint = this.getCachedElement("boss-midfight-video-hint");
    if (!overlay || !video) {
      gameScene.events.emit("bossMidfightVideoFinished");
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.hideBossMidfightVideo();
      gameScene.events.emit("bossMidfightVideoFinished");
    };

    this.hideBossMidfightVideo(true);
    this.pauseGameForBossMidfightVideo();

    const videoUrl = this.resolveUiMediaUrl(videoUrlRaw);
    this.bossMidfightVideoActive = true;
    this.bossMidfightVideoTapReady = false;

    overlay.style.transition = "opacity 220ms ease";
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "auto";
    if (hint) {
      const hintText = formatSkipHintLine(String(data?.hintText || "SPICE BOYS TULEE - NAPAUTA OHITTAKSESI"));
      hint.textContent = sanitizePlayerFacingText(hintText) || formatSkipHintLine("NAPAUTA OHITTAKSESI");
      hint.style.opacity = "0.55";
    }

    this.bossMidfightVideoTapHandler = (event: Event) => {
      event.preventDefault();
      if (!this.bossMidfightVideoActive || !this.bossMidfightVideoTapReady) return;
      this.sound.play("ui_click_sound", { volume: 0.3 });
      finish();
    };
    overlay.addEventListener("click", this.bossMidfightVideoTapHandler);
    overlay.addEventListener("touchend", this.bossMidfightVideoTapHandler, { passive: false });

    let playbackStarted = false;
    this.bossMidfightVideoPlayingHandler = () => {
      playbackStarted = true;
      this.clearBossMidfightVideoStartGuardTimeout();
    };
    video.addEventListener("playing", this.bossMidfightVideoPlayingHandler, { once: true });
    video.addEventListener("timeupdate", this.bossMidfightVideoPlayingHandler, { once: true });

    this.bossMidfightVideoEndedHandler = () => {
      finish();
    };
    video.addEventListener("ended", this.bossMidfightVideoEndedHandler, { once: true });
    this.bossMidfightVideoErrorHandler = () => {
      finish();
    };
    video.addEventListener("error", this.bossMidfightVideoErrorHandler, { once: true });

    try {
      video.pause();
      video.src = videoUrl;
      video.load();
      video.currentTime = 0;
      video.loop = false;
      video.volume = utils.applyGameVolume(1);
      video.muted = false;
      (video as any).playsInline = true;
      (video as any).webkitPlaysInline = true;
    } catch {
      finish();
      return;
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        try {
          video.muted = true;
          await video.play();
        } catch {
          // If playback is blocked, player can still tap to continue.
        }
      }
    };
    void tryPlay();

    if (typeof window !== "undefined") {
      this.bossMidfightVideoStartGuardTimeoutId = window.setTimeout(() => {
        if (!this.bossMidfightVideoActive || playbackStarted) return;
        const hasProgressed = Number.isFinite(video.currentTime) && video.currentTime > 0.05;
        if (!hasProgressed) {
          finish();
        }
      }, 3200);

      this.bossMidfightVideoTapEnableTimeoutId = window.setTimeout(() => {
        this.bossMidfightVideoTapReady = true;
        if (hint) hint.style.opacity = "1";
      }, 900);
    }
  }

  private showMonikaPreIntroVideo(data: { bossName: string; isFinalBoss: boolean; bossDescription?: string; bossType?: string }): void {
    if (this.bossPreIntroVideoActive) return;
    const preIntroConfig = this.getBossPreIntroVideoConfig(data);
    if (!preIntroConfig) {
      this.showBossIntroCard(data);
      return;
    }

    const overlay = this.getCachedElement("boss-preintro-video-overlay");
    const video = this.getCachedElement("boss-preintro-video") as HTMLVideoElement | null;
    const hint = this.getCachedElement("boss-preintro-video-hint");
    if (!overlay || !video) {
      this.showBossIntroCard(data);
      return;
    }

    const videoUrlRaw = utils.resolveAssetUrl(this, preIntroConfig.assetKey, preIntroConfig.fallbackUrl);
    const videoUrl = this.resolveUiMediaUrl(videoUrlRaw);
    if (!videoUrl) {
      this.showBossIntroCard(data);
      return;
    }

    this.hideMonikaPreIntroVideo();
    this.hideBossIntroCard(true);
    this.pauseGameForBossIntro();

    this.bossPreIntroVideoActive = true;
    this.bossPreIntroVideoTapReady = false;

    overlay.style.transition = "opacity 220ms ease";
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "auto";
    if (hint) {
      hint.textContent = preIntroConfig.hintText;
      hint.style.opacity = "0.55";
    }

    let finished = false;
    const finishAndOpenBossCard = () => {
      if (finished) return;
      finished = true;
      this.hideMonikaPreIntroVideo();
      this.showBossIntroCard(data);
    };

    this.bossPreIntroVideoTapHandler = (event: Event) => {
      event.preventDefault();
      if (!this.bossPreIntroVideoActive || !this.bossPreIntroVideoTapReady) return;
      this.sound.play("ui_click_sound", { volume: 0.3 });
      finishAndOpenBossCard();
    };
    overlay.addEventListener("click", this.bossPreIntroVideoTapHandler);
    overlay.addEventListener("touchend", this.bossPreIntroVideoTapHandler, { passive: false });

    let playbackStarted = false;
    this.bossPreIntroVideoPlayingHandler = () => {
      playbackStarted = true;
      this.clearBossPreIntroVideoStartGuardTimeout();
    };
    video.addEventListener("playing", this.bossPreIntroVideoPlayingHandler, { once: true });
    video.addEventListener("timeupdate", this.bossPreIntroVideoPlayingHandler, { once: true });

    this.bossPreIntroVideoEndedHandler = () => {
      finishAndOpenBossCard();
    };
    video.addEventListener("ended", this.bossPreIntroVideoEndedHandler, { once: true });
    this.bossPreIntroVideoErrorHandler = () => {
      finishAndOpenBossCard();
    };
    video.addEventListener("error", this.bossPreIntroVideoErrorHandler, { once: true });

    try {
      video.pause();
      video.src = videoUrl;
      video.load();
      video.currentTime = 0;
      video.loop = false;
      video.volume = utils.applyGameVolume(1);
      video.muted = false;
      (video as any).playsInline = true;
      (video as any).webkitPlaysInline = true;
    } catch {
      // Keep flow alive and let fallback path continue.
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        try {
          video.muted = true;
          await video.play();
        } catch {
          // If playback is blocked, player can still tap to continue.
        }
      }
    };
    void tryPlay();

    if (typeof window !== "undefined") {
      this.bossPreIntroVideoStartGuardTimeoutId = window.setTimeout(() => {
        if (!this.bossPreIntroVideoActive || playbackStarted) return;
        const hasProgressed = Number.isFinite(video.currentTime) && video.currentTime > 0.05;
        if (!hasProgressed) {
          finishAndOpenBossCard();
        }
      }, 3200);

      this.bossPreIntroVideoTapEnableTimeoutId = window.setTimeout(() => {
        this.bossPreIntroVideoTapReady = true;
        if (hint) hint.style.opacity = "1";
      }, 900);
    }
  }

  private clearBossIntroTapTimeout(): void {
    if (typeof window === "undefined" || !this.bossIntroTapEnableTimeoutId) return;
    window.clearTimeout(this.bossIntroTapEnableTimeoutId);
    this.bossIntroTapEnableTimeoutId = undefined;
  }

  private clearBossIntroAutoHideTimeout(): void {
    if (typeof window === "undefined" || !this.bossIntroAutoHideTimeoutId) return;
    window.clearTimeout(this.bossIntroAutoHideTimeoutId);
    this.bossIntroAutoHideTimeoutId = undefined;
  }

  private pauseGameForBossIntro(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;
    const gameScenePlugin = gameScene.scene as any;
    const isScenePaused = () =>
      !!(
        gameScenePlugin &&
        typeof gameScenePlugin.isPaused === "function" &&
        gameScenePlugin.isPaused()
      );
    const damageOverlay = this.getCachedElement("damage-overlay");
    if (damageOverlay) {
      damageOverlay.style.opacity = "0";
      damageOverlay.style.backgroundColor = "#dc2626";
    }
    gameScene?.cameras?.main?.resetFX?.();

    const alreadyPaused = isScenePaused();
    if (!alreadyPaused) {
      if (typeof gameScene.togglePause === "function") {
        gameScene.togglePause();
      }

      // Fallback: enforce pause even if toggle path was skipped/blocked.
      if (!isScenePaused()) {
        gameScenePlugin?.pause?.();
        gameScene?.sound?.pauseAll?.();
        gameScene?.backgroundMusic?.pause?.();
        gameScene?.pauseNativeBackgroundMusicFallback?.();
      }
      this.bossIntroForcedPause = true;
    } else if (!this.bossIntroForcedPause) {
      this.bossIntroForcedPause = false;
    }
  }

  private resumeGameAfterBossIntro(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;
    const gameScenePlugin = gameScene.scene as any;
    const isScenePaused = () =>
      !!(
        gameScenePlugin &&
        typeof gameScenePlugin.isPaused === "function" &&
        gameScenePlugin.isPaused()
      );
    const damageOverlay = this.getCachedElement("damage-overlay");
    if (damageOverlay) {
      damageOverlay.style.opacity = "0";
      damageOverlay.style.backgroundColor = "#dc2626";
    }
    gameScene?.cameras?.main?.resetFX?.();
    if (this.bossIntroForcedPause && !this.isPaused) {
      if (isScenePaused() && typeof gameScene.togglePause === "function") {
        gameScene.togglePause();
      }

      // Fallback: force resume if toggle did not wake gameplay.
      if (isScenePaused()) {
        gameScenePlugin?.resume?.();
        gameScene?.recoverBackgroundMusicAfterResume?.("boss-intro-dismiss");
      }
    }

    // iOS/WKWebView can leave audio suspended after pause/resume transitions.
    // Force a wake path right when boss intro is dismissed.
    try {
      utils.ensureSceneAudioReady(gameScene);
      gameScene?.sound?.resumeAll?.();
      gameScene?.applyGlobalMuteState?.(false);
      gameScene?.resumeNativeBackgroundMusicFallback?.();
      gameScene?.startAudioBootstrap?.();
      gameScene?.installAudioRetryHandlers?.();
    } catch {
      // Keep flow alive even if audio wake hits a transient runtime edge.
    }

    if (!this.isPaused) {
      gameScene?.events?.emit?.("bossIntroDismissed", { level: this.currentLevel });
    }
    this.bossIntroForcedPause = false;
  }

  private hideBossIntroCard(skipResume: boolean = false): void {
    this.hideMonikaPreIntroVideo(true);
    const overlay = this.getCachedElement("boss-intro-overlay");
    const card = this.getCachedElement("boss-intro-card");
    if (overlay && this.bossIntroTapHandler) {
      overlay.removeEventListener("click", this.bossIntroTapHandler);
      overlay.removeEventListener("touchend", this.bossIntroTapHandler);
    }
    this.bossIntroTapHandler = undefined;
    this.clearBossIntroTapTimeout();
    this.clearBossIntroAutoHideTimeout();

    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "translateY(-12px) scale(0.96)";
      card.style.filter = "blur(1px)";
    }

    this.bossIntroActive = false;
    this.bossIntroTapReady = false;

    if (!skipResume) {
      this.resumeGameAfterBossIntro();
    }
  }

  private clearSuperGuideTapTimeout(): void {
    if (typeof window === "undefined" || !this.superGuideTapEnableTimeoutId) return;
    window.clearTimeout(this.superGuideTapEnableTimeoutId);
    this.superGuideTapEnableTimeoutId = undefined;
  }

  private pauseGameForSuperGuide(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;
    const damageOverlay = this.getCachedElement("damage-overlay");
    if (damageOverlay) {
      damageOverlay.style.opacity = "0";
      damageOverlay.style.backgroundColor = "#dc2626";
    }
    gameScene?.cameras?.main?.resetFX?.();
    if (typeof gameScene.togglePause === "function") {
      const alreadyPaused = (gameScene.scene as any).isPaused();
      if (!alreadyPaused) {
        gameScene.togglePause();
        this.superGuideForcedPause = true;
      } else {
        this.superGuideForcedPause = false;
      }
      return;
    }
    const alreadyPaused = (gameScene.scene as any).isPaused();
    if (!alreadyPaused) {
      gameScene.scene.pause();
      this.superGuideForcedPause = true;
    } else {
      this.superGuideForcedPause = false;
    }
  }

  private resumeGameAfterSuperGuide(): void {
    if (!this.currentGameSceneKey) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene) return;
    const damageOverlay = this.getCachedElement("damage-overlay");
    if (damageOverlay) {
      damageOverlay.style.opacity = "0";
      damageOverlay.style.backgroundColor = "#dc2626";
    }
    gameScene?.cameras?.main?.resetFX?.();
    if (this.superGuideForcedPause && !this.isPaused && !this.bossIntroActive) {
      if (typeof gameScene.togglePause === "function") {
        if ((gameScene.scene as any).isPaused()) {
          gameScene.togglePause();
        }
      } else if ((gameScene.scene as any).isPaused()) {
        gameScene.scene.resume();
      }
    }

    try {
      utils.ensureSceneAudioReady(gameScene);
      gameScene?.sound?.resumeAll?.();
      gameScene?.applyGlobalMuteState?.(false);
      gameScene?.resumeNativeBackgroundMusicFallback?.();
      gameScene?.startAudioBootstrap?.();
      gameScene?.installAudioRetryHandlers?.();
    } catch {
      // Keep flow alive even if audio wake hits a transient runtime edge.
    }

    this.superGuideForcedPause = false;
  }

  private scheduleLevelStartSuperGuide(): void {
    const twoSecondSuperUnlockLevel = 5;
    if (this.currentLevel !== twoSecondSuperUnlockLevel) return;

    this.time.delayedCall(3200, () => {
      this.tryShowLevelStartSuperGuide(0);
    });
  }

  private tryShowLevelStartSuperGuide(attempt: number): void {
    if (this.levelStartTwoSecondSuperGuideShown || this.isCleanedUp || !this.sys.isActive()) return;

    if (this.isPaused || this.bossIntroActive || this.superGuideActive || this.bossMidfightVideoActive) {
      if (attempt < 10) {
        this.time.delayedCall(420, () => {
          this.tryShowLevelStartSuperGuide(attempt + 1);
        });
      }
      return;
    }

    this.levelStartTwoSecondSuperGuideShown = true;
    this.showSuperAbilityGuideForAttack("twoSecondSupers");
  }

  private getSuperAbilityGuideContent(attackType: string): { title: string; description: string } | null {
    if (attackType === "twoSecondSupers") {
      return {
        title: "SUPERIT AVATTU",
        description: "MYRSKYVOLTTI: pidä VOLTTI pohjassa 1s -> 2s pyörre. SUPERSAUVA: pidä SAUVA pohjassa 1s -> 2s raivopyörre."
      };
    }
    if (attackType === "tornadoVoltti") {
      return {
        title: "MYRSKYVOLTTI",
        description: "Pidä VOLTTI pohjassa 1 sekunti ja vapauta. Pyöri 2 sekuntia eteenpäin. Moniosuma lähietäisyydellä, energia pysyy nollassa superin ajan."
      };
    }
    if (attackType === "superPole") {
      return {
        title: "SUPERSAUVA",
        description: "Pidä SAUVA pohjassa 1 sekunti ja vapauta. Raivopyörre 2 sekuntia ympärilläsi. Osuu toistuvasti lähellä oleviin vihuihin, energia pysyy nollassa."
      };
    }
    return null;
  }

  private showSuperAbilityGuideForAttack(attackType: string): void {
    const normalizedAttackType = String(attackType || "").trim();
    const content = this.getSuperAbilityGuideContent(normalizedAttackType);
    if (!content) return;
    if (this.isPaused || this.bossIntroActive || this.bossMidfightVideoActive) return;

    const overlay = this.getCachedElement("super-guide-overlay");
    const card = this.getCachedElement("super-guide-card");
    const title = this.getCachedElement("super-guide-title");
    const description = this.getCachedElement("super-guide-desc");
    const continueText = this.getCachedElement("super-guide-continue");
    if (!overlay || !card || !title || !description || !continueText) return;

    this.hideSuperAbilityGuide(true);
    this.superGuideActive = true;
    this.superGuideTapReady = false;

    title.textContent = sanitizePlayerFacingText(content.title) || "SUPERKYKY";
    description.textContent = sanitizePlayerFacingText(content.description) || "Käytä superia tehokkaasti oikeassa hetkessä.";
    continueText.textContent = getContinuePromptText();
    continueText.style.opacity = "0.55";

    overlay.style.transition = "opacity 180ms ease";
    card.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, filter 180ms ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(12px) scale(0.94)";
    card.style.filter = "blur(1.5px)";
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "auto";

    this.pauseGameForSuperGuide();
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
      card.style.filter = "none";
    });

    this.superGuideTapHandler = (event: Event) => {
      event.preventDefault();
      if (!this.superGuideActive || !this.superGuideTapReady) return;
      this.sound.play("ui_click_sound", { volume: 0.3 });
      this.hideSuperAbilityGuide();
    };
    overlay.addEventListener("click", this.superGuideTapHandler);
    overlay.addEventListener("touchend", this.superGuideTapHandler, { passive: false });

    if (typeof window !== "undefined") {
      this.superGuideTapEnableTimeoutId = window.setTimeout(() => {
        this.superGuideTapReady = true;
        continueText.style.opacity = "1";
      }, 230);
    }
  }

  private hideSuperAbilityGuide(skipResume: boolean = false): void {
    const overlay = this.getCachedElement("super-guide-overlay");
    const card = this.getCachedElement("super-guide-card");
    if (overlay && this.superGuideTapHandler) {
      overlay.removeEventListener("click", this.superGuideTapHandler);
      overlay.removeEventListener("touchend", this.superGuideTapHandler);
    }
    this.superGuideTapHandler = undefined;
    this.clearSuperGuideTapTimeout();

    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";
    }
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "translateY(12px) scale(0.95)";
      card.style.filter = "blur(1px)";
    }

    this.superGuideActive = false;
    this.superGuideTapReady = false;

    if (!skipResume) {
      this.resumeGameAfterSuperGuide();
    }
  }

  private resolveBossPortraitFrameKey(data: { bossName?: string; bossType?: string }): string | null {
    const bossTypeByLevel: Record<number, string> = {
      2: "marja_liisa",
      3: "elsa_mummo",
      4: "jari_litmanen",
      5: "jari_isometsa",
      6: "tero_afterwork",
      7: "jeti",
      8: "matti_nykanen",
      9: "peter_sync",
      10: "timo_soini"
    };

    const frameByBossType: Record<string, string> = {
      marja_liisa: "karen_boss_idle_R_frame1",
      elsa_mummo: "elsa_boss_idle_R_frame1",
      jari_litmanen: "litmanen_boss_idle_R_frame1",
      jari_isometsa: "tesla_ceo_boss_idle_R_frame1",
      tero_afterwork: "level6_boss_idle_R_frame1",
      jeti: "jeti_boss_idle_R_frame1",
      matti_nykanen: "golf_boss_idle_R_frame1",
      peter_sync: "peter_sync_idle_R_frame1",
      timo_soini: "timo_soini_boss_idle_R_frame1"
    };

    const normalizedBossType = String(data?.bossType || "").trim().toLowerCase();
    if (normalizedBossType && frameByBossType[normalizedBossType]) {
      return frameByBossType[normalizedBossType];
    }

    const byLevel = bossTypeByLevel[this.currentLevel];
    if (byLevel && frameByBossType[byLevel]) {
      return frameByBossType[byLevel];
    }

    const bossName = String(data?.bossName || "").toLowerCase();
    if (bossName.includes("peter")) return frameByBossType.peter_sync;
    if (bossName.includes("månika") || bossName.includes("monika")) return frameByBossType.marja_liisa;
    if (bossName.includes("elsa")) return frameByBossType.elsa_mummo;
    if (bossName.includes("chiki") || bossName.includes("latu keisari")) return frameByBossType.jari_litmanen;
    if (bossName.includes("pasi")) return frameByBossType.jeti;
    if (bossName.includes("timo")) return frameByBossType.timo_soini;
    return null;
  }

  private resolveBossPortraitUrl(frameKey: string): string {
    const fallbackByFrameKey: Record<string, string> = {
      karen_boss_idle_R_frame1: "assets/custom/monika/karen_boss_idle_R_frame1.png",
      elsa_boss_idle_R_frame1: "assets/custom/elsa/elsa_boss_idle_R_frame1.png",
      litmanen_boss_idle_R_frame1: "assets/custom/lahti/chiki/litmanen_boss_idle_R_frame1.png",
      level6_boss_idle_R_frame1: "assets/custom/level6/tero_afterwork/level6_boss_idle_R_frame1.png",
      jeti_boss_idle_R_frame1: "assets/custom/turku/pasi/pasi_boss_idle_R_frame1.png",
      peter_sync_idle_R_frame1: "assets/custom/peter_sync/peter_sync_idle_R_frame1.png"
    };
    return utils.resolveAssetUrl(this, frameKey, fallbackByFrameKey[frameKey] || "");
  }

  private showBossIntroCard(data: { bossName: string; isFinalBoss: boolean; bossDescription?: string; bossType?: string }): void {
    const overlay = this.getCachedElement("boss-intro-overlay");
    const card = this.getCachedElement("boss-intro-card");
    const title = this.getCachedElement("boss-intro-title");
    const portrait = this.getCachedElement("boss-intro-portrait") as HTMLImageElement | null;
    const name = this.getCachedElement("boss-intro-name");
    const description = this.getCachedElement("boss-intro-desc");
    const continueText = this.getCachedElement("boss-intro-continue");
    if (!overlay || !card || !title || !name || !description || !continueText) return;

    this.hideBossIntroCard(true);

    const isPasiBoss = this.currentLevel === 7;
    const bossTitle = isPasiBoss ? "PASI" : data.bossName;
    const safeBossName = sanitizePlayerFacingText(bossTitle) || "BOSSI";
    const safeDescription = sanitizePlayerFacingText(data.bossDescription || "") || "Latu kuumenee ja ottelu alkaa.";

    title.textContent = `TASO ${this.currentLevel} • ${data.isFinalBoss ? "PÄÄBOSSI" : "BOSSI"}`;
    name.textContent = safeBossName;
    description.textContent = safeDescription;
    continueText.textContent = getContinuePromptText();
    continueText.style.opacity = "0.55";

    if (portrait) {
      const frameKey = this.resolveBossPortraitFrameKey(data);
      const portraitUrl = frameKey ? this.resolveBossPortraitUrl(frameKey) : "";
      if (portraitUrl) {
        portrait.src = portraitUrl;
        portrait.alt = safeBossName;
        portrait.style.display = "block";
      } else {
        portrait.style.display = "none";
        portrait.removeAttribute("src");
      }
    }

    this.bossIntroActive = true;
    this.bossIntroTapReady = false;

    let useBlur = true;
    let blurPx = 8;
    if (this.currentGameSceneKey) {
      const gameScene = this.scene.get(this.currentGameSceneKey) as any;
      const qualityTier = String(gameScene?.qualityTier || "medium");
      const lowPower = !!gameScene?.isLowPowerMode;
      const emergency = !!gameScene?.hardFpsEmergencyActive;
      if (qualityTier === "low" || lowPower || emergency || this.isTouchDevice) {
        useBlur = false;
      } else if (qualityTier === "medium") {
        blurPx = 4;
      }
    }
    if (useBlur) {
      overlay.style.backdropFilter = `blur(${blurPx}px)`;
      (overlay.style as any).webkitBackdropFilter = `blur(${blurPx}px)`;
      overlay.style.background = "rgba(3, 7, 18, 0.56)";
    } else {
      overlay.style.backdropFilter = "none";
      (overlay.style as any).webkitBackdropFilter = "none";
      overlay.style.background = "rgba(3, 7, 18, 0.78)";
    }

    overlay.style.transition = "opacity 240ms ease";
    card.style.transition = "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease, filter 260ms ease, box-shadow 260ms ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(18px) scale(0.9)";
    card.style.filter = "blur(2px)";
    card.style.boxShadow = "0 0 0 rgba(250, 204, 21, 0)";
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "auto";
    this.pauseGameForBossIntro();
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
      card.style.filter = "none";
      card.style.boxShadow = "0 0 22px rgba(250, 204, 21, 0.32)";
    });

    this.bossIntroTapHandler = (event: Event) => {
      event.preventDefault();
      if (!this.bossIntroActive || !this.bossIntroTapReady) return;
      this.sound.play("ui_click_sound", { volume: 0.32 });
      this.hideBossIntroCard();
    };
    overlay.addEventListener("click", this.bossIntroTapHandler);
    overlay.addEventListener("touchend", this.bossIntroTapHandler, { passive: false });

    if (typeof window !== "undefined") {
      this.bossIntroTapEnableTimeoutId = window.setTimeout(() => {
        this.bossIntroTapReady = true;
        continueText.style.opacity = "1";
      }, 320);
    }
  }
  
  showBossDefeated(data: { bossType: string; isFinalBoss: boolean; scoreValue: number }): void {
    const bossDefeated = this.getCachedElement("boss-defeated");
    const bossDefeatedText = this.getCachedElement("boss-defeated-text");
    
    if (bossDefeated && bossDefeatedText) {
      bossDefeatedText.textContent = data.isFinalBoss ? "PÄÄBOSSI VOITETTU!" : "BOSSI VOITETTU!";
      bossDefeated.style.opacity = "1";
      bossDefeated.style.transform = "translate(-50%, -50%) scale(1.2)";
      
      // Hide after 2 seconds
      setTimeout(() => {
        bossDefeated.style.opacity = "0";
        bossDefeated.style.transform = "translate(-50%, -50%) scale(0.8)";
      }, 2000);
    }
    
    // Hide boss health bar
    const bossHealthContainer = this.getCachedElement("boss-health-container");
    if (bossHealthContainer) {
      bossHealthContainer.style.opacity = "0";
    }
  }
  
  generateLivesHTML(): string {
    let html = "";
    // Only show heart slots for actual lives (not maxLives), gray out lost lives
    const totalSlots = this.lives; // Show only the number of remaining lives
    for (let i = 0; i < totalSlots; i++) {
      html += '<span class="text-lg">❤️</span>';
    }
    return html;
  }
  
  showTrickCompleteEffect(data: { trickType: string; points: number; tricksRemaining: number; rampBoost?: boolean }): void {
    const perfectDisplay = this.getCachedElement("perfect-display");
    const perfectText = this.getCachedElement("perfect-text");
    const pointsPopup = this.getCachedElement("points-popup");
    
    if (perfectDisplay && perfectText && pointsPopup) {
      // Show "TÄYDELLINEN!" - always Voltti now
      perfectText.textContent = data.rampBoost ? "VOLTTI TÄYDELLINEN! x2" : "VOLTTI TÄYDELLINEN!";
      pointsPopup.textContent = `+${data.points}`;
      
      // Trigger animation
      perfectDisplay.style.opacity = "1";
      perfectDisplay.style.transform = "translate(-50%, -50%) scale(1.2)";
      
      // Animate out after delay
      setTimeout(() => {
        perfectDisplay.style.opacity = "0";
        perfectDisplay.style.transform = "translate(-50%, -50%) scale(0.8)";
      }, 1200);
    }
  }

  createDOMUI(): void {
    // Check if god mode is enabled (from config or easter egg)
    const isGodMode = debugConfig.godMode.value || this.registry.get('godModeActivated') === true;
    
    const uiHTML = `
      <div id="game-ui-container" class="absolute top-0 left-0 w-full h-full pointer-events-none z-[1000]" style="font-family: 'PublicPixel';">
        
        <!-- GOD MODE INDICATOR - Only visible when god mode is enabled -->
        ${isGodMode ? `
        <div id="god-mode-indicator" class="absolute top-1 left-1/2 transform -translate-x-1/2 z-50">
          <div class="game-pixel-container-purple-600 px-4 py-1 flex items-center gap-2" style="animation: godModePulse 1s infinite;">
            <span class="text-xl">👼</span>
            <span class="text-yellow-300 text-lg font-bold" style="text-shadow: 2px 2px 0px #000;">GOD MODE</span>
            <span class="text-xl">👼</span>
          </div>
        </div>
        ` : ''}
        
        
        <!-- ==================== TOP BAR ==================== -->
        <div id="top-hud-bar" class="absolute z-[1200] top-2 md:top-3 left-0 right-0 px-2 md:px-4 flex justify-between items-start" style="top: max(8px, calc(env(safe-area-inset-top, 0px) + 8px)); left: max(4px, env(safe-area-inset-left, 0px)); right: max(4px, env(safe-area-inset-right, 0px));">
          
          <!-- LEFT COLUMN: Level, Lives, Energy, Temput -->
	          <div id="top-hud-left-column" class="flex flex-col gap-1 md:gap-2" style="min-width: 120px;">
            
            <!-- Level & Lives Row - Compact on mobile -->
            <div class="flex items-center gap-2 md:gap-4">
              <!-- Level Badge -->
              <div class="game-pixel-container-blue-700 px-2 md:px-3 py-0.5 md:py-1 flex flex-col items-center">
                <span id="level-badge-value" class="text-yellow-300 text-sm md:text-2xl font-bold" style="text-shadow: 1px 1px 0px #000;">TASO ${this.currentLevel}</span>
                <span id="level-badge-name" class="text-cyan-200 text-[8px] font-bold" style="text-shadow: 1px 1px 0px #000;">${LevelManager.getLevelName(this.currentLevel)}</span>
              </div>
              <!-- Lives -->
            <div id="lives-container" class="flex gap-0.5">
              ${this.generateLivesHTML()}
            </div>
          </div>

            <!-- Health Bar -->
            <div id="compact-health-row" class="flex items-center gap-1 md:gap-2">
              <span class="text-red-500 text-xs md:text-sm font-bold">❤️</span>
              <div class="game-pixel-container-slot-gray-700 p-0.5 relative" style="width: 64px;">
                <div id="health-fill" class="game-pixel-container-progress-fill-red-500 transition-all duration-100" style="width: 100%; height: 10px;"></div>
                <span id="health-text" class="absolute inset-0 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white" style="text-shadow: 1px 1px 0px #000;">100%</span>
              </div>
            </div>
            
            <!-- Energy Bar -->
            <div id="compact-energy-row" class="flex items-center gap-1 md:gap-2">
              <span class="text-yellow-400 text-xs md:text-sm font-bold">⚡</span>
              <div class="game-pixel-container-slot-gray-700 p-0.5 relative" style="width: 64px;">
                <div id="energy-fill" class="game-pixel-container-progress-fill-yellow-400 transition-all duration-100" style="width: 100%; height: 10px;"></div>
                <span id="energy-text" class="absolute inset-0 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-black" style="text-shadow: 0 0 2px white;">100%</span>
              </div>
            </div>
            
            <!-- RAGE METER - Compact on mobile -->
            <div id="rage-meter-container" class="flex items-center gap-1 md:gap-2 opacity-40 transition-all duration-300">
              <span class="text-red-500 text-xs md:text-sm font-bold">😤</span>
              <div class="game-pixel-container-slot-gray-700 p-0.5 relative" style="width: 64px;">
                <div id="rage-fill" class="game-pixel-container-progress-fill-red-600 transition-all duration-100" style="width: 0%; height: 10px;"></div>
                <span id="rage-text" class="absolute inset-0 flex items-center justify-center text-[6px] md:text-[8px] font-bold text-white" style="text-shadow: 1px 1px 0px #000;">0%</span>
              </div>
            </div>
            
            <!-- RAGE READY indicator -->
            <div id="rage-ready-container" class="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1 md:gap-2 opacity-0 transition-all duration-300 pointer-events-none z-[1300]" style="top: max(84px, calc(env(safe-area-inset-top, 0px) + 76px));">
              <div id="rage-ready-indicator" class="game-pixel-container-red-600 px-2 md:px-3 py-0.5 md:py-1 flex items-center gap-1 md:gap-2" style="animation: rageReadyPulse 0.5s infinite;">
                <span id="rage-icon" class="text-lg md:text-2xl">🔥</span>
                <span class="text-yellow-300 text-xs md:text-lg font-bold" style="text-shadow: 1px 1px 0px #000;">RAIVO!</span>
                <span class="text-white text-[8px]" style="text-shadow: 1px 1px 0px #000;">😤</span>
              </div>
            </div>

          </div>
          
          <!-- CENTER: Distance Progress & Speed - Centered in top bar -->
          <div class="flex flex-col items-center absolute left-1/2 transform -translate-x-1/2">
            <!-- Distance Text -->
            <div class="flex items-center gap-1 md:gap-3">
              <span id="distance-icon" class="text-lg md:text-2xl">⛷️</span>
              <span id="distance-text" class="text-white text-lg md:text-3xl font-bold" style="text-shadow: 2px 2px 0px #000;">0m</span>
              <span class="text-gray-300 text-xs" style="text-shadow: 1px 1px 0px #000;">/ ${this.levelDistance}m</span>
              <span class="text-lg md:text-2xl">🏁</span>
            </div>
            <!-- Progress Bar -->
            <div class="game-pixel-container-slot-gray-700 p-0.5 md:p-1 relative mt-1 md:mt-2" style="width: 140px;">
              <div id="distance-fill" class="game-pixel-container-progress-fill-green-500 h-2 md:h-4 transition-all duration-100" style="width: 0%;"></div>
              <!-- Milestone markers -->
              <div class="absolute top-0 bottom-0 w-0.5 md:w-1 bg-yellow-400 opacity-60" style="left: 25%;"></div>
              <div class="absolute top-0 bottom-0 w-0.5 md:w-1 bg-yellow-400 opacity-60" style="left: 50%;"></div>
              <div class="absolute top-0 bottom-0 w-0.5 md:w-1 bg-yellow-400 opacity-60" style="left: 75%;"></div>
              <!-- Player marker -->
              <div id="distance-marker" class="absolute -top-0.5 md:-top-1 text-sm md:text-lg transition-all duration-200" style="left: 0%; transform: translateX(-50%);">🎿</div>
            </div>
            <!-- Speed indicator - hidden to save space -->
            <div id="speed-container" class="hidden items-center gap-2 mt-1 opacity-70">
              <span class="text-cyan-300 text-sm" style="text-shadow: 1px 1px 0px #000;">⚡</span>
              <span id="speed-text" class="text-cyan-200 text-sm font-bold" style="text-shadow: 1px 1px 0px #000;">0 km/h</span>
            </div>
          </div>
          
          <!-- RIGHT COLUMN: Score only -->
          <div id="top-hud-right-column" class="flex flex-col gap-1 md:gap-2 items-end" style="min-width: 80px;">

            <!-- Score - Compact on mobile -->
            <div class="game-pixel-container-gray-800 px-2 md:px-3 py-0.5 md:py-1 flex flex-col items-end relative">
              <span class="text-gray-400 text-[8px]" style="text-shadow: 1px 1px 0px #000;">⭐</span>
              <span id="score-text" class="text-yellow-300 text-lg md:text-3xl font-bold transition-all duration-100" style="text-shadow: 2px 2px 0px #000;">0</span>
              <span id="score-popup" class="text-green-400 text-sm md:text-xl font-bold opacity-0 absolute -top-4 md:-top-6 right-1 md:right-2 transition-all duration-300" style="text-shadow: 2px 2px 0px #000;">+0</span>
            </div>

            ${this.currentLevel === 1 ? `
            <button id="skip-tutorial-btn" class="game-pixel-container-clickable-red-700 px-3 md:px-4 py-1.5 md:py-2 pointer-events-auto opacity-100 hover:brightness-110 transition-all" style="border: 2px solid #fca5a5; box-shadow: 0 0 0 1px rgba(127,29,29,0.85), 0 0 14px rgba(239,68,68,0.45); animation: tutorialSkipPulse 1s ease-in-out infinite;">
              <span class="text-white text-[10px] md:text-xs font-bold tracking-wide" style="text-shadow: 1px 1px 0px #000;">⏭ OHITA TUTORIAALI</span>
            </button>
            ` : ""}

            <!-- Combo meter -->
            <div id="combo-meter-container" class="game-pixel-container-orange-600 px-2 py-1 flex flex-col items-end opacity-0 transition-all duration-150" style="min-width: 110px;">
              <span id="combo-meter-text" class="text-yellow-200 text-[10px] font-bold" style="text-shadow: 1px 1px 0px #000;">COMBO x1</span>
              <div class="game-pixel-container-slot-gray-900 p-0.5 mt-0.5" style="width: 96px; height: 8px;">
                <div id="combo-meter-fill" class="h-full bg-yellow-300 transition-all duration-100" style="width: 100%;"></div>
              </div>
            </div>

          </div>
          
        </div>
        
        <!-- ==================== CENTER NOTIFICATIONS ==================== -->
        

        

        

        
        <!-- Floating Announcement - Shows landmark names and other centered announcements below combo box -->
        <div id="floating-announcement" class="absolute left-1/2 transform -translate-x-1/2 opacity-0 transition-all duration-300 pointer-events-none" style="top: 180px;">
          <span id="floating-announcement-text" class="text-yellow-300 text-xl font-bold" style="text-shadow: 2px 2px 0px #000, 0 0 10px rgba(255,200,0,0.5);">LANDMARK</span>
        </div>

        <!-- Micro objective status -->
        <div id="micro-objective-hud" class="absolute left-1/2 transform -translate-x-1/2 opacity-95 pointer-events-none" style="top: 146px; min-width: 240px; display: none;">
          <div class="game-pixel-container-cyan-700 px-2 py-1 flex flex-col items-center gap-0.5">
            <span id="micro-objective-text" class="text-cyan-100 text-[10px] font-bold text-center" style="text-shadow: 1px 1px 0px #000;"></span>
            <span id="micro-objective-progress" class="text-yellow-200 text-[10px] font-bold" style="text-shadow: 1px 1px 0px #000;"></span>
          </div>
        </div>
        
        <!-- PERFECT Trick Display - Responsive -->
        <div id="perfect-display" class="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-0 transition-all duration-300 pointer-events-none">
          <span id="perfect-text" class="text-yellow-300 text-2xl md:text-4xl font-bold" style="text-shadow: 2px 2px 0px #000, 0 0 15px rgba(255,255,0,0.8);">TÄYDELLINEN!</span>
          <span id="points-popup" class="text-green-400 text-lg md:text-2xl font-bold mt-0.5 md:mt-1" style="text-shadow: 2px 2px 0px #000;">+250</span>
        </div>
        
        <!-- RAGE ACTIVATED Display - Responsive -->
        <div id="rage-activated-display" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-0 transition-all duration-500 pointer-events-none">
          <span class="text-4xl md:text-6xl">😤🔥😤</span>
          <span id="rage-activated-text" class="text-red-500 text-3xl md:text-5xl font-bold mt-1 md:mt-2" style="text-shadow: 3px 3px 0px #000, 0 0 20px rgba(255,0,0,0.9); animation: rageTextPulse 0.2s infinite;">LATURAIVO!!</span>
          <span id="rage-activated-tagline" class="text-yellow-300 text-base md:text-2xl font-bold mt-0.5 md:mt-1" style="text-shadow: 2px 2px 0px #000;">LATU ON MINUN JA VAIN MINUN!</span>
        </div>
        
        <!-- Trick Display - Responsive -->
        <div id="trick-display" class="absolute top-36 md:top-52 left-1/2 transform -translate-x-1/2 opacity-0 transition-all duration-200">
          <span id="trick-text" class="text-green-400 text-xl md:text-3xl font-bold" style="text-shadow: 2px 2px 0px #000, 0 0 15px rgba(34,197,94,0.7);">TEMPPU!</span>
        </div>
        
        <!-- Boss Warning - Improved text wrapping and responsive layout -->
        <div id="boss-warning" class="absolute top-1/4 left-1/2 transform -translate-x-1/2 opacity-0 transition-all duration-500 pointer-events-none" style="max-width: 90%; width: auto;">
          <div class="game-pixel-container-red-700 px-4 py-3 flex flex-col items-center gap-1" style="animation: bossWarningPulse 0.5s infinite; max-width: 350px; margin: 0 auto;">
            <span class="text-lg">⚠️</span>
            <span id="boss-name-text" class="text-yellow-300 text-base md:text-lg font-bold text-center leading-tight" style="text-shadow: 2px 2px 0px #000; word-wrap: break-word; overflow-wrap: break-word; max-width: 300px;">BOSSI</span>
          </div>
        </div>

        <!-- Boss pre-intro video overlay (plays before boss card on selected levels) -->
        <div id="boss-preintro-video-overlay" class="absolute inset-0 opacity-0 transition-opacity duration-200 pointer-events-none" style="z-index: 2210; background: #000;">
          <video id="boss-preintro-video" class="absolute inset-0 w-full h-full object-cover" playsinline webkit-playsinline preload="auto"></video>
          <div class="absolute inset-0" style="background: linear-gradient(to top, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.12) 50%, rgba(0, 0, 0, 0.24) 100%);"></div>
          <div id="boss-preintro-video-hint" class="absolute left-1/2 transform -translate-x-1/2 text-green-300 text-xs md:text-sm font-bold" style="bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px)); text-shadow: 1px 1px 0px #000; animation: bossIntroContinuePulse 1.1s ease-in-out infinite; opacity: 0.55;">
            ${formatSkipHintLine("BOSSI SAAPUU - NAPAUTA OHITTAKSESI")}
          </div>
        </div>

        <div id="boss-midfight-video-overlay" class="absolute inset-0 opacity-0 transition-opacity duration-200 pointer-events-none" style="z-index: 2240; background: #000;">
          <video id="boss-midfight-video" class="absolute inset-0 w-full h-full object-cover" playsinline webkit-playsinline preload="auto"></video>
          <div class="absolute inset-0" style="background: linear-gradient(to top, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.12) 50%, rgba(0, 0, 0, 0.24) 100%);"></div>
          <div id="boss-midfight-video-hint" class="absolute left-1/2 transform -translate-x-1/2 text-green-300 text-xs md:text-sm font-bold" style="bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px)); text-shadow: 1px 1px 0px #000; animation: bossIntroContinuePulse 1.1s ease-in-out infinite; opacity: 0.55;">
            ${formatSkipHintLine("SPICE BOYS TULEE - NAPAUTA OHITTAKSESI")}
          </div>
        </div>

        <!-- Boss Intro Overlay - freezes gameplay behind blurred mask until tap -->
        <div id="boss-intro-overlay" class="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none" style="z-index: 2200; background: rgba(3, 7, 18, 0.56); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
          <div class="w-full h-full flex items-center justify-center px-4">
            <div id="boss-intro-card" class="game-pixel-container-red-700 px-5 md:px-7 py-5 md:py-6 w-full max-w-2xl flex flex-col items-center gap-2 md:gap-3" style="border: 3px solid #facc15; background-color: rgba(0, 0, 0, 0.82);">
              <span id="boss-intro-title" class="text-cyan-300 text-sm md:text-lg font-bold text-center" style="text-shadow: 2px 2px 0px #000;">TASO 1 • BOSSI</span>
              <div class="w-full flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5">
                <img id="boss-intro-portrait" alt="" class="hidden w-40 h-40 md:w-56 md:h-56 object-contain flex-shrink-0" style="image-rendering: pixelated; filter: drop-shadow(0 0 14px rgba(250, 204, 21, 0.35));" />
                <div id="boss-intro-text-wrap" class="flex flex-col items-center md:items-start gap-1 md:gap-2">
                  <span id="boss-intro-name" class="text-yellow-300 text-2xl md:text-4xl font-bold text-center md:text-left uppercase" style="text-shadow: 2px 2px 0px #000;">BOSSI</span>
                  <span id="boss-intro-desc" class="text-white text-sm md:text-base text-center md:text-left leading-snug max-w-lg" style="text-shadow: 1px 1px 0px #000;">Bossi saapui ladulle.</span>
                </div>
              </div>
              <span id="boss-intro-continue" class="text-green-300 text-xs md:text-sm font-bold text-center mt-2" style="text-shadow: 1px 1px 0px #000; animation: bossIntroContinuePulse 1.1s ease-in-out infinite;">${getContinuePromptText()}</span>
            </div>
          </div>
        </div>

        <!-- Super Ability Guide Overlay - pauses gameplay until player taps continue -->
        <div id="super-guide-overlay" class="absolute inset-0 opacity-0 transition-opacity duration-200 pointer-events-none" style="z-index: 2250; background: rgba(2, 6, 23, 0.7); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);">
          <div class="w-full h-full flex items-center justify-center px-4">
            <div id="super-guide-card" class="game-pixel-container-blue-700 px-4 md:px-6 py-4 md:py-5 w-full max-w-xl flex flex-col items-center gap-2 md:gap-3" style="border: 3px solid #22d3ee; background-color: rgba(0, 0, 0, 0.84);">
              <span id="super-guide-title" class="text-cyan-200 text-lg md:text-2xl font-bold text-center uppercase" style="text-shadow: 2px 2px 0px #000;">SUPERKYKY</span>
              <span id="super-guide-desc" class="text-white text-sm md:text-base text-center leading-snug max-w-lg" style="text-shadow: 1px 1px 0px #000;">Superin käytöstä näytetään lyhyt ohje.</span>
              <span id="super-guide-continue" class="text-green-300 text-xs md:text-sm font-bold text-center mt-1" style="text-shadow: 1px 1px 0px #000; animation: bossIntroContinuePulse 1.1s ease-in-out infinite;">${getContinuePromptText()}</span>
            </div>
          </div>
        </div>
        
        <!-- Boss Special Attack Warning - Responsive -->
        <div id="boss-attack-warning" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-150 pointer-events-none" style="z-index: 100;">
          <div id="boss-attack-warning-bg" class="game-pixel-container-orange-600 px-4 md:px-8 py-2 md:py-4 flex flex-col items-center gap-1 md:gap-2" style="animation: bossAttackWarningPulse 0.15s infinite;">
            <span id="boss-attack-warning-icon" class="text-3xl md:text-5xl">⚠️</span>
            <span id="boss-attack-warning-text" class="text-white text-xl md:text-3xl font-bold" style="text-shadow: 2px 2px 0px #000;">VÄISTÄ!</span>
          </div>
        </div>
        
        <!-- Boss Defeated - Responsive -->
        <div id="boss-defeated" class="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-500 pointer-events-none">
          <div class="flex flex-col items-center gap-0.5 md:gap-1">
            <span class="text-2xl md:text-3xl">🏆</span>
            <span id="boss-defeated-text" class="text-green-400 text-xl md:text-3xl font-bold" style="text-shadow: 2px 2px 0px #000, 0 0 15px rgba(34,197,94,0.8);">BOSSI VOITETTU!</span>
          </div>
        </div>
        
        <!-- Boss Health Bar - Responsive size -->
        <div id="boss-health-container" class="absolute top-24 md:top-32 left-1/2 transform -translate-x-1/2 opacity-0 transition-all duration-500 pointer-events-none">
          <div class="flex flex-col items-center gap-0">
            <!-- Boss Warning Icon -->
            <div class="flex items-center gap-1">
              <span class="text-xs md:text-sm animate-pulse">☠️</span>
              <span id="boss-name-label" class="text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-wider" style="text-shadow: 1px 1px 0px #000, 0 0 5px rgba(255,0,0,0.5);">BOSSI</span>
              <span class="text-xs md:text-sm animate-pulse">☠️</span>
            </div>
            <!-- Health Bar Container -->
            <div class="game-pixel-container-slot-gray-900 p-0.5 md:p-1 relative" style="width: 140px;">
              <div id="boss-health-fill" class="game-pixel-container-progress-fill-red-600 h-3 md:h-4 transition-all duration-150" style="width: 100%;"></div>
              <!-- Danger overlay when low health -->
              <div id="boss-health-danger" class="absolute inset-0 bg-yellow-400 opacity-0 pointer-events-none transition-opacity duration-300" style="mix-blend-mode: overlay;"></div>
            </div>
            <!-- Boss Health Percentage -->
            <span id="boss-health-percent" class="text-red-300 text-[8px] md:text-[10px] font-bold" style="text-shadow: 1px 1px 0px #000;">100%</span>
          </div>
        </div>
        
        <!-- ==================== LEFT SIDE INDICATORS (Power-up active timers) ==================== -->
        
        <!-- 20€ Speed Boost - Only visible when active, compact on mobile -->
        <div id="euro20-powerup-container" class="absolute top-36 md:top-44 left-2 md:left-4 opacity-0 transition-all duration-300 transform translate-x-0">
          <div class="game-pixel-container-yellow-500 px-2 md:px-3 py-1 md:py-2 flex flex-col gap-0.5 md:gap-1" style="min-width: 100px; animation: powerupGlow 1s infinite;">
            <div class="flex items-center gap-1 md:gap-2">
              <span class="text-lg md:text-2xl">💶</span>
              <div class="flex flex-col">
                <span class="text-black text-[10px] md:text-sm font-bold">20€</span>
                <span class="text-yellow-900 text-[8px] md:text-xs">+50%</span>
              </div>
            </div>
            <!-- Timer bar -->
            <div class="game-pixel-container-slot-yellow-800 p-0.5" style="height: 6px;">
              <div id="euro20-timer-fill" class="h-full bg-yellow-300 transition-all duration-100" style="width: 100%;"></div>
            </div>
          </div>
        </div>
        
        <!-- 50€ Shield - Only visible when active, compact on mobile -->
        <div id="euro50-powerup-container" class="absolute top-48 md:top-56 left-2 md:left-4 opacity-0 transition-all duration-300 transform translate-x-0">
          <div class="game-pixel-container-cyan-400 px-2 md:px-3 py-1 md:py-2 flex flex-col gap-0.5 md:gap-1" style="min-width: 100px; animation: powerupGlow 1s infinite;">
            <div class="flex items-center gap-1 md:gap-2">
              <span class="text-lg md:text-2xl">💶</span>
              <div class="flex flex-col">
                <span class="text-black text-[10px] md:text-sm font-bold">50€</span>
                <span class="text-cyan-900 text-[8px] md:text-xs">SUOJA</span>
              </div>
            </div>
            <!-- Timer bar -->
            <div class="game-pixel-container-slot-cyan-800 p-0.5" style="height: 6px;">
              <div id="euro50-timer-fill" class="h-full bg-cyan-200 transition-all duration-100" style="width: 100%;"></div>
            </div>
          </div>
        </div>
        
        <!-- Power-up Pickup Notification - Center screen -->
        <div id="powerup-pickup-notification" class="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 pointer-events-none">
          <div id="powerup-notification-bg" class="game-pixel-container-gray-800 px-6 py-4 flex flex-col items-center gap-2" style="min-width: 200px;">
            <span id="powerup-notification-icon" class="text-5xl">💶</span>
            <span id="powerup-notification-name" class="text-white text-2xl font-bold" style="text-shadow: 2px 2px 0px #000;">KAHVITERMOS</span>
            <span id="powerup-notification-desc" class="text-yellow-300 text-lg font-bold" style="text-shadow: 1px 1px 0px #000;">+50% NOPEUS</span>
          </div>
        </div>
        
        <!-- Weather Warning - Responsive -->
        <div id="weather-warning" class="absolute z-[1350] left-1/2 transform -translate-x-1/2 opacity-0 transition-opacity duration-500 pointer-events-none" style="display: none; bottom: max(88px, calc(env(safe-area-inset-bottom, 0px) + 88px));">
          <div id="weather-warning-box" class="flex items-center gap-0.5 md:gap-1 game-pixel-container-blue-800 px-1 md:px-2 py-0.5 md:py-1">
            <span id="weather-icon" class="text-sm md:text-lg animate-bounce">❄️</span>
            <span id="weather-text" class="text-blue-200 text-[10px] md:text-sm font-bold" style="text-shadow: 1px 1px 0px #000;">MYRSKY!</span>
          </div>
        </div>
        

        

        
        <!-- Speed Lines Effect - visible during speed boost -->
        <div id="speed-lines" class="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 overflow-hidden">
          <div class="absolute top-1/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" style="animation: speedLine 0.3s linear infinite;"></div>
          <div class="absolute top-1/3 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-300 to-transparent" style="animation: speedLine 0.25s linear infinite; animation-delay: 0.1s;"></div>
          <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" style="animation: speedLine 0.35s linear infinite; animation-delay: 0.15s;"></div>
          <div class="absolute top-2/3 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-200 to-transparent" style="animation: speedLine 0.28s linear infinite; animation-delay: 0.05s;"></div>
          <div class="absolute top-3/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" style="animation: speedLine 0.32s linear infinite; animation-delay: 0.2s;"></div>
        </div>
        
        <!-- Rage Screen Edge Glow - visible during rage mode -->
        <div id="rage-edge-glow" class="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300" style="box-shadow: inset 0 0 100px 40px rgba(255, 0, 0, 0.6), inset 0 0 200px 80px rgba(255, 50, 0, 0.3);"></div>
        
        <!-- Critical Health Edge Glow - visible when health is low (below 30%) -->
        <div id="critical-health-glow" class="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-500" style="box-shadow: inset 0 0 60px 25px rgba(255, 0, 0, 0.35), inset 0 0 120px 50px rgba(180, 0, 0, 0.15);"></div>
        
        <!-- Damage Overlay - flashes red when player is hit -->
        <div id="damage-overlay" class="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-200 bg-red-600" style="mix-blend-mode: overlay;"></div>
        
        <!-- Damage Text - shows damage number when hit -->
        <div id="damage-text" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 pointer-events-none">
          <span class="text-red-500 text-5xl font-bold" style="text-shadow: 3px 3px 0px #000, 0 0 20px rgba(255,0,0,0.8);">-10</span>
        </div>
        
        <!-- Jump Height Indicator - Shows arc position during jump -->
        <div id="jump-height-indicator" class="absolute left-20 opacity-0 transition-all duration-100 pointer-events-none" style="top: 50%;">
          <div class="flex flex-col items-center gap-1">
            <!-- Jump arc visualization -->
            <div class="relative" style="height: 120px; width: 40px;">
              <!-- Arc track -->
              <div class="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gray-600 opacity-50 rounded-full"></div>
              <!-- Current position marker -->
              <div id="jump-position-marker" class="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-50" style="top: 100%;">
                <div class="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center" style="box-shadow: 0 0 10px rgba(0,255,255,0.8);">
                  <span class="text-xs">⬆️</span>
                </div>
              </div>
              <!-- Peak indicator -->
              <div class="absolute top-0 left-1/2 transform -translate-x-1/2 text-yellow-300 text-sm">🌟</div>
              <!-- Ground indicator -->
              <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-green-400 text-xs">🏔️</div>
            </div>
            <!-- Height text -->
            <span id="jump-height-text" class="text-cyan-300 text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">0m</span>
          </div>
        </div>
        
        <!-- ==================== PAUSE OVERLAY ==================== -->
        <div id="pause-overlay" class="absolute inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center opacity-0 pointer-events-none transition-opacity duration-300 z-[2600]">
          <div class="flex flex-col items-center gap-4 md:gap-6">
            <span class="text-4xl md:text-6xl">⏸️</span>
            <span class="text-yellow-400 text-3xl md:text-5xl font-bold" style="text-shadow: 3px 3px 0px #000000; animation: pausePulse 1s ease-in-out infinite alternate;">${this.pauseHeadlineText}</span>
            <div class="flex flex-col gap-2 mt-4 items-center">
              <span class="text-white text-base text-center max-w-[460px]" style="text-shadow: 2px 2px 0px #000;">${this.pausePromptText}</span>
            </div>
            <button id="pause-fake-reply-btn" class="game-pixel-container-clickable-blue-700 px-4 py-2 mt-1 cursor-pointer hover:brightness-110 active:brightness-90 transition-all pointer-events-auto">
              <span class="text-white text-sm font-bold" style="text-shadow: 1px 1px 0px #000;">📱 TEESKENTELE ETTÄ VASTAAT VIESTIIN</span>
            </button>
            <!-- Main Menu Button -->
            <button id="pause-main-menu-btn" class="game-pixel-container-clickable-red-700 px-4 md:px-6 py-2 md:py-3 mt-2 md:mt-4 cursor-pointer hover:brightness-110 active:brightness-90 transition-all pointer-events-auto">
              <span class="text-white text-base md:text-xl font-bold" style="text-shadow: 2px 2px 0px #000;">🏠 PÄÄVALIKKO</span>
            </button>
          </div>
        </div>

        <!-- Pre-run Loadout Overlay -->
        <div id="pre-run-loadout-overlay" class="absolute inset-0 hidden items-center justify-center opacity-0 transition-opacity duration-200 pointer-events-none" style="z-index: 2100; background: rgba(2, 6, 23, 0.8);">
          <div class="game-pixel-container-gray-800 px-3 md:px-4 py-3 w-[min(94vw,620px)] pointer-events-auto flex flex-col gap-2">
            <div class="flex flex-col items-center gap-0.5">
              <span class="text-yellow-300 text-sm md:text-base font-bold" style="text-shadow: 1px 1px 0px #000;">VALITSE ENNEN LÄHTÖÄ</span>
            </div>
            <div>
              <span class="text-white text-[10px] font-bold">REITTI</span>
              <div id="pre-run-route-options" class="mt-1 grid grid-cols-1 md:grid-cols-3 gap-1.5"></div>
            </div>
            <div>
              <span class="text-white text-[10px] font-bold">PASSIIVI</span>
              <div id="pre-run-passive-options" class="mt-1 grid grid-cols-1 md:grid-cols-3 gap-1.5"></div>
            </div>
            <button id="pre-run-confirm-btn" class="game-pixel-container-clickable-green-600 px-3 py-2 mt-1 text-white text-sm font-bold pointer-events-auto">
              ALOITA
            </button>
          </div>
        </div>
        
        <!-- ==================== BOTTOM BAR: LARGE HEALTH/POWER METERS ==================== -->
        
        <!-- Large Health/Power meters at bottom left - highly visible during gameplay -->
        <div id="bottom-hud-container" class="absolute bottom-32 md:bottom-2 left-4 md:left-4 flex flex-col gap-1 pointer-events-none z-[900]" style="left: max(12px, calc(env(safe-area-inset-left, 0px) + 12px)); bottom: max(128px, calc(env(safe-area-inset-bottom, 0px) + 128px));">
          
          <!-- Health Bar - Large and prominent -->
          <div class="flex items-center gap-2 bg-black/60 rounded-lg px-2 py-1">
            <span class="text-red-500 text-lg md:text-xl">❤️</span>
            <div class="game-pixel-container-slot-gray-800 p-0.5 relative" style="width: 140px; height: 18px;">
              <div id="health-fill-large" class="game-pixel-container-progress-fill-red-500 h-full transition-all duration-150" style="width: 100%;"></div>
              <span id="health-text-large" class="absolute inset-0 flex items-center justify-center text-xs md:text-sm font-bold text-white" style="text-shadow: 1px 1px 0px #000;">100%</span>
            </div>

          </div>
          
          <!-- Power/Energy Bar - Large and prominent -->
          <div class="flex items-center gap-2 bg-black/60 rounded-lg px-2 py-1">
            <span class="text-yellow-400 text-lg md:text-xl">⚡</span>
            <div class="game-pixel-container-slot-gray-800 p-0.5 relative" style="width: 140px; height: 18px;">
              <div id="energy-fill-large" class="game-pixel-container-progress-fill-yellow-400 h-full transition-all duration-150" style="width: 100%;"></div>
              <span id="energy-text-large" class="absolute inset-0 flex items-center justify-center text-xs md:text-sm font-bold text-black" style="text-shadow: 0 0 2px white;">100%</span>
            </div>

          </div>

          <!-- Rage meter (touch layout only) -->
          <div id="rage-meter-large-container" class="hidden items-center gap-2 bg-black/60 rounded-lg px-2 py-1">
            <span class="text-red-500 text-lg md:text-xl">😤</span>
            <div class="game-pixel-container-slot-gray-800 p-0.5 relative" style="width: 140px; height: 18px;">
              <div id="rage-fill-large" class="game-pixel-container-progress-fill-red-600 h-full transition-all duration-150" style="width: 0%;"></div>
              <span id="rage-text-large" class="absolute inset-0 flex items-center justify-center text-xs md:text-sm font-bold text-white" style="text-shadow: 1px 1px 0px #000;">0%</span>
            </div>
          </div>

          <!-- SUPER MODE indicator - Shows when speed boost or shield is active -->
          <div id="super-mode-indicator" class="hidden flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500/80 via-cyan-400/80 to-yellow-500/80 rounded-lg px-3 py-1" style="animation: superModePulse 0.3s infinite;">
            <span class="text-xl" style="animation: superModeFlicker 0.1s infinite;">⭐</span>
            <span id="super-mode-text" class="text-white text-sm font-bold" style="text-shadow: 2px 2px 0px #000;">SUPER!</span>
            <div id="super-mode-timer" class="game-pixel-container-slot-gray-900 p-0.5 relative" style="width: 60px; height: 10px;">
              <div id="super-mode-timer-fill" class="h-full bg-white transition-all duration-100" style="width: 100%;"></div>
            </div>
            <span class="text-xl" style="animation: superModeFlicker 0.1s infinite;">⭐</span>
          </div>
        </div>
        
        <!-- Audio Toggle - Hidden (use touch sound button instead) -->
        <div id="audio-toggle-container" class="absolute bottom-3 right-4 pointer-events-auto hidden">
          <button id="audio-toggle-btn" class="game-pixel-container-clickable-gray-700 px-3 py-2 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
            <span id="audio-icon" class="text-xl">🔊</span>
            <span id="audio-text" class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">ÄÄNI</span>
          </button>
        </div>
        
        <!-- ==================== TOUCH CONTROLS - LEFT: Virtual Joystick ==================== -->
        <div id="mobile-movement-controls" class="absolute mobile-controls-left mobile-controls-bottom flex flex-row items-end gap-3 pointer-events-auto" style="bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px)); left: max(20px, env(safe-area-inset-left, 20px)); opacity: 0.45;">
          <!-- Virtual Joystick Container -->
          <div id="virtual-joystick" class="virtual-joystick-container" style="width: 320px; height: 320px;">
            <div id="joystick-knob" class="virtual-joystick-knob"></div>
            <!-- Direction indicators -->
            <div class="absolute top-2 left-1/2 transform -translate-x-1/2 text-2xl opacity-40 pointer-events-none">⬆️</div>
            <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-2xl opacity-40 pointer-events-none">⬇️</div>
            <div class="absolute left-2 top-1/2 transform -translate-y-1/2 text-2xl opacity-40 pointer-events-none">⬅️</div>
            <div class="absolute right-2 top-1/2 transform -translate-y-1/2 text-2xl opacity-40 pointer-events-none">➡️</div>
          </div>
        </div>
        
        <!-- ==================== TOUCH CONTROLS - RIGHT: Attacks (Large, Thumb-Optimized) ==================== -->
        <div id="mobile-attack-controls" class="absolute mobile-controls-right mobile-controls-bottom flex flex-col gap-4 pointer-events-auto" style="bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px)); right: max(20px, env(safe-area-inset-right, 20px)); opacity: 1;">
          
          <!-- Top row: Special abilities (Voltti and Rage) -->
          <div class="flex gap-4 justify-center">
            <button id="touch-voltti-btn" class="game-pixel-container-clickable-purple-600 touch-control-btn flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 120px; height: 135px; opacity: 0.35;">
              <span class="text-4xl">🔄</span>
              <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">VOLTTI</span>
            </button>
            <button id="touch-rage-btn" class="game-pixel-container-clickable-red-600 touch-control-btn flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 120px; height: 135px; opacity: 0.35;">
              <span class="text-4xl">😤</span>
              <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">RAIVO</span>
            </button>
          </div>
          
          <!-- Bottom row: Dodge + main attacks (Pole and Axe) -->
          <div class="flex gap-4">
            <button id="touch-dodge-btn" class="game-pixel-container-clickable-cyan-700 touch-control-btn flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 120px; height: 135px; opacity: 1;">
              <span class="text-4xl">↩️</span>
              <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">VÄISTÄ</span>
            </button>
            <button id="touch-pole-btn" class="game-pixel-container-clickable-green-600 touch-control-btn flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 120px; height: 135px; opacity: 0.35;">
              <span class="text-4xl">🥢</span>
              <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">SAUVA</span>
            </button>
            <button id="touch-axe-btn" class="game-pixel-container-clickable-orange-600 touch-control-btn flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 120px; height: 135px; opacity: 0.35;">
              <span class="text-4xl">🪓</span>
              <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">KIRVES</span>
            </button>
          </div>
        </div>
        
        <!-- ==================== TOUCH CONTROLS - BOTTOM CENTER: Pause & Sound ==================== -->
        <div id="mobile-center-controls" class="absolute flex flex-row items-center justify-center gap-5 pointer-events-auto" style="left: 50%; transform: translateX(-50%); bottom: max(18px, calc(env(safe-area-inset-bottom, 0px) + 18px)); opacity: 0.82;">
          <button id="touch-pause-btn" class="game-pixel-container-clickable-gray-700 flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 56px; height: 56px;">
            <span class="text-xl">⏸️</span>
          </button>
          <button id="touch-sound-btn" class="game-pixel-container-clickable-gray-700 flex flex-col items-center justify-center active:scale-90 transition-transform touch-none select-none" style="width: 56px; height: 56px;">
            <span id="touch-sound-icon" class="text-xl">🔊</span>
          </button>
        </div>
        
        <!-- ==================== SWIPE GESTURE HINT (Shows first time) ==================== -->
        <div id="swipe-gesture-hint" class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-500 pointer-events-none">
          <div class="flex flex-col items-center gap-2 bg-black/80 rounded-xl px-6 py-4">
            <span class="text-3xl">👆</span>
            <span class="text-white text-sm font-bold text-center" style="text-shadow: 1px 1px 0px #000;">Pyyhkäise ylös hypätäksesi!</span>
          </div>
        </div>
        
        <!-- Custom Animations and Styles -->
        <style>
          @keyframes powerupPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }

          @keyframes tutorialSkipPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.04);
              filter: brightness(1.12);
            }
          }
          
          @keyframes powerupGlow {
            0%, 100% { 
              filter: brightness(1); 
              box-shadow: 0 0 5px rgba(255,255,255,0.3);
            }
            50% { 
              filter: brightness(1.15); 
              box-shadow: 0 0 15px rgba(255,255,255,0.6), 0 0 25px rgba(255,200,0,0.4);
            }
          }
          
          @keyframes powerupSlideIn {
            0% { 
              opacity: 0; 
              transform: translateX(-50px) scale(0.8);
            }
            100% { 
              opacity: 1; 
              transform: translateX(0) scale(1);
            }
          }
          
          @keyframes powerupNotificationPopBig {
            0% { 
              opacity: 0; 
              transform: translate(-50%, -50%) scale(0.3);
            }
            15% { 
              opacity: 1; 
              transform: translate(-50%, -50%) scale(1.5);
            }
            70% { 
              opacity: 1; 
              transform: translate(-50%, -50%) scale(1.4);
            }
            100% { 
              opacity: 0; 
              transform: translate(-50%, -50%) scale(0.5);
            }
          }
          
          @keyframes comboShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            75% { transform: translateX(2px); }
          }
          
          .shake-animation {
            animation: comboShake 0.1s ease-in-out;
          }
          
          @keyframes comboFlash {
            0% { 
              transform: scale(1);
              filter: brightness(1);
              box-shadow: 0 0 0px rgba(255,255,100,0);
            }
            30% { 
              transform: scale(1.35);
              filter: brightness(1.8);
              box-shadow: 0 0 40px rgba(255,255,100,0.9), 0 0 60px rgba(255,200,50,0.6);
            }
            100% { 
              transform: scale(1);
              filter: brightness(1);
              box-shadow: 0 0 0px rgba(255,255,100,0);
            }
          }
          
          .combo-flash-animation {
            animation: comboFlash 0.35s ease-out;
          }
          
          @keyframes bossWarningPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
          
          @keyframes bossAttackWarningPulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.1); filter: brightness(1.3); }
          }

          @keyframes bossIntroContinuePulse {
            0%, 100% { opacity: 0.72; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.04); }
          }
          
          @keyframes rageTextPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          @keyframes rageReadyPulse {
            0%, 100% { box-shadow: 0 0 5px #ff0000; }
            50% { box-shadow: 0 0 20px #ff0000, 0 0 30px #ff6600; }
          }
          
          .rage-ready-pulse {
            animation: rageReadyPulse 0.5s infinite;
          }
          
          @keyframes bossEnragedPulse {
            0%, 100% { transform: translate(-50%, 0) scale(1); }
            50% { transform: translate(-50%, 0) scale(1.02); filter: brightness(1.2); }
          }
          
          @keyframes airtimePulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.05); filter: brightness(1.3); }
          }
          
          @keyframes comboGlow {
            0%, 100% { box-shadow: 0 0 10px rgba(255,165,0,0.5); }
            50% { box-shadow: 0 0 25px rgba(255,165,0,0.9), 0 0 40px rgba(255,100,0,0.5); }
          }
          
          .combo-glow {
            animation: comboGlow 0.5s infinite;
          }
          
          .airtime-high {
            animation: airtimePulse 0.3s infinite !important;
          }
          
          @keyframes pausePulse {
            from { opacity: 0.7; transform: scale(1); }
            to { opacity: 1; transform: scale(1.05); }
          }
          
          @keyframes speedLine {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          
          @keyframes rageEdgeGlowPulse {
            0%, 100% { 
              box-shadow: inset 0 0 100px 40px rgba(255, 0, 0, 0.5), inset 0 0 200px 80px rgba(255, 50, 0, 0.2);
            }
            50% { 
              box-shadow: inset 0 0 120px 60px rgba(255, 0, 0, 0.7), inset 0 0 250px 100px rgba(255, 50, 0, 0.4);
            }
          }
          
          @keyframes healthCriticalPulse {
            0%, 100% { 
              opacity: 1;
              filter: brightness(1);
            }
            50% { 
              opacity: 0.6;
              filter: brightness(1.5);
            }
          }
          
          @keyframes criticalHealthGlowPulse {
            0%, 100% { 
              opacity: 0.4;
              box-shadow: inset 0 0 60px 25px rgba(255, 0, 0, 0.35), inset 0 0 120px 50px rgba(180, 0, 0, 0.15);
            }
            50% { 
              opacity: 0.8;
              box-shadow: inset 0 0 80px 35px rgba(255, 0, 0, 0.5), inset 0 0 150px 70px rgba(180, 0, 0, 0.25);
            }
          }
          
          @keyframes godModePulse {
            0%, 100% { 
              box-shadow: 0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.3);
              filter: brightness(1);
            }
            50% { 
              box-shadow: 0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(168, 85, 247, 0.5);
              filter: brightness(1.3);
            }
          }
          
          @keyframes superModePulse {
            0%, 100% { 
              box-shadow: 0 0 15px rgba(255, 255, 0, 0.6), 0 0 30px rgba(0, 255, 255, 0.4);
              transform: scale(1);
            }
            50% { 
              box-shadow: 0 0 25px rgba(255, 255, 0, 0.9), 0 0 50px rgba(0, 255, 255, 0.6);
              transform: scale(1.02);
            }
          }
          
          @keyframes superModeFlicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
  }

  update(time: number, delta: number): void {
    if (!this.currentGameSceneKey) return;

    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene || !gameScene.player) return;

    const qualityTier = gameScene.qualityTier as "high" | "medium" | "low" | undefined;
    if (qualityTier && qualityTier !== this.lastKnownQualityTier) {
      this.lastKnownQualityTier = qualityTier;
      this.tuneUiRefreshRate(qualityTier);
    }

    if (document.hidden) return;

    const player = gameScene.player;
    const effectiveUiInterval = this.uiEmergencyLowFps
      ? Math.max(this.uiUpdateIntervalMs, 120)
      : this.uiUpdateIntervalMs;
    if (time - this.lastUiDomUpdateTime < effectiveUiInterval) {
      return;
    }
    this.lastUiDomUpdateTime = time;
    const effectiveHeavyInterval = this.uiEmergencyLowFps
      ? Math.max(this.uiHeavyUpdateIntervalMs, 280)
      : this.uiHeavyUpdateIntervalMs;
    const shouldRunHeavyUpdate = time - this.lastUiHeavyUpdateTime >= effectiveHeavyInterval;
    if (shouldRunHeavyUpdate) {
      this.lastUiHeavyUpdateTime = time;
    }
    this.updateTouchAbilityButtonStates(player, gameScene);

    const sceneLevel = Number(gameScene.currentLevel || this.currentLevel || 1);
    if (Number.isFinite(sceneLevel) && sceneLevel > 0 && sceneLevel !== this.currentLevel) {
      this.currentLevel = sceneLevel;
    }
    const levelBadgeValue = this.getCachedElement("level-badge-value");
    const levelBadgeName = this.getCachedElement("level-badge-name");
    if (levelBadgeValue) {
      this.setTextContentIfChanged(levelBadgeValue, `TASO ${this.currentLevel}`);
    }
    if (levelBadgeName) {
      this.setTextContentIfChanged(levelBadgeName, LevelManager.getLevelName(this.currentLevel));
    }

    // Update health bar - shows remaining health from enemy hits
    const healthFill = this.getCachedElement("health-fill");
    const healthText = this.getCachedElement("health-text");
    if (healthFill) {
      const healthPercent = Phaser.Math.Clamp(player.getHealthPercentage(), 0, 100);
      if (Math.abs(healthPercent - this.lastHealthPercentRaw) >= 0.5) {
        this.setStyleIfChanged(healthFill, "width", `${healthPercent}%`);
        this.lastHealthPercentRaw = healthPercent;
      }

      const healthPercentInt = Math.floor(healthPercent);
      if (healthPercentInt !== this.lastHealthPercentText) {
        this.setTextContentIfChanged(healthText, `${healthPercentInt}%`);
        this.lastHealthPercentText = healthPercentInt;
      }

      const healthVisualState = healthPercent <= 25 ? "critical" : healthPercent <= 50 ? "warn" : "normal";
      if (healthVisualState !== this.lastHealthVisualState) {
        if (healthVisualState === "critical") {
          this.setClassNameIfChanged(
            healthFill,
            "game-pixel-container-progress-fill-red-700 h-4 transition-all duration-100"
          );
          this.setStyleIfChanged(healthFill, "animation", "healthCriticalPulse 0.5s infinite");
        } else if (healthVisualState === "warn") {
          this.setClassNameIfChanged(
            healthFill,
            "game-pixel-container-progress-fill-orange-500 h-4 transition-all duration-100"
          );
          this.setStyleIfChanged(healthFill, "animation", "");
        } else {
          this.setClassNameIfChanged(
            healthFill,
            "game-pixel-container-progress-fill-red-500 h-4 transition-all duration-100"
          );
          this.setStyleIfChanged(healthFill, "animation", "");
        }
        this.lastHealthVisualState = healthVisualState;
      }

      const criticalHealthGlow = this.getCachedElement("critical-health-glow");
      if (criticalHealthGlow) {
        const criticalVisible = healthPercent <= 30 && !player.isDead;
        if (criticalVisible !== this.lastCriticalHealthVisible) {
          this.setStyleIfChanged(criticalHealthGlow, "opacity", criticalVisible ? "1" : "0");
          this.setStyleIfChanged(
            criticalHealthGlow,
            "animation",
            criticalVisible ? "criticalHealthGlowPulse 1.5s ease-in-out infinite" : ""
          );
          this.lastCriticalHealthVisible = criticalVisible;
        }
      }
    }

    // Update energy bar with color change when low
    const energyFill = this.getCachedElement("energy-fill");
    const energyText = this.getCachedElement("energy-text");
    if (energyFill) {
      const energyPercent = Phaser.Math.Clamp(player.getEnergyPercentage(), 0, 100);
      if (Math.abs(energyPercent - this.lastEnergyPercentRaw) >= 0.5) {
        this.setStyleIfChanged(energyFill, "width", `${energyPercent}%`);
        this.lastEnergyPercentRaw = energyPercent;
      }

      const energyPercentInt = Math.floor(energyPercent);
      if (energyPercentInt !== this.lastEnergyPercentText) {
        this.setTextContentIfChanged(energyText, `${energyPercentInt}%`);
        this.lastEnergyPercentText = energyPercentInt;
      }

      const energyVisualState = energyPercent <= 30 ? "critical" : energyPercent <= 60 ? "warn" : "normal";
      if (energyVisualState !== this.lastEnergyVisualState) {
        if (energyVisualState === "critical") {
          this.setClassNameIfChanged(
            energyFill,
            "game-pixel-container-progress-fill-red-500 h-4 transition-all duration-100"
          );
        } else if (energyVisualState === "warn") {
          this.setClassNameIfChanged(
            energyFill,
            "game-pixel-container-progress-fill-orange-400 h-4 transition-all duration-100"
          );
        } else {
          this.setClassNameIfChanged(
            energyFill,
            "game-pixel-container-progress-fill-yellow-400 h-4 transition-all duration-100"
          );
        }
        this.lastEnergyVisualState = energyVisualState;
      }
    }

    // Update score with animation
    const scoreText = this.getCachedElement("score-text");
    const scorePopup = this.getCachedElement("score-popup");
    if (scoreText && scorePopup) {
      const currentScore = player.score;
      
      if (currentScore !== this.lastScore) {
        const scoreDiff = currentScore - this.lastScore;
        
        if (scoreDiff > 0 && !this.scoreAnimating) {
          scorePopup.textContent = `+${scoreDiff}`;
          scorePopup.style.opacity = "1";
          scorePopup.style.transform = "translateY(0)";
          
          scoreText.style.transform = "scale(1.15)";
          scoreText.style.color = "#4ade80";
          
          this.scoreAnimating = true;
          
          setTimeout(() => {
            scorePopup.style.opacity = "0";
            scorePopup.style.transform = "translateY(-15px)";
            scoreText.style.transform = "scale(1)";
            scoreText.style.color = "white";
            this.scoreAnimating = false;
          }, 350);
        }
        
        this.lastScore = currentScore;
      }
      
      this.setTextContentIfChanged(scoreText, currentScore.toLocaleString());
    }

    // Combo meter (short-lived burst window after hits).
    const comboMeterContainer = this.getCachedElement("combo-meter-container");
    const comboMeterText = this.getCachedElement("combo-meter-text");
    const comboMeterFill = this.getCachedElement("combo-meter-fill");
    if (comboMeterContainer && comboMeterText && comboMeterFill) {
      const comboCount = Math.max(0, Number(player.comboCount || 0));
      const comboWindowMs = Math.max(400, Number(player.comboTimeWindow || 4000) + comboCount * 200);
      const elapsedMs = Math.max(0, time - Number(player.lastHitTime || 0));
      const comboActive = comboCount > 1 && elapsedMs < comboWindowMs;

      if (comboActive) {
        if (!this.lastComboMeterVisible) {
          this.setStyleIfChanged(comboMeterContainer, "opacity", "1");
          this.lastComboMeterVisible = true;
        }
        this.setTextContentIfChanged(comboMeterText, `COMBO x${comboCount}`);
        const remainingPct = Phaser.Math.Clamp((1 - elapsedMs / comboWindowMs) * 100, 0, 100);
        this.setStyleIfChanged(comboMeterFill, "width", `${remainingPct}%`);
      } else if (this.lastComboMeterVisible) {
        this.setStyleIfChanged(comboMeterContainer, "opacity", "0");
        this.setTextContentIfChanged(comboMeterText, "COMBO x1");
        this.setStyleIfChanged(comboMeterFill, "width", "100%");
        this.lastComboMeterVisible = false;
      }
    }

    // Micro objective HUD text/progress.
    const objectiveHud = this.getCachedElement("micro-objective-hud");
    const objectiveText = this.getCachedElement("micro-objective-text");
    const objectiveProgress = this.getCachedElement("micro-objective-progress");
    if (objectiveText && objectiveProgress) {
      const nextObjectiveText = String(gameScene.microObjectiveHudText || "").trim();
      const nextObjectiveProgress = String(gameScene.microObjectiveHudProgress || "");
      const objectiveVisible = nextObjectiveText.length > 0;
      if (objectiveHud) {
        this.setStyleIfChanged(objectiveHud, "display", objectiveVisible ? "block" : "none");
      }
      if (nextObjectiveText !== this.lastObjectiveHudText) {
        this.setTextContentIfChanged(objectiveText, nextObjectiveText);
        this.lastObjectiveHudText = nextObjectiveText;
      }
      if (nextObjectiveProgress !== this.lastObjectiveHudProgress) {
        this.setTextContentIfChanged(objectiveProgress, nextObjectiveProgress);
        this.lastObjectiveHudProgress = nextObjectiveProgress;
      }
    }


    if (shouldRunHeavyUpdate) {
      // Update jump height indicator - Shows arc position during jump
      const jumpHeightIndicator = this.getCachedElement("jump-height-indicator");
      const jumpPositionMarker = this.getCachedElement("jump-position-marker");
      const jumpHeightText = this.getCachedElement("jump-height-text");
      
      if (jumpHeightIndicator && jumpPositionMarker && jumpHeightText && gameScene.groundY !== undefined) {
      const heightAboveGround = gameScene.groundY - player.y;
      const isJumping = !player.isOnGround && heightAboveGround > 10;
      
      if (isJumping) {
        jumpHeightIndicator.style.opacity = "1";
        
        // Calculate position in arc (0 = ground, 100 = peak)
        // Max jump height is approximately 200px based on gravity and jump power
        const maxJumpHeight = 180;
        const heightPercent = Math.min((heightAboveGround / maxJumpHeight) * 100, 100);
        
        // Position marker (100% = bottom/ground, 0% = top/peak)
        const markerPosition = 100 - heightPercent;
        jumpPositionMarker.style.top = `${markerPosition}%`;
        
        // Update height text
        const heightMeters = (heightAboveGround / 50).toFixed(1); // Scale to meters
        jumpHeightText.textContent = `${heightMeters}m`;
        
        // Color based on height - higher = more golden
        const jumpMarkerDot = this.getJumpMarkerDot(jumpPositionMarker);
        if (heightPercent >= 80) {
          jumpMarkerDot?.classList.remove('bg-cyan-400');
          jumpMarkerDot?.classList.add('bg-yellow-400');
          jumpHeightText.style.color = "#fbbf24";
        } else if (heightPercent >= 50) {
          jumpMarkerDot?.classList.remove('bg-yellow-400', 'bg-cyan-400');
          jumpMarkerDot?.classList.add('bg-purple-400');
          jumpHeightText.style.color = "#c084fc";
        } else {
          jumpMarkerDot?.classList.remove('bg-yellow-400', 'bg-purple-400');
          jumpMarkerDot?.classList.add('bg-cyan-400');
          jumpHeightText.style.color = "#67e8f9";
        }
      } else {
        jumpHeightIndicator.style.opacity = "0";
      }
    }
    
    // Update airtime multiplier - Enhanced version with progressive effects
    const airtimeText = this.getCachedElement("airtime-text");
    const airtimeBg = this.getCachedElement("airtime-bg");
    const airtimeWingsLeft = this.getCachedElement("airtime-wings-left");
    const airtimeWingsRight = this.getCachedElement("airtime-wings-right");
    if (airtimeText && airtimeBg && gameScene.currentAirtimeMultiplier !== undefined) {
      if (gameScene.isInAir && gameScene.currentAirtimeMultiplier > 1) {
        airtimeText.textContent = `ILMALENTO x${gameScene.currentAirtimeMultiplier.toFixed(1)}`;
        airtimeBg.style.opacity = "1";
        
        const scale = Math.min(1 + (gameScene.currentAirtimeMultiplier - 1) * 0.15, 1.4);
        airtimeBg.style.transform = `scale(${scale})`;
        
        // Progressive color and effects based on multiplier
        if (gameScene.currentAirtimeMultiplier >= 4) {
          // Max level - golden, pulsing, multiple emojis
          airtimeText.className = "text-yellow-300 text-2xl font-bold";
          airtimeText.style.textShadow = "3px 3px 0px #000, 0 0 30px rgba(255,200,0,1)";
          airtimeBg.classList.add("airtime-high");
          if (airtimeWingsLeft) airtimeWingsLeft.textContent = "⭐🪽";
          if (airtimeWingsRight) airtimeWingsRight.textContent = "🪽⭐";
        } else if (gameScene.currentAirtimeMultiplier >= 3) {
          // High level - orange glow
          airtimeText.className = "text-orange-400 text-xl font-bold";
          airtimeText.style.textShadow = "3px 3px 0px #000, 0 0 25px rgba(255,150,0,0.9)";
          airtimeBg.classList.remove("airtime-high");
          if (airtimeWingsLeft) airtimeWingsLeft.textContent = "🪽";
          if (airtimeWingsRight) airtimeWingsRight.textContent = "🪽";
        } else if (gameScene.currentAirtimeMultiplier >= 2) {
          // Medium level - purple
          airtimeText.className = "text-purple-300 text-xl font-bold";
          airtimeText.style.textShadow = "3px 3px 0px #000, 0 0 20px rgba(147,51,234,0.8)";
          airtimeBg.classList.remove("airtime-high");
          if (airtimeWingsLeft) airtimeWingsLeft.textContent = "🪽";
          if (airtimeWingsRight) airtimeWingsRight.textContent = "🪽";
        } else {
          // Low level
          airtimeText.className = "text-purple-400 text-lg font-bold";
          airtimeText.style.textShadow = "3px 3px 0px #000, 0 0 15px rgba(147,51,234,0.6)";
          airtimeBg.classList.remove("airtime-high");
          if (airtimeWingsLeft) airtimeWingsLeft.textContent = "🪽";
          if (airtimeWingsRight) airtimeWingsRight.textContent = "🪽";
        }
      } else {
        airtimeBg.style.opacity = "0";
        airtimeBg.classList.remove("airtime-high");
      }
    }

    // Update distance display
    const distanceText = this.getCachedElement("distance-text");
    const distanceFill = this.getCachedElement("distance-fill");
    const distanceIcon = this.getCachedElement("distance-icon");
    const distanceMarker = this.getCachedElement("distance-marker");
    if (distanceText && distanceFill && distanceIcon && gameScene.distanceTraveled !== undefined) {
      const currentDistance = Math.floor(gameScene.distanceTraveled);
      if (currentDistance !== this.lastDistanceMeters) {
        this.setTextContentIfChanged(distanceText, `${currentDistance}m`);
        this.lastDistanceMeters = currentDistance;
      }
      
      const progressPercent = Math.min((currentDistance / this.levelDistance) * 100, 100);
      if (
        this.lastDistanceProgressPercent < 0 ||
        Math.abs(progressPercent - this.lastDistanceProgressPercent) >= 1
      ) {
        this.setStyleIfChanged(distanceFill, "width", `${progressPercent}%`);
        if (distanceMarker) {
          this.setStyleIfChanged(distanceMarker, "left", `${progressPercent}%`);
        }
        this.lastDistanceProgressPercent = progressPercent;
      }
      
      // Change color and icon only when state changes.
      const distanceVisualState = progressPercent >= 95
        ? "goal"
        : progressPercent >= 75
          ? "near"
          : progressPercent >= 50
            ? "mid"
            : "far";
      if (distanceVisualState !== this.lastDistanceVisualState) {
        if (distanceVisualState === "goal") {
          this.setClassNameIfChanged(distanceFill, "game-pixel-container-progress-fill-green-400 h-4 transition-all duration-100");
          this.setTextContentIfChanged(distanceIcon, "🏁");
          this.setStyleIfChanged(distanceText, "color", "#4ade80");
        } else if (distanceVisualState === "near") {
          this.setClassNameIfChanged(distanceFill, "game-pixel-container-progress-fill-yellow-400 h-4 transition-all duration-100");
          this.setTextContentIfChanged(distanceIcon, "⛷️");
          this.setStyleIfChanged(distanceText, "color", "#fbbf24");
        } else if (distanceVisualState === "mid") {
          this.setClassNameIfChanged(distanceFill, "game-pixel-container-progress-fill-cyan-400 h-4 transition-all duration-100");
          this.setTextContentIfChanged(distanceIcon, "🏔️");
          this.setStyleIfChanged(distanceText, "color", "#22d3ee");
        } else {
          this.setClassNameIfChanged(distanceFill, "game-pixel-container-progress-fill-green-500 h-4 transition-all duration-100");
          this.setTextContentIfChanged(distanceIcon, "🏔️");
          this.setStyleIfChanged(distanceText, "color", "white");
        }
        this.lastDistanceVisualState = distanceVisualState;
      }
    }
    
    // Update speed display
    const speedText = this.getCachedElement("speed-text");
    const speedContainer = this.getCachedElement("speed-container");
    if (speedText && speedContainer && gameScene.scrollSpeed !== undefined) {
      // Convert scroll speed to km/h (rough approximation)
      const speedKmh = Math.floor(gameScene.scrollSpeed / 10);
      if (speedKmh !== this.lastSpeedKmh) {
        this.setTextContentIfChanged(speedText, `${speedKmh} km/h`);
        this.lastSpeedKmh = speedKmh;
      }

      const speedVisualState = player.hasSpeedBoost ? "boost" : speedKmh > 40 ? "fast" : "normal";
      if (speedVisualState !== this.lastSpeedVisualState) {
        if (speedVisualState === "boost") {
          this.setStyleIfChanged(speedText, "color", "#fbbf24");
          this.setStyleIfChanged(speedContainer, "opacity", "1");
        } else if (speedVisualState === "fast") {
          this.setStyleIfChanged(speedText, "color", "#22d3ee");
          this.setStyleIfChanged(speedContainer, "opacity", "0.9");
        } else {
          this.setStyleIfChanged(speedText, "color", "#a5b4fc");
          this.setStyleIfChanged(speedContainer, "opacity", "0.7");
        }
        this.lastSpeedVisualState = speedVisualState;
      }
    }
    

    // Update airtime seconds display
    const airtimeSeconds = this.getCachedElement("airtime-seconds");
    if (airtimeSeconds && gameScene.isInAir && gameScene.airtimeStart) {
      const airtimeMs = time - gameScene.airtimeStart;
      const airtimeSec = (airtimeMs / 1000).toFixed(1);
      this.setTextContentIfChanged(airtimeSeconds, `${airtimeSec}s ILMASSA`);
    }
    


    
    // Update power-up timers with visual countdown
    if (gameScene.time) {
      this.updatePowerUpTimers(gameScene.time.now);
    }
    
    // Sync power-up visibility with player state (in case of discrepancy)
    const euro20Container = this.getCachedElement("euro20-powerup-container");
    const euro50Container = this.getCachedElement("euro50-powerup-container");
    
    if (euro20Container && !player.hasSpeedBoost && euro20Container.style.opacity === "1") {
      this.activePowerUps.delete("euro20");
      euro20Container.style.opacity = "0";
    }
    if (euro50Container && !player.hasSalmiakkiShield && euro50Container.style.opacity === "1") {
      this.activePowerUps.delete("euro50");
      euro50Container.style.opacity = "0";
    }
    
    // Update speed lines effect during speed boost
    const speedLines = this.getCachedElement("speed-lines");
    if (speedLines && this.lastSpeedLinesVisible !== player.hasSpeedBoost) {
      this.setStyleIfChanged(speedLines, "opacity", player.hasSpeedBoost ? "0.4" : "0");
      this.lastSpeedLinesVisible = player.hasSpeedBoost;
    }
    
    // Update trick display - Always Voltti
    const trickDisplay = this.getCachedElement("trick-display");
    const trickText = this.getCachedElement("trick-text");
    if (trickDisplay && trickText && player.currentTrick) {
      trickDisplay.style.opacity = "1";
      
      // Always show Voltti
      trickText.textContent = "🔄 VOLTTI!";
      
      trickText.style.transform = `rotate(${player.trickRotation}deg) scale(${1 + player.trickRotation / 720})`;
      
      const progress = player.trickRotation / 360;
      if (progress >= 0.8) {
        trickText.style.color = "#4ade80";
      } else {
        trickText.style.color = "#22d3ee";
      }
    } else if (trickDisplay) {
      trickDisplay.style.opacity = "0";
    }
    
    // Update weather warning - Dynamic based on weather type
    if (gameScene.currentWeather !== undefined) {
      this.applyWeatherWarningState(String(gameScene.currentWeather));
    }
    
    // Update boss health bar - Large and prominent during boss fight
    const bossHealthContainer = this.getCachedElement("boss-health-container");
    const bossHealthFill = this.getCachedElement("boss-health-fill");
    const bossNameLabel = this.getCachedElement("boss-name-label");
    const bossHealthPercent = this.getCachedElement("boss-health-percent");
    const bossHealthDanger = this.getCachedElement("boss-health-danger");
    
    if (bossHealthContainer && bossHealthFill && bossNameLabel && bossHealthPercent) {
      if (gameScene.currentBoss && gameScene.currentBoss.active && !gameScene.currentBoss.isDead) {
        bossHealthContainer.style.opacity = "1";
        const healthPercent = gameScene.currentBoss.getHealthPercentage();
        bossHealthFill.style.width = `${healthPercent}%`;
        bossHealthPercent.textContent = `${Math.ceil(healthPercent)}%`;
        
        // Color changes based on health
        if (healthPercent <= 30) {
          // Critical health - yellow flashing
          bossHealthFill.className = "game-pixel-container-progress-fill-yellow-400 h-4 transition-all duration-150";
          bossHealthPercent.className = "text-yellow-300 text-[10px] font-bold animate-pulse";
          if (bossHealthDanger) bossHealthDanger.style.opacity = "0.3";
        } else if (healthPercent <= 60) {
          // Medium health - orange
          bossHealthFill.className = "game-pixel-container-progress-fill-orange-500 h-4 transition-all duration-150";
          bossHealthPercent.className = "text-orange-300 text-[10px] font-bold";
          if (bossHealthDanger) bossHealthDanger.style.opacity = "0";
        } else {
          // Full health - red
          bossHealthFill.className = "game-pixel-container-progress-fill-red-600 h-4 transition-all duration-150";
          bossHealthPercent.className = "text-red-300 text-[10px] font-bold";
          if (bossHealthDanger) bossHealthDanger.style.opacity = "0";
        }
        
        // Show boss name with appropriate styling - include level number
        const duoFinalBossActive =
          gameScene.currentLevel === LevelManager.TOTAL_LEVELS &&
          gameScene.kanniSupportBoss &&
          gameScene.kanniSupportBoss.active;
        if (duoFinalBossActive) {
          bossNameLabel.textContent = `⚔️ TASO ${gameScene.currentLevel} - PETER KANTELE + SPICE BOYS ⚔️`;
          bossNameLabel.className = "text-cyan-300 text-xs font-bold uppercase tracking-wider";
          bossNameLabel.style.textShadow = "1px 1px 0px #000, 0 0 5px rgba(0,220,255,0.7)";
        } else if (gameScene.currentBoss.isFinalBoss) {
          const finalBossConfig = LevelManager.getBossConfig(gameScene.currentLevel);
          const finalBossName = (finalBossConfig?.bossNameFi || "PÄÄBOSSI").toUpperCase();
          bossNameLabel.textContent = `⚔️ TASO ${gameScene.currentLevel} - PÄÄBOSSI: ${finalBossName} ⚔️`;
          bossNameLabel.className = "text-yellow-400 text-xs font-bold uppercase tracking-wider";
          bossNameLabel.style.textShadow = "1px 1px 0px #000, 0 0 5px rgba(255,200,0,0.7)";
        } else {
          const bossConfig = LevelManager.getBossConfig(gameScene.currentLevel);
          bossNameLabel.textContent = bossConfig ? `⚔️ TASO ${gameScene.currentLevel} - ${bossConfig.bossNameFi.toUpperCase()} ⚔️` : `⚔️ TASO ${gameScene.currentLevel} - BOSSI ⚔️`;
          bossNameLabel.className = "text-red-500 text-xs font-bold uppercase tracking-wider";
          bossNameLabel.style.textShadow = "1px 1px 0px #000, 0 0 5px rgba(255,0,0,0.5)";
        }
        
        // Add pulsing effect when boss is enraged
        if (gameScene.currentBoss.isEnraged) {
          bossHealthContainer.style.animation = "bossEnragedPulse 0.5s infinite";
        } else {
          bossHealthContainer.style.animation = "none";
        }
      } else {
        bossHealthContainer.style.opacity = "0";
      }
    }

    // Update rage meter - Shows progress bar and ready indicator
    // DISABLED DURING BOSS FIGHTS and LOCKED UNTIL LEVEL 3!
    const rageMeterContainer = this.getCachedElement("rage-meter-container");
    const rageReadyContainer = this.getCachedElement("rage-ready-container");
    const rageFill = this.getCachedElement("rage-fill");
    const rageText = this.getCachedElement("rage-text");
    const rageLabel = this.getCachedElement("rage-label");
    const rageButtonContainer = this.getCachedElement("rage-button-container");
    const isBossFight = gameScene.bossActive === true && gameScene.bossDefeated !== true;
    const isRageUnlocked = this.isTutorial || this.currentLevel >= abilityUnlockConfig.rageUnlockLevel.value;
    
    if (rageMeterContainer && rageReadyContainer && rageFill && rageText) {
      const ragePercent = player.getRagePercentage ? player.getRagePercentage() : 0;
      const rageReadyNow = isRageUnlocked && !isBossFight && !player.isRaging && ragePercent >= 100;
      if (!rageReadyNow) {
        this.rageReadySoundPlayed = false;
        this.rageReadySince = 0;
        this.rageReadyHintShown = false;
      } else {
        if (this.rageReadySince <= 0) {
          this.rageReadySince = this.time.now;
        }
        if (!this.rageReadyHintShown && this.time.now - this.rageReadySince >= 3500) {
          this.rageReadyHintShown = true;
          this.showFloatingAnnouncement("LATURAIVO VALMIS - PAINA RAIVO!", 1700);
        }
      }
      
      // Rage not unlocked yet - show locked indicator
      if (!isRageUnlocked) {
        rageMeterContainer.style.opacity = "0.3";
        rageReadyContainer.style.opacity = "0";
        rageFill.style.width = "0%";
        rageText.textContent = "🔒";
        if (rageLabel) rageLabel.textContent = "TASO 3";
        if (rageButtonContainer) {
          rageButtonContainer.style.opacity = "0.3";
          const rageButtonText = this.getCachedElement("rage-button-text");
          if (rageButtonText) rageButtonText.textContent = "🔒 TASO 3";
        }
      }
      // During boss fight, rage is disabled
      else if (isBossFight) {
        rageMeterContainer.style.opacity = "0.3";
        rageReadyContainer.style.opacity = "0";
        rageFill.style.width = `${ragePercent}%`;
        rageText.textContent = "❌";
        if (rageLabel) rageLabel.textContent = "EI BOSSILLA";
        if (rageButtonContainer) {
          rageButtonContainer.style.opacity = "0.3";
        }
      }
      // Player is currently raging
      else if (player.isRaging) {
        rageMeterContainer.style.opacity = "0.5";
        rageReadyContainer.style.opacity = "0";
        rageFill.style.width = "100%";
        rageFill.className = "game-pixel-container-progress-fill-orange-500 h-4 transition-all duration-100";
        rageText.textContent = "🔥";
        if (rageLabel) rageLabel.textContent = "RAIVOAA!";
      }
      // Rage is full (100%) - show ready indicator
      else if (ragePercent >= 100) {
        rageMeterContainer.style.opacity = "1";
        rageReadyContainer.style.opacity = "1";
        rageFill.style.width = "100%";
        rageFill.className = "game-pixel-container-progress-fill-red-500 h-4 transition-all duration-100";
        rageText.textContent = "100%";
        if (rageLabel) rageLabel.textContent = "RAIVO";
        if (rageButtonContainer) {
          rageButtonContainer.style.opacity = "1";
          rageButtonContainer.className = "game-pixel-container-red-600 px-2 py-1 flex items-center justify-center";
          const rageButtonText = this.getCachedElement("rage-button-text");
          if (rageButtonText) rageButtonText.textContent = "RAIVO";
        }
      }
      // Rage is charging - show progress
      else {
        rageMeterContainer.style.opacity = "0.8";
        rageReadyContainer.style.opacity = "0";
        rageFill.style.width = `${ragePercent}%`;
        rageText.textContent = `${Math.floor(ragePercent)}%`;
        
        // Color based on rage level
        if (ragePercent >= 75) {
          rageFill.className = "game-pixel-container-progress-fill-red-500 h-4 transition-all duration-100";
        } else if (ragePercent >= 50) {
          rageFill.className = "game-pixel-container-progress-fill-orange-500 h-4 transition-all duration-100";
        } else {
          rageFill.className = "game-pixel-container-progress-fill-red-600 h-4 transition-all duration-100";
        }
        
        if (rageLabel) rageLabel.textContent = "RAIVO";
        if (rageButtonContainer) {
          rageButtonContainer.style.opacity = "0.4";
          rageButtonContainer.className = "game-pixel-container-gray-800 px-2 py-1 flex items-center justify-center opacity-40";
          const rageButtonText = this.getCachedElement("rage-button-text");
          if (rageButtonText) rageButtonText.textContent = "RAIVO";
        }
      }
    }

    // Update large rage bar (used in touch layout)
    const rageFillLarge = this.getCachedElement("rage-fill-large");
    const rageTextLarge = this.getCachedElement("rage-text-large");
    if (rageFillLarge && rageTextLarge) {
      const ragePercent = player.getRagePercentage ? player.getRagePercentage() : 0;
      if (!isRageUnlocked) {
        rageFillLarge.style.width = "0%";
        rageFillLarge.className = "game-pixel-container-progress-fill-red-600 h-full transition-all duration-150";
        rageTextLarge.textContent = "🔒";
      } else if (isBossFight) {
        rageFillLarge.style.width = `${ragePercent}%`;
        rageFillLarge.className = "game-pixel-container-progress-fill-red-600 h-full transition-all duration-150";
        rageTextLarge.textContent = "❌";
      } else if (player.isRaging) {
        rageFillLarge.style.width = "100%";
        rageFillLarge.className = "game-pixel-container-progress-fill-orange-500 h-full transition-all duration-150";
        rageTextLarge.textContent = "🔥";
      } else if (ragePercent >= 100) {
        rageFillLarge.style.width = "100%";
        rageFillLarge.className = "game-pixel-container-progress-fill-red-500 h-full transition-all duration-150";
        rageTextLarge.textContent = "100%";
      } else {
        rageFillLarge.style.width = `${ragePercent}%`;
        if (ragePercent >= 75) {
          rageFillLarge.className = "game-pixel-container-progress-fill-red-500 h-full transition-all duration-150";
        } else if (ragePercent >= 50) {
          rageFillLarge.className = "game-pixel-container-progress-fill-orange-500 h-full transition-all duration-150";
        } else {
          rageFillLarge.className = "game-pixel-container-progress-fill-red-600 h-full transition-all duration-150";
        }
        rageTextLarge.textContent = `${Math.floor(ragePercent)}%`;
      }
    }
    
    // ========== UPDATE LARGE BOTTOM HUD METERS ==========
    
    // Update large health bar at bottom
    const healthFillLarge = this.getCachedElement("health-fill-large");
    const healthTextLarge = this.getCachedElement("health-text-large");
    if (healthFillLarge && healthTextLarge) {
      const healthPercent = player.getHealthPercentage();
      healthFillLarge.style.width = `${healthPercent}%`;
      healthTextLarge.textContent = `${Math.floor(healthPercent)}%`;
      
      // Color based on health level
      if (healthPercent <= 25) {
        healthFillLarge.className = "game-pixel-container-progress-fill-red-700 h-full transition-all duration-150";
        healthFillLarge.style.animation = "healthCriticalPulse 0.5s infinite";
      } else if (healthPercent <= 50) {
        healthFillLarge.className = "game-pixel-container-progress-fill-orange-500 h-full transition-all duration-150";
        healthFillLarge.style.animation = "";
      } else {
        healthFillLarge.className = "game-pixel-container-progress-fill-red-500 h-full transition-all duration-150";
        healthFillLarge.style.animation = "";
      }
    }
    
    // Update large energy bar at bottom
    const energyFillLarge = this.getCachedElement("energy-fill-large");
    const energyTextLarge = this.getCachedElement("energy-text-large");
    if (energyFillLarge && energyTextLarge) {
      const energyPercent = player.getEnergyPercentage();
      energyFillLarge.style.width = `${energyPercent}%`;
      energyTextLarge.textContent = `${Math.floor(energyPercent)}%`;
      
      // Color based on energy level
      if (energyPercent <= 30) {
        energyFillLarge.className = "game-pixel-container-progress-fill-red-500 h-full transition-all duration-150";
      } else if (energyPercent <= 60) {
        energyFillLarge.className = "game-pixel-container-progress-fill-orange-400 h-full transition-all duration-150";
      } else {
        energyFillLarge.className = "game-pixel-container-progress-fill-yellow-400 h-full transition-all duration-150";
      }
    }
    
      // ========== UPDATE SUPER MODE INDICATOR ==========
      // Show prominent "SUPER!" indicator when speed boost or shield is active
      const superModeIndicator = this.getCachedElement("super-mode-indicator");
      const superModeText = this.getCachedElement("super-mode-text");
      const superModeTimerFill = this.getCachedElement("super-mode-timer-fill");
      
      if (superModeIndicator && superModeText && superModeTimerFill) {
      const hasSpeedBoost = player.hasSpeedBoost;
      const hasShield = player.hasSalmiakkiShield;
      
      if (hasSpeedBoost || hasShield) {
        // Show the super mode indicator
        superModeIndicator.classList.remove("hidden");
        superModeIndicator.classList.add("flex");
        
        // Update text based on active power-up
        if (hasSpeedBoost && hasShield) {
          superModeText.textContent = "SUPER COMBO!";
        } else if (hasShield) {
          superModeText.textContent = "SUOJA P\u00c4\u00c4LL\u00c4!";
        } else {
          superModeText.textContent = "TURBO!";
        }
        
        // Update timer bar - show remaining time
        const now = this.scene.get(this.currentGameSceneKey!)?.time?.now || 0;
        let remainingPercent = 100;
        
        if (hasSpeedBoost && player.speedBoostEndTime > 0) {
          const totalDuration = 6000; // 6 seconds
          const remaining = player.speedBoostEndTime - now;
          remainingPercent = Math.max(0, (remaining / totalDuration) * 100);
        } else if (hasShield && player.salmiakkiEndTime > 0) {
          const totalDuration = 5000; // 5 seconds
          const remaining = player.salmiakkiEndTime - now;
          remainingPercent = Math.max(0, (remaining / totalDuration) * 100);
        }
        
        superModeTimerFill.style.width = `${remainingPercent}%`;
        
        // Flash when about to expire
        if (remainingPercent < 25) {
          superModeTimerFill.style.animation = "healthCriticalPulse 0.3s infinite";
        } else {
          superModeTimerFill.style.animation = "";
        }
      } else {
        // Hide the super mode indicator
        superModeIndicator.classList.add("hidden");
        superModeIndicator.classList.remove("flex");
      }
    }
    }
  }
  
  // ========== NEW WARNING METHODS ==========
  
  // Show warning when player tries to use rage during boss fight
  showRageBlockedWarning(message: string): void {
    const warningContainer = this.getCachedElement("boss-attack-warning");
    const warningBg = this.getCachedElement("boss-attack-warning-bg");
    const warningIcon = this.getCachedElement("boss-attack-warning-icon");
    const warningText = this.getCachedElement("boss-attack-warning-text");
    
    if (warningContainer && warningBg && warningIcon && warningText) {
      // Set content for rage blocked
      warningIcon.textContent = "🚫";
      warningText.textContent = message;
      warningBg.className = "game-pixel-container-red-700 px-8 py-4 flex flex-col items-center gap-2";
      warningBg.style.animation = "bossAttackWarningPulse 0.15s infinite";
      
      // Show warning with scale animation
      warningContainer.style.opacity = "1";
      warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningPopScale})`;
      
      // Play error sound
      utils.playManagedSound(this, "player_hurt", { volume: 0.3 });
      
      // Settle animation
      setTimeout(() => {
        warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningScale})`;
      }, 100);
      
      // Hide after delay
      setTimeout(() => {
        warningContainer.style.opacity = "0";
        warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningHideScale})`;
      }, 1500);
    }
    
    // Haptic feedback for mobile
    this.triggerHapticFeedback("medium");
  }
  
  // Show notice when power-ups are cancelled at boss fight start
  // 50% smaller, positioned on left side, faster exit animation
  showPowerUpsCancelledNotice(): void {
    const warningContainer = this.getCachedElement("boss-attack-warning");
    const warningBg = this.getCachedElement("boss-attack-warning-bg");
    const warningIcon = this.getCachedElement("boss-attack-warning-icon");
    const warningText = this.getCachedElement("boss-attack-warning-text");
    
    if (warningContainer && warningBg && warningIcon && warningText) {
      // Set content for power-ups cancelled - smaller and simpler
      warningIcon.textContent = "💶❌";
      warningIcon.style.fontSize = "24px"; // Smaller icon
      warningText.textContent = "POWER-UPIT POIS!";
      warningText.style.fontSize = "16px"; // Smaller text
      warningBg.className = "game-pixel-container-orange-700 px-4 py-2 flex flex-col items-center gap-1";
      warningBg.style.animation = "none";
      
      // Position on left side, 50% scaled
      warningContainer.style.opacity = "1";
      warningContainer.style.left = "80px";
      warningContainer.style.top = "50%";
      warningContainer.style.transform = "translateY(-50%) scale(0.5)";
      
      // Hide after shorter delay (faster exit)
      setTimeout(() => {
        warningContainer.style.opacity = "0";
        warningContainer.style.transform = "translateY(-50%) scale(0.3)";
        
        // Reset position after animation completes
        setTimeout(() => {
          warningContainer.style.left = "50%";
          warningContainer.style.transform = `translate(-50%, -50%) scale(${this.dangerWarningScale})`;
          warningIcon.style.fontSize = ""; // Reset to default
          warningText.style.fontSize = ""; // Reset to default
        }, 200);
      }, 1000); // Faster exit: 1 second instead of 2
    }
    
    // Also hide power-up indicators
    this.showPowerUpIndicator("euro20", false);
    this.showPowerUpIndicator("euro50", false);
    this.activePowerUps.clear();
  }
}
