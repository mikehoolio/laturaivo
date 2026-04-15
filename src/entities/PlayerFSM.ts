import Phaser from "phaser";
import FSM from "phaser3-rex-plugins/plugins/fsm.js";
import type { Player } from "./Player";
import * as utils from "../utils";

// Custom FSM class for managing player states
export class PlayerFSM extends FSM {
  gameScene: Phaser.Scene;
  player: Player;
  private activeSuperEnergyLock: number | null = null;

  constructor(scene: Phaser.Scene, player: Player) {
    super({
      extend: {
        eventEmitter: new Phaser.Events.EventEmitter(),
      },
    });
    this.gameScene = scene;
    this.player = player;
    
    // Use goto to trigger enter_state function and properly initialize the player state
    this.goto("skiing");
  }

  // Common death check method
  checkDeath(): boolean {
    // God mode - player cannot die (check both config and easter egg)
    if (this.player.isGodModeActive()) {
      // Keep health at max in god mode
      if (this.player.health < this.player.maxHealth) {
        this.player.health = this.player.maxHealth;
      }
      return false;
    }
    
    if (this.player.health <= 0 && !this.player.isDead) {
      this.player.health = 0;
      this.player.isDead = true;
      this.goto("dying");
      return true;
    }
    return false;
  }

  // Getter for scene (for backwards compatibility and convenience)
  get scene(): Phaser.Scene {
    return this.gameScene;
  }

  private consumeSuperEnergyThirtyPercent(): void {
    const superEnergyCost = Math.max(1, Math.ceil(this.player.maxEnergy * 0.3));
    const remainingEnergy = Math.max(0, this.player.energy - superEnergyCost);
    this.player.energy = remainingEnergy;
    this.activeSuperEnergyLock = remainingEnergy;
  }

  private enforceSuperEnergyLock(): void {
    if (this.activeSuperEnergyLock === null) return;
    // Keep super stamina result stable during the super animation.
    this.player.energy = Math.min(this.player.energy, this.activeSuperEnergyLock);
  }

  private clearSuperEnergyLock(): void {
    this.activeSuperEnergyLock = null;
  }

  // Skiing state (default movement state)
  enter_skiing() {
    this.clearSuperEnergyLock();
    this.player.isAttacking = false;
    this.player.clearMeleeTriggerProfile();
    this.player.playAnimation("player_ski_walk_anim");
  }

