// Global Leaderboard Manager - stores and retrieves leaderboard data from Supabase (with localStorage fallback)
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "./SupabaseClientFactory";
import { isOfflineModeEnabled } from "../config/offlineMode";

export interface LeaderboardEntry {
  id?: number;
  playerName: string;
  totalDistance: number;
  enemiesDefeated: number;
  levelsCompleted: number;
  score: number;
  date: string;
}

export interface LeaderboardSubmissionContext {
  leaderboardEligible?: boolean;
  cheatCodeUsed?: boolean;
  godModeActivated?: boolean;
  difficulty?: string;
  levelReached?: number;
  sessionSeconds?: number;
}

export interface LeaderboardReport {
  entryId?: number;
  playerName: string;
  score: number;
  reason: "name" | "cheat" | "abuse" | "other";
  details?: string;
}

// Supabase configuration - Using public anonymous key (safe to expose)
const SUPABASE_URL = "https://tszqlsyixbvmfninfhei.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzenFsc3lpeGJ2bWZuaW5maGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTk4OTIsImV4cCI6MjA4MzIzNTg5Mn0.XQU9o2HhhMPVkTbo62ssIoGXB14oPiKzmBYAgA_c0g0";
const TABLE_NAME = "leaderboard";
const SECURE_SUBMIT_RPC = "submit_score_secure";
const REPORTS_TABLE_NAME = "leaderboard_reports";

// Local storage fallback
const LEADERBOARD_KEY = "laturaivo_leaderboard";
const REPORTS_FALLBACK_KEY = "laturaivo_leaderboard_reports";
const SESSION_ID_KEY = "laturaivo_score_session_id";
const SESSION_STARTED_AT_KEY = "laturaivo_score_session_started_at";
const MAX_ENTRIES = 1000;

// Rate limiting and validation
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_SUBMISSIONS_PER_WINDOW = 20; // Allows retry bursts without accepting unlimited submissions.
const MIN_SCORE_THRESHOLD = 100; // Minimum score to prevent spam
const MAX_SCORE_THRESHOLD = 50000000; // Keep a high ceiling to avoid false rejects on real runs.
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 20;
const NAME_REGEX = /^[A-Z0-9 _\-ÅÄÖ]+$/;
const PROFANITY_FILTER = [
  "paska",
  "vittu",
  "saatana",
  "perkele",
  "fuck",
  "shit",
  "bitch",
  "nazi"
];

// Cached leaderboard for fast access
let cachedLeaderboard: LeaderboardEntry[] = [];
let supabaseClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let isOnline = false;

// Rate limiting tracking
let submissionHistory: { timestamp: number }[] = [];
let secureRpcAvailable: boolean | null = null;

// Listeners for leaderboard updates
type LeaderboardListener = (entries: LeaderboardEntry[]) => void;
const listeners: Set<LeaderboardListener> = new Set();

const createRandomToken = (length = 24): string => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < randomValues.length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(randomValues, (v) => alphabet[v % alphabet.length]).join("");
};

const fnv1aHash = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const getSessionId = (): string => {
  try {
    const existing = window.localStorage?.getItem(SESSION_ID_KEY);
    if (existing && existing.length > 0) return existing;
  } catch {
    // Ignore storage errors.
  }
  const created = createRandomToken(28);
  try {
    window.localStorage?.setItem(SESSION_ID_KEY, created);
  } catch {
    // Ignore storage errors.
  }
  return created;
};

