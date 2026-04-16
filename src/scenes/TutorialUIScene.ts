import Phaser from "phaser";
import * as utils from "../utils";
import { shouldUseKeyboardControlCopy } from "../controlPrompts";

type TutorialStepId =
  | "welcome"
  | "movement"
  | "dodge"
  | "jump"
  | "pole"
  | "axe"
  | "voltti"
  | "rage"
  | "tornado"
  | "superPole"
  | "superDash"
  | "complete";

interface TutorialStep {
  id: TutorialStepId;
  title: string;
  description: string;
  hint: string;
  autoAdvanceMs?: number;
}

interface StepFlags {
  movedLeft: boolean;
  movedRight: boolean;
  dodge: boolean;
  jumped: boolean;
  pole: boolean;
  axe: boolean;
  voltti: boolean;
  rage: boolean;
  tornado: boolean;
  superPole: boolean;
  superDash: boolean;
}

interface LatchedSuperFlags {
  tornado: boolean;
  superPole: boolean;
  superDash: boolean;
}

const STEP_LIST: TutorialStep[] = [
  {
    id: "welcome",
    title: "TASO 1 TUTORIAALI",
    description: "Opit nyt kaikki ydintoiminnot vaihe vaiheelta.",
    hint: "Voit ohittaa koko tutorialtason koska tahansa painikkeella OHITA TUTORIAALI.",
    autoAdvanceMs: 2200
  },
  {
    id: "movement",
    title: "LIIKKUMINEN",
    description: "Liiku vasemmalle ja oikealle virtuaaliohjaimella.",
    hint: "Tee molemmat suunnat: vasen + oikea."
  },
  {
    id: "dodge",
    title: "VÄISTÖ",
    description: "Tee nopea väistöliike taaksepäin.",
    hint: "Paina vasemman puolen VÄISTÄ-painiketta."
  },
  {
    id: "jump",
    title: "HYPPY",
    description: "Hyppää kerran väistääksesi esteitä.",
    hint: "Pyyhkäise ylös hypätäksesi."
  },
  {
    id: "pole",
    title: "SAUVAISKU",
    description: "Käytä sauvaiskua lähietäisyydellä.",
    hint: "Paina vihreää SAUVA-painiketta."
  },
  {
    id: "axe",
    title: "KIRVES",
    description: "Tee kirvesisku (tasolla 1 tämä on tutorialissa avattu).",
    hint: "Paina oranssia KIRVES-painiketta."
  },
  {
    id: "voltti",
    title: "VOLTTI",
    description: "Tee voltti ilmassa lyhyellä painalluksella.",
    hint: "Hyppää ensin, paina sitten VOLTTI."
  },
  {
    id: "rage",
    title: "RAIVO",
    description: "Aktivoi raivo kun mittari on täynnä.",
    hint: "Paina punaista RAIVO-painiketta."
  },
  {
    id: "tornado",
    title: "MYRSKYVOLTTI (SUPER)",
    description: "Pidä VOLTTI pohjassa noin 1.0 s ja vapauta.",
    hint: "Tämä kuluttaa energian ja pyörii 2 sekuntia."
  },
  {
    id: "superPole",
    title: "SUPERSAUVA (SUPER)",
    description: "Pidä SAUVA pohjassa noin 1.0 s ja vapauta.",
    hint: "Tämä kuluttaa energian ja osuu ympäriinsä 2 sekuntia."
  },
  {
    id: "superDash",
    title: "SUPERSYOKSY (SUPERDASH)",
    description: "Pidä KIRVES pohjassa noin 1.0 s ja vapauta.",
    hint: "Tämä tekee pitkän syöksyn eteenpäin."
  },
  {
    id: "complete",
    title: "VALMISTA",
    description: "Kaikki ydintoiminnot harjoiteltu. Hyvää matkaa!",
    hint: "Tutoriaali sulkeutuu automaattisesti.",
    autoAdvanceMs: 1400
  }
];

