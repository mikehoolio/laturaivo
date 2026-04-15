import Phaser from 'phaser';
import * as utils from '../utils';
import { LevelManager } from '../LevelManager';
import { pickHumorLine, GAME_OVER_LINES } from '../humor/HumorPack';


export class GameOverUIScene extends Phaser.Scene {
  private currentLevelKey: string | null;
  private isRestarting: boolean;
  private uiContainer: Phaser.GameObjects.DOMElement | null;

  
  // Stats
  private currentLevel: number;
  private totalDistance: number;
  private enemiesDefeated: number;
  private finalScore: number;
  private playTime: number;
  
  private characterType: "male" | "female";
  private gameOverFlavorLine: string = "EI ENÄÄ ELÄMIÄ!";
  


  constructor() {
    super({
      key: "GameOverUIScene",
    });
    this.currentLevelKey = null;
    this.isRestarting = false;
    this.uiContainer = null;
    this.currentLevel = 1;
    this.totalDistance = 0;
    this.enemiesDefeated = 0;
    this.finalScore = 0;
    this.playTime = 0;
    this.characterType = "male";
  }

  init(data: { 
    currentLevelKey?: string; 
    currentLevel?: number; 
    totalDistance?: number; 
    enemiesDefeated?: number; 
    lives?: number; 
    score?: number; 
    playTime?: number;
    characterType?: "male" | "female";
  }) {
    this.currentLevelKey = data.currentLevelKey || "GameScene";
    this.currentLevel = data.currentLevel || 1;
    this.totalDistance = data.totalDistance || 0;
    this.enemiesDefeated = data.enemiesDefeated || 0;
    this.finalScore = data.score || 0;
    this.playTime = data.playTime || 0;
    this.isRestarting = false;
    this.characterType = data.characterType || (this.registry.get('characterType') as "male" | "female") || "male";
  }

  create(): void {
    // Play game over sound
    this.sound.play("game_over_sound", { volume: 0.5 });
    this.gameOverFlavorLine = pickHumorLine(this, GAME_OVER_LINES, this.gameOverFlavorLine);
    
    // Create DOM UI
    this.createDOMUI();
    // Setup input controls
    this.setupInputs();
  }

