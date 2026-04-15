import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * PrivateSchoolSUV - Range Rover blocking ski trail
 * Large obstacle, similar to Tesla but slower and more annoying
 */
export class PrivateSchoolSUV extends Phaser.Physics.Arcade.Sprite {
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
  
  // Idle engine rumble animation
  private rumbleTween?: Phaser.Tweens.Tween;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "private_school_suv");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 40; // Slow SUV on ski trail
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 150; // Big vehicle
    this.health = this.maxHealth;
    this.scoreValue = 250;
    this.contactDamage = 25;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Keep SUV readable but compact enough for stable collisions.
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 96, 0.7, 0.45);
    
    // Set facing left
    this.setFlipX(true);
    
    // Vehicle physics should stay glued to ground without gravity jitter.
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    
    // Start engine rumble animation
    this.startRumbleAnimation();
  }
  
  startRumbleAnimation(): void {
    // Subtle engine rumble without shifting the hitbox up/down.
    this.rumbleTween = this.scene.tweens.add({
      targets: this,
      angle: { from: -0.8, to: 0.8 },
      duration: 140,
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
    
    // Stop rumble animation
    if (this.rumbleTween) {
      this.rumbleTween.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'private_school_suv', 0.4);
    
    // SUV crash animation
    this.scene.sound.play("tesla_crash", { volume: 0.5 });
    
    this.scene.tweens.add({
      targets: this,
      angle: -15,
      y: this.y + 20,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.rumbleTween) {
      this.rumbleTween.destroy();
    }
    super.destroy(fromScene);
  }
}