const getKeyboardTutorialStep = (step: TutorialStep): TutorialStep => {
  if (!shouldUseKeyboardControlCopy()) return step;

  const overrides: Partial<Record<TutorialStepId, Partial<TutorialStep>>> = {
    welcome: {
      hint: "Voit ohittaa tutorialtason OHITA TUTORIAALI -napilla. Näppäimistö toimii myös koko pelissä."
    },
    movement: {
      description: "Liiku vasemmalle ja oikealle näppäimistöllä tai touch-ohjaimella.",
      hint: "A/D tai ←/→. Tee molemmat suunnat: vasen + oikea."
    },
    dodge: {
      description: "Tee nopea väistöliike taaksepäin.",
      hint: "S, ↓ tai Shift. Touchilla paina VÄISTÄ."
    },
    jump: {
      description: "Hyppää kerran väistääksesi esteitä.",
      hint: "W, ↑ tai Space. Touchilla pyyhkäise ylös."
    },
    pole: {
      description: "Käytä sauvaiskua lähietäisyydellä.",
      hint: "J tai Z. Touchilla vihreä SAUVA-painike."
    },
    axe: {
      description: "Tee kirvesisku (tasolla 1 tämä on tutorialissa avattu).",
      hint: "K tai X. Touchilla oranssi KIRVES-painike."
    },
    voltti: {
      description: "Tee voltti ilmassa lyhyellä painalluksella.",
      hint: "Hyppää ensin, paina sitten L tai C."
    },
    rage: {
      description: "Aktivoi raivo kun mittari on täynnä.",
      hint: "R tai V. Touchilla punainen RAIVO-painike."
    },
    tornado: {
      description: "Pidä L/C pohjassa noin 1.0 s ja vapauta.",
      hint: "Tämä kuluttaa energian ja pyörii 2 sekuntia."
    },
    superPole: {
      description: "Pidä J/Z pohjassa noin 1.0 s ja vapauta.",
      hint: "Tämä kuluttaa energian ja osuu ympäriinsä 2 sekuntia."
    },
    superDash: {
      description: "Pidä K/X pohjassa noin 1.0 s ja vapauta.",
      hint: "Tämä tekee pitkän syöksyn eteenpäin."
    }
  };

  return { ...step, ...(overrides[step.id] || {}) };
};

export class TutorialUIScene extends Phaser.Scene {
  private currentGameSceneKey: string = "GameScene";
  private uiContainer?: Phaser.GameObjects.DOMElement;

  private tutorialActive = false;
  private currentStepIndex = 0;
  private stepCompleted = false;
  private skipInFlight = false;
  private latchedSuperFlags: LatchedSuperFlags = {
    tornado: false,
    superPole: false,
    superDash: false
  };

  private stepFlags: StepFlags = {
    movedLeft: false,
    movedRight: false,
    dodge: false,
    jumped: false,
    pole: false,
    axe: false,
    voltti: false,
    rage: false,
    tornado: false,
    superPole: false,
    superDash: false
  };

  private autoAdvanceTimer?: Phaser.Time.TimerEvent;
  private completionTimer?: Phaser.Time.TimerEvent;
  private pollTimer?: Phaser.Time.TimerEvent;

  private boundTouchHandler?: (data: { type: string; pressed: boolean }) => void;
  private boundAttackHandler?: (data: { attackType: string }) => void;
  private boundRageHandler?: () => void;
  private boundTrickHandler?: () => void;
  private boundSkipHandler?: () => void;
  private lastKnownPauseState = false;

  constructor() {
    super({ key: "TutorialUIScene" });
  }

  init(data: { gameSceneKey?: string }): void {
    this.currentGameSceneKey = data.gameSceneKey || "GameScene";
    this.tutorialActive = true;
    this.currentStepIndex = 0;
    this.stepCompleted = false;
    this.skipInFlight = false;
    this.latchedSuperFlags = {
      tornado: false,
      superPole: false,
      superDash: false
    };
    this.resetStepFlags();
  }

