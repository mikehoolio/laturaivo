import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * YachtOwner - Rich yacht owner in summer clothes in winter
 * Shivering but pretending to be fine
 */
export class YachtOwner extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Shiver effect
  public shiverTimer?: Phaser.Time.TimerEvent;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "yacht_owner");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 35;
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 45;
    this.health = this.maxHealth;
    this.scoreValue = 110;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 115, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start shivering effect
    this.startShivering();
  }
  
  startShivering(): void {
    // Shiver from cold
    this.shiverTimer = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (this.isDead) return;
        this.x += Phaser.Math.Between(-2, 2);
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
    
    if (this.shiverTimer) {
      this.shiverTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'yacht_owner', 0.4);
    
    // Captain hat flying off
    this.setVelocity(60, -130);
    
    this.scene.tweens.add({
      targets: this,
      angle: -45,
      alpha: 0,
      duration: 550,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.shiverTimer) {
      this.shiverTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
