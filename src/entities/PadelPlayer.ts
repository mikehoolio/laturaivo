import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * PadelPlayer - Sporty Finnish padel player completely out of place on ski trail
 * Quick movements, dodges sometimes, holding a padel racket
 */
export class PadelPlayer extends Phaser.Physics.Arcade.Sprite {
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
  private hopTween?: Phaser.Tweens.Tween;
  private nextHopAt: number;
  private hopIntervalMin: number;
  private hopIntervalMax: number;
  private hopHeightBase: number;
  private hopDurationMs: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "padel_player_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 90; // Athletic, quick movements
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 45;
    this.health = this.maxHealth;
    this.scoreValue = 120;
    const currentLevel = Number((scene as any).currentLevel ?? 1);
    this.aggressionTier = Phaser.Math.Clamp(currentLevel - 5, 0, 5);
    this.chaseBurstUntil = 0;
    this.nextChaseBurstAt = 0;
    this.burstSpeedMultiplier = 1 + this.aggressionTier * 0.08;
    if (this.aggressionTier > 0) {
      this.speed = Math.round(this.speed * (1 + this.aggressionTier * 0.07));
    }
    this.nextHopAt = Phaser.Math.Between(380, 860);
    this.hopIntervalMin = Math.max(260, 700 - this.aggressionTier * 70);
    this.hopIntervalMax = Math.max(this.hopIntervalMin + 140, 1080 - this.aggressionTier * 90);
    this.hopHeightBase = 18 + this.aggressionTier * 3;
    this.hopDurationMs = Math.max(115, 165 - this.aggressionTier * 8);
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation - athletic build
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 130 * sizeVariation, 0.5, 0.9);
    
    // Apply random color tint - sporty athletic wear
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Play walk animation
    this.playAnimation("padel_player_walk_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
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

        if (distanceToPlayer < 105) {
          chaseMultiplier = 0.58;
        } else if (distanceToPlayer > 260) {
          chaseMultiplier = 1.36;
        } else if (distanceToPlayer > 170) {
          chaseMultiplier = 1.14;
        }

        if (time >= this.nextChaseBurstAt && Math.random() < 0.005 * this.aggressionTier) {
          this.chaseBurstUntil = time + 280 + this.aggressionTier * 90;
          this.nextChaseBurstAt = time + Phaser.Math.Between(1000, 1800);
        }
        if (time < this.chaseBurstUntil) {
          chaseMultiplier *= this.burstSpeedMultiplier;
        }

        this.body.setVelocityX(direction * this.speed * chaseMultiplier);
        this.facingDirection = direction > 0 ? "right" : "left";
      } else {
        // Walk in facing direction with some athletic energy
        const moveDir = this.facingDirection === "left" ? -1 : 1;
        this.body.setVelocityX(moveDir * this.speed);
      }
      this.tryStartHop(time);
    } else if (this.hopTween) {
      this.stopHopTween();
    }
    
    // Update flip
    this.setFlipX(this.facingDirection === "left");
  }

  private tryStartHop(time: number): void {
    if (this.hopTween || this.isDead || this.isHurting) return;
    if (time < this.nextHopAt) return;

    const hopHeight = Phaser.Math.Clamp(this.hopHeightBase + Phaser.Math.Between(0, 10), 14, 48);
    this.nextHopAt = time + Phaser.Math.Between(this.hopIntervalMin, this.hopIntervalMax);

    this.hopTween = this.scene.tweens.add({
      targets: this,
      y: this.groundY - hopHeight,
      duration: this.hopDurationMs,
      ease: "Sine.Out",
      yoyo: true,
      onComplete: () => {
        this.y = this.groundY;
        this.hopTween = undefined;
      }
    });
  }

  private stopHopTween(): void {
    if (this.hopTween) {
      this.hopTween.stop();
      this.hopTween = undefined;
    }
    this.y = this.groundY;
    if (this.body) {
      this.body.setVelocityY(0);
    }
  }
  
  // Get random color tint - sporty padel wear colors
  getRandomColorTint(): number {
    const sportyColors = [
      0xffffff, // White (no tint)
      0xffe0e0, // Light red
      0xe0ffe0, // Light green
      0xe0e0ff, // Light blue
      0xfff0d0, // Light orange
      0xf0f0f0, // Light gray
    ];
    return Phaser.Math.RND.pick(sportyColors);
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    this.stopHopTween();
    
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
    this.stopHopTween();
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'padel_player', 0.4);
    
    // Death animation - racket flying
    this.setVelocity(120, -180);
    
    this.scene.tweens.add({
      targets: this,
      angle: 60,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }

  destroy(fromScene?: boolean): void {
    this.stopHopTween();
    super.destroy(fromScene);
  }
}
