// Daily Challenge Manager - Generates and tracks daily challenges
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseClientFactory';
import { isOfflineModeEnabled } from '../config/offlineMode';

// Challenge types
export type ChallengeType = 
  | 'enemies_defeated'    // Defeat X enemies
  | 'distance_traveled'   // Travel X meters
  | 'score_reached'       // Reach X score
  | 'levels_completed'    // Complete X levels
  | 'stomps_performed'    // Perform X stomps
  | 'perfect_landings'    // Get X perfect landings
  | 'no_damage_level'     // Complete a level without taking damage
  | 'speed_run';          // Complete level in X seconds

// Challenge difficulty
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

// Daily challenge interface
export interface DailyChallenge {
  id: string;
  date: string;                    // YYYY-MM-DD format
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  title: string;
  description: string;
  targetValue: number;
  rewardPoints: number;
  icon: string;
}

// Player's challenge progress
export interface ChallengeProgress {
  odchallengeId: string;
  odplayerId: string;
  currentValue: number;
  completed: boolean;
  completedAt?: string;
}

// Supabase configuration
const SUPABASE_URL = 'https://nzxcitprapshrbdkanys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eGNpdHByYXBzaHJiZGthbnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjgzNjcsImV4cCI6MjA2NTkwNDM2N30.rPhNvxjYpo3_kxfluLx_LT2WOOCYmKHx6sxNLX0ZnzE';
const CHALLENGES_TABLE = 'daily_challenges';
const PROGRESS_TABLE = 'challenge_progress';

// Local storage keys
const LOCAL_CHALLENGES_KEY = 'laturaivo_daily_challenges';
const LOCAL_PROGRESS_KEY = 'laturaivo_challenge_progress';

// Cached data
let supabaseClient: SupabaseClient | null = null;
let todaysChallenges: DailyChallenge[] = [];
let playerProgress: Map<string, ChallengeProgress> = new Map();
let isOnline = false;

// Challenge templates for generation
const CHALLENGE_TEMPLATES: Record<ChallengeType, { 
  title: string; 
  description: string; 
  icon: string;
  targets: Record<ChallengeDifficulty, number>;
  rewards: Record<ChallengeDifficulty, number>;
}> = {
  enemies_defeated: {
    title: 'Espoolaisten kauhu',
    description: 'Kaada {target} espoolaista ladulta',
    icon: '💀',
    targets: { easy: 20, medium: 50, hard: 100 },
    rewards: { easy: 500, medium: 1500, hard: 3000 }
  },
  distance_traveled: {
    title: 'Pitkän matkan hiihtäjä',
    description: 'Hiihdä {target} metriä',
    icon: '🎿',
    targets: { easy: 500, medium: 2000, hard: 5000 },
    rewards: { easy: 400, medium: 1200, hard: 2500 }
  },
  score_reached: {
    title: 'Pisteiden kerääjä',
    description: 'Kerää {target} pistettä yhdessä pelissä',
    icon: '⭐',
    targets: { easy: 5000, medium: 15000, hard: 50000 },
    rewards: { easy: 600, medium: 1800, hard: 4000 }
  },
  levels_completed: {
    title: 'Tasojen valloittaja',
    description: 'Läpäise {target} tasoa',
    icon: '🏔️',
    targets: { easy: 2, medium: 5, hard: 10 },
    rewards: { easy: 800, medium: 2000, hard: 5000 }
  },
  stomps_performed: {
    title: 'Stomppimestari',
    description: 'Suorita {target} stomppia',
    icon: '🦶',
    targets: { easy: 10, medium: 30, hard: 75 },
    rewards: { easy: 500, medium: 1500, hard: 3500 }
  },
  perfect_landings: {
    title: 'Täydellinen laskeutuja',
    description: 'Tee {target} täydellistä laskua',
    icon: '✨',
    targets: { easy: 5, medium: 15, hard: 40 },
    rewards: { easy: 700, medium: 2000, hard: 4500 }
  },
  no_damage_level: {
    title: 'Koskematon',
    description: 'Läpäise taso ottamatta vahinkoa',
    icon: '🛡️',
    targets: { easy: 1, medium: 1, hard: 1 },
    rewards: { easy: 1000, medium: 2500, hard: 5000 }
  },
  speed_run: {
    title: 'Pikahiihtäjä',
    description: 'Läpäise taso alle {target} sekunnissa',
    icon: '⚡',
    targets: { easy: 120, medium: 90, hard: 60 },
    rewards: { easy: 800, medium: 2200, hard: 4000 }
  }
};

