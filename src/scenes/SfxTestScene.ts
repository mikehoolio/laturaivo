import Phaser from "phaser";
import * as utils from "../utils";

const MUSIC_KEYS = new Set<string>([
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
  "game_over_music",
]);

export class SfxTestScene extends Phaser.Scene {
  private uiContainer: Phaser.GameObjects.DOMElement | null = null;
  private previousScene: string = "TitleScreen";
  private isClosing: boolean = false;
  private sfxKeys: string[] = [];
  private sequenceTimer?: Phaser.Time.TimerEvent;
  private sequenceIndex: number = 0;
  private currentSfxKey: string = "-";

  private delegatedClickHandler?: (event: Event) => void;
  private delegatedTouchEndHandler?: (event: TouchEvent) => void;

  private previousSceneRef: any;
  private previousMusicVolume?: number;
  private previousNativeVolume?: number;

  constructor() {
    super({ key: "SfxTestScene" });
  }

  init(data: { previousScene?: string }): void {
    this.previousScene = data.previousScene || "TitleScreen";
    this.isClosing = false;
    this.sequenceIndex = 0;
    this.currentSfxKey = "-";
    this.sfxKeys = [];
    this.previousSceneRef = undefined;
    this.previousMusicVolume = undefined;
    this.previousNativeVolume = undefined;
  }

  create(): void {
    this.createBackground();
    this.collectSfxKeys();
    this.duckPreviousSceneMusic();
    this.createDOMUI();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  private createBackground(): void {
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.9
    );
    overlay.setDepth(100);
  }

  private collectSfxKeys(): void {
    const keys = this.cache.audio
      .getKeys()
      .filter((key) => !!key && !MUSIC_KEYS.has(key))
      .sort((a, b) => a.localeCompare(b));
    this.sfxKeys = keys;
  }

  private duckPreviousSceneMusic(): void {
    if (!this.previousScene || !this.scene.isPaused(this.previousScene)) return;
    const sceneRef = this.scene.get(this.previousScene) as any;
    if (!sceneRef) return;
    this.previousSceneRef = sceneRef;

    const bgm = sceneRef.backgroundMusic;
    if (bgm && typeof bgm.volume === "number") {
      this.previousMusicVolume = bgm.volume;
      try {
        bgm.setVolume(0.08);
      } catch {
        // Ignore one-off mix tweak failures.
      }
    }

    const nativeFallback = sceneRef.nativeFallbackMusic as HTMLAudioElement | undefined;
    if (nativeFallback && typeof nativeFallback.volume === "number") {
      this.previousNativeVolume = nativeFallback.volume;
      nativeFallback.volume = 0.08;
    }
  }

  private restorePreviousSceneMusic(): void {
    const sceneRef = this.previousSceneRef;
    if (!sceneRef) return;

    if (this.previousMusicVolume !== undefined) {
      const bgm = sceneRef.backgroundMusic;
      if (bgm && typeof bgm.setVolume === "function") {
        try {
          bgm.setVolume(this.previousMusicVolume);
        } catch {
          // Ignore restore failures.
        }
      }
    }

    if (this.previousNativeVolume !== undefined) {
      const nativeFallback = sceneRef.nativeFallbackMusic as HTMLAudioElement | undefined;
      if (nativeFallback) {
        nativeFallback.volume = this.previousNativeVolume;
      }
    }
  }

