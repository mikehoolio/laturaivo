import Phaser from "phaser";
import FSM from "phaser3-rex-plugins/plugins/fsm.js";
import type { Enemy } from "./Enemy";
import * as utils from "../utils";

type EnemyAttackState = "attacking" | "lunge_attacking" | "jump_attacking" | "feint_attacking";

// Custom FSM class for managing enemy states
export class EnemyFSM extends FSM {
  gameScene: Phaser.Scene;
  enemy: Enemy;
  private stateTimers: Phaser.Time.TimerEvent[] = [];
  private attackCooldownTimer?: Phaser.Time.TimerEvent;
  private nextManeuverAt: number = 0;
  private stateNonce: number = 0;
  private disposed: boolean = false;

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    super({
      extend: {
        eventEmitter: new Phaser.Events.EventEmitter(),
      },
    });
    this.gameScene = scene;
    this.enemy = enemy;
    
    // Use goto to trigger enter_state function
    this.goto("skiing");
  }

  // Getter for scene (for backwards compatibility and convenience)
  get scene(): Phaser.Scene {
    return this.gameScene;
  }

  private trackStateTimer(timer: Phaser.Time.TimerEvent): void {
    this.stateTimers.push(timer);
  }

  private clearStateTimers(): void {
    for (const timer of this.stateTimers) {
      if (timer && !timer.hasDispatched) timer.destroy();
    }
    this.stateTimers = [];
  }

  private runAfter(delayMs: number, cb: () => void): void {
    const timer = this.scene.time.delayedCall(delayMs, () => {
      if (!this.canControlEnemy()) return;
      cb();
    });
    this.trackStateTimer(timer);
  }

  private beginState(): number {
    if (this.disposed) return this.stateNonce;
    this.clearStateTimers();
    this.stateNonce += 1;
    this.enemy.currentMeleeTargets.clear();
    this.enemy.resetAttackTriggerProfile();
    return this.stateNonce;
  }

  private isSceneActive(): boolean {
    const sceneSys = (this.scene as any)?.sys;
    if (!sceneSys || typeof sceneSys.isActive !== "function") return true;
    return sceneSys.isActive();
  }

  private canControlEnemy(): boolean {
    if (this.disposed) return false;
    if (!this.enemy || !this.enemy.active) return false;
    if (!(this.enemy as any).body) return false;
    return this.isSceneActive();
  }

  private scheduleAttackCooldown(multiplier: number = 1): void {
    this.enemy.canAttack = false;
    if (this.attackCooldownTimer) {
      this.attackCooldownTimer.destroy();
      this.attackCooldownTimer = undefined;
    }
    const cooldown = Phaser.Math.Clamp(
      Math.floor(this.enemy.attackCooldown * multiplier),
      500,
      3600
    );
    this.attackCooldownTimer = this.scene.time.delayedCall(cooldown, () => {
      if (this.disposed) return;
      this.enemy.canAttack = true;
      this.attackCooldownTimer = undefined;
    });
  }

  private finishAttackState(): void {
    if (!this.canControlEnemy() || this.enemy.isDead) return;
    this.enemy.isAttacking = false;
    this.enemy.currentMeleeTargets.clear();
    this.enemy.resetAttackTriggerProfile();
    this.enemy.setVelocityX(0);
    this.goto("skiing");
  }

  private facingDirectionToPlayer(player: any): number {
    if (player.x < this.enemy.x) {
      this.enemy.facingDirection = "left";
      return -1;
    }
    this.enemy.facingDirection = "right";
    return 1;
  }

  private getCombatProfile(): any {
    return (this.enemy as any).__combatProfile;
  }

  private pickAttackState(horizontalDistance: number): EnemyAttackState {
    const profile = this.getCombatProfile();
    const feintBias = Phaser.Math.Clamp(Number(profile?.feintChance ?? 0), 0, 0.55);
    const roll = Math.random();
    if (horizontalDistance < 78) {
      if (roll < 0.18 - feintBias * 0.2) return "attacking";
      if (roll < 0.54 - feintBias * 0.15) return "lunge_attacking";
      if (roll < 0.77 + feintBias * 0.35) return "feint_attacking";
      return "jump_attacking";
    }
    if (roll < 0.15 - feintBias * 0.15) return "attacking";
    if (roll < 0.52 - feintBias * 0.1) return "lunge_attacking";
    if (roll < 0.79 - feintBias * 0.2) return "jump_attacking";
    return "feint_attacking";
  }

  private maybeDoEvasiveHop(time: number, horizontalDistance: number): boolean {
    if (time < this.nextManeuverAt) return false;
    if (horizontalDistance < 110 || horizontalDistance > 260) return false;
    const profile = this.getCombatProfile();
    const evadeChance = Phaser.Math.Clamp(Number(profile?.evadeChance ?? 0.02), 0.01, 0.45);
    if (Math.random() > evadeChance * 0.6) return false;
    this.nextManeuverAt = time + Phaser.Math.Between(900, 1600);
    this.goto("hop_moving");
    return true;
  }

  // Check death
  checkDeath(): boolean {
    if (!this.canControlEnemy()) return false;
    if (this.enemy.health <= 0 && !this.enemy.isDead) {
      this.enemy.health = 0;
      this.enemy.isDead = true;
      this.goto("dying");
      return true;
    }
    return false;
  }

  // Skiing state - aggressively chasing and attacking player
  enter_skiing() {
    this.beginState();
    if (!this.canControlEnemy()) return;
    this.enemy.isAttacking = false;
    this.enemy.isHurting = false;
    this.enemy.setVelocityY(0);
    this.enemy.playAnimation("enemy_ski_walk_anim");
  }

  update_skiing(time: number, delta: number) {
    if (!this.canControlEnemy()) return;
    if (this.checkDeath()) return;

    const player = (this.scene as any).player;
    if (!player || player.isDead) return;

    // Calculate horizontal distance to player (ignore Y for side-scroller)
    const horizontalDistance = Math.abs(this.enemy.x - player.x);

    // Update facing direction toward player
    this.facingDirectionToPlayer(player);
    this.enemy.setFlipX(this.enemy.facingDirection === "left");

    // If close enough and can attack, switch to attacking
    // Increased range + weighted attack variety for less static combat.
    if (horizontalDistance < 145 && this.enemy.canAttack) {
      this.goto(this.pickAttackState(horizontalDistance));
      return;
    }

    // Short reposition hops make perusvihut less linear even without new sprites.
    if (this.maybeDoEvasiveHop(time, horizontalDistance)) {
      return;
    }

    // Always chase player aggressively
    // Enemies need to overcome scrolling speed to catch up
    const direction = player.x < this.enemy.x ? -1 : 1;
    
    // Move faster when far away, slow down when close
    let chaseSpeed = this.enemy.speed * (1 + Math.sin((time + this.enemy.x) * 0.01) * 0.08);
    if (horizontalDistance < 80) {
      // Close - slow down to position for attack
      chaseSpeed = this.enemy.speed * 0.46;
    } else if (horizontalDistance > 200) {
      // Far away - sprint to catch up!
      chaseSpeed = this.enemy.speed * 1.36;
    }
    
    this.enemy.setVelocityX(direction * chaseSpeed);
  }

  // Attacking state
  enter_attacking() {
    const nonce = this.beginState();
    this.enemy.isAttacking = true;
    this.scheduleAttackCooldown(1.0);
    this.enemy.setVelocityX(0);
    this.enemy.setAttackTriggerProfile(90, 62);
    this.enemy.playAnimation("enemy_attack_anim");
    this.enemy.attackSound?.play();
    
    // Try to show attack taunt with wobbling speech bubble!
    this.enemy.tryShowAttackTaunt();

    // Return to skiing after animation completes
    let finished = false;
    const finalize = () => {
      if (finished) return;
      if (nonce !== this.stateNonce) return;
      finished = true;
      this.finishAttackState();
    };
    this.enemy.once("animationcomplete-enemy_attack_anim", () => {
      finalize();
    });
    this.runAfter(340, finalize);
  }

  update_attacking(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  enter_lunge_attacking() {
    this.beginState();
    this.enemy.isAttacking = true;
    this.scheduleAttackCooldown(0.9);
    this.enemy.setAttackTriggerProfile(130, 74);
    this.enemy.playAnimation("enemy_attack_anim");
    this.enemy.attackSound?.play();
    this.enemy.tryShowAttackTaunt();

    const direction = this.enemy.facingDirection === "left" ? -1 : 1;
    this.enemy.setVelocityX(direction * this.enemy.speed * 0.6);

    this.runAfter(120, () => {
      if (!this.enemy.active || this.enemy.isDead) return;
      this.enemy.setVelocityX(direction * this.enemy.speed * 3.4);
    });

    this.runAfter(300, () => {
      if (!this.enemy.active || this.enemy.isDead) return;
      this.enemy.setVelocityX(direction * this.enemy.speed * 1.2);
    });

    this.runAfter(470, () => {
      this.finishAttackState();
    });
  }

  update_lunge_attacking(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  enter_jump_attacking() {
    this.beginState();
    this.enemy.isAttacking = false;
    this.scheduleAttackCooldown(0.95);
    this.enemy.setAttackTriggerProfile(104, 94);
    this.enemy.playAnimation("enemy_attack_anim");
    this.enemy.attackSound?.play();

    const direction = this.enemy.facingDirection === "left" ? -1 : 1;
    const jumpHeight = Phaser.Math.Between(54, 76);
    const baseY = this.enemy.groundY;

    this.enemy.setVelocityX(direction * this.enemy.speed * 1.9);
    this.scene.tweens.add({
      targets: this.enemy,
      y: baseY - jumpHeight,
      duration: 160,
      ease: "Sine.Out",
      yoyo: true,
      hold: 90,
      onComplete: () => {
        if (!this.enemy.active || this.enemy.isDead) return;
        this.enemy.y = baseY;
      }
    });

    this.runAfter(90, () => {
      if (!this.enemy.active || this.enemy.isDead) return;
      this.enemy.isAttacking = true;
      this.enemy.currentMeleeTargets.clear();
    });

    this.runAfter(240, () => {
      if (!this.enemy.active || this.enemy.isDead) return;
      this.enemy.setVelocityX(direction * this.enemy.speed * 2.6);
    });

    this.runAfter(620, () => {
      this.finishAttackState();
    });
  }

  update_jump_attacking(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  enter_feint_attacking() {
    this.beginState();
    this.enemy.isAttacking = false;
    this.scheduleAttackCooldown(0.82);
    this.enemy.setAttackTriggerProfile(84, 56);
    this.enemy.playAnimation("enemy_attack_anim");
    this.enemy.tryShowAttackTaunt();

    const initialDirection = this.enemy.facingDirection === "left" ? -1 : 1;
    this.enemy.setVelocityX(0);

    this.runAfter(110, () => {
      if (!this.enemy.active || this.enemy.isDead) return;
      this.enemy.playAnimation("enemy_ski_walk_anim");
      this.enemy.setVelocityX(-initialDirection * this.enemy.speed * 1.1);
    });

    this.runAfter(260, () => {
      if (!this.enemy.active || this.enemy.isDead) return;

      const player = (this.scene as any).player;
      if (!player || player.isDead) {
        this.finishAttackState();
        return;
      }

      const direction = this.facingDirectionToPlayer(player);
      const distance = Math.abs(this.enemy.x - player.x);
      if (distance < 180) {
        this.enemy.isAttacking = true;
        this.enemy.currentMeleeTargets.clear();
        this.enemy.setAttackTriggerProfile(114, 66);
        this.enemy.playAnimation("enemy_attack_anim");
        this.enemy.attackSound?.play();
        this.enemy.setVelocityX(direction * this.enemy.speed * 2.8);
      } else {
        this.enemy.setVelocityX(-direction * this.enemy.speed * 1.4);
      }
    });

    this.runAfter(560, () => {
      this.finishAttackState();
    });
  }

  update_feint_attacking(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  enter_hop_moving() {
    this.beginState();
    this.enemy.isAttacking = false;
    this.enemy.playAnimation("enemy_ski_walk_anim");

    const direction = this.enemy.facingDirection === "left" ? -1 : 1;
    const hopHeight = Phaser.Math.Between(28, 42);
    const baseY = this.enemy.groundY;
    this.enemy.setVelocityX(-direction * this.enemy.speed * 1.3);

    this.scene.tweens.add({
      targets: this.enemy,
      y: baseY - hopHeight,
      duration: 120,
      ease: "Sine.Out",
      yoyo: true,
      onComplete: () => {
        if (!this.enemy.active || this.enemy.isDead) return;
        this.enemy.y = baseY;
      }
    });

    this.runAfter(280, () => {
      if (this.enemy.isDead) return;
      this.goto("skiing");
    });
  }

  update_hop_moving(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  // Hurt state
  enter_hurting() {
    this.beginState();
    this.enemy.isHurting = true;
    this.enemy.isAttacking = false;
    this.enemy.setVelocityX(0);
    this.enemy.hitSound?.play();
    
    // Try to show hurt taunt with wobbling speech bubble!
    this.enemy.tryShowHurtTaunt();
    
    // Flash white, then restore original tint
    this.enemy.setTint(0xffffff);
    this.runAfter(80, () => {
      if (this.enemy.active && !this.enemy.isDead) {
        // Restore original color tint
        this.enemy.setTint(this.enemy.colorTint);
      }
    });

    // Short stun then return to skiing
    this.runAfter(200, () => {
      if (!this.enemy.isDead) {
        this.enemy.isHurting = false;
        this.goto("skiing");
      }
    });
  }

  update_hurting(time: number, delta: number) {
    if (this.checkDeath()) return;
  }

  // Dying state - enemy flies into snowbank with dramatic effect!
  enter_dying() {
    this.clearStateTimers();
    if (this.attackCooldownTimer) {
      this.attackCooldownTimer.destroy();
      this.attackCooldownTimer = undefined;
    }
    this.enemy.isAttacking = false;
    this.enemy.resetAttackTriggerProfile();

    // Launch enemy into the air with spin!
    const launchDirection = this.enemy.facingDirection === "left" ? 1 : -1;
    this.enemy.setVelocityX(launchDirection * 400); // Fly sideways
    this.enemy.setVelocityY(-350); // Launch into air
    
    // Disable gravity briefly for dramatic arc
    this.enemy.body.setGravityY(800);
    
    this.enemy.playAnimation("enemy_die_anim");
    
    // Spin the enemy as they fly!
    this.scene.tweens.add({
      targets: this.enemy,
      angle: launchDirection * 360 * 2, // 2 full rotations
      duration: 800,
      ease: "Power1"
    });
    
    // ========== ESPOO DOUCHE DEATH QUOTES ==========
    // Reduced by 50% to cut text spam.
    if (Math.random() < 0.15) {
      this.showDeathQuote();
    }
    
    // Create snow particle burst
    this.createSnowBurst();

    // Remove enemy after death animation
    this.enemy.once("animationcomplete-enemy_die_anim", () => {
      // Create landing snow puff
      this.createSnowPuff();
      
      // Disable physics body and make inactive
      this.enemy.body.enable = false;
      this.enemy.setActive(false);
      
      // Fade out and destroy
      this.scene.tweens.add({
        targets: this.enemy,
        alpha: 0,
        y: this.enemy.y + 20, // Sink into snow
        duration: 400,
        onComplete: () => {
          this.enemy.destroy();
        }
      });
    });
  }
  
  // Create snow particle burst when enemy is hit
  createSnowBurst(): void {
    for (let i = 0; i < 8; i++) {
      const particle = this.scene.add.circle(
        this.enemy.x + Phaser.Math.Between(-20, 20),
        this.enemy.y - 40,
        Phaser.Math.Between(4, 10),
        0xFFFFFF,
        1
      );
      particle.setDepth(1000);
      
      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-80, 80),
        y: particle.y + Phaser.Math.Between(-60, 30),
        alpha: 0,
        duration: Phaser.Math.Between(400, 700),
        ease: "Power2",
        onComplete: () => particle.destroy()
      });
    }
  }
  
  // Create snow puff when enemy lands
  createSnowPuff(): void {
    for (let i = 0; i < 5; i++) {
      const puff = this.scene.add.circle(
        this.enemy.x + Phaser.Math.Between(-30, 30),
        this.enemy.y,
        Phaser.Math.Between(8, 15),
        0xE0E8F0,
        0.8
      );
      puff.setDepth(999);
      
      this.scene.tweens.add({
        targets: puff,
        y: puff.y - Phaser.Math.Between(20, 50),
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 500,
        ease: "Power2",
        onComplete: () => puff.destroy()
      });
    }
  }
  
  // ========== ESPOO DOUCHE DEATH QUOTES ==========
  // Show funny death quote when enemy dies using utils function
  showDeathQuote(): void {
    utils.showDeathQuote(this.scene, this.enemy.x, this.enemy.y, 'enemy', 0.35);
  }

  update_dying(time: number, delta: number) {
    // No updates needed while dying
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearStateTimers();
    if (this.attackCooldownTimer) {
      this.attackCooldownTimer.destroy();
      this.attackCooldownTimer = undefined;
    }
  }
}