  createDOMUI(): void {
    const campaignSave = utils.getCampaignSave();
    const savedLevel = Phaser.Math.Clamp(
      Math.floor(Number(campaignSave?.highestUnlockedLevel || 0)),
      1,
      LevelManager.TOTAL_LEVELS
    );
    const bossCheckpointLevel = utils.getBossCheckpointLevel();
    const canRetryBoss = !!bossCheckpointLevel &&
      bossCheckpointLevel === this.currentLevel &&
      LevelManager.isBossLevel(bossCheckpointLevel);
    const retryBossHtml = canRetryBoss
      ? `
            <div class="game-pixel-container-clickable-red-600 px-7 py-4 cursor-pointer hover:scale-105 active:scale-95 transition-transform" id="retry-boss-button">
              <span class="text-white font-bold text-base md:text-lg">YRITÄ BOSSIA UUDESTAAN</span>
            </div>
            <div class="text-red-200 text-[10px] md:text-xs max-w-[420px]" style="text-shadow: 1px 1px 0px #000;">
              Checkpoint löytyi. Ei tarvitse hiihtää samaa latua kuin rangaistuslenkkiä.
            </div>
        `
      : "";
    const continueSaveLabel = savedLevel > 1
      ? `JATKA TALLENNUKSESTA`
      : `YRITÄ UUDELLEEN`;
    
    const uiHTML = `
      <div id="game-over-container" class="absolute top-0 left-0 w-full h-full pointer-events-auto z-[1000] flex flex-col justify-start md:justify-center items-center overflow-y-auto" style="font-family: 'PublicPixel'; background-color: rgba(80, 0, 0, 0.9); padding: calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 8px) calc(env(safe-area-inset-bottom, 0px) + 72px) calc(env(safe-area-inset-left, 0px) + 8px); box-sizing: border-box;">
        <!-- Main Content Container -->
        <div class="flex flex-col items-center justify-center gap-3 md:gap-4 p-3 md:p-6 text-center pointer-events-auto w-full max-w-[min(96vw,720px)] my-2">
          
          <!-- Skull Icon -->
          <div class="text-5xl">💀</div>
          
          <!-- Game Over Title -->
          <div id="game-over-title" class="text-red-500 font-bold pointer-events-none text-3xl md:text-5xl" style="
            text-shadow: 4px 4px 0px #000000;
            animation: dangerBlink 0.5s ease-in-out infinite alternate;
          ">PELI OHI</div>

          <!-- No Lives Message -->
          <div class="text-red-300 text-xl font-bold" style="text-shadow: 2px 2px 0px #000;">EI ENÄÄ ELÄMIÄ!</div>
          <div class="text-yellow-300 text-sm font-bold max-w-[420px]" style="text-shadow: 2px 2px 0px #000;">${this.gameOverFlavorLine}</div>

          <!-- Stats Display -->
          <div class="game-pixel-container-gray-800 p-4 flex flex-col gap-2 w-full max-w-[min(94vw,520px)]">
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">📍 Taso</span>
              <span class="text-white text-sm font-bold">${this.currentLevel} / 10</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🏔️ Matka</span>
              <span class="text-cyan-300 text-sm">${Math.floor(this.totalDistance)}m</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">🎿 Espoolaiset</span>
              <span class="text-red-300 text-sm">${this.enemiesDefeated}</span>
            </div>
            <div class="flex justify-between w-full">
              <span class="text-gray-400 text-sm">⭐ Pisteet</span>
              <span class="text-green-300 text-sm font-bold">${this.finalScore.toLocaleString()}</span>
            </div>

          </div>

          <!-- Buttons - larger touch targets for mobile -->
          <div class="flex flex-col gap-3 mt-2">
            ${retryBossHtml}

            <div class="game-pixel-container-clickable-yellow-600 px-8 py-4 cursor-pointer hover:scale-105 active:scale-95 transition-transform" id="restart-button">
              <span class="text-black font-bold text-lg md:text-xl">${continueSaveLabel}</span>
            </div>
            
            <div class="game-pixel-container-clickable-gray-600 px-6 py-3 cursor-pointer hover:scale-105 active:scale-95 transition-transform" id="menu-button">
              <span class="text-white font-bold text-sm md:text-base">PÄÄVALIKKOON</span>
            </div>
          </div>
          


        </div>

        <!-- Custom Animations -->
        <style>
          @keyframes dangerBlink {
            from { 
              opacity: 0.7; 
            }
            to { 
              opacity: 1; 
            }
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    
    // Add click events to buttons
    const retryBossButton = document.getElementById("retry-boss-button");
    const restartButton = document.getElementById("restart-button");
    const menuButton = document.getElementById("menu-button");
    
    if (retryBossButton) {
      retryBossButton.addEventListener("click", () => this.retryBossFromCheckpoint());
      retryBossButton.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.retryBossFromCheckpoint();
      }, { passive: false });
    }
    if (restartButton) {
      restartButton.addEventListener("click", () => this.restartGame());
      restartButton.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.restartGame();
      }, { passive: false });
    }
    if (menuButton) {
      menuButton.addEventListener("click", () => this.returnToMenu());
      menuButton.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.returnToMenu();
      }, { passive: false });
    }
    

  }
  
  setupInputs(): void {
    this.input.off('pointerdown');
  }

  restartGame(): void {
    if (this.isRestarting) return;
    this.isRestarting = true;

    this.sound.play("ui_click_sound", { volume: 0.3 });

    const currentScene = this.scene.get(this.currentLevelKey!) as any;
    utils.stopGameplayMusic(this, currentScene);

    this.clearInputs();

    // Stop UI scenes and current level
    this.scene.stop("UIScene");
    this.scene.stop("TutorialUIScene");
    this.scene.stop("AbilityUnlockUIScene");
    this.scene.stop(this.currentLevelKey!);
    
    // Restart from the latest unlocked save point instead of forcing players back to the start.
    const hasCompletedTutorial = utils.hasCompletedTutorial();
    const campaignSave = utils.getCampaignSave();
    const savedLevel = Math.floor(Number(campaignSave?.highestUnlockedLevel || 0));
    const startLevel = savedLevel > 1 ? savedLevel : (hasCompletedTutorial ? 2 : 1);
    this.registry.set("isReturningPlayerSession", hasCompletedTutorial);
    this.registry.set("tutorialReplayPromptShown", false);
    if (campaignSave?.difficulty) {
      this.registry.set("difficulty", campaignSave.difficulty);
    }

    // Preserve character type from registry
    const characterType = campaignSave?.characterType || this.registry.get('characterType') || 'male';
    
    // scene.start() will automatically stop this scene, so we call it last.
    // Returning players that start from level 2 must see intro cinematic+story first.
    if (startLevel === 2) {
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

    this.scene.start("GameScene", { level: startLevel, characterType });
  }

  retryBossFromCheckpoint(): void {
    if (this.isRestarting) return;

    const bossCheckpointLevel = utils.getBossCheckpointLevel();
    if (!bossCheckpointLevel || bossCheckpointLevel !== this.currentLevel || !LevelManager.isBossLevel(bossCheckpointLevel)) {
      this.restartGame();
      return;
    }

    this.isRestarting = true;
    this.sound.play("ui_click_sound", { volume: 0.3 });

    const currentScene = this.scene.get(this.currentLevelKey!) as any;
    utils.stopGameplayMusic(this, currentScene);

    this.clearInputs();

    this.scene.stop("UIScene");
    this.scene.stop("TutorialUIScene");
    this.scene.stop("AbilityUnlockUIScene");
    this.scene.stop(this.currentLevelKey!);

    const campaignSave = utils.getCampaignSave();
    const characterType = campaignSave?.characterType || this.registry.get('characterType') || 'male';
    if (campaignSave?.difficulty) {
      this.registry.set("difficulty", campaignSave.difficulty);
    }
    this.registry.set("isReturningPlayerSession", true);
    this.registry.set("tutorialReplayPromptShown", false);

    this.scene.start("GameScene", {
      level: bossCheckpointLevel,
      characterType,
      isTutorial: false,
      startAtBossFight: true,
      bossRetryDeaths: 1
    });
  }

  returnToMenu(): void {
    if (this.isRestarting) return;
    this.isRestarting = true;

    this.sound.play("ui_click_sound", { volume: 0.3 });

    const currentScene = this.scene.get(this.currentLevelKey!) as any;
    utils.stopGameplayMusic(this, currentScene);

    this.clearInputs();

    this.scene.stop("UIScene");
    this.scene.stop("TutorialUIScene");
    this.scene.stop("AbilityUnlockUIScene");
    this.scene.stop(this.currentLevelKey!);
    
    // scene.start() will automatically stop this scene
    this.scene.start("TitleScreen");
  }

  clearInputs(): void {
    this.input.off('pointerdown');

  }

  update(): void {
    // No update needed
  }
}
