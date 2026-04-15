import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * CityCyclist - Urban cyclist accidentally riding on ski trail
 * Moves erratically with sudden direction changes
 * Symbolizes city vs nature confusion
 */
export class CityCyclist extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Animation tracking
  private currentAnim: string = "";
  
  // Erratic movement behavior
  private directionChangeTimer: number = 0;
  private verticalOffset: number = 0;
  private targetVerticalOffset: number = 0;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "city_cyclist_ride_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 45; // Medium speed cyclist
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 65;
    this.health = this.maxHealth;
    this.scoreValue = 130;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - person on bike, taller than normal
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 140, 0.5, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start ride animation
    this.playAnimation("city_cyclist_ride_anim");
  }
  
  playAnimation(animKey: string): void {
    if (this.currentAnim === animKey) return;
    this.currentAnim = animKey;
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }
  
  update(time: number, delta: number): void {
    if (!this.active || this.isDead || !this.scene) return;
    
    // Keep at ground level
    if (this.y > this.groundY) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }
    
    // Update direction change timer
    this.directionChangeTimer -= delta;
    
    // Randomly change vertical movement (swerving across trail)
    if (this.directionChangeTimer <= 0) {
      this.directionChangeTimer = Phaser.Math.Between(800, 2000);
      this.targetVerticalOffset = Phaser.Math.Between(-50, 50);
      
      // Occasionally wobble the bike
      if (Math.random() < 0.3) {
        this.scene.tweens.add({
          targets: this,
          angle: Phaser.Math.Between(-10, 10),
          duration: 200,
          yoyo: true
        });
      }
    }
    
    // Smooth vertical movement
    this.verticalOffset += (this.targetVerticalOffset - this.verticalOffset) * 0.05;
    
    // Move forward with slight vertical wobble
    this.body.setVelocityX(-this.speed);
    this.body.setVelocityY(this.verticalOffset * 0.5);
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
    this.stop();
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'city_cyclist', 0.4);
    
    // Bike crash animation
    this.setVelocity(120, -180);
    
    this.scene.tweens.add({
      targets: this,
      angle: -180,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