// Listeners
type ChallengeListener = (challenges: DailyChallenge[], progress: Map<string, ChallengeProgress>) => void;
const listeners: Set<ChallengeListener> = new Set();

export class DailyChallengeManager {
  // Initialize the manager
  static async initialize(): Promise<void> {
    if (isOfflineModeEnabled()) {
      isOnline = false;
      this.loadLocalChallenges();
      console.debug('DailyChallengeManager initialized in OFFLINE mode, challenges:', todaysChallenges.length);
      return;
    }

    try {
      supabaseClient = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Try to load today's challenges from server
      await this.loadTodaysChallenges();
      
      console.debug('DailyChallengeManager initialized, challenges:', todaysChallenges.length, 'online:', isOnline);
    } catch (e) {
      console.debug('DailyChallengeManager initialization failed, using local mode:', e);
      isOnline = false;
      this.loadLocalChallenges();
    }
  }

  // Load today's challenges from server or generate new ones
  private static async loadTodaysChallenges(): Promise<void> {
    const today = this.getTodayString();
    
    if (!supabaseClient) {
      this.loadLocalChallenges();
      return;
    }
    
    try {
      // Check if challenges exist for today
      const { data, error } = await supabaseClient
        .from(CHALLENGES_TABLE)
        .select('*')
        .eq('date', today);
      
      // If table doesn't exist or other error, fall back to local
      if (error) {
        console.debug('Challenges table not available, using local mode:', error.message);
        isOnline = false;
        this.loadLocalChallenges();
        return;
      }
      
      isOnline = true;
      
      if (data && data.length > 0) {
        // Challenges exist, load them
        todaysChallenges = data.map(c => ({
          id: c.id,
          date: c.date,
          type: c.type as ChallengeType,
          difficulty: c.difficulty as ChallengeDifficulty,
          title: c.title,
          description: c.description,
          targetValue: c.target_value,
          rewardPoints: c.reward_points,
          icon: c.icon
        }));
      } else {
        // Generate new challenges for today
        todaysChallenges = this.generateDailyChallenges(today);
        
        // Try to save to server (ignore errors)
        this.saveChallengestoServer(todaysChallenges).catch(() => {});
      }
      
      // Save locally as backup
      localStorage.setItem(LOCAL_CHALLENGES_KEY, JSON.stringify({
        date: today,
        challenges: todaysChallenges
      }));
      
      // Load player progress (with fallback)
      await this.loadPlayerProgress();
    } catch (e) {
      console.debug('Error loading challenges, using local mode:', e);
      isOnline = false;
      this.loadLocalChallenges();
    }
  }

  // Generate daily challenges (deterministic based on date)
  private static generateDailyChallenges(date: string): DailyChallenge[] {
    // Use date as seed for pseudo-random generation
    const seed = this.dateToSeed(date);
    const random = this.seededRandom(seed);
    
    const challengeTypes = Object.keys(CHALLENGE_TEMPLATES) as ChallengeType[];
    const difficulties: ChallengeDifficulty[] = ['easy', 'medium', 'hard'];
    
    const challenges: DailyChallenge[] = [];
    const usedTypes: Set<ChallengeType> = new Set();
    
    // Generate 3 challenges: 1 easy, 1 medium, 1 hard
    for (let i = 0; i < 3; i++) {
      const difficulty = difficulties[i];
      
      // Pick a random unused challenge type
      let type: ChallengeType;
      do {
        const typeIndex = Math.floor(random() * challengeTypes.length);
        type = challengeTypes[typeIndex];
      } while (usedTypes.has(type));
      
      usedTypes.add(type);
      
      const template = CHALLENGE_TEMPLATES[type];
      const targetValue = template.targets[difficulty];
      const description = template.description.replace('{target}', targetValue.toString());
      
      challenges.push({
        id: `${date}_${i}`,
        date,
        type,
        difficulty,
        title: template.title,
        description,
        targetValue,
        rewardPoints: template.rewards[difficulty],
        icon: template.icon
      });
    }
    
    return challenges;
  }

