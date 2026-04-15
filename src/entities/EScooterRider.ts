import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * EScooterRider - Absurd person riding e-scooter on ski trail
 * Moves erratically, scooter struggling in snow
 */
export class EScooterRider extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Wobble effect
  public wobbleTimer?: Phaser.Time.TimerEvent;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "escooter_rider");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 60; // Trying to go fast but failing
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 30; // Easy to knock off
    this.health = this.maxHealth;
    this.scoreValue = 120;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 100, 0.5, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start wobbling effect
    this.startWobble();
  }
  
  startWobble(): void {
    // Wobble back and forth like struggling in snow
    this.wobbleTimer = this.scene.time.addEvent({
      delay: 200,
      callback: () => {
        if (this.isDead) return;
        this.angle = Phaser.Math.Between(-8, 8);
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
    
    if (this.wobbleTimer) {
      this.wobbleTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'escooter_rider', 0.4);
    
    // Scooter crash animation
    this.setVelocity(100, -180);
    
    this.scene.tweens.add({
      targets: this,
      angle: 180,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.wobbleTimer) {
      this.wobbleTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
