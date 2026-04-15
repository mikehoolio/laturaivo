import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * HeadphoneWalker - Oblivious person with headphones
 * Wanders unpredictably across the trail, completely unaware of surroundings
 */
export class HeadphoneWalker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Wandering behavior
  public wanderTimer?: Phaser.Time.TimerEvent;
  public wanderDirection: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "headphone_walker_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 40; // Slow wandering
    this.isDead = false;
    this.isHurting = false;
    // Get difficulty multiplier from scene (espoo=0.7, vantaa=1.0, lahti=1.4)
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    this.maxHealth = Math.round(40 * difficultyMultiplier);
    this.health = this.maxHealth;
    this.scoreValue = 75;
    this.wanderDirection = 0;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 120 * sizeVariation, 0.4, 0.9);
    
    // Apply random color tint - casual modern colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play walk animation
    this.playAnimation("headphone_walker_walk_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
    
    // Start wandering behavior
    this.startWandering();
  }
  
  playAnimation(animKey: string): void {
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }
  
  startWandering(): void {
    // Change wander direction every 1-3 seconds
    this.wanderTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(1000, 3000),
      callback: () => {
        if (this.isDead) return;
        
        // Randomly change wandering pattern
        const rand = Math.random();
        if (rand < 0.4) {
          this.wanderDirection = -1; // Move left across trail
        } else if (rand < 0.8) {
          this.wanderDirection = 1; // Move right across trail
        } else {
          this.wanderDirection = 0; // Stand still (looking at phone)
        }
        
        // Random facing direction change
        if (Math.random() < 0.3) {
          this.facingDirection = this.facingDirection === "left" ? "right" : "left";
        }
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
    
    if (!this.isHurting) {
      // Wander across trail unpredictably
      this.body.setVelocityX(this.wanderDirection * this.speed);
    }
    
    // Update flip based on facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint - casual modern hoodie/jacket colors
  getRandomColorTint(): number {
    const casualColors = [
      0xffffff, // White (no tint)
      0xffe0e0, // Light pink
      0xe0e0ff, // Light purple
      0xfff0d0, // Cream
      0xe0fff0, // Mint
      0xf0e0f0, // Lavender
      0xe8e8e8, // Light gray
    ];
    return Phaser.Math.RND.pick(casualColors);
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
      // Restore original color tint
      this.setTint(this.colorTint);
      this.isHurting = false;
    });
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die(): void {
    this.isDead = true;
    
    // Stop wandering
    if (this.wanderTimer) {
      this.wanderTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'headphone_walker', 0.4);
    
    // Death animation - phone flying
    this.setVelocity(80, -120);
    
    this.scene.tweens.add({
      targets: this,
      angle: -60,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.wanderTimer) {
      this.wanderTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
