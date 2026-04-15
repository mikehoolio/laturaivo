import Phaser from "phaser";
import * as utils from "../utils";
import { bossConfig } from "../gameConfig.json";
import { PeterSyncFSM } from "./PeterSyncFSM";

type Direction = "left" | "right";
const PETER_HEALTH_MULTIPLIER = 3.0; // +200% health
const PETER_STRIKE_DAMAGE_MULTIPLIER = 0.6; // -40% outgoing damage
const PETER_DAMAGE_BUFF_MULTIPLIER = 1.3; // User request: increase all boss attack damage by +30%.
const PETER_DAMAGE_NERF_MULTIPLIER = 0.9; // Current request: reduce all boss damage by 10%.
const PETER_GLOBAL_DAMAGE_TUNING = 0.28 * PETER_DAMAGE_BUFF_MULTIPLIER * PETER_DAMAGE_NERF_MULTIPLIER;
const PETER_SYNC_MAX_COMBAT_SCALE = 2.0;

// Peter Kantele boss - Fast, aggressive, formidable opponent in the Ice Club Arena

const PETER_SYNC_TAUNTS: string[] = [
  '"YOU THINK YOU CAN SKI?"',
  '"THIS TRAIL IS MINE!"',
  '"TOO SLOW, AMATEUR!"',
  '"WATCH AND LEARN!"',
  '"I OWN THIS ARENA!"',
  '"STEP ASIDE, LOSER!"',
  '"YOU CALL THAT SKIING?"',
  '"PREPARE TO BE HUMILIATED!"',
  '"PETER KANTELE RULES THE ICE!"',
  '"YOU\'RE NOT EVEN A CHALLENGE!"',
];

const PETER_SYNC_ENRAGE_TAUNTS: string[] = [
  '"NOW I\'M REALLY MAD!"',
  '"YOU\'LL REGRET THAT!"',
  '"NO MORE MERCY!"',
];

const PETER_SYNC_HURT_TAUNTS: string[] = [
  '"MY OUTFIT!"',
  '"YOU\'LL PAY FOR THAT!"',
  '"LUCKY SHOT!"',
];

type SupportBossHealthPool = {
  active: boolean;
  isDead: boolean;
  health: number;
  maxHealth: number;
};

