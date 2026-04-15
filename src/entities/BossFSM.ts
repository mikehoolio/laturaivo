import Phaser from "phaser";
import FSM from "phaser3-rex-plugins/plugins/fsm.js";
import type { Boss } from "./Boss";
import * as utils from "../utils";

// Custom FSM class for managing boss states
export class BossFSM extends FSM {
  scene: Phaser.Scene;
  boss: Boss;
  private pasiNextHopAt: number = 0;
  private pasiHopTween?: Phaser.Tweens.Tween;
  private stateFailSafeTimer?: Phaser.Time.TimerEvent;
  private playerCampAnchorX: number = Number.NaN;
  private playerCampSince: number = 0;
  private lastAntiCampTriggerAt: number = -99999;
  private lastVerticalPunishAt: number = -99999;
  private lastGapCloserAt: number = -99999;
  private nextTeslaBurstAt: number = -99999;
  private evasiveBurstUntil: number = -99999;
  private evasiveDirection: number = 1;
  private lastAnimationByBucket: Map<string, string> = new Map();
  private idleEnteredAt: number = -99999;

  constructor(scene: Phaser.Scene, boss: Boss) {
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

  // Get player reference from scene
  getPlayer(): any {
    const gameScene = this.scene as any;
    return gameScene.player;
  }

  private emitAttackTelegraph(attackType: string, kind: string): void {
    const attackName = this.boss.getAttackName(attackType);
    this.scene.events.emit("bossAttackTelegraph", {
      kind,
      attackName,
      bossType: this.boss.bossType
    });
  }

  private playPasiJumpAnimation(): void {
    if (this.boss.bossType !== "jeti") return;
    const jumpAnimKey = this.boss.getAnimationKey("jump");
    if (!jumpAnimKey || !this.scene.anims.exists(jumpAnimKey)) return;
    this.boss.playAnimation(jumpAnimKey);
  }

  private restorePasiMovementAnimation(): void {
    if (this.boss.bossType !== "jeti" || this.boss.isDead || this.boss.isAttacking || this.boss.isHurting) return;
    const body: any = (this.boss as any).body;
    const velocityX = Math.abs(Number(body?.velocity?.x) || 0);
    const movementKey = velocityX > 14 ? "walk" : "idle";
    this.boss.playAnimation(this.boss.getAnimationKey(movementKey));
  }

  private tryPasiHop(chance: number = 0.016): void {
    if (this.boss.bossType !== "jeti" || this.boss.isDead || this.boss.isHurting) return;
    if (this.pasiHopTween?.isPlaying()) return;

    const now = this.scene.time.now;
    if (now < this.pasiNextHopAt) return;
    if (Math.random() > chance) return;

    const hopHeight = this.boss.isEnraged
      ? Phaser.Math.Between(170, 235)
      : Phaser.Math.Between(145, 205);
    const hopDuration = this.boss.isEnraged
      ? Phaser.Math.Between(230, 290)
      : Phaser.Math.Between(270, 350);
    const hopHold = this.boss.isEnraged
      ? Phaser.Math.Between(55, 95)
      : Phaser.Math.Between(70, 120);
    this.pasiNextHopAt = now + (this.boss.isEnraged
      ? Phaser.Math.Between(1250, 1950)
      : Phaser.Math.Between(1500, 2300));

    this.playPasiJumpAnimation();

    this.pasiHopTween = this.scene.tweens.add({
      targets: this.boss,
      y: this.boss.groundY - hopHeight,
      duration: hopDuration,
      yoyo: true,
      hold: hopHold,
      ease: "Sine.Out",
      onComplete: () => {
        if (this.boss.active) {
          this.boss.y = this.boss.groundY;
          this.restorePasiMovementAnimation();
        }
        this.pasiHopTween = undefined;
      },
      onStop: () => {
        if (this.boss.active) this.boss.y = this.boss.groundY;
        this.pasiHopTween = undefined;
      }
    });
  }

  private restoreBossCombatTint(): void {
    if (this.boss.isEnraged) {
      this.boss.setTint(0xff6666);
    } else {
      this.boss.clearTint();
    }
  }

  private scheduleAttackFailSafe(expectedState: string, timeoutMs: number, fallbackState: string = "chasing"): void {
    if (this.stateFailSafeTimer) {
      this.stateFailSafeTimer.destroy();
      this.stateFailSafeTimer = undefined;
    }
    this.stateFailSafeTimer = this.scene.time.delayedCall(timeoutMs, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      if (this.state !== expectedState) return;
      this.boss.isAttacking = false;
      this.boss.currentMeleeTargets.clear();
      this.boss.canAttack = true;
      this.restoreBossCombatTint();
      this.goto(fallbackState);
    });
  }

