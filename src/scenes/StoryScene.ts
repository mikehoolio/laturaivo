import Phaser from "phaser";
import * as utils from "../utils";
import { CONTINUE_LINES, pickHumorLine } from "../humor/HumorPack";
import { LevelManager } from "../LevelManager";
import { LAHTI_ENDING_MUSIC_KEY, normalizeDifficultyTier, shouldDifficultyShowVideos } from "../content/DifficultyPresentation";
import { sanitizePlayerFacingText } from "../content/PlayerTextPolicy";
import { resolvePlatformVideoUrl } from "../platform";

/**
 * Story Scene - Displays cinematic story screens between levels
 * Features Finnish text with typewriter effect and pixel art story images
 */

interface StoryData {
  imageKey: string;
  text: string;
  introVideoUrl?: string;
  introVideoUrls?: string[];
  musicKey?: string;
  musicVolume?: number;
}

// Story content configuration for all levels
// Story structure: Level 1 is tutorial (no story before), story starts after level 1
// Stories are shown AFTER completing each level, before the next level starts
const STORY_CONTENT: { [key: string]: StoryData } = {
  // INTRO - Shown AFTER level 1 (tutorial), before level 2
  // The man's inner turmoil - the real story begins
  intro: {
    imageKey: "story_intro",
    introVideoUrl: resolvePlatformVideoUrl("assets/custom/story/laturaivocinematic1.mov"),
    text: `Espoossa asuu mies.
Keski-ikäinen mies.
Vakituinen työ. Padottu mieli.
Hän ei huuda töissä.
Hän ei huuda kotona.
Hän huutaa ladulla.
Latu on hänen paikka, raivon paikka.`
  },
  
  // LEVEL 2 - Shown after level 2 (boss: Månika), before level 3
  level_2: {
    imageKey: "story_level_2",
    introVideoUrl: resolvePlatformVideoUrl("assets/custom/story/monikadefeat.mov"),
    text: `Hän voittaa Månikan, äidin.
Huuto voittaa järjen.
Hän hengittää syvään.
Ensimmäistä kertaa raivo tuntuu tehokkaalta.
Euforialta. Koukulta.`
  },
  
  // LEVEL 3 - Shown after level 3, before level 4
  // TAPIOLA: Transitional phase - the man heads to Lahti
  level_3: {
    imageKey: "story_level_3",
    introVideoUrl: resolvePlatformVideoUrl("assets/custom/story/elsadefeat.mov"),
    text: `Tapiola.
Elsa-mummo raivottu, raivottu tieltä.
Ilmassa jäljellä vain peppu röyhtäys.
Porttikielto Espoon laduille ansaittu.
Latua ja raivoa on muuallakin.
Mies lähtee Lahteen ja Salpausselälle.`
  },
  
  // LEVEL 4 - Shown after level 4 (boss: LATU KEISARI), before level 5
  level_4: {
    imageKey: "story_level_4",
    text: `Etelä-Suomi raivottu,
mies lähtee lappiin kertomaan
muille miten he ovat hänen tiellään.
Lapissa on liikaa influencereita muutenkin.`
  },
  
  // LEVEL 5 - Shown after level 5 (boss: Elon), before level 6
  level_5: {
    imageKey: "story_level_5",
    text: `SLIIZU VOITETTU
Korot horjuivat.
Frame hajosi.
Raivo rajattiin ulos.
Mies ei löytänyt lapista raivottavaa.
Hän lähtee takaisin etelään, Ouluun.`
  },
  
  // LEVEL 6 - Shown after level 6, before level 7
  // OULU: The journey hardens
  level_6: {
    imageKey: "story_level_6",
    text: `Oulu on jäässä.
Mies myöskin.
Raivo toimi taas.
Tero oli afterworkillä, siksi Teslan suksiin on heitetty hiekkaa.
Mies lähtee Turkuun,
missä mikään ei toimi ja sehän raivostuttaa.`
  },
  
  // LEVEL 7 - Shown after level 7, before level 8
  // SELLO: Chaos
  level_7: {
    imageKey: "story_level_7",
    text: `Pasi, tuo raivoava metroseksuaali.
Pasi oli niin kuin Turku.
Autoja ladulla. V**un Turku.
Mies on riippuvainen raivosta.
Mies lähtee Fuengirolaan, koska voi.`
  },
  
  // LEVEL 8 - Shown after level 8 (boss: Sun Isoisä), before level 9
  level_8: {
    imageKey: "story_level_8",
    text: `Mies vaikenee.
Hän raivosi omaa verta, oman isoisänsä.
Hän oli aina hiljainen,
nyt hiljaisuus sattuu enemmän.
Mies ymmärtää:
hänen ei tarvitse huutaa.
Hän on itse raivon ääni. Aika palata suomeen ja lähteä klubiraivoamaan, Chanelmäkeen.`
  },
  
  // LEVEL 9 - Shown after level 9, before level 10
  // ESPOONLAHTI: Preparation
  level_9: {
    imageKey: "story_level_9",
    text: `Peterin disko sammui. Spice Boys kaatui.
Vain glitteriä enään tanssiladulla. Klubiraivo toimi kuten mies oletti.
Mies palaa Espooseen, missä odottaa viimeinen jytky.
Keilaniemessä odottaa viimeinen vastus:
Iso Timo.`
  },

  // LEVEL 10 -> Secret level bridge (hard mode easter egg unlock)
  level_10: {
    imageKey: "story_level_10",
    text: `Vaikein latu läpäisty,
raivo ei sammu.
Latu ei sammu.
Chanelmäki.
Tuo Etelä-Suomen raivoisin paikka.
Mies kokoaa vielä kerran voimansa
ja lähtee etsimään raivoa.
Yö kutsuu. Chanelmäkeen!
ICE CLUB AREENA ODOTTAA.`
  },
  
  // ENDING - After defeating Iso Timo final boss (Keilaniemi)
  // Shown in GameCompleteUIScene
  ending: {
    imageKey: "story_ending",
    text: `Kaikki on raivottu.
Ladut on raivottu.
Makkarat putoaa lumeen.
Luistimet jää kotiin.
Raivo murtuu.
Mies ei voita raivolla Suomea.
Hän voittaa itsensä.
Latu on tyhjä.
Latu on aina tyhjä.
Raivo on poissa.
Toistaiseksi.
Työmatkapyöräilykausi on vasta alkamassa.`
  }
};

