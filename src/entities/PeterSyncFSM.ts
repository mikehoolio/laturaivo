import Phaser from "phaser";
import FSM from "phaser3-rex-plugins/plugins/fsm.js";
import type { PeterSync } from "./PeterSync";
import * as utils from "../utils";
import { LevelManager } from "../LevelManager";

// Peter Kantele boss FSM - state machine for the Ice Club Arena boss
// States: idle, gliding, jumping, spinAttacking, discoSpecial, taunting, dashing, hurting, dying

export class PeterSyncFSM extends FSM {
  scene: Phaser.Scene;
  boss: PeterSync;
  private idleEnteredAt: number = -99999;

  constructor(scene: Phaser.Scene, boss: PeterSync) {
    super({
      extend: {
        eventEmitter: new Phaser.Events.EventEmitter(),
      },
    });
    this.scene = scene;
    this.boss = boss;
    
    // Start in idle state
    this.goto("idle");
  }

  private playSceneSound(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    utils.playManagedSound(this.scene, key, {
      volume: config?.volume,
      rate: config?.rate,
      detune: config?.detune,
      pitchVariation: 0,
      detuneVariation: 0
    });
  }

  // Check death condition
  checkDeath(): boolean {
    if (this.boss.health <= 0 && !this.boss.isDead) {
      this.boss.health = 0;
      this.boss.isDead = true;
      this.goto("dying");
      return true;
    }
    return false;
  }

  // Get player reference
  getPlayer(): any {
    const gameScene = this.scene as any;
    return gameScene.player;
  }

  // ========== IDLE STATE ==========
  enter_idle() {
    this.idleEnteredAt = this.scene.time.now;
    this.boss.setVelocityX(0);
    this.boss.isGliding = false;
    this.boss.isSpinning = false;
    this.boss.isDashing = false;
    this.boss.isTaunting = false;
    this.boss.isJumping = false;
    this.boss.playAnimation("peter_sync_idle_anim");
    
    // Brief pause before next action
    this.scene.time.delayedCall(120, () => {
      if (this.state !== "idle") return;
      if (!this.boss.isDead && !this.boss.isAttacking && !this.boss.isHurting) {
        this.chooseNextAction();
      }
    });
  }

  update_idle(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);

