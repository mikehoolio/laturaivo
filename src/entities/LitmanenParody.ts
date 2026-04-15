import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";
import { FLAVOR_TEXT_ENABLED, sanitizePlayerFacingText } from "../content/PlayerTextPolicy";

type Direction = "left" | "right";

/**
 * LitmanenParody - Lahti Level 4 exclusive character
 * Businessman parody of Jari Litmanen in Ajax football shirt
 * Shows middle finger toward player - dark humor/parody style
 * References the 2001 Lahti doping scandal satirically
 */
export class LitmanenParody extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Animation tween
  private idleTween?: Phaser.Tweens.Tween;
  private middleFingerTimer?: Phaser.Time.TimerEvent;
  
  // Flavor phrases for hit reactions
  public phrases: string[] = [
    '"Ei ollut valmista!"',
    '"Ajax Forever!"',
    '"Olin vain flunssassa!"',
    '"Syytä lääkäriä!"',
    '"Huolto myöhästyi taas!"',
    '"Tää on salaliitto!"',
  ];
  
  // Track if using fallback texture
  private usingFallback: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    // Use fallback texture if Litmanen asset not available
    // Falls back to regular enemy skier image
    const hasLitmanenAsset = scene.textures.exists("litmanen_parody_walk_R_frame1");
    const textureKey = hasLitmanenAsset 
      ? "litmanen_parody_walk_R_frame1" 
      : "enemy_ski_idle_R_frame1";
    super(scene, x, y, textureKey);
    
    this.usingFallback = !hasLitmanenAsset;
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 50; // Walks with businessman swagger
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 60; // Slightly tougher
    this.health = this.maxHealth;
    this.scoreValue = 150; // Worth more points
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - businessman in Ajax shirt
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 130, 0.4, 0.9);
    
    // Set facing left (toward player)
    this.setFlipX(true);
    
    // Add red/white Ajax-style tint
    this.setTint(0xffdddd);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start idle animation
    this.startIdleAnimation();
    
    // Periodically show "middle finger" gesture (visual effect)
    this.startMiddleFingerTimer();
  }
  
  startIdleAnimation(): void {
    // Cocky walk animation - like a confident businessman
    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: this.scaleY * 0.95,
      scaleX: this.scaleX * 1.02,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  startMiddleFingerTimer(): void {
    // Periodically flash red and show attitude
    this.middleFingerTimer = this.scene.time.addEvent({
      delay: 2000,
      callback: () => {
        if (this.isDead || !this.active) return;
        
        // Flash angry red tint
        this.setTint(0xff4444);
        
        // Show floating text with attitude
        const phrase = Phaser.Math.RND.pick(this.phrases);
        this.showFloatingText(phrase);
        
        // Reset tint after flash
        this.scene.time.delayedCall(300, () => {
          if (!this.isDead && this.active) {
            this.setTint(0xffdddd);
          }
        });
      },
      loop: true
    });
  }
  
  showFloatingText(text: string): void {
    if (!FLAVOR_TEXT_ENABLED) return;
    const safeText = sanitizePlayerFacingText(text);
    if (!safeText) return;

    const floatText = this.scene.add.text(
      this.x,
      this.y - 80,
      safeText,
      {
        fontFamily: 'PublicPixel',
        fontSize: '12px',
        color: '#ff6666',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    floatText.setOrigin(0.5, 0.5);
    floatText.setDepth(100);
    
    this.scene.tweens.add({
      targets: floatText,
      y: floatText.y - 30,
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => floatText.destroy()
    });
  }
  
  update(time: number, delta: number): void {
    if (!this.active || this.isDead || !this.scene) return;
    
    // Keep at ground level
    if (this.y > this.groundY) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    
    // Flash white effect
    this.setTint(0xffffff);
    
    // Play hurt sound
    utils.playSoundWithVariation(this.scene, "enemy_hit", 0.3, 0.15);
    
    // Show random phrase when hit
    const phrase = Phaser.Math.RND.pick(this.phrases);
    this.showFloatingText(phrase);
    
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
      this.isHurting = false;
    });
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die(): void {
    this.isDead = true;
    
    // Stop animations and timers
    if (this.idleTween) {
      this.idleTween.destroy();
    }
    if (this.middleFingerTimer) {
      this.middleFingerTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'litmanen_parody', 0.5);
    
    // Death animation - dramatic fall
    this.setVelocity(100, -180);
    
    // Show final phrase
    this.showFloatingText('"OI VOI!"');
    
    this.scene.tweens.add({
      targets: this,
      angle: -120,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.idleTween) {
      this.idleTween.destroy();
    }
    if (this.middleFingerTimer) {
      this.middleFingerTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
