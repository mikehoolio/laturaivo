import Phaser from "phaser";
import * as utils from "../utils";
import { showDeathQuote } from "../utils";

type Direction = "left" | "right";

/**
 * BluetoothBomber - Multicultural person loudly video calling on speakerphone
 * Walks slowly while blocking the trail, completely oblivious
 * Symbolizes privatization of public space
 */
export class BluetoothBomber extends Phaser.Physics.Arcade.Sprite {
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
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "bluetooth_bomber_walk_R_frame1");
    
    this.groundY = groundY;
    this.facingDirection = "left";
    this.speed = 25; // Very slow, distracted by video call
    this.isDead = false;
    this.isHurting = false;
    this.maxHealth = 60;
    this.health = this.maxHealth;
    this.scoreValue = 120;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize size - normal person height
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 120, 0.4, 0.9);
    
    // Set facing left
    this.setFlipX(true);
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Start walk animation
    this.playAnimation("bluetooth_bomber_walk_anim");
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
    
    // Walk slowly left
    this.body.setVelocityX(-this.speed);
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
    
    // Show death quote (comeback quote)
    showDeathQuote(this.scene, this.x, this.y, 'bluetooth_bomber', 0.4);
    
    // Death animation - phone flying
    this.setVelocity(80, -150);
    
    this.scene.tweens.add({
      targets: this,
      angle: -90,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