  update_skiing(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state
    this.player.updateGroundState();

    // Check for jump input (keyboard or touch)
    if (this.player.isJumpJustPressed() && this.player.isOnGround) {
      this.goto("jumping");
      return;
    }

    // Check for rage input (keyboard or touch) - ONLY if unlocked (level 3+)
    if (this.player.isRageUnlocked() && this.player.isRageJustPressed()) {
      if (this.player.isRageFull()) {
        this.goto("raging");
        return;
      }
    }

    // Quick backstep dodge (touch "VÄISTÄ" button).
    if (this.player.isDodgeJustPressed() && this.player.isDodgeReady()) {
      this.goto("dodging");
      return;
    }

    // Check for attack inputs (pole strike, axe, spin kick) with hold-to-charge supers.
    if (this.player.isPoleStrikeUnlocked()) {
      if (this.player.isSuperPoleUnlocked()) {
        if (this.player.isSuperPoleChargeReady() && this.player.energy >= this.player.superPoleEnergyCost) {
          this.player.consumeChargedInput("pole");
          this.goto("superPoleFrenzy");
          return;
        }
        if (this.player.isPoleReleasedWithoutCharge() && this.player.energy >= this.player.poleEnergyCost) {
          this.goto("poleStriking");
          return;
        }
      } else if (this.player.isPoleJustPressed() && this.player.energy >= this.player.poleEnergyCost) {
        this.goto("poleStriking");
        return;
      }
    }
    
    if (this.player.isAxeAttackUnlocked()) {
      const axeReady = this.player.isAxeAbilityReady();
      if (axeReady) {
        if (this.player.isSuperDashAxeUnlocked()) {
          if (this.player.isSuperDashChargeReady() && this.player.energy >= this.player.superDashAxeEnergyCost) {
            this.player.consumeChargedInput("axe");
            this.goto("superDashAxeAttacking");
            return;
          }
          if (this.player.isAxeReleasedWithoutCharge() && this.player.energy >= this.player.axeEnergyCost) {
            if (this.player.isDashAxeUnlocked()) {
              this.goto("dashAxeAttacking");
            } else {
              this.goto("axeAttacking");
            }
            return;
          }
        } else if (this.player.isAxeJustPressed() && this.player.energy >= this.player.axeEnergyCost) {
          if (this.player.isDashAxeUnlocked()) {
            this.goto("dashAxeAttacking");
          } else {
            this.goto("axeAttacking");
          }
          return;
        }
      }
    }
    
    const volttiPressed = this.player.isVolttiJustPressed();
    if (this.player.isVolttiAbilityReady()) {
      if (this.player.isTornadoVolttiUnlocked()) {
        if (this.player.isTornadoChargeReady() && this.player.energy >= this.player.tornadoVolttiEnergyCost) {
          this.player.consumeChargedInput("voltti");
          this.goto("tornadoSpinning");
          return;
        }
        if (this.player.isVolttiReleasedWithoutCharge()) {
          this.goto("spinKicking");
          return;
        }
      } else if (volttiPressed) {
        this.goto("spinKicking");
        return;
      }
    }

    // Check if we're in boss fight mode
    const gameScene = this.scene as any;
    const isBossFight = gameScene.bossActive === true;
    const bossDefeated = gameScene.bossDefeated === true;
    
    // FREE MOVEMENT: Player can always move left/right across the screen
    let moveSpeed = 200;
    
    // Apply ice slip effect - reduced control when slipping
    if (this.player.isSlipping) {
      moveSpeed = 100; // Halved movement control
      // Add random drift for slippery feel
      const randomDrift = Phaser.Math.Between(-30, 30);
      this.player.setVelocityX(this.player.body.velocity.x * 0.95 + randomDrift);
    }
    
    // Touch-only movement input.
    const leftPressed = this.player.touchInputState.left;
    const rightPressed = this.player.touchInputState.right;
    
    if (leftPressed) {
      if (this.player.isSlipping) {
        // Gradual velocity change when slipping
        this.player.setVelocityX(this.player.body.velocity.x - 8);
      } else {
        this.player.setVelocityX(-moveSpeed);
      }
      this.player.facingDirection = "left";
    } else if (rightPressed) {
      if (this.player.isSlipping) {
        // Gradual velocity change when slipping
        this.player.setVelocityX(this.player.body.velocity.x + 8);
      } else {
        this.player.setVelocityX(moveSpeed);
      }
      this.player.facingDirection = "right";
    } else {
      if (this.player.isSlipping) {
        // Slide to stop slowly when slipping
        this.player.setVelocityX(this.player.body.velocity.x * 0.98);
      } else {
        this.player.setVelocityX(0);
      }
    }
    
    // Clamp horizontal velocity when slipping
    if (this.player.isSlipping) {
      const maxSlipSpeed = 250;
      this.player.setVelocityX(Phaser.Math.Clamp(this.player.body.velocity.x, -maxSlipSpeed, maxSlipSpeed));
    }
    
    // SCROLLING SPEED: Handle scroll speed based on game mode
    // Boss defeated = resume scrolling to clubhouse!
    if (isBossFight && !bossDefeated) {
      // Boss fight: No scrolling, player stays in arena
      this.player.currentSpeed = 0;
    } else {
      // Normal mode: Level scrolls forward automatically at base speed
      // Speed controls removed - player moves at constant pace
      this.player.currentSpeed = this.player.baseSpeed;
    }

    // Update flip based on facing
    this.player.setFlipX(this.player.facingDirection === "left");
  }

