import { Capacitor, registerPlugin } from "@capacitor/core";

interface GameCenterStatus {
  available: boolean;
  authenticated: boolean;
  alias?: string;
  playerID?: string;
}

export interface GameCenterAuthResult extends GameCenterStatus {
  nativeIOS: boolean;
  attempted: boolean;
  ok: boolean;
  message: string;
}

interface SubmitScoreResult {
  submitted: boolean;
  leaderboardId: string;
  score: number;
}

interface SubmitAchievementResult {
  submitted: boolean;
  achievementId: string;
  percentComplete: number;
}

interface GameCenterPlugin {
  isAvailable(): Promise<GameCenterStatus>;
  authenticate(): Promise<GameCenterStatus>;
  submitScore(options: { leaderboardId: string; score: number }): Promise<SubmitScoreResult>;
  submitAchievement(options: {
    achievementId: string;
    percentComplete: number;
    showsCompletionBanner?: boolean;
  }): Promise<SubmitAchievementResult>;
}

const DEFAULT_GAME_CENTER_LEADERBOARD_ID = "laturaivo_global";
const STORAGE_KEY = "laturaivo_game_center_leaderboard_id";

const gameCenterPlugin = registerPlugin<GameCenterPlugin>("GameCenter");

const getConfiguredLeaderboardId = (): string => {
  try {
    const fromStorage = window.localStorage?.getItem(STORAGE_KEY);
    if (fromStorage && fromStorage.trim().length > 0) {
      return fromStorage.trim();
    }
  } catch {
    // Ignore localStorage access failures.
  }

  return DEFAULT_GAME_CENTER_LEADERBOARD_ID;
};

export class GameCenterManager {
  private static lastAuthAttemptAt = 0;
  private static isAuthenticated = false;
  private static hasAttemptedMainMenuAuth = false;
  private static readonly AUTH_RETRY_COOLDOWN_MS = 5000;
  private static lastAuthStatus: GameCenterAuthResult = {
    nativeIOS: false,
    available: false,
    authenticated: false,
    attempted: false,
    ok: false,
    message: "Game Centeria ei ole tarkistettu."
  };

  private static isNativeIOS(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  }

  static isNativeIOSPlatform(): boolean {
    return this.isNativeIOS();
  }

  static getCachedStatus(): GameCenterAuthResult {
    return { ...this.lastAuthStatus };
  }

  private static storeAuthStatus(status: GameCenterAuthResult): GameCenterAuthResult {
    this.lastAuthStatus = { ...status };
    this.isAuthenticated = !!status.authenticated;
    return { ...status };
  }

