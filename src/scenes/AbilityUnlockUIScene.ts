import Phaser from "phaser";
import * as utils from "../utils";

/**
 * Ability Unlock UI Scene - Shows a notification when a new ability is unlocked
 * Triggered when:
 * - Level 2: Axe attack (X key) unlocked
 * - Level 3: Laturaivo/Rage (V key) unlocked
 * - Level 6: Dash Axe upgrade unlocked
 * - Level 7-9: Charged super attacks unlocked
 */

interface AbilityInfo {
  name: string;
}

const ABILITY_DATA: { [key: string]: AbilityInfo } = {
  axe: {
    name: "Kirves",
  },
  rage: {
    name: "Laturaivo",
  },
  dashAxe: {
    name: "Syöksyisku",
  },
  superDashAxe: {
    name: "Supersyöksy",
  },
  tornadoVoltti: {
    name: "Myrskyvoltti",
  },
  superPole: {
    name: "Supersauva",
  }
};

export class AbilityUnlockUIScene extends Phaser.Scene {
  private uiContainer!: Phaser.GameObjects.DOMElement;
  private abilityType: string = "axe";
  private currentGameSceneKey: string = "GameScene";
  private isShowing: boolean = false;
  private autoHideTimer?: Phaser.Time.TimerEvent;
  private abilityDetected: boolean = false;
  private readonly autoHideDurationMs: number = 2500;
  private unlockFreezeTimer?: Phaser.Time.TimerEvent;
  private gameScenePausedBeforeFreeze: boolean = false;
  private gameScenePausedByUnlock: boolean = false;

  constructor() {
    super({ key: "AbilityUnlockUIScene" });
  }

  init(data: { abilityType?: string; gameSceneKey?: string }): void {
    this.abilityType = data.abilityType || "axe";
    this.currentGameSceneKey = data.gameSceneKey || "GameScene";
    this.isShowing = false;
    this.abilityDetected = false;
    this.gameScenePausedBeforeFreeze = false;
    this.gameScenePausedByUnlock = false;
  }

  create(): void {
    this.createUnlockUI();
    this.showUnlockNotification();
  }