export class StoryScene extends Phaser.Scene {
  // Scene data
  private storyKey: string = "intro";
  private nextSceneKey: string = "GameScene";
  private nextSceneData: any = {};
  private activeStoryData?: StoryData;
  
  // Display elements
  private storyImage!: Phaser.GameObjects.Image;
  private uiContainer!: Phaser.GameObjects.DOMElement;
  private introVideoContainer?: Phaser.GameObjects.DOMElement;
  private introVideoActive: boolean = false;
  private pendingIntroVideoUrls: string[] = [];
  private introVideoSkippableAt: number = 0;
  private introVideoPlaybackStarted: boolean = false;
  private introVideoStartGuardTimeoutId?: number;
  private introVideoEndedHandler?: () => void;
  private introVideoErrorHandler?: () => void;
  private introVideoPlayingHandler?: () => void;
  private storyMusic?: Phaser.Sound.BaseSound;
  private nativeStoryMusic?: HTMLAudioElement;
  
  // Typewriter effect
  private fullText: string = "";
  private currentCharIndex: number = 0;
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private isTypewriterComplete: boolean = false;
  
  // Input
  private canSkip: boolean = false;
  private pointerDownHandler?: () => void;
  private pointerUpHandler?: () => void;
  private domContinueClickHandler?: (event: Event) => void;
  private domContinueTouchStartHandler?: (event: Event) => void;
  private domContinueTouchHandler?: (event: Event) => void;
  private domAdvanceTargets: Set<HTMLElement> = new Set();
  private lastAdvanceAt: number = 0;
  private continuePromptText: string = "NAPAUTA JATKAAKSESI";

