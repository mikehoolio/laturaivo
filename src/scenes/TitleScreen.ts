import Phaser from 'phaser';
import * as utils from '../utils';
import { LevelManager } from '../LevelManager';
import { pickHumorLine, TITLE_START_LINES } from '../humor/HumorPack';
import { GameCenterAchievementManager } from '../managers/GameCenterAchievementManager';
import { GameCenterManager, type GameCenterAuthResult } from '../managers/GameCenterManager';
import { shouldIgnoreKeyboardEvent } from '../platform';


export class TitleScreen extends Phaser.Scene {
  private static readonly IOS_AUDIO_BACKEND_KEY = "laturaivo_ios_audio_backend";
  private static readonly IOS_AUDIO_BACKEND_RECOVERY_GUARD_KEY = "laturaivo_ios_audio_backend_recovery_guard";
  private static readonly INSTAGRAM_APP_URL = "instagram://user?username=laturaivo";
  private static readonly INSTAGRAM_URL = "https://www.instagram.com/laturaivo";
  private static readonly YOUTUBE_APP_URL = "vnd.youtube://channel/UCKRZqZMA55IcmZnqvFcazrQ";
  private static readonly YOUTUBE_URL = "https://www.youtube.com/channel/UCKRZqZMA55IcmZnqvFcazrQ";
  private static readonly TIKTOK_APP_URL = "snssdk1233://user/profile/laturaivogame";
  private static readonly TIKTOK_URL = "https://www.tiktok.com/@laturaivogame";
  private static readonly DISCORD_APP_URL = "discord://invite/ssHFejRejq";
  private static readonly DISCORD_URL = "https://discord.gg/ssHFejRejq";

  // UI elements
  uiContainer!: Phaser.GameObjects.DOMElement;
  
  // Input controls - HTML event handlers
  clickHandler?: (event: Event) => void;
  pointerUpHandler?: (event: Event) => void;
  touchStartHandler?: (event: Event) => void;
  touchEndHandler?: (event: Event) => void;
  keydownHandler?: (event: KeyboardEvent) => void;
  
  // Audio
  backgroundMusic!: Phaser.Sound.BaseSound;
  private audioRetryHandlersInstalled: boolean = false;
  private audioRetryHandler?: (event: Event) => void;
  private audioBootstrapTimer?: Phaser.Time.TimerEvent;
  private nativeFallbackMusic?: HTMLAudioElement;
  private nativeFallbackMusicStartInFlight: boolean = false;
  private nativeFallbackRequestToken: number = 0;
  private visibilityAudioHandler?: () => void;
  private gameCenterStatusEl?: HTMLElement | null;
  private gameCenterToastEl?: HTMLElement | null;
  private gameCenterToastTimer?: Phaser.Time.TimerEvent;
  private gameCenterStatusRefreshTimer?: Phaser.Time.TimerEvent;
  private hasStartedGameCenterAuthFlow: boolean = false;
  private lastKnownGameCenterAuthenticated: boolean = false;
  
  // State flags
  isStarting: boolean = false;
  private startPromptText: string = '▶ ALOITA PELI ◀';
  private taglineText: string = 'Latu on raivo.';
  
  // Snowfall effect
  snowflakes: Phaser.GameObjects.Group | null = null;
  



  constructor() {
    super({
      key: "TitleScreen",
    });
    this.isStarting = false;
  }

  init(): void {
    // Reset start flag
    this.isStarting = false;
    this.nativeFallbackMusicStartInFlight = false;
    this.nativeFallbackRequestToken += 1;
    this.hasStartedGameCenterAuthFlow = false;
  }

  create(): void {
    // iOS Audio Unlock: Must unlock audio context on first user interaction
    // This is critical for iOS App Store compliance
    this.unlockAudioForIOS();
    utils.ensureSceneAudioReady(this);
    
    // Initialize sounds first
    this.initializeSounds();
    
    // Create Phaser background image (covers entire canvas properly)
    this.createBackground();
    
    // Create animated snowfall
    this.createSnowfall();
    
    this.startPromptText = pickHumorLine(this, TITLE_START_LINES, this.startPromptText);
    
    // Create DOM UI (UI elements only, no background)
    this.createDOMUI();

    // Set up input controls
    this.setupInputs();
    this.cacheDomReferences();
    this.scheduleMainMenuGameCenterAuth();

    // Play background music
    this.playBackgroundMusic();
    this.startAudioBootstrap();
    this.installAudioRetryHandlers();
    this.installVisibilityAudioHandler();
    
    // Listen for scene shutdown to cleanup event listeners
    this.events.once('shutdown', () => {
      this.cleanupEventListeners();
      this.cleanupSnowfall();
      this.removeAudioRetryHandlers();
      this.removeVisibilityAudioHandler();
      this.stopAudioBootstrap();
      this.stopNativeBackgroundMusicFallback();
      this.stopGameCenterToastTimer();
      this.stopGameCenterStatusRefreshLoop();
    });
  }
  
  /**
   * iOS Audio Unlock - Critical for App Store compliance
   * iOS requires explicit user interaction before audio can play.
   * This registers a one-time touch/pointer event that unlocks the audio context.
   */
  unlockAudioForIOS(): void {
    // Check if audio is already unlocked
    if (this.sound.locked) {
      // Register one-time input to unlock audio
      this.input.once('pointerdown', () => {
        utils.ensureSceneAudioReady(this);
      });
      
      // Also listen for touch events directly on the canvas for iOS
      const canvas = this.game.canvas;
      const unlockHandler = () => {
        utils.ensureSceneAudioReady(this);
        canvas.removeEventListener('touchstart', unlockHandler);
        canvas.removeEventListener('touchend', unlockHandler);
        canvas.removeEventListener('click', unlockHandler);
      };
      
      canvas.addEventListener('touchstart', unlockHandler, { once: true });
      canvas.addEventListener('touchend', unlockHandler, { once: true });
      canvas.addEventListener('click', unlockHandler, { once: true });
    }
  }
  
