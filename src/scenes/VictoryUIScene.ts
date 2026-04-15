import Phaser from 'phaser';
import * as utils from '../utils';
import { LevelManager } from '../LevelManager.js';
import { CONTINUE_LINES, pickHumorLine } from '../humor/HumorPack';
import { GAME_CENTER_ACHIEVEMENT_IDS, GameCenterAchievementManager } from '../managers/GameCenterAchievementManager';
import { LeaderboardManager } from '../managers/LeaderboardManager';
import { GameCenterManager } from '../managers/GameCenterManager';
import type { LeaderboardEntry } from '../managers/LeaderboardManager';


export class VictoryUIScene extends Phaser.Scene {
  private currentLevelKey: string | null;
  private uiContainer: Phaser.GameObjects.DOMElement | null;
  private createUiTimer?: Phaser.Time.TimerEvent;
  private musicFadeTimer?: Phaser.Time.TimerEvent;
  
  // Prevent double-click bug
  private isTransitioning: boolean = false;
  
  // Level stats
  private currentLevel: number = 1;
  private levelScore: number = 0;
  private enemiesDefeated: number = 0;
  private totalDistance: number = 0;
  private totalScore: number = 0;
  private lives: number = 3;
  private levelGrade: string = "D";
  private levelGradeScore: number = 0;
  private levelBonusScore: number = 0;
  private objectiveCompleted: boolean = false;
  
  // Champagne celebration
  private champagneBottle?: Phaser.GameObjects.Image;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private bubbleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private continuePromptText: string = 'NAPAUTA JATKAAKSESI ➡️';
  private continueClickHandler?: () => void;
  private continueTouchEndHandler?: (event: TouchEvent) => void;
  


  constructor() {
    super({
      key: "VictoryUIScene",
    });
    this.currentLevelKey = null;
    this.uiContainer = null;
    this.isTransitioning = false;
  }