  private scheduleAttackUnlock(baseMs: number): void {
    const jitter = Phaser.Math.Between(-170, 230);
    const unlockMs = Math.max(220, Math.round(baseMs + jitter));
    this.scene.time.delayedCall(unlockMs, () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      this.boss.canAttack = true;
    });
  }

  private evaluateAntiCampPressure(time: number, player: any, distanceToPlayer: number): void {
    if (!this.boss.canAttack || this.boss.isAttacking || this.boss.isHurting || this.boss.isDead) return;
    if (distanceToPlayer > 420) {
      this.playerCampAnchorX = player.x;
      this.playerCampSince = time;
      return;
    }

    if (!Number.isFinite(this.playerCampAnchorX) || Math.abs(player.x - this.playerCampAnchorX) > 36) {
      this.playerCampAnchorX = player.x;
      this.playerCampSince = time;
      return;
    }

    const campDuration = time - this.playerCampSince;
    if (campDuration < 1800) return;
    if (time - this.lastAntiCampTriggerAt < 2600) return;

    this.lastAntiCampTriggerAt = time;
    this.playerCampSince = time;
    this.playerCampAnchorX = player.x;
    this.executeAttack(this.boss.currentPhase >= 3 ? "hazard" : "charge");
  }

  private finishAttackAndChase(cooldownMultiplier: number): void {
    if (this.stateFailSafeTimer) {
      this.stateFailSafeTimer.destroy();
      this.stateFailSafeTimer = undefined;
    }
    this.boss.isAttacking = false;
    this.boss.currentMeleeTargets.clear();
    this.restoreBossCombatTint();
    this.scheduleAttackUnlock(this.boss.attackCooldown * cooldownMultiplier);

    this.goto("chasing");
  }

  private pickAnimationVariant(bucket: string, candidates: string[], fallback: string): string {
    const validCandidates = candidates.filter((key) => !!key && this.scene.anims.exists(key));
    const fallbackPool = this.scene.anims.exists(fallback) ? [fallback] : [];
    const pool = validCandidates.length > 0 ? validCandidates : fallbackPool;
    if (pool.length === 0) return fallback;

    const last = this.lastAnimationByBucket.get(bucket);
    const nonRepeatPool = last ? pool.filter((key) => key !== last) : pool;
    const chosen = Phaser.Math.RND.pick(nonRepeatPool.length > 0 ? nonRepeatPool : pool);
    this.lastAnimationByBucket.set(bucket, chosen);
    return chosen;
  }

  // Idle state - Boss should be aggressive, not idle for long!
  enter_idle() {
    this.idleEnteredAt = this.scene.time.now;
    this.boss.setVelocityX(0);
    this.boss.playAnimation(this.boss.getAnimationKey("idle"));
    
    // Short idle pause before becoming aggressive again
    this.scene.time.delayedCall(140, () => {
      if (this.state !== "idle") return;
      if (!this.boss.isDead && !this.boss.isAttacking && !this.boss.isHurting) {
        this.goto("chasing");
      }
    });
  }

  update_idle(time: number, delta: number) {
    if (this.checkDeath()) return;

    const player = this.getPlayer();
    if (!player || player.isDead) return;
    if (this.boss.isChasePaused(time)) {
      this.boss.setVelocityX(0);
      return;
    }

    // Hard cap idle length so bosses keep pressure even if a delayed callback is missed.
    if (time - this.idleEnteredAt >= 450 && !this.boss.isAttacking && !this.boss.isHurting) {
      this.goto("chasing");
      return;
    }

    // Check distance to player
    const distanceToPlayer = Math.abs(this.boss.x - player.x);

    // If player is close, attack immediately!
    const attackRange = this.boss.bossType === "jeti" ? 200 : this.boss.isFinalBoss ? 180 : 140;
    
    if (distanceToPlayer <= attackRange && this.boss.canAttack) {
      // Get next attack type from phase pattern
      const attackType = this.boss.getNextAttackType();
      this.executeAttack(attackType);
    } else {
      // Always chase the player aggressively in boss fight
      this.goto("chasing");
    }
  }
  
  // Execute attack based on type
  executeAttack(attackType: string): void {
    switch (attackType) {
      case "special":
        this.goto("specialAttacking");
        break;
      case "fakeout":
        this.goto("fakeoutAttacking");
        break;
      case "hazard":
        this.goto("hazardAttacking");
        break;
      case "charge":
        this.goto("charging");
        break;
      case "combo":
        this.goto("comboAttacking");
        break;
      case "leap":
        this.goto("leapSlamming");
        break;
      case "barrage":
        this.goto("barrageAttacking");
        break;
      case "normal":
      default:
        this.goto("attacking");
        break;
    }
  }

  // Chasing state - aggressively move towards player
  enter_chasing() {
    this.boss.playAnimation(this.boss.getAnimationKey("walk"));
  }

  update_chasing(time: number, delta: number) {
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

    const walkAnimKey = this.boss.getAnimationKey("walk");
    if (
      this.scene.anims.exists(walkAnimKey) &&
      this.boss.anims.currentAnim?.key !== walkAnimKey &&
      !this.boss.isAttacking &&
      !this.boss.isHurting
    ) {
      this.boss.playAnimation(walkAnimKey);
    }

    // Predict a short lead ahead of player movement to reduce naive follow behavior.
    const playerVelocityX = Number((player as any)?.body?.velocity?.x) || 0;
    const leadOffset = Phaser.Math.Clamp(playerVelocityX * (this.boss.isEnraged ? 0.22 : 0.16), -130, 130);
    const predictedPlayerX = Phaser.Math.Clamp(
      player.x + leadOffset,
      100,
      this.scene.scale.width - 100
    );

    const directionToPlayer = predictedPlayerX < this.boss.x ? -1 : 1;
    this.boss.facingDirection = directionToPlayer < 0 ? "left" : "right";
    this.boss.syncFacingVisual();

    const distanceToPlayer = Math.abs(this.boss.x - predictedPlayerX);
    const baseAttackRange = this.boss.bossType === "jeti"
      ? 200
      : this.boss.bossType === "jari_isometsa"
        ? 185
        : this.boss.isFinalBoss
          ? 180
          : 140;
    const phaseBonusRange = this.boss.currentPhase >= 3 ? 30 : this.boss.currentPhase === 2 ? 18 : 8;
    const attackRange = baseAttackRange + phaseBonusRange;
    const personalSpace = Math.max(88, Math.round(attackRange * 0.62));
    const nearRightBoundary = this.boss.x >= this.scene.scale.width - 118;
    const nearLeftBoundary = this.boss.x <= 118;
    const playerOnBlockedSide = (directionToPlayer > 0 && nearRightBoundary) || (directionToPlayer < 0 && nearLeftBoundary);

    // Faster baseline pressure in all boss fights.
    let chaseSpeed = this.boss.isEnraged ? this.boss.speed * 1.55 : this.boss.speed * 1.22;
    if (this.boss.bossType === "jari_isometsa") {
      chaseSpeed *= 1.1;
    }

    let forcedVelocityX: number | null = null;
    // Tesla-boss burst movement: rapid short dashes to stay aggressive and avoid passive walking loops.
    if (
      this.boss.bossType === "jari_isometsa" &&
      time >= this.nextTeslaBurstAt &&
      !this.boss.isAttacking
    ) {
      const shouldBurst = playerOnBlockedSide || distanceToPlayer > attackRange * 0.9;
      if (shouldBurst) {
        const burstDir = playerOnBlockedSide ? -directionToPlayer : directionToPlayer;
        const burstScale = this.boss.currentPhase >= 3 ? 2.6 : this.boss.currentPhase === 2 ? 2.4 : 2.1;
        forcedVelocityX = burstDir * chaseSpeed * burstScale;
        this.nextTeslaBurstAt = time + Phaser.Math.Between(520, 920);
      }
    }

    // Anti-head-stomp behavior: if player is above and close, boss side-steps quickly
    // instead of tracking directly underneath.
    const playerAboveBoss = player.y < this.boss.y - 72;
    const shouldEvasiveBurst = playerAboveBoss && distanceToPlayer <= attackRange + 95;
    if (forcedVelocityX !== null) {
      this.boss.setVelocityX(forcedVelocityX);
    } else if (shouldEvasiveBurst) {
      if (time > this.evasiveBurstUntil) {
        this.evasiveDirection = directionToPlayer === 0
          ? Phaser.Math.RND.pick([-1, 1])
          : -directionToPlayer;
      }
      this.evasiveBurstUntil = Math.max(this.evasiveBurstUntil, time + 360);
      this.boss.setVelocityX(this.evasiveDirection * chaseSpeed * 1.18);

      if (this.boss.canAttack && time - this.lastVerticalPunishAt > 900) {
        this.lastVerticalPunishAt = time;
        this.executeAttack(this.boss.currentPhase >= 2 ? "leap" : "charge");
        return;
      }
    } else if (time < this.evasiveBurstUntil) {
      // Finish current evasive strafe to avoid jittery micro-turning.
      this.boss.setVelocityX(this.evasiveDirection * chaseSpeed);
    } else if (distanceToPlayer < personalSpace) {
      // Keep a small combat pocket instead of body-stacking with the player.
      this.boss.setVelocityX(-directionToPlayer * chaseSpeed * (this.boss.isEnraged ? 1.05 : 0.92));
    } else {
      const rushFactor = Phaser.Math.Clamp((distanceToPlayer - attackRange) / 260, 0.15, 1.25);
      const approachSpeed = chaseSpeed * (0.72 + rushFactor * 0.62);
      this.boss.setVelocityX(directionToPlayer * approachSpeed);
    }

    // PASI keeps hopping while pressuring the player.
    if (this.boss.bossType === "jeti") {
      const baseHopChance = distanceToPlayer > 220 ? 0.019 : 0.011;
      const hopChance = this.boss.isEnraged ? baseHopChance + 0.006 : baseHopChance;
      this.tryPasiHop(hopChance);
    }

    // Check if close enough to attack
    this.evaluateAntiCampPressure(time, player, distanceToPlayer);

    if (this.boss.bossType === "jari_isometsa" && this.boss.canAttack && playerOnBlockedSide) {
      const pinnedSideAttack = this.boss.currentPhase >= 2
        ? Phaser.Math.RND.pick(["charge", "barrage", "special", "combo"])
        : Phaser.Math.RND.pick(["charge", "combo", "barrage"]);
      this.executeAttack(pinnedSideAttack);
    } else if (distanceToPlayer <= attackRange && this.boss.canAttack) {
      const attackType = this.boss.getNextAttackType();
      this.executeAttack(attackType);
    } else if (
      this.boss.canAttack &&
      distanceToPlayer > attackRange + 150 &&
      time - this.lastGapCloserAt > 1900
    ) {
      // Smart gap-closing so bosses do not drift in passive follow loops.
      this.lastGapCloserAt = time;
      if (this.boss.bossType === "jari_isometsa") {
        this.executeAttack(Phaser.Math.RND.pick(["charge", "barrage", "combo"]));
      } else if (this.boss.currentPhase >= 3) {
        this.executeAttack(Phaser.Math.RND.pick(["charge", "leap", "barrage"]));
      } else {
        this.executeAttack("charge");
      }
    }
    // Keep chasing indefinitely - boss never gives up!
  }

  // Attacking state - powerful boss attacks!
  enter_attacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 920 : 760);
    this.boss.setVelocityX(0);
    let attackAnimKey = this.boss.getAnimationKey("attack");
    
    // Face player
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    if (this.boss.bossType === "jari_litmanen") {
      const lahtiAttackVariants = [
        "litmanen_boss_attack_anim",
        "litmanen_boss_kick_anim",
        "litmanen_boss_combo_anim"
      ];
      attackAnimKey = this.pickAnimationVariant("normal_attack", lahtiAttackVariants, attackAnimKey);
    }

    if (this.boss.bossType === "tero_afterwork") {
      const teroAttackVariants = [
        "level6_boss_attack_anim",
        "level6_boss_combo_anim",
        "level6_boss_briefcase_slam_anim"
      ];
      attackAnimKey = this.pickAnimationVariant("normal_attack", teroAttackVariants, attackAnimKey);
    }
    if (this.boss.bossType === "elsa_mummo") {
      const elsaAttackVariants = [
        "elsa_boss_attack_anim",
        "elsa_boss_combo_anim",
        "elsa_boss_uzi_attack_anim"
      ];
      attackAnimKey = this.pickAnimationVariant("normal_attack", elsaAttackVariants, attackAnimKey);
    }
    if (this.boss.bossType === "marja_liisa") {
      const monikaAttackVariants = [
        "karen_boss_attack_anim",
        "karen_boss_combo_anim",
        "karen_boss_barrage_anim"
      ];
      attackAnimKey = this.pickAnimationVariant("normal_attack", monikaAttackVariants, attackAnimKey);
    }

    this.emitAttackTelegraph("normal", "normal");
    this.boss.playAnimation(attackAnimKey);
    
    this.boss.attackSound?.play();
    this.boss.currentMeleeTargets.clear();
    
    // Try to show a taunt when attacking
    this.boss.tryShowAttackTaunt("normal");
    
    // Screen shake for boss attack - stronger for final boss
    const shakeIntensity = this.boss.isFinalBoss ? 0.015 : 0.01;
    this.scene.cameras.main.shake(200, shakeIntensity);
    
    // Flash effect for impact
    this.scene.cameras.main.flash(100, 255, 100, 100, true);
    if (this.boss.bossType === "jari_isometsa") {
      this.boss.triggerSliizuFlashPhoto(
        this.boss.x + (this.boss.facingDirection === "left" ? -42 : 42),
        this.boss.y - 72
      );
    }

    const cooldownMultiplier = this.boss.bossType === "jeti"
      ? (this.boss.isEnraged ? 0.38 : 0.5)
      : (this.boss.isEnraged ? 0.6 : 1);

    let attackResolved = false;
    const resolveAttack = () => {
      if (attackResolved) return;
      attackResolved = true;
      if (!this.boss.active || !this.scene.sys.isActive()) return;
      this.finishAttackAndChase(cooldownMultiplier);
    };

    // Normal path: animation completes.
    this.boss.once(`animationcomplete-${attackAnimKey}`, resolveAttack);
    // Safety path: if animation event is missed, never get stuck in one attack forever.
    const fallbackDurationMs = this.boss.bossType === "jari_litmanen" ? 520 : 460;
    this.scene.time.delayedCall(fallbackDurationMs, resolveAttack);
  }

  update_attacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Stand still during attack
    this.boss.setVelocityX(0);
  }

  // ========== FAKEOUT ATTACK STATE ==========
  // Wind-up feint that can be interrupted, then chains into a real punish.
  enter_fakeoutAttacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setVelocityX(0);

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    this.emitAttackTelegraph("fakeout", "charge");
    this.boss.tryShowAttackTaunt("fakeout");
    this.boss.setTint(0xffd166);
    this.boss.setInterruptWindow(680);
    const fakeoutAnim = this.scene.anims.exists(this.boss.getAnimationKey("taunt"))
      ? this.boss.getAnimationKey("taunt")
      : this.boss.getAnimationKey("charge");
    this.boss.playAnimation(fakeoutAnim);
    this.scheduleAttackFailSafe("fakeoutAttacking", 1450);

    this.scene.time.delayedCall(560, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      if (this.state !== "fakeoutAttacking") return;
      this.restoreBossCombatTint();
      this.boss.isAttacking = false;
      const followUps = this.boss.currentPhase >= 3
        ? ["combo", "charge", "hazard"]
        : ["combo", "charge"];
      const next = Phaser.Math.RND.pick(followUps);
      this.executeAttack(next);
    });
  }

  update_fakeoutAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }

  // ========== HAZARD ATTACK STATE ==========
  // Area denial zones force player movement and punish camping.
  enter_hazardAttacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(1250);
    this.boss.setVelocityX(0);
    this.boss.currentMeleeTargets.clear();

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    this.emitAttackTelegraph("hazard", "aoe");
    this.boss.tryShowAttackTaunt("hazard");
    this.boss.setTint(0x55aaff);
    const hazardAnim = this.scene.anims.exists(this.boss.getAnimationKey("barrage"))
      ? this.boss.getAnimationKey("barrage")
      : this.boss.getAnimationKey("special");
    this.boss.playAnimation(hazardAnim);
    this.scheduleAttackFailSafe("hazardAttacking", 2200);

    this.scene.time.delayedCall(420, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      this.spawnHazardZones();
    });

    this.scene.time.delayedCall(1520, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      this.finishAttackAndChase(1.25);
    });
  }

  private spawnHazardZones(): void {
    const player = this.getPlayer();
    if (!player || player.isDead || this.boss.isDead) return;

    const zoneCount = this.boss.currentPhase >= 3 ? 3 : 2;
    const radius = this.boss.isEnraged ? 124 : 106;
    const zoneColor = this.boss.bossType === "jari_litmanen"
      ? 0x4ac7ff
      : this.boss.bossType === "tero_afterwork"
        ? 0xff9f55
        : this.boss.bossType === "elsa_mummo"
          ? 0x66d95f
          : 0x6ea8ff;

    for (let i = 0; i < zoneCount; i++) {
      const x = Phaser.Math.Clamp(
        player.x + Phaser.Math.Between(-220, 220),
        130,
        this.scene.scale.width - 130
      );
      const y = this.boss.groundY - 24;
      const zone = this.scene.add.circle(x, y, radius, zoneColor, 0.14);
      zone.setDepth(165);
      zone.setStrokeStyle(4, zoneColor, 0.88);
      this.scene.tweens.add({
        targets: zone,
        alpha: { from: 0.14, to: 0.28 },
        yoyo: true,
        repeat: 3,
        duration: 140
      });

      this.scene.time.delayedCall(460, () => {
        if (!this.boss.active || this.boss.isDead) return;
        this.boss.playImpactWarningCue();
      });

      this.scene.time.delayedCall(700, () => {
        if (!zone.active) return;
        const livePlayer = this.getPlayer();
        if (livePlayer && livePlayer.canProcessBossAttack?.()) {
          const dist = Phaser.Math.Distance.Between(zone.x, zone.y, livePlayer.x, livePlayer.y - 32);
          if (dist <= radius + 26) {
            const hazardDamage = Math.max(1, Math.round(this.boss.damage * (this.boss.isEnraged ? 1.18 : 0.95)));
            livePlayer.takeDamage(hazardDamage, { source: "boss" });
            if (typeof livePlayer.setVelocityX === "function") {
              const pushDir = livePlayer.x < zone.x ? -1 : 1;
              livePlayer.setVelocityX(pushDir * 260);
            }
          }
        }
        this.scene.tweens.add({
          targets: zone,
          alpha: 0,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 180,
          onComplete: () => zone.destroy()
        });
      });
    }
  }

  update_hazardAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }

  // ========== SPECIAL ATTACK STATE ==========
  // Boss executes unique super attack logic from Boss.ts with cooldown gating.
  enter_specialAttacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 1600 : 1350);
    this.boss.setVelocityX(0);
    this.boss.currentMeleeTargets.clear();

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    this.scheduleAttackFailSafe("specialAttacking", 2100);
    const specialTriggered = this.boss.performSpecialAttack("pattern");
    if (!specialTriggered) {
      // Special was on cooldown: instantly fall back to an aggressive move.
      this.boss.isAttacking = false;
      this.boss.canAttack = true;
      if (this.boss.currentPhase >= 3) {
        this.goto("barrageAttacking");
      } else {
        this.goto("comboAttacking");
      }
      return;
    }

    const holdDurationMs = this.boss.bossType === "jeti"
      ? 1280
      : this.boss.bossType === "jari_isometsa"
        ? 920
        : 1120;
    this.scene.time.delayedCall(holdDurationMs, () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      if (this.state !== "specialAttacking") return;
      const cooldownMultiplier = this.boss.isEnraged ? 0.95 : 1.2;
      this.finishAttackAndChase(cooldownMultiplier);
    });
  }

  update_specialAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }
  
  // ========== CHARGE ATTACK STATE ==========
  // Boss charges at player with increased speed and damage
  
  enter_charging() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 1150 : 980);
    
    // Face player and prepare to charge
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }
    
    // Brief warning before charge
    this.boss.setTint(0xff8800); // Orange tint as warning
    this.scene.cameras.main.shake(100, 0.008);
    
    // Play charge-up animation (Månika has dedicated charge frames).
    const chargeAnimKey = this.boss.getAnimationKey("charge");
    if (this.scene.anims.exists(chargeAnimKey)) {
      this.boss.playAnimation(chargeAnimKey);
    } else {
      this.boss.playAnimation(this.boss.getAnimationKey("walk"));
    }
    
    // Play warning sound
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.5,
      rate: 0.7,
      pitchVariation: 0,
      detuneVariation: 0
    });
    
    this.emitAttackTelegraph("charge", "charge");
    this.boss.tryShowAttackTaunt("charge");
    this.scheduleAttackFailSafe("charging", 2000);
    
    // Start charge after brief delay
    const chargePrepDelay = this.boss.bossType === "jeti"
      ? 220
      : this.boss.bossType === "jari_isometsa"
        ? 150
        : 400;
    this.scene.time.delayedCall(chargePrepDelay, () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      if (this.state !== "charging") return;
      if (!this.boss.isDead && !this.boss.isHurting) {
        this.startChargeMovement();
      }
    });
  }
  
  startChargeMovement(): void {
    const player = this.getPlayer();
    if (!player) {
      this.goto("chasing");
      return;
    }
    
    // Charge direction
    const chargeDir = this.boss.facingDirection === "left" ? -1 : 1;
    const chargeSpeedMultiplier = this.boss.bossType === "jeti"
      ? 4.2
      : this.boss.bossType === "jari_isometsa"
        ? 5.0
        : 3;
    const chargeSpeed = this.boss.speed * chargeSpeedMultiplier;
    
    this.boss.setVelocityX(chargeDir * chargeSpeed);
    this.boss.setTint(0xff0000); // Red during charge

    if (this.boss.bossType === "tero_afterwork" && this.scene.anims.exists("level6_charge_skid_fx_anim")) {
      const skid = this.scene.add.sprite(this.boss.x, this.boss.y - 20, "level6_charge_skid_fx_frame1");
      skid.setDepth(170);
      skid.setScale(0.6);
      skid.play("level6_charge_skid_fx_anim");
      this.scene.time.delayedCall(220, () => {
        if (skid.active) skid.destroy();
      });
    } else if (this.boss.bossType === "elsa_mummo" && this.scene.anims.exists("elsa_rollator_skid_fx_anim")) {
      const skid = this.scene.add.sprite(this.boss.x, this.boss.y - 18, "elsa_rollator_skid_fx_frame1");
      skid.setDepth(170);
      skid.setScale(0.52);
      skid.play("elsa_rollator_skid_fx_anim");
      this.scene.time.delayedCall(240, () => {
        if (skid.active) skid.destroy();
      });
    }

    // Screen shake during charge
    this.scene.cameras.main.shake(300, 0.01);
    
    // Charge lasts 600ms then stop
    const chargeDuration = this.boss.bossType === "jeti"
      ? 760
      : this.boss.bossType === "jari_isometsa"
        ? 460
        : 600;
    this.scene.time.delayedCall(Math.max(120, chargeDuration - 220), () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      this.boss.playImpactWarningCue();
    });
    this.scene.time.delayedCall(chargeDuration, () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      if (this.state !== "charging") return;
      if (!this.boss.isDead) {
        this.boss.setVelocityX(0);
        
        // Attack at end of charge if player is close
        const player = this.getPlayer();
        if (player) {
          const dist = Math.abs(this.boss.x - player.x);
          if (dist < 200 && player.canProcessBossAttack?.()) {
            // Hit player with charge damage
            const chargeDamage = Math.max(1, Math.round(this.boss.damage * 1.3));
            player.takeDamage(chargeDamage, { source: "boss" });
            this.boss.attackSound?.play();
            this.boss.currentMeleeTargets.clear();
          }
        }
        
        // Restore tint
        if (this.boss.isEnraged) {
          this.boss.setTint(0xff6666);
        } else {
          this.boss.clearTint();
        }
        
        // Longer cooldown after charge
        const cooldown = this.boss.attackCooldown * (
          this.boss.bossType === "jeti"
            ? 0.7
            : this.boss.bossType === "jari_isometsa"
              ? 0.75
              : 1.5
        );
        this.scheduleAttackUnlock(cooldown);
        
        this.boss.isAttacking = false;
        this.goto("chasing");
      }
    });
  }
  
  update_charging(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Keep non-PASI bosses on ground during charge.
    if (this.boss.bossType === "jeti") return;
    this.boss.y = this.boss.groundY;
  }
  
  // ========== COMBO ATTACK STATE ==========
  // Boss performs 3 quick attacks in succession
  
  private comboHitsRemaining: number = 0;
  
  enter_comboAttacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 1200 : 1050);
    this.comboHitsRemaining = this.boss.bossType === "jeti" || this.boss.bossType === "jari_isometsa" ? 4 : 3;
    
    // Face player
    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }
    
    this.emitAttackTelegraph("combo", "combo");
    this.boss.tryShowAttackTaunt("combo");
    
    // Brief warning tint
    this.boss.setTint(0xff0000);
    this.scene.cameras.main.shake(100, 0.008);
    this.scheduleAttackFailSafe("comboAttacking", 2400);
    
    // Start combo sequence after brief delay
    this.scene.time.delayedCall(300, () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      if (this.state !== "comboAttacking") return;
      if (!this.boss.isDead && !this.boss.isHurting) {
        this.performComboHit();
      }
    });
  }
  
  performComboHit(): void {
    if (this.boss.isDead || this.comboHitsRemaining <= 0) {
      this.finishCombo();
      return;
    }
    
    this.comboHitsRemaining--;
    this.boss.currentMeleeTargets.clear();
    let comboAnimKey = this.scene.anims.exists(this.boss.getAnimationKey("combo"))
      ? this.boss.getAnimationKey("combo")
      : this.boss.getAnimationKey("attack");
    if (this.boss.bossType === "tero_afterwork") {
      const teroComboVariants = ["level6_boss_briefcase_slam_anim", "level6_boss_combo_anim"];
      comboAnimKey = this.pickAnimationVariant("combo_attack", teroComboVariants, comboAnimKey);
    } else if (this.boss.bossType === "jari_litmanen") {
      const lahtiComboVariants = ["litmanen_boss_combo_anim", "litmanen_boss_kick_anim"];
      comboAnimKey = this.pickAnimationVariant("combo_attack", lahtiComboVariants, comboAnimKey);
    } else if (this.boss.bossType === "elsa_mummo") {
      const elsaComboVariants = ["elsa_boss_combo_anim", "elsa_boss_attack_anim", "elsa_boss_uzi_attack_anim"];
      comboAnimKey = this.pickAnimationVariant("combo_attack", elsaComboVariants, comboAnimKey);
    } else if (this.boss.bossType === "marja_liisa") {
      const monikaComboVariants = ["karen_boss_combo_anim", "karen_boss_attack_anim", "karen_boss_barrage_anim"];
      comboAnimKey = this.pickAnimationVariant("combo_attack", monikaComboVariants, comboAnimKey);
    }
    this.boss.playAnimation(comboAnimKey);
    this.boss.attackSound?.play();

    const maxComboHits = this.boss.bossType === "jeti" || this.boss.bossType === "jari_isometsa" ? 4 : 3;
    const comboProgress = Phaser.Math.Clamp(maxComboHits - this.comboHitsRemaining, 1, maxComboHits);

    if (this.boss.bossType === "jeti" || this.boss.bossType === "jari_isometsa") {
      const lungeDir = this.boss.facingDirection === "left" ? -1 : 1;
      const lungeSpeed = this.boss.bossType === "jari_isometsa" ? 300 : 260;
      this.boss.setVelocityX(lungeDir * lungeSpeed);
      this.scene.time.delayedCall(90, () => {
        if (this.boss.active) this.boss.setVelocityX(0);
      });
    }
    
    // Screen shake for each hit - intensity increases with combo
    const shakeIntensity = 0.008 + comboProgress * 0.003;
    this.scene.cameras.main.shake(100, shakeIntensity);

    const player = this.getPlayer();
    if (player && !player.isDead) {
      const dist = Math.abs(this.boss.x - player.x);
      if (dist < 175 && typeof player.setVelocityX === "function") {
        const pushDir = player.x < this.boss.x ? -1 : 1;
        player.setVelocityX(pushDir * (220 + comboProgress * 45));
      }
    }
    
    // Different tint for combo attacks
    const colors = [0xffff00, 0xffa000, 0xff6600, 0xff0000];
    const colorIndex = Phaser.Math.Clamp(comboProgress - 1, 0, colors.length - 1);
    this.boss.setTint(colors[colorIndex]);

    if (this.boss.bossType === "tero_afterwork" && comboAnimKey === "level6_boss_briefcase_slam_anim" && this.scene.anims.exists("level6_briefcase_burst_vfx_anim")) {
      const burst = this.scene.add.sprite(this.boss.x, this.boss.y - 70, "level6_briefcase_burst_vfx_frame1");
      burst.setDepth(175);
      burst.setScale(0.45);
      burst.play("level6_briefcase_burst_vfx_anim");
      burst.once("animationcomplete-level6_briefcase_burst_vfx_anim", () => burst.destroy());
    }
    
    const continueCombo = () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      if (!this.boss.isDead && this.comboHitsRemaining > 0) {
        // Short delay between combo hits
        const betweenHitsDelay = this.boss.bossType === "jeti"
          ? 90
          : this.boss.bossType === "jari_isometsa"
            ? 100
            : 150;
        this.scene.time.delayedCall(betweenHitsDelay, () => {
          if (!this.scene.sys.isActive() || !this.boss.active) return;
          this.performComboHit();
        });
      } else {
        this.finishCombo();
      }
    };

    let comboHitResolved = false;
    const resolveComboHit = () => {
      if (comboHitResolved) return;
      comboHitResolved = true;
      continueCombo();
    };

    // Normal path: animation completes.
    this.boss.once(`animationcomplete-${comboAnimKey}`, resolveComboHit);
    // Safety path: if animationcomplete is missed, combo still progresses.
    const comboFallbackMs = this.boss.bossType === "jeti" ? 210 : 260;
    this.scene.time.delayedCall(comboFallbackMs, resolveComboHit);
  }
  
  finishCombo(): void {
    this.boss.isAttacking = false;
    this.boss.currentMeleeTargets.clear();
    
    // Restore tint
    if (this.boss.isEnraged) {
      this.boss.setTint(0xff6666);
    } else {
      this.boss.clearTint();
    }
    
    // Longer cooldown after combo
    const cooldown = this.boss.attackCooldown * (
      this.boss.bossType === "jeti"
        ? 0.85
        : this.boss.bossType === "jari_isometsa"
          ? 1.05
          : 2
    );
    this.scheduleAttackUnlock(cooldown);
    
    this.goto("chasing");
  }
  
  update_comboAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    
    // Stand still during combo
    this.boss.setVelocityX(0);
  }

  // ========== LEAP SLAM ATTACK STATE ==========
  enter_leapSlamming() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 1300 : 1120);
    this.boss.currentMeleeTargets.clear();
    this.boss.setVelocityX(0);

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    this.emitAttackTelegraph("leap", "aoe");
    this.boss.tryShowAttackTaunt("leap");
    this.boss.setTint(0x66ddff);
    this.scene.cameras.main.shake(120, 0.01);
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.6,
      rate: 0.75,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scheduleAttackFailSafe("leapSlamming", 2200);

    const jumpAnim = this.boss.bossType === "jeti"
      ? this.boss.getAnimationKey("jump")
      : (this.scene.anims.exists(this.boss.getAnimationKey("leap"))
        ? this.boss.getAnimationKey("leap")
        : this.boss.getAnimationKey("walk"));
    this.boss.playAnimation(jumpAnim);

    const hopHeight = this.boss.bossType === "jeti"
      ? (this.boss.isEnraged ? 255 : 210)
      : (this.boss.isEnraged ? 220 : 180);
    const hopDuration = this.boss.bossType === "jeti" ? 230 : 290;
    const impactDelay = hopDuration * 2 + 70;
    this.scene.time.delayedCall(Math.max(120, impactDelay - 220), () => {
      if (!this.scene.sys.isActive() || !this.boss.active || this.boss.isDead) return;
      this.boss.playImpactWarningCue();
    });

    this.scene.tweens.add({
      targets: this.boss,
      y: this.boss.groundY - hopHeight,
      duration: hopDuration,
      ease: "Sine.Out",
      yoyo: true,
      hold: 70,
      onComplete: () => {
        if (!this.boss.active || this.boss.isDead) return;
        this.boss.y = this.boss.groundY;
        this.resolveLeapSlamImpact();
        this.finishAttackAndChase(1.35);
      },
      onStop: () => {
        if (this.boss.active) this.boss.y = this.boss.groundY;
      }
    });
  }

  private resolveLeapSlamImpact(): void {
    const player = this.getPlayer();
    this.scene.cameras.main.shake(260, 0.02);
    this.scene.cameras.main.flash(110, 255, 220, 120, true);
    utils.playManagedSound(this.scene, "axe_explosion", {
      volume: 0.45,
      rate: 0.9,
      pitchVariation: 0,
      detuneVariation: 0
    });

    if (!player || !player.canProcessBossAttack?.()) return;

    const dist = Math.abs(this.boss.x - player.x);
    const slamRadius = this.boss.bossType === "jeti" ? 260 : 210;
    if (dist <= slamRadius) {
      const slamDamage = Math.max(1, Math.round(this.boss.damage * (this.boss.isEnraged ? 1.9 : 1.55)));
      player.takeDamage(slamDamage, { source: "boss" });
      const pushDir = player.x < this.boss.x ? -1 : 1;
      if (typeof player.setVelocityX === "function") {
        player.setVelocityX(pushDir * 320);
      }
    }
  }

  update_leapSlamming(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }

  // ========== BARRAGE ATTACK STATE ==========
  enter_barrageAttacking() {
    this.boss.isAttacking = true;
    this.boss.canAttack = false;
    this.boss.setDamageReactionLock(this.boss.bossType === "jeti" ? 1300 : 1100);
    this.boss.currentMeleeTargets.clear();
    this.boss.setVelocityX(0);

    const player = this.getPlayer();
    if (player) {
      this.boss.facingDirection = player.x < this.boss.x ? "left" : "right";
      this.boss.syncFacingVisual();
    }

    this.emitAttackTelegraph("barrage", "aoe");
    this.boss.tryShowAttackTaunt("barrage");
    this.boss.setTint(0xff66ff);
    let barrageAnimKey = this.scene.anims.exists(this.boss.getAnimationKey("barrage"))
      ? this.boss.getAnimationKey("barrage")
      : this.boss.getAnimationKey("attack");
    if (this.boss.bossType === "tero_afterwork") {
      const teroBarrageVariants = ["level6_boss_shuriken_attack_anim", "level6_boss_barrage_anim", "level6_boss_special_anim"];
      barrageAnimKey = this.pickAnimationVariant("barrage_attack", teroBarrageVariants, barrageAnimKey);
    } else if (this.boss.bossType === "elsa_mummo") {
      const elsaBarrageVariants = ["elsa_boss_uzi_attack_anim", "elsa_boss_barrage_anim", "elsa_boss_special_anim"];
      barrageAnimKey = this.pickAnimationVariant("barrage_attack", elsaBarrageVariants, barrageAnimKey);
    } else if (this.boss.bossType === "jari_litmanen") {
      const lahtiBarrageVariants = ["litmanen_boss_barrage_anim", "litmanen_boss_special_anim", "litmanen_boss_combo_anim"];
      barrageAnimKey = this.pickAnimationVariant("barrage_attack", lahtiBarrageVariants, barrageAnimKey);
    } else if (this.boss.bossType === "marja_liisa") {
      const monikaBarrageVariants = ["karen_boss_barrage_anim", "karen_boss_special_anim", "karen_boss_combo_anim"];
      barrageAnimKey = this.pickAnimationVariant("barrage_attack", monikaBarrageVariants, barrageAnimKey);
    }
    this.boss.playAnimation(barrageAnimKey);
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.55,
      rate: 1.05,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scheduleAttackFailSafe("barrageAttacking", 2400);

    const shots = this.boss.bossType === "jeti"
      ? (this.boss.isEnraged ? 6 : 5)
      : this.boss.bossType === "jari_isometsa"
        ? (this.boss.isEnraged ? 7 : 6)
        : (this.boss.isEnraged ? 5 : 4);
    const intervalMs = this.boss.bossType === "jeti"
      ? 115
      : this.boss.bossType === "jari_isometsa"
        ? 95
        : 150;

    for (let i = 0; i < shots; i++) {
      this.scene.time.delayedCall(i * intervalMs, () => {
        if (!this.boss.active || this.boss.isDead) return;
        this.fireBarrageProjectile(i, shots);
      });
    }

    const finishDelay = shots * intervalMs + 360;
    this.scene.time.delayedCall(finishDelay, () => {
      if (!this.boss.active || this.boss.isDead) return;
      this.finishAttackAndChase(1.45);
    });
  }

  private fireBarrageProjectile(shotIndex: number, totalShots: number): void {
    const player = this.getPlayer();
    if (!player || player.isDead) return;

    const spread = Phaser.Math.Linear(-54, 54, totalShots <= 1 ? 0.5 : shotIndex / (totalShots - 1));
    const startX = this.boss.facingDirection === "left" ? this.boss.x - 42 : this.boss.x + 42;
    const startY = this.boss.y - 64 + Phaser.Math.Between(-15, 15);
    const targetX = player.x + spread;
    const targetY = player.y - 42 + Phaser.Math.Between(-24, 24);
    const tint = this.boss.bossType === "jeti" ? 0x8dffbf : 0xff9cf0;

    if (this.boss.bossType === "jari_isometsa" && (shotIndex % 2 === 0 || shotIndex === totalShots - 1)) {
      this.boss.triggerSliizuFlashPhoto(targetX, targetY);
    }

    if (this.boss.bossType === "tero_afterwork") {
      const shuriken = this.scene.add.sprite(startX, startY, "level6_shuriken_vfx_frame1");
      shuriken.setDepth(175);
      shuriken.setScale(0.38);
      if (this.scene.anims.exists("level6_shuriken_vfx_anim")) {
        shuriken.play("level6_shuriken_vfx_anim");
      }

      if (this.scene.anims.exists("level6_shuriken_trail_vfx_anim")) {
        const trail = this.scene.add.sprite(startX, startY, "level6_shuriken_trail_vfx_frame1");
        trail.setDepth(170);
        trail.setScale(0.33);
        trail.play("level6_shuriken_trail_vfx_anim");
        this.scene.tweens.add({
          targets: trail,
          alpha: { from: 0.8, to: 0 },
          duration: 260,
          onComplete: () => trail.destroy()
        });
      }

      this.scene.tweens.add({
        targets: shuriken,
        x: targetX,
        y: targetY,
        alpha: 0.2,
        duration: 340,
        ease: "Sine.In",
        onComplete: () => {
          if (player && player.canProcessBossAttack?.()) {
            const dist = Phaser.Math.Distance.Between(shuriken.x, shuriken.y, player.x, player.y - 35);
            if (dist < 78) {
              const barrageDamage = Math.max(1, Math.round(this.boss.damage * 0.72));
              player.takeDamage(barrageDamage, { source: "boss" });
            }
          }
          shuriken.destroy();
        }
      });
      return;
    }

    const orb = this.scene.add.circle(startX, startY, 10, tint, 0.95);
    orb.setDepth(175);

    this.scene.tweens.add({
      targets: orb,
      x: targetX,
      y: targetY,
      alpha: 0.25,
      duration: 360,
      ease: "Sine.In",
      onComplete: () => {
        if (player && player.canProcessBossAttack?.()) {
          const dist = Phaser.Math.Distance.Between(orb.x, orb.y, player.x, player.y - 35);
          if (dist < 78) {
            const barrageDamage = Math.max(1, Math.round(this.boss.damage * 0.7));
            player.takeDamage(barrageDamage, { source: "boss" });
          }
        }
        orb.destroy();
      }
    });
  }

  update_barrageAttacking(time: number, delta: number) {
    if (this.checkDeath()) return;
    this.boss.setVelocityX(0);
  }

  // Hurting state
  enter_hurting() {
    if (this.stateFailSafeTimer) {
      this.stateFailSafeTimer.destroy();
      this.stateFailSafeTimer = undefined;
    }
    // Break any in-flight attack lock so boss can resume normal pressure after hurt stun.
    this.boss.isAttacking = false;
    this.boss.currentMeleeTargets.clear();
    this.boss.isHurting = true;
    this.boss.setVelocityX(0);
    
    // Flash white
    this.boss.setTint(0xffffff);
    
    const hurtAnimKey = this.boss.getAnimationKey("hurt");
    if (this.scene.anims.exists(hurtAnimKey)) {
      this.boss.playAnimation(hurtAnimKey);
    }
    this.boss.hitSound?.play();
    
    // Try to show a hurt taunt
    this.boss.tryShowHurtTaunt();
    
    // Short hurt stun (can be extended when player interrupts fakeouts/supers).
    const hurtStunMs = this.boss.consumeInterruptStunBonus(200);
    this.scene.time.delayedCall(hurtStunMs, () => {
      if (!this.scene.sys.isActive() || !this.boss.active) return;
      this.boss.isHurting = false;
      this.boss.canAttack = true;
      
      // Restore tint
      if (this.boss.isEnraged) {
        this.boss.setTint(0xff6666);
      } else {
        this.boss.clearTint();
      }
      
      if (!this.boss.isDead) {
        // After being hit, chase the player aggressively
        this.goto("chasing");
      }
    });
  }

  update_hurting(time: number, delta: number) {
    // Stand still while hurt
    this.boss.setVelocityX(0);
  }

  // Dying state
  enter_dying() {
    if (this.stateFailSafeTimer) {
      this.stateFailSafeTimer.destroy();
      this.stateFailSafeTimer = undefined;
    }
    this.boss.isDead = true;
    this.boss.setVelocityX(0);
    if (this.boss.body) {
      this.boss.body.setAllowGravity(false);
    }

    const dieAnimKey = this.boss.getAnimationKey("die");
    if (this.scene.anims.exists(dieAnimKey)) {
      this.boss.playAnimation(dieAnimKey);
    }

    const gameScene = this.scene as any;
    if (typeof gameScene.playBossDeathFinale === "function") {
      gameScene.playBossDeathFinale(this.boss, {
        bossType: this.boss.bossType,
        isFinalBoss: this.boss.isFinalBoss,
        scoreValue: this.boss.scoreValue
      });
      return;
    }

    // Fallback path if cinematic helper is unavailable.
    this.scene.events.emit("bossDefeated", {
      bossType: this.boss.bossType,
      isFinalBoss: this.boss.isFinalBoss,
      scoreValue: this.boss.scoreValue
    });
    if (gameScene.currentBoss === this.boss) {
      gameScene.currentBoss = undefined;
    }
    this.boss.destroy();
  }

  update_dying(time: number, delta: number) {
    // No update needed during death animation
  }
}