  createUnlockUI(): void {
    const ability = ABILITY_DATA[this.abilityType] || ABILITY_DATA.axe;

    const uiHTML = `
      <div id="ability-unlock-container" class="absolute top-0 left-0 w-full h-full pointer-events-none z-[1100] flex flex-col justify-start items-center overflow-y-auto" style="font-family: 'PublicPixel'; padding: calc(env(safe-area-inset-top, 0px) + 12px) calc(env(safe-area-inset-right, 0px) + 8px) calc(env(safe-area-inset-bottom, 0px) + 8px) calc(env(safe-area-inset-left, 0px) + 8px);">
        <div id="ability-unlock-box" class="game-pixel-container-yellow-700 px-4 md:px-6 py-3 md:py-4 max-w-xs md:max-w-md mx-2 md:mx-4 mt-10 md:mt-20 opacity-0 transition-all duration-500 transform -translate-y-8" style="border: 3px solid #fbbf24; background-color: rgba(30, 30, 30, 0.95);">
          <span class="text-yellow-200 text-sm md:text-xl font-bold" style="text-shadow: 2px 2px 0px #000;">
            Uusi kyky: ${ability.name}
          </span>
        </div>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    // Keep ability popup fully pass-through so gameplay touch controls keep working beneath it.
    this.uiContainer.pointerEvents = "none";
    if ((this.uiContainer as any).node?.style) {
      (this.uiContainer as any).node.style.pointerEvents = "none";
    }
  }

  showUnlockNotification(): void {
    this.isShowing = true;
    this.applyUnlockFreezeFrame();
    
    // Play unlock sound safely (avoid runtime exceptions if audio is unavailable).
    utils.safePlaySound(this, "ui_click_sound", { volume: 0.5 });
    
    // Show the box with animation
    const unlockBox = document.getElementById("ability-unlock-box");
    if (unlockBox) {
      this.time.delayedCall(100, () => {
        unlockBox.style.opacity = "1";
        unlockBox.style.transform = "translateY(0)";
      });
    }
    
    // Start ability detection
    this.startAbilityDetection();
    
    // Keep unlock popup short and lightweight.
    this.autoHideTimer = this.time.delayedCall(this.autoHideDurationMs, () => {
      this.hideNotification();
    });
  }

  private isSuperAbilityUnlock(): boolean {
    return this.abilityType === "superDashAxe" || this.abilityType === "tornadoVoltti" || this.abilityType === "superPole";
  }

  private applyUnlockFreezeFrame(): void {
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene || !gameScene.scene) return;
    const sceneController = gameScene.scene as any;
    this.gameScenePausedBeforeFreeze = !!sceneController?.isPaused?.();

    if (!this.gameScenePausedBeforeFreeze) {
      if (typeof gameScene.togglePause === "function") {
        gameScene.togglePause();
      } else {
        sceneController.pause();
      }
      this.gameScenePausedByUnlock = true;
    }

    if (this.unlockFreezeTimer) {
      this.unlockFreezeTimer.destroy();
      this.unlockFreezeTimer = undefined;
    }

    const freezeDurationMs = this.isSuperAbilityUnlock() ? 560 : 360;
    this.unlockFreezeTimer = this.time.delayedCall(freezeDurationMs, () => {
      this.releaseUnlockFreezeFrame();
    });
  }

  private releaseUnlockFreezeFrame(): void {
    if (!this.gameScenePausedByUnlock) return;
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene || !gameScene.scene) {
      this.gameScenePausedByUnlock = false;
      return;
    }

    const sceneController = gameScene.scene as any;
    const currentlyPaused = !!sceneController?.isPaused?.();
    if (currentlyPaused && !this.gameScenePausedBeforeFreeze) {
      if (typeof gameScene.togglePause === "function") {
        gameScene.togglePause();
      } else {
        sceneController.resume();
      }
    }
    this.gameScenePausedByUnlock = false;
  }

  startAbilityDetection(): void {
    const gameScene = this.scene.get(this.currentGameSceneKey) as any;
    if (!gameScene || !gameScene.player) return;
    
    const checkAbility = () => {
      if (this.abilityDetected || !this.isShowing) return;
      
      const player = gameScene.player;
      if (!player || !player.fsm) {
        this.time.delayedCall(100, checkAbility);
        return;
      }
      
      let detected = false;
      
      switch (this.abilityType) {
        case "axe":
          // Check for axe attack state
          detected = player.fsm.state === "axeAttacking";
          break;
        case "rage":
          // Check for rage state
          detected = player.fsm.state === "raging" || player.isRaging;
          break;
        case "dashAxe":
          // Check for dash axe state
          detected = player.fsm.state === "dashAxeAttacking";
          break;
        case "superDashAxe":
          detected = player.fsm.state === "superDashAxeAttacking";
          break;
        case "tornadoVoltti":
          detected = player.fsm.state === "tornadoSpinning";
          break;
        case "superPole":
          detected = player.fsm.state === "superPoleFrenzy";
          break;
      }
      
      if (detected) {
        this.abilityDetected = true;
        this.onAbilityUsed();
      } else {
        this.time.delayedCall(100, checkAbility);
      }
    };
    
    this.time.delayedCall(500, checkAbility);
  }

  onAbilityUsed(): void {
    utils.safePlaySound(this, "ui_click_sound", { volume: 0.4 });
    
    // Hide quickly after ability used
    this.time.delayedCall(800, () => {
      this.hideNotification();
    });
  }

  hideNotification(): void {
    if (!this.isShowing) return;
    this.isShowing = false;
    
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      this.autoHideTimer.destroy();
    }
    if (this.unlockFreezeTimer) {
      this.unlockFreezeTimer.destroy();
      this.unlockFreezeTimer = undefined;
    }
    this.releaseUnlockFreezeFrame();
    
    // Fade out
    const unlockBox = document.getElementById("ability-unlock-box");
    
    if (unlockBox) {
      unlockBox.style.opacity = "0";
      unlockBox.style.transform = "translateY(-20px)";
    }
    
    // Stop scene after fade out
    this.time.delayedCall(500, () => {
      this.scene.stop("AbilityUnlockUIScene");
    });
  }

  update(): void {
    // Detection is handled via timers
  }
}
