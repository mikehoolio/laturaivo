import Phaser from "phaser";
import * as utils from "../utils";

// Base hazard class for environmental obstacles
export abstract class Hazard extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  isTriggered: boolean;
  cooldownTime: number;
  lastTriggerTime: number;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string) {
    super(scene, x, y, key);
    
    this.isTriggered = false;
    this.cooldownTime = 1000;
    this.lastTriggerTime = 0;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    
    this.setDepth(2);
  }
  
  abstract onPlayerCollision(player: any, time: number): void;
  
  canTrigger(time: number): boolean {
    return time - this.lastTriggerTime >= this.cooldownTime;
  }
  
  trigger(time: number): void {
    this.isTriggered = true;
    this.lastTriggerTime = time;
  }
}

// Ice patch - makes player slip and lose control
export class IcePatch extends Hazard {
  slipDuration: number;
  
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, "ice_patch");
    
    this.slipDuration = 1000; // 1 second of slipping
    
    // Scale to appropriate size
    utils.initScale(this, { x: 0.5, y: 1.0 }, 200, 40);
    
    // Ice patches are semi-transparent
    this.setAlpha(0.8);
    
    this.setDepth(1);
  }
  
  onPlayerCollision(player: any, time: number): void {
    if (!this.canTrigger(time)) return;
    this.trigger(time);
    
    // Play slip sound
    this.scene.sound.play("ice_slip", { volume: 0.4 });
    
    // Apply slip effect - reduce control and random velocity changes
    player.isSlipping = true;
    
    // Random horizontal push
    const randomPush = Phaser.Math.Between(-100, 100);
    player.body.setVelocityX(player.body.velocity.x + randomPush);
    
    // End slip after duration
    this.scene.time.delayedCall(this.slipDuration, () => {
      if (player.active) {
        player.isSlipping = false;
      }
    });
  }
}

// Fallen tree - must jump over or take damage
export class FallenTree extends Hazard {
  damage: number;
  hasHit: boolean;
  
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, "fallen_tree_obstacle");
    
    this.damage = 20;
    this.hasHit = false;
    
    // Scale to appropriate size - jumpable obstacle
    utils.initScale(this, { x: 0.5, y: 1.0 }, 180, 60, 0.8, 0.9);
    
    this.setDepth(3);
  }
  
  onPlayerCollision(player: any, time: number): void {
    // Only hit if player is on ground (they should jump over)
    if (!player.isOnGround || this.hasHit) return;
    
    // Check if player is above the obstacle (successfully jumping over)
    const playerBottom = player.body.bottom;
    const obstacleTop = this.body.top;
    
    if (playerBottom > obstacleTop) {
      // Player collided with obstacle - take damage
      this.hasHit = true;
      player.takeDamage(this.damage);
      
      // Knockback
      player.body.setVelocityY(-200);
      
      // Reset hit after cooldown
      this.scene.time.delayedCall(2000, () => {
        this.hasHit = false;
      });
    }
  }
}

// Moose crossing - large obstacle that slowly crosses the trail
export class MooseCrossing extends Hazard {
  damage: number;
  crossingSpeed: number;
  hasCrossed: boolean;
  grunted: boolean;
  
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, "moose_crossing");
    
    this.damage = 30;
    this.crossingSpeed = 80;
    this.hasCrossed = false;
    this.grunted = false;
    
    // Moose - sized so player can jump over it
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 100, 0.6, 0.9);
    
    // Start off-screen at top
    this.y = groundY;
    
    // Face left (crossing from right to left)
    this.setFlipX(false);
    
    this.setDepth(5); // Hazards below enemies
    
    // Play grunt when appearing
    this.scene.time.delayedCall(500, () => {
      if (this.active && !this.grunted) {
        this.grunted = true;
        this.scene.sound.play("moose_grunt", { volume: 0.5 });
      }
    });
  }
  
  onPlayerCollision(player: any, time: number): void {
    if (!this.canTrigger(time) || player.isInvulnerable) return;
    this.trigger(time);
    
    // Moose collision is devastating!
    player.takeDamage(this.damage);
    
    // Big knockback
    player.body.setVelocityX(-300);
    player.body.setVelocityY(-250);
  }
  
  update(time: number, delta: number): void {
    // Moose slowly walks across the trail
    if (!this.hasCrossed) {
      this.x -= (this.crossingSpeed * delta) / 1000;
      
      // If off-screen left, mark as crossed
      if (this.x < -200) {
        this.hasCrossed = true;
      }
    }
  }
}
