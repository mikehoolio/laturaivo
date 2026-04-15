import Phaser from "phaser";
import * as utils from "../utils";

// Lahti Level 4 exclusive doping-themed power-ups
// Parody of 2001 Lahti doping scandal
export type LahtiPowerUpType = "syringe" | "cocacola" | "doctorbag";

/**
 * LahtiPowerUp - Level 4 exclusive doping-themed parody power-ups
 * Replaces standard euro power-ups only in Level 4 (Lahti)
 * 
 * Types:
 * - syringe (piikki) - Speed boost
 * - cocacola - Shield/invincibility
 * - doctorbag (musta lääkärilaukku) - Health restore
 */
export class LahtiPowerUp extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  powerUpType: LahtiPowerUpType;
  isCollected: boolean;
  floatTween?: Phaser.Tweens.Tween;
  
  // Power-up effects - mirrors euro powerups but with doping theme
  static readonly EFFECTS = {
    syringe: {
      key: "doping_syringe_powerup",
      fallbackKey: "euro_20_powerup", // Fallback if Lahti asset not loaded
      duration: 8000,           // 8 seconds - longer duration (it's "doping")
      speedMultiplier: 1.7,     // 70% faster - enhanced performance
      energyRegenBonus: 30,     // +30 energy regen
      scoreBonus: 75,
      description: "PIIKKI! +70% NOPEUS"
    },
    cocacola: {
      key: "doping_cocacola_powerup",
      fallbackKey: "euro_50_powerup", // Fallback if Lahti asset not loaded
      duration: 6000,           // 6 seconds of shield
      contactDamage: 40,        // Deal 40 damage to enemies on contact
      knockbackForce: 500,      // Stronger knockback
      scoreBonus: 120,
      description: "COCA-COLA! SUOJA + VAHINKO"
    },
    doctorbag: {
      key: "doping_doctorbag_powerup",
      fallbackKey: "euro_100_powerup", // Fallback if Lahti asset not loaded
      healthRestore: 60,        // Restore 60 health (more than normal)
      energyRestore: 70,        // Also restore 70 energy
      scoreBonus: 50,
      description: "LÄÄKÄRILAUKKU! +60 HP"
    }
  };

  // Track if using fallback texture
  private usingFallback: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: LahtiPowerUpType) {
    const config = LahtiPowerUp.EFFECTS[type];
    // Use fallback key if main asset not available (euro-powerup images)
    const hasMainAsset = scene.textures.exists(config.key);
    const textureKey = hasMainAsset ? config.key : config.fallbackKey;
    super(scene, x, y, textureKey);
    
    this.powerUpType = type;
    this.isCollected = false;
    this.usingFallback = !hasMainAsset;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize scale - slightly larger than normal powerups
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 54);
    
    // Add distinct tint based on type for visual clarity
    // Fallback uses stronger tint to distinguish from normal powerups
    if (type === "syringe") {
      // Green tint for syringe - brighter if using fallback
      this.setTint(this.usingFallback ? 0x44ff44 : 0x88ff88);
    } else if (type === "cocacola") {
      // Red tint (Coca-Cola red) - deeper red if using fallback
      this.setTint(this.usingFallback ? 0xff2222 : 0xff4444);
    } else {
      // Dark/gray tint for doctor's bag - darker if using fallback
      this.setTint(this.usingFallback ? 0x222222 : 0x444444);
    }
    
    // Disable gravity - power-ups float
    this.body.setAllowGravity(false);
    
    // Create floating animation
    this.createFloatAnimation();
    
    // Create glow effect
    this.createGlowEffect();
    
    // Set depth above ground but below enemies
    this.setDepth(8);
  }
  
  createFloatAnimation(): void {
    // Wobbly floating motion (like suspicious)
    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: this.y - 12,
      angle: { from: -5, to: 5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }
  
  createGlowEffect(): void {
    // Pulsing scale effect - more dramatic pulse
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.15,
      scaleY: this.scaleY * 1.15,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }
  
  collect(): { type: LahtiPowerUpType; effect: any } {
    if (this.isCollected) return { type: this.powerUpType, effect: null };
    
    this.isCollected = true;
    
    // Play collection sound
    this.scene.sound.play("powerup_collect", { volume: 0.5 });
    
    // Get effect data
    const effect = LahtiPowerUp.EFFECTS[this.powerUpType];
    
    // Collection animation - dramatic pop
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 2,
      scaleY: this.scaleY * 2,
      alpha: 0,
      angle: 360,
      duration: 300,
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
    // No special update logic needed - tweens handle animation
  }
  
  destroy(fromScene?: boolean): void {
    if (this.floatTween) {
      this.floatTween.stop();
    }
    super.destroy(fromScene);
  }
}