  private resolveStoryContent(storyKey: string): StoryData | undefined {
    const baseContent = STORY_CONTENT[storyKey];
    if (!baseContent) return undefined;
    const difficulty = normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");
    const allowVideos = shouldDifficultyShowVideos(difficulty);
    const resolvedContent: StoryData = { ...baseContent };

    if (storyKey === "ending") {
      if (allowVideos) {
        const finalBossConfig = LevelManager.getBossConfig(LevelManager.TOTAL_LEVELS);
        if (finalBossConfig?.bossDefeatVideoUrl) {
          const followups = Array.isArray(finalBossConfig.bossDefeatFollowupVideoUrls)
            ? finalBossConfig.bossDefeatFollowupVideoUrls.filter((url) => typeof url === "string" && url.length > 0)
            : [];
          resolvedContent.introVideoUrl = finalBossConfig.bossDefeatVideoUrl;
          resolvedContent.introVideoUrls = [finalBossConfig.bossDefeatVideoUrl, ...followups];
        }
      } else {
        resolvedContent.introVideoUrl = undefined;
        resolvedContent.introVideoUrls = undefined;
      }

      if (difficulty === "lahti") {
        resolvedContent.musicKey = LAHTI_ENDING_MUSIC_KEY;
        resolvedContent.musicVolume = 0.5;
      }

      return resolvedContent;
    }

    const levelStoryMatch = storyKey.match(/^level_(\d+)$/);
    if (!levelStoryMatch) {
      const shouldForceIntroVideo = storyKey === "intro";
      if (!allowVideos && !shouldForceIntroVideo) {
        resolvedContent.introVideoUrl = undefined;
        resolvedContent.introVideoUrls = undefined;
      }
      return resolvedContent;
    }

    const completedLevel = Number(levelStoryMatch[1]);
    if (!Number.isFinite(completedLevel)) return resolvedContent;

    const bossConfig = LevelManager.getBossConfig(completedLevel);
    if (allowVideos && bossConfig?.bossDefeatVideoUrl) {
      const followups = Array.isArray(bossConfig.bossDefeatFollowupVideoUrls)
        ? bossConfig.bossDefeatFollowupVideoUrls.filter((url) => typeof url === "string" && url.length > 0)
        : [];
      const introVideoUrls = [bossConfig.bossDefeatVideoUrl, ...followups];

      resolvedContent.introVideoUrl = bossConfig.bossDefeatVideoUrl;
      resolvedContent.introVideoUrls = introVideoUrls;
    } else if (!allowVideos) {
      resolvedContent.introVideoUrl = undefined;
      resolvedContent.introVideoUrls = undefined;
    }

    return resolvedContent;
  }

  private resolveIntroVideoSequence(content: StoryData): string[] {
    if (Array.isArray(content.introVideoUrls) && content.introVideoUrls.length > 0) {
      return content.introVideoUrls.filter((url) => typeof url === "string" && url.length > 0);
    }
    if (content.introVideoUrl) {
      return [content.introVideoUrl];
    }
    return [];
  }

  constructor() {
    super({ key: "StoryScene" });
  }

  init(data: { 
    storyKey?: string; 
    nextScene?: string;
    nextSceneData?: any;
  }): void {
    this.storyKey = data.storyKey || "intro";
    this.nextSceneKey = data.nextScene || "GameScene";
    this.nextSceneData = data.nextSceneData || {};
    
    // Reset state
    this.currentCharIndex = 0;
    this.isTypewriterComplete = false;
    this.canSkip = false;
    this.lastAdvanceAt = 0;
    this.activeStoryData = undefined;
    this.introVideoActive = false;
    this.pendingIntroVideoUrls = [];
    this.introVideoSkippableAt = 0;
    this.introVideoPlaybackStarted = false;
    if (typeof window !== "undefined" && this.introVideoStartGuardTimeoutId) {
      window.clearTimeout(this.introVideoStartGuardTimeoutId);
      this.introVideoStartGuardTimeoutId = undefined;
    }
    this.introVideoEndedHandler = undefined;
    this.introVideoErrorHandler = undefined;
    this.introVideoPlayingHandler = undefined;
    this.storyMusic = undefined;
    this.nativeStoryMusic = undefined;
  }