  // Convert date to numeric seed
  private static dateToSeed(date: string): number {
    let hash = 0;
    for (let i = 0; i < date.length; i++) {
      const char = date.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Seeded random number generator
  private static seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  // Save challenges to server
  private static async saveChallengestoServer(challenges: DailyChallenge[]): Promise<void> {
    if (!supabaseClient) return;
    
    try {
      const rows = challenges.map(c => ({
        id: c.id,
        date: c.date,
        type: c.type,
        difficulty: c.difficulty,
        title: c.title,
        description: c.description,
        target_value: c.targetValue,
        reward_points: c.rewardPoints,
        icon: c.icon
      }));
      
      await supabaseClient.from(CHALLENGES_TABLE).upsert(rows);
    } catch (e) {
      console.error('Error saving challenges:', e);
    }
  }

  // Load local challenges
  private static loadLocalChallenges(): void {
    try {
      const cached = localStorage.getItem(LOCAL_CHALLENGES_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const today = this.getTodayString();
        
        if (data.date === today) {
          todaysChallenges = data.challenges;
          this.loadLocalProgress();
          return;
        }
      }
      
      // Generate new local challenges
      const today = this.getTodayString();
      todaysChallenges = this.generateDailyChallenges(today);
      localStorage.setItem(LOCAL_CHALLENGES_KEY, JSON.stringify({
        date: today,
        challenges: todaysChallenges
      }));
      this.loadLocalProgress();
    } catch (e) {
      console.error('Error loading local challenges:', e);
      todaysChallenges = [];
    }
  }

  // Load player progress from server
  private static async loadPlayerProgress(): Promise<void> {
    const playerId = this.getPlayerId();
    if (!playerId || !supabaseClient || !isOnline) {
      this.loadLocalProgress();
      return;
    }
    
    try {
      const { data, error } = await supabaseClient
        .from(PROGRESS_TABLE)
        .select('*')
        .eq('player_id', playerId)
        .in('challenge_id', todaysChallenges.map(c => c.id));
      
      // If table doesn't exist, fall back to local
      if (error) {
        console.debug('Challenge progress table not available:', error.message);
        this.loadLocalProgress();
        return;
      }
      
      playerProgress.clear();
      if (data) {
        data.forEach(p => {
          playerProgress.set(p.challenge_id, {
            odchallengeId: p.challenge_id,
            odplayerId: p.player_id,
            currentValue: p.current_value || 0,
            completed: p.completed || false,
            completedAt: p.completed_at
          });
        });
      }
      
      // Initialize progress for challenges not yet started
      todaysChallenges.forEach(c => {
        if (!playerProgress.has(c.id)) {
          playerProgress.set(c.id, {
            odchallengeId: c.id,
            odplayerId: playerId,
            currentValue: 0,
            completed: false
          });
        }
      });
      
      // Save locally
      this.saveLocalProgress();
    } catch (e) {
      console.debug('Error loading player progress, using local:', e);
      this.loadLocalProgress();
    }
  }

  // Load local progress
  private static loadLocalProgress(): void {
    try {
      const cached = localStorage.getItem(LOCAL_PROGRESS_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const today = this.getTodayString();
        
        if (data.date === today) {
          playerProgress = new Map(Object.entries(data.progress));
          return;
        }
      }
      
      // Initialize empty progress
      const playerId = this.getPlayerId();
      playerProgress.clear();
      todaysChallenges.forEach(c => {
        playerProgress.set(c.id, {
          odchallengeId: c.id,
          odplayerId: playerId,
          currentValue: 0,
          completed: false
        });
      });
    } catch (e) {
      console.error('Error loading local progress:', e);
    }
  }

  // Save local progress
  private static saveLocalProgress(): void {
    try {
      const progressObj: Record<string, ChallengeProgress> = {};
      playerProgress.forEach((v, k) => {
        progressObj[k] = v;
      });
      
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify({
        date: this.getTodayString(),
        progress: progressObj
      }));
    } catch (e) {
      console.error('Error saving local progress:', e);
    }
  }

  // Update progress for a challenge type
  static async updateProgress(type: ChallengeType, value: number, isIncrement: boolean = true): Promise<void> {
    const playerId = this.getPlayerId();
    
    // Find challenges matching this type
    const matchingChallenges = todaysChallenges.filter(c => c.type === type);
    
    for (const challenge of matchingChallenges) {
      let progress = playerProgress.get(challenge.id);
      
      if (!progress) {
        progress = {
          odchallengeId: challenge.id,
          odplayerId: playerId,
          currentValue: 0,
          completed: false
        };
        playerProgress.set(challenge.id, progress);
      }
      
      if (progress.completed) continue; // Already completed
      
      // Update value
      if (isIncrement) {
        progress.currentValue += value;
      } else {
        progress.currentValue = Math.max(progress.currentValue, value);
      }
      
      // Check if completed
      if (progress.currentValue >= challenge.targetValue) {
        progress.completed = true;
        progress.completedAt = new Date().toISOString();
        console.debug(`Challenge completed: ${challenge.title}!`);
      }
      
      // Save to server (ignore errors, local storage is primary)
      if (supabaseClient && isOnline) {
        (async () => {
          try {
            await supabaseClient!.from(PROGRESS_TABLE).upsert({
              challenge_id: challenge.id,
              player_id: playerId,
              current_value: progress.currentValue,
              completed: progress.completed,
              completed_at: progress.completedAt
            });
          } catch {
            // Silently fail, local storage has the data
          }
        })();
      }
    }
    
    // Save locally
    this.saveLocalProgress();
    
    // Notify listeners
    this.notifyListeners();
  }

  // Get today's challenges
  static getTodaysChallenges(): DailyChallenge[] {
    return todaysChallenges;
  }

  // Get progress for a challenge
  static getProgress(challengeId: string): ChallengeProgress | undefined {
    return playerProgress.get(challengeId);
  }

  // Get all progress
  static getAllProgress(): Map<string, ChallengeProgress> {
    return playerProgress;
  }

  // Get completed challenges count
  static getCompletedCount(): number {
    let count = 0;
    playerProgress.forEach(p => {
      if (p.completed) count++;
    });
    return count;
  }

  // Get total reward points earned today
  static getTodaysRewardPoints(): number {
    let total = 0;
    todaysChallenges.forEach(c => {
      const progress = playerProgress.get(c.id);
      if (progress?.completed) {
        total += c.rewardPoints;
      }
    });
    return total;
  }

  // Get time until challenges reset
  static getTimeUntilReset(): { hours: number; minutes: number } {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  }

  // Helper to get today's date string
  private static getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // Get player ID (from registry or localStorage)
  private static getPlayerId(): string {
    // Try to get from AuthManager or localStorage
    const localId = localStorage.getItem('laturaivo_player_id');
    if (localId) return localId;
    
    // Generate new ID
    const newId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('laturaivo_player_id', newId);
    return newId;
  }

  // Add listener
  static addListener(listener: ChallengeListener): void {
    listeners.add(listener);
  }

  // Remove listener
  static removeListener(listener: ChallengeListener): void {
    listeners.delete(listener);
  }

  // Notify listeners
  private static notifyListeners(): void {
    listeners.forEach(listener => {
      try {
        listener(todaysChallenges, playerProgress);
      } catch (e) {
        console.error('Error notifying challenge listener:', e);
      }
    });
  }

  // Check if connected
  static isConnected(): boolean {
    return isOnline;
  }
}