  private createDOMUI(): void {
    const rows = this.sfxKeys
      .map(
        (key) => `
          <button class="game-pixel-container-clickable-gray-700 px-3 py-2 text-left w-full active:scale-95 transition-transform"
                  data-sfx-key="${key}">
            <span class="text-white text-xs font-bold" style="text-shadow: 1px 1px 0px #000000;">▶ ${key}</span>
          </button>
        `
      )
      .join("");

    const uiHTML = `
      <div id="sfx-test-container" class="absolute top-0 left-0 w-full h-full z-[1000] flex flex-col justify-start items-center overflow-hidden" style="font-family: 'PublicPixel';">
        <div class="w-full" style="padding-top: env(safe-area-inset-top, 10px);"></div>

        <div class="flex flex-col items-center gap-3 p-3 w-full max-w-3xl mx-auto flex-1 overflow-hidden">
          <div class="flex items-center justify-between w-full gap-2">
            <button id="sfx-back-button" class="game-pixel-container-clickable-gray-600 px-4 py-3 cursor-pointer active:scale-95 transition-transform" style="min-height: 48px;">
              <span class="text-white text-sm font-bold">⬅️ TAKAISIN</span>
            </button>
            <div class="text-cyan-300 text-xs md:text-sm" style="text-shadow: 1px 1px 0px #000;">
              SFX TEST
            </div>
          </div>

          <div class="text-center">
            <div class="text-yellow-400 font-bold text-2xl md:text-3xl" style="text-shadow: 3px 3px 0px #000000;">
              🔊 SFX TESTI
            </div>
            <div class="text-white text-xs md:text-sm mt-1" style="text-shadow: 1px 1px 0px #000;">
              Kuuntele kaikki efektit. Nykyinen: <span id="sfx-current-key" class="text-cyan-300">${this.currentSfxKey}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 justify-center w-full">
            <button id="sfx-play-all-button" class="game-pixel-container-clickable-green-600 px-4 py-3 cursor-pointer active:scale-95 transition-transform" style="min-height: 48px;">
              <span class="text-white text-sm font-bold">▶ PLAY ALL</span>
            </button>
            <button id="sfx-stop-button" class="game-pixel-container-clickable-red-700 px-4 py-3 cursor-pointer active:scale-95 transition-transform" style="min-height: 48px;">
              <span class="text-white text-sm font-bold">⏹ STOP</span>
            </button>
          </div>

          <div class="text-gray-300 text-xs" style="text-shadow: 1px 1px 0px #000;">
            Ladatut SFX-avaimet: ${this.sfxKeys.length}
          </div>

          <div id="sfx-scroll" class="game-pixel-container-gray-800 p-2 w-full flex-1 overflow-y-auto" style="min-height: 320px; max-height: 540px; -webkit-overflow-scrolling: touch;">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${rows || '<div class="text-white text-xs">Ei ladattuja SFX-avaimia.</div>'}
            </div>
          </div>
        </div>

        <div class="w-full" style="padding-bottom: env(safe-area-inset-bottom, 14px);"></div>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(101);
    this.time.delayedCall(40, () => this.attachListeners());
  }

  private attachListeners(): void {
    const root = this.uiContainer?.node as HTMLElement | undefined;
    if (!root) return;

    this.delegatedClickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;
      event.stopPropagation();
      this.handleButtonAction(button);
    };
    this.delegatedTouchEndHandler = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      this.handleButtonAction(button);
    };

    root.addEventListener("click", this.delegatedClickHandler);
    root.addEventListener("touchend", this.delegatedTouchEndHandler, { passive: false });
  }

  private handleButtonAction(button: HTMLButtonElement): void {
    const id = button.id;
    if (id === "sfx-back-button") {
      this.goBack();
      return;
    }
    if (id === "sfx-play-all-button") {
      this.togglePlayAll();
      return;
    }
    if (id === "sfx-stop-button") {
      this.stopPlayAll();
      return;
    }

    const key = button.dataset.sfxKey;
    if (!key) return;
    this.playSfx(key);
  }

  private playSfx(key: string): void {
    if (!key) return;
    this.currentSfxKey = key;
    this.updateCurrentKeyLabel();
    utils.ensureSceneAudioReady(this);
    const played = this.sound.play(key, { volume: 0.9 });
    if (!played) {
      console.debug(`[SfxTestScene] play failed key=${key}`);
    }
  }

  private updateCurrentKeyLabel(): void {
    const label = this.uiContainer?.node?.querySelector("#sfx-current-key") as HTMLElement | null;
    if (label) label.textContent = this.currentSfxKey;
  }

  private togglePlayAll(): void {
    if (this.sequenceTimer) {
      this.stopPlayAll();
      return;
    }
    if (this.sfxKeys.length === 0) return;

    this.sequenceIndex = 0;
    this.playSfx(this.sfxKeys[this.sequenceIndex]);
    this.updatePlayAllButton(true);
    this.sequenceTimer = this.time.addEvent({
      delay: 780,
      loop: true,
      callback: () => {
        if (this.sfxKeys.length === 0) return;
        this.sequenceIndex = (this.sequenceIndex + 1) % this.sfxKeys.length;
        this.playSfx(this.sfxKeys[this.sequenceIndex]);
      }
    });
  }

  private stopPlayAll(): void {
    if (this.sequenceTimer) {
      this.sequenceTimer.destroy();
      this.sequenceTimer = undefined;
    }
    this.updatePlayAllButton(false);
  }

  private updatePlayAllButton(isPlaying: boolean): void {
    const button = this.uiContainer?.node?.querySelector("#sfx-play-all-button span") as HTMLElement | null;
    if (!button) return;
    button.textContent = isPlaying ? "⏸ PLAY ALL" : "▶ PLAY ALL";
  }

  private goBack(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.sound.play("ui_click_sound", { volume: 0.4 });
    this.scene.stop();
    if (this.previousScene && this.scene.isPaused(this.previousScene)) {
      this.scene.resume(this.previousScene);
    }
  }

  private cleanup(): void {
    this.stopPlayAll();
    this.restorePreviousSceneMusic();

    const root = this.uiContainer?.node as HTMLElement | undefined;
    if (root && this.delegatedClickHandler) {
      root.removeEventListener("click", this.delegatedClickHandler);
    }
    if (root && this.delegatedTouchEndHandler) {
      root.removeEventListener("touchend", this.delegatedTouchEndHandler);
    }
    this.delegatedClickHandler = undefined;
    this.delegatedTouchEndHandler = undefined;

    if (this.uiContainer) {
      this.uiContainer.destroy();
      this.uiContainer = null;
    }
  }
}
