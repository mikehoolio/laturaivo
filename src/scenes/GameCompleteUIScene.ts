import Phaser from 'phaser';
import * as utils from '../utils';
import { EXCUSE_LINES, INTERVIEW_QUESTIONS, pickHumorLine } from '../humor/HumorPack';

import { LevelManager } from '../LevelManager';
import { TournamentManager } from '../managers/TournamentManager';
import { AuthManager } from '../managers/AuthManager';
import { DailyChallengeManager } from '../managers/DailyChallengeManager';
import { GAME_CENTER_ACHIEVEMENT_IDS, GameCenterAchievementManager } from '../managers/GameCenterAchievementManager';
import { LeaderboardManager } from '../managers/LeaderboardManager';
import { GameCenterManager } from '../managers/GameCenterManager';
import type { LeaderboardEntry } from '../managers/LeaderboardManager';
import { normalizeDifficultyTier } from '../content/DifficultyPresentation';
import { getContinuePromptText } from '../controlPrompts';
import { shouldIgnoreKeyboardEvent } from '../platform';

export class GameCompleteUIScene extends Phaser.Scene {
  private currentLevelKey: string | null;
  private isTransitioning: boolean;
  private uiContainer: Phaser.GameObjects.DOMElement | null;
  private musicFadeTimer?: Phaser.Time.TimerEvent;
  
  // Stats
  private totalDistance: number;
  private enemiesDefeated: number;
  private score: number;
  private levelsCompleted: number;
  private playerName: string;
  private completedDifficulty: string;
  
  // Session stats for detailed summary
  private sessionStats: {
    totalStomps: number;
    maxStompCombo: number;
    longestAirtime: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    powerUpsCollected: number;
    perfectLandings: number;
  };
  
  // Animation state
  private showingCelebration: boolean;
  private celebrationComplete: boolean;
  private interviewQuestion: string = 'Jälkipelihaastattelu: Miltä nyt tuntuu?';
  private dailyExcuse: string = 'Päivän tekosyy: lumi oli vino.';
  private returnKeydownHandler?: (event: KeyboardEvent) => void;
  


  constructor() {
    super({
      key: "GameCompleteUIScene",
    });
    this.currentLevelKey = null;
    this.isTransitioning = false;
    this.uiContainer = null;
    this.totalDistance = 0;
    this.enemiesDefeated = 0;
    this.score = 0;
    this.levelsCompleted = 0;
    this.playerName = 'PELAAJA';
    this.completedDifficulty = 'vantaa';
    this.showingCelebration = true;
    this.celebrationComplete = false;
  }

