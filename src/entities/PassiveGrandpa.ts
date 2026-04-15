import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * PassiveGrandpa - Elderly person who won't move out of the way
 * Stands still, stares judgmentally, has a slowing aura
 * Symbolizes "Back in my day..." attitude
 */
export class PassiveGrandpa extends Phaser.Physics.Arcade.Sprite {
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
  
  // Slowing aura effect
  public slowAuraRadius: number = 100;
  private auraGraphics?: Phaser.GameObjects.Graphics;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "passive_grandpa_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 10; // Extremely slow, barely moving
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 70;
    this.health = this.maxHealth;
    this.scoreValue = 80;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - elderly person, slightly hunched
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 115, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start walk animation (very slow shuffle)
    this.playAnimation("passive_grandpa_walk_anim");
    
    // Create slowing aura visual
    this.createSlowAura();
  }
  
  createSlowAura(): void {
    this.auraGraphics = this.scene.add.graphics();
    this.auraGraphics.setAlpha(0.2);
    this.updateAuraPosition();
  }
  
  updateAuraPosition(): void {
    if (!this.auraGraphics || !this.active) return;
    
    this.auraGraphics.clear();
    this.auraGraphics.fillStyle(0x8888ff, 0.15);
    this.auraGraphics.fillCircle(this.x, this.y - this.displayHeight / 2, this.slowAuraRadius);
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
    
    // Barely move - just shuffle slowly
    this.body.setVelocityX(-this.speed);
    
    // Update aura position
    this.updateAuraPosition();
  }
  
  // Check if player is in slowing aura range
  isPlayerInAura(playerX: number, playerY: number): boolean {
    const dx = this.x - playerX;
    const dy = (this.y - this.displayHeight / 2) - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.slowAuraRadius;
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
    
    // Clean up aura
    if (this.auraGraphics) {
      this.auraGraphics.destroy();
    }
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'passive_grandpa', 0.4);
    
    // Death animation - slow fall
    this.setVelocity(50, -100);
    
    this.scene.tweens.add({
      targets: this,
      angle: -45,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  destroy(fromScene?: boolean): void {
    if (this.auraGraphics) {
      this.auraGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
