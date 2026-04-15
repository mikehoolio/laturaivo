import Phaser from "phaser";
import * as utils from "../utils";

type Direction = "left" | "right";

// Chihuahua enemy - a tiny dog running across the ski trail with a dragging leash
// The leash acts as a tripwire that can trip the player
export class Chihuahua extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  // Character attributes
  facingDirection: Direction;
  walkSpeed: number;
  groundY: number;
  
  // State flags
  isDead: boolean;
  isHurting: boolean;
  
  // Health system
  maxHealth: number;
  health: number;
  scoreValue: number;
  
  // Leash system
  leashLine?: Phaser.GameObjects.Image;
  leashLength: number;
  leashTriggered: boolean;
  tripDamage: number;
  
  // Sound
  barkTimer?: Phaser.Time.TimerEvent;
  nextHopAt: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "chihuahua_dog");
    
    this.groundY = groundY;
    
    // Add to scene and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize attributes
    this.facingDirection = "left";
    this.walkSpeed = 60; // Small dog runs quickly
    
    // Initialize state
    this.isDead = false;
    this.isHurting = false;
    
    // Initialize health (small dog = low health)
    this.maxHealth = 10;
    this.health = this.maxHealth;
    this.scoreValue = 100;
    
    // Leash configuration - leash drags behind the chihuahua
    this.leashLength = 150; // Shorter leash dragging behind
    this.leashTriggered = false;
    this.tripDamage = 10;
    this.nextHopAt = 0;
    
    // Set gravity
    this.body.setGravityY(1000);
    
    // Chihuahua is tiny - about 50px tall
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 50, 0.8, 0.8);
    
    // Set facing left
    this.setFlipX(true);
    
    // Create the trailing leash
    this.createLeash();
    
    // Periodic dog barking
    this.barkTimer = scene.time.addEvent({
      delay: 2500,
      callback: () => this.bark(),
      loop: true
    });
    
    this.setDepth(10);
    this.scheduleNextHop(0);
  }

  private scheduleNextHop(referenceTime: number): void {
    this.nextHopAt = referenceTime + Phaser.Math.Between(800, 1500);
  }
  
  createLeash(): void {
    // Create leash line dragging behind the chihuahua (to the right, since chihuahua faces left)
    this.leashLine = this.scene.add.image(
      this.x + this.leashLength / 2,
      this.groundY - 15, // Low to the ground
      "dog_leash_line"
    );
    
    utils.initScale(this.leashLine, { x: 0.0, y: 0.5 }, this.leashLength, 8);
    this.leashLine.setDepth(9);
    
    // Add physics to leash for collision detection - use dynamic body for proper overlap detection
    this.scene.physics.add.existing(this.leashLine, false);
    const leashBody = this.leashLine.body as Phaser.Physics.Arcade.Body;
    if (leashBody) {
      leashBody.setAllowGravity(false);
      leashBody.setImmovable(true);
      // Set proper hitbox size for the leash
      leashBody.setSize(this.leashLength, 20);
    }
  }
  
  bark(): void {
    if (this.isDead || !this.active) return;
    this.scene.sound.play("dog_bark", { volume: 0.3 });
  }
  
  // Called when player touches the leash
  tripPlayer(player: any): void {
    if (this.leashTriggered || player.isInvulnerable || player.isDead) return;
    
    this.leashTriggered = true;
    
    // Trip the player!
    player.takeDamage(this.tripDamage);
    
    // Make player stumble
    player.body.setVelocityY(-150);
    
    // Snap the leash (visual effect)
    if (this.leashLine) {
      this.scene.tweens.add({
        targets: this.leashLine,
        alpha: 0,
        scaleY: 0,
        duration: 200,
        onComplete: () => {
          if (this.leashLine) {
            this.leashLine.destroy();
            this.leashLine = undefined;
          }
        }
      });
    }
    
    // Chihuahua runs away faster after leash snaps
    this.walkSpeed = 120;
    this.bark();
  }
  
  takeDamage(damage: number): void {
    if (this.isDead) return;
    
    this.health -= damage;
    this.isHurting = true;
    
    // Flash white
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    
    utils.playSoundWithVariation(this.scene, "enemy_hit", 0.3, 0.15);
    
    if (this.health <= 0) {
      this.die();
    } else {
      this.scene.time.delayedCall(200, () => {
        if (this.active) this.isHurting = false;
      });
    }
  }
  
  die(): void {
    this.isDead = true;
    
    // Stop bark timer
    if (this.barkTimer) {
      this.barkTimer.destroy();
    }
    
    // Destroy leash
    if (this.leashLine) {
      this.leashLine.destroy();
      this.leashLine = undefined;
    }
    
    // Death animation - chihuahua yelps and disappears
    this.scene.sound.play("dog_bark", { volume: 0.4 });
    
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 30,
      duration: 300,
      onComplete: () => {
        this.destroy();
      }
    });
  }
  
  update(time: number, delta: number): void {
    if (this.isDead || !this.active) return;
    
    // Update ground state
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }

    const onGround = this.body.blocked.down || this.y >= this.groundY - 1;
    if (!this.isHurting && onGround && time >= this.nextHopAt) {
      this.body.setVelocityY(-Phaser.Math.Between(180, 250));
      this.scheduleNextHop(time);
    }
    
    // Update leash position - drags behind the chihuahua
    if (this.leashLine && this.leashLine.active) {
      this.leashLine.x = this.x + this.leashLength / 2;
      this.leashLine.y = this.groundY - 15;
    }
  }
  
  destroy(fromScene?: boolean): void {
    if (this.barkTimer) {
      this.barkTimer.destroy();
    }
    if (this.leashLine) {
      this.leashLine.destroy();
    }
    super.destroy(fromScene);
  }
}
