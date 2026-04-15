import Phaser from "phaser";

const CREDITS_BLOCKS = [
  "L A T U R A I V O",
  "Kiitos pelaamisesta.",
  "Konsepti\nKenneth Mikael",
  "Pelin tuotanto, kehitys, design, toteutus\nMikko Antikainen",
  "Julkaisija\nOwlfox",
  "© Über Creative Oy 2026\nKaikki oikeudet pidätetään"
];

const FUN_LINE = "Jos hermot meni, peli toimi.";

export class CreditsScreen extends Phaser.Scene {
  private isTransitioning = false;
  private returnButton?: Phaser.GameObjects.Container;
  private autoReturnTimer?: Phaser.Time.TimerEvent;
  private buttonRevealTimer?: Phaser.Time.TimerEvent;
  private inactivityTimeoutMs = 15000;

  constructor() {
    super({ key: "CreditsScreen" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#000000");

    const background = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1);
    background.setScrollFactor(0);

    const contentTop = Math.max(92, height * 0.12);
    const contentBottom = Math.min(height - 128, height * 0.82);
    const contentHeight = Math.max(260, contentBottom - contentTop);
    const blockSpacing = contentHeight / Math.max(1, CREDITS_BLOCKS.length - 1);
    const textWidth = Math.min(width * 0.84, 880);

    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "PublicPixel",
      fontSize: `${Math.max(26, Math.min(42, Math.floor(width * 0.055)))}px`,
      color: "#FFFFFF",
      align: "center",
      wordWrap: { width: textWidth, useAdvancedWrap: true }
    };

    const bodyStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "PublicPixel",
      fontSize: `${Math.max(13, Math.min(21, Math.floor(width * 0.026)))}px`,
      color: "#FFFFFF",
      align: "center",
      lineSpacing: 12,
      wordWrap: { width: textWidth, useAdvancedWrap: true }
    };

    const funLineStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "PublicPixel",
      fontSize: `${Math.max(10, Math.min(14, Math.floor(width * 0.016)))}px`,
      color: "#A3A3A3",
      align: "center"
    };

    this.cameras.main.fadeIn(1500, 0, 0, 0);

    CREDITS_BLOCKS.forEach((block, index) => {
      const y = contentTop + blockSpacing * index;
      const isTitle = index === 0;
      const text = this.add.text(width / 2, y, block, isTitle ? titleStyle : bodyStyle);
      text.setOrigin(0.5, 0.5);
      text.setAlpha(0);

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 520,
        ease: "Sine.easeOut",
        delay: 350 + index * 360
      });
    });

    const funLine = this.add.text(
      width / 2,
      height - Math.max(88, height * 0.1),
      FUN_LINE,
      funLineStyle
    );
    funLine.setOrigin(0.5, 0.5);
    funLine.setAlpha(0);

    this.tweens.add({
      targets: funLine,
      alpha: 0.72,
      duration: 600,
      ease: "Sine.easeOut",
      delay: 2600
    });

    this.returnButton = this.createReturnButton(width, height);
    this.returnButton.setAlpha(0);
    this.returnButton.setVisible(false);

    this.buttonRevealTimer = this.time.delayedCall(3000, () => {
      if (!this.returnButton || this.isTransitioning) return;
      this.returnButton.setVisible(true);
      this.tweens.add({
        targets: this.returnButton,
        alpha: 1,
        duration: 260,
        ease: "Sine.easeOut"
      });
    });

    this.input.on("pointerdown", this.handleActivity, this);
    this.scale.on("resize", this.handleResize, this);
    this.resetAutoReturnTimer();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", this.handleActivity, this);
      this.scale.off("resize", this.handleResize, this);
      this.autoReturnTimer?.destroy();
      this.buttonRevealTimer?.destroy();
      this.autoReturnTimer = undefined;
      this.buttonRevealTimer = undefined;
    });
  }

  private createReturnButton(width: number, height: number): Phaser.GameObjects.Container {
    const buttonWidth = Math.min(320, width * 0.62);
    const buttonHeight = 52;
    const y = height - Math.max(42, height * 0.06);

    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x111111, 0.96);
    bg.setStrokeStyle(2, 0xffffff, 1);

    const label = this.add.text(0, 0, "[ Palaa alkuun ]", {
      fontFamily: "PublicPixel",
      fontSize: `${Math.max(12, Math.min(18, Math.floor(width * 0.022)))}px`,
      color: "#FFFFFF",
      align: "center"
    });
    label.setOrigin(0.5, 0.5);

    const container = this.add.container(width / 2, y, [bg, label]);
    container.setSize(buttonWidth, buttonHeight);

    bg.setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.();
        this.handleActivity();
        this.returnToTitle();
      })
      .on("pointerover", () => {
        if (!this.returnButton || this.isTransitioning) return;
        bg.setFillStyle(0x1f1f1f, 0.98);
      })
      .on("pointerout", () => {
        bg.setFillStyle(0x111111, 0.96);
      });

    return container;
  }

  private handleActivity(): void {
    if (this.isTransitioning) return;
    this.resetAutoReturnTimer();
  }

  private resetAutoReturnTimer(): void {
    this.autoReturnTimer?.destroy();
    this.autoReturnTimer = this.time.delayedCall(this.inactivityTimeoutMs, () => {
      this.returnToTitle();
    });
  }

  private returnToTitle(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.autoReturnTimer?.destroy();
    this.buttonRevealTimer?.destroy();
    this.sound.play("ui_click_sound", { volume: 0.25 });
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("TitleScreen");
    });
  }

  private handleResize(): void {
    // Recreate layout on next entry instead of mutating many text nodes at runtime.
    // A credits screen resize is rare, but we still keep it stable by restarting safely.
    if (this.isTransitioning) return;
    this.scene.restart();
  }
}
