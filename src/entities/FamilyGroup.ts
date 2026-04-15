import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * FamilyGroup - A slow-moving family (adult + child) that blocks the trail
 * Non-aggressive obstacle that walks slowly and stops unpredictably
 */
export class FamilyGroup extends Phaser.GameObjects.Container {
  public adult: Phaser.GameObjects.Sprite;
  public child: Phaser.GameObjects.Sprite;
  public adultBody: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  public maxHealth: number;
  public health: number;
  public scoreValue: number;
  
  // Unpredictable stop behavior
  public isStoppedTimer?: Phaser.Time.TimerEvent;
  public isStopped: boolean;
  
  // Visual diversity
  public adultColorTint: number;
  public childColorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y);
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 30; // Very slow walking speed
    this.isDead = false;
    this.isHurting = false;
    // Get difficulty multiplier from scene (espoo=0.7, vantaa=1.0, lahti=1.4)
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    this.maxHealth = Math.round(30 * difficultyMultiplier);
    this.health = this.maxHealth;
    this.scoreValue = 50;
    this.isStopped = false;
    
    // Get random color tints for visual diversity
    this.adultColorTint = this.getRandomColorTint();
    this.childColorTint = this.getRandomColorTint();
    
    // Add to scene
    scene.add.existing(this);
    
    // Create adult sprite with random size variation
    const adultSizeVariation = 0.9 + Math.random() * 0.2;
    this.adult = scene.add.sprite(0, 0, "family_adult_walk_R_frame1");
    utils.initScale(this.adult, { x: 0.5, y: 1.0 }, undefined, 120 * adultSizeVariation, 0.4, 0.9);
    this.adult.setTint(this.adultColorTint);
    this.add(this.adult);
    
    // Create child sprite with random size variation (positioned next to adult)
    const childSizeVariation = 0.85 + Math.random() * 0.3;
    this.child = scene.add.sprite(-40, 0, "family_child_walk_R_frame1");
    utils.initScale(this.child, { x: 0.5, y: 1.0 }, undefined, 70 * childSizeVariation, 0.4, 0.9);
    this.child.setTint(this.childColorTint);
    this.add(this.child);
    
    // Enable physics on container
    scene.physics.add.existing(this);
    this.adultBody = this.body as Phaser.Physics.Arcade.Body;
    this.adultBody.setSize(80, 100);
    this.adultBody.setOffset(-40, -100);
    
    // Play walk animations with a hard guard to avoid startup crashes if frames are missing.
    try {
      if (scene.anims.exists("family_adult_walk_anim")) {
        this.adult.play("family_adult_walk_anim");
      }
      if (scene.anims.exists("family_child_walk_anim")) {
        this.child.play("family_child_walk_anim");
      }
    } catch (error) {
      console.debug("[FamilyGroup] animation play failed, using static frames", error);
    }
    
    // Set facing direction
    this.setFlip();
    
    // Start random stopping behavior
    this.scheduleRandomStop();
  }
  
  setFlip(): void {
    this.adult.setFlipX(this.facingDirection === "left");
    this.child.setFlipX(this.facingDirection === "left");
    
    // Reposition child based on facing direction
    this.child.x = this.facingDirection === "left" ? 40 : -40;
  }
  
  scheduleRandomStop(): void {
    // Safety check - ensure scene exists
    if (!this.scene || !this.active) return;
    
    // Randomly stop for 1-3 seconds every 2-5 seconds
    const delay = Phaser.Math.Between(2000, 5000);
    
    this.isStoppedTimer = this.scene.time.delayedCall(delay, () => {
      // Safety check - ensure scene and object still exist
      if (this.isDead || !this.scene || !this.active) return;
      
      this.isStopped = true;
      
      // Resume after a random duration
      const stopDuration = Phaser.Math.Between(1000, 3000);
      this.scene.time.delayedCall(stopDuration, () => {
        // Safety check before recursive call
        if (!this.isDead && this.scene && this.active) {
          this.isStopped = false;
          this.scheduleRandomStop();
        }
      });
    });
  }
  
  update(time: number, delta: number): void {
    if (!this.active || this.isDead) return;
    
    // Keep at ground level
    if (this.y > this.groundY) {
      this.y = this.groundY;
    }
    
    // Move if not stopped
    if (!this.isStopped && !this.isHurting) {
      const moveDir = this.facingDirection === "left" ? -1 : 1;
      this.adultBody.setVelocityX(moveDir * this.speed);
    } else {
      this.adultBody.setVelocityX(0);
    }
    
    // Update flip
    this.setFlip();
  }
  
  // Get random color tint - family winter clothing colors
  getRandomColorTint(): number {
    const familyColors = [
      0xffffff, // White (no tint)
      0xffe8e8, // Light pink/red
      0xe8e8ff, // Light blue
      0xfff8e0, // Light yellow
      0xe8fff8, // Light mint
      0xf8e8f8, // Light purple
      0xf0f0f0, // Light gray
    ];
    return Phaser.Math.RND.pick(familyColors);
  }
  
  takeDamage(damage: number): void {
    if (this.isDead || !this.scene) return;
    
    this.health -= damage;
    this.isHurting = true;
    
    // Flash white effect
    this.adult.setTint(0xffffff);
    this.child.setTint(0xffffff);
    
    this.scene.time.delayedCall(100, () => {
      // Safety check - ensure object still exists
      if (!this.scene || !this.active) return;
      // Restore original color tints
      this.adult.setTint(this.adultColorTint);
      this.child.setTint(this.childColorTint);
      this.isHurting = false;
    });
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die(): void {
    this.isDead = true;
    
    // Stop timers
    if (this.isStoppedTimer) {
      this.isStoppedTimer.destroy();
    }
    
    // Safety check - ensure scene exists
    if (!this.scene) {
      this.destroy();
      return;
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'family_group', 0.4);
    
    // Death effect - fly away
    this.scene.tweens.add({
      targets: [this.adult, this.child],
      y: -100,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  // Velocity methods to match Physics.Arcade.Sprite interface
  // Required for compatibility with collision handlers
  setVelocityX(velocity: number): this {
    if (this.adultBody) {
      this.adultBody.setVelocityX(velocity);
    }
    return this;
  }
  
  setVelocityY(velocity: number): this {
    if (this.adultBody) {
      this.adultBody.setVelocityY(velocity);
    }
    return this;
  }
  
  setVelocity(x: number, y?: number): this {
    if (this.adultBody) {
      this.adultBody.setVelocity(x, y);
    }
    return this;
  }
  
  destroy(fromScene?: boolean): void {
    if (this.isStoppedTimer) {
      this.isStoppedTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
