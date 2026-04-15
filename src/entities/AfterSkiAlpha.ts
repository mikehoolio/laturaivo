import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * AfterSkiAlpha - Macho athletic show-off on ski trail
 * Skis fast and dangerously, overtaking and showing off
 * Symbolizes "Look at me!" attention seeking behavior
 */
export class AfterSkiAlpha extends Phaser.Physics.Arcade.Sprite {
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
  
  // Speed rush behavior
  private isRushing: boolean = false;
  private rushCooldown: number = 0;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "after_ski_alpha_ski_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 60; // Fast skier
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 80;
    this.health = this.maxHealth;
    this.scoreValue = 150;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - athletic build, slightly taller
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 130, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start ski animation
    this.playAnimation("after_ski_alpha_ski_anim");
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
    
    // Update rush cooldown
    this.rushCooldown -= delta;
    
    // Randomly do speed rush (overtaking behavior)
    if (!this.isRushing && this.rushCooldown <= 0 && Math.random() < 0.01) {
      this.startSpeedRush();
    }
    
    // Move at current speed
    const currentSpeed = this.isRushing ? this.speed * 2.5 : this.speed;
    this.body.setVelocityX(-currentSpeed);
  }
  
  startSpeedRush(): void {
    this.isRushing = true;
    this.rushCooldown = 3000; // 3 seconds between rushes
    
    // Visual effect - lean forward
    this.scene.tweens.add({
      targets: this,
      angle: -15,
      duration: 200,
      yoyo: true,
      hold: 500,
      onComplete: () => {
        this.angle = 0;
        this.isRushing = false;
      }
    });
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    this.isRushing = false;
    
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
    showDeathQuote(this.scene, this.x, this.y, 'after_ski_alpha', 0.4);
    
    // Dramatic fall - skiing crash
    this.setVelocity(100, -200);
    
    this.scene.tweens.add({
      targets: this,
      angle: 360,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
