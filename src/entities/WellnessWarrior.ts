import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * WellnessWarrior - Holistic wellness influencer giving unsolicited life advice
 * Walks slowly, blocks trail to share wisdom, passive-aggressive
 * Symbolizes superiority complex
 */
export class WellnessWarrior extends Phaser.Physics.Arcade.Sprite {
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
  
  // Wellness quotes for comedic effect
  public wellnessQuotes: string[] = [
    '"Have you tried yoga?"',
    '"Your energy is so blocked!"',
    '"I only eat organic snow"',
    '"Namaste your way out"',
    '"My chakras are aligned"',
    '"This trail needs sage"',
  ];
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "wellness_warrior_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 20; // Slow, mindful walking pace
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 55;
    this.health = this.maxHealth;
    this.scoreValue = 110;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - tall person
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 125, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start walk animation
    this.playAnimation("wellness_warrior_walk_anim");
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
    
    // Walk slowly, mindfully
    this.body.setVelocityX(-this.speed);
    
    // Occasionally do a "zen" pose (stop briefly)
    if (Math.random() < 0.001) {
      this.body.setVelocityX(0);
      this.scene.time.delayedCall(500, () => {
        if (this.active && !this.isDead) {
          this.body.setVelocityX(-this.speed);
        }
      });
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
    this.stop();
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'wellness_warrior', 0.4);
    
    // Graceful fall - yoga mat flying
    this.setVelocity(70, -130);
    
    this.scene.tweens.add({
      targets: this,
      angle: -60,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
