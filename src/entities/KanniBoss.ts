import Phaser from "phaser";
import * as utils from "../utils";

type Direction = "left" | "right";
const KANNI_DAMAGE_MULTIPLIER = 0.7; // -30% outgoing support-boss damage
const KANNI_DAMAGE_BUFF_MULTIPLIER = 1.3; // Keep support boss in line with global +30% boss damage buff.

const KANNI_TAUNTS: string[] = [
  '"PETER EI KAADU YKSIN!"',
  '"SPICE BOYS TULEE APUIHIN!"',
  '"SPICE BOYS: ROUND 2, LASKETAAN!"',
  '"SPICE BOYS EI PAASTA SUA HELPOLLA!"'
];

export class KanniBoss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  bossType: string = "kanni_support";
  isFinalBoss: boolean = true;
  facingDirection: Direction = "left";
  speed: number = 220;
  sprintSpeed: number = 320;
  groundY: number;

  isDead: boolean = false;
  isHurting: boolean = false;
  isAttacking: boolean = false;
  canAttack: boolean = true;
  attackCooldown: number = 1500;
  nextAttackAt: number = 0;
  currentMeleeTargets: Set<any> = new Set();

  maxHealth: number;
  health: number;
  damage: number;
  scoreValue: number = 1200;

  meleeTrigger: Phaser.GameObjects.Zone;
  private lastTauntAt: number = -99999;
  private readonly tauntCooldownMs: number = 4200;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number, peterMaxHealth: number) {
    super(scene, x, y, "pro_skier_ski_R_frame1");

    this.groundY = groundY;
    this.maxHealth = Math.max(120, Math.round(Math.max(1, peterMaxHealth) * 0.5));
    this.health = this.maxHealth;
    const difficultyMultiplier = Number((scene as any).difficultyMultiplier || 1);
    this.damage = Math.max(
      1,
      Math.round(22 * difficultyMultiplier * KANNI_DAMAGE_MULTIPLIER * KANNI_DAMAGE_BUFF_MULTIPLIER)
    );

    scene.add.existing(this);
    scene.physics.add.existing(this);

    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, 170, 0.46, 0.86);
    this.body.setAllowGravity(false);
    this.y = this.groundY;

    this.meleeTrigger = utils.createTrigger(scene, this, 0, 0, 124, 96);
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }

    this.playAnimation("pro_skier_ski_anim");
    this.setFlipX(this.facingDirection === "left");

    scene.time.delayedCall(500, () => {
      if (!this.active || this.isDead) return;
      this.showTaunt('"SPICE BOYS TULI APUIHIN!"', 1700);
    });
  }

  private showTaunt(text: string, duration: number = 1400): void {
    if (!this.scene || this.isDead || !this.active) return;
    this.lastTauntAt = this.scene.time.now;
    const taunt = this.scene.add.text(this.x, this.y - this.displayHeight - 20, text, {
      fontFamily: "PublicPixel",
      fontSize: "14px",
      color: "#ffe066",
      stroke: "#000000",
      strokeThickness: 4,
      align: "center"
    });
    taunt.setOrigin(0.5, 1);
    taunt.setDepth(150);
    this.scene.tweens.add({
      targets: taunt,
      y: taunt.y - 18,
      alpha: { from: 1, to: 0 },
      duration,
      ease: "Sine.Out",
      onComplete: () => taunt.destroy()
    });
  }

  playAnimation(animKey: string): void {
    if (!this.scene?.anims.exists(animKey)) return;
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }

  update(time: number, delta: number): void {
    if (!this.active || this.isDead || !this.scene || !this.body) return;

    this.y = this.groundY;
    this.body.setVelocityY(0);
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, 124, 96);

    const gameScene = this.scene as any;
    const player = gameScene.player;
    if (!player || player.isDead) {
      this.setVelocityX(0);
      return;
    }

    const deltaX = player.x - this.x;
    const distance = Math.abs(deltaX);
    this.facingDirection = deltaX < 0 ? "left" : "right";
    this.setFlipX(this.facingDirection === "left");

    if (!this.isHurting && !this.isAttacking) {
      if (distance > 92) {
        const chaseSpeed = distance > 250 ? this.sprintSpeed : this.speed;
        this.setVelocityX(Math.sign(deltaX) * chaseSpeed);
        if (this.anims.currentAnim?.key !== "pro_skier_ski_anim") {
          this.playAnimation("pro_skier_ski_anim");
        }
      } else {
        this.setVelocityX(0);
        if (this.canAttack && time >= this.nextAttackAt) {
          this.startAttack(time);
        }
      }
    }

    if (!this.isAttacking && !this.isHurting && time - this.lastTauntAt >= this.tauntCooldownMs) {
      if (Math.random() < 0.006) {
        this.showTaunt(Phaser.Math.RND.pick(KANNI_TAUNTS), 1300);
      }
    }
  }

  private startAttack(time: number): void {
    this.isAttacking = true;
    this.canAttack = false;
    this.currentMeleeTargets.clear();
    this.nextAttackAt = time + this.attackCooldown;
    this.playAnimation("pro_skier_attack_anim");
    utils.playManagedSound(this.scene, "pole_strike", { volume: 0.38 });

    let settled = false;
    const settleAttack = () => {
      if (settled || !this.active) return;
      settled = true;
      this.isAttacking = false;
      this.canAttack = true;
      this.currentMeleeTargets.clear();
      if (!this.isDead && !this.isHurting) {
        this.playAnimation("pro_skier_ski_anim");
      }
    };

    this.once("animationcomplete-pro_skier_attack_anim", settleAttack);
    this.scene.time.delayedCall(430, settleAttack);
  }

  takeDamage(damage: number): void {
    if (this.isDead) return;

    this.health -= damage;
    this.scene.cameras.main.shake(85, 0.006);

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.isHurting = true;
    this.setTint(0xffffff);
    this.playAnimation("pro_skier_hurt_anim");
    utils.playManagedSound(this.scene, "enemy_hit", { volume: 0.28 });

    this.scene.time.delayedCall(170, () => {
      if (!this.active || this.isDead) return;
      this.clearTint();
      this.isHurting = false;
      if (!this.isAttacking) {
        this.playAnimation("pro_skier_ski_anim");
      }
    });
  }

  getHealthPercentage(): number {
    return (this.health / this.maxHealth) * 100;
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.health = 0;
    this.isHurting = false;
    this.isAttacking = false;
    this.canAttack = false;
    this.currentMeleeTargets.clear();
    this.setVelocity(0, 0);
    if (this.body) {
      this.body.enable = false;
    }
    this.clearTint();
    this.playAnimation("pro_skier_die_anim");
    this.showTaunt('"SPICE BOYS KAATUI!"', 1200);
    this.scene.events.emit("kanniSupportDefeated", { enemy: this });
    utils.playManagedSound(this.scene, "boss_defeat", { volume: 0.4 });

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0 },
      y: this.y + 26,
      duration: 720,
      ease: "Quad.In",
      onComplete: () => {
        if (this.active) this.destroy();
      }
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.meleeTrigger && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene?.enemyMeleeTriggers) {
        gameScene.enemyMeleeTriggers.remove(this.meleeTrigger, true, true);
      }
      if (this.meleeTrigger.active) {
        this.meleeTrigger.destroy();
      }
    }
    super.destroy(fromScene);
  }
}
