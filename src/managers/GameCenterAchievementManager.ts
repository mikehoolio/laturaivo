import { GameCenterManager } from "./GameCenterManager";

export const GAME_CENTER_ACHIEVEMENT_IDS = {
  tutorialComplete: "gc_tutorial_complete",
  bossMarjaLiisa: "gc_boss_marja_liisa",
  bossElsaMummo: "gc_boss_elsa_mummo",
  bossLatuKeisari: "gc_boss_latu_keisari",
  bossSliizu: "gc_boss_sliizu",
  bossTeroAfterwork: "gc_boss_tero_afterwork",
  bossPasi: "gc_boss_pasi",
  bossSunIsisa: "gc_boss_sun_isisa",
  bossPeterKantele: "gc_boss_peter_kantele",
  bossTimoSoini: "gc_boss_timo_soini",
  campaignVantaaComplete: "gc_campaign_vantaa_complete",
  campaignLahtiComplete: "gc_campaign_lahti_complete",
  campaignNoCheat: "gc_campaign_no_cheat",
  stomps25: "gc_stomps_25",
  stompCombo5: "gc_stomp_combo_5",
  airtime3s: "gc_airtime_3s",
  perfectLandings10: "gc_perfect_landings_10",
  powerUps25: "gc_powerups_25",
  score100k: "gc_score_100k",
  enemies250: "gc_enemies_250",
  hiddenInstantRage: "gc_hidden_instant_rage",
  hiddenVolttiFail: "gc_hidden_voltti_fail",
  hiddenNoSwear: "gc_hidden_no_swear"
} as const;

export type GameCenterAchievementId =
  (typeof GAME_CENTER_ACHIEVEMENT_IDS)[keyof typeof GAME_CENTER_ACHIEVEMENT_IDS];

interface StoredAchievementState {
  progress: Record<string, number>;
  syncedProgress: Record<string, number>;
  counters: Record<string, number>;
}

const STORAGE_KEY = "laturaivo_game_center_achievement_state_v1";

export class GameCenterAchievementManager {
  private static state: StoredAchievementState | null = null;
  private static readonly inFlightIds = new Set<string>();

  private static getDefaultState(): StoredAchievementState {
    return {
      progress: {},
      syncedProgress: {},
      counters: {}
    };
  }

  private static clampProgress(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
  }

  private static loadState(): StoredAchievementState {
    if (typeof window === "undefined") {
      return this.getDefaultState();
    }

    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) {
        return this.getDefaultState();
      }

