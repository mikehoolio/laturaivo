import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * RealEstateAgent - Pushy agent showing house listings on tablet
 * Blocks trail for sales pitch
 */
export class RealEstateAgent extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Sales pitch phrases
  public phrases: string[] = [
    '"GREAT location!"',
    '"Just 1.2M euros!"',
    '"Sea view potential!"',
    '"Investors LOVE it!"',
    '"Price is negotiable!"',
  ];
  
  // Pushy gesture animation
  private pushyTween?: Phaser.Tweens.Tween;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "real_estate_agent");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 25; // Slow, trying to stop people
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 55;
    this.health = this.maxHealth;
    this.scoreValue = 130;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 118, 0.45, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start pushy animation
    this.startPushyAnimation();
  }
  
  startPushyAnimation(): void {
    // Lean forward pushy sales pitch animation
    this.pushyTween = this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.02,
      angle: { from: 0, to: -5 },
      duration: 600,
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
    
    // Stop pushy animation
    if (this.pushyTween) {
      this.pushyTween.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'real_estate_agent', 0.4);
    
    // Tablet flying
    this.setVelocity(70, -110);
    
    this.scene.tweens.add({
      targets: this,
      angle: 30,
      alpha: 0,
      duration: 550,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.pushyTween) {
      this.pushyTween.destroy();
    }
    super.destroy(fromScene);
  }
}