const getSessionStartedAt = (): number => {
  try {
    const raw = window.sessionStorage?.getItem(SESSION_STARTED_AT_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    // Ignore storage errors.
  }
  const now = Date.now();
  try {
    window.sessionStorage?.setItem(SESSION_STARTED_AT_KEY, String(now));
  } catch {
    // Ignore storage errors.
  }
  return now;
};

const SCORE_SESSION_ID = getSessionId();
const SCORE_SESSION_STARTED_AT = getSessionStartedAt();

export class LeaderboardManager {
  static sanitizePlayerName(name: string): string {
    const normalized = String(name || "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .replace(/[^A-Z0-9 _\-ÅÄÖ]/g, "")
      .trim();
    return normalized.slice(0, MAX_NAME_LENGTH);
  }

  private static sanitizeEntry(entry: LeaderboardEntry): LeaderboardEntry {
    return {
      playerName: this.sanitizePlayerName(entry.playerName),
      totalDistance: Math.max(0, Math.floor(Number(entry.totalDistance) || 0)),
      enemiesDefeated: Math.max(0, Math.floor(Number(entry.enemiesDefeated) || 0)),
      levelsCompleted: Math.max(0, Math.floor(Number(entry.levelsCompleted) || 0)),
      score: Math.max(0, Math.floor(Number(entry.score) || 0)),
      date: String(entry.date || new Date().toISOString().split("T")[0]),
      ...(entry.id ? { id: entry.id } : {})
    };
  }

  private static sanitizeReportDetails(details: string | undefined): string {
    if (!details) return "";
    return String(details)
      .replace(/[\r\n\t]/g, " ")
      .replace(/[^a-zA-Z0-9AÅÄÖaåäö .,!?:;()_\-]/g, "")
      .trim()
      .slice(0, 220);
  }

  private static validateSubmissionContext(
    context?: LeaderboardSubmissionContext
  ): { allowed: boolean; error?: string } {
    if (!context) return { allowed: true };
    if (context.leaderboardEligible === false) {
      return { allowed: false, error: "Leaderboard disabled for this run" };
    }
    if (context.cheatCodeUsed) {
      return { allowed: false, error: "Cheat code run is not leaderboard eligible" };
    }
    if (context.godModeActivated) {
      return { allowed: false, error: "God mode run is not leaderboard eligible" };
    }
    return { allowed: true };
  }

  // Initialize Supabase client and real-time subscription
  static async initialize(): Promise<void> {
    if (isOfflineModeEnabled()) {
      isOnline = false;
      cachedLeaderboard = this.getLocalLeaderboard();
      console.debug("LeaderboardManager initialized in OFFLINE mode");
      return;
    }

    try {
      supabaseClient = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Test connection
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select("*")
        .order("score", { ascending: false })
        .limit(MAX_ENTRIES);

      if (error) {
        console.debug("Supabase connection failed, using localStorage:", error.message);
        isOnline = false;
        cachedLeaderboard = this.getLocalLeaderboard();
      } else {
        isOnline = true;
        cachedLeaderboard = (data || []).map((entry) => this.sanitizeEntry(entry as LeaderboardEntry));
        console.debug("Supabase connected, leaderboard loaded:", cachedLeaderboard.length, "entries");

        // Set up real-time subscription
        this.setupRealtimeSubscription();
      }
    } catch (e) {
      console.debug("Supabase initialization failed, using localStorage:", e);
      isOnline = false;
      cachedLeaderboard = this.getLocalLeaderboard();
    }
  }

  // Set up real-time subscription for leaderboard updates
  private static setupRealtimeSubscription(): void {
    if (!supabaseClient) return;

    realtimeChannel = supabaseClient
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: TABLE_NAME
        },
        async (payload) => {
          console.debug("Leaderboard update received:", payload.eventType);
          // Refresh the leaderboard when any change occurs
          await this.refreshLeaderboard();
        }
      )
      .subscribe();
  }

  // Refresh leaderboard from Supabase
  static async refreshLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!isOnline || !supabaseClient) {
      cachedLeaderboard = this.getLocalLeaderboard();
      return cachedLeaderboard;
    }

    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select("*")
        .order("score", { ascending: false })
        .limit(MAX_ENTRIES);

      if (error) throw error;

      cachedLeaderboard = (data || []).map((entry) => this.sanitizeEntry(entry as LeaderboardEntry));

      // Notify all listeners
      this.notifyListeners();

      return cachedLeaderboard;
    } catch (e) {
      console.error("Error refreshing leaderboard:", e);
      return cachedLeaderboard;
    }
  }

  // Add a listener for leaderboard updates
  static addListener(listener: LeaderboardListener): void {
    listeners.add(listener);
  }

  // Remove a listener
  static removeListener(listener: LeaderboardListener): void {
    listeners.delete(listener);
  }

  // Notify all listeners of leaderboard changes
  private static notifyListeners(): void {
    listeners.forEach((listener) => {
      try {
        listener(cachedLeaderboard);
      } catch (e) {
        console.error("Error notifying leaderboard listener:", e);
      }
    });
  }

  // Get all leaderboard entries sorted by score (uses cache)
  static getLeaderboard(): LeaderboardEntry[] {
    return cachedLeaderboard;
  }

  // Get leaderboard async (fetches fresh data)
  static async getLeaderboardAsync(): Promise<LeaderboardEntry[]> {
    if (isOnline) {
      return await this.refreshLeaderboard();
    }
    return this.getLocalLeaderboard();
  }

  // Get local leaderboard from localStorage
  private static getLocalLeaderboard(): LeaderboardEntry[] {
    try {
      const data = localStorage.getItem(LEADERBOARD_KEY);
      if (data) {
        const entries = JSON.parse(data) as LeaderboardEntry[];
        return entries
          .map((entry) => this.sanitizeEntry(entry))
          .sort((a, b) => b.score - a.score);
      }
    } catch (e) {
      console.error("Error loading local leaderboard:", e);
    }
    return [];
  }

  // Save to localStorage (backup)
  private static saveLocalLeaderboard(entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error("Error saving local leaderboard:", e);
    }
  }

  private static buildClientProof(
    entry: LeaderboardEntry,
    context?: LeaderboardSubmissionContext
  ): Record<string, unknown> {
    const now = Date.now();
    const nonce = createRandomToken(20);
    const sessionSeconds =
      typeof context?.sessionSeconds === "number" && context.sessionSeconds > 0
        ? Math.floor(context.sessionSeconds)
        : Math.max(1, Math.floor((now - SCORE_SESSION_STARTED_AT) / 1000));
    const hashSeed = [
      SCORE_SESSION_ID,
      nonce,
      entry.playerName,
      entry.score,
      entry.totalDistance,
      entry.enemiesDefeated,
      entry.levelsCompleted,
      context?.difficulty || "unknown",
      context?.levelReached || entry.levelsCompleted,
      navigator.userAgent || "",
      navigator.language || ""
    ].join("|");

    return {
      session_id: SCORE_SESSION_ID,
      nonce,
      client_ts_ms: now,
      session_seconds: sessionSeconds,
      run_hash: fnv1aHash(hashSeed),
      difficulty: context?.difficulty || null,
      level_reached: context?.levelReached ?? entry.levelsCompleted,
      leaderboard_eligible: context?.leaderboardEligible !== false,
      platform: navigator.platform || "unknown"
    };
  }

  private static async submitToSupabase(
    entry: LeaderboardEntry,
    context?: LeaderboardSubmissionContext
  ): Promise<void> {
    if (!isOnline || !supabaseClient) return;

    const clientProof = this.buildClientProof(entry, context);
    const rpcPayload = {
      p_player_name: entry.playerName,
      p_total_distance: entry.totalDistance,
      p_enemies_defeated: entry.enemiesDefeated,
      p_levels_completed: entry.levelsCompleted,
      p_score: entry.score,
      p_date: entry.date,
      p_client_proof: clientProof
    };

    try {
      if (secureRpcAvailable !== false) {
        const { error: rpcError } = await supabaseClient.rpc(SECURE_SUBMIT_RPC, rpcPayload);
        if (!rpcError) {
          secureRpcAvailable = true;
          await this.refreshLeaderboard();
          return;
        }

        const rpcMessage = String(rpcError.message || "");
        const missingRpc =
          /function .* does not exist/i.test(rpcMessage) ||
          /Could not find the function/i.test(rpcMessage);
        if (missingRpc) {
          secureRpcAvailable = false;
          console.debug("[Leaderboard] secure submit RPC missing, using direct insert fallback");
        } else {
          console.error("Error saving score via secure RPC:", rpcError);
          return;
        }
      }

      const { error } = await supabaseClient.from(TABLE_NAME).insert([
        {
          playerName: entry.playerName,
          totalDistance: entry.totalDistance,
          enemiesDefeated: entry.enemiesDefeated,
          levelsCompleted: entry.levelsCompleted,
          score: entry.score,
          date: entry.date
        }
      ]);
      if (error) {
        console.error("Error saving score to Supabase:", error);
        return;
      }
      await this.refreshLeaderboard();
    } catch (e) {
      console.error("Error saving to Supabase:", e);
    }
  }

  // Validate entry data before submission
  static validateEntry(entry: LeaderboardEntry): { valid: boolean; error?: string } {
    // Validate name
    if (!entry.playerName || typeof entry.playerName !== "string") {
      return { valid: false, error: "Player name is required" };
    }

    const normalizedName = this.sanitizePlayerName(entry.playerName);
    if (normalizedName.length < MIN_NAME_LENGTH) {
      return { valid: false, error: `Name must be at least ${MIN_NAME_LENGTH} characters` };
    }

    if (normalizedName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Name must be at most ${MAX_NAME_LENGTH} characters` };
    }

    if (!NAME_REGEX.test(normalizedName)) {
      return { valid: false, error: "Name contains invalid characters" };
    }

    // Basic profanity filter
    const lowerName = normalizedName.toLowerCase();
    for (const word of PROFANITY_FILTER) {
      if (lowerName.includes(word)) {
        return { valid: false, error: "Name contains inappropriate content" };
      }
    }

    // Validate score range
    if (typeof entry.score !== "number" || isNaN(entry.score)) {
      return { valid: false, error: "Invalid score" };
    }

    if (entry.score < MIN_SCORE_THRESHOLD) {
      return { valid: false, error: `Score too low (minimum ${MIN_SCORE_THRESHOLD})` };
    }

    if (entry.score > MAX_SCORE_THRESHOLD) {
      return { valid: false, error: "Score suspiciously high" };
    }

    // Validate numeric fields
    if (
      typeof entry.totalDistance !== "number" ||
      isNaN(entry.totalDistance) ||
      entry.totalDistance < 0
    ) {
      return { valid: false, error: "Invalid distance" };
    }

    if (
      typeof entry.enemiesDefeated !== "number" ||
      isNaN(entry.enemiesDefeated) ||
      entry.enemiesDefeated < 0
    ) {
      return { valid: false, error: "Invalid enemies defeated count" };
    }

    if (
      typeof entry.levelsCompleted !== "number" ||
      isNaN(entry.levelsCompleted) ||
      entry.levelsCompleted < 0 ||
      entry.levelsCompleted > 10
    ) {
      return { valid: false, error: "Invalid levels completed count" };
    }

    return { valid: true };
  }

  // Check rate limiting
  static checkRateLimit(): { allowed: boolean; error?: string } {
    const now = Date.now();

    // Clean old submissions outside the window
    submissionHistory = submissionHistory.filter((sub) => now - sub.timestamp < RATE_LIMIT_WINDOW);

    // Check submission count in current window
    if (submissionHistory.length >= MAX_SUBMISSIONS_PER_WINDOW) {
      const oldestSubmission = Math.min(...submissionHistory.map((s) => s.timestamp));
      const timeToWait = RATE_LIMIT_WINDOW - (now - oldestSubmission);
      const minutesToWait = Math.ceil(timeToWait / (60 * 1000));

      return {
        allowed: false,
        error: `Too many submissions. Please wait ${minutesToWait} minutes.`
      };
    }

    return { allowed: true };
  }

  // Add a new entry to the leaderboard with validation and rate limiting
  static async addEntry(
    entry: LeaderboardEntry,
    context?: LeaderboardSubmissionContext
  ): Promise<{ success: boolean; rank?: number; error?: string }> {
    const contextCheck = this.validateSubmissionContext(context);
    if (!contextCheck.allowed) {
      return { success: false, error: contextCheck.error };
    }

    const normalizedEntry = this.sanitizeEntry(entry);

    // Validate entry data
    const validation = this.validateEntry(normalizedEntry);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check rate limiting
    const rateCheck = this.checkRateLimit();
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error };
    }

    // Record this submission for rate limiting
    submissionHistory.push({ timestamp: Date.now() });

    // Always save locally first
    const localEntries = this.getLocalLeaderboard();
    localEntries.push(normalizedEntry);
    localEntries.sort((a, b) => b.score - a.score);
    const trimmedLocal = localEntries.slice(0, MAX_ENTRIES);
    this.saveLocalLeaderboard(trimmedLocal);

    // Try to save to Supabase with additional server-side validation
    await this.submitToSupabase(normalizedEntry, context);

    // Calculate rank from cached leaderboard if available, otherwise local fallback
    const rankSource = cachedLeaderboard.length > 0 ? cachedLeaderboard : trimmedLocal;
    const rank = rankSource.findIndex(
      (e) => e.playerName === normalizedEntry.playerName && e.score === normalizedEntry.score
    );

    return {
      success: true,
      rank: rank >= 0 ? rank + 1 : -1
    };
  }

  static async reportEntry(report: LeaderboardReport): Promise<{ success: boolean; error?: string }> {
    const reason = report.reason || "other";
    const playerName = this.sanitizePlayerName(report.playerName);
    if (!playerName) {
      return { success: false, error: "Missing player name" };
    }

    const payload = {
      entry_id: typeof report.entryId === "number" ? report.entryId : null,
      player_name: playerName,
      score: Math.max(0, Math.floor(Number(report.score) || 0)),
      reason,
      details: this.sanitizeReportDetails(report.details),
      created_at: new Date().toISOString()
    };

    if (isOnline && supabaseClient) {
      try {
        const { error } = await supabaseClient.from(REPORTS_TABLE_NAME).insert([payload]);
        if (error) {
          console.error("Failed to submit leaderboard report:", error);
        } else {
          return { success: true };
        }
      } catch (e) {
        console.error("Failed to submit leaderboard report:", e);
      }
    }

    // Local fallback keeps moderation evidence if offline.
    try {
      const existingRaw = localStorage.getItem(REPORTS_FALLBACK_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) as Array<Record<string, unknown>> : [];
      existing.push(payload);
      localStorage.setItem(REPORTS_FALLBACK_KEY, JSON.stringify(existing.slice(-300)));
    } catch {
      // Ignore local fallback write errors.
    }

    return { success: true };
  }

  // Check if a score qualifies for the leaderboard
  static qualifiesForLeaderboard(score: number): boolean {
    const entries = cachedLeaderboard;
    if (entries.length < MAX_ENTRIES) return true;
    return score > entries[entries.length - 1].score;
  }

  // Get highest score
  static getHighScore(): number {
    const entries = cachedLeaderboard;
    return entries.length > 0 ? entries[0].score : 0;
  }

  // Check if online
  static isConnected(): boolean {
    return isOnline;
  }

  // Clear leaderboard (for testing)
  static clearLeaderboard(): void {
    localStorage.removeItem(LEADERBOARD_KEY);
    cachedLeaderboard = [];
  }

  // Cleanup real-time subscription
  static cleanup(): void {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    listeners.clear();
  }
}
