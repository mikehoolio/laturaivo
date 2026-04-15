import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * GolfCartDriver - Entitled person driving golf cart on ski trail
 * Larger hitbox, moves slowly (stuck in snow)
 */
export class GolfCartDriver extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  public contactDamage: number;
  
  // Stuck in snow wobble
  private stuckTween?: Phaser.Tweens.Tween;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "golf_cart_driver");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 25; // Very slow, stuck in snow
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 100; // Vehicle = more HP
    this.health = this.maxHealth;
    this.scoreValue = 200;
    this.contactDamage = 20;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Vehicle-scale sprite with tighter collider to avoid phantom hits.
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 84, 0.72, 0.45);
    
    // Set facing left
    this.setFlipX(true);
    
    // Keep cart anchored to trail; gravity + tween caused jittering.
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    
    // Start stuck in snow animation
    this.startStuckAnimation();
  }
  
  startStuckAnimation(): void {
    // Wobble like stuck in snow without moving the body vertically.
    this.stuckTween = this.scene.tweens.add({
      targets: this,
      angle: { from: -1.8, to: 1.8 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  update(time: number, delta: number): void {
    if (!this.active || this.isDead || !this.scene) return;
    
    this.y = this.groundY;
    this.body.setVelocityY(0);
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
    
    // Stop stuck animation
    if (this.stuckTween) {
      this.stuckTween.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'golf_cart_driver', 0.4);
    
    // Cart crash animation
    this.scene.sound.play("tesla_crash", { volume: 0.4 });
    
    this.scene.tweens.add({
      targets: this,
      angle: -20,
      y: this.y + 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.stuckTween) {
      this.stuckTween.destroy();
    }
    super.destroy(fromScene);
  }
}