  init(data: { 
    currentLevelKey?: string; 
    totalDistance?: number; 
    enemiesDefeated?: number; 
    score?: number; 
    levelsCompleted?: number;
    sessionStats?: {
      totalStomps: number;
      maxStompCombo: number;
      longestAirtime: number;
      totalDamageDealt: number;
      totalDamageTaken: number;
      powerUpsCollected: number;
      perfectLandings: number;
    };
  }) {
    this.currentLevelKey = data.currentLevelKey || "GameScene";
    this.totalDistance = data.totalDistance || 0;
    this.enemiesDefeated = data.enemiesDefeated || 0;
    this.score = data.score || 0;
    this.levelsCompleted = data.levelsCompleted || 10;
    this.isTransitioning = false;
    this.showingCelebration = true;
    this.celebrationComplete = false;
    
    // Session stats
    this.sessionStats = data.sessionStats || {
      totalStomps: 0,
      maxStompCombo: 0,
      longestAirtime: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      powerUpsCollected: 0,
      perfectLandings: 0
    };
    
    // Get player name from registry
    this.playerName = LeaderboardManager.sanitizePlayerName(
      String(this.registry.get('playerName') || 'PELAAJA')
    ) || 'PELAAJA';
    this.completedDifficulty = normalizeDifficultyTier(this.registry.get('difficulty') || 'vantaa');
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown');
      if (this.returnKeydownHandler) {
        window.removeEventListener("keydown", this.returnKeydownHandler, { capture: true } as EventListenerOptions);
        this.returnKeydownHandler = undefined;
      }
      if (this.musicFadeTimer) {
        this.musicFadeTimer.destroy();
        this.musicFadeTimer = undefined;
      }
    });

    this.interviewQuestion = pickHumorLine(this, INTERVIEW_QUESTIONS, this.interviewQuestion);
    this.dailyExcuse = pickHumorLine(this, EXCUSE_LINES, this.dailyExcuse);

    // Persist final campaign result to leaderboard.
    // Keep levelsCompleted capped to official campaign length for compatibility.
    const leaderboardEntry: LeaderboardEntry = {
      playerName: this.playerName,
      totalDistance: Math.floor(this.totalDistance),
      enemiesDefeated: this.enemiesDefeated,
      levelsCompleted: Math.min(this.levelsCompleted, 10),
      score: this.score,
      date: new Date().toISOString().split('T')[0]
    };
    const leaderboardEligible = this.registry.get('leaderboardEligible') !== false;
    const cheatCodeUsed = !!this.registry.get('cheatCodeUsed');
    const godModeActivated = !!this.registry.get('godModeActivated');
    const completedOfficialCampaign = this.levelsCompleted >= LevelManager.TOTAL_LEVELS;
    const cleanCampaignClear = completedOfficialCampaign && !cheatCodeUsed && !godModeActivated;

    LeaderboardManager.addEntry(leaderboardEntry, {
      leaderboardEligible,
      cheatCodeUsed,
      godModeActivated,
      difficulty: String(this.registry.get('difficulty') || 'vantaa'),
      levelReached: this.levelsCompleted
    }).catch(e => console.debug('Failed to save final score:', e));
    if (leaderboardEligible && !cheatCodeUsed && !godModeActivated) {
      GameCenterManager.submitScore(this.score).catch(e => console.debug('Failed to submit Game Center score:', e));
    }
    if (this.score >= 100000) {
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.score100k);
    }
    if (cleanCampaignClear) {
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.campaignNoCheat);
      if (this.completedDifficulty === 'lahti') {
        utils.unlockExtraLevelSelect();
        void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.campaignLahtiComplete);
        void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.campaignVantaaComplete);
      } else if (this.completedDifficulty === 'vantaa') {
        void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.campaignVantaaComplete);
      }
    }

    // Submit to tournament (async)
    TournamentManager.submitScore({
      score: this.score,
      distance: Math.floor(this.totalDistance),
      enemiesDefeated: this.enemiesDefeated,
      levelsCompleted: this.levelsCompleted,
      playerName: this.playerName
    }).catch(e => console.debug('Failed to submit tournament score:', e));
    
    // Update player profile stats (async)
    AuthManager.updateStats({
      score: this.score,
      distance: Math.floor(this.totalDistance),
      enemiesDefeated: this.enemiesDefeated,
      levelReached: this.levelsCompleted
    }).catch(e => console.debug('Failed to update profile:', e));
    
    // Update daily challenge progress
    DailyChallengeManager.updateProgress('levels_completed', this.levelsCompleted, false);
    DailyChallengeManager.updateProgress('score_reached', this.score, false);
    DailyChallengeManager.updateProgress('distance_traveled', Math.floor(this.totalDistance), false);
    DailyChallengeManager.updateProgress('enemies_defeated', this.enemiesDefeated, false);

    if (completedOfficialCampaign) {
      this.autoProceedToEndingStory();
      return;
    }

    // First show the epic celebration animation
    this.showEpicCelebration();
  }

  private autoProceedToEndingStory(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const currentScene = this.scene.get("GameScene") as any;
    this.fadeOutGameplayMusicAndContinue(currentScene, () => {
      this.scene.stop("UIScene");
      this.scene.stop("TutorialUIScene");
      this.scene.stop("AbilityUnlockUIScene");
      this.scene.stop("GameScene");
      this.scene.stop("VictoryCutsceneScene");

      this.scene.start("StoryScene", {
        storyKey: "ending",
        nextScene: "CreditsScreen",
        nextSceneData: {}
      });
    });
  }

  showEpicCelebration(): void {
    const shortestSide = Math.min(this.scale.width, this.scale.height);
    const titleSize = Math.max(34, Math.min(72, Math.floor(shortestSide * 0.1)));
    const subTitleSize = Math.max(30, Math.min(64, Math.floor(shortestSide * 0.088)));

    // Dark overlay
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.85
    );
    overlay.setDepth(100);

    // Create epic "OLET PARAS LATURAIVOOJA!" animation
    const mainTitle = this.add.text(
        this.scale.width / 2,
        -100,
        "OLET PARAS",
        {
          fontFamily: "PublicPixel",
          fontSize: `${titleSize}px`,
          color: "#FFD700",
          stroke: "#000000",
          strokeThickness: 8,
        align: "center"
      }
    );
    mainTitle.setOrigin(0.5, 0.5);
    mainTitle.setDepth(110);

    const subTitle = this.add.text(
        this.scale.width / 2,
        this.scale.height + 100,
        "LATURAIVOOJA!",
        {
          fontFamily: "PublicPixel",
          fontSize: `${subTitleSize}px`,
          color: "#FF4500",
          stroke: "#000000",
          strokeThickness: 8,
        align: "center"
      }
    );
    subTitle.setOrigin(0.5, 0.5);
    subTitle.setDepth(110);

    // Animate titles flying in from top and bottom
    this.tweens.add({
      targets: mainTitle,
      y: this.scale.height / 2 - 60,
      duration: 1000,
      ease: "Bounce.easeOut",
      delay: 300
    });

    this.tweens.add({
      targets: subTitle,
      y: this.scale.height / 2 + 40,
      duration: 1000,
      ease: "Bounce.easeOut",
      delay: 600,
      onComplete: () => {
        // Start pulsing animation
        this.tweens.add({
          targets: [mainTitle, subTitle],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 500,
          yoyo: true,
          repeat: 2,
          ease: "Sine.easeInOut"
        });

        // Create confetti/sparkles
        this.createCelebrationParticles();

        // Wait then transition to leaderboard
        this.time.delayedCall(3500, () => {
          // Fade out celebration
          this.tweens.add({
            targets: [mainTitle, subTitle],
            alpha: 0,
            y: mainTitle.y - 50,
            duration: 500,
            onComplete: () => {
              mainTitle.destroy();
              subTitle.destroy();
              this.showingCelebration = false;
              this.celebrationComplete = true;
              this.createDOMUI();
              this.setupInputs();
            }
          });
        });
      }
    });

    // Add some floating emoji/text effects
    const emojis = ["🎿", "🏆", "⭐", "🎉", "💪", "🔥"];
    for (let i = 0; i < 12; i++) {
      const emoji = this.add.text(
        Phaser.Math.Between(100, this.scale.width - 100),
        this.scale.height + 50,
        Phaser.Math.RND.pick(emojis),
        {
          fontSize: "48px"
        }
      );
      emoji.setDepth(105);

      this.tweens.add({
        targets: emoji,
        y: -50,
        x: emoji.x + Phaser.Math.Between(-100, 100),
        rotation: Phaser.Math.Between(-2, 2),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        delay: Phaser.Math.Between(500, 2000),
        ease: "Sine.easeOut",
        onComplete: () => emoji.destroy()
      });
    }
  }

  createCelebrationParticles(): void {
    // Create golden confetti/sparkles
    for (let i = 0; i < 40; i++) {
      const colors = [0xFFD700, 0xFF4500, 0x00FF00, 0x00FFFF, 0xFF00FF];
      const color = Phaser.Math.RND.pick(colors);
      
      const particle = this.add.rectangle(
        Phaser.Math.Between(50, this.scale.width - 50),
        Phaser.Math.Between(-50, -200),
        Phaser.Math.Between(8, 16),
        Phaser.Math.Between(8, 16),
        color
      );
      particle.setDepth(108);
      particle.setRotation(Phaser.Math.DegToRad(Phaser.Math.Between(0, 360)));

      this.tweens.add({
        targets: particle,
        y: this.scale.height + 50,
        x: particle.x + Phaser.Math.Between(-100, 100),
        rotation: particle.rotation + Phaser.Math.DegToRad(Phaser.Math.Between(180, 720)),
        duration: Phaser.Math.Between(2000, 4000),
        delay: Phaser.Math.Between(0, 1500),
        ease: "Sine.easeIn",
        onComplete: () => particle.destroy()
      });
    }
    
    // Create MONEY RAIN effect! 💰💵💸
    this.createMoneyRain();
  }
  
  // Money rain effect for the ultimate victory!
  createMoneyRain(): void {
    const moneyEmojis = ["💰", "💵", "💸", "🤑", "💎", "👑"];
    
    // Continuous money rain
    const moneyInterval = this.time.addEvent({
      delay: 100,
      callback: () => {
        const money = this.add.text(
          Phaser.Math.Between(50, this.scale.width - 50),
          -50,
          Phaser.Math.RND.pick(moneyEmojis),
          {
            fontSize: Phaser.Math.Between(24, 48) + "px"
          }
        );
        money.setDepth(109);
        money.setRotation(Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30)));
        
        this.tweens.add({
          targets: money,
          y: this.scale.height + 50,
          x: money.x + Phaser.Math.Between(-80, 80),
          rotation: money.rotation + Phaser.Math.DegToRad(Phaser.Math.Between(-180, 180)),
          duration: Phaser.Math.Between(2000, 3500),
          ease: "Sine.easeIn",
          onComplete: () => money.destroy()
        });
      },
      repeat: 60, // 60 money drops over 6 seconds
      callbackScope: this
    });
    
    // Stop money rain after 6 seconds
    this.time.delayedCall(6000, () => {
      moneyInterval.destroy();
    });
  }

  createDOMUI(): void {
    const extraLevelSelectUnlocked = utils.hasUnlockedExtraLevelSelect();
    const showReleaseExtraHint = this.completedDifficulty === 'lahti';
    const showDevCheatHint = showReleaseExtraHint && import.meta.env.DEV;
    const lahtiBossCodeHint = showReleaseExtraHint
      ? `
          <div class="game-pixel-container-purple-900 p-3 md:p-4 flex flex-col gap-2 items-center w-full max-w-[min(94vw,680px)]">
            <span class="text-fuchsia-300 text-sm md:text-base font-bold" style="text-shadow: 2px 2px 0px #000;">LAHTI LÄPÄISTY - BONUSVINKKI</span>
            ${extraLevelSelectUnlocked
              ? `
                <div class="text-green-300 text-xs md:text-sm leading-relaxed max-w-[620px]" style="text-shadow: 1px 1px 0px #000;">
                  Extra-valikko on nyt auki päävalikossa. Voit valita sieltä minkä tahansa kentän uudelleenpeluuseen.
                </div>
              `
              : ''
            }
            <div class="text-cyan-200 text-xs md:text-sm leading-relaxed max-w-[620px]" style="text-shadow: 1px 1px 0px #000;">
              ${showDevCheatHint
                ? `Kirjoita nimikenttään <span class="text-yellow-300 font-bold">HEMOHES</span>, niin pääset suoraan ensimmäiseen boss fightiin god modella.
                  <span class="block mt-1">
                    Koodit <span class="text-yellow-300 font-bold">HEMOHES1...HEMOHES10</span> vievät suoraan bossitaisteluihin.
                    <span class="text-orange-300">HEMOHES1</span> tarkoittaa ensimmäistä bossia eli level 2:ta.
                  </span>`
                : `Lahti on paketissa. Extra-valikko pysyy auki uusintakierroksia varten, jos hermot vielä kantavat.`
              }
            </div>
          </div>
        `
      : '';

    const uiHTML = `
      <div id="game-complete-container" class="absolute top-0 left-0 w-full h-full pointer-events-auto z-[1000] font-retro flex flex-col justify-start md:justify-center items-center bg-black bg-opacity-80 overflow-y-auto" style="padding: calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 8px) calc(env(safe-area-inset-bottom, 0px) + 72px) calc(env(safe-area-inset-left, 0px) + 8px); box-sizing: border-box;">
        <!-- Main Content Container - scrollable on mobile -->
        <div class="flex flex-col items-center justify-center gap-3 md:gap-6 p-3 md:p-6 text-center pointer-events-auto my-2 md:my-4 w-full max-w-[min(96vw,760px)]">
          
          <!-- Game Complete Title - responsive font size -->
          <div id="game-complete-title" class="text-yellow-400 font-bold pointer-events-none text-3xl md:text-5xl" style="
            text-shadow: 4px 4px 0px #000000;
            animation: glow 1.2s ease-in-out infinite alternate;
          ">PELI LÄPÄISTY!</div>

          <!-- Champion Badge -->
          <div class="text-orange-500 font-bold text-lg md:text-2xl" style="text-shadow: 2px 2px 0px #000;">
            🏆 MESTARI LATURAIVOOJA 🏆
          </div>
          <div class="text-cyan-300 text-xs md:text-sm max-w-[700px]" style="text-shadow: 1px 1px 0px #000;">
            ${this.interviewQuestion}
          </div>
          <div class="text-yellow-300 text-xs md:text-sm max-w-[700px]" style="text-shadow: 1px 1px 0px #000;">
            ${this.dailyExcuse}
          </div>

          <!-- Your Stats - responsive width -->
          <div class="game-pixel-container-gray-800 p-3 md:p-4 flex flex-col gap-2 items-center w-full max-w-[min(94vw,680px)]">
            <span class="text-green-400 text-base sm:text-xl font-bold" style="text-shadow: 2px 2px 0px #000;">TILASTOSI - ${this.playerName}</span>
            
            <!-- Main Stats Row -->
            <div class="flex gap-4 w-full justify-center">
              <div class="flex flex-col items-center min-w-[72px]">
                <span class="text-gray-400 text-xs sm:text-sm">Matka</span>
                <span class="text-white text-base sm:text-lg">${Math.floor(this.totalDistance)}m</span>
              </div>
              <div class="flex flex-col items-center min-w-[72px]">
                <span class="text-gray-400 text-xs sm:text-sm">Kohtaamiset</span>
                <span class="text-white text-base sm:text-lg">${this.enemiesDefeated}</span>
              </div>
              <div class="flex flex-col items-center min-w-[72px]">
                <span class="text-gray-400 text-xs sm:text-sm">Tasot</span>
                <span class="text-white text-base sm:text-lg">${this.levelsCompleted}</span>
              </div>
            </div>
            
            <!-- Detailed Session Stats -->
            <div class="w-full mt-2 pt-2 border-t border-gray-600">
              <span class="text-purple-400 text-sm font-bold">STOMP TILASTOT</span>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">🦶 Stompit yhteensä:</span>
                  <span class="text-white text-sm">${this.sessionStats.totalStomps}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">🔥 Paras stomp-combo:</span>
                  <span class="text-orange-400 text-sm font-bold">${this.sessionStats.maxStompCombo}x</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">🪽 Pisin ilmalento:</span>
                  <span class="text-purple-400 text-sm">${(this.sessionStats.longestAirtime / 1000).toFixed(1)}s</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">⭐ Täydelliset laskut:</span>
                  <span class="text-yellow-400 text-sm">${this.sessionStats.perfectLandings}</span>
                </div>
              </div>
            </div>
            
            <!-- Damage Stats -->
            <div class="w-full mt-2 pt-2 border-t border-gray-600">
              <span class="text-red-400 text-sm font-bold">TAISTELUTILASTOT</span>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">⚔️ Vahinko annettu:</span>
                  <span class="text-green-400 text-sm">${this.sessionStats.totalDamageDealt}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">💔 Vahinko otettu:</span>
                  <span class="text-red-400 text-sm">${this.sessionStats.totalDamageTaken}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 text-sm">☕ Power-upit kerätty:</span>
                  <span class="text-cyan-400 text-sm">${this.sessionStats.powerUpsCollected}</span>
                </div>
              </div>
            </div>
            
            <div class="flex justify-between w-full px-4 mt-2 border-t border-gray-600 pt-2">
              <span class="text-yellow-400 text-lg">PISTEET:</span>
              <span class="text-yellow-400 text-lg font-bold">${this.score}</span>
            </div>
          </div>

          ${lahtiBossCodeHint}

          <!-- Tap to continue - iOS only -->
          <div id="press-enter-text" class="text-green-400 font-bold pointer-events-none mt-4 text-lg" style="
            text-shadow: 3px 3px 0px #000000;
            animation: blink 0.8s ease-in-out infinite alternate;
          ">${getContinuePromptText()}</div>
          
          <!-- Menu button -->
          <div class="game-pixel-container-clickable-green-600 px-6 py-3 mt-2 cursor-pointer active:scale-95 transition-transform" id="mobile-menu-btn">
            <span class="text-white font-bold text-lg">PÄÄVALIKKOON ▶️</span>
          </div>

        </div>

        <!-- Custom Animations -->
        <style>
          @keyframes glow {
            from { transform: scale(1); }
            to { transform: scale(1.05); }
          }
          
          @keyframes blink {
            from { opacity: 0.3; }
            to { opacity: 1; }
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    
    // Add mobile button click handler
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => this.returnToMenu());
      mobileMenuBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.returnToMenu();
      }, { passive: false });
    }
    
  }

  setupInputs(): void {
    this.input.off('pointerdown');

    this.input.on('pointerdown', () => this.returnToMenu());
    this.returnKeydownHandler = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      this.returnToMenu();
    };
    window.addEventListener("keydown", this.returnKeydownHandler, { capture: true });
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

  returnToMenu(): void {
    if (this.isTransitioning || !this.celebrationComplete) return;
    this.isTransitioning = true;

    this.sound.play("ui_click_sound", { volume: 0.3 });

    const currentScene = this.scene.get("GameScene") as any;
    this.input.off('pointerdown');
    this.fadeOutGameplayMusicAndContinue(currentScene, () => {
      this.scene.stop("UIScene");
      this.scene.stop("TutorialUIScene");
      this.scene.stop("AbilityUnlockUIScene");
      this.scene.stop("GameScene");
      this.scene.stop("VictoryCutsceneScene");
      
      // Show ending story before final credits and title return
      this.scene.start("StoryScene", {
        storyKey: 'ending',
        nextScene: 'CreditsScreen',
        nextSceneData: {}
      });
    });
  }

  update(): void {
    // No update needed
  }
}
