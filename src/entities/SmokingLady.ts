import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * SmokingLady - Middle-aged Finnish woman smoking and gossiping on trail
 * Walks slowly, occasionally stops to talk/smoke, low threat obstacle
 */
export class SmokingLady extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  public isTalking: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Talk/smoke timer
  public talkTimer: number;
  public talkDuration: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "smoking_lady_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 40; // Very slow walking, busy talking
    this.isDead = false;
    this.isHurting = false;
    this.isTalking = false;
    this.maxHealth = 30;
    this.health = this.maxHealth;
    this.scoreValue = 80;
    
    // Talk timer - randomly stops to gossip
    this.talkTimer = Phaser.Math.Between(1000, 3000);
    this.talkDuration = 0;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation - slightly shorter and wider build
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 120 * sizeVariation, 0.6, 0.9);
    
    // Apply random color tint - middle-aged Finnish lady winter fashion
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play walk animation
    this.playAnimation("smoking_lady_walk_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
    
    // Play cough sound occasionally
    this.scheduleCough();
  }
  
  scheduleCough(): void {
    if (!this.scene) return;
    
    this.scene.time.delayedCall(Phaser.Math.Between(3000, 8000), () => {
      if (!this.isDead && this.scene) {
        this.scene.sound.play("smoking_cough", { volume: 0.35 });
        this.scheduleCough();
      }
    });
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
    
    // Update talk timer
    this.talkTimer -= delta;
    
    if (this.isTalking) {
      // Stand still while talking
      this.body.setVelocityX(0);
      this.talkDuration -= delta;
      
      if (this.talkDuration <= 0) {
        this.isTalking = false;
        this.talkTimer = Phaser.Math.Between(2000, 5000);
        this.playAnimation("smoking_lady_walk_anim");
      }
    } else {
      if (this.talkTimer <= 0) {
        // Start talking/smoking break
        this.isTalking = true;
        this.talkDuration = Phaser.Math.Between(1000, 2000);
        // Could add idle animation here if we had one
      } else if (!this.isHurting) {
        // Walk slowly
        const moveDir = this.facingDirection === "left" ? -1 : 1;
        this.body.setVelocityX(moveDir * this.speed);
      }
    }
    
    // Update flip
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint - Finnish middle-aged lady winter fashion
  getRandomColorTint(): number {
    const ladyColors = [
      0xffffff, // White (no tint)
      0xffe8f0, // Light pink
      0xf0e0f8, // Light purple/lilac
      0xfff8e0, // Light beige
      0xe8f0ff, // Light blue
      0xf8e8e8, // Dusty rose
    ];
    return Phaser.Math.RND.pick(ladyColors);
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    this.isTalking = false;
    
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
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'smoking_lady', 0.4);
    
    // Death animation - cigarette flying
    this.setVelocity(80, -120);
    
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
}
