import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * AsianTechWorker - Tech company worker lost on ski trail
 * Slow walker, distracted by phone, oblivious to surroundings
 * Similar to HeadphoneWalker but with distinct look
 */
export class AsianTechWorker extends Phaser.Physics.Arcade.Sprite {
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
  
  // Phone checking behavior
  public isCheckingPhone: boolean;
  public phoneCheckTimer: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "asian_tech_worker_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 45; // Slow, distracted walking
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 35;
    this.health = this.maxHealth;
    this.scoreValue = 120;
    this.isCheckingPhone = false;
    this.phoneCheckTimer = Phaser.Math.Between(1500, 3000);
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation (+/- 10%)
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 130 * sizeVariation, 0.5, 0.9);
    
    // Apply random color tint - tech startup colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play walk animation
    this.playAnimation("asian_tech_worker_walk_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint for visual diversity
  getRandomColorTint(): number {
    const techColors = [
      0xffffff, // White (no tint - original)
      0xf8f8ff, // Light blue tint (tech blue)
      0xfff8f8, // Light warmth
      0xf0f8ff, // Alice blue tint
      0xf5f5f5, // Light grey (minimalist)
      0xfff5f0, // Light cream
    ];
    return Phaser.Math.RND.pick(techColors);
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
    
    // Phone checking behavior
    this.phoneCheckTimer -= delta;
    
    if (this.isCheckingPhone) {
      // Stand still while checking phone
      this.body.setVelocityX(0);
      
      if (this.phoneCheckTimer <= 0) {
        this.isCheckingPhone = false;
        this.phoneCheckTimer = Phaser.Math.Between(2000, 4000);
      }
    } else {
      if (this.phoneCheckTimer <= 0) {
        // Start checking phone
        this.isCheckingPhone = true;
        this.phoneCheckTimer = Phaser.Math.Between(500, 1500);
      } else if (!this.isHurting) {
        // Walk slowly while occasionally looking at phone
        const moveDir = this.facingDirection === "left" ? -1 : 1;
        this.body.setVelocityX(moveDir * this.speed);
      }
    }
    
    // Update flip
    this.setFlipX(this.facingDirection === "left");
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    this.isCheckingPhone = false;
    
    // Flash white then restore original tint
    this.setTint(0xffffff);
    
    // Play hurt sound with variation
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
    showDeathQuote(this.scene, this.x, this.y, 'asian_tech_worker', 0.4);
    
    // Death animation - phone flying, dramatic fall
    this.setVelocity(100, -180);
    
    this.scene.tweens.add({
      targets: this,
      angle: -45,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
