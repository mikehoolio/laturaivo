import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * SomaliSkier - Friendly Somali-Finnish skier on the trail
 * Fast skier, enthusiastic about skiing, non-aggressive obstacle
 */
export class SomaliSkier extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "somali_skier_ski_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 120; // Fast enthusiastic skier
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 40;
    this.health = this.maxHealth;
    this.scoreValue = 100;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation (+/- 10%)
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 128 * sizeVariation, 0.4, 0.9);
    
    // Apply random color tint - bright sporty colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play ski animation
    this.playAnimation("somali_skier_ski_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint for visual diversity
  getRandomColorTint(): number {
    const sportyColors = [
      0xffffff, // White (no tint - original orange/blue)
      0xfff8f8, // Very light (keeps original colors)
      0xf8f8ff, // Light blue tint
      0xfff8e8, // Warm tint
      0xf0fff0, // Light green tint
      0xfff0f8, // Light pink tint
    ];
    return Phaser.Math.RND.pick(sportyColors);
  }
  
  playAnimation(animKey: string): void {
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
    
    if (!this.isHurting) {
      // Ski enthusiastically in facing direction
      const moveDir = this.facingDirection === "left" ? -1 : 1;
      this.body.setVelocityX(moveDir * this.speed);
    }
    
    // Update flip
    this.setFlipX(this.facingDirection === "left");
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    
    // Flash white then restore original tint
    this.setTint(0xffffff);
    
    // Play hurt sound
    utils.playSoundWithVariation(this.scene, "enemy_hit", 0.3, 0.15);
    
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.isDead) {
        this.setTint(this.colorTint);
      }
    });
    
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.isHurting = false;
    });
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die(): void {
    this.isDead = true;
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'somali_skier', 0.4);
    
    // Death animation - dramatic ski wipeout
    this.setVelocity(150, -250);
    
    this.scene.tweens.add({
      targets: this,
      angle: -360,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