export class PeterSync extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  // State machine
  fsm: PeterSyncFSM;

  // Character attributes
  facingDirection: Direction;
  speed: number;
  glideSpeed: number;
  dashSpeed: number;
  jumpPower: number;

  // State flags
  isDead: boolean;
  isAttacking: boolean;
  isHurting: boolean;
  canAttack: boolean;
  attackCooldown: number;
  isEnraged: boolean;
  isGliding: boolean;
  isSpinning: boolean;
  isDashing: boolean;
  isTaunting: boolean;
  isJumping: boolean;
  private chasePauseUntil: number = 0;
  private attackLockStartedAt: number = 0;
  
  // Phase system
  currentPhase: number;
  phaseThresholds: number[];
  
  // Special attack patterns for Peter Kantele
  specialAttackCooldown: number;
  canSpecialAttack: boolean;
  nextSpecialAttackAt: number;
  private specialDamageScaleMultiplier: number = 1;
  attackPatternIndex: number;
  attackPatterns: string[][];
  private attackDecksByPhase: Map<number, string[]>;
  private pendingPhaseOpeners: string[];
  private lastAttackType: string | null;
  lastTauntTime: number;
  tauntCooldown: number;
  tauntExtraDurationMs: number;
  private tauntChanceMultiplier: number = 0.7;

  // Attack target tracking
  currentMeleeTargets: Set<any>;

  // Health system
  maxHealth: number;
  health: number;
  damage: number;
  spinDamage: number;
  dashDamage: number;
  jumpShockwaveDamage: number;
  scoreValue: number;

  // Attack trigger
  meleeTrigger: Phaser.GameObjects.Zone;
  spinTrigger?: Phaser.GameObjects.Zone;

  // Sound effects
  glideSound?: Phaser.Sound.BaseSound;
  spinAttackSound?: Phaser.Sound.BaseSound;
  shockwaveLandingSound?: Phaser.Sound.BaseSound;
  tauntSound?: Phaser.Sound.BaseSound;
  dashSound?: Phaser.Sound.BaseSound;
  
  // Ground Y position
  groundY: number;

  // Health bar
  healthBarBg?: Phaser.GameObjects.Graphics;
  healthBarFill?: Phaser.GameObjects.Graphics;
  private readonly healthBarWidth: number = 200;
  private readonly healthBarHeight: number = 14;
  private readonly healthBarYOffset: number = 25;
  private lastHealthBarFillWidth: number = -1;
  private lastHealthBarFillColor: number = -1;
  private baseScaleX: number = 1;
  private baseScaleY: number = 1;
  private combatScaleMultiplier: number = 1;
  private maxCombatScaleMultiplier: number = PETER_SYNC_MAX_COMBAT_SCALE;
  private supportBoss?: SupportBossHealthPool;
  private duoPeterMaxHealthCap: number = 0;
  private duoSupportMaxHealth: number = 0;
  
  // Visual effects
  afterimages: Phaser.GameObjects.Sprite[];
  sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "peter_sync_idle_R_frame1");

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Store ground Y
    this.groundY = groundY;

    // Initialize character attributes - high-end final boss pacing.
    this.facingDirection = "left";
    this.speed = 145;
    this.glideSpeed = 205;
    this.dashSpeed = 520;
    this.jumpPower = 560;

    // Initialize state flags
    this.isDead = false;
    this.isAttacking = false;
    this.isHurting = false;
    this.canAttack = true;
    this.attackCooldown = 1250;
    this.isEnraged = false;
    this.isGliding = false;
    this.isSpinning = false;
    this.isDashing = false;
    this.isTaunting = false;
    this.isJumping = false;
    this.attackLockStartedAt = 0;
    
    // Phase system - 2 phases based on health
    this.currentPhase = 1;
    this.phaseThresholds = [0.58]; // Phase 2 at 58% health
    
    // Attack patterns - increasingly aggressive
    this.specialAttackCooldown = 2400;
    this.canSpecialAttack = true;
    this.nextSpecialAttackAt = (scene.time?.now ?? 0) + Phaser.Math.Between(1800, 2600);
    this.attackPatternIndex = 0;
    this.attackDecksByPhase = new Map();
    this.pendingPhaseOpeners = [];
    this.lastAttackType = null;
    this.lastTauntTime = 0;
    this.tauntCooldown = 6000;
    this.tauntExtraDurationMs = 1000; // Keep taunts visible +1s for readability
    const currentLevel = Number((scene as any).currentLevel ?? 0);
    const isTurkuBoss = currentLevel === 7;
    // Previous baseline was 0.5:
    // Turku/PASI +70% => 0.85, others +40% => 0.70
    this.tauntChanceMultiplier = isTurkuBoss ? 0.85 : 0.7;
    
    // Phase 1: Immediate pressure with minimal downtime.
    // Phase 2: Hyper-aggressive chaining with jumps/dashes/spins.
    this.attackPatterns = [
      ["glide", "spin", "dash", "jump", "spin", "dash", "special"],
      ["spin", "dash", "jump", "special", "spin", "jump", "dash", "spin", "jump", "special"]
    ];
    this.resetPhaseAttackState(this.currentPhase, true);

    // Initialize attack system
    this.currentMeleeTargets = new Set();

    // Health and damage - progressive endgame tuning (between level 8 and level 10 bosses).
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    const monikaReferenceHealth = Math.round(
      bossConfig.miniBossHealth.value * difficultyMultiplier * PETER_HEALTH_MULTIPLIER
    );
    const peterDifficultyScale = 1.9;
    const peterPressureScale = 1.35;
    this.maxHealth = Math.round(monikaReferenceHealth * peterDifficultyScale);
    this.health = this.maxHealth;
    this.damage = Math.max(
      1,
      Math.round(
        20 *
        difficultyMultiplier *
        PETER_STRIKE_DAMAGE_MULTIPLIER *
        PETER_GLOBAL_DAMAGE_TUNING *
        peterPressureScale
      )
    );
    this.spinDamage = Math.max(
      1,
      Math.round(
        30 *
        difficultyMultiplier *
        PETER_STRIKE_DAMAGE_MULTIPLIER *
        PETER_GLOBAL_DAMAGE_TUNING *
        peterPressureScale
      )
    );
    this.dashDamage = Math.max(
      1,
      Math.round(
        25 *
        difficultyMultiplier *
        PETER_STRIKE_DAMAGE_MULTIPLIER *
        PETER_GLOBAL_DAMAGE_TUNING *
        peterPressureScale
      )
    );
    this.jumpShockwaveDamage = Math.max(
      1,
      Math.round(
        40 *
        difficultyMultiplier *
        PETER_STRIKE_DAMAGE_MULTIPLIER *
        PETER_GLOBAL_DAMAGE_TUNING *
        peterPressureScale
      )
    );
    this.scoreValue = 2000; // Big score reward

    // Keep Peter at standard mini-boss baseline size.
    // Only final boss (Iso Timo) should grow clearly larger.
    const standardHeight = 160;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.4, 0.9);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.combatScaleMultiplier = 1;
    this.maxCombatScaleMultiplier = PETER_SYNC_MAX_COMBAT_SCALE;

    // Disable gravity - Peter controls his own aerial moves
    this.body.setAllowGravity(false);
    
    // Start on ground
    this.y = this.groundY;

    // Create attack trigger - standard melee range
    this.meleeTrigger = utils.createTrigger(this.scene, this, 0, 0, 120, 100);
    
    // Create spin attack trigger - larger circular area
    this.spinTrigger = utils.createTrigger(this.scene, this, 0, 0, 180, 180);
    
    // Add melee trigger to scene's enemyMeleeTriggers group
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }

    // Initialize sound effects
    this.initializeSounds();

    // Initialize afterimages array for dash effect
    this.afterimages = [];

    // Initialize state machine
    this.fsm = new PeterSyncFSM(scene, this);

    // Play boss appear sound
    this.playSoundSafe("boss_appear", { volume: 0.5 });
    
    // Show entrance taunt after a short delay
    scene.time.delayedCall(800, () => {
      if (!this.isDead) {
        this.showTaunt(this.getRandomTaunt(), 3000);
      }
    });
  }

  // Play animation and reset origin and offset
  playAnimation(animKey: string) {
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }

  createHealthBar(): void {
    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.setDepth(100);
    
    this.healthBarFill = this.scene.add.graphics();
    this.healthBarFill.setDepth(101);

    // Background stays static in local coordinates.
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x000000, 0.8);
    this.healthBarBg.fillRect(-2, -2, this.healthBarWidth + 4, this.healthBarHeight + 4);
    this.healthBarBg.lineStyle(2, 0x00ffff, 1);
    this.healthBarBg.strokeRect(-2, -2, this.healthBarWidth + 4, this.healthBarHeight + 4);
    
    this.updateHealthBar();
  }

  updateHealthBar(): void {
    if (!this.healthBarBg || !this.healthBarFill) return;
    
    const barX = this.x - this.healthBarWidth / 2;
    const barY = this.y - this.displayHeight - this.healthBarYOffset;

    this.healthBarBg.setPosition(barX, barY);
    this.healthBarFill.setPosition(barX, barY);
    
    const healthPercent = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    const fillWidth = Math.round(this.healthBarWidth * healthPercent);
    
    // Disco colors! Purple when enraged, hot pink normally
    let fillColor = this.isEnraged ? 0xff00ff : 0xff1493;

    if (fillWidth === this.lastHealthBarFillWidth && fillColor === this.lastHealthBarFillColor) {
      return;
    }

    this.lastHealthBarFillWidth = fillWidth;
    this.lastHealthBarFillColor = fillColor;
    this.healthBarFill.clear();
    if (fillWidth > 0) {
      this.healthBarFill.fillStyle(fillColor, 1);
      this.healthBarFill.fillRect(0, 0, fillWidth, this.healthBarHeight);
    }
  }

  pauseChaseFor(durationMs: number): void {
    const now = this.scene?.time?.now ?? 0;
    this.chasePauseUntil = Math.max(this.chasePauseUntil, now + Math.max(0, durationMs));
    this.setVelocityX(0);
  }

  isChasePaused(now: number): boolean {
    return now < this.chasePauseUntil;
  }

  private getPhaseScaleFloor(phase: number): number {
    if (phase <= 1) return 1;
    return 1 + (this.maxCombatScaleMultiplier - 1) * 0.68;
  }

  private updateCombatScale(delta: number): void {
    const healthPercent = Phaser.Math.Clamp(this.health / Math.max(1, this.maxHealth), 0, 1);
    const healthGrowthMultiplier = 1 + (1 - healthPercent) * (this.maxCombatScaleMultiplier - 1);
    const phaseFloor = this.getPhaseScaleFloor(this.currentPhase);
    const targetMultiplier = Phaser.Math.Clamp(
      Math.max(phaseFloor, healthGrowthMultiplier),
      1,
      this.maxCombatScaleMultiplier
    );

    // Keep growth monotonic for the whole fight.
    this.combatScaleMultiplier = Math.max(this.combatScaleMultiplier, targetMultiplier);
    const targetScaleX = this.baseScaleX * this.combatScaleMultiplier;
    const targetScaleY = this.baseScaleY * this.combatScaleMultiplier;
    const lerp = Phaser.Math.Clamp(delta / 240, 0.05, 0.22);
    this.scaleX = Phaser.Math.Linear(this.scaleX, targetScaleX, lerp);
    this.scaleY = Phaser.Math.Linear(this.scaleY, targetScaleY, lerp);
  }

  // Main update method
  update(time: number, delta: number) {
    if (!this.body || !this.active || this.isDead || !this.scene) {
      return;
    }

    if (this.duoPeterMaxHealthCap > 0) {
      this.health = Phaser.Math.Clamp(this.health, 0, this.duoPeterMaxHealthCap);
    }
    
    // Keep boss within arena boundaries
    const horizontalMargin = Math.max(150, Math.ceil(this.displayWidth * 0.35));
    const minX = horizontalMargin;
    const maxX = this.scene.scale.width - horizontalMargin;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    
    // Keep on ground unless jumping
    if (!this.isJumping) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }

    // Update attack triggers
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, 120, 100);
    
    // Update spin trigger (centered on boss)
    if (this.spinTrigger) {
      (this.spinTrigger as any).setPosition(this.x, this.y - this.displayHeight / 2);
    }

    // Update state machine
    this.fsm.update(time, delta);

    // Safety net: if attack unlock timer/event is missed (e.g. scene pause/resume edge cases),
    // force-recover canAttack so Peter does not become passive.
    if (!this.canAttack && !this.isAttacking && !this.isHurting && !this.isDead) {
      if (this.attackLockStartedAt <= 0) {
        this.attackLockStartedAt = this.scene.time.now;
      } else if (!this.isChasePaused(this.scene.time.now)) {
        const lockDuration = this.scene.time.now - this.attackLockStartedAt;
        const staleThreshold = Math.max(1800, this.attackCooldown * 1.8);
        if (lockDuration >= staleThreshold) {
          this.canAttack = true;
          this.attackLockStartedAt = 0;
        }
      }
    } else {
      this.attackLockStartedAt = 0;
    }

    // Update flip based on facing direction
    this.setFlipX(this.facingDirection === "left");
    
    // Check for enrage (below 30% health)
    if (!this.isEnraged && this.health < this.maxHealth * 0.3) {
      this.enterEnrage();
    }
    
    // Check phase transition at 50%
    this.checkPhaseTransition();
    this.updateCombatScale(delta);
    this.updateHealthBar();
    
    // Clean up old afterimages
    this.cleanupAfterimages();
  }
  
  checkPhaseTransition(): void {
    const healthPercent = this.health / this.maxHealth;
    
    if (this.currentPhase === 1 && healthPercent <= this.phaseThresholds[0]) {
      this.transitionToPhase(2);
    }
  }
  
  transitionToPhase(newPhase: number): void {
    if (this.currentPhase === newPhase) return;
    
    this.currentPhase = newPhase;
    this.attackPatternIndex = 0;
    this.resetPhaseAttackState(newPhase);
    
    // Visual feedback
    this.scene.cameras.main.shake(400, 0.02);
    this.scene.cameras.main.flash(200, 255, 0, 255, true); // Purple flash
    
    // Flash effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 4,
      onComplete: () => { this.alpha = 1; }
    });
    
    // Phase 2 buffs - reduced from previous tuning.
    this.speed *= 1.15;
    this.glideSpeed *= 1.15;
    this.attackCooldown *= 0.85;

    const phaseScaleFloor = this.getPhaseScaleFloor(newPhase);
    if (phaseScaleFloor > this.combatScaleMultiplier) {
      this.combatScaleMultiplier = phaseScaleFloor;
      this.scene.tweens.add({
        targets: this,
        scaleX: this.baseScaleX * this.combatScaleMultiplier,
        scaleY: this.baseScaleY * this.combatScaleMultiplier,
        duration: 320,
        ease: "Back.Out"
      });
    }
    
    // Show phase transition taunt
    this.showTaunt('"TIME TO TURN UP THE BEAT!"', 3000);
    
    // Emit phase change event
    this.scene.events.emit("bossPhaseChanged", {
      bossType: "peter_sync",
      oldPhase: 1,
      newPhase: 2
    });
  }

  enterEnrage(): void {
    if (this.isEnraged) return;
    
    this.isEnraged = true;
    this.speed *= 1.2;
    this.glideSpeed *= 1.2;
    this.attackCooldown *= 0.75;
    
    // Purple disco glow
    this.setTint(0xff00ff);
    
    // Intense screen shake
    this.scene.cameras.main.shake(600, 0.015);
    
    // Show enrage taunt
    this.showEnrageTaunt();
    
    // Trigger special enrage attack!
    this.performEnrageSpecialAttack("enrage");
  }
  
  // Special enrage attack - DISCO INFERNO
  performEnrageSpecialAttack(source: "enrage" | "pattern" = "enrage"): boolean {
    const gameScene = this.scene as any;
    const player = gameScene.player;
    if (!player || player.isDead || this.isDead) return false;

    if (source === "pattern" && !this.canUseSpecialAttackNow()) return false;
    this.specialDamageScaleMultiplier = source === "enrage" ? 1 : 0.68;
    this.scheduleNextSpecialAttack(source === "enrage" ? 0.9 : 1);

    this.scene.events.emit("bossAttackTelegraph", {
      kind: "super",
      attackName: "DISCO INFERNO",
      bossType: "peter_sync"
    });
    if (typeof gameScene.triggerBossAttackCinematic === "function") {
      gameScene.triggerBossAttackCinematic(this);
    }
    
    // Show special attack taunt
    this.showTaunt('"DISCO INFERNO!"', 3000);
    
    // Flash screen with disco colors
    this.scene.cameras.main.flash(500, 255, 0, 255, true);
    
    // Play all disco sounds!
    this.spinAttackSound?.play();
    
    // Rapid spin creating shockwave
    this.scene.time.delayedCall(600, () => {
      if (player.isDead || this.isDead) return;
      
      // Create expanding shockwave effect
      const shockwave = this.scene.add.image(this.x, this.groundY, "ice_shockwave_effect");
      utils.initScale(shockwave, { x: 0.5, y: 1.0 }, undefined, 100);
      shockwave.setDepth(50);
      shockwave.setAlpha(0.8);
      
      this.scene.tweens.add({
        targets: shockwave,
        scaleX: 3,
        scaleY: 1.5,
        alpha: 0,
        duration: 800,
        onComplete: () => shockwave.destroy()
      });
      
      // Deal 20% of player's max health (reduced from 40%).
      const basePercent = source === "enrage" ? 0.2 : 0.13;
      const damage = this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * basePercent));
      player.takeDamage(damage, { source: "boss" });
      
      // Big screen shake
      this.scene.cameras.main.shake(500, 0.025);
    });
    return true;
  }

  canUseSpecialAttackNow(now: number = this.scene?.time?.now ?? 0): boolean {
    if (!this.canSpecialAttack) return false;
    return now >= this.nextSpecialAttackAt;
  }

  scheduleNextSpecialAttack(cooldownMultiplier: number = 1): void {
    const now = this.scene?.time?.now ?? 0;
    const jitter = Phaser.Math.Between(-220, 260);
    const baseCooldown = Math.max(900, Math.round(this.specialAttackCooldown * cooldownMultiplier));
    this.nextSpecialAttackAt = now + Math.max(800, baseCooldown + jitter);
  }
  
  // Get next attack type from pattern
  getNextAttackType(): string {
    const phase = Phaser.Math.Clamp(this.currentPhase, 1, this.attackPatterns.length);
    let attackType: string | undefined;

    if (this.pendingPhaseOpeners.length > 0) {
      const preferredIndex = this.pendingPhaseOpeners.findIndex((attack) => attack !== this.lastAttackType);
      const openerIndex = preferredIndex >= 0 ? preferredIndex : 0;
      attackType = this.pendingPhaseOpeners.splice(openerIndex, 1)[0];
    } else {
      let phaseDeck = this.attackDecksByPhase.get(phase);
      if (!phaseDeck || phaseDeck.length === 0) {
        phaseDeck = this.refillAttackDeckForPhase(phase);
      }
      attackType = phaseDeck.shift();

      if (attackType && attackType === this.lastAttackType && phaseDeck.length > 0) {
        const altIndex = phaseDeck.findIndex((attack) => attack !== this.lastAttackType);
        if (altIndex >= 0) {
          const altAttack = phaseDeck.splice(altIndex, 1)[0];
          phaseDeck.unshift(attackType);
          attackType = altAttack;
        }
      }
    }

    if (!attackType) {
      attackType = "glide";
    }

    this.lastAttackType = attackType;
    this.attackPatternIndex++;
    return attackType;
  }

  private resetPhaseAttackState(phase: number, clearLastAttack: boolean = false): void {
    this.attackDecksByPhase.delete(phase);
    this.pendingPhaseOpeners = phase >= 2 ? ["dash", "jump", "spin", "special"] : [];
    if (clearLastAttack) {
      this.lastAttackType = null;
    }
  }

  private refillAttackDeckForPhase(phase: number): string[] {
    const index = Phaser.Math.Clamp(phase - 1, 0, this.attackPatterns.length - 1);
    const pattern = this.attackPatterns[index] && this.attackPatterns[index].length > 0
      ? this.attackPatterns[index]
      : ["glide"];
    const freshDeck = [...pattern];
    Phaser.Utils.Array.Shuffle(freshDeck);
    this.attackDecksByPhase.set(phase, freshDeck);
    return freshDeck;
  }
  
  // Create afterimage for dash effect
  createAfterimage(): void {
    const afterimage = this.scene.add.sprite(this.x, this.y, this.texture.key);
    afterimage.setOrigin(this.originX, this.originY);
    afterimage.setScale(this.scaleX, this.scaleY);
    afterimage.setFlipX(this.flipX);
    afterimage.setAlpha(0.5);
    afterimage.setTint(0x00ffff); // Cyan afterimage
    afterimage.setDepth(this.depth - 1);
    
    this.afterimages.push(afterimage);
    
    // Fade out afterimage
    this.scene.tweens.add({
      targets: afterimage,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        const index = this.afterimages.indexOf(afterimage);
        if (index > -1) {
          this.afterimages.splice(index, 1);
        }
        afterimage.destroy();
      }
    });
  }
  
  cleanupAfterimages(): void {
    // Remove any lingering afterimages
    this.afterimages = this.afterimages.filter(img => img.active);
  }

  // Damage method
  takeDamage(damage: number) {
    if (this.isDead || this.isSpinning) return; // Can't be hurt while spinning!

    const safeDamage = Math.max(0, damage);
    this.health -= safeDamage;
    
    // Screen shake
    this.scene.cameras.main.shake(100, 0.008);
    
    if (this.health <= 0) {
      if (this.hasLivingSupportBoss()) {
        // In duo phase Peter only goes down after KANNI is defeated.
        this.health = 1;
        this.fsm.goto("hurting");
      } else {
        this.fsm.goto("dying");
      }
    } else {
      this.fsm.goto("hurting");
    }
  }

  getHealthPercentage(): number {
    if (this.duoSupportMaxHealth > 0 && this.duoPeterMaxHealthCap > 0) {
      const supportHealth = this.hasLivingSupportBoss()
        ? Math.max(0, this.supportBoss?.health || 0)
        : 0;
      const combinedMax = Math.max(1, this.duoPeterMaxHealthCap + this.duoSupportMaxHealth);
      const combinedHealth = Math.max(0, this.health) + supportHealth;
      return (combinedHealth / combinedMax) * 100;
    }
    return (this.health / this.maxHealth) * 100;
  }

  activateKanniRescuePhase(
    supportBoss: SupportBossHealthPool,
    peterHealthRatio: number = 0.5,
    supportHealthRatio: number = 0.5
  ): void {
    this.supportBoss = supportBoss;
    const clampedPeterRatio = Phaser.Math.Clamp(peterHealthRatio, 0.1, 1);
    const clampedSupportRatio = Phaser.Math.Clamp(supportHealthRatio, 0.1, 1);
    this.duoPeterMaxHealthCap = Math.max(1, Math.round(this.maxHealth * clampedPeterRatio));
    this.duoSupportMaxHealth = Math.max(
      1,
      Math.round(supportBoss.maxHealth || this.maxHealth * clampedSupportRatio)
    );

    this.health = this.duoPeterMaxHealthCap;
    this.isDead = false;
    this.isHurting = false;
    this.isAttacking = false;
    this.canAttack = false;
    this.currentMeleeTargets.clear();
    this.setAngle(0);
    this.clearTint();
    this.y = this.groundY;

    if (this.body) {
      this.body.enable = true;
      this.body.setAllowGravity(false);
      this.body.setVelocity(0, 0);
    }

    const tauntAnim = this.scene.anims.exists("peter_sync_taunt_anim")
      ? "peter_sync_taunt_anim"
      : "peter_sync_idle_anim";
    this.playAnimation(tauntAnim);
  }

  notifySupportBossDefeated(supportBoss?: SupportBossHealthPool): void {
    if (supportBoss && this.supportBoss && supportBoss !== this.supportBoss) return;
    this.supportBoss = undefined;
  }

  private hasLivingSupportBoss(): boolean {
    if (!this.supportBoss) return false;
    return this.supportBoss.active && !this.supportBoss.isDead && this.supportBoss.health > 0;
  }

  private scaleSpecialAttackDamage(rawDamage: number): number {
    return Math.max(
      1,
      Math.floor(
        rawDamage *
        PETER_STRIKE_DAMAGE_MULTIPLIER *
        PETER_GLOBAL_DAMAGE_TUNING *
        this.specialDamageScaleMultiplier
      )
    );
  }

  private playSoundSafe(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    const soundManager = this.scene?.sound;
    if (!soundManager) return;
    soundManager.play(key, config);
  }

  private addSoundSafe(key: string, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | undefined {
    const soundManager = this.scene?.sound;
    if (!soundManager) return undefined;
    return soundManager.add(key, config);
  }

  initializeSounds(): void {
    // Use existing sound effects as fallbacks since Peter-specific sounds are optional
    this.glideSound = this.addSoundSafe("ski_swoosh", { volume: 0.3 });
    this.spinAttackSound = this.addSoundSafe("axe_swing", { volume: 0.4 });
    this.shockwaveLandingSound = this.addSoundSafe("player_land", { volume: 0.5 });
    this.tauntSound = this.addSoundSafe("boss_attack", { volume: 0.4 });
    this.dashSound = this.addSoundSafe("speed_boost", { volume: 0.4 });
  }

  // ========== TAUNT SYSTEM ==========
  
  getRandomTaunt(): string {
    return Phaser.Math.RND.pick(PETER_SYNC_TAUNTS);
  }
  
  getEnrageTaunt(): string {
    return Phaser.Math.RND.pick(PETER_SYNC_ENRAGE_TAUNTS);
  }
  
  getHurtTaunt(): string {
    return Phaser.Math.RND.pick(PETER_SYNC_HURT_TAUNTS);
  }
  
  showTaunt(text: string, duration: number = 2500): void {
    if (!this.scene || this.isDead) return;
    
    const bossTopY = this.y - this.displayHeight;
    const tauntText = this.scene.add.text(
      this.x,
      bossTopY - 30,
      text,
      {
        fontFamily: "PublicPixel",
        fontSize: "16px",
        color: "#ff00ff", // Hot pink text
        backgroundColor: "#000000",
        padding: { x: 8, y: 4 },
        align: "center",
        wordWrap: { width: 220 }
      }
    );
    tauntText.setOrigin(0.5, 1);
    tauntText.setDepth(150);
    
    this.scene.tweens.add({
      targets: tauntText,
      y: tauntText.y - 25,
      alpha: { from: 1, to: 0 },
      duration: duration + this.tauntExtraDurationMs,
      ease: "Power2",
      onComplete: () => tauntText.destroy()
    });
  }
  
  tryShowTaunt(): void {
    const now = this.scene.time.now;
    if (now - this.lastTauntTime < this.tauntCooldown) return;
    if (Math.random() > this.tauntChanceMultiplier) return;
    
    this.lastTauntTime = now;
    this.showTaunt(this.getRandomTaunt());
  }
  
  showEnrageTaunt(): void {
    this.showTaunt(this.getEnrageTaunt(), 3000);
  }
  
  tryShowHurtTaunt(): void {
    if (Math.random() < 0.25 * this.tauntChanceMultiplier) {
      this.showTaunt(this.getHurtTaunt(), 1500);
    }
  }

  // Override destroy
  destroy(fromScene?: boolean): void {
    if (this.meleeTrigger && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene && gameScene.enemyMeleeTriggers) {
        gameScene.enemyMeleeTriggers.remove(this.meleeTrigger, true, true);
      }
      if (this.meleeTrigger.active) {
        this.meleeTrigger.destroy();
      }
    }
    
    if (this.spinTrigger?.active) {
      this.spinTrigger.destroy();
    }
    
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
    }
    if (this.healthBarFill) {
      this.healthBarFill.destroy();
    }
    
    // Clean up afterimages
    this.afterimages.forEach(img => img.destroy());
    this.afterimages = [];
    this.glideSound?.destroy();
    this.spinAttackSound?.destroy();
    this.shockwaveLandingSound?.destroy();
    this.tauntSound?.destroy();
    this.dashSound?.destroy();
    this.supportBoss = undefined;
    this.duoPeterMaxHealthCap = 0;
    this.duoSupportMaxHealth = 0;
    
    super.destroy(fromScene);
  }
}
