import Phaser from "phaser";
import * as utils from "../utils";

export class UberIntroScene extends Phaser.Scene {
  private logo!: Phaser.GameObjects.Image;
  private introText!: Phaser.GameObjects.Container;
  private canSkip: boolean = false;

  constructor() {
    super("UberIntroScene");
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Dark background
    this.cameras.main.setBackgroundColor("#000000");

    // First splash: Owlfox publisher card + version info.
    this.logo = this.add.image(centerX, centerY - 96, "owlfox_logo");
    utils.initScale(this.logo, { x: 0.5, y: 0.5 }, 300, 284);
    this.logo.setAlpha(0);

    const brandTitle = this.add.text(0, 0, "OWLFOX GAMES", {
      fontSize: "28px",
      fontFamily: "PublicPixel",
      color: "#ffffff",
      align: "center"
    });
    brandTitle.setOrigin(0.5, 0.5);

    const versionText = this.add.text(0, 36, "Version 1.1", {
      fontSize: "18px",
      fontFamily: "PublicPixel",
      color: "#cbd5e1",
      align: "center"
    });
    versionText.setOrigin(0.5, 0.5);

    const copyrightText = this.add.text(0, 68, "© 2026 Über Creative Oy", {
      fontSize: "15px",
      fontFamily: "PublicPixel",
      color: "#cbd5e1",
      align: "center"
    });
    copyrightText.setOrigin(0.5, 0.5);

    this.introText = this.add.container(centerX, centerY + 158, [brandTitle, versionText, copyrightText]);
    this.introText.setAlpha(0);

    // Animation sequence
    // 1. Fade in logo
    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      duration: 800,
      ease: "Power2"
    });

    // 2. Fade in subtitle text
    this.tweens.add({
      targets: this.introText,
      alpha: 1,
      duration: 800,
      delay: 600,
      ease: "Power2",
      onComplete: () => {
        this.canSkip = true;
      }
    });

    // Auto-transition after 4 seconds
    this.time.delayedCall(4000, () => {
      this.transitionToSplash();
    });

    // Touch/pointer skip
    this.input.on("pointerdown", () => {
      if (this.canSkip) {
        this.transitionToSplash();
      }
    });
  }

  private transitionToSplash(): void {
    // Prevent multiple transitions
    this.canSkip = false;

    // Fade out everything
    this.tweens.add({
      targets: [this.logo, this.introText],
      alpha: 0,
      duration: 500,
      ease: "Power2",
      onComplete: () => {
        this.scene.start("SplashScene");
      }
    });
  }
}