  // Jumping state
  enter_jumping() {
    this.clearSuperEnergyLock();
    this.player.isJumping = true;
    this.player.clearMeleeTriggerProfile();
    this.player.body.setVelocityY(-this.player.jumpPower);
    this.player.jumpSound?.play();
    this.player.playAnimation("player_jump_up_anim");
    
    // Emit jump event for UI feedback
    this.scene.events.emit("attackPerformed", { attackType: "jump" });
  }

  update_jumping(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state
    this.player.updateGroundState();

    // Choose jump up or down animation based on vertical velocity
    if (this.player.body.velocity.y > 0) {
      // Falling down
      if (this.player.anims.currentAnim?.key !== "player_jump_down_anim") {
        this.player.playAnimation("player_jump_down_anim");
      }
    }

    // Landing detection
    if (this.player.isOnGround) {
      this.goto("skiing");
      return;
    }
    
    // FREE AIR MOVEMENT: Player can always move left/right in the air
    const airMoveSpeed = 180;
    
    // Touch-only air movement input.
    const leftPressed = this.player.touchInputState.left;
    const rightPressed = this.player.touchInputState.right;
    
    if (leftPressed) {
      this.player.setVelocityX(-airMoveSpeed);
      this.player.facingDirection = "left";
    } else if (rightPressed) {
      this.player.setVelocityX(airMoveSpeed);
      this.player.facingDirection = "right";
    } else {
      // Slow down horizontal movement in air
      this.player.setVelocityX(this.player.body.velocity.x * 0.95);
    }

    // Check for rage input (keyboard or touch) in air - ONLY if unlocked (level 3+)
    if (this.player.isRageUnlocked() && this.player.isRageJustPressed()) {
      if (this.player.isRageFull()) {
        this.goto("raging");
        return;
      }
    }

    // Allow air attacks (pole strike, axe) with charged super variants.
    if (this.player.isPoleStrikeUnlocked()) {
      if (this.player.isSuperPoleUnlocked()) {
        if (this.player.isSuperPoleChargeReady() && this.player.energy >= this.player.superPoleEnergyCost) {
          this.player.consumeChargedInput("pole");
          this.goto("superPoleFrenzy");
          return;
        }
        if (this.player.isPoleReleasedWithoutCharge() && this.player.energy >= this.player.poleEnergyCost) {
          this.goto("poleStriking");
          return;
        }
      } else if (this.player.isPoleJustPressed() && this.player.energy >= this.player.poleEnergyCost) {
        this.goto("poleStriking");
        return;
      }
    }
    
    if (this.player.isAxeAttackUnlocked()) {
      const axeReady = this.player.isAxeAbilityReady();
      if (axeReady) {
        if (this.player.isSuperDashAxeUnlocked()) {
          if (this.player.isSuperDashChargeReady() && this.player.energy >= this.player.superDashAxeEnergyCost) {
            this.player.consumeChargedInput("axe");
            this.goto("superDashAxeAttacking");
            return;
          }
          if (this.player.isAxeReleasedWithoutCharge() && this.player.energy >= this.player.axeEnergyCost) {
            if (this.player.isDashAxeUnlocked()) {
              this.goto("dashAxeAttacking");
            } else {
              this.goto("axeAttacking");
            }
            return;
          }
        } else if (this.player.isAxeJustPressed() && this.player.energy >= this.player.axeEnergyCost) {
          if (this.player.isDashAxeUnlocked()) {
            this.goto("dashAxeAttacking");
          } else {
            this.goto("axeAttacking");
          }
          return;
        }
      }
    }
    
    // In-air voltti triggers tricks (handled by Player.updateTricks), not spinKick

    // Update flip based on facing
    this.player.setFlipX(this.player.facingDirection === "left");
  }

