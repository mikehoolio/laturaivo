import Phaser from "phaser";
import * as utils from "../utils";

export type PowerUpType = "euro20" | "euro50" | "euro100" | "euro500";

// Power-up item that grants temporary buffs when collected
export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  powerUpType: PowerUpType;
  isCollected: boolean;
  floatTween?: Phaser.Tweens.Tween;
  glowGraphics?: Phaser.GameObjects.Graphics;
  private glowColor: number = 0xffff00;
  private glowFrameSkip: number = 0;
  private glowDirty: boolean = true;
  private lastGlowX: number = Number.NaN;
  private lastGlowY: number = Number.NaN;
  private lastGlowIntensity: number = -1;
  
  // Power-up effects configuration - EURO BANKNOTES!
  static readonly EFFECTS = {
    euro20: {
      key: "euro_20_powerup",
      duration: 6000,           // 6 seconds of speed boost
      speedMultiplier: 1.5,     // 50% faster
      energyRegenBonus: 20,     // +20 energy regen per second during boost
      scoreBonus: 50
    },
    euro50: {
      key: "euro_50_powerup",
      duration: 5000,           // 5 seconds of shield power
      contactDamage: 30,        // Deal 30 damage to enemies on contact
      knockbackForce: 400,      // Knock enemies away
      scoreBonus: 100
    },
    euro100: {
      key: "euro_100_powerup",
      healthRestore: 40,        // Restore 40 health
      energyRestore: 50,        // Also restore 50 energy
      scoreBonus: 25
    },
    euro500: {
      key: "euro_500_powerup",          // Rare 500€ banknote!
      livesGain: 1,                     // Gain 1 extra life
      scoreBonus: 200
    }
  };

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType) {
    const config = PowerUp.EFFECTS[type];
    super(scene, x, y, config.key);
    
    this.powerUpType = type;
    this.isCollected = false;
    this.glowColor = this.resolveGlowColor(type);
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize scale
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 48);
    
    // Disable gravity - power-ups float
    this.body.setAllowGravity(false);
    
    // Create floating animation
    this.createFloatAnimation();
    
    // Create glow effect
    this.createGlowEffect();
    
    // Set depth above ground but below enemies (using DEPTH_POWERUPS = 8)
    this.setDepth(8);
  }
  
  createFloatAnimation(): void {
    // Gentle up/down floating motion
    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: this.y - 15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }
  
  createGlowEffect(): void {
    // Strong pulsing scale effect for glow - makes powerups really stand out!
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.25,
      scaleY: this.scaleY * 1.25,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    
    // Add glow tint pulsing for "arvokas" feeling
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.85, to: 1 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    
    // Create actual glow graphics around the powerup
    this.glowGraphics = this.scene.add.graphics();
    this.glowGraphics.setDepth(7); // Just below powerup
    this.updateGlowGraphics();
    
    // Animate glow intensity
    this.scene.tweens.add({
      targets: this,
      glowIntensity: { from: 0.3, to: 0.8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.glowDirty = true;
      }
    });
  }
  
  private resolveGlowColor(type: PowerUpType): number {
    switch (type) {
      case "euro20": return 0xffdd00;
      case "euro50": return 0x00ffff;
      case "euro100": return 0x00ff00;
      case "euro500": return 0xff00ff;
      default: return 0xffff00;
    }
  }

  // Glow intensity for animation
  private glowIntensity: number = 0.5;
  
  // Update glow graphics around powerup
  private updateGlowGraphics(): void {
    if (!this.glowGraphics || !this.active) return;
    
    this.glowGraphics.clear();
    const glowY = this.y - this.displayHeight / 2;
    
    // Draw outer glow circle
    this.glowGraphics.fillStyle(this.glowColor, this.glowIntensity * 0.3);
    this.glowGraphics.fillCircle(this.x, glowY, 40);
    
    // Draw inner glow circle
    this.glowGraphics.fillStyle(this.glowColor, this.glowIntensity * 0.5);
    this.glowGraphics.fillCircle(this.x, glowY, 25);
  }
  
  collect(): { type: PowerUpType; effect: any } {
    if (this.isCollected) return { type: this.powerUpType, effect: null };
    
    this.isCollected = true;
    const scene = this.scene;
    
    // Play collection sound with emphasis
    scene?.sound?.play?.("powerup_collect", { volume: 0.6 });
    
    // Play extra "cha-ching" sound for valuable feeling
    scene?.time?.delayedCall?.(100, () => {
      if (!this.active) return;
      utils.playManagedSound(scene, "combo_hit", {
        volume: 0.3,
        rate: 1.5,
        pitchVariation: 0,
        detuneVariation: 0
      });
    });
    
    // Create particle burst for extra feedback
    this.createCollectParticles();
    
    // Get effect data
    const effect = PowerUp.EFFECTS[this.powerUpType];
    
    // Collection animation - pop and fade
    scene?.tweens?.add?.({
      targets: this,
      scaleX: this.scaleX * 1.5,
      scaleY: this.scaleY * 1.5,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        this.destroy();
      }
    });
    
    // Stop float tween
    if (this.floatTween) {
      this.floatTween.stop();
    }
    
    return { type: this.powerUpType, effect };
  }
  
  update(time: number, delta: number): void {
    if (!this.glowGraphics || !this.active || this.isCollected) return;

    // Redraw glow at most every other frame unless intensity changed.
    this.glowFrameSkip = (this.glowFrameSkip + 1) % 2;
    const glowY = this.y - this.displayHeight / 2;
    const moved = Math.abs(this.x - this.lastGlowX) > 0.5 || Math.abs(glowY - this.lastGlowY) > 0.5;
    const intensityChanged = Math.abs(this.glowIntensity - this.lastGlowIntensity) > 0.03;
    if (!this.glowDirty && !moved && !intensityChanged) return;
    if (this.glowFrameSkip !== 0 && !intensityChanged && !this.glowDirty) return;

    this.updateGlowGraphics();
    this.lastGlowX = this.x;
    this.lastGlowY = glowY;
    this.lastGlowIntensity = this.glowIntensity;
    this.glowDirty = false;
  }
  
  // Create particle burst when collected
  private createCollectParticles(): void {
    // Get color based on type
    let color = 0xffdd00;
    switch (this.powerUpType) {
      case "euro20": color = 0xffdd00; break;
      case "euro50": color = 0x00ffff; break;
      case "euro100": color = 0x00ff00; break;
      case "euro500": color = 0xff00ff; break;
    }
    
    // Create burst of particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = Phaser.Math.Between(100, 200);
      
      const particle = this.scene.add.circle(
        this.x,
        this.y - this.displayHeight / 2,
        Phaser.Math.Between(4, 8),
        color,
        1
      );
      particle.setDepth(150);
      
      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * speed,
        y: particle.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 400,
        ease: "Power2",
        onComplete: () => particle.destroy()
      });
    }
    
    // Create "+POWER" / "+SCORE" popup text
    let popupText = "";
    let popupColor = "#ffff00";
    switch (this.powerUpType) {
      case "euro20": popupText = "+NOPEUS!"; popupColor = "#ffdd00"; break;
      case "euro50": popupText = "+SUOJA!"; popupColor = "#00ffff"; break;
      case "euro100": popupText = "+HP!"; popupColor = "#00ff00"; break;
      case "euro500": popupText = "+1 EL\u00c4M\u00c4!"; popupColor = "#ff00ff"; break;
    }
    
    const popup = this.scene.add.text(
      this.x,
      this.y - this.displayHeight - 20,
      popupText,
      {
        fontFamily: "PublicPixel",
        fontSize: "18px",
        color: popupColor,
        stroke: "#000000",
        strokeThickness: 4
      }
    );
    popup.setOrigin(0.5);
    popup.setDepth(150);
    
    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 50,
      alpha: 0,
      scale: 1.3,
      duration: 800,
      ease: "Power2",
      onComplete: () => popup.destroy()
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.floatTween) {
      this.floatTween.stop();
    }
    if (this.glowGraphics) {
      this.glowGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
