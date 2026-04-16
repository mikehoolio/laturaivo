import Phaser from "phaser";
import * as utils from "../utils";
import { getSkipScreenPromptText } from "../controlPrompts";
import { shouldIgnoreKeyboardEvent } from "../platform";

export class SplashScene extends Phaser.Scene {
  private logo!: Phaser.GameObjects.Image;
  private messageText!: Phaser.GameObjects.Text;
  private skipText!: Phaser.GameObjects.Text;
  private canSkip: boolean = false;
  private keydownHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("SplashScene");
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Dark background
    this.cameras.main.setBackgroundColor("#000000");

    // Second splash: Owlfox publisher card + production credits.
    this.logo = this.add.image(centerX, centerY - 96, "owlfox_logo");
    utils.initScale(this.logo, { x: 0.5, y: 0.5 }, 300, 284);
    this.logo.setAlpha(0);

    this.messageText = this.add.text(centerX, centerY + 146,
      "Konsepti - Kenneth Mikael\nPelituotanto - Mikko Antikainen", {
      fontSize: "22px",
      fontFamily: "PublicPixel",
      color: "#ffffff",
      align: "center",
      lineSpacing: 16
    });
    this.messageText.setOrigin(0.5, 0.5);
    this.messageText.setAlpha(0);

    // Skip instruction - using PublicPixel for smaller UI text
    this.skipText = this.add.text(centerX, this.scale.height - 50, 
      getSkipScreenPromptText(), {
      fontSize: "16px",
      fontFamily: "PublicPixel",
      color: "#666666"
    });
    this.skipText.setOrigin(0.5, 0.5);
    this.skipText.setAlpha(0);

    // Animation sequence
    // 1. Fade in logo
    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      duration: 1000,
      ease: "Power2"
    });

    // 2. Fade in presentation text
    this.tweens.add({
      targets: this.messageText,
      alpha: 1,
      duration: 1000,
      delay: 800,
      ease: "Power2"
    });

    // 3. Fade in skip text
    this.tweens.add({
      targets: this.skipText,
      alpha: 1,
      duration: 500,
      delay: 1200,
      ease: "Power2",
      onComplete: () => {
        this.canSkip = true;
      }
    });

    // Auto-transition after 5 seconds
    this.time.delayedCall(5000, () => {
      this.transitionToTitle();
    });

    // Touch/pointer skip
    this.input.on("pointerdown", () => {
      if (this.canSkip) {
        this.transitionToTitle();
      }
    });

    this.keydownHandler = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;
      if (event.code !== "Enter" && event.code !== "Space") return;
      if (!this.canSkip) return;
      event.preventDefault();
      this.transitionToTitle();
    };
    window.addEventListener("keydown", this.keydownHandler, { capture: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keydownHandler) {
        window.removeEventListener("keydown", this.keydownHandler, { capture: true } as EventListenerOptions);
        this.keydownHandler = undefined;
      }
    });
  }

  private transitionToTitle(): void {
    // Prevent multiple transitions
    this.canSkip = false;

    // Fade out everything
    this.tweens.add({
      targets: [this.logo, this.messageText, this.skipText, ...this.children.list],
      alpha: 0,
      duration: 500,
      ease: "Power2",
      onComplete: () => {
        this.scene.start("TitleScreen");
      }
    });
  }
}
