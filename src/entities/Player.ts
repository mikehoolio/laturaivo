import Phaser from "phaser";
import * as utils from "../utils";
import { playerConfig, rageConfig, abilityUnlockConfig, debugConfig } from "../gameConfig.json";
import { PlayerFSM } from "./PlayerFSM";
import type { CharacterType } from "../scenes/NameInputScene";

type Direction = "left" | "right";
type ChargedInputType = "pole" | "axe" | "voltti";

interface ChargedInputState {
  isPressed: boolean;
  startedAt: number;
  consumed: boolean;
  justReleased: boolean;
}

// Player skier class for LATURAIVO
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  // State machine
  fsm: PlayerFSM;
  
  // Character type (male or female)
  characterType: CharacterType;

  // Character attributes
  facingDirection: Direction;
  baseSpeed: number;
  maxSpeed: number;
  currentSpeed: number;
  jumpPower: number;
  isOnGround: boolean;

  // State flags
  isDead: boolean;
  isAttacking: boolean;
  isHurting: boolean;
  isInvulnerable: boolean;
  isJumping: boolean;
  isSlipping: boolean;
  hurtingDuration: number;
  invulnerableTime: number;
  
  // Power-up effects
  hasSpeedBoost: boolean;
  speedBoostMultiplier: number;
  speedBoostEndTime: number;
  speedBoostEnergyRegen: number;
  hasSalmiakkiShield: boolean;
  salmiakkiEndTime: number;
  salmiakkiContactDamage: number;
  salmiakkiKnockback: number;
  
  // Voltti (flip) attack
  volttiDamage: number;
  isPerformingVoltti: boolean;
  volttiTargetsHit: Set<any>;
  
  // Trick system
  currentTrick: string | null;
  trickRotation: number;
  tricksPerformed: number;
  maxTricksPerLevel: number;

  // Rage system
  maxRage: number;
  rage: number;
  rageGainPerHit: number;
  rageGainPerStomp: number;
  rageDuration: number;
  isRaging: boolean;
  rageScreamSounds: Array<Phaser.Sound.BaseSound | undefined>;
  rageScreamKeys: string[];
  rageActivateSound?: Phaser.Sound.BaseSound;

  // Attack target tracking system
  currentMeleeTargets: Set<any>;

  // Health and energy system
  maxHealth: number;
  health: number;
  healthRegenPerTick: number;
  healthRegenIntervalMs: number;
  healthRegenAccumulatorMs: number;
  maxEnergy: number;
  energy: number;
  energyRegenRate: number;
  axeEnergyCost: number;
  poleEnergyCost: number;
  superDashAxeEnergyCost: number;
  tornadoVolttiEnergyCost: number;
  superPoleEnergyCost: number;
  stompEnergyRecovery: number;

  // Damage values
  poleDamage: number;
  axeDamage: number;
  spinKickDamage: number;
  stompDamage: number;
  stompBounce: number;

  // Attack trigger
  meleeTrigger: Phaser.GameObjects.Zone;

  // Sound effects
  poleStrikeSound?: Phaser.Sound.BaseSound;
  axeSwingSound?: Phaser.Sound.BaseSound;
  playerHurtSound?: Phaser.Sound.BaseSound;
  skiSwooshSound?: Phaser.Sound.BaseSound;
  jumpSound?: Phaser.Sound.BaseSound;
  landSound?: Phaser.Sound.BaseSound;
  deathSound?: Phaser.Sound.BaseSound;
  
  // Shadow for depth effect
  shadow?: Phaser.GameObjects.Ellipse;

  // Attack states
  isSpinKicking: boolean;
  
  // Sound effects for spin kick
  spinKickSound?: Phaser.Sound.BaseSound;
  
  // Player boundaries
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;

  // Score tracking
  score: number;
  comboCount: number;
  lastHitTime: number;
  comboTimeWindow: number;
  
  // Ground Y position (passed from scene)
  groundY: number;
  
  // Current level for ability unlocking
  currentLevel: number;
  
  // Mobile touch input state (set by GameScene from UI events)
  touchInputState: {
    jump: boolean;
    pole: boolean;
    axe: boolean;
    voltti: boolean;
    rage: boolean;
    dodge: boolean;
    left: boolean;
    right: boolean;
  } = {
    jump: false,
    pole: false,
    axe: false,
    voltti: false,
    rage: false,
    dodge: false,
    left: false,
    right: false
  };
  
  // Track touch input just pressed (for single activation)
  private lastTouchState: {
    jump: boolean;
    pole: boolean;
    axe: boolean;
    voltti: boolean;
    rage: boolean;
    dodge: boolean;
  } = {
    jump: false,
    pole: false,
    axe: false,
    voltti: false,
    rage: false,
    dodge: false
  };

  // Hold-to-charge input tracking for high-level super attacks.
  private readonly chargedInputState: Record<ChargedInputType, ChargedInputState> = {
    pole: { isPressed: false, startedAt: 0, consumed: false, justReleased: false },
    axe: { isPressed: false, startedAt: 0, consumed: false, justReleased: false },
    voltti: { isPressed: false, startedAt: 0, consumed: false, justReleased: false }
  };

  private meleeTriggerRangeOverride: number | null = null;
  private meleeTriggerWidthOverride: number | null = null;

  // High-level super attack tuning.
  private readonly superDashAxeUnlockLevel = 7;
  private readonly tornadoVolttiUnlockLevel = 5;
  private readonly superPoleUnlockLevel = 5;
  private readonly superDashAxeHoldMs = 1000;
  private readonly tornadoVolttiHoldMs = 1000;
  private readonly superPoleHoldMs = 1000;
  private readonly axeAbilityCooldownMs = 3000;
  private readonly volttiAbilityCooldownMs = 10000;
  readonly dodgeCooldownMs = 950;
  readonly dodgeDurationMs = 180;
  readonly dodgeInvulnerabilityMs = 230;
  readonly dodgeBackstepSpeed = 760;
  readonly bossPerfectDodgeGraceMs = 180;
  readonly bossPerfectDodgeRepeatBlockMs = 420;
  private axeCooldownEndsAt = 0;
  private volttiCooldownEndsAt = 0;
  private dodgeCooldownEndsAt = 0;
  private dodgePerfectWindowEndsAt = 0;
  private lastBossPerfectDodgeAt = -Infinity;
  
  // Mobile device detection for auto-aim and larger hitboxes
  isMobileDevice: boolean = false;
  
  // Auto-aim assist for mobile (finds nearest enemy in range)
  autoAimTarget: Phaser.GameObjects.Sprite | null = null;
  autoAimRange: number = 200; // Pixels to search for targets

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number, currentLevel: number = 1, characterType: CharacterType = 'male') {
    // Use male character sprite (only character available)
    const initialSprite = "player_ski_idle_R_frame1";
    super(scene, x, y, initialSprite);
    
    // Store character type
    this.characterType = characterType;
    
    // Store ground Y for collision
    this.groundY = groundY;
    
    // Store current level for ability unlocking
    this.currentLevel = currentLevel;

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Initialize character attributes
    this.facingDirection = "right";
    this.baseSpeed = playerConfig.baseSpeed.value;
    this.maxSpeed = playerConfig.maxSpeed.value;
    this.currentSpeed = this.baseSpeed;
    this.jumpPower = playerConfig.jumpPower.value;
    this.isOnGround = true;

    // Initialize state flags
    this.isDead = false;
    this.isAttacking = false;
    this.isHurting = false;
    this.isInvulnerable = false;
    this.isJumping = false;
    this.isSlipping = false;
    this.hurtingDuration = playerConfig.hurtingDuration.value;
    this.invulnerableTime = playerConfig.invulnerableTime.value;
    
    // Initialize power-up effects
    this.hasSpeedBoost = false;
    this.speedBoostMultiplier = 1.0;
    this.speedBoostEndTime = 0;
    this.speedBoostEnergyRegen = 0;
    this.hasSalmiakkiShield = false;
    this.salmiakkiEndTime = 0;
    this.salmiakkiContactDamage = 0;
    this.salmiakkiKnockback = 0;
    
    // Initialize voltti attack - INSTANT KILL for all regular enemies!
    this.volttiDamage = 9999; // Voltti deals massive damage - one-hit kill!
    this.isPerformingVoltti = false;
    this.volttiTargetsHit = new Set();
    
    // Initialize trick system - voltties increase with level (+1 per 2 levels)
    // Level 1-2: 1 voltti, Level 3-4: 2 voltteja, Level 5-6: 3 voltteja, etc.
    this.currentTrick = null;
    this.trickRotation = 0;
    this.tricksPerformed = 0;
    this.maxTricksPerLevel = 1 + Math.floor((currentLevel - 1) / 2); // +1 voltti per 2 levels

    // Initialize rage system
    this.maxRage = rageConfig.maxRage.value;
    this.rage = 0;
    this.rageGainPerHit = rageConfig.rageGainPerHit.value;
    this.rageGainPerStomp = rageConfig.rageGainPerStomp.value;
    this.rageDuration = rageConfig.rageDuration.value;
    this.isRaging = false;
    this.rageScreamSounds = [];
    this.rageScreamKeys = [];

    // Set gravity for jumping
    this.body.setGravityY(playerConfig.gravityY.value);

    // Initialize attack system
    this.currentMeleeTargets = new Set();

    // Initialize health and energy system
    this.maxHealth = playerConfig.maxHealth.value;
    this.health = this.maxHealth;
    this.healthRegenPerTick = playerConfig.healthRegenPerTick.value;
    this.healthRegenIntervalMs = playerConfig.healthRegenIntervalMs.value;
    this.healthRegenAccumulatorMs = 0;
    this.maxEnergy = playerConfig.maxEnergy.value;
    this.energy = this.maxEnergy;
    this.energyRegenRate = playerConfig.energyRegenRate.value;
    this.axeEnergyCost = playerConfig.axeEnergyCost.value;
    this.poleEnergyCost = playerConfig.poleEnergyCost.value;
    // Voltti/pole supers still use stamina, while axe is an unlimited weapon gated only by hold timing.
    const superActivationEnergyCost = Math.max(1, Math.ceil(this.maxEnergy * 0.3));
    this.superDashAxeEnergyCost = 0;
    this.tornadoVolttiEnergyCost = superActivationEnergyCost;
    this.superPoleEnergyCost = superActivationEnergyCost;
    this.stompEnergyRecovery = playerConfig.stompEnergyRecovery.value;

    // Initialize damage values
    this.poleDamage = playerConfig.poleDamage.value;
    this.axeDamage = playerConfig.axeDamage.value;
    this.spinKickDamage = playerConfig.spinKickDamage.value;
    this.stompDamage = playerConfig.stompDamage.value;
    this.stompBounce = playerConfig.stompBounce.value;
    
    // Initialize attack states
    this.isSpinKicking = false;
    
    // Set player boundaries (keep player on screen)
    this.minX = 50;
    this.maxX = scene.scale.width - 50;
    this.minY = 50;
    this.maxY = groundY;

    // Initialize score
    this.score = 0;
    this.comboCount = 0;
    this.lastHitTime = 0;
    this.comboTimeWindow = 4000;

    // Use utility function to initialize sprite's size, scale, etc.
    const standardHeight = 128;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.4, 0.8);

    // Detect if on mobile for larger hitboxes and auto-aim
    this.isMobileDevice = this.detectMobileDevice();
    
    // Mobile devices get larger melee trigger for easier hits (auto-aim assistance)
    const triggerWidth = this.isMobileDevice ? 140 : 100;  // 40% larger on mobile
    const triggerHeight = this.isMobileDevice ? 110 : 80;  // 37% larger on mobile
    
    // Create attack trigger
    this.meleeTrigger = utils.createTrigger(this.scene, this, 0, 0, triggerWidth, triggerHeight);

    // Initialize sound effects
    this.initializeSounds();

    // Setup input keys
    this.setupInputs();

    // Create shadow for depth effect
    this.shadow = scene.add.ellipse(x, groundY + 5, 60, 15, 0x000000, 0.3);
    this.shadow.setDepth(0); // Shadow on ground level

    // Initialize state machine
    this.fsm = new PlayerFSM(scene, this);
  }

  setupInputs(): void {
    // Mobile-only build: all gameplay input comes from touch UI.
  }
  
  // Detect if running on mobile device
  detectMobileDevice(): boolean {
    return utils.isMobileDevice();
  }
  
  // Auto-aim: Find nearest enemy for mobile players
  findNearestEnemy(): Phaser.GameObjects.Sprite | null {
    if (!this.isMobileDevice) return null;
    
    const gameScene = this.scene as any;
    if (!gameScene.enemies) return null;
    
    let nearestEnemy: Phaser.GameObjects.Sprite | null = null;
    let nearestDistance = this.autoAimRange;
    
    // Calculate direction multiplier for forward-facing priority
    const dirMultiplier = this.facingDirection === 'right' ? 1 : -1;
    
    gameScene.enemies.children.each((enemy: Phaser.GameObjects.Sprite) => {
      if (!enemy.active || (enemy as any).isDead) return true;
      
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Prioritize enemies in facing direction (reduce effective distance by 30%)
      const effectiveDistance = (dx * dirMultiplier > 0) ? distance * 0.7 : distance;
      
      if (effectiveDistance < nearestDistance) {
        nearestDistance = effectiveDistance;
        nearestEnemy = enemy;
      }
      
      return true;
    });
    
    this.autoAimTarget = nearestEnemy;
    return nearestEnemy;
  }
  
  // Get auto-aim adjusted facing direction (for mobile)
  getAutoAimDirection(): 'left' | 'right' {
    if (!this.isMobileDevice) return this.facingDirection;
    
    const target = this.findNearestEnemy();
    if (target) {
      return target.x > this.x ? 'right' : 'left';
    }
    
    return this.facingDirection;
  }
  
  // Apply auto-aim when attacking (turns player toward nearest enemy)
  applyAutoAim(): void {
    if (!this.isMobileDevice) return;
    
    const target = this.findNearestEnemy();
    if (target) {
      // Only auto-aim if target is within reasonable range
      const dx = Math.abs(target.x - this.x);
      if (dx < this.autoAimRange) {
        this.facingDirection = target.x > this.x ? 'right' : 'left';
        this.setFlipX(this.facingDirection === 'left');
      }
    }
  }
  
  // ========== TOUCH INPUT HELPERS ==========
  
  // Check if jump was just pressed from touch UI.
  isJumpJustPressed(): boolean {
    // Check for touch just pressed (transition from false to true)
    const touchJustPressed = this.touchInputState.jump && !this.lastTouchState.jump;
    this.lastTouchState.jump = this.touchInputState.jump;
    
    return touchJustPressed;
  }
  
  // Check if pole attack was just pressed from touch UI.
  isPoleJustPressed(): boolean {
    const touchJustPressed = this.touchInputState.pole && !this.lastTouchState.pole;
    this.lastTouchState.pole = this.touchInputState.pole;
    
    return touchJustPressed;
  }
  
  // Check if axe attack was just pressed from touch UI.
  isAxeJustPressed(): boolean {
    const touchJustPressed = this.touchInputState.axe && !this.lastTouchState.axe;
    this.lastTouchState.axe = this.touchInputState.axe;
    
    return touchJustPressed;
  }
  
  // Check if voltti was just pressed from touch UI.
  isVolttiJustPressed(): boolean {
    const touchJustPressed = this.touchInputState.voltti && !this.lastTouchState.voltti;
    this.lastTouchState.voltti = this.touchInputState.voltti;
    
    return touchJustPressed;
  }
  
  // Check if rage was just pressed from touch UI.
  isRageJustPressed(): boolean {
    const touchJustPressed = this.touchInputState.rage && !this.lastTouchState.rage;
    this.lastTouchState.rage = this.touchInputState.rage;
    
    return touchJustPressed;
  }

  // Check if dodge was just pressed from touch UI.
  isDodgeJustPressed(): boolean {
    const touchJustPressed = this.touchInputState.dodge && !this.lastTouchState.dodge;
    this.lastTouchState.dodge = this.touchInputState.dodge;
    return touchJustPressed;
  }

  private updateChargedInputTracking(time: number): void {
    const chargedButtons: ChargedInputType[] = ["pole", "axe", "voltti"];
    for (const button of chargedButtons) {
      const state = this.chargedInputState[button];
      // Track the physical hold immediately; the FSM decides whether the charged ability may fire.
      // This lets axe charging queue through boss-fight cooldowns the same way voltti charging feels.
      const isPressedNow = this.touchInputState[button];

      if (isPressedNow) {
        if (!state.isPressed) {
          state.isPressed = true;
          state.startedAt = time;
          state.consumed = false;
        }
        state.justReleased = false;
      } else if (state.isPressed) {
        state.isPressed = false;
        state.startedAt = 0;
        state.justReleased = true;
      } else if (state.justReleased) {
        // Release is a one-frame event.
        state.justReleased = false;
        state.consumed = false;
      }
    }
  }

  private isChargedInputReady(button: ChargedInputType, holdMs: number): boolean {
    const state = this.chargedInputState[button];
    if (!state.isPressed || state.consumed) return false;
    const heldMs = this.scene.time.now - state.startedAt;
    return heldMs >= holdMs;
  }

  private popChargedInputRelease(button: ChargedInputType): boolean {
    const state = this.chargedInputState[button];
    if (!state.justReleased) return false;
    state.justReleased = false;
    const wasConsumed = state.consumed;
    state.consumed = false;
    return !wasConsumed;
  }

  consumeChargedInput(button: ChargedInputType): void {
    this.chargedInputState[button].consumed = true;
  }

  isSuperDashChargeReady(): boolean {
    return this.isChargedInputReady("axe", this.superDashAxeHoldMs);
  }

  isTornadoChargeReady(): boolean {
    return this.isChargedInputReady("voltti", this.tornadoVolttiHoldMs);
  }

  isSuperPoleChargeReady(): boolean {
    return this.isChargedInputReady("pole", this.superPoleHoldMs);
  }

  isAxeReleasedWithoutCharge(): boolean {
    return this.popChargedInputRelease("axe");
  }

  isVolttiReleasedWithoutCharge(): boolean {
    return this.popChargedInputRelease("voltti");
  }

  isPoleReleasedWithoutCharge(): boolean {
    return this.popChargedInputRelease("pole");
  }

  isAxeAbilityReady(now: number = this.scene?.time?.now ?? 0): boolean {
    return now >= this.axeCooldownEndsAt;
  }

  isVolttiAbilityReady(now: number = this.scene?.time?.now ?? 0): boolean {
    if (this.isTutorialMode()) return true;
    return now >= this.volttiCooldownEndsAt;
  }

  getAxeCooldownRemainingMs(now: number = this.scene?.time?.now ?? 0): number {
    return Math.max(0, this.axeCooldownEndsAt - now);
  }

  getVolttiCooldownRemainingMs(now: number = this.scene?.time?.now ?? 0): number {
    return Math.max(0, this.volttiCooldownEndsAt - now);
  }

  triggerAxeCooldown(): void {
    const now = this.scene?.time?.now ?? 0;
    this.axeCooldownEndsAt = Math.max(this.axeCooldownEndsAt, now + this.axeAbilityCooldownMs);
  }

  triggerVolttiCooldown(): void {
    const now = this.scene?.time?.now ?? 0;
    this.volttiCooldownEndsAt = Math.max(this.volttiCooldownEndsAt, now + this.volttiAbilityCooldownMs);
  }

  isDodgeReady(now: number = this.scene?.time?.now ?? 0): boolean {
    if (this.isTutorialMode()) return true;
    return now >= this.dodgeCooldownEndsAt;
  }

  triggerDodgeCooldown(): void {
    const now = this.scene?.time?.now ?? 0;
    this.dodgeCooldownEndsAt = Math.max(this.dodgeCooldownEndsAt, now + this.dodgeCooldownMs);
  }

  triggerDodgeInvulnerability(): void {
    const now = this.scene?.time?.now ?? 0;
    const invulnerableUntil = now + this.dodgeInvulnerabilityMs;
    this.dodgePerfectWindowEndsAt = Math.max(
      this.dodgePerfectWindowEndsAt,
      invulnerableUntil + this.bossPerfectDodgeGraceMs
    );
    this.isInvulnerable = true;
    this.scene.time.delayedCall(this.dodgeInvulnerabilityMs, () => {
      if (!this.active || this.isDead) return;
      const currentTime = this.scene?.time?.now ?? 0;
      if (currentTime < invulnerableUntil) return;
      if (!this.isHurting) {
        this.isInvulnerable = false;
      }
    });
  }

  private isBossPerfectDodgeWindowActive(now: number): boolean {
    return now <= this.dodgePerfectWindowEndsAt;
  }

  canProcessBossAttack(now: number = this.scene?.time?.now ?? 0): boolean {
    if (this.isDead) return false;
    if (!this.isInvulnerable) return true;
    return this.isBossPerfectDodgeWindowActive(now);
  }

  private canTriggerBossPerfectDodge(now: number): boolean {
    return now - this.lastBossPerfectDodgeAt >= this.bossPerfectDodgeRepeatBlockMs;
  }

  private triggerBossPerfectDodge(now: number): void {
    if (!this.canTriggerBossPerfectDodge(now)) return;
    this.lastBossPerfectDodgeAt = now;
    this.scene.events.emit("bossPerfectDodge", {
      x: this.x,
      y: this.y,
      timestamp: now
    });
  }
  
  // ========== ABILITY UNLOCK SYSTEM ==========

  private isTutorialMode(): boolean {
    return (this.scene as any)?.isTutorial === true;
  }
  
  // Check if jump is unlocked (always true for level 1+)
  isJumpUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= abilityUnlockConfig.jumpUnlockLevel.value;
  }
  
  // Check if pole strike is unlocked (level 1+)
  isPoleStrikeUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= abilityUnlockConfig.poleStrikeUnlockLevel.value;
  }
  
  // Check if axe attack is unlocked (level 2+)
  isAxeAttackUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= abilityUnlockConfig.axeAttackUnlockLevel.value;
  }
  
  // Check if dash axe (upgraded axe) is unlocked (level 6+)
  isDashAxeUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= 6;
  }

  // Check if charged super dash axe is unlocked (level 7+)
  isSuperDashAxeUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= this.superDashAxeUnlockLevel;
  }

  // Check if charged tornado voltti is unlocked (level 8+)
  isTornadoVolttiUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= this.tornadoVolttiUnlockLevel;
  }

  // Check if charged super pole frenzy is unlocked (level 9+)
  isSuperPoleUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= this.superPoleUnlockLevel;
  }
  
  // Get dash axe damage
  getDashAxeDamage(): number {
    return 100;
  }
  
  // Check if rage/laturaivo is unlocked (level 3+)
  isRageUnlocked(): boolean {
    return this.isTutorialMode() || this.currentLevel >= abilityUnlockConfig.rageUnlockLevel.value;
  }

  // Get the correct animation key based on character type
  // Only male character is available
  getAnimKey(baseAnimKey: string): string {
    // Only male character - return base animation key
    return baseAnimKey;
  }

  // Play animation and reset origin and offset
  playAnimation(animKey: string) {
    // Use character-specific animation key
    const characterAnimKey = this.getAnimKey(animKey);

    // Scene transitions / death restart can briefly call FSM enter_* after sprite teardown.
    // Guard against missing animation component to prevent hard crashes on iOS.
    if (!this.scene || !this.active || !(this as any).anims) {
      return;
    }

    try {
      const sceneAnims = (this.scene as Phaser.Scene).anims;
      if (sceneAnims && !sceneAnims.exists(characterAnimKey)) {
        return;
      }
      this.play(characterAnimKey, true);
      utils.resetOriginAndOffset(this, this.facingDirection);
    } catch {
      // Ignore one-off animation failures; gameplay can continue without a fatal crash.
    }
  }

  setMeleeTriggerProfile(attackRange: number, attackWidth: number): void {
    this.meleeTriggerRangeOverride = attackRange;
    this.meleeTriggerWidthOverride = attackWidth;
  }

  clearMeleeTriggerProfile(): void {
    this.meleeTriggerRangeOverride = null;
    this.meleeTriggerWidthOverride = null;
  }

  // Main update method - called every frame
  update(time: number, delta: number) {
    // Safety check - also check if scene exists (may be undefined during shutdown)
    if (!this.body || !this.active || !this.scene) {
      return;
    }

    // Update attack trigger position (supports temporary super-attack override sizes).
    const meleeRange = this.meleeTriggerRangeOverride ?? 100;
    const meleeWidth = this.meleeTriggerWidthOverride ?? 80;
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, meleeRange, meleeWidth);
    
    // Clamp player position to boundaries
    this.x = Phaser.Math.Clamp(this.x, this.minX, this.maxX);

    // Regenerate energy (with speed boost bonus if active)
    if (this.energy < this.maxEnergy) {
      const totalRegenRate = this.energyRegenRate + (this.hasSpeedBoost ? this.speedBoostEnergyRegen : 0);
      this.energy = Math.min(this.energy + (totalRegenRate * delta / 1000), this.maxEnergy);
    }
    this.updatePassiveHealthRegen(delta);

    // Update power-up timers
    this.updatePowerUps(time);

    // Track hold/release state for charged inputs before FSM reads controls.
    this.updateChargedInputTracking(time);

    // Refresh ground state before trick input so airborne actions work immediately after jump.
    this.updateGroundState();
    
    // Update trick system
    this.updateTricks(time, delta);
    
    // Ensure scroll speed is restored after boss defeat (applies to all FSM states)
    this.updateScrollSpeed();
    
    // Update state machine
    this.fsm.update(time, delta);

    // Update flip based on facing direction
    this.setFlipX(this.facingDirection === "left");
    
    // Update shadow position and size
    if (this.shadow) {
      this.shadow.x = this.x;
      this.shadow.y = this.groundY + 5;
      
      // Shadow gets smaller/lighter when jumping (further from ground)
      const heightAboveGround = this.groundY - this.y;
      const shadowScale = Math.max(0.3, 1 - (heightAboveGround / 200));
      const shadowAlpha = Math.max(0.1, 0.3 - (heightAboveGround / 500));
      this.shadow.setScale(shadowScale, shadowScale * 0.5);
      this.shadow.setAlpha(shadowAlpha);
    }
  }

  // Check if god mode is active (either from config or from easter egg)
  isGodModeActive(): boolean {
    return debugConfig.godMode.value || this.scene.registry.get('godModeActivated') === true;
  }

  private updatePassiveHealthRegen(delta: number): void {
    if (this.isDead || this.health >= this.maxHealth) {
      this.healthRegenAccumulatorMs = 0;
      return;
    }

    this.healthRegenAccumulatorMs += delta;
    if (this.healthRegenAccumulatorMs < this.healthRegenIntervalMs) return;

    const regenTicks = Math.floor(this.healthRegenAccumulatorMs / this.healthRegenIntervalMs);
    const healAmount = regenTicks * Math.max(0, this.healthRegenPerTick);
    if (healAmount > 0) {
      this.health = Math.min(this.maxHealth, this.health + healAmount);
    }
    this.healthRegenAccumulatorMs -= regenTicks * this.healthRegenIntervalMs;

    if (this.health >= this.maxHealth) {
      this.healthRegenAccumulatorMs = 0;
    }
  }

  // Damage method
  // Boss hits are capped to prevent full-health one-shot spikes.
  takeDamage(damage: number, options?: { source?: "generic" | "boss" }) {
    // God mode - player cannot take damage
    if (this.isGodModeActive()) return;

    if (this.isDead) return;

    const now = this.scene?.time?.now ?? 0;
    const isBossHit = options?.source === "boss";
    if (isBossHit && this.isBossPerfectDodgeWindowActive(now)) {
      this.triggerBossPerfectDodge(now);
      return;
    }

    if (this.isInvulnerable) {
      return;
    }

    const damageSource = options?.source || "generic";
    const selectedDifficulty = String(this.scene?.registry?.get?.("difficulty") || "vantaa").toLowerCase();
    const applyLowStaminaPunish = selectedDifficulty === "espoo";
    const energyPercentBeforeHit = this.getEnergyPercentage();
    const lowEnergyDamagePenalty = applyLowStaminaPunish && energyPercentBeforeHit < 20;
    const exhaustedEnergyPenalty = applyLowStaminaPunish && energyPercentBeforeHit <= 2;
    const externalDamageMultiplier = Math.max(0.5, Number((this as any).bossRiskDamageMultiplier ?? 1));
    const lowEnergyDamageMultiplier = exhaustedEnergyPenalty ? 1.85 : 1.5;
    let finalDamage = lowEnergyDamagePenalty
      ? Math.max(1, Math.ceil(damage * lowEnergyDamageMultiplier * externalDamageMultiplier))
      : Math.max(1, Math.ceil(damage * externalDamageMultiplier));
    if (damageSource === "boss") {
      const bossHitCap = Math.max(1, Math.floor(this.maxHealth * 0.45));
      finalDamage = Math.min(finalDamage, bossHitCap);
    }

    // Espoo-only stamina-pressure: hits drain energy and punish low stamina harder.
    if (applyLowStaminaPunish) {
      let energyLossFromHit = damageSource === "boss"
        ? Math.max(8, Math.ceil(this.maxEnergy * 0.12), Math.ceil(damage * 0.45))
        : Math.max(5, Math.ceil(this.maxEnergy * 0.06), Math.ceil(damage * 0.25));
      if (lowEnergyDamagePenalty) {
        energyLossFromHit = Math.ceil(energyLossFromHit * (exhaustedEnergyPenalty ? 1.45 : 1.25));
      }
      this.energy = Math.max(0, this.energy - energyLossFromHit);
    }

    this.health -= finalDamage;
    this.healthRegenAccumulatorMs = 0;
    this.isHurting = true;
    this.isInvulnerable = true;
    this.comboCount = 0; // Reset combo on hit

    // Switch to hurt state
    this.fsm.goto("hurting");
    
    // Screen shake and red flash for damage feedback
    this.scene.cameras.main.shake(150, 0.015);
    this.scene.cameras.main.flash(100, 255, 100, 100, true);
    
    // Emit player hit event for UI visual feedback
    this.scene.events.emit("playerHit", {
      damage: finalDamage,
      healthRemaining: this.health,
      healthPercent: this.getHealthPercentage(),
      lowEnergyDamagePenalty,
      energyPercent: this.getEnergyPercentage()
    });

    // Blinking effect during invulnerable time
    const blinkEvent = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        this.setAlpha(this.alpha === 1 ? 0.5 : 1);
      },
      repeat: Math.floor(this.invulnerableTime / 100) - 1
    });

    // End invulnerability
    this.scene.time.delayedCall(this.invulnerableTime, () => {
      this.isInvulnerable = false;
      this.setAlpha(1);
      blinkEvent.destroy();
    });
  }

  // Add score with combo system
  addScore(baseScore: number, time: number): void {
    // Check if within combo window - extend time with each hit for smoother combo chaining.
    const extendedComboWindow = this.comboTimeWindow + (this.comboCount * 200); // +200ms per combo level
    
    if (time - this.lastHitTime < extendedComboWindow) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    
    this.lastHitTime = time;
    
    // Calculate score with progressive combo multiplier
    // Combo 1 = x1.0, Combo 2 = x1.2, Combo 3 = x1.5, Combo 4 = x1.9, etc.
    // Formula: 1 + (comboCount - 1) * 0.2 + (comboCount - 1)^2 * 0.05
    const cappedCombo = Math.min(this.comboCount, 15); // Cap at 15x combo
    const comboMultiplier = 1 + (cappedCombo - 1) * 0.2 + Math.pow(cappedCombo - 1, 2) * 0.05;
    const finalScore = Math.floor(baseScore * comboMultiplier);
    this.score += finalScore;

    // Play combo sound if combo > 1 - higher pitch for higher combos
    if (this.comboCount > 1) {
      const pitchRate = Math.min(1.0 + (this.comboCount - 1) * 0.08, 1.8); // Up to 1.8x pitch
      utils.playManagedSound(this.scene, "combo_hit", {
        volume: 0.3,
        rate: pitchRate,
        pitchVariation: 0,
        detuneVariation: 0
      });
    }
  }

  // Check if current animation matches a base animation name (handles male and female variants)
  isPlayingAnimation(baseAnimName: string): boolean {
    const currentAnim = this.anims.currentAnim?.key;
    if (!currentAnim) return false;
    // Match male or female variant of the base animation
    const femaleVariant = baseAnimName.replace('player_', 'female_player_');
    return currentAnim === baseAnimName || currentAnim === femaleVariant;
  }

  // Get current attack damage based on attack type
  getCurrentDamage(): number {
    const currentState = this.fsm?.state;
    if (currentState === "superDashAxeAttacking") {
      return 220;
    }
    if (currentState === "tornadoSpinning") {
      return 70;
    }
    if (currentState === "superPoleFrenzy") {
      return 55;
    }
    if (this.isPlayingAnimation("player_pole_strike_anim")) {
      return this.poleDamage;
    } else if (this.isPlayingAnimation("player_dash_axe_attack_anim")) {
      return this.getDashAxeDamage(); // Instant kill damage for dash axe
    } else if (this.isPlayingAnimation("player_axe_attack_anim")) {
      return this.axeDamage;
    } else if (this.isPlayingAnimation("player_punch_anim") || this.isSpinKicking) {
      return this.spinKickDamage;
    }
    return this.poleDamage;
  }

  // Get health percentage
  getHealthPercentage(): number {
    return (this.health / this.maxHealth) * 100;
  }

  // Get rage percentage
  getRagePercentage(): number {
    return (this.rage / this.maxRage) * 100;
  }

  // Check if rage is full
  isRageFull(): boolean {
    return this.isTutorialMode() || this.rage >= this.maxRage;
  }

  // Add rage from successful hits - only if rage is unlocked (level 3+)
  addRage(amount: number): void {
    // Don't accumulate rage if not unlocked yet
    if (!this.isRageUnlocked()) return;
    if (this.isRaging || this.isDead) return;
    this.rage = Math.min(this.rage + amount, this.maxRage);
    
    // Emit event for UI to show rage gain effect
    this.scene.events.emit("rageGained", {
      currentRage: this.rage,
      maxRage: this.maxRage,
      percentage: this.getRagePercentage()
    });
  }

  // Check if currently in boss fight
  isInBossFight(): boolean {
    const gameScene = this.scene as any;
    return gameScene?.bossActive === true && gameScene?.bossDefeated !== true;
  }

  // Activate rage mode - kill all enemies on screen
  // DISABLED DURING BOSS FIGHTS!
  activateRage(options?: { allowDuringBossFight?: boolean; force?: boolean }): boolean {
    const allowDuringBossFight = options?.allowDuringBossFight === true;
    const force = options?.force === true;

    if ((!force && !this.isRageFull()) || this.isRaging || this.isDead) return false;
    if (!this.scene || !(this.scene as any).sound) return;
    
    // Rage is disabled during boss fights! Show clear warning to player
    if (this.isInBossFight() && !allowDuringBossFight) {
      // Play error sound and show visual feedback
      utils.playManagedSound(this.scene, "player_hurt", { volume: 0.2 });
      
      // Emit event for UI to show "rage blocked" message
      this.scene.events.emit("rageBlocked", {
        message: "RAIVO EI TOIMI BOSSIIN!"
      });
      
      // Quick flash to indicate action was blocked
      this.scene.cameras.main.flash(100, 255, 0, 0, true);
      
      return false;
    }
    
    this.isRaging = true;
    this.rage = 0;
    
    // Play rage activation audio with robust fallbacks (iOS/WebKit can intermittently skip one-shot SFX).
    const activatePlayed = this.rageActivateSound?.play({ volume: 0.95 });
    if (!activatePlayed) {
      const directPlayOk = this.scene?.sound?.play?.("rage_activate", { volume: 0.95 });
      if (!directPlayOk) {
        utils.safePlaySound(this.scene, "rage_activate", { volume: 0.95 });
      }
    }
    
    // Mix current and legacy rage screams so both sets can trigger in gameplay.
    const availableScreams = this.rageScreamKeys.length > 0
      ? this.rageScreamKeys
      : Array.from({ length: 9 }, (_, index) => `rage_scream_${index + 1}`);
    const screamIndex = Phaser.Math.Between(0, availableScreams.length - 1);
    const screamKey = availableScreams[screamIndex];
    const screamRate = Phaser.Math.FloatBetween(0.96, 1.04);
    this.scene.time.delayedCall(220, () => {
      if (!this.active || this.isDead) return;
      const sceneRef = this.scene as Phaser.Scene | undefined;
      if (!sceneRef || !(sceneRef as any).sound) return;
      const screamObj = this.rageScreamSounds[screamIndex];
      const screamPlayed = screamObj?.play({ volume: 1.0, rate: screamRate });
      if (screamPlayed) return;

      const directPlayOk = sceneRef.sound.play(screamKey, { volume: 1.0, rate: screamRate });
      if (directPlayOk) return;

      const safeSound = utils.safePlaySound(sceneRef, screamKey, { volume: 1.0, rate: screamRate });
      if (safeSound) return;

      if (utils.isIOS()) {
        const screamUrl = utils.resolveAssetUrl(sceneRef, screamKey, `assets/audio_local/${screamKey}.mp3`);
        const fallbackAudio = new Audio(screamUrl);
        fallbackAudio.volume = utils.applyGameVolume(1.0);
        fallbackAudio.preload = "auto";
        (fallbackAudio as any).playsInline = true;
        (fallbackAudio as any).webkitPlaysInline = true;
        void fallbackAudio.play().catch(() => undefined);
      }
    });
    
    // Visual effect - red tint and screen effects
    this.setTint(0xff0000);
    this.scene.cameras.main.shake(500, 0.02);
    this.scene.cameras.main.flash(200, 255, 50, 50, true);
    
    // Emit rage activated event for game scene to kill all enemies
    this.scene.events.emit("rageActivated");
    
    // End rage mode after duration
    this.scene.time.delayedCall(this.rageDuration, () => {
      this.isRaging = false;
      if (!this.hasSpeedBoost && !this.hasSalmiakkiShield) {
        this.clearTint();
      }
    });

    return true;
  }

  // Voltti uses cooldown-based availability.
  // Return 1 when ready and 0 while cooling down for legacy UI compatibility.
  getRemainingTricks(now: number = this.scene?.time?.now ?? 0): number {
    return this.isVolttiAbilityReady(now) ? 1 : 0;
  }

  // Reset tricks for new level
  resetTricksForNewLevel(): void {
    this.tricksPerformed = 0;
  }

  // Get energy percentage
  getEnergyPercentage(): number {
    return (this.energy / this.maxEnergy) * 100;
  }

  // Get speed percentage (for UI display)
  getSpeedPercentage(): number {
    return ((this.currentSpeed - this.baseSpeed * 0.5) / (this.maxSpeed - this.baseSpeed * 0.5)) * 100;
  }

  // Initialize sound effects
  initializeSounds(): void {
    if (!this.scene || !(this.scene as any).sound) return;

    this.poleStrikeSound = utils.safeAddSound(this.scene, "pole_strike", { volume: 0.3 });
    this.axeSwingSound = utils.safeAddSound(this.scene, "axe_swing", { volume: 0.3 });
    this.spinKickSound = utils.safeAddSound(this.scene, "trick_flip", { volume: 0.4 }); // Use trick_flip for spin kick sound
    this.playerHurtSound = utils.safeAddSound(this.scene, "player_hurt", { volume: 0.3 });
    this.skiSwooshSound = utils.safeAddSound(this.scene, "ski_swoosh", { volume: 0.2, loop: true });
    this.jumpSound = utils.safeAddSound(this.scene, "player_jump", { volume: 0.3 });
    this.landSound = utils.safeAddSound(this.scene, "player_land", { volume: 0.3 });
    this.deathSound = utils.safeAddSound(this.scene, "fart_death", { volume: 0.5 }); // Fart sound for death

    // Initialize rage sounds
    this.rageActivateSound = utils.safeAddSound(this.scene, "rage_activate", { volume: 0.95 });
    this.rageScreamSounds = [];
    this.rageScreamKeys = [];
    const screamKeys = [
      ...Array.from({ length: 9 }, (_, index) => `rage_scream_${index + 1}`),
      ...Array.from({ length: 9 }, (_, index) => `rage_scream_legacy_${index + 1}`)
    ];
    for (const screamKey of screamKeys) {
      this.rageScreamKeys.push(screamKey);
      this.rageScreamSounds.push(utils.safeAddSound(this.scene, screamKey, { volume: 1.0 }));
    }
  }

  // Check if player is on ground and clamp to ground level
  updateGroundState(): void {
    const wasOnGround = this.isOnGround;
    
    // Ground collision: if player's feet (y position since origin is 0.5, 1.0) is at or below ground
    // AND player is moving downward (velocity.y > 0) or stationary
    // This prevents canceling upward jump velocity
    if (this.y >= this.groundY && this.body.velocity.y >= 0) {
      // Clamp to ground
      this.y = this.groundY;
      this.body.setVelocityY(0);
      this.isOnGround = true;
    } else {
      this.isOnGround = false;
    }
    
    // Play land sound when landing
    if (!wasOnGround && this.isOnGround && this.isJumping) {
      this.landSound?.play();
      this.isJumping = false;
      
      // Create landing dust effect (call GameScene method if available)
      const gameScene = this.scene as any;
      if (gameScene.createLandingEffect) {
        gameScene.createLandingEffect();
      }
    }
  }

  // Check if player is falling (for stomp detection)
  isFalling(): boolean {
    return this.body.velocity.y > 0 && !this.isOnGround;
  }

  // Perform stomp bounce after landing on enemy
  performStompBounce(): void {
    this.body.setVelocityY(-this.stompBounce);
    this.isJumping = true;
    this.jumpSound?.play();
    
    // Recover energy when stomping (3% of max energy)
    this.energy = Math.min(this.energy + this.stompEnergyRecovery, this.maxEnergy);
  }
  
  // ========== POWER-UP SYSTEM ==========
  
  // Apply coffee thermos power-up (speed boost + energy regen)
  applySpeedBoost(duration: number, multiplier: number, energyRegenBonus: number = 20): void {
    this.hasSpeedBoost = true;
    this.speedBoostMultiplier = multiplier;
    this.speedBoostEndTime = this.scene.time.now + duration;
    this.speedBoostEnergyRegen = energyRegenBonus;
    
    // Visual effect - yellow tint with glow
    this.setTint(0xffff00);
    
    // Play activation sound
    this.scene.sound.play("speed_boost", { volume: 0.45, rate: 1.02 });
  }
  
  // Apply Salmiakki power-up (invincibility + contact damage + knockback)
  applySalmiakkiShield(duration: number, contactDamage: number = 30, knockbackForce: number = 400): void {
    this.hasSalmiakkiShield = true;
    this.isInvulnerable = true;
    this.salmiakkiEndTime = this.scene.time.now + duration;
    this.salmiakkiContactDamage = contactDamage;
    this.salmiakkiKnockback = knockbackForce;
    
    // Visual effect - blue pulsing tint with intimidating aura
    this.setTint(0x00ffff);
    
    // Play activation sound
    this.scene.sound.play("speed_boost", { volume: 0.4, rate: 0.94 });
  }
  
  // Apply Fazer chocolate power-up (health + energy restore)
  applyHealthRestore(healthAmount: number, energyAmount: number = 50): void {
    this.health = Math.min(this.health + healthAmount, this.maxHealth);
    this.energy = Math.min(this.energy + energyAmount, this.maxEnergy);
    
    // Visual effect - green flash
    this.setTint(0x00ff00);
    this.scene.time.delayedCall(200, () => {
      if (!this.hasSpeedBoost && !this.hasSalmiakkiShield) {
        this.clearTint();
      }
    });
    
    // Play heal sound
    this.scene.sound.play("speed_boost", { volume: 0.38, rate: 0.9 });
  }
  
  // Update power-up timers
  updatePowerUps(time: number): void {
    // Check speed boost expiration
    if (this.hasSpeedBoost && time >= this.speedBoostEndTime) {
      this.hasSpeedBoost = false;
      this.speedBoostMultiplier = 1.0;
      this.speedBoostEnergyRegen = 0;
      if (!this.hasSalmiakkiShield) {
        this.clearTint();
      }
    }
    
    // Check salmiakki shield expiration
    if (this.hasSalmiakkiShield && time >= this.salmiakkiEndTime) {
      this.hasSalmiakkiShield = false;
      this.salmiakkiContactDamage = 0;
      this.salmiakkiKnockback = 0;
      this.isInvulnerable = false;
      if (!this.hasSpeedBoost) {
        this.clearTint();
      }
    }
    
    // Apply speed boost effect to current speed
    if (this.hasSpeedBoost) {
      this.currentSpeed = Math.min(this.currentSpeed * this.speedBoostMultiplier, this.maxSpeed * 1.5);
    }
  }
  
  // Update scroll speed based on game mode (boss fight vs normal)
  // This is called every frame to ensure scrolling resumes properly after boss defeat
  updateScrollSpeed(): void {
    const gameScene = this.scene as any;
    if (!gameScene) return;
    
    const isBossFight = gameScene.bossActive === true;
    const bossDefeated = gameScene.bossDefeated === true;
    
    // During active boss fight (boss not defeated yet), stop scrolling
    if (isBossFight && !bossDefeated) {
      this.currentSpeed = 0;
    } else if (bossDefeated && this.currentSpeed === 0) {
      // Boss is defeated but currentSpeed is still 0 - restore it!
      this.currentSpeed = this.baseSpeed;
    } else if (!isBossFight && this.currentSpeed === 0 && !this.isDead) {
      // Normal gameplay but speed is 0 - restore base speed
      // This handles edge cases where speed might get stuck at 0
      this.currentSpeed = this.baseSpeed;
    }
  }
  
  // ========== TRICK SYSTEM ==========
  
  // Start performing a trick while airborne - VOLTTI IS NOW AN ATTACK!
  startTrick(): void {
    if (this.isOnGround || this.currentTrick !== null || this.isAttacking) return;
    if (!this.isVolttiAbilityReady()) return;

    this.triggerVolttiCooldown();
    
    // Always do a flip (voltti) - this is now also an attack!
    this.currentTrick = "flip";
    this.trickRotation = 0;
    this.isPerformingVoltti = true;
    this.volttiTargetsHit.clear(); // Reset targets for new voltti
    
    // Play trick sound
    this.scene.sound.play("trick_flip", { volume: 0.4 });
    
    // GAME FEEL: Add brief slow-motion for dramatic effect
    this.scene.time.timeScale = 0.4;
    this.scene.time.delayedCall(150, () => {
      this.scene.time.timeScale = 1.0;
    });
    
    // Enhanced screen shake for voltti impact
    this.scene.cameras.main.shake(120, 0.025);
    
    // Flash effect
    this.scene.cameras.main.flash(80, 255, 200, 100, true);
    
    // Emit event to trigger area damage - kill all nearby enemies instantly!
    this.scene.events.emit("volttiAreaAttack", {
      x: this.x,
      y: this.y,
      radius: 200 // Kill all enemies within 200px radius
    });
  }
  
  // Update trick animation
  updateTricks(time: number, delta: number): void {
    // Touch+keyboard voltti input: allow as soon as jump leaves the ground.
    const effectivelyAirborne = !this.isOnGround || Math.abs(this.body.velocity.y) > 40;
    if (effectivelyAirborne && this.isVolttiJustPressed() && this.isVolttiAbilityReady()) {
      this.startTrick();
    }
    
    // Animate voltti (flip) if performing one
    if (this.currentTrick !== null) {
      const rotationSpeed = 720; // degrees per second
      this.trickRotation += rotationSpeed * delta / 1000;
      
      // Apply rotation for voltti (flip)
      this.setRotation(Phaser.Math.DegToRad(this.trickRotation));
      
      // Complete trick after full rotation
      if (this.trickRotation >= 360) {
        this.completeTrick();
      }
      
      // Cancel trick if landed before completion
      if (this.isOnGround && this.currentTrick !== null) {
        this.cancelTrick();
      }
    }
  }
  
  // Complete a trick successfully - voltti attack ends
  completeTrick(): void {
    if (this.currentTrick === null) return;
    
    this.tricksPerformed++;
    
    // Award 250 points for voltti + bonus points for enemies hit during voltti
    const basePoints = 250;
    const enemiesHitBonus = this.volttiTargetsHit.size * 100; // +100 per enemy hit
    const gameScene = this.scene as any;
    const rampVolttiBonusActive = typeof gameScene?.consumeRampVolttiPerfectBonus === "function"
      ? gameScene.consumeRampVolttiPerfectBonus()
      : false;
    const trickMultiplier = rampVolttiBonusActive ? 2 : 1;
    const finalPoints = (basePoints + enemiesHitBonus) * trickMultiplier;
    this.score += finalPoints;
    
    // Play completion sound (reduced volume 50%)
    this.scene.sound.play("trick_complete", { volume: 0.2 });
    
    // Emit event for UI to show "PERFECT!" effect
    this.scene.events.emit("trickComplete", {
      trickType: this.currentTrick,
      points: finalPoints,
      tricksRemaining: this.getRemainingTricks(),
      enemiesHit: this.volttiTargetsHit.size,
      rampBoost: rampVolttiBonusActive
    });
    
    // Reset rotation
    this.setRotation(0);
    
    // Reset trick and voltti attack state
    this.currentTrick = null;
    this.trickRotation = 0;
    this.isPerformingVoltti = false;
    this.volttiTargetsHit.clear();
  }
  
  // Cancel a trick (landed before completion)
  cancelTrick(): void {
    this.setRotation(0);
    this.currentTrick = null;
    this.trickRotation = 0;
    this.isPerformingVoltti = false;
    this.volttiTargetsHit.clear();
  }
  
  // Check if player can damage enemy with voltti
  canHitWithVoltti(enemy: any): boolean {
    return this.isPerformingVoltti && !this.volttiTargetsHit.has(enemy);
  }
  
  // Register a hit during voltti
  registerVolttiHit(enemy: any): void {
    this.volttiTargetsHit.add(enemy);
  }
  
  // Cleanup method - call this when player is destroyed or scene shuts down
  destroy(fromScene?: boolean): void {
    // Stop all sounds
    if (this.poleStrikeSound) this.poleStrikeSound.stop();
    if (this.axeSwingSound) this.axeSwingSound.stop();
    if (this.spinKickSound) this.spinKickSound.stop();
    if (this.playerHurtSound) this.playerHurtSound.stop();
    if (this.skiSwooshSound) this.skiSwooshSound.stop();
    if (this.jumpSound) this.jumpSound.stop();
    if (this.landSound) this.landSound.stop();
    if (this.deathSound) this.deathSound.stop();
    if (this.rageActivateSound) this.rageActivateSound.stop();
    
    // Stop rage scream sounds
    this.rageScreamSounds.forEach(sound => {
      if (sound) sound.stop();
    });
    this.rageScreamSounds = [];
    this.rageScreamKeys = [];
    
    // Destroy melee trigger
    if (this.meleeTrigger) {
      this.meleeTrigger.destroy();
    }
    
    // Destroy shadow
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = undefined;
    }
    
    // Clear sets
    this.currentMeleeTargets.clear();
    this.volttiTargetsHit.clear();
    
    // Call parent destroy
    super.destroy(fromScene);
  }
}