  create(): void {
    // iOS Audio Unlock: Must unlock audio context on first user interaction
    this.unlockAudioForIOS();
    
    const { width, height } = this.scale.gameSize;
    
    // Get story content
    const storyData = this.resolveStoryContent(this.storyKey);
    if (!storyData) {
      console.debug(`Story key "${this.storyKey}" not found, using intro`);
      this.storyKey = "intro";
    }
    
    const content = this.resolveStoryContent(this.storyKey) || STORY_CONTENT.intro;
    this.activeStoryData = content;
    this.fullText = sanitizePlayerFacingText(content.text);
    this.continuePromptText = pickHumorLine(this, CONTINUE_LINES, this.continuePromptText);

    // Setup input and cleanup hooks first to support optional intro video stage.
    this.setupInput();
    this.events.once("shutdown", () => {
      this.cleanupInputHandlers();
      this.cleanupIntroVideo();
      this.stopStoryMusic();
    });

    const introVideoSequence = this.resolveIntroVideoSequence(content);
    if (introVideoSequence.length > 0) {
      this.pendingIntroVideoUrls = [...introVideoSequence];
      this.showNextIntroVideo(width, height);
      this.attachDomAdvanceHandlers();
      return;
    }

    this.startStoryPresentation(width, height);
    this.attachDomAdvanceHandlers();
  }
  
  /**
   * iOS Audio Unlock - Critical for App Store compliance
   */
  private unlockAudioForIOS(): void {
    if (this.sound.locked) {
      this.input.once('pointerdown', () => {
        utils.ensureSceneAudioReady(this);
      });
    }
    utils.ensureSceneAudioReady(this);
  }

  private createBackground(imageKey: string, width: number, height: number): void {
    // Add story image as background
    this.storyImage = this.add.image(width / 2, height / 2, imageKey);
    
    // Scale to cover screen while maintaining aspect ratio using initScale for iOS consistency
    const scaleX = width / this.storyImage.width;
    const scaleY = height / this.storyImage.height;
    const maxDimension = Math.max(scaleX, scaleY) * Math.max(this.storyImage.width, this.storyImage.height);
    utils.initScale(this.storyImage, { x: 0.5, y: 0.5 }, maxDimension, maxDimension);
    
    // Add dark overlay for better text readability
    const overlay = this.add.rectangle(
      width / 2, 
      height / 2, 
      width, 
      height, 
      0x000000, 
      0.4
    );
    overlay.setDepth(1);
  }

  private startStoryPresentation(width: number, height: number): void {
    if (!this.activeStoryData) return;

    this.createBackground(this.activeStoryData.imageKey, width, height);
    this.createUI(width, height);
    this.startStoryMusic();

    this.canSkip = false;
    this.time.delayedCall(500, () => {
      this.startTypewriter();
      this.canSkip = true;
    });
  }