    // Prevent long idle stalls if delayed callbacks are missed.
    if (
      time - this.idleEnteredAt >= 380 &&
      !this.boss.isChasePaused(time) &&
      !this.boss.isAttacking &&
      !this.boss.isHurting
    ) {
      this.chooseNextAction();
    }
  }
  
  // Choose next action based on attack pattern
  chooseNextAction(): void {
    if (this.boss.isDead || this.boss.isHurting) return;
    if (this.boss.isChasePaused(this.scene.time.now)) {
      this.goto("idle");
      return;
    }
    
    const player = this.getPlayer();
    if (!player || player.isDead) {
      this.goto("gliding");
      return;
    }
    
    const distanceToPlayer = Math.abs(this.boss.x - player.x);

    // In phase 2+, occasionally force signature special if ready.
    if (
      this.boss.currentPhase >= 2 &&
      this.boss.canAttack &&
      this.boss.canUseSpecialAttackNow(this.scene.time.now) &&
      Math.random() < (this.boss.isEnraged ? 0.34 : 0.24)
    ) {
      this.goto("discoSpecial");
      return;
    }
    
    // If player is very close, still use phase-pattern logic to avoid repetitive spam.
    if (distanceToPlayer < 240 && this.boss.canAttack) {
      const closeRangeAction = this.boss.getNextAttackType();
      if (closeRangeAction === "dash") {
        this.goto("dashing");
      } else if (closeRangeAction === "jump") {
        this.goto("jumping");
      } else {
        // Default close-range punish.
        this.goto("spinAttacking");
      }
      return;
    }
    
    // Get next action from pattern
    const nextAction = this.boss.getNextAttackType();
    
    switch (nextAction) {
      case "spin":
        if (distanceToPlayer < 250) {
          this.goto("spinAttacking");
        } else {
          this.goto("gliding");
        }
        break;
      case "jump":
        this.goto("jumping");
        break;
      case "taunt":
        this.goto("taunting");
        break;
      case "dash":
        this.goto("dashing");
        break;
      case "special":
        this.goto("discoSpecial");
        break;
      case "glide":
      default:
        this.goto("gliding");
        break;
    }
  }

  // ========== GLIDING STATE ==========
  // Fast walking toward player
  enter_gliding() {
    this.boss.isGliding = true;
    this.boss.playAnimation("peter_sync_glide_anim");
    this.boss.glideSound?.play();
  }

  update_gliding(time: number, delta: number) {
    if (this.checkDeath()) return;

    const player = this.getPlayer();
    if (!player || player.isDead) {
      this.goto("idle");
      return;
    }
    if (this.boss.isChasePaused(time)) {
      this.boss.setVelocityX(0);
      this.goto("idle");
      return;
    }

    // Face and glide toward player
    const directionToPlayer = player.x < this.boss.x ? -1 : 1;
    this.boss.facingDirection = directionToPlayer < 0 ? "left" : "right";
    this.boss.setFlipX(this.boss.facingDirection === "left");
    
    const distanceToPlayer = Math.abs(this.boss.x - player.x);
    
    // Glide speed
    const speed = this.boss.isEnraged ? this.boss.glideSpeed * 1.3 : this.boss.glideSpeed;
    this.boss.setVelocityX(directionToPlayer * speed);

    // Check if close enough to attack
    if (distanceToPlayer < 260 && this.boss.canAttack) {
      // Random chance to spin attack or continue pattern
      if (Math.random() < 0.55) {
        this.goto("spinAttacking");
      } else {
        this.chooseNextAction();
      }
      return;
    }

    // Keep pressure up even outside immediate melee range.
    if (distanceToPlayer < 420 && this.boss.canAttack && Math.random() < 0.02) {
      this.chooseNextAction();
      return;
    }
    
    // Occasionally change tactics
    if (Math.random() < 0.012) {
      this.chooseNextAction();
    }
  }
  
  exit_gliding() {
    this.boss.isGliding = false;
  }

  // ========== JUMPING STATE ==========
  // High jump with stylish pose, landing creates shockwave
  enter_jumping() {
    this.boss.isJumping = true;
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    
    // Face player
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.setFlipX(this.boss.facingDirection === "left");
    }
    
    this.boss.playAnimation("peter_sync_jump_anim");
    
    // Jump up!
    this.boss.body.setAllowGravity(true);
    this.boss.body.setGravityY(800);
    this.boss.body.setVelocityY(-this.boss.jumpPower);
    
    // Move toward player while jumping
    const dirX = this.boss.facingDirection === "left" ? -1 : 1;
    this.boss.setVelocityX(dirX * this.boss.speed * 0.8);
  }

  update_jumping(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Check if landed
    if (this.boss.y >= this.boss.groundY && this.boss.body.velocity.y > 0) {
      this.performJumpLanding();
    }
  }
  
  performJumpLanding(): void {
    // Stop and land
    this.boss.y = this.boss.groundY;
    this.boss.body.setVelocity(0, 0);
    this.boss.body.setAllowGravity(false);
    this.boss.isJumping = false;
    
    // Play shockwave sound
    this.boss.shockwaveLandingSound?.play();
    
    // Create ice shockwave effect
    const shockwave = this.scene.add.image(this.boss.x, this.boss.groundY, "ice_shockwave_effect");
    utils.initScale(shockwave, { x: 0.5, y: 1.0 }, undefined, 80);
    shockwave.setDepth(50);
    shockwave.setAlpha(0.9);
    
    this.scene.tweens.add({
      targets: shockwave,
      scaleX: 2.5,
      scaleY: 1.2,
      alpha: 0,
      duration: 600,
      onComplete: () => shockwave.destroy()
    });
    
    // Screen shake
    this.scene.cameras.main.shake(300, 0.015);
    
    // Deal damage to nearby player
    const player = this.getPlayer();
    if (player && player.canProcessBossAttack?.()) {
      const dist = Math.abs(this.boss.x - player.x);
      if (dist < 160) {
        player.takeDamage(this.boss.jumpShockwaveDamage, { source: "boss" });
      }
    }
    
    // Recovery
    this.scene.time.delayedCall(400, () => {
      this.boss.isAttacking = false;
      this.scene.time.delayedCall(this.boss.attackCooldown, () => {
        this.boss.canAttack = true;
      });
      this.goto("idle");
    });
  }
  
  exit_jumping() {
    this.boss.isJumping = false;
    this.boss.body.setAllowGravity(false);
  }

  // ========== SPIN ATTACKING STATE ==========
  // Rapid ski pole attack with damage radius
  enter_spinAttacking() {
    this.boss.isSpinning = true;
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setVelocityX(0);
    
    // Face player
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.setFlipX(this.boss.facingDirection === "left");
    }
    
    this.boss.playAnimation("peter_sync_spin_attack_anim");
    this.boss.spinAttackSound?.play();
    this.boss.currentMeleeTargets.clear();
    
    // Show sparkle effect
    const sparkle = this.scene.add.image(this.boss.x, this.boss.y - this.boss.displayHeight / 2, "sparkle_spin_effect");
    utils.initScale(sparkle, { x: 0.5, y: 0.5 }, undefined, 150);
    sparkle.setDepth(this.boss.depth + 1);
    
    // Rotate sparkle
    this.scene.tweens.add({
      targets: sparkle,
      angle: 360,
      alpha: { from: 0.8, to: 0 },
      scale: { from: sparkle.scale, to: sparkle.scale * 1.5 },
      duration: 400,
      onComplete: () => sparkle.destroy()
    });
    
    // Screen shake
    this.scene.cameras.main.shake(150, 0.01);
    
    // Deal damage to player if in range
    if (player && player.canProcessBossAttack?.()) {
      const dist = Phaser.Math.Distance.Between(
        this.boss.x, this.boss.y - this.boss.displayHeight / 2,
        player.x, player.body.center.y
      );
      if (dist < 150) {
        player.takeDamage(this.boss.spinDamage, { source: "boss" });
      }
    }
    
    // Animation complete handler
    this.boss.once("animationcomplete-peter_sync_spin_attack_anim", () => {
      this.boss.isSpinning = false;
      this.boss.isAttacking = false;
      this.boss.currentMeleeTargets.clear();
      
      const cooldown = this.boss.isEnraged ? this.boss.attackCooldown * 0.6 : this.boss.attackCooldown;
      this.scene.time.delayedCall(cooldown, () => {
        this.boss.canAttack = true;
      });
      
      this.goto("idle");
    });
  }

  update_spinAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }
  
  exit_spinAttacking() {
    this.boss.isSpinning = false;
  }

  // ========== DISCO SPECIAL STATE ==========
  // Pattern-driven signature attack with explicit recovery window.
  enter_discoSpecial() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setVelocityX(0);

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.setFlipX(this.boss.facingDirection === "left");
    }

    const triggered = this.boss.performEnrageSpecialAttack("pattern");
    if (!triggered) {
      this.boss.isAttacking = false;
      this.boss.canAttack = true;
      this.goto("dashing");
      return;
    }

    this.scene.time.delayedCall(1180, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      if (this.state !== "discoSpecial") return;
      this.boss.isAttacking = false;
      const cooldown = this.boss.attackCooldown * (this.boss.isEnraged ? 0.8 : 1.12);
      this.scene.time.delayedCall(cooldown, () => {
        if (!this.scene.sys.isActive() || !this.boss.active) return;
        this.boss.canAttack = true;
      });
      this.goto("idle");
    });
  }

  update_discoSpecial(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }
  
  // ========== TAUNTING STATE ==========
  // Dramatic 90s boyband pose that distracts
  enter_taunting() {
    this.boss.isTaunting = true;
    this.boss.setVelocityX(0);
    
    this.boss.playAnimation("peter_sync_taunt_anim");
    this.boss.tauntSound?.play();
    
    // Show taunt text
    this.boss.showTaunt(this.boss.getRandomTaunt(), 2000);
    
    // Spotlight effect - briefly flash screen
    this.scene.cameras.main.flash(200, 255, 0, 255, true);
    
    // Animation complete
    this.boss.once("animationcomplete-peter_sync_taunt_anim", () => {
      this.boss.isTaunting = false;
      this.goto("idle");
    });
  }

  update_taunting(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }
  
  exit_taunting() {
    this.boss.isTaunting = false;
  }

  // ========== DASHING STATE ==========
  // Backstage Slide - very fast horizontal dash with afterimages
  enter_dashing() {
    this.boss.isDashing = true;
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    
    // Determine dash direction toward player
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.setFlipX(this.boss.facingDirection === "left");
    }
    
    this.boss.playAnimation("peter_sync_dash_anim");
    this.boss.dashSound?.play();
    
    // Cyan tint during dash
    this.boss.setTint(0x00ffff);
    
    // Dash velocity
    const dashDir = this.boss.facingDirection === "left" ? -1 : 1;
    this.boss.setVelocityX(dashDir * this.boss.dashSpeed);
    
    // Create afterimages during dash
    const afterimageTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => this.boss.createAfterimage(),
      repeat: 5
    });
    
    // Screen shake
    this.scene.cameras.main.shake(100, 0.008);
    
    // Dash lasts 300ms
    this.scene.time.delayedCall(300, () => {
      afterimageTimer.destroy();
      this.boss.setVelocityX(0);
      
      // Restore tint
      if (this.boss.isEnraged) {
        this.boss.setTint(0xff00ff);
      } else {
        this.boss.clearTint();
      }
      
      // Check if we hit player during dash
      const player = this.getPlayer();
      if (player && player.canProcessBossAttack?.()) {
        const dist = Math.abs(this.boss.x - player.x);
        if (dist < 80) {
          player.takeDamage(this.boss.dashDamage, { source: "boss" });
        }
      }
      
      this.boss.isDashing = false;
      this.boss.isAttacking = false;
      
      const cooldown = this.boss.attackCooldown * 1.2;
      this.scene.time.delayedCall(cooldown, () => {
        this.boss.canAttack = true;
      });
      
      this.goto("idle");
    });
  }

  update_dashing(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Keep on ground during dash
    this.boss.y = this.boss.groundY;
  }
  
  exit_dashing() {
    this.boss.isDashing = false;
    if (!this.boss.isEnraged) {
      this.boss.clearTint();
    }
  }

  // ========== HURTING STATE ==========
  enter_hurting() {
    this.boss.isHurting = true;
    this.boss.setVelocityX(0);
    
    // Flash white
    this.boss.setTint(0xffffff);
    
    this.playSceneSound("enemy_hit", { volume: 0.4 });
    
    // Show hurt taunt
    this.boss.tryShowHurtTaunt();
    
    // Short hurt stun
    this.scene.time.delayedCall(150, () => {
      this.boss.isHurting = false;
      
      // Restore tint
      if (this.boss.isEnraged) {
        this.boss.setTint(0xff00ff);
      } else {
        this.boss.clearTint();
      }
      
      if (!this.boss.isDead) {
        // After being hit, immediately counter-attack!
        if (this.boss.canAttack && Math.random() < 0.25) {
          this.goto("spinAttacking");
        } else {
          this.goto("gliding");
        }
      }
    });
  }

  update_hurting(time: number, delta: number) {
    this.boss.setVelocityX(0);
  }

  // ========== DYING STATE ==========
  enter_dying() {
    this.boss.isDead = true;
    this.boss.setVelocityX(0);
    this.boss.body.setAllowGravity(false);

    const gameScene = this.scene as any;
    const isFinalBoss = LevelManager.isLastLevel(Number(gameScene?.currentLevel ?? 0));
    if (typeof gameScene.playBossDeathFinale === "function") {
      gameScene.playBossDeathFinale(this.boss, {
        bossType: "peter_sync",
        isFinalBoss,
        scoreValue: this.boss.scoreValue,
        finalLine: "THE MUSIC... STOPS..."
      });
      return;
    }

    // Fallback path if cinematic helper is unavailable.
    this.scene.events.emit("bossDefeated", {
      bossType: "peter_sync",
      isFinalBoss,
      scoreValue: this.boss.scoreValue
    });
    if (gameScene.currentBoss === this.boss) {
      gameScene.currentBoss = undefined;
    }
    this.boss.destroy();
  }

  update_dying(time: number, delta: number) {
    // No update during death
  }
}
