import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * BrunchLady - Wealthy lady in brunch outfit with mimosa
 * Stumbles in high heels on snow
 */
export class BrunchLady extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Stumble effect
  public stumbleTimer?: Phaser.Time.TimerEvent;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "brunch_lady");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 20; // Very slow in heels
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 40;
    this.health = this.maxHealth;
    this.scoreValue = 90;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 115, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start stumbling effect
    this.startStumbling();
  }
  
  startStumbling(): void {
    // Stumble like walking in heels on ice
    this.stumbleTimer = this.scene.time.addEvent({
      delay: 400,
      callback: () => {
        if (this.isDead) return;
        this.angle = Phaser.Math.Between(-5, 5);
      },
      loop: true
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
    
    if (this.stumbleTimer) {
      this.stumbleTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'brunch_lady', 0.4);
    
    // Mimosa flying
    this.setVelocity(40, -100);
    
    this.scene.tweens.add({
      targets: this,
      angle: -30,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.stumbleTimer) {
      this.stumbleTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
