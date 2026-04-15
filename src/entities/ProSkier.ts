import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * ProSkier - Fast, aggressive professional skier
 * Extremely fast, does body checks, difficult to outrun
 */
export class ProSkier extends Phaser.Physics.Arcade.Sprite {
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
  
  // Attack trigger
  public meleeTrigger: Phaser.GameObjects.Zone;
  public currentMeleeTargets: Set<any>;
  
  // Aggressive behavior
  public isCharging: boolean;
  public chargeSpeed: number;
  
  // Visual diversity
  public colorTint: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "pro_skier_ski_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 350; // VERY fast
    this.chargeSpeed = 500; // Even faster when charging
    this.isDead = false;
    this.isHurting = false;
    this.isAttacking = false;
    this.isCharging = false;
    this.canAttack = true;
    this.attackCooldown = 2000;
    this.lastAttackTime = 0;
    // Get difficulty multiplier from scene (espoo=0.7, vantaa=1.0, lahti=1.4)
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    this.maxHealth = Math.round(80 * difficultyMultiplier);
    this.health = this.maxHealth;
    this.damage = Math.round(30 * difficultyMultiplier);
    this.scoreValue = 300;
    this.currentMeleeTargets = new Set();
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size with random variation (+/- 10%)
    const sizeVariation = 0.9 + Math.random() * 0.2;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 128 * sizeVariation, 0.5, 0.9);
    
    // Apply random color tint - pro skiers have sporty neon colors
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);
    
    // Create attack trigger - larger for body check
    this.meleeTrigger = utils.createTrigger(this.scene, this, 0, 0, 100, 80);
    
    // Add melee trigger to scene's enemyMeleeTriggers group
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }
    
    // Play ski animation
    this.playAnimation("pro_skier_ski_anim");
    
    // Set facing
    this.setFlipX(this.facingDirection === "left");
  }
  
  // Get random color tint for visual diversity
  getRandomColorTint(): number {
    const sportyColors = [
      0xffffff, // White (no tint - original neon)
      0xfff0f0, // Light red tint
      0xf0f0ff, // Light blue tint
      0xf0fff0, // Light green tint
      0xfffff0, // Light yellow tint
      0xfff0ff, // Light magenta tint
      0xf0ffff, // Light cyan tint
      0xffe8d0, // Gold/orange tint
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
    
    // Update attack trigger position
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, 100, 80);
    
    if (!this.isHurting) {
      // Get player position for tracking
      const gameScene = this.scene as any;
      const player = gameScene.player;
      
      if (player && !player.isDead) {
        // Calculate distance to player
        const distToPlayer = this.x - player.x;
        
        // Move toward player aggressively
        let currentSpeed = this.speed;
        
        // If close to player, try to attack
        if (Math.abs(distToPlayer) < 150 && this.canAttack) {
          this.tryAttack(time);
          currentSpeed = this.chargeSpeed;
        }
        
        // Always move toward player (left since player is on left)
        if (!this.isAttacking) {
          const moveDir = distToPlayer > 0 ? -1 : 1;
          this.body.setVelocityX(moveDir * currentSpeed);
          this.facingDirection = moveDir > 0 ? "right" : "left";
        }
      } else {
        // Just ski forward
        const moveDir = this.facingDirection === "left" ? -1 : 1;
        this.body.setVelocityX(moveDir * this.speed);
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
    
    this.playAnimation("pro_skier_attack_anim");
    
    // Play attack sound
    utils.playManagedSound(this.scene, "pole_strike", { volume: 0.3 });
    
    this.once("animationcomplete-pro_skier_attack_anim", () => {
      this.isAttacking = false;
      this.currentMeleeTargets.clear();
      this.playAnimation("pro_skier_ski_anim");
      
      // Reset attack cooldown
      this.scene.time.delayedCall(this.attackCooldown, () => {
        this.canAttack = true;
      });
    });
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
    showDeathQuote(this.scene, this.x, this.y, 'pro_skier', 0.4);
    
    // Death animation - dramatic fall
    this.setVelocity(200, -200);
    
    this.scene.tweens.add({
      targets: this,
      angle: -180,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
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