  private showIntroVideo(videoUrl: string, width: number, height: number): void {
    const resolvedUrl = this.resolveMediaUrl(videoUrl);
    const uiHTML = `
      <div id="story-video-container" class="absolute top-0 left-0 w-full h-full pointer-events-auto z-[1200] flex flex-col items-center justify-end pb-6" style="background: #000; touch-action: manipulation;">
        <video id="story-intro-video" class="absolute inset-0 w-full h-full object-cover" playsinline webkit-playsinline preload="auto" src="${resolvedUrl}"></video>
        <div class="absolute inset-0" style="background: linear-gradient(to top, rgba(0, 0, 0, 0.66) 0%, rgba(0, 0, 0, 0.12) 48%, rgba(0, 0, 0, 0.2) 100%);"></div>
        <div class="text-white font-bold" style="
          font-family: 'RetroPixel', monospace;
          font-size: 16px;
          text-shadow: 2px 2px 0px #000000;
          animation: promptPulse 1.35s ease-in-out infinite;
          z-index: 2;
        ">
          NAPAUTA JATKAAKSESI
        </div>
        <style>
          @keyframes promptPulse {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.04); }
          }
        </style>
      </div>
    `;

    this.introVideoContainer = utils.initUIDom(this, uiHTML);
    this.introVideoContainer.setDepth(12);
    this.introVideoActive = true;
    this.canSkip = true;
    // Ignore carry-over tap/click events from the previous scene transition and
    // only allow manual skip once the video has actually started playing.
    this.introVideoPlaybackStarted = false;
    this.introVideoSkippableAt = Number.POSITIVE_INFINITY;

    const videoElement = this.introVideoContainer?.node?.querySelector("#story-intro-video") as HTMLVideoElement | null;
    if (!videoElement) return;

    videoElement.width = width;
    videoElement.height = height;
    videoElement.currentTime = 0;
    videoElement.muted = false;
    videoElement.volume = utils.applyGameVolume(1);

    let playbackStarted = false;
    this.introVideoPlayingHandler = () => {
      playbackStarted = true;
      this.introVideoPlaybackStarted = true;
      this.introVideoSkippableAt = performance.now() + 650;
      this.clearIntroVideoStartGuardTimeout();
    };
    videoElement.addEventListener("playing", this.introVideoPlayingHandler, { once: true });
    videoElement.addEventListener("timeupdate", this.introVideoPlayingHandler, { once: true });

    this.introVideoEndedHandler = () => {
      this.finishIntroVideoStage();
    };
    videoElement.addEventListener("ended", this.introVideoEndedHandler, { once: true });
    this.introVideoErrorHandler = () => {
      this.finishIntroVideoStage();
    };
    videoElement.addEventListener("error", this.introVideoErrorHandler, { once: true });

    const tryPlay = async () => {
      try {
        await videoElement.play();
      } catch {
        try {
          videoElement.muted = true;
          await videoElement.play();
        } catch {
          // Keep flow alive; startup guard will continue to next stage if playback never begins.
        }
      }
    };
    void tryPlay();

    if (typeof window !== "undefined") {
      this.introVideoStartGuardTimeoutId = window.setTimeout(() => {
        if (!this.introVideoActive || playbackStarted) return;
        const hasProgressed = Number.isFinite(videoElement.currentTime) && videoElement.currentTime > 0.05;
        if (!hasProgressed) {
          this.finishIntroVideoStage();
        }
      }, 3200);
    }
  }

  private showNextIntroVideo(width: number, height: number): void {
    const nextVideoUrl = this.pendingIntroVideoUrls.shift();
    if (!nextVideoUrl) {
      this.startStoryPresentation(width, height);
      this.attachDomAdvanceHandlers();
      return;
    }
    this.showIntroVideo(nextVideoUrl, width, height);
    this.attachDomAdvanceHandlers();
  }

  private resolveMediaUrl(url: string): string {
    try {
      return new URL(url, window.location.href).toString();
    } catch {
      return url;
    }
  }

  private resolveAudioUrlFromPack(key: string): string | null {
    const cachedPack = this.cache.json.get("assetPackFull") || this.cache.json.get("assetPack");
    if (!cachedPack || typeof cachedPack !== "object") return null;

    for (const section of Object.values(cachedPack as Record<string, any>)) {
      const files = Array.isArray((section as any)?.files) ? (section as any).files : [];
      const match = files.find((file: any) => file?.key === key && typeof file?.url !== "undefined");
      if (!match) continue;

      if (typeof match.url === "string") {
        return this.resolveMediaUrl(match.url);
      }
      if (Array.isArray(match.url) && typeof match.url[0] === "string") {
        return this.resolveMediaUrl(match.url[0]);
      }
    }

    return null;
  }