      const parsed = JSON.parse(raw) as Partial<StoredAchievementState> | null;
      return {
        progress: parsed?.progress && typeof parsed.progress === "object" ? parsed.progress : {},
        syncedProgress:
          parsed?.syncedProgress && typeof parsed.syncedProgress === "object" ? parsed.syncedProgress : {},
        counters: parsed?.counters && typeof parsed.counters === "object" ? parsed.counters : {}
      };
    } catch {
      return this.getDefaultState();
    }
  }

  private static getState(): StoredAchievementState {
    if (!this.state) {
      this.state = this.loadState();
    }
    return this.state;
  }

  private static saveState(): void {
    if (typeof window === "undefined" || !this.state) return;

    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage failures.
    }
  }

  private static getCounter(counterKey: string): number {
    return Math.max(0, Math.floor(Number(this.getState().counters[counterKey]) || 0));
  }

  private static setCounter(counterKey: string, nextValue: number): void {
    this.getState().counters[counterKey] = Math.max(0, Math.floor(Number(nextValue) || 0));
    this.saveState();
  }

  private static async queueProgress(
    achievementId: GameCenterAchievementId,
    percentComplete: number
  ): Promise<boolean> {
    const clampedProgress = this.clampProgress(percentComplete);
    if (clampedProgress <= 0) return false;

    const state = this.getState();
    const currentProgress = this.clampProgress(state.progress[achievementId] ?? 0);
    if (clampedProgress > currentProgress) {
      state.progress[achievementId] = clampedProgress;
      this.saveState();
    }

    await this.flushAchievement(achievementId);
    return clampedProgress > currentProgress;
  }

  private static async flushAchievement(achievementId: GameCenterAchievementId): Promise<boolean> {
    const state = this.getState();
    const desiredProgress = this.clampProgress(state.progress[achievementId] ?? 0);
    const syncedProgress = this.clampProgress(state.syncedProgress[achievementId] ?? 0);

    if (desiredProgress <= 0 || desiredProgress <= syncedProgress) {
      return desiredProgress > 0;
    }

    if (this.inFlightIds.has(achievementId)) {
      return false;
    }

    this.inFlightIds.add(achievementId);
    try {
      const submitted = await GameCenterManager.submitAchievement(
        achievementId,
        desiredProgress,
        desiredProgress >= 100
      );

      if (submitted) {
        state.syncedProgress[achievementId] = desiredProgress;
        this.saveState();
      }

      return submitted;
    } finally {
      this.inFlightIds.delete(achievementId);
    }
  }

  static async flushPendingAchievements(): Promise<void> {
    const state = this.getState();
    const pendingAchievements = Object.entries(state.progress)
      .filter(([achievementId, progress]) => {
        const desiredProgress = this.clampProgress(Number(progress) || 0);
        const syncedProgress = this.clampProgress(state.syncedProgress[achievementId] ?? 0);
        return desiredProgress > 0 && desiredProgress > syncedProgress;
      })
      .sort((left, right) => Number(right[1]) - Number(left[1]));

    for (const [achievementId] of pendingAchievements) {
      await this.flushAchievement(achievementId as GameCenterAchievementId);
    }
  }

  static async unlock(achievementId: GameCenterAchievementId): Promise<boolean> {
    return this.queueProgress(achievementId, 100);
  }

  static async recordIncrementalCounter(options: {
    achievementId: GameCenterAchievementId;
    counterKey: string;
    delta: number;
    target: number;
  }): Promise<boolean> {
    const normalizedTarget = Math.max(1, Math.floor(Number(options.target) || 0));
    const normalizedDelta = Math.max(0, Math.floor(Number(options.delta) || 0));
    if (normalizedDelta <= 0) return false;

    const nextCounter = this.getCounter(options.counterKey) + normalizedDelta;
    this.setCounter(options.counterKey, nextCounter);

    return this.queueProgress(
      options.achievementId,
      (Math.min(nextCounter, normalizedTarget) / normalizedTarget) * 100
    );
  }

  static async recordStomp(delta: number = 1): Promise<boolean> {
    return this.recordIncrementalCounter({
      achievementId: GAME_CENTER_ACHIEVEMENT_IDS.stomps25,
      counterKey: "stomps_total",
      delta,
      target: 25
    });
  }

  static async recordPerfectLanding(delta: number = 1): Promise<boolean> {
    return this.recordIncrementalCounter({
      achievementId: GAME_CENTER_ACHIEVEMENT_IDS.perfectLandings10,
      counterKey: "perfect_landings_total",
      delta,
      target: 10
    });
  }

  static async recordPowerUp(delta: number = 1): Promise<boolean> {
    return this.recordIncrementalCounter({
      achievementId: GAME_CENTER_ACHIEVEMENT_IDS.powerUps25,
      counterKey: "powerups_total",
      delta,
      target: 25
    });
  }

  static async recordEnemyDefeat(delta: number = 1): Promise<boolean> {
    return this.recordIncrementalCounter({
      achievementId: GAME_CENTER_ACHIEVEMENT_IDS.enemies250,
      counterKey: "enemies_defeated_total",
      delta,
      target: 250
    });
  }

  static getBossAchievementIdForBossType(bossType: string): GameCenterAchievementId | null {
    switch (bossType) {
      case "marja_liisa":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossMarjaLiisa;
      case "elsa_mummo":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossElsaMummo;
      case "jari_litmanen":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossLatuKeisari;
      case "jari_isometsa":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossSliizu;
      case "tero_afterwork":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossTeroAfterwork;
      case "jeti":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossPasi;
      case "matti_nykanen":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossSunIsisa;
      case "peter_sync":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossPeterKantele;
      case "timo_soini":
        return GAME_CENTER_ACHIEVEMENT_IDS.bossTimoSoini;
      default:
        return null;
    }
  }

  static async unlockBossAchievementForBossType(bossType: string): Promise<boolean> {
    const achievementId = this.getBossAchievementIdForBossType(bossType);
    if (!achievementId) return false;
    return this.unlock(achievementId);
  }
}