  // Pole strike state
  enter_poleStriking() {
    this.player.isAttacking = true;
    this.player.currentMeleeTargets.clear();
    this.player.energy -= this.player.poleEnergyCost;
    this.player.setMeleeTriggerProfile(120, 95);
    
    // Auto-aim for mobile players - turn toward nearest enemy
    this.player.applyAutoAim();
    
    this.player.playAnimation("player_pole_strike_anim");
    utils.playSoundWithVariation(this.scene, "pole_strike", 0.34, 0.08, 36);
    
    // Emit attack event for UI feedback
    this.scene.events.emit("attackPerformed", { attackType: "pole" });

    // Return to skiing after animation completes (use character-specific animation key)
    const animKey = this.player.getAnimKey("player_pole_strike_anim");
    this.player.once(`animationcomplete-${animKey}`, () => {
      this.player.isAttacking = false;
      this.player.currentMeleeTargets.clear();
      this.player.clearMeleeTriggerProfile();
      this.goto("skiing");
    });
  }

  update_poleStriking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
  }

  // Axe attack state - MASSIVE BLAST ZONE!
  enter_axeAttacking() {
    this.player.isAttacking = true;
    this.player.currentMeleeTargets.clear();
    this.player.energy -= this.player.axeEnergyCost;
    this.player.triggerAxeCooldown();
    this.player.setMeleeTriggerProfile(220, 170);
    
    // Auto-aim for mobile players - turn toward nearest enemy
    this.player.applyAutoAim();
    
    this.player.playAnimation("player_axe_attack_anim");
    
    // Emit attack event for UI feedback
    this.scene.events.emit("attackPerformed", { attackType: "axe" });
    
    // Play both axe swing and explosion sound for devastating effect
    utils.playSoundWithVariation(this.scene, "axe_swing", 0.38, 0.06, 30);
    this.scene.time.delayedCall(80, () => {
      utils.playManagedSound(this.scene, "axe_explosion", { volume: 0.4 });
    });
    
    // Add screen shake for impact - reserved for major impacts only
    this.scene.cameras.main.shake(60, 0.008);
    
    // Add visual flash effect
    this.scene.cameras.main.flash(50, 255, 200, 100, true);

    // Return to skiing after animation completes (use character-specific animation key)
    const animKey = this.player.getAnimKey("player_axe_attack_anim");
    this.player.once(`animationcomplete-${animKey}`, () => {
      this.player.isAttacking = false;
      this.player.currentMeleeTargets.clear();
      this.player.clearMeleeTriggerProfile();
      
      this.goto("skiing");
    });
  }

  update_axeAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
  }

  // Dash Axe attack state - SYÖKSYISKU! (Level 6+ upgrade)
  // Player dashes forward at double speed, instant kills all enemies in path
  enter_dashAxeAttacking() {
    this.player.isAttacking = true;
    this.player.currentMeleeTargets.clear();
    this.player.energy -= this.player.axeEnergyCost;
    this.player.triggerAxeCooldown();
    this.player.setMeleeTriggerProfile(430, 220);
    
    // Auto-aim for mobile players - turn toward nearest enemy
    this.player.applyAutoAim();
    
    this.player.playAnimation("player_dash_axe_attack_anim");
    
    // Emit attack event for UI feedback
    this.scene.events.emit("attackPerformed", { attackType: "dashAxe" });
    
    // Play intense sounds for dash attack
    utils.playSoundWithVariation(this.scene, "axe_swing", 0.4, 0.05, 28);
    utils.playManagedSound(this.scene, "axe_explosion", { volume: 0.5 });
    
    // Store original position and set dash parameters
    const dashSpeed = 800; // Double normal speed
    const dashDirection = this.player.facingDirection === "right" ? 1 : -1;
    
    // Apply dash velocity
    this.player.setVelocityX(dashSpeed * dashDirection);
    
    // Major screen effects - manga style!
    this.scene.cameras.main.shake(100, 0.015);
    this.scene.cameras.main.flash(80, 255, 100, 50, true);
    
    // Add speed lines effect (manga style) via tween on player alpha
    this.scene.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.7 },
      duration: 50,
      yoyo: true,
      repeat: 2
    });

    // End dash after animation completes
    const animKey = this.player.getAnimKey("player_dash_axe_attack_anim");
    this.player.once(`animationcomplete-${animKey}`, () => {
      this.player.isAttacking = false;
      this.player.currentMeleeTargets.clear();
      this.player.setVelocityX(0);
      this.player.clearMeleeTriggerProfile();
      
      this.goto("skiing");
    });
  }

  update_dashAxeAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
    
    // Keep dash velocity constant during attack
    const dashSpeed = 800;
    const dashDirection = this.player.facingDirection === "right" ? 1 : -1;
    this.player.setVelocityX(dashSpeed * dashDirection);
  }

  // Super Dash Axe state - charged 1.5s hold attack that cuts through the whole screen width.
  enter_superDashAxeAttacking() {
    this.player.isAttacking = true;
    this.player.currentMeleeTargets.clear();
    this.clearSuperEnergyLock();
    this.player.triggerAxeCooldown();
    this.player.applyAutoAim();

    const attackRange = Math.max(560, this.scene.scale.width - 120);
    this.player.setMeleeTriggerProfile(attackRange, 240);
    this.player.playAnimation("player_dash_axe_attack_anim");

    this.scene.events.emit("attackPerformed", { attackType: "superDashAxe" });
    this.scene.events.emit("floatingAnnouncement", {
      text: "SUPERSYOKSY: LADUNLEIKKAAJA",
      duration: 950
    });

    utils.playSoundWithVariation(this.scene, "axe_swing", 0.42, 0.05, 24);
    utils.playManagedSound(this.scene, "axe_explosion", { volume: 0.65, rate: 0.9, pitchVariation: 0, detuneVariation: 0 });

    const dashDirection = this.player.facingDirection === "right" ? 1 : -1;
    const dashSpeed = 1450;
    const dashDuration = 460;
    this.player.setVelocityX(dashSpeed * dashDirection);

    this.scene.cameras.main.shake(160, 0.018);
    this.scene.cameras.main.flash(120, 255, 140, 80, true);

    this.scene.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.45 },
      duration: 45,
      yoyo: true,
      repeat: 5
    });

    this.scene.time.delayedCall(dashDuration, () => {
      if (!this.player.active || this.player.isDead) return;
      this.player.isAttacking = false;
      this.player.currentMeleeTargets.clear();
      this.player.setVelocityX(0);
      this.player.clearMeleeTriggerProfile();
      this.clearSuperEnergyLock();
      this.goto(this.player.isOnGround ? "skiing" : "jumping");
    });
  }

  update_superDashAxeAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.player.updateGroundState();
    this.enforceSuperEnergyLock();
    const dashDirection = this.player.facingDirection === "right" ? 1 : -1;
    this.player.setVelocityX(1450 * dashDirection);
  }

  // Tornado Spin state - charged voltti hold turns spin kick into a sustained tornado.
  enter_tornadoSpinning() {
    this.player.isAttacking = true;
    this.player.isSpinKicking = true;
    this.player.currentMeleeTargets.clear();
    this.player.triggerVolttiCooldown();
    this.consumeSuperEnergyThirtyPercent();
    this.player.setMeleeTriggerProfile(260, 210);
    this.player.playAnimation("player_punch_anim");

    this.scene.events.emit("attackPerformed", { attackType: "tornadoVoltti" });
    this.scene.events.emit("floatingAnnouncement", {
      text: "MYRSKYVOLTTI",
      duration: 900
    });

    utils.playSoundWithVariation(this.scene, "combo_hit", 0.44, 0.08, 48);
    utils.playManagedSound(this.scene, "combo_hit", { volume: 0.5, rate: 1.2, pitchVariation: 0, detuneVariation: 0 });
    this.scene.cameras.main.shake(120, 0.01);

    this.scene.tweens.add({
      targets: this.player,
      angle: this.player.facingDirection === "right" ? 2520 : -2520,
      duration: 2000,
      ease: "Linear",
      onComplete: () => {
        this.player.angle = 0;
      }
    });

    this.scene.time.delayedCall(2000, () => {
      if (!this.player.active || this.player.isDead) return;
      this.player.isAttacking = false;
      this.player.isSpinKicking = false;
      this.player.currentMeleeTargets.clear();
      this.player.angle = 0;
      this.player.clearMeleeTriggerProfile();
      this.clearSuperEnergyLock();
      this.goto(this.player.isOnGround ? "skiing" : "jumping");
    });
  }

  update_tornadoSpinning(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.player.updateGroundState();
    this.enforceSuperEnergyLock();

    const moveDir = this.player.facingDirection === "right" ? 1 : -1;
    this.player.setVelocityX(260 * moveDir);

    // Allow sustained multi-hit tornado damage.
    this.player.currentMeleeTargets.clear();
  }

  // Super Pole Frenzy state - charged pole hold starts a 2s close-range whirlwind.
  enter_superPoleFrenzy() {
    this.player.isAttacking = true;
    this.player.currentMeleeTargets.clear();
    this.consumeSuperEnergyThirtyPercent();
    this.player.setMeleeTriggerProfile(250, 230);
    this.player.playAnimation("player_pole_strike_anim");
    utils.playManagedSound(this.scene, "combo_hit", { volume: 0.45, rate: 1.08, pitchVariation: 0, detuneVariation: 0 });

    this.scene.events.emit("attackPerformed", { attackType: "superPole" });
    this.scene.events.emit("floatingAnnouncement", {
      text: "SUPERSAUVA: RAIVOPYORRE",
      duration: 950
    });

    const frenzySpinTween = this.scene.tweens.add({
      targets: this.player,
      angle: { from: -24, to: 24 },
      duration: 75,
      yoyo: true,
      repeat: 26,
      ease: "Sine.InOut"
    });

    const pulseEvent = this.scene.time.addEvent({
      delay: 130,
      repeat: 14,
      callback: () => {
        if (!this.player.active || this.player.isDead) return;
        this.player.currentMeleeTargets.clear();
        this.scene.cameras.main.shake(24, 0.0035);
      }
    });

    this.scene.time.delayedCall(2000, () => {
      pulseEvent.destroy();
      frenzySpinTween.stop();
      if (!this.player.active || this.player.isDead) return;
      this.player.isAttacking = false;
      this.player.currentMeleeTargets.clear();
      this.player.angle = 0;
      this.player.clearMeleeTriggerProfile();
      this.clearSuperEnergyLock();
      this.goto(this.player.isOnGround ? "skiing" : "jumping");
    });
  }

  update_superPoleFrenzy(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.player.updateGroundState();
    this.enforceSuperEnergyLock();
    this.player.setVelocityX(this.player.body.velocity.x * 0.6);
    this.player.currentMeleeTargets.clear();
  }

  // Spin kick state - VOLTTIPOTKU!
  enter_spinKicking() {
    this.player.isAttacking = true;
    this.player.isSpinKicking = true;
    this.player.currentMeleeTargets.clear();
    this.player.triggerVolttiCooldown();
    this.player.setMeleeTriggerProfile(170, 120);
    
    // Auto-aim for mobile players - turn toward nearest enemy
    this.player.applyAutoAim();
    
    this.player.playAnimation("player_punch_anim"); // Use punch animation for now
    utils.playSoundWithVariation(this.scene, "combo_hit", 0.3, 0.12, 70);
    
    // Add spin rotation effect
    this.scene.tweens.add({
      targets: this.player,
      angle: this.player.facingDirection === "right" ? 360 : -360,
      duration: 150,
      ease: 'Linear',
      onComplete: () => {
        this.player.angle = 0;
      }
    });
    
    // Minor screen shake for spin kick
    this.scene.cameras.main.shake(30, 0.003);

    // Return to skiing after animation completes (use character-specific animation key)
    const animKey = this.player.getAnimKey("player_punch_anim");
    this.player.once(`animationcomplete-${animKey}`, () => {
      this.player.isAttacking = false;
      this.player.isSpinKicking = false;
      this.player.currentMeleeTargets.clear();
      this.player.angle = 0;
      this.player.clearMeleeTriggerProfile();
      
      this.goto("skiing");
    });
  }

  update_spinKicking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
  }

  // Dodging state - quick backstep towards player's back.
  enter_dodging() {
    this.player.isAttacking = false;
    this.player.isSpinKicking = false;
    this.player.clearMeleeTriggerProfile();
    this.player.triggerDodgeCooldown();
    this.player.triggerDodgeInvulnerability();
    this.player.playAnimation("player_ski_walk_anim");
    this.scene.events.emit("attackPerformed", { attackType: "dodge" });

    const dodgeDirection = this.player.facingDirection === "right" ? -1 : 1;
    this.player.setVelocityX(this.player.dodgeBackstepSpeed * dodgeDirection);
    this.player.setAngle(dodgeDirection > 0 ? 7 : -7);

    utils.playManagedSound(this.scene, "ski_swoosh", {
      volume: 0.32,
      rate: 1.18,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.cameras.main.shake(55, 0.005);

    this.scene.time.delayedCall(this.player.dodgeDurationMs, () => {
      if (!this.player.active || this.player.isDead) return;
      if (this.state !== "dodging") return;
      this.player.setVelocityX(0);
      this.player.setAngle(0);
      this.goto(this.player.isOnGround ? "skiing" : "jumping");
    });
  }

  update_dodging(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.player.updateGroundState();

    // Keep dodge momentum stable for the brief evade window.
    const dodgeDirection = this.player.facingDirection === "right" ? -1 : 1;
    this.player.setVelocityX(this.player.dodgeBackstepSpeed * dodgeDirection);
  }

  // Hurt state
  enter_hurting() {
    this.clearSuperEnergyLock();
    this.player.isHurting = true;
    this.player.isAttacking = false;
    this.player.isSpinKicking = false;
    this.player.angle = 0;
    this.player.clearMeleeTriggerProfile();
    this.player.playerHurtSound?.play();

    // Short stun then return to skiing
    this.scene.time.delayedCall(this.player.hurtingDuration, () => {
      if (!this.player.isDead) {
        this.player.isHurting = false;
        this.goto("skiing");
      }
    });
  }

  update_hurting(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
  }

  // Dying state
  enter_dying() {
    this.clearSuperEnergyLock();
    // Play fart death sound
    this.player.deathSound?.play();
    this.player.isAttacking = false;
    this.player.isSpinKicking = false;
    this.player.angle = 0;
    this.player.clearMeleeTriggerProfile();
    
    this.player.playAnimation("player_die_anim");

    // Emit death event for GameScene to handle lives system (use character-specific animation key)
    const animKey = this.player.getAnimKey("player_die_anim");
    this.player.once(`animationcomplete-${animKey}`, () => {
      // Let GameScene handle death (lives system)
      const gameScene = this.scene as any;
      if (gameScene.handlePlayerDeath) {
        gameScene.handlePlayerDeath();
      }
    });
  }

  update_dying(time: number, delta: number) {
    // Update ground state to prevent falling through floor
    this.player.updateGroundState();
  }

  // Rage state - SUPERVOIMA! Kill all enemies on screen
  enter_raging() {
    this.player.isAttacking = false; // Not an attack, but a superpower
    this.player.isSpinKicking = false;
    this.player.angle = 0;
    this.player.clearMeleeTriggerProfile();
    this.player.activateRage();

    // Return to skiing after rage duration
    this.scene.time.delayedCall(this.player.rageDuration, () => {
      if (!this.player.isDead) {
        if (this.player.isOnGround) {
          this.goto("skiing");
        } else {
          this.goto("jumping");
        }
      }
    });
  }

  update_raging(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Update ground state
    this.player.updateGroundState();
    
    // Keep current velocity during rage
  }
}
