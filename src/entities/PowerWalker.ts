import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * PowerWalker - Corporate executive power walking on trail
 * Doesn't dodge, walks determinedly, massive blocking obstacle
 */
export class PowerWalker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  
  public maxHealth: number;
  public health: number;
  public scoreValue: number;

  private aggressionTier: number;
  private chaseBurstUntil: number;
  private nextChaseBurstAt: number;
  private burstSpeedMultiplier: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "power_walker_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 80; // Medium-fast power walk
    this.isDead = false;
    this.isHurting = false;
    // Get difficulty multiplier from scene (espoo=0.7, vantaa=1.0, lahti=1.4)
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    this.maxHealth = Math.round(50 * difficultyMultiplier);
    this.health = this.maxHealth;
    this.scoreValue = 100;
    const currentLevel = Number((scene as any).currentLevel ?? 1);
    this.aggressionTier = Phaser.Math.Clamp(currentLevel - 4, 0, 5);
    this.chaseBurstUntil = 0;
    this.nextChaseBurstAt = 0;
    this.burstSpeedMultiplier = 1 + this.aggressionTier * 0.08;
    if (this.aggressionTier > 0) {
      this.speed = Math.round(this.speed * (1 + this.aggressionTier * 0.06));
    }
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation - taller, imposing presence
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 140 * sizeVariation, 0.5, 0.9);
    
    // Apply random color tint - corporate colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play walk animation
    this.playAnimation("power_walker_walk_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint for visual diversity
  getRandomColorTint(): number {
    const corporateColors = [
      0xffffff, // White (no tint - original)
      0xf0f0f8, // Light grey-blue (professional)
      0xf8f0e8, // Light beige/tan
      0xe8f0f8, // Light navy tint
      0xf8e8e0, // Light brown tint
      0xf0f8f0, // Light olive tint
      0xf5f5f5, // Pure grey
    ];
    return Phaser.Math.RND.pick(corporateColors);
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
      const player = (this.scene as any).player;
      if (this.aggressionTier > 0 && player && !player.isDead) {
        const distanceToPlayer = Math.abs(this.x - player.x);
        const direction = player.x < this.x ? -1 : 1;
        let chaseMultiplier = 1;

        if (distanceToPlayer < 95) {
          chaseMultiplier = 0.52;
        } else if (distanceToPlayer > 250) {
          chaseMultiplier = 1.34;
        } else if (distanceToPlayer > 160) {
          chaseMultiplier = 1.12;
        }

        if (time >= this.nextChaseBurstAt && Math.random() < 0.004 * this.aggressionTier) {
          this.chaseBurstUntil = time + 320 + this.aggressionTier * 90;
          this.nextChaseBurstAt = time + Phaser.Math.Between(1200, 2000);
        }
        if (time < this.chaseBurstUntil) {
          chaseMultiplier *= this.burstSpeedMultiplier;
        }

        this.body.setVelocityX(direction * this.speed * chaseMultiplier);
        this.facingDirection = direction > 0 ? "right" : "left";
      } else {
        // Walk determinedly in facing direction - never dodges
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
    showDeathQuote(this.scene, this.x, this.y, 'power_walker', 0.4);
    
    // Death animation - briefcase flying
    this.setVelocity(100, -150);
    
    this.scene.tweens.add({
      targets: this,
      angle: 45,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