  init(data: {
    currentLevelKey?: string;
    currentLevel?: number;
    levelScore?: number;
    levelGrade?: string;
    levelGradeScore?: number;
    levelBonusScore?: number;
    objectiveCompleted?: boolean;
    enemiesDefeated?: number;
    totalDistance?: number;
    totalScore?: number;
    lives?: number;
  }) {
    // Reset transition state for new scene instance
    this.isTransitioning = false;
    
    // Receive data from level scene
    this.currentLevelKey = data.currentLevelKey || null;
    this.currentLevel = data.currentLevel || 1;
    this.levelScore = data.levelScore || 0;
    this.enemiesDefeated = data.enemiesDefeated || 0;
    this.totalDistance = data.totalDistance || 0;
    this.totalScore = data.totalScore || 0;
    this.lives = data.lives !== undefined ? data.lives : 3;
    this.levelGrade = data.levelGrade || "D";
    this.levelGradeScore = data.levelGradeScore || 0;
    this.levelBonusScore = data.levelBonusScore || 0;
    this.objectiveCompleted = !!data.objectiveCompleted;
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    this.continuePromptText = pickHumorLine(this, CONTINUE_LINES, this.continuePromptText);
    if (this.currentLevel === 1) {
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.tutorialComplete);
    }
    if (this.totalScore >= 100000) {
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.score100k);
    }

    // Show champagne celebration first
    this.showChampagneCelebration();
    
    // Create DOM UI after delay to show champagne first
    // Delay: 400ms fade in + 400ms shake + 1200ms for bubbles to show = 2000ms total
    this.createUiTimer?.destroy();
    this.createUiTimer = this.time.delayedCall(2000, () => {
      this.createUiTimer = undefined;
      if (!this.scene.isActive(this.scene.key)) return;
      this.createDOMUI();
      this.setupInputs();
    });
  }
  
  // Champagne celebration with player character drinking champagne
  showChampagneCelebration(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    
    // Get character type from registry
    const characterType = this.registry.get('characterType') || 'male';
    const playerIdleFrame = characterType === 'female' 
      ? 'female_player_ski_idle_R_frame1' 
      : 'player_ski_idle_R_frame1';
    
    // Create player sprite on the left side
    this.playerSprite = this.add.sprite(centerX - 80, centerY + 80, playerIdleFrame);
    utils.initScale(this.playerSprite, { x: 0.5, y: 1.0 }, undefined, 140);
    this.playerSprite.setAlpha(0);
    this.playerSprite.setDepth(99);
    
    // Create champagne bottle next to player
    this.champagneBottle = this.add.image(centerX + 20, centerY + 50, "champagne_bottle");
    utils.initScale(this.champagneBottle, { x: 0.5, y: 0.5 }, undefined, 160);
    this.champagneBottle.setAlpha(0);
    this.champagneBottle.setDepth(100);
    
    // Fade in player sprite first
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 1,
      y: centerY + 60,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Then fade in champagne bottle
        this.tweens.add({
          targets: this.champagneBottle,
          alpha: 1,
          y: centerY - 20,
          duration: 400,
          ease: 'Back.easeOut',
          onComplete: () => {
            // Play pop sound
            utils.ensureSceneAudioReady(this);
            const popPlayed = this.sound.play("champagne_pop", { volume: 0.6 });
            if (!popPlayed) {
              const fallbackPop = utils.safePlaySound(this, "champagne_pop", { volume: 0.6 });
              if (!fallbackPop && utils.isIOS()) {
                const popUrl = utils.resolveAssetUrl(this, "champagne_pop", "assets/audio_local/champagne_pop.mp3");
                const popAudio = new Audio(popUrl);
                popAudio.volume = utils.applyGameVolume(0.6);
                popAudio.preload = "auto";
                (popAudio as any).playsInline = true;
                (popAudio as any).webkitPlaysInline = true;
                void popAudio.play().catch(() => undefined);
              }
            }
            
            // Shake bottle
            this.tweens.add({
              targets: this.champagneBottle,
              angle: { from: -10, to: 10 },
              duration: 100,
              yoyo: true,
              repeat: 3,
              onComplete: () => {
                // Create bubble/confetti effect
                this.createBubbleEffect();
                
                // Animate player "drinking" - tilt and bob happily
                this.animatePlayerDrinking();
              }
            });
          }
        });
      }
    });
  }
  
  // Animate player celebrating with champagne
  animatePlayerDrinking(): void {
    if (!this.playerSprite) return;
    
    // Player tilts back slightly (drinking pose)
    this.tweens.add({
      targets: this.playerSprite,
      angle: -15,
      y: this.playerSprite.y - 10,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Then bob up and down happily in celebration
        this.tweens.add({
          targets: this.playerSprite,
          y: this.playerSprite!.y - 8,
          duration: 200,
          yoyo: true,
          repeat: 4,
          ease: 'Sine.easeInOut'
        });
      }
    });
    
    // Move champagne bottle toward player (drinking motion)
    if (this.champagneBottle) {
      this.tweens.add({
        targets: this.champagneBottle,
        x: this.champagneBottle.x - 40,
        y: this.champagneBottle.y + 20,
        angle: -30,
        duration: 300,
        ease: 'Quad.easeOut'
      });
    }
  }
  
  // Create bubble/confetti particle effect
  createBubbleEffect(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 - 80;
    
    // Create golden confetti particles using graphics
    const confettiColors = [0xFFD700, 0xFFA500, 0xFFFF00, 0xFFFFFF, 0x87CEEB];
    
    for (let i = 0; i < 30; i++) {
      const color = Phaser.Math.RND.pick(confettiColors);
      const confetti = this.add.rectangle(
        centerX + Phaser.Math.Between(-20, 20),
        centerY,
        Phaser.Math.Between(6, 12),
        Phaser.Math.Between(6, 12),
        color
      );
      confetti.setDepth(101);
      
      // Animate confetti flying outward
      this.tweens.add({
        targets: confetti,
        x: confetti.x + Phaser.Math.Between(-200, 200),
        y: confetti.y + Phaser.Math.Between(-300, 100),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: Phaser.Math.Between(1000, 2000),
        ease: 'Quad.easeOut',
        onComplete: () => confetti.destroy()
      });
    }
    
    // Create bubble circles
    for (let i = 0; i < 15; i++) {
      const bubble = this.add.circle(
        centerX + Phaser.Math.Between(-30, 30),
        centerY,
        Phaser.Math.Between(4, 10),
        0xFFFFFF,
        0.7
      );
      bubble.setDepth(101);
      
      this.tweens.add({
        targets: bubble,
        x: bubble.x + Phaser.Math.Between(-100, 100),
        y: bubble.y - Phaser.Math.Between(100, 250),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: Phaser.Math.Between(800, 1500),
        ease: 'Quad.easeOut',
        onComplete: () => bubble.destroy()
      });
    }
  }

  createDOMUI(): void {
    if (typeof document !== "undefined") {
      document.querySelectorAll("#victory-container").forEach((node) => node.remove());
    }

    const nextLevel = this.currentLevel + 1;
    const nextLevelName = LevelManager.getLevelName(nextLevel);
    
    // Fade out champagne bottle and player sprite when showing UI
    if (this.champagneBottle) {
      this.tweens.add({
        targets: this.champagneBottle,
        alpha: 0,
        y: this.champagneBottle.y - 50,
        duration: 500,
        ease: 'Quad.easeIn'
      });
    }
    
    if (this.playerSprite) {
      this.tweens.add({
        targets: this.playerSprite,
        alpha: 0,
        y: this.playerSprite.y - 30,
        duration: 500,
        ease: 'Quad.easeIn'
      });
    }
    
    const uiHTML = `
      <div id="victory-container" class="absolute top-0 left-0 w-full h-full pointer-events-none z-[1000] flex flex-col justify-center items-center overflow-y-auto" style="font-family: 'PublicPixel'; background-color: rgba(0, 40, 0, 0.85); padding: calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 8px) calc(env(safe-area-inset-bottom, 0px) + 8px) calc(env(safe-area-inset-left, 0px) + 8px); box-sizing: border-box;">
        <!-- Main Content Container -->
        <div class="flex flex-col items-center justify-center gap-3 p-3 md:p-4 text-center pointer-events-auto w-full max-w-[min(96vw,760px)] my-2">
          
          <!-- Victory Icon with champagne -->
          <div class="text-4xl">🍾🏆🍾</div>
          
          <!-- Victory Title -->
          <div id="victory-title" class="text-yellow-400 font-bold pointer-events-none text-2xl md:text-4xl" style="
            text-shadow: 3px 3px 0px #000000;
            animation: victoryPulse 1s ease-in-out infinite alternate;
          ">${this.currentLevel === 1 ? 'TUTORIAALI LÄPÄISTY!' : `TASO ${this.currentLevel} LÄPÄISTY!`}</div>

          <!-- Level Stats -->
          <div class="game-pixel-container-gray-800 p-3 flex flex-col gap-1 w-full max-w-[min(94vw,520px)]">
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🎿 Kohtaamiset</span>
              <span class="text-red-300 text-sm font-bold">${this.enemiesDefeated}</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">⭐ Tason pisteet</span>
              <span class="text-green-300 text-sm font-bold">+${this.levelScore.toLocaleString()}</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🎖️ Arvosana</span>
              <span class="text-yellow-300 text-sm font-bold">${this.levelGrade} (${this.levelGradeScore})</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">💰 Bonus</span>
              <span class="text-emerald-300 text-sm font-bold">+${this.levelBonusScore.toLocaleString()}</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🎯 Minitavoite</span>
              <span class="text-cyan-300 text-sm font-bold">${this.objectiveCompleted ? "VALMIS" : "EI"}</span>
            </div>
            <div class="w-full h-px bg-gray-600 my-1"></div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🏅 Kokonaispisteet</span>
              <span class="text-yellow-300 text-sm font-bold">${this.totalScore.toLocaleString()}</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">📏 Kokonaismatka</span>
              <span class="text-cyan-300 text-sm font-bold">${Math.floor(this.totalDistance)}m</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">❤️ Elämät jäljellä</span>
              <span class="text-pink-300 text-sm font-bold">${this.lives}</span>
            </div>
          </div>

          <!-- Next Level Preview -->
          <div class="flex flex-col items-center gap-0">
            <span class="text-gray-400 text-xs" style="text-shadow: 1px 1px 0px #000;">SEURAAVA TASO</span>
            <span class="text-cyan-300 text-base font-bold" style="text-shadow: 2px 2px 0px #000;">${nextLevelName}</span>
          </div>

          <!-- Continue Button - large touch target -->
          <div class="game-pixel-container-clickable-green-600 px-6 py-3 cursor-pointer pointer-events-auto active:scale-95 transition-transform mt-1" id="continue-button">
            <span id="press-enter-text" class="text-white font-bold text-lg" style="text-shadow: 2px 2px 0px #000000;">${this.continuePromptText}</span>
          </div>

        </div>

        <!-- Custom Animations -->
        <style>
          @keyframes victoryPulse {
            from { 
              transform: scale(1);
            }
            to { 
              transform: scale(1.05);
            }
          }
        </style>
      </div>
    `;

    // Add DOM element to scene
    this.uiContainer = utils.initUIDom(this, uiHTML);
    
    // Add click event to button
    const button = this.uiContainer?.node?.querySelector("#continue-button") as HTMLElement | null;
    if (button) {
      this.continueClickHandler = () => this.goToNextLevel();
      this.continueTouchEndHandler = (e) => {
        e.preventDefault();
        this.goToNextLevel();
      };
      button.addEventListener("click", this.continueClickHandler);
      button.addEventListener("touchend", this.continueTouchEndHandler, { passive: false });
    }
    

  }
  
  setupInputs(): void {
    // Clear previous event listeners
    this.input.off('pointerdown');

    // Touch/pointer proceed.
    this.input.on('pointerdown', () => this.goToNextLevel());
  }

  private fadeOutGameplayMusicAndContinue(currentScene: any, onComplete: () => void): void {
    const fadeMs = 280;
    if (!currentScene) {
      onComplete();
      return;
    }

    const backgroundMusic = currentScene.backgroundMusic as { volume?: number } | undefined;
    const nativeFallbackMusic = currentScene.nativeFallbackMusic as HTMLAudioElement | undefined;
    let hasFadableTrack = false;

    if (backgroundMusic) {
      hasFadableTrack = true;
      this.tweens.add({
        targets: backgroundMusic as any,
        volume: 0,
        duration: fadeMs,
        ease: "Linear",
      });
    }

    if (nativeFallbackMusic) {
      hasFadableTrack = true;
      const startVolume = Number.isFinite(nativeFallbackMusic.volume) ? nativeFallbackMusic.volume : 0.6;
      this.tweens.addCounter({
        from: startVolume,
        to: 0,
        duration: fadeMs,
        ease: "Linear",
        onUpdate: (tween) => {
          nativeFallbackMusic.volume = Phaser.Math.Clamp(tween.getValue(), 0, 1);
        }
      });
    }

    const finalize = () => {
      utils.stopGameplayMusic(this, currentScene);
      onComplete();
    };

    if (!hasFadableTrack) {
      finalize();
      return;
    }

    this.musicFadeTimer?.destroy();
    this.musicFadeTimer = this.time.delayedCall(fadeMs, () => {
      this.musicFadeTimer = undefined;
      finalize();
    });
  }

  shutdown(): void {
    this.input.off('pointerdown');

    if (this.createUiTimer) {
      this.createUiTimer.destroy();
      this.createUiTimer = undefined;
    }
    if (this.musicFadeTimer) {
      this.musicFadeTimer.destroy();
      this.musicFadeTimer = undefined;
    }

    const button = this.uiContainer?.node?.querySelector("#continue-button") as HTMLElement | null;
    if (button && this.continueClickHandler) {
      button.removeEventListener("click", this.continueClickHandler);
    }
    if (button && this.continueTouchEndHandler) {
      button.removeEventListener("touchend", this.continueTouchEndHandler);
    }
    this.continueClickHandler = undefined;
    this.continueTouchEndHandler = undefined;

    if (this.uiContainer) {
      this.uiContainer.destroy();
      this.uiContainer = null;
    }

    if (this.champagneBottle) {
      this.champagneBottle.destroy();
      this.champagneBottle = undefined;
    }
    if (this.playerSprite) {
      this.playerSprite.destroy();
      this.playerSprite = undefined;
    }

    if (typeof document !== "undefined") {
      document.querySelectorAll("#victory-container").forEach((node) => node.remove());
    }
  }

  goToNextLevel(): void {
    // Prevent double-click causing level to be skipped
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    console.debug(`Going to next level from: ${this.currentLevelKey}, currentLevel: ${this.currentLevel}`);

    // Play click sound
    this.sound.play("ui_click_sound", { volume: 0.3 });

    // Clear event listeners
    this.input.off('pointerdown');

    const currentScene = this.currentLevelKey ? (this.scene.get(this.currentLevelKey) as any) : undefined;
    const continueTransition = () => {
      // Save score snapshot at each completed level transition.
      const levelsCompletedForLeaderboard = Math.min(this.currentLevel, LevelManager.TOTAL_LEVELS);
      const leaderboardEntry: LeaderboardEntry = {
        playerName: String(this.registry.get('playerName') || 'PELAAJA'),
        totalDistance: Math.floor(this.totalDistance),
        enemiesDefeated: this.enemiesDefeated,
        levelsCompleted: levelsCompletedForLeaderboard,
        score: this.totalScore,
        date: new Date().toISOString().split('T')[0]
      };
      const leaderboardEligible = this.registry.get('leaderboardEligible') !== false;
      const cheatCodeUsed = !!this.registry.get('cheatCodeUsed');
      const godModeActivated = !!this.registry.get('godModeActivated');
      LeaderboardManager.addEntry(leaderboardEntry, {
        leaderboardEligible,
        cheatCodeUsed,
        godModeActivated,
        difficulty: String(this.registry.get('difficulty') || 'vantaa'),
        levelReached: this.currentLevel
      })
        .catch(e => console.debug('Failed to save level-clear score:', e));
      if (levelsCompletedForLeaderboard >= LevelManager.TOTAL_LEVELS && leaderboardEligible && !cheatCodeUsed && !godModeActivated) {
        GameCenterManager.submitScore(this.totalScore)
          .catch(e => console.debug('Failed to submit level-clear Game Center score:', e));
      }

      // Hard stop official campaign at level 10.
      if (this.currentLevel >= LevelManager.TOTAL_LEVELS) {
        this.scene.stop("UIScene");
        this.scene.stop("TutorialUIScene");
        this.scene.stop("AbilityUnlockUIScene");

        this.scene.resume(this.currentLevelKey!);
        this.scene.stop(this.currentLevelKey!);

        this.scene.start("GameCompleteUIScene", {
          currentLevelKey: this.currentLevelKey,
          totalDistance: this.totalDistance,
          enemiesDefeated: this.enemiesDefeated,
          score: this.totalScore,
          levelsCompleted: LevelManager.TOTAL_LEVELS
        });
        return;
      }

      // Use LevelManager to get next level info
      const nextLevelKey = LevelManager.getNextLevelScene(this.currentLevelKey!);
      if (!nextLevelKey) {
        console.error(`No next level found for: ${this.currentLevelKey}`);
        return;
      }

      console.debug(`Next level: ${nextLevelKey}`);

      // Prepare next level data
      const nextLevel = this.currentLevel + 1;
      const nextLevelData = {
        level: nextLevel,
        totalDistance: this.totalDistance,
        enemiesDefeated: this.enemiesDefeated,
        score: this.totalScore,
        lives: this.lives
      };
      
      // Stop UI scenes
      this.scene.stop("UIScene");
      this.scene.stop("TutorialUIScene");
      this.scene.stop("AbilityUnlockUIScene");
      
      // CRITICAL: GameScene was PAUSED (not stopped) when VictoryUIScene launched.
      // We need to resume it before we can stop it properly.
      this.scene.resume(this.currentLevelKey!);
      this.scene.stop(this.currentLevelKey!);
      
      // Determine which story to show:
      // - After level 1 (tutorial): show "intro" story (the real story begins)
      // - After level 2+: show "level_N" story (where N is current completed level)
      let storyKey: string;
      if (this.currentLevel === 1) {
        // After tutorial (level 1), show intro story
        storyKey = "intro";
      } else {
        // After other levels, show the story for that level
        storyKey = `level_${this.currentLevel}`;
      }
      
      this.scene.start("StoryScene", {
        storyKey: storyKey,
        nextScene: nextLevelKey,
        nextSceneData: nextLevelData
      });
    };

    this.fadeOutGameplayMusicAndContinue(currentScene, continueTransition);
  }

  update(): void {
    // Victory UI scene doesn't need special update logic
  }
}