  private startStoryMusic(): void {
    const musicKey = this.activeStoryData?.musicKey;
    if (!musicKey) return;

    this.stopStoryMusic();
    utils.ensureSceneAudioReady(this);
    utils.stopKnownMusicByKey(this);

    const normalizedVolume = Phaser.Math.Clamp(Number(this.activeStoryData?.musicVolume ?? 0.5), 0, 1);
    if (this.cache.audio.exists(musicKey)) {
      try {
        this.storyMusic = this.sound.add(musicKey, { loop: true, volume: normalizedVolume });
        this.storyMusic.play();
        return;
      } catch {
        this.storyMusic = undefined;
      }
    }

    const resolvedUrl = this.resolveAudioUrlFromPack(musicKey);
    if (!resolvedUrl) return;

    try {
      const audio = new Audio(resolvedUrl);
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = utils.applyGameVolume(normalizedVolume);
      (audio as any).playsInline = true;
      (audio as any).webkitPlaysInline = true;
      this.nativeStoryMusic = audio;
      void audio.play().catch(() => undefined);
    } catch {
      this.nativeStoryMusic = undefined;
    }
  }

  private stopStoryMusic(): void {
    if (this.storyMusic) {
      try {
        this.storyMusic.stop();
        this.storyMusic.destroy();
      } catch {
        // Ignore teardown races during scene exit.
      }
      this.storyMusic = undefined;
    }

    if (this.nativeStoryMusic) {
      try {
        this.nativeStoryMusic.pause();
        this.nativeStoryMusic.currentTime = 0;
      } catch {
        // Ignore teardown races during scene exit.
      }
      this.nativeStoryMusic = undefined;
    }
  }

  private clearIntroVideoStartGuardTimeout(): void {
    if (typeof window === "undefined" || !this.introVideoStartGuardTimeoutId) return;
    window.clearTimeout(this.introVideoStartGuardTimeoutId);
    this.introVideoStartGuardTimeoutId = undefined;
  }

  private finishIntroVideoStage(): void {
    if (!this.introVideoActive) return;

    this.cleanupIntroVideo();
    this.introVideoActive = false;
    this.introVideoPlaybackStarted = false;
    this.introVideoSkippableAt = 0;

    const { width, height } = this.scale.gameSize;
    if (this.pendingIntroVideoUrls.length > 0) {
      this.showNextIntroVideo(width, height);
      return;
    }

    this.startStoryPresentation(width, height);
    this.attachDomAdvanceHandlers();
  }

  private cleanupIntroVideo(): void {
    this.clearIntroVideoStartGuardTimeout();
    if (!this.introVideoContainer) return;

    const videoElement = this.introVideoContainer.node?.querySelector("#story-intro-video") as HTMLVideoElement | null;
    if (videoElement) {
      if (this.introVideoEndedHandler) {
        videoElement.removeEventListener("ended", this.introVideoEndedHandler);
      }
      if (this.introVideoErrorHandler) {
        videoElement.removeEventListener("error", this.introVideoErrorHandler);
      }
      if (this.introVideoPlayingHandler) {
        videoElement.removeEventListener("playing", this.introVideoPlayingHandler);
        videoElement.removeEventListener("timeupdate", this.introVideoPlayingHandler);
      }
      try {
        videoElement.pause();
        videoElement.removeAttribute("src");
        videoElement.load();
      } catch {
        // Ignore teardown issues for optional intro video.
      }
    }

    this.introVideoContainer.destroy();
    this.introVideoContainer = undefined;
    this.introVideoPlaybackStarted = false;
    this.introVideoSkippableAt = 0;
    this.introVideoEndedHandler = undefined;
    this.introVideoErrorHandler = undefined;
    this.introVideoPlayingHandler = undefined;
  }

