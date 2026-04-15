import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * DrunkPerson - Staggering person who may suddenly attack
 * Moves erratically and can cause stun damage on hit
 */
export class DrunkPerson extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  public facingDirection: Direction;
  public speed: number;
  public groundY: number;
  
  public isDead: boolean;
  public isHurting: boolean;
  public isAttacking: boolean;
  public canAttack: boolean;
  public attackCooldown: number;
  public lastAttackTime: number;
  
  public maxHealth: number;
  public health: number;
  public damage: number;
  public scoreValue: number;
  public stunDuration: number;
  
  // Attack trigger
  public meleeTrigger: Phaser.GameObjects.Zone;
  public currentMeleeTargets: Set<any>;
  
  // Stagger timer
  public staggerTimer?: Phaser.Time.TimerEvent;
  public staggerDirection: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "drunk_stagger_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 50; // Slow but erratic
    this.isDead = false;
    this.isHurting = false;
    this.isAttacking = false;
    this.canAttack = true;
    this.attackCooldown = 3000;
    this.lastAttackTime = 0;
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    // Balance lock: DrunkPerson health is always fixed at 30 regardless of difficulty.
    this.maxHealth = 30;
    this.health = this.maxHealth;
    this.damage = Math.round(20 * difficultyMultiplier);
    this.scoreValue = 150;
    this.stunDuration = 500; // Stun duration on player when hit
    this.staggerDirection = 1;
    this.currentMeleeTargets = new Set();
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 128 * sizeVariation, 0.4, 0.8);
    
    // Apply random color tint - disheveled winter clothing colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Create attack trigger
    this.meleeTrigger = utils.createTrigger(this.scene, this, 0, 0, 80, 60);
    
    // Add melee trigger to scene's enemyMeleeTriggers group
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }
    
    // Play stagger animation
    this.playAnimation("drunk_stagger_anim");
    
    // Start stagger behavior
    this.startStaggering();
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  playAnimation(animKey: string): void {
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }
  
  startStaggering(): void {
    // Change stagger direction randomly every 0.5-1.5 seconds
    this.staggerTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(500, 1500),
      callback: () => {
        if (this.isDead || this.isAttacking) return;
        
        // Randomly change direction or stay
        const rand = Math.random();
        if (rand < 0.3) {
          this.staggerDirection = -1; // Move back
        } else if (rand < 0.6) {
          this.staggerDirection = 1; // Move forward
        } else {
          this.staggerDirection = 0; // Stumble in place
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
    
    // Update attack trigger position
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, 80, 60);
    
    if (!this.isAttacking && !this.isHurting) {
      // Erratic staggering movement
      const baseVelocity = this.facingDirection === "left" ? -this.speed : this.speed;
      const staggerVelocity = baseVelocity * this.staggerDirection;
      
      // Add some vertical wobble
      const wobble = Math.sin(time * 0.01) * 20;
      
      this.body.setVelocityX(staggerVelocity + wobble);
      
      // Check if should attack (random chance when player is nearby)
      if (this.canAttack && Math.random() < 0.005) {
        this.tryAttack(time);
      }
    }
    
    // Update flip
    this.setFlipX(this.facingDirection === "left");
  }
  
  tryAttack(time: number): void {
    if (!this.canAttack || this.isDead || time - this.lastAttackTime < this.attackCooldown) return;
    
    this.isAttacking = true;
    this.canAttack = false;
    this.lastAttackTime = time;
    this.currentMeleeTargets.clear();
    
    this.playAnimation("drunk_attack_anim");
    
    this.once("animationcomplete-drunk_attack_anim", () => {
      this.isAttacking = false;
      this.currentMeleeTargets.clear();
      this.playAnimation("drunk_stagger_anim");
      
      // Reset attack cooldown
      this.scene.time.delayedCall(this.attackCooldown, () => {
        this.canAttack = true;
      });
    });
  }
  
  // Get random color tint - worn winter jacket colors
  getRandomColorTint(): number {
    const wornColors = [
      0xffffff, // White (no tint)
      0xe8dcd0, // Faded brown
      0xd8e0d8, // Faded green
      0xe0d8d8, // Faded red
      0xd8d8e0, // Faded blue
      0xe8e0d8, // Tan
    ];
    return Phaser.Math.RND.pick(wornColors);
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
    
    // Stop timers
    if (this.staggerTimer) {
      this.staggerTimer.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'drunk_person', 0.4);
    
    // Death animation - collapse
    this.setVelocity(0, 0);
    
    this.scene.tweens.add({
      targets: this,
      angle: 90,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.staggerTimer) {
      this.staggerTimer.destroy();
    }
    
    // Clean up melee trigger
    if (this.meleeTrigger && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene && gameScene.enemyMeleeTriggers) {
        gameScene.enemyMeleeTriggers.remove(this.meleeTrigger, true, true);
      }
      if (this.meleeTrigger.active) {
        this.meleeTrigger.destroy();
      }
    }
    
    super.destroy(fromScene);
  }
}
