import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * InfluencerSelfie - Instagram influencer blocking trail with selfie stick
 * Stays in place posing, very annoying
 */
export class InfluencerSelfie extends Phaser.Physics.Arcade.Sprite {
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
  private poseTween?: Phaser.Tweens.Tween;
  
  // Influencer phrases
  public phrases: string[] = [
    '"Wait, I need a pic!"',
    '"For the gram!"',
    '"Like and subscribe!"',
    '"Use my promo code!"',
    '"This is SO aesthetic!"',
  ];
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "influencer_selfie");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 15; // Almost stationary, posing
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 35;
    this.health = this.maxHealth;
    this.scoreValue = 80;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 115, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start pose animation
    this.startPoseAnimation();
  }
  
  startPoseAnimation(): void {
    // Posing animation - slight rotation as if adjusting selfie angle
    this.poseTween = this.scene.tweens.add({
      targets: this,
      angle: { from: -3, to: 3 },
      duration: 800,
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
    
    this.setTint(0xffffff);
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
    
    // Stop pose animation
    if (this.poseTween) {
      this.poseTween.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'influencer_selfie', 0.4);
    
    // Selfie stick flying
    this.setVelocity(60, -120);
    
    this.scene.tweens.add({
      targets: this,
      angle: 45,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.poseTween) {
      this.poseTween.destroy();
    }
    super.destroy(fromScene);
  }
}