  createBackground(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Add background image using Phaser (scales properly with canvas)
    const backgroundKey = this.textures.exists("title_menu_background")
      ? "title_menu_background"
      : "snowy_forest_background";
    const bg = this.add.image(width / 2, height / 2, backgroundKey);
    
    // Scale to cover entire screen using initScale for iOS consistency
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const maxDimension = Math.max(scaleX, scaleY) * Math.max(bg.width, bg.height);
    utils.initScale(bg, { x: 0.5, y: 0.5 }, maxDimension, maxDimension);
    
    // Add dark overlay for better text readability
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4);
    overlay.setDepth(1);
  }
  
  createSnowfall(): void {
    // Create snowflakes group
    this.snowflakes = this.add.group();
    
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Create initial snowflakes
    for (let i = 0; i < 50; i++) {
      this.createSnowflake(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(-height, height)
      );
    }
    
    // Continuously spawn new snowflakes
    this.time.addEvent({
      delay: 200,
      callback: () => {
        if (this.snowflakes && this.snowflakes.getLength() < 60) {
          this.createSnowflake(
            Phaser.Math.Between(0, width),
            -20
          );
        }
      },
      loop: true
    });
  }
  
  createSnowflake(x: number, y: number): void {
    const size = Phaser.Math.Between(2, 5);
    const snowflake = this.add.circle(x, y, size, 0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
    snowflake.setDepth(5);
    
    if (this.snowflakes) {
      this.snowflakes.add(snowflake);
    }
    
    // Animate falling and drifting
    const fallDuration = Phaser.Math.Between(4000, 8000);
    const drift = Phaser.Math.Between(-50, 50);
    
    this.tweens.add({
      targets: snowflake,
      y: this.scale.height + 20,
      x: x + drift,
      duration: fallDuration,
      ease: 'Linear',
      onComplete: () => {
        snowflake.destroy();
      }
    });
    
    // Add gentle swaying
    this.tweens.add({
      targets: snowflake,
      x: snowflake.x + Phaser.Math.Between(-20, 20),
      duration: Phaser.Math.Between(1000, 2000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  cleanupSnowfall(): void {
    if (this.snowflakes) {
      this.snowflakes.clear(true, true);
      this.snowflakes = null;
    }
  }
  
  createDOMUI(): void {
    const titleLogoSrc = utils.resolveAssetUrl(this, "laturaivo_game_title", "assets/offline/a2f0f45ad6a6ea7ff98f87011f90c97396932414.png");
    const instagramIconSrc = "assets/custom/ui/social/instagram-placeholder.svg";
    const youtubeIconSrc = "assets/custom/ui/social/youtube-placeholder.svg";
    const tiktokIconSrc = "assets/custom/ui/social/tiktok-placeholder.svg";
    const continueSaveHtml = this.renderContinueSaveHtml(utils.getCampaignSave());

    let uiHTML = `
      <div id="title-screen-container" class="absolute top-0 left-0 w-full h-full z-[1000] flex flex-col items-center overflow-hidden" style="font-family: 'PublicPixel'; padding-top: calc(env(safe-area-inset-top, 0px) + 4px); padding-right: calc(env(safe-area-inset-right, 0px) + 6px); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4px); padding-left: calc(env(safe-area-inset-left, 0px) + 6px);">

        <!-- Main Content Container - Scrollable on mobile -->
        <div class="relative flex flex-col items-center gap-2 py-3 px-2 w-full text-center pointer-events-auto h-full overflow-y-auto">
          
          <!-- Game Title Image Container - Smaller -->
          <div id="game-title-container" class="flex-shrink-0 flex items-center justify-center">
            <img id="game-title-image" 
                 src="${titleLogoSrc}" 
                 alt="LATURAIVO" 
                 class="h-20 md:h-28 mx-4 object-contain pointer-events-none"
                 style="filter: drop-shadow(3px 3px 6px rgba(0,0,0,0.8)); animation: titleFloat 3s ease-in-out infinite;" />
          </div>
          
          <!-- Subtitle -->
          <div class="text-cyan-300 text-base md:text-lg font-bold flex-shrink-0" style="text-shadow: 2px 2px 0px #000000;">
            SUOMI EDITION
          </div>
          
          <!-- Tagline -->
          <div class="text-white text-sm md:text-base flex-shrink-0 max-w-md px-4" style="text-shadow: 2px 2px 0px #000000;">
            ${this.taglineText}
          </div>

          <!-- Tap to Start Text - Mobile only -->
          <div id="press-enter-text" class="text-yellow-400 font-bold pointer-events-none flex-shrink-0 py-2" style="
            font-size: 20px;
            text-shadow: 2px 2px 0px #000000, 0 0 10px rgba(255,200,0,0.5);
            animation: titleBlink 1s ease-in-out infinite alternate;
          ">${this.startPromptText}</div>

          ${continueSaveHtml}
          
          <!-- Leaderboard Button - iOS optimized touch target -->
          <button id="leaderboard-button" class="game-pixel-container-clickable-purple-600 px-6 py-3 cursor-pointer active:scale-95 transition-transform pointer-events-auto mt-2" style="min-height: 48px; -webkit-tap-highlight-color: transparent;">
            <span class="text-white font-bold text-base" style="text-shadow: 2px 2px 0px #000000;">🏆 TOP RAIVOOJAT</span>
          </button>

          <!-- Game Guide Button -->
          <button id="guide-button" class="game-pixel-container-clickable-blue-600 px-6 py-3 cursor-pointer active:scale-95 transition-transform pointer-events-auto mt-2" style="min-height: 48px; -webkit-tap-highlight-color: transparent;">
            <span class="text-white font-bold text-base" style="text-shadow: 2px 2px 0px #000000;">📘 LUE PELIN OHJEET</span>
          </button>

          <div class="flex flex-col items-center gap-2 mt-2 w-full pointer-events-none">
            <div id="game-center-status-badge" class="hidden px-3 py-2 rounded-lg border text-xs md:text-sm font-bold" style="text-shadow: 1px 1px 0px #000000; background: rgba(15, 23, 42, 0.78); border-color: rgba(148, 163, 184, 0.55); color: #cbd5e1;">
              GAME CENTER: TARKISTETAAN...
            </div>
            <div id="game-center-debug-toast" class="px-3 py-2 rounded-lg border text-xs md:text-sm font-bold opacity-0" style="display: none; transform: translateY(-6px); transition: opacity 180ms ease, transform 180ms ease; text-shadow: 1px 1px 0px #000000; background: rgba(15, 23, 42, 0.92); border-color: rgba(148, 163, 184, 0.5); color: #f8fafc;">
              GAME CENTER DEBUG
            </div>
          </div>

          <!-- Social links -->
          <div class="flex flex-col items-center gap-2 mt-3 w-full max-w-md">
            <span class="text-cyan-200 text-xs md:text-sm font-bold" style="text-shadow: 1px 1px 0px #000000;">Laturaivo tarina jatkuu...</span>

            <div class="flex flex-wrap justify-center gap-2 w-full">
              <button id="social-instagram-button" class="game-pixel-container-clickable-pink-600 px-3 py-2 cursor-pointer active:scale-95 transition-transform pointer-events-auto flex items-center gap-2" style="min-height: 44px; -webkit-tap-highlight-color: transparent;">
                <img src="${instagramIconSrc}" alt="" class="w-4 h-4 pointer-events-none" />
                <span class="text-white font-bold text-xs md:text-sm" style="text-shadow: 1px 1px 0px #000000;">INSTAGRAM</span>
              </button>

              <button id="social-youtube-button" class="game-pixel-container-clickable-red-700 px-3 py-2 cursor-pointer active:scale-95 transition-transform pointer-events-auto flex items-center gap-2" style="min-height: 44px; -webkit-tap-highlight-color: transparent;">
                <img src="${youtubeIconSrc}" alt="" class="w-4 h-4 pointer-events-none" />
                <span class="text-white font-bold text-xs md:text-sm" style="text-shadow: 1px 1px 0px #000000;">YOUTUBE</span>
              </button>

              <button id="social-tiktok-placeholder-button" class="game-pixel-container-clickable-gray-700 px-3 py-2 cursor-pointer active:scale-95 transition-transform pointer-events-auto flex items-center gap-2 opacity-90" style="min-height: 44px; -webkit-tap-highlight-color: transparent;">
                <img src="${tiktokIconSrc}" alt="" class="w-4 h-4 pointer-events-none" />
                <span class="text-gray-100 font-bold text-xs md:text-sm" style="text-shadow: 1px 1px 0px #000000;">TIKTOK</span>
              </button>

              <button id="social-discord-button" class="game-pixel-container-clickable-blue-700 px-3 py-2 cursor-pointer active:scale-95 transition-transform pointer-events-auto flex items-center gap-2" style="min-height: 44px; -webkit-tap-highlight-color: transparent;">
                <span class="text-white font-bold text-xs md:text-sm" style="text-shadow: 1px 1px 0px #000000;">💬 DISCORD</span>
              </button>
            </div>
          </div>

          <div class="text-gray-400 text-xs flex-shrink-0 mt-auto pb-2" style="text-shadow: 1px 1px 0px #000000;">
            Julkaisija Owlfox · © Über Creative Oy 2026
          </div>

        </div>

        <!-- Custom Animations and Styles -->
        <style>
          @keyframes titleBlink {
            from { opacity: 0.6; transform: scale(1); }
            to { opacity: 1; transform: scale(1.02); }
          }
          
          @keyframes titleFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-5px); }
          }
          
          /* Hide scrollbar but keep functionality */
          #title-screen-container ::-webkit-scrollbar {
            width: 3px;
          }
          #title-screen-container ::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
          }
          #title-screen-container ::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
          }
        </style>
      </div>
    `;

    // Add DOM element to the scene
    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(10);
  }

  private renderContinueSaveHtml(save: utils.CampaignSaveData | null): string {
    if (!save) return "";

    const savedLevel = Phaser.Math.Clamp(
      Math.floor(Number(save.highestUnlockedLevel || 1)),
      1,
      LevelManager.TOTAL_LEVELS
    );
    if (savedLevel <= 1) return "";

    const savedName = this.sanitizeSavedPlayerName(save.playerName || "");
    const savedDifficulty = this.getSavedDifficultyOrDefault(save.difficulty).toUpperCase();
    const levelName = LevelManager.getLevelName(savedLevel).toUpperCase();
    const saveLine = savedName ? `${savedName} • ${savedDifficulty}` : savedDifficulty;
    const continuesAtBoss = utils.getBossCheckpointLevel() === savedLevel && LevelManager.isBossLevel(savedLevel);
    const continueTargetLine = continuesAtBoss ? `${levelName} • BOSS-CHECKPOINT` : levelName;
    const continueLabel = continuesAtBoss ? "JATKA BOSSILTA" : `JATKA TASOLTA ${savedLevel}`;

    return `
      <div id="title-continue-save-panel" class="game-pixel-container-cyan-900 px-3 py-2 flex flex-col items-center gap-1 mt-1" style="width: min(88vw, 500px); border-color: #67e8f9;">
        <div class="text-cyan-200 text-[9px] md:text-[10px] font-bold" style="text-shadow: 1px 1px 0px #000000;">TALLENNUS: ${saveLine}</div>
        <div class="text-white text-[9px] md:text-[10px] leading-relaxed" style="text-shadow: 1px 1px 0px #000000;">
          ${continueTargetLine}
        </div>
        <button id="title-continue-save-button" class="game-pixel-container-clickable-cyan-600 px-4 py-2 cursor-pointer active:scale-95 transition-transform pointer-events-auto" style="min-height: 42px; -webkit-tap-highlight-color: transparent;">
          <span class="text-white font-bold text-xs md:text-sm" style="text-shadow: 2px 2px 0px #000000;">${continueLabel} ▶</span>
        </button>
      </div>
    `;
  }

  private cacheDomReferences(): void {
    if (!this.uiContainer?.node) return;
    this.gameCenterStatusEl = this.uiContainer.node.querySelector('#game-center-status-badge') as HTMLElement | null;
    this.gameCenterToastEl = this.uiContainer.node.querySelector('#game-center-debug-toast') as HTMLElement | null;
  }

  private scheduleMainMenuGameCenterAuth(): void {
    this.time.delayedCall(420, () => {
      if (!this.sys.isActive() || this.isStarting) return;
      void this.beginMainMenuGameCenterAuth();
    });
  }

  private setGameCenterStatusBadge(
    text: string,
    tone: 'neutral' | 'pending' | 'success' | 'error',
    visible: boolean = true
  ): void {
    const badge = this.gameCenterStatusEl;
    if (!badge) return;

    if (!visible) {
      badge.style.display = 'none';
      badge.classList.add('hidden');
      return;
    }

    const palette = {
      neutral: { background: 'rgba(15, 23, 42, 0.78)', border: 'rgba(148, 163, 184, 0.55)', color: '#cbd5e1' },
      pending: { background: 'rgba(14, 116, 144, 0.82)', border: 'rgba(103, 232, 249, 0.75)', color: '#ecfeff' },
      success: { background: 'rgba(21, 128, 61, 0.84)', border: 'rgba(134, 239, 172, 0.8)', color: '#f0fdf4' },
      error: { background: 'rgba(153, 27, 27, 0.86)', border: 'rgba(252, 165, 165, 0.8)', color: '#fef2f2' }
    } as const;
    const activePalette = palette[tone];

    badge.textContent = text;
    badge.style.display = 'inline-flex';
    badge.style.background = activePalette.background;
    badge.style.borderColor = activePalette.border;
    badge.style.color = activePalette.color;
    badge.classList.remove('hidden');
  }

  private stopGameCenterToastTimer(): void {
    if (!this.gameCenterToastTimer) return;
    this.gameCenterToastTimer.destroy();
    this.gameCenterToastTimer = undefined;
  }

  private stopGameCenterStatusRefreshLoop(): void {
    if (!this.gameCenterStatusRefreshTimer) return;
    this.gameCenterStatusRefreshTimer.destroy();
    this.gameCenterStatusRefreshTimer = undefined;
  }

  private startGameCenterStatusRefreshLoop(totalDurationMs: number = 12000, intervalMs: number = 900): void {
    this.stopGameCenterStatusRefreshLoop();
    const repeatCount = Math.max(1, Math.floor(totalDurationMs / intervalMs));
    this.gameCenterStatusRefreshTimer = this.time.addEvent({
      delay: intervalMs,
      repeat: repeatCount,
      callback: () => {
        if (!this.sys.isActive() || this.isStarting) {
          this.stopGameCenterStatusRefreshLoop();
          return;
        }
        void this.refreshGameCenterStatus();
      }
    });
  }

  private showGameCenterDebugToast(message: string, tone: 'neutral' | 'success' | 'error'): void {
    const toast = this.gameCenterToastEl;
    if (!toast) return;

    const palette = {
      neutral: { background: 'rgba(15, 23, 42, 0.92)', border: 'rgba(148, 163, 184, 0.5)', color: '#f8fafc' },
      success: { background: 'rgba(20, 83, 45, 0.94)', border: 'rgba(134, 239, 172, 0.82)', color: '#f0fdf4' },
      error: { background: 'rgba(127, 29, 29, 0.96)', border: 'rgba(252, 165, 165, 0.82)', color: '#fff1f2' }
    } as const;
    const activePalette = palette[tone];

    this.stopGameCenterToastTimer();
    toast.textContent = message;
    toast.style.display = 'inline-flex';
    toast.style.background = activePalette.background;
    toast.style.borderColor = activePalette.border;
    toast.style.color = activePalette.color;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    this.gameCenterToastTimer = this.time.delayedCall(2600, () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      this.gameCenterToastTimer = this.time.delayedCall(220, () => {
        toast.style.display = 'none';
        this.gameCenterToastTimer = undefined;
      });
    });
  }

  private compactGameCenterMessage(message: string): string {
    return String(message || 'Tuntematon virhe')
      .replace(/^Game Center authentication failed:\s*/i, '')
      .replace(/^Game Center authentication was cancelled$/i, 'Kirjautuminen peruutettiin.')
      .replace(/The requested operation could not be completed because this application is not recognised by Game Center\./i, 'Sovellusta ei ole tunnistettu Game Centerissa.')
      .trim();
  }

  private async refreshGameCenterStatus(showSuccessToast: boolean = false): Promise<void> {
    const status = await GameCenterManager.getStatus();
    if (!this.sys.isActive() || this.isStarting) return;

    const becameAuthenticated = status.authenticated && !this.lastKnownGameCenterAuthenticated;
    this.lastKnownGameCenterAuthenticated = status.authenticated;

    if (status.authenticated) {
      const alias = (status.alias || 'KIRJAUTUNUT').toUpperCase();
      this.setGameCenterStatusBadge(`GAME CENTER: ${alias}`, 'success', true);
      void GameCenterAchievementManager.flushPendingAchievements();
      if (showSuccessToast || becameAuthenticated) {
        this.showGameCenterDebugToast(`Game Center OK: ${status.alias || 'Pelaaja'}`, 'success');
      }
      this.stopGameCenterStatusRefreshLoop();
      return;
    }

    if (!status.nativeIOS) {
      this.setGameCenterStatusBadge('', 'neutral', false);
      this.stopGameCenterStatusRefreshLoop();
    }
  }

  private updateGameCenterUi(result: GameCenterAuthResult): void {
    if (!result.nativeIOS) {
      this.setGameCenterStatusBadge('', 'neutral', false);
      this.lastKnownGameCenterAuthenticated = false;
      return;
    }

    if (result.authenticated) {
      const alias = (result.alias || 'KIRJAUTUNUT').toUpperCase();
      this.setGameCenterStatusBadge(`GAME CENTER: ${alias}`, 'success', true);
      void GameCenterAchievementManager.flushPendingAchievements();
      this.showGameCenterDebugToast(`Game Center OK: ${result.alias || 'Pelaaja'}`, 'success');
      this.lastKnownGameCenterAuthenticated = true;
      this.stopGameCenterStatusRefreshLoop();
      return;
    }

    this.lastKnownGameCenterAuthenticated = false;
    this.setGameCenterStatusBadge('GAME CENTER: EI KIRJAUTUNUT', 'error', true);
    this.showGameCenterDebugToast(
      `Game Center auth epäonnistui: ${this.compactGameCenterMessage(result.message)}`,
      'error'
    );
    this.startGameCenterStatusRefreshLoop();
  }

  private async beginMainMenuGameCenterAuth(): Promise<void> {
    if (this.hasStartedGameCenterAuthFlow || this.isStarting) return;
    this.hasStartedGameCenterAuthFlow = true;

    if (!GameCenterManager.isNativeIOSPlatform()) {
      this.setGameCenterStatusBadge('', 'neutral', false);
      return;
    }

    this.setGameCenterStatusBadge('GAME CENTER: KIRJAUDUTAAN...', 'pending', true);
    const result = await GameCenterManager.ensureAuthenticatedForMainMenu();
    if (!this.sys.isActive() || this.isStarting) return;
    this.updateGameCenterUi(result);
  }
  
  setupInputs(): void {
    // Add HTML event listeners for touch/pointer events.
    const handleStart = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea')) {
        return;
      }
      event.preventDefault();
      this.startGame();
    };
    const handleKeyboardStart = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;
      if (event.code !== "Enter" && event.code !== "Space") return;

      event.preventDefault();
      this.startGame();
    };
    
    // Add click event to the UI container
    if (this.uiContainer && this.uiContainer.node) {
      this.uiContainer.node.addEventListener('click', handleStart);
      this.uiContainer.node.addEventListener('pointerup', handleStart);
      this.uiContainer.node.addEventListener('touchstart', handleStart, { passive: false });
      this.uiContainer.node.addEventListener('touchend', handleStart, { passive: false });
    }

    // Store event listeners for cleanup
    this.clickHandler = handleStart;
    this.pointerUpHandler = handleStart;
    this.touchStartHandler = handleStart;
    this.touchEndHandler = handleStart;
    this.keydownHandler = handleKeyboardStart;
    window.addEventListener("keydown", handleKeyboardStart, { capture: true });
    
    // Leaderboard button handler - use uiContainer's node for reliable DOM access
    this.time.delayedCall(50, () => {
      const leaderboardButton = this.uiContainer?.node?.querySelector('#leaderboard-button') as HTMLElement;
      const guideButton = this.uiContainer?.node?.querySelector('#guide-button') as HTMLElement;
      const continueSaveButton = this.uiContainer?.node?.querySelector('#title-continue-save-button') as HTMLElement;
      const instagramButton = this.uiContainer?.node?.querySelector('#social-instagram-button') as HTMLElement;
      const youtubeButton = this.uiContainer?.node?.querySelector('#social-youtube-button') as HTMLElement;
      const tiktokButton = this.uiContainer?.node?.querySelector('#social-tiktok-placeholder-button') as HTMLElement;
      const discordButton = this.uiContainer?.node?.querySelector('#social-discord-button') as HTMLElement;
      if (continueSaveButton) {
        const startSavedGame = (event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          this.startSavedGame();
        };
        continueSaveButton.addEventListener('click', startSavedGame);
        continueSaveButton.addEventListener('touchend', startSavedGame);
        continueSaveButton.addEventListener('pointerup', startSavedGame);
        continueSaveButton.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
        }, { passive: false });
      }

      if (leaderboardButton) {
        leaderboardButton.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering game start
          this.openLeaderboard();
        });
        leaderboardButton.addEventListener('touchend', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openLeaderboard();
        });
        leaderboardButton.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openLeaderboard();
        });
        leaderboardButton.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
        }, { passive: false });
      }

      if (guideButton) {
        guideButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openGameGuide();
        });
        guideButton.addEventListener('touchend', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openGameGuide();
        });
        guideButton.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.openGameGuide();
        });
        guideButton.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
        }, { passive: false });
      }

      const bindExternalLinkButton = (button: HTMLElement | null, appUrl: string, fallbackUrl: string) => {
        if (!button) return;

        const openLink = (event: Event) => {
          event.stopPropagation();
          event.preventDefault();
          this.openExternalAppLink(appUrl, fallbackUrl);
        };

        button.addEventListener('click', openLink);
        button.addEventListener('touchend', openLink);
        button.addEventListener('pointerup', openLink);
        button.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
        }, { passive: false });
      };

      bindExternalLinkButton(instagramButton, TitleScreen.INSTAGRAM_APP_URL, TitleScreen.INSTAGRAM_URL);
      bindExternalLinkButton(youtubeButton, TitleScreen.YOUTUBE_APP_URL, TitleScreen.YOUTUBE_URL);
      bindExternalLinkButton(tiktokButton, TitleScreen.TIKTOK_APP_URL, TitleScreen.TIKTOK_URL);
      bindExternalLinkButton(discordButton, TitleScreen.DISCORD_APP_URL, TitleScreen.DISCORD_URL);
    });
  }

  private getSavedDifficultyOrDefault(value: unknown): "espoo" | "vantaa" | "lahti" {
    return value === "espoo" || value === "lahti" || value === "vantaa"
      ? value
      : "vantaa";
  }

  private sanitizeSavedPlayerName(rawName: string): string {
    return rawName.toUpperCase().replace(/[^A-ZÄÖÅ0-9 ]/g, "").substring(0, 12).trim();
  }

  private startSavedGame(): void {
    if (this.isStarting) return;

    const campaignSave = utils.getCampaignSave();
    const savedLevel = Phaser.Math.Clamp(
      Math.floor(Number(campaignSave?.highestUnlockedLevel || 1)),
      1,
      LevelManager.TOTAL_LEVELS
    );
    if (!campaignSave || savedLevel <= 1) {
      this.startGame();
      return;
    }

    this.isStarting = true;
    this.sound.play("ui_click_sound", { volume: 0.5 });

    this.cleanupEventListeners();
    this.cleanupSnowfall();
    this.stopGameCenterToastTimer();
    this.stopGameCenterStatusRefreshLoop();

    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
    }
    this.stopAudioBootstrap();
    this.stopNativeBackgroundMusicFallback();

    const playerName = this.sanitizeSavedPlayerName(campaignSave.playerName || "") || "PELAAJA";
    const difficulty = this.getSavedDifficultyOrDefault(campaignSave.difficulty);
    const characterType: "male" = "male";
    const startAtBossFight = utils.getBossCheckpointLevel() === savedLevel && LevelManager.isBossLevel(savedLevel);

    utils.markTutorialCompleted();
    this.registry.set("playerName", playerName);
    this.registry.set("godModeActivated", false);
    this.registry.set("cheatCodeUsed", false);
    this.registry.set("leaderboardEligible", true);
    this.registry.set("characterType", characterType);
    this.registry.set("difficulty", difficulty);
    this.registry.set("humorPackEnabled", true);
    this.registry.set("selectedReplayLevel", savedLevel);
    this.registry.set("isReturningPlayerSession", true);
    this.registry.set("tutorialReplayPromptShown", false);

    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.time.delayedCall(500, () => {
      if (savedLevel === 2 && !startAtBossFight) {
        this.scene.start("StoryScene", {
          storyKey: "intro",
          nextScene: "GameScene",
          nextSceneData: {
            level: 2,
            characterType,
            isTutorial: false
          }
        });
        return;
      }

      this.scene.start("GameScene", {
        level: savedLevel,
        characterType,
        isTutorial: false,
        startAtBossFight,
        bossRetryDeaths: startAtBossFight ? 1 : 0
      });
    });
  }

  private openExternalAppLink(appUrl: string, fallbackUrl: string): void {
    if (this.isStarting || !appUrl || !fallbackUrl) return;
    this.sound.play("ui_click_sound", { volume: 0.45 });

    let appOpened = false;
    let fallbackTimer: number | undefined;

    const cleanup = () => {
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      window.removeEventListener("blur", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibilityChange, true);
    };

    const onBlur = () => {
      appOpened = true;
      cleanup();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        appOpened = true;
        cleanup();
      }
    };

    window.addEventListener("blur", onBlur, true);
    document.addEventListener("visibilitychange", onVisibilityChange, true);

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (appOpened) return;
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }, 950);

    // Try app deep-link first; fallback opens the web URL if app is not installed.
    try {
      window.location.href = appUrl;
    } catch {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  }
  
  openLeaderboard(): void {
    // Prevent opening if already starting game
    if (this.isStarting) return;
    if (this.scene.isActive('LeaderboardUIScene')) return;
    
    // Play click sound
    this.sound.play("ui_click_sound", { volume: 0.5 });
    
    // Launch leaderboard scene as overlay (don't stop title screen)
    if (!this.scene.isPaused(this.scene.key)) {
      this.scene.pause();
    }
    this.scene.launch('LeaderboardUIScene', { previousScene: 'TitleScreen' });
  }

  openGameGuide(): void {
    if (this.isStarting) return;
    if (this.scene.isActive('GameGuideScene')) return;

    this.sound.play("ui_click_sound", { volume: 0.5 });

    if (!this.scene.isPaused(this.scene.key)) {
      this.scene.pause();
    }
    this.scene.launch('GameGuideScene', { previousScene: 'TitleScreen' });
  }

  initializeSounds(): void {
    // Initialize background music only if key is already loaded.
    // Music files are now lazy-loaded for performance.
    if (this.cache.audio.exists("laturaivo_theme")) {
      this.backgroundMusic = this.sound.add("laturaivo_theme", {
        volume: 0.32,
        loop: true
      });
    } else {
      this.backgroundMusic = undefined;
    }
  }

  playBackgroundMusic(): void {
    try {
      console.log(
        `[TitleScreenAudio] locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)}`
      );
      if (utils.isIOS()) {
        this.startNativeBackgroundMusicFallback();
        return;
      }
      if (this.backgroundMusic) {
        this.backgroundMusic.play();
        this.time.delayedCall(600, () => {
          if (!this.backgroundMusic?.isPlaying && !this.sound.mute) {
            this.startNativeBackgroundMusicFallback();
          }
        });
      } else if (!this.sound.mute) {
        // Lazy path: no cached Phaser music yet, use HTMLAudio fallback directly.
        this.startNativeBackgroundMusicFallback();
      }
    } catch (error) {
      console.error("[TitleScreenAudio] Initial play failed", error);
      this.startNativeBackgroundMusicFallback();
    }
  }

  private startAudioBootstrap(): void {
    this.stopAudioBootstrap();

    let attempts = 0;
    this.audioBootstrapTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        attempts += 1;
        utils.ensureSceneAudioReady(this);
        if (utils.isIOS()) {
          if (!this.sound.mute && !this.isNativeFallbackMusicPlaying()) {
            this.startNativeBackgroundMusicFallback();
          }
          if (!this.isNativeFallbackMusicPlaying() && attempts >= 24) {
            console.error(
              `[TitleScreenAudio] bootstrap-timeout locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)}`
            );
            this.startNativeBackgroundMusicFallback();
          }
          if (this.isNativeFallbackMusicPlaying() || attempts >= 24) {
            this.stopAudioBootstrap();
          }
          return;
        }

        if (!this.sound.mute && this.backgroundMusic && !this.backgroundMusic.isPlaying) {
          try {
            this.backgroundMusic.play();
          } catch {
            // Keep retrying during bootstrap window.
          }
        }

        if (!this.backgroundMusic?.isPlaying && attempts >= 24) {
          console.error(
            `[TitleScreenAudio] bootstrap-timeout locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)}`
          );
          this.startNativeBackgroundMusicFallback();
          this.recoverIOSAudioBackendFromTimeout();
        }

        if (this.backgroundMusic?.isPlaying || this.isNativeFallbackMusicPlaying() || attempts >= 24) {
          this.stopAudioBootstrap();
        }
      }
    });
  }

  private stopAudioBootstrap(): void {
    if (!this.audioBootstrapTimer) return;
    this.audioBootstrapTimer.destroy();
    this.audioBootstrapTimer = undefined;
  }

  private isNativeFallbackMusicPlaying(): boolean {
    return !!this.nativeFallbackMusic && !this.nativeFallbackMusic.paused && !this.nativeFallbackMusic.ended;
  }

  private resolveAudioUrlFromPack(pack: any, key: string): string | null {
    if (!pack || typeof pack !== "object") return null;
    const sections = Object.values(pack);
    for (const section of sections) {
      const files = Array.isArray((section as any)?.files) ? (section as any).files : [];
      const match = files.find((file: any) => file?.type === "audio" && file?.key === key);
      if (!match) continue;
      const resolved = utils.pickPreferredAudioUrl(match.url);
      if (resolved) return resolved;
    }
    return null;
  }

  private isNativeFallbackRequestValid(token: number): boolean {
    return token === this.nativeFallbackRequestToken && this.sys.isActive() && !this.isStarting;
  }

  private startNativeBackgroundMusicWithUrl(url: string, requestToken?: number): void {
    if (!url) return;
    const token = requestToken ?? this.nativeFallbackRequestToken;
    if (!this.isNativeFallbackRequestValid(token)) return;

    const targetSrc = (() => {
      try {
        return new URL(url, window.location.href).toString();
      } catch {
        return url;
      }
    })();

    if (this.nativeFallbackMusic) {
      const currentSrc = this.nativeFallbackMusic.src || "";
      const sameSource = currentSrc === targetSrc || currentSrc.endsWith(url);
      this.nativeFallbackMusic.loop = true;
      this.nativeFallbackMusic.volume = utils.applyGameVolume(0.32);
      this.nativeFallbackMusic.muted = !!this.sound.mute;

      if (sameSource) {
        if (this.nativeFallbackMusic.paused && !this.sound.mute) {
          void this.nativeFallbackMusic.play().catch((error) => {
            console.error("[TitleScreenAudioFallback] resume failed", error);
          });
        }
        return;
      }

      this.teardownNativeFallbackMusic();
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = utils.applyGameVolume(0.32);
    audio.muted = !!this.sound.mute;
    audio.preload = "auto";
    (audio as any).playsInline = true;
    (audio as any).webkitPlaysInline = true;

    this.nativeFallbackMusic = audio;
    console.log(`[TitleScreenAudioFallback] attempt src=${url}`);
    void audio.play().then(() => {
      if (!this.isNativeFallbackRequestValid(token)) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Ignore teardown issues.
        }
        return;
      }
      console.log(`[TitleScreenAudioFallback] playing src=${url}`);
      // Prevent doubled music if Phaser BGM is also audible.
      try {
        if (this.backgroundMusic?.isPlaying) {
          this.backgroundMusic.stop();
        }
      } catch {
        // Ignore stop issues.
      }
    }).catch((error) => {
      console.error("[TitleScreenAudioFallback] play failed", error);
    });
  }

  private startNativeBackgroundMusicFallback(): void {
    const requestToken = this.nativeFallbackRequestToken;
    if (!this.isNativeFallbackRequestValid(requestToken)) return;
    if (this.nativeFallbackMusicStartInFlight) return;
    if (this.nativeFallbackMusic) {
      this.nativeFallbackMusic.muted = !!this.sound.mute;
      if (this.nativeFallbackMusic.paused && !this.sound.mute) {
        void this.nativeFallbackMusic.play().catch((error) => {
          console.error("[TitleScreenAudioFallback] resume failed", error);
        });
      }
      return;
    }

    const cachedPack = this.cache.json.get("assetPackFull") || this.cache.json.get("assetPack");
    const cachedUrl = this.resolveAudioUrlFromPack(cachedPack, "laturaivo_theme");
    if (cachedUrl) {
      this.startNativeBackgroundMusicWithUrl(cachedUrl, requestToken);
      return;
    }

    this.nativeFallbackMusicStartInFlight = true;
    const fetchAssetPack = async (): Promise<any | null> => {
      const candidateUrls = ["assets/asset-pack.json", "./assets/asset-pack.json", "/assets/asset-pack.json"];
      for (const candidate of candidateUrls) {
        try {
          const response = await fetch(candidate);
          if (response.ok) return await response.json();
        } catch {
          // Try next candidate URL.
        }
      }
      return null;
    };

    void fetchAssetPack()
      .then((pack) => {
        if (!this.isNativeFallbackRequestValid(requestToken)) return;
        if (!pack) {
          console.error("[TitleScreenAudioFallback] Failed to fetch asset pack from all candidate URLs");
          return;
        }
        const url = this.resolveAudioUrlFromPack(pack, "laturaivo_theme");
        if (!url) {
          console.error("[TitleScreenAudioFallback] laturaivo_theme URL not found in asset pack");
          return;
        }
        this.startNativeBackgroundMusicWithUrl(url, requestToken);
      })
      .catch((error) => {
        if (this.isNativeFallbackRequestValid(requestToken)) {
          console.error("[TitleScreenAudioFallback] Failed to fetch asset pack", error);
        }
      })
      .finally(() => {
        if (requestToken === this.nativeFallbackRequestToken) {
          this.nativeFallbackMusicStartInFlight = false;
        }
      });
  }

  private stopNativeBackgroundMusicFallback(): void {
    this.nativeFallbackRequestToken += 1;
    this.nativeFallbackMusicStartInFlight = false;
    this.teardownNativeFallbackMusic();
  }

  private teardownNativeFallbackMusic(): void {
    if (!this.nativeFallbackMusic) return;
    try {
      this.nativeFallbackMusic.pause();
      this.nativeFallbackMusic.currentTime = 0;
    } catch {
      // Ignore teardown issues.
    }
    this.nativeFallbackMusic = undefined;
  }

  private recoverIOSAudioBackendFromTimeout(): void {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (!isIOS) return;
    if (this.game.device.audio.webAudio !== false) return;

    try {
      const guardValue = window.sessionStorage?.getItem(TitleScreen.IOS_AUDIO_BACKEND_RECOVERY_GUARD_KEY);
      if (guardValue === "1") return;

      window.sessionStorage?.setItem(TitleScreen.IOS_AUDIO_BACKEND_RECOVERY_GUARD_KEY, "1");
      window.localStorage?.setItem(TitleScreen.IOS_AUDIO_BACKEND_KEY, "webaudio");
      console.error("[AudioBackendRecovery] HTML5 title audio timed out. Switching to WebAudio and reloading once.");
      window.setTimeout(() => window.location.reload(), 120);
    } catch {
      // Ignore storage/reload recovery failures.
    }
  }

  private installAudioRetryHandlers(): void {
    if (this.audioRetryHandlersInstalled) return;
    this.audioRetryHandlersInstalled = true;

    this.audioRetryHandler = () => {
      utils.ensureSceneAudioReady(this);
      if (utils.isIOS()) {
        if (!this.sound.mute && !this.isNativeFallbackMusicPlaying()) {
          this.startNativeBackgroundMusicFallback();
        }
        if (!this.sound.locked) {
          this.removeAudioRetryHandlers();
        }
        return;
      }
      if (!this.sound.mute && this.backgroundMusic && !this.backgroundMusic.isPlaying) {
        try {
          this.backgroundMusic.play();
        } catch (error) {
          console.debug("[TitleScreenAudio] Retry play failed", error);
          return;
        }
      }
      if (!this.sound.locked) {
        this.removeAudioRetryHandlers();
      }
    };

    const handler = this.audioRetryHandler;
    if (!handler) return;
    window.addEventListener("touchstart", handler, { passive: true, capture: true });
    window.addEventListener("pointerdown", handler, { passive: true, capture: true });
    window.addEventListener("click", handler, { passive: true, capture: true });
    document.addEventListener("visibilitychange", handler, { capture: true });
  }

  private removeAudioRetryHandlers(): void {
    if (!this.audioRetryHandlersInstalled || !this.audioRetryHandler) return;
    const handler = this.audioRetryHandler;
    window.removeEventListener("touchstart", handler, { capture: true });
    window.removeEventListener("pointerdown", handler, { capture: true });
    window.removeEventListener("click", handler, { capture: true });
    document.removeEventListener("visibilitychange", handler, { capture: true });
    this.audioRetryHandler = undefined;
    this.audioRetryHandlersInstalled = false;
  }

  private installVisibilityAudioHandler(): void {
    if (this.visibilityAudioHandler) return;
    this.visibilityAudioHandler = () => {
      if (document.hidden) {
        if (this.backgroundMusic?.isPlaying) {
          this.backgroundMusic.pause();
        }
        if (this.nativeFallbackMusic && !this.nativeFallbackMusic.paused) {
          this.nativeFallbackMusic.pause();
        }
        return;
      }

      if (!this.sys.isActive()) return;
      utils.ensureSceneAudioReady(this);
      void this.refreshGameCenterStatus();

      if (utils.isIOS()) {
        if (!this.sound.mute) {
          this.startNativeBackgroundMusicFallback();
          this.time.delayedCall(180, () => {
            if (this.sys.isActive() && !this.sound.mute) {
              this.startNativeBackgroundMusicFallback();
            }
          });
        }
        return;
      }

      if (!this.sound.mute && this.backgroundMusic && !this.backgroundMusic.isPlaying) {
        try {
          this.backgroundMusic.play();
        } catch {
          // Retry path handles eventual recovery.
        }
      }
    };

    document.addEventListener("visibilitychange", this.visibilityAudioHandler, { capture: true });
  }

  private removeVisibilityAudioHandler(): void {
    if (!this.visibilityAudioHandler) return;
    document.removeEventListener("visibilitychange", this.visibilityAudioHandler, { capture: true });
    this.visibilityAudioHandler = undefined;
  }

  startGame(): void {
    // Prevent multiple triggers
    if (this.isStarting) return;
    this.isStarting = true;

    // Play click sound
    this.sound.play("ui_click_sound", { volume: 0.5 });

    // Clean up event listeners
    this.cleanupEventListeners();
    this.cleanupSnowfall();
    this.stopGameCenterToastTimer();
    this.stopGameCenterStatusRefreshLoop();

    // Stop background music
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
    }
    this.stopAudioBootstrap();
    this.stopNativeBackgroundMusicFallback();

    // Add transition effect
    this.cameras.main.fadeOut(500, 0, 0, 0);
    
    // Start name input scene after delay
    this.time.delayedCall(500, () => {
      this.scene.start('NameInputScene');
    });
  }

  cleanupEventListeners(): void {
    // Remove HTML event listeners
    if (this.clickHandler && this.uiContainer && this.uiContainer.node) {
      this.uiContainer.node.removeEventListener('click', this.clickHandler);
    }
    if (this.pointerUpHandler && this.uiContainer && this.uiContainer.node) {
      this.uiContainer.node.removeEventListener('pointerup', this.pointerUpHandler);
    }
    if (this.touchStartHandler && this.uiContainer && this.uiContainer.node) {
      this.uiContainer.node.removeEventListener('touchstart', this.touchStartHandler);
    }
    if (this.touchEndHandler && this.uiContainer && this.uiContainer.node) {
      this.uiContainer.node.removeEventListener('touchend', this.touchEndHandler);
    }
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler, { capture: true });
      this.keydownHandler = undefined;
    }
  }

  update(): void {
    // Title screen doesn't need special update logic
  }
}