  private static stringifyError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error ?? "Tuntematon virhe");
    }
  }

  private static normalizeFailureMessage(rawMessage: string): string {
    const cleaned = rawMessage
      .replace(/^Error:\s*/i, "")
      .replace(/^Game Center authentication failed:\s*/i, "")
      .trim();

    if (!cleaned) return "Tuntematon virhe";
    if (/cancelled/i.test(cleaned)) return "Kirjautuminen peruutettiin.";
    if (/not authenticated/i.test(cleaned)) return "Pelaajaa ei kirjattu Game Centeriin.";
    return cleaned;
  }

  static async getStatus(): Promise<GameCenterAuthResult> {
    if (!this.isNativeIOS()) {
      return this.storeAuthStatus({
        nativeIOS: false,
        available: false,
        authenticated: false,
        attempted: false,
        ok: false,
        message: "Game Center toimii vain iOS-sovelluksessa."
      });
    }

    try {
      const status = await gameCenterPlugin.isAvailable();
      return this.storeAuthStatus({
        nativeIOS: true,
        available: !!status.available,
        authenticated: !!status.authenticated,
        alias: status.alias,
        playerID: status.playerID,
        attempted: this.lastAuthStatus.attempted,
        ok: !!status.authenticated,
        message: status.authenticated
          ? `Kirjauduttu nimellä ${status.alias || "Pelaaja"}.`
          : (status.available
            ? "Game Center on käytettävissä, mutta pelaajaa ei ole kirjattu sisään."
            : "Game Center ei ole käytettävissä tällä laitteella.")
      });
    } catch (error) {
      return this.storeAuthStatus({
        nativeIOS: true,
        available: false,
        authenticated: false,
        attempted: this.lastAuthStatus.attempted,
        ok: false,
        message: this.normalizeFailureMessage(this.stringifyError(error))
      });
    }
  }

  static async authenticateWithStatus(options?: { force?: boolean }): Promise<GameCenterAuthResult> {
    if (!this.isNativeIOS()) {
      return this.storeAuthStatus({
        nativeIOS: false,
        available: false,
        authenticated: false,
        attempted: false,
        ok: false,
        message: "Game Center toimii vain iOS-sovelluksessa."
      });
    }
    if (this.isAuthenticated) {
      const currentStatus = await this.getStatus();
      return this.storeAuthStatus({
        ...currentStatus,
        attempted: true,
        ok: currentStatus.authenticated,
        message: currentStatus.authenticated
          ? `Kirjauduttu nimellä ${currentStatus.alias || "Pelaaja"}.`
          : currentStatus.message
      });
    }
    if (
      !options?.force &&
      Date.now() - this.lastAuthAttemptAt < this.AUTH_RETRY_COOLDOWN_MS &&
      this.lastAuthStatus.attempted
    ) {
      return this.getCachedStatus();
    }
    this.lastAuthAttemptAt = Date.now();

    try {
      const status = await gameCenterPlugin.authenticate();
      const result = this.storeAuthStatus({
        nativeIOS: true,
        available: !!status.available,
        authenticated: !!status.authenticated,
        alias: status.alias,
        playerID: status.playerID,
        attempted: true,
        ok: !!status.authenticated,
        message: status.authenticated
          ? `Kirjauduttu nimellä ${status.alias || "Pelaaja"}.`
          : "Game Center ei kirjautunut sisään."
      });
      console.log(
        `[GameCenter] authenticate available=${status.available} authenticated=${status.authenticated} alias=${status.alias || "n/a"}`
      );
      return result;
    } catch (error) {
      const result = this.storeAuthStatus({
        nativeIOS: true,
        available: true,
        authenticated: false,
        attempted: true,
        ok: false,
        message: this.normalizeFailureMessage(this.stringifyError(error))
      });
      console.debug("[GameCenter] authenticate failed", error);
      return result;
    }
  }

  static async ensureAuthenticatedForMainMenu(): Promise<GameCenterAuthResult> {
    const status = await this.getStatus();
    if (!status.nativeIOS) {
      return status;
    }
    if (status.authenticated) {
      return this.storeAuthStatus({
        ...status,
        attempted: true,
        ok: true,
        message: `Kirjauduttu nimellä ${status.alias || "Pelaaja"}.`
      });
    }
    if (this.hasAttemptedMainMenuAuth && this.lastAuthStatus.attempted) {
      return this.getCachedStatus();
    }
    this.hasAttemptedMainMenuAuth = true;
    return this.authenticateWithStatus({ force: true });
  }

  static async authenticate(): Promise<boolean> {
    const result = await this.authenticateWithStatus();
    return result.authenticated;
  }

  static async submitScore(score: number): Promise<boolean> {
    if (!this.isNativeIOS()) return false;

    const normalizedScore = Math.max(0, Math.floor(score));
    if (!Number.isFinite(normalizedScore) || normalizedScore <= 0) {
      return false;
    }

    const authResult = await this.authenticateWithStatus();
    if (!authResult.authenticated) {
      console.debug(`[GameCenter] submit skipped: ${authResult.message}`);
      return false;
    }

    const leaderboardId = getConfiguredLeaderboardId();
    if (!leaderboardId) return false;

    try {
      const result = await gameCenterPlugin.submitScore({
        leaderboardId,
        score: normalizedScore
      });
      console.log(
        `[GameCenter] submitted=${result.submitted} leaderboard=${result.leaderboardId} score=${result.score}`
      );
      return !!result.submitted;
    } catch (error) {
      console.debug("[GameCenter] submit failed", error);
      return false;
    }
  }

  static async submitAchievement(
    achievementId: string,
    percentComplete: number,
    showsCompletionBanner: boolean = percentComplete >= 100
  ): Promise<boolean> {
    if (!this.isNativeIOS()) return false;

    const normalizedAchievementId = String(achievementId || "").trim();
    if (!normalizedAchievementId) {
      return false;
    }

    const normalizedPercentComplete = Math.max(
      0,
      Math.min(100, Math.round((Number(percentComplete) || 0) * 100) / 100)
    );
    if (normalizedPercentComplete <= 0) {
      return false;
    }

    const authResult = await this.authenticateWithStatus();
    if (!authResult.authenticated) {
      console.debug(`[GameCenter] achievement submit skipped: ${authResult.message}`);
      return false;
    }

    try {
      const result = await gameCenterPlugin.submitAchievement({
        achievementId: normalizedAchievementId,
        percentComplete: normalizedPercentComplete,
        showsCompletionBanner
      });
      console.log(
        `[GameCenter] achievement submitted=${result.submitted} id=${result.achievementId} percent=${result.percentComplete}`
      );
      return !!result.submitted;
    } catch (error) {
      console.debug("[GameCenter] achievement submit failed", error);
      return false;
    }
  }
}