  private createUI(width: number, height: number): void {
    const uiHTML = `
      <div id="story-container" class="absolute top-0 left-0 w-full h-full pointer-events-auto z-[1000] font-retro flex flex-col justify-end items-center pb-8" style="image-rendering: pixelated; touch-action: manipulation;">
        
        <!-- Story Text - No box, just text with strong shadow for readability -->
        <div class="w-[90%] max-w-[1000px] mb-4 p-6">
          <!-- Text content - no container box, just text with strong shadow -->
          <p id="story-text" class="text-white text-lg leading-relaxed whitespace-pre-line" style="
            font-family: 'RetroPixel', monospace;
            font-size: 22px;
            text-shadow: 3px 3px 0px #000000, -1px -1px 0px #000000, 1px -1px 0px #000000, -1px 1px 0px #000000, 0px 0px 10px rgba(0,0,0,0.8);
            min-height: 120px;
          "></p>
          
          <!-- Blinking cursor -->
          <span id="cursor" class="inline-block w-3 h-5 bg-white ml-1" style="
            animation: cursorBlink 0.5s steps(1) infinite;
            vertical-align: text-bottom;
            box-shadow: 0 0 5px rgba(255,255,255,0.8);
          "></span>
        </div>
        
        <!-- Continue prompt -->
        <div id="continue-prompt" class="text-white font-bold opacity-0 transition-opacity duration-500" style="
          font-family: 'RetroPixel', monospace;
          font-size: 16px;
          text-shadow: 2px 2px 0px #000000;
          animation: promptPulse 1.5s ease-in-out infinite;
        ">
          ${this.continuePromptText}
        </div>
        
        <!-- Skip hint -->
        <div id="skip-hint" class="absolute top-4 right-4 text-gray-400 text-sm opacity-50" style="
          font-family: 'RetroPixel', monospace;
          font-size: 12px;
        ">
          NAPAUTA = OHITA
        </div>
        
        <!-- Custom animations -->
        <style>
          @keyframes cursorBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
          @keyframes promptPulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
          }
        </style>
      </div>
    `;
    
    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(10);
  }

  private setupInput(): void {
    const handleAdvance = () => {
      const now = performance.now();
      if (now - this.lastAdvanceAt < 180) return;
      this.lastAdvanceAt = now;

      if (this.introVideoActive) {
        if (!this.introVideoPlaybackStarted) return;
        if (now < this.introVideoSkippableAt) return;
        this.finishIntroVideoStage();
        return;
      }

      if (!this.canSkip) return;
      
      if (!this.isTypewriterComplete) {
        this.completeTypewriter();
      } else {
        this.proceedToNextScene();
      }
    };

    // Touch/click support
    this.pointerDownHandler = () => handleAdvance();
    this.pointerUpHandler = () => handleAdvance();
    this.input.on("pointerdown", this.pointerDownHandler);
    this.input.on("pointerup", this.pointerUpHandler);

    this.domContinueClickHandler = (event: Event) => {
      event.preventDefault();
      handleAdvance();
    };
    this.domContinueTouchStartHandler = (event: Event) => {
      event.preventDefault();
      handleAdvance();
    };
    this.domContinueTouchHandler = (event: Event) => {
      event.preventDefault();
      handleAdvance();
    };
    this.attachDomAdvanceHandlers();
  }

  private attachDomAdvanceHandlers(): void {
    const targets = [
      this.uiContainer?.node as HTMLElement | undefined,
      this.introVideoContainer?.node as HTMLElement | undefined
    ].filter((node): node is HTMLElement => !!node);

    for (const target of targets) {
      if (this.domAdvanceTargets.has(target)) continue;
      if (!this.domContinueClickHandler || !this.domContinueTouchStartHandler || !this.domContinueTouchHandler) continue;
      target.addEventListener("click", this.domContinueClickHandler);
      target.addEventListener("touchstart", this.domContinueTouchStartHandler, { passive: false });
      target.addEventListener("touchend", this.domContinueTouchHandler, { passive: false });
      this.domAdvanceTargets.add(target);
    }
  }

  private startTypewriter(): void {
    const textElement = document.getElementById("story-text");
    if (!textElement) return;
    
    // Clear text
    textElement.textContent = "";
    this.currentCharIndex = 0;
    
    // Type next character with variable delay
    this.typeNextCharacter(textElement);
  }
  
  private typeNextCharacter(textElement: HTMLElement): void {
    if (this.currentCharIndex >= this.fullText.length) {
      // Typewriter complete
      this.completeTypewriter();
      return;
    }
    
    const char = this.fullText[this.currentCharIndex];
    textElement.textContent += char;
    this.currentCharIndex++;
    
    // Calculate delay for next character based on punctuation
    let nextDelay = 40; // Default 40ms per character
    if (char === "." || char === "!" || char === "?") {
      nextDelay = 200;
    } else if (char === ",") {
      nextDelay = 100;
    } else if (char === "\n") {
      nextDelay = 150;
    }
    
    // Schedule next character
    this.typewriterTimer = this.time.delayedCall(nextDelay, () => {
      this.typeNextCharacter(textElement);
    });
  }

