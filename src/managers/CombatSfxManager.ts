import Phaser from "phaser";
import * as utils from "../utils";

export type CombatSfxEvent = "poleStrike" | "axeSwing" | "comboHit" | "enemyHit" | "impact" | "whoosh";

interface CombatSfxRule {
  keys: string[];
  volume: number;
  cooldownMs: number;
  pitchVariation: number;
  detuneVariation: number;
  maxVoices: number;
}

export interface CombatSfxPlayOptions {
  volume?: number;
  rate?: number;
  detune?: number;
  pitchVariation?: number;
  detuneVariation?: number;
  bypassCooldown?: boolean;
}

export interface LegacyCombatSfxOptions extends CombatSfxPlayOptions {
  baseVolume?: number;
}

const LEGACY_EVENT_MAP: Record<string, CombatSfxEvent> = {
  pole_strike: "poleStrike",
  axe_swing: "axeSwing",
  combo_hit: "comboHit",
  punch_hit: "comboHit",
  enemy_hit: "enemyHit",
  axe_explosion: "impact",
  boss_attack: "whoosh",
};

export class CombatSfxManager {
  private readonly pools: Map<string, Phaser.Sound.BaseSound[]> = new Map();
  private readonly lastPlayedAt: Map<CombatSfxEvent, number> = new Map();

  private readonly rules: Record<CombatSfxEvent, CombatSfxRule> = {
    poleStrike: {
      keys: ["combat_pole_01", "combat_pole_02", "pole_strike"],
      volume: 0.34,
      cooldownMs: 24,
      pitchVariation: 0.06,
      detuneVariation: 30,
      maxVoices: 4,
    },
    axeSwing: {
      keys: ["combat_axe_01", "combat_axe_02", "axe_swing", "combat_whoosh_01"],
      volume: 0.4,
      cooldownMs: 34,
      pitchVariation: 0.05,
      detuneVariation: 28,
      maxVoices: 4,
    },
    comboHit: {
      // `combat_combo_*` disabled by request.
      keys: ["combo_hit", "punch_hit"],
      volume: 0.33,
      cooldownMs: 18,
      pitchVariation: 0.08,
      detuneVariation: 55,
      maxVoices: 4,
    },
    enemyHit: {
      keys: ["combat_enemy_hit_01", "combat_enemy_hit_02", "enemy_hit"],
      volume: 0.31,
      cooldownMs: 16,
      pitchVariation: 0.09,
      detuneVariation: 70,
      maxVoices: 5,
    },
    impact: {
      keys: ["combat_enemy_hit_02", "combat_axe_02", "axe_explosion"],
      volume: 0.45,
      cooldownMs: 40,
      pitchVariation: 0.03,
      detuneVariation: 18,
      maxVoices: 3,
    },
    whoosh: {
      keys: ["combat_whoosh_01", "combat_whoosh_02", "boss_attack"],
      volume: 0.36,
      cooldownMs: 52,
      pitchVariation: 0.04,
      detuneVariation: 26,
      maxVoices: 3,
    },
  };

  constructor(private readonly scene: Phaser.Scene, private readonly maxGlobalVoices: number = 12) {}

  warmup(): void {
    for (const rule of Object.values(this.rules)) {
      for (const key of rule.keys) {
        this.getVoice(key, Math.min(2, rule.maxVoices));
      }
    }
  }

  play(event: CombatSfxEvent, options: CombatSfxPlayOptions = {}): boolean {
    const rule = this.rules[event];
    if (!rule || !this.scene || !this.scene.cache?.audio) return false;

    const now = typeof this.scene.time?.now === "number" ? this.scene.time.now : Date.now();
    const lastPlayAt = this.lastPlayedAt.get(event) ?? -Infinity;
    if (!options.bypassCooldown && now - lastPlayAt < rule.cooldownMs) {
      return false;
    }
    if (this.getActiveVoiceCount() >= this.maxGlobalVoices) {
      return false;
    }

    const loadedKeys = rule.keys.filter((key) => this.scene.cache.audio.exists(key));
    if (loadedKeys.length === 0) {
      return false;
    }

    const soundKey = Phaser.Utils.Array.GetRandom(loadedKeys);
    const sound = this.getVoice(soundKey, rule.maxVoices);
    if (!sound) {
      return false;
    }

    const pitchVariation = options.pitchVariation ?? rule.pitchVariation;
    const detuneVariation = options.detuneVariation ?? rule.detuneVariation;
    const rateJitter = pitchVariation > 0 ? Phaser.Math.FloatBetween(-pitchVariation, pitchVariation) : 0;
    const detuneJitter = detuneVariation > 0 ? Phaser.Math.Between(-detuneVariation, detuneVariation) : 0;
    const finalRate = Phaser.Math.Clamp((options.rate ?? 1) + rateJitter, 0.6, 1.9);
    const finalDetune = (options.detune ?? 0) + detuneJitter;
    const baseVolume = rule.volume * (options.volume ?? 1);
    const volumeJitter = Phaser.Math.FloatBetween(0.92, 1.08);
    const finalVolume = Phaser.Math.Clamp(baseVolume * volumeJitter, 0, 1);

    const played = sound.play({
      volume: finalVolume,
      rate: finalRate,
      detune: finalDetune,
    });
    if (played) {
      this.lastPlayedAt.set(event, now);
    }
    return !!played;
  }

  playLegacyKey(key: string, options: LegacyCombatSfxOptions = {}): boolean {
    const event = LEGACY_EVENT_MAP[key];
    if (!event) return false;
    return this.play(event, {
      volume: options.baseVolume ?? options.volume ?? 1,
      rate: options.rate,
      detune: options.detune,
      pitchVariation: options.pitchVariation,
      detuneVariation: options.detuneVariation,
      bypassCooldown: options.bypassCooldown,
    });
  }

  destroy(): void {
    for (const pool of this.pools.values()) {
      for (const sound of pool) {
        try {
          sound.stop();
          sound.destroy();
        } catch {
          // Ignore individual sound cleanup failures and continue.
        }
      }
    }
    this.pools.clear();
    this.lastPlayedAt.clear();
  }

  private getActiveVoiceCount(): number {
    let playing = 0;
    for (const pool of this.pools.values()) {
      for (const sound of pool) {
        if (sound.isPlaying) playing += 1;
      }
    }
    return playing;
  }

  private getVoice(key: string, maxVoicesForKey: number): Phaser.Sound.BaseSound | undefined {
    if (!this.scene.cache.audio.exists(key)) return undefined;

    const existingPool = this.pools.get(key) ?? [];
    const idleVoice = existingPool.find((candidate) => !candidate.isPlaying);
    if (idleVoice) return idleVoice;

    if (existingPool.length >= maxVoicesForKey) {
      return undefined;
    }

    const newVoice = utils.safeAddSound(this.scene, key, { volume: 1 });
    if (!newVoice) return undefined;

    existingPool.push(newVoice);
    this.pools.set(key, existingPool);
    return newVoice;
  }
}