  create(): void {
    this.createTutorialUI();
    this.bindGameEvents();

    this.pollTimer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        this.syncPausePresentation();
        if (this.lastKnownPauseState) return;
        this.refreshStepLiveState();
        this.evaluateCurrentStep();
      }
    });

    this.syncPausePresentation();
    this.enterStep(0);

    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.setPausedPresentation(true);
    });

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.setPausedPresentation(false);
      if (!this.lastKnownPauseState) {
        this.refreshStepLiveState();
        this.evaluateCurrentStep();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupTimers();
      this.unbindGameEvents();
    });
  }

  private getGameScene(): any {
    try {
      const scene = this.scene.get(this.currentGameSceneKey) as any;
      return scene || undefined;
    } catch {
      return undefined;
    }
  }

  private getPlayer(): any {
    return this.getGameScene()?.player;
  }

  private getRootNode(): HTMLElement | null {
    const node = (this.uiContainer as any)?.node as HTMLElement | undefined;
    return node || null;
  }

  private getElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
    const root = this.getRootNode();
    if (!root) return null;
    return root.querySelector(`#${id}`) as T | null;
  }

  private createTutorialUI(): void {
    const uiHTML = `
      <div id="tutorial-overlay" class="absolute inset-0 pointer-events-none z-[2300] flex flex-col items-center" style="font-family: 'PublicPixel';">
        <div id="tutorial-card" class="pointer-events-none mt-4 md:mt-8 w-[min(94vw,680px)] game-pixel-container-blue-800 px-3 md:px-5 py-3 md:py-4" style="border: 3px solid #7dd3fc; background: rgba(6, 28, 64, 0.94); box-shadow: 0 0 0 2px rgba(8,47,73,0.95), 0 0 24px rgba(34,211,238,0.35);">
          <div class="flex items-start justify-between gap-2 md:gap-3">
            <div class="flex-1 min-w-0">
              <div id="tutorial-title" class="text-yellow-300 text-sm md:text-xl font-bold" style="text-shadow: 2px 2px 0px #000;">TASO 1 TUTORIAALI</div>
              <div id="tutorial-step-counter" class="text-cyan-200 text-[10px] md:text-xs mt-1" style="text-shadow: 1px 1px 0px #000;">Vaihe 1/10</div>
            </div>
            <button id="tutorial-overlay-skip-btn" class="pointer-events-auto game-pixel-container-clickable-red-700 px-3 md:px-4 py-1.5 md:py-2" style="border: 2px solid #fecaca; box-shadow: 0 0 0 1px rgba(127,29,29,0.85), 0 0 14px rgba(239,68,68,0.45); animation: tutorialOverlaySkipPulse 0.95s ease-in-out infinite;">
              <span class="text-white text-[10px] md:text-xs font-bold" style="text-shadow: 1px 1px 0px #000;">⏭ OHITA TUTORIAALI</span>
            </button>
          </div>

          <div id="tutorial-description" class="text-white text-xs md:text-base mt-2 md:mt-3 leading-snug" style="text-shadow: 1px 1px 0px #000;">
            Opit nyt kaikki ydintoiminnot vaihe vaiheelta.
          </div>
          <div id="tutorial-hint" class="text-cyan-200 text-[10px] md:text-sm mt-2" style="text-shadow: 1px 1px 0px #000;">
            Vinkki tulee tähän.
          </div>

          <div class="mt-3 md:mt-4">
            <div class="game-pixel-container-slot-gray-900 p-0.5" style="height: 12px;">
              <div id="tutorial-progress-fill" class="h-full bg-cyan-300 transition-all duration-250" style="width: 0%;"></div>
            </div>
          </div>
        </div>

        <div id="tutorial-success" class="mt-2 opacity-0 transition-all duration-200 pointer-events-none">
          <span class="text-green-300 text-lg md:text-2xl font-bold" style="text-shadow: 2px 2px 0px #000;">✓ HYVÄ!</span>
        </div>

        <style>
          @keyframes tutorialOverlaySkipPulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.04); filter: brightness(1.12); }
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.pointerEvents = "none";
    const rootNode = this.getRootNode();
    if (rootNode) {
      // Keep tutorial wrapper transparent for pointer hit-testing so pause-menu buttons
      // remain clickable when this scene is active above UI overlays.
      rootNode.style.pointerEvents = "none";
    }

    const skipButton = this.getElement<HTMLButtonElement>("tutorial-overlay-skip-btn");
    if (!skipButton) return;

    let lastTouchStartAt = -1000;
    const requestSkip = () => this.requestSkipTutorialLevel();

    skipButton.addEventListener(
      "touchstart",
      (event) => {
        event.preventDefault();
        lastTouchStartAt = performance.now();
        requestSkip();
      },
      { passive: false }
    );

    skipButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (performance.now() - lastTouchStartAt < 450) return;
      requestSkip();
    });
  }

  public setPausedPresentation(isPaused: boolean): void {
    if (isPaused === this.lastKnownPauseState) return;
    this.lastKnownPauseState = isPaused;

    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.paused = isPaused;
    }
    if (this.completionTimer) {
      this.completionTimer.paused = isPaused;
    }
    if (this.uiContainer) {
      this.uiContainer.setVisible(!isPaused);
      this.uiContainer.pointerEvents = "none";
    }

    const root = this.getRootNode();
    if (root) {
      root.style.display = isPaused ? "none" : "";
      root.style.pointerEvents = "none";
    }

    const overlay = this.getElement("tutorial-overlay");
    if (overlay) {
      overlay.style.display = isPaused ? "none" : "flex";
    }
  }

  private syncPausePresentation(): void {
    const gameScene = this.getGameScene();
    this.setPausedPresentation(!!gameScene?.isPaused);
  }

  private bindGameEvents(): void {
    const gameScene = this.getGameScene();
    if (!gameScene?.events) return;

    this.boundTouchHandler = (data: { type: string; pressed: boolean }) => {
      if (!this.tutorialActive || !data?.pressed) return;
      if (data.type === "left") this.stepFlags.movedLeft = true;
      if (data.type === "right") this.stepFlags.movedRight = true;
    };

    this.boundAttackHandler = (data: { attackType: string }) => {
      if (!this.tutorialActive) return;
      const attackType = String(data?.attackType || "");

      if (attackType === "jump") {
        this.stepFlags.jumped = true;
        return;
      }
      if (attackType === "dodge") {
        this.stepFlags.dodge = true;
        return;
      }
      if (attackType === "pole") {
        this.stepFlags.pole = true;
        return;
      }
      if (attackType === "axe" || attackType === "dashAxe") {
        this.stepFlags.axe = true;
        return;
      }
      if (attackType === "tornadoVoltti") {
        this.latchedSuperFlags.tornado = true;
        this.stepFlags.tornado = true;
        return;
      }
      if (attackType === "superPole") {
        this.latchedSuperFlags.superPole = true;
        this.stepFlags.superPole = true;
        return;
      }
      if (attackType === "superDashAxe") {
        this.latchedSuperFlags.superDash = true;
        this.stepFlags.superDash = true;
      }
    };

    this.boundRageHandler = () => {
      if (!this.tutorialActive) return;
      this.stepFlags.rage = true;
    };

    this.boundTrickHandler = () => {
      if (!this.tutorialActive) return;
      this.stepFlags.voltti = true;
    };

    this.boundSkipHandler = () => {
      this.finishTutorial(true);
    };

    gameScene.events.on("touchInput", this.boundTouchHandler);
    gameScene.events.on("attackPerformed", this.boundAttackHandler);
    gameScene.events.on("rageActivated", this.boundRageHandler);
    gameScene.events.on("trickComplete", this.boundTrickHandler);
    gameScene.events.on("skipTutorialRequested", this.boundSkipHandler);
  }

  private unbindGameEvents(): void {
    const gameScene = this.getGameScene();
    if (!gameScene?.events) return;

    if (this.boundTouchHandler) gameScene.events.off("touchInput", this.boundTouchHandler);
    if (this.boundAttackHandler) gameScene.events.off("attackPerformed", this.boundAttackHandler);
    if (this.boundRageHandler) gameScene.events.off("rageActivated", this.boundRageHandler);
    if (this.boundTrickHandler) gameScene.events.off("trickComplete", this.boundTrickHandler);
    if (this.boundSkipHandler) gameScene.events.off("skipTutorialRequested", this.boundSkipHandler);

    this.boundTouchHandler = undefined;
    this.boundAttackHandler = undefined;
    this.boundRageHandler = undefined;
    this.boundTrickHandler = undefined;
    this.boundSkipHandler = undefined;
  }

  private cleanupTimers(): void {
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = undefined;
    }
    if (this.completionTimer) {
      this.completionTimer.destroy();
      this.completionTimer = undefined;
    }
    if (this.pollTimer) {
      this.pollTimer.destroy();
      this.pollTimer = undefined;
    }
  }

  private resetStepFlags(): void {
    this.stepFlags = {
      movedLeft: false,
      movedRight: false,
      dodge: false,
      jumped: false,
      pole: false,
      axe: false,
      voltti: false,
      rage: false,
      tornado: false,
      superPole: false,
      superDash: false
    };
  }

  private refreshStepLiveState(): void {
    const player = this.getPlayer();
    if (!player || !this.tutorialActive) return;

    if (player.isPerformingVoltti || player.currentTrick) {
      this.stepFlags.voltti = true;
    }

    const currentState = String(player?.fsm?.state || "");
    if (currentState === "tornadoSpinning") {
      this.latchedSuperFlags.tornado = true;
      this.stepFlags.tornado = true;
    }
    if (currentState === "superPoleFrenzy") {
      this.latchedSuperFlags.superPole = true;
      this.stepFlags.superPole = true;
    }
    if (currentState === "superDashAxeAttacking") {
      this.latchedSuperFlags.superDash = true;
      this.stepFlags.superDash = true;
    }
  }

  private primeStepFromLatchedSupers(stepId: TutorialStepId): void {
    if (stepId === "tornado" && this.latchedSuperFlags.tornado) {
      this.stepFlags.tornado = true;
    }
    if (stepId === "superPole" && this.latchedSuperFlags.superPole) {
      this.stepFlags.superPole = true;
    }
    if (stepId === "superDash" && this.latchedSuperFlags.superDash) {
      this.stepFlags.superDash = true;
    }
  }

  private preparePlayerForStep(stepId: TutorialStepId): void {
    const player = this.getPlayer();
    if (!player) return;

    player.energy = player.maxEnergy;
    (player as any).axeCooldownEndsAt = 0;
    (player as any).volttiCooldownEndsAt = 0;

    if (stepId === "rage") {
      player.rage = player.maxRage;
      this.getGameScene()?.events?.emit("rageGained", {
        currentRage: player.rage,
        maxRage: player.maxRage,
        percentage: 100
      });
    }
  }

  private enterStep(stepIndex: number): void {
    if (!this.tutorialActive) return;

    if (stepIndex < 0 || stepIndex >= STEP_LIST.length) {
      this.finishTutorial(false);
      return;
    }

    this.currentStepIndex = stepIndex;
    this.stepCompleted = false;
    this.resetStepFlags();

    const step = STEP_LIST[stepIndex];
    const displayStep = getKeyboardTutorialStep(step);
    this.preparePlayerForStep(step.id);
    this.primeStepFromLatchedSupers(step.id);
    this.renderStep(displayStep, stepIndex);

    // Re-check immediately so abilities used during step transition are not missed.
    this.refreshStepLiveState();
    this.evaluateCurrentStep();

    if (step.autoAdvanceMs && step.autoAdvanceMs > 0) {
      if (this.autoAdvanceTimer) {
        this.autoAdvanceTimer.destroy();
      }
      this.autoAdvanceTimer = this.time.delayedCall(step.autoAdvanceMs, () => {
        this.completeCurrentStep();
      });
    }
  }

  private renderStep(step: TutorialStep, stepIndex: number): void {
    const titleEl = this.getElement("tutorial-title");
    const counterEl = this.getElement("tutorial-step-counter");
    const descEl = this.getElement("tutorial-description");
    const hintEl = this.getElement("tutorial-hint");
    const progressFill = this.getElement("tutorial-progress-fill");

    if (titleEl) titleEl.textContent = step.title;

    if (counterEl) {
      const visibleSteps = STEP_LIST.filter((s) => s.id !== "welcome" && s.id !== "complete");
      const currentVisibleIndex = Math.max(
        1,
        visibleSteps.findIndex((s) => s.id === step.id) + 1 || 1
      );
      const totalVisibleSteps = visibleSteps.length;
      if (step.id === "welcome") {
        counterEl.textContent = `Vaihe 0/${totalVisibleSteps}`;
      } else if (step.id === "complete") {
        counterEl.textContent = `Vaihe ${totalVisibleSteps}/${totalVisibleSteps}`;
      } else {
        counterEl.textContent = `Vaihe ${currentVisibleIndex}/${totalVisibleSteps}`;
      }
    }

    if (descEl) descEl.textContent = step.description;
    if (hintEl) hintEl.textContent = step.hint;

    if (progressFill) {
      const completionRatio = Math.min(1, Math.max(0, stepIndex / (STEP_LIST.length - 1)));
      progressFill.style.width = `${Math.round(completionRatio * 100)}%`;
    }
  }

  private evaluateCurrentStep(): void {
    if (!this.tutorialActive || this.stepCompleted) return;

    const step = STEP_LIST[this.currentStepIndex];
    if (!step) return;

    if (this.isStepSatisfied(step.id)) {
      this.completeCurrentStep();
    }
  }

  private isStepSatisfied(stepId: TutorialStepId): boolean {
    switch (stepId) {
      case "welcome":
        return false;
      case "movement":
        return this.stepFlags.movedLeft && this.stepFlags.movedRight;
      case "dodge":
        return this.stepFlags.dodge;
      case "jump":
        return this.stepFlags.jumped;
      case "pole":
        return this.stepFlags.pole;
      case "axe":
        return this.stepFlags.axe;
      case "voltti":
        return this.stepFlags.voltti;
      case "rage":
        return this.stepFlags.rage;
      case "tornado":
        return this.stepFlags.tornado;
      case "superPole":
        return this.stepFlags.superPole;
      case "superDash":
        return this.stepFlags.superDash;
      case "complete":
        return false;
      default:
        return false;
    }
  }

  private completeCurrentStep(): void {
    if (!this.tutorialActive || this.stepCompleted) return;

    this.stepCompleted = true;

    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.destroy();
      this.autoAdvanceTimer = undefined;
    }

    this.showSuccessPulse();

    if (this.completionTimer) {
      this.completionTimer.destroy();
    }

    this.completionTimer = this.time.delayedCall(780, () => {
      const nextStepIndex = this.currentStepIndex + 1;
      if (nextStepIndex >= STEP_LIST.length) {
        this.finishTutorial(false);
        return;
      }

      const nextStep = STEP_LIST[nextStepIndex];
      if (nextStep.id === "complete") {
        this.enterStep(nextStepIndex);
        return;
      }

      this.enterStep(nextStepIndex);
    });
  }

  private showSuccessPulse(): void {
    const successEl = this.getElement("tutorial-success");
    if (!successEl) return;

    successEl.style.opacity = "1";
    successEl.style.transform = "scale(1.12)";

    this.sound.play("ui_click_sound", { volume: 0.35 });

    this.time.delayedCall(360, () => {
      const successNow = this.getElement("tutorial-success");
      if (!successNow) return;
      successNow.style.opacity = "0";
      successNow.style.transform = "scale(1)";
    });
  }

  private requestSkipTutorialLevel(): void {
    if (this.skipInFlight || !this.tutorialActive) return;
    this.skipInFlight = true;

    const gameScene = this.getGameScene();
    if (gameScene?.events) {
      gameScene.events.emit("skipTutorialRequested");
    }

    this.finishTutorial(true);
  }

  private finishTutorial(wasSkipped: boolean): void {
    if (!this.tutorialActive) return;
    this.tutorialActive = false;

    this.cleanupTimers();
    this.unbindGameEvents();

    if (!wasSkipped) {
      utils.markTutorialCompleted();
    }

    const card = this.getElement("tutorial-card");
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "translateY(-12px)";
    }

    this.time.delayedCall(260, () => {
      if (this.scene.isActive("TutorialUIScene")) {
        this.scene.stop("TutorialUIScene");
      }
    });
  }
}