  private completeTypewriter(): void {
    // Stop timer
    if (this.typewriterTimer) {
      this.typewriterTimer.destroy();
      this.typewriterTimer = undefined;
    }
    
    // Show full text immediately
    const textElement = document.getElementById("story-text");
    if (textElement) {
      textElement.textContent = this.fullText;
    }
    
    // Hide cursor
    const cursor = document.getElementById("cursor");
    if (cursor) {
      cursor.style.display = "none";
    }
    
    // Show continue prompt
    const continuePrompt = document.getElementById("continue-prompt");
    if (continuePrompt) {
      continuePrompt.style.opacity = "1";
    }
    
    this.isTypewriterComplete = true;
  }

  private proceedToNextScene(): void {
    this.cleanupInputHandlers();
    this.cleanupIntroVideo();
    this.stopStoryMusic();
    const nextSceneData = { ...(this.nextSceneData || {}) };
    if (
      this.storyKey === "intro" &&
      this.nextSceneKey === "GameScene" &&
      Number(nextSceneData.level || 1) === 2
    ) {
      nextSceneData.introBridgeShown = true;
    }

    // Play UI click sound if available
    if (this.sound.get("ui_click_sound")) {
      this.sound.play("ui_click_sound", { volume: 0.3 });
    }
    
    // Fade out
    this.cameras.main.fadeOut(500, 0, 0, 0);
    
    this.cameras.main.once("camerafadeoutcomplete", () => {
      // Clean up
      if (this.uiContainer) {
        this.uiContainer.destroy();
      }

      // Hard gate: official campaign ends at level 10.
      if (this.nextSceneKey === "GameScene") {
        const requestedLevel = Number(nextSceneData.level || 1);
        const maxAllowedLevel = LevelManager.TOTAL_LEVELS;

        if (requestedLevel > maxAllowedLevel) {
          this.scene.start("GameCompleteUIScene", {
            totalDistance: Number(nextSceneData.totalDistance || 0),
            enemiesDefeated: Number(nextSceneData.enemiesDefeated || 0),
            score: Number(nextSceneData.score || 0),
            levelsCompleted: LevelManager.TOTAL_LEVELS
          });
          return;
        }
      }
      
      // Start next scene
      this.scene.start(this.nextSceneKey, nextSceneData);
    });
  }

  private cleanupInputHandlers(): void {
    if (this.pointerDownHandler) {
      this.input.off("pointerdown", this.pointerDownHandler);
    } else {
      this.input.off("pointerdown");
    }
    if (this.pointerUpHandler) {
      this.input.off("pointerup", this.pointerUpHandler);
    } else {
      this.input.off("pointerup");
    }

    for (const target of this.domAdvanceTargets) {
      if (this.domContinueClickHandler) {
        target.removeEventListener("click", this.domContinueClickHandler);
      }
      if (this.domContinueTouchStartHandler) {
        target.removeEventListener("touchstart", this.domContinueTouchStartHandler);
      }
      if (this.domContinueTouchHandler) {
        target.removeEventListener("touchend", this.domContinueTouchHandler);
      }
    }
    this.domAdvanceTargets.clear();

    this.pointerDownHandler = undefined;
    this.pointerUpHandler = undefined;
    this.domContinueClickHandler = undefined;
    this.domContinueTouchStartHandler = undefined;
    this.domContinueTouchHandler = undefined;
  }

  // Static helper to get story key for a level number
  static getStoryKeyForLevel(level: number): string {
    if (level === 0) return "intro";
    if (level > 10) return "ending";
    return `level_${level}`;
  }
  
  // Static helper to check if a story exists for a key
  static hasStory(storyKey: string): boolean {
    return storyKey in STORY_CONTENT;
  }
}
