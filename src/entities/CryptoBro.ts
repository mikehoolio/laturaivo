import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * CryptoBro - Obnoxious crypto investor checking Bitcoin charts on phone
 * Walks slowly while staring at phone, shouts crypto phrases when hit
 */
export class CryptoBro extends Phaser.Physics.Arcade.Sprite {
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
  
  // Crypto phrases for when hit
  public cryptoPhrases: string[] = [
    '"DIAMOND HANDS!"',
    '"TO THE MOON!"',
    '"HODL!"',
    '"Buy the dip!"',
    '"This is FUD!"',
    '"WAGMI!"',
  ];
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "crypto_bro_walker");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 30; // Very slow, staring at phone
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 50;
    this.health = this.maxHealth;
    this.scoreValue = 100;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - normal person height
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 120, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start idle animation (subtle bounce while checking phone)
    this.startIdleAnimation();
  }
  
  startIdleAnimation(): void {
    // Subtle bounce animation - like checking phone and nodding
    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: this.scaleY * 0.98,
      scaleX: this.scaleX * 1.01,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
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
    
    // Stop idle animation
    if (this.idleTween) {
      this.idleTween.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'crypto_bro', 0.4);
    
    // Death animation - phone flying
    this.setVelocity(80, -150);
    
    this.scene.tweens.add({
      targets: this,
      angle: -90,
      alpha: 0,
      duration: 600,
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
    super.destroy(fromScene);
  }
}
