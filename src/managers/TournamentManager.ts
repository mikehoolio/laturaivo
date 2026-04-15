// Tournament Manager - Handles weekly tournaments with real-time leaderboards
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseClientFactory';
import { isOfflineModeEnabled } from '../config/offlineMode';

// Tournament status
export type TournamentStatus = 'upcoming' | 'active' | 'ended';

// Tournament interface
export interface Tournament {
  id: string;
  name: string;
  description: string;
  startDate: string;       // ISO date string
  endDate: string;         // ISO date string
  status: TournamentStatus;
  entryCount: number;
  prizeDescription: string;
  icon: string;
}

// Tournament entry (player's score)
export interface TournamentEntry {
  id?: number;
  tournamentId: string;
  playerId: string;
  playerName: string;
  score: number;
  distance: number;
  enemiesDefeated: number;
  levelsCompleted: number;
  submittedAt: string;
  rank?: number;
}

// Supabase configuration
const SUPABASE_URL = 'https://nzxcitprapshrbdkanys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eGNpdHByYXBzaHJiZGthbnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjgzNjcsImV4cCI6MjA2NTkwNDM2N30.rPhNvxjYpo3_kxfluLx_LT2WOOCYmKHx6sxNLX0ZnzE';
const TOURNAMENTS_TABLE = 'tournaments';
const ENTRIES_TABLE = 'tournament_entries';

// Local storage keys
const LOCAL_TOURNAMENT_KEY = 'laturaivo_current_tournament';
const LOCAL_ENTRIES_KEY = 'laturaivo_tournament_entries';

// Cached data
let supabaseClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let currentTournament: Tournament | null = null;
let tournamentEntries: TournamentEntry[] = [];
let playerEntry: TournamentEntry | null = null;
let isOnline = false;

// Listeners
type TournamentListener = (tournament: Tournament | null, entries: TournamentEntry[], playerEntry: TournamentEntry | null) => void;
const listeners: Set<TournamentListener> = new Set();

export class TournamentManager {
  // Initialize the manager
  static async initialize(): Promise<void> {
    if (isOfflineModeEnabled()) {
      isOnline = false;
      this.loadLocalTournament();
      console.debug('TournamentManager initialized in OFFLINE mode, tournament:', currentTournament?.name || 'None');
      return;
    }

    try {
      supabaseClient = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Load current tournament
      await this.loadCurrentTournament();
      
      console.debug('TournamentManager initialized, tournament:', currentTournament?.name || 'None', 'online:', isOnline);
    } catch (e) {
      console.debug('TournamentManager initialization failed, using local mode:', e);
      isOnline = false;
      this.loadLocalTournament();
    }
  }

  // Load current/active tournament
  private static async loadCurrentTournament(): Promise<void> {
    if (!supabaseClient) {
      this.loadLocalTournament();
      return;
    }
    
    try {
      const now = new Date().toISOString();
      
      // First check for active tournament
      let { data, error } = await supabaseClient
        .from(TOURNAMENTS_TABLE)
        .select('*')
        .lte('start_date', now)
        .gte('end_date', now)
        .order('start_date', { ascending: false })
        .limit(1);
      
      // If table doesn't exist or other error, fall back to local
      if (error) {
        console.debug('Tournaments table not available, using local mode:', error.message);
        isOnline = false;
        this.loadLocalTournament();
        return;
      }
      
      isOnline = true;
      
      if (!data || data.length === 0) {
        // No active tournament, check for upcoming
        const result = await supabaseClient
          .from(TOURNAMENTS_TABLE)
          .select('*')
          .gt('start_date', now)
          .order('start_date', { ascending: true })
          .limit(1);
        
        if (result.error) {
          // Table query error, use local
          console.debug('Tournament query error, using local mode');
          isOnline = false;
          this.loadLocalTournament();
          return;
        }
        data = result.data;
      }
      
      if (!data || data.length === 0) {
        // No tournament found, generate weekly tournament
        currentTournament = this.generateWeeklyTournament();
        // Try to save to server (ignore errors)
        this.saveTournamentToServer(currentTournament).catch(() => {});
      } else {
        currentTournament = this.mapTournamentFromDb(data[0]);
      }
      
      // Save locally
      if (currentTournament) {
        localStorage.setItem(LOCAL_TOURNAMENT_KEY, JSON.stringify(currentTournament));
      }
      
      // Load entries (with fallback)
      await this.loadTournamentEntries();
      
      // Setup real-time subscription (only if tables exist)
      if (isOnline) {
        this.setupRealtimeSubscription();
      }
    } catch (e) {
      console.debug('Error loading tournament, using local mode:', e);
      isOnline = false;
      this.loadLocalTournament();
    }
  }

  // Map database row to Tournament
  private static mapTournamentFromDb(row: Record<string, unknown>): Tournament {
    const now = new Date();
    const startDate = new Date(row.start_date as string);
    const endDate = new Date(row.end_date as string);
    
    let status: TournamentStatus = 'upcoming';
    if (now >= startDate && now <= endDate) {
      status = 'active';
    } else if (now > endDate) {
      status = 'ended';
    }
    
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      status,
      entryCount: (row.entry_count as number) || 0,
      prizeDescription: row.prize_description as string,
      icon: row.icon as string
    };
  }

  // Generate a weekly tournament
  private static generateWeeklyTournament(): Tournament {
    const now = new Date();
    
    // Start on Monday, end on Sunday
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysUntilMonday);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    // Get week number
    const weekNum = this.getWeekNumber(startDate);
    
    // Tournament themes
    const themes = [
      { name: 'Mestarikilpailu', icon: '🏆', desc: 'Viikon paras hiihtäjä!' },
      { name: 'Nopeuskilpailu', icon: '⚡', desc: 'Kuka kerää eniten pisteitä?' },
      { name: 'Espoolaisten kauhu', icon: '💀', desc: 'Kaada eniten espoolaisia!' },
      { name: 'Maratonhaaste', icon: '🎿', desc: 'Hiihdä pisimmälle!' },
      { name: 'Laturaivo Cup', icon: '🥇', desc: 'Viikottainen mestaruuskisa!' }
    ];
    
    const theme = themes[weekNum % themes.length];
    
    return {
      id: `week_${startDate.getFullYear()}_${weekNum}`,
      name: `${theme.name} - Viikko ${weekNum}`,
      description: theme.desc,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'upcoming',
      entryCount: 0,
      prizeDescription: '🥇 1. sija: Kultainen hiihtolegenda -badge\n🥈 2. sija: Hopea-badge\n🥉 3. sija: Pronssi-badge',
      icon: theme.icon
    };
  }

  // Get ISO week number
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Save tournament to server
  private static async saveTournamentToServer(tournament: Tournament): Promise<void> {
    if (!supabaseClient) return;
    
    try {
      await supabaseClient.from(TOURNAMENTS_TABLE).upsert({
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        start_date: tournament.startDate,
        end_date: tournament.endDate,
        entry_count: tournament.entryCount,
        prize_description: tournament.prizeDescription,
        icon: tournament.icon
      });
    } catch (e) {
      console.error('Error saving tournament:', e);
    }
  }

  // Load tournament entries
  private static async loadTournamentEntries(): Promise<void> {
    if (!currentTournament || !supabaseClient || !isOnline) {
      this.loadLocalEntries();
      return;
    }
    
    try {
      const { data, error } = await supabaseClient
        .from(ENTRIES_TABLE)
        .select('*')
        .eq('tournament_id', currentTournament.id)
        .order('score', { ascending: false })
        .limit(50);
      
      // If table doesn't exist, fall back to local
      if (error) {
        console.debug('Tournament entries table not available:', error.message);
        this.loadLocalEntries();
        return;
      }
      
      tournamentEntries = (data || []).map((e, index) => ({
        id: e.id,
        tournamentId: e.tournament_id,
        playerId: e.player_id,
        playerName: e.player_name,
        score: e.score,
        distance: e.distance || 0,
        enemiesDefeated: e.enemies_defeated || 0,
        levelsCompleted: e.levels_completed || 0,
        submittedAt: e.submitted_at,
        rank: index + 1
      }));
      
      // Find player's entry
      const playerId = this.getPlayerId();
      playerEntry = tournamentEntries.find(e => e.playerId === playerId) || null;
      
      // Update entry count
      if (currentTournament) {
        currentTournament.entryCount = tournamentEntries.length;
      }
      
      // Save locally
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify({
        tournamentId: currentTournament.id,
        entries: tournamentEntries
      }));
    } catch (e) {
      console.debug('Error loading tournament entries, using local:', e);
      this.loadLocalEntries();
    }
  }

  // Load local tournament
  private static loadLocalTournament(): void {
    try {
      const cached = localStorage.getItem(LOCAL_TOURNAMENT_KEY);
      if (cached) {
        currentTournament = JSON.parse(cached);
        
        // Update status based on current time
        if (currentTournament) {
          const now = new Date();
          const startDate = new Date(currentTournament.startDate);
          const endDate = new Date(currentTournament.endDate);
          
          if (now < startDate) {
            currentTournament.status = 'upcoming';
          } else if (now > endDate) {
            currentTournament.status = 'ended';
          } else {
            currentTournament.status = 'active';
          }
        }
      } else {
        // Generate local tournament
        currentTournament = this.generateWeeklyTournament();
      }
      
      this.loadLocalEntries();
    } catch (e) {
      console.error('Error loading local tournament:', e);
    }
  }

  // Load local entries
  private static loadLocalEntries(): void {
    try {
      const cached = localStorage.getItem(LOCAL_ENTRIES_KEY);
      if (cached && currentTournament) {
        const data = JSON.parse(cached);
        if (data.tournamentId === currentTournament.id) {
          tournamentEntries = data.entries;
          
          const playerId = this.getPlayerId();
          playerEntry = tournamentEntries.find(e => e.playerId === playerId) || null;
        }
      }
    } catch (e) {
      console.error('Error loading local entries:', e);
    }
  }

  // Setup real-time subscription for entries
  private static setupRealtimeSubscription(): void {
    if (!supabaseClient || !currentTournament) return;
    
    realtimeChannel = supabaseClient
      .channel('tournament-entries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: ENTRIES_TABLE,
          filter: `tournament_id=eq.${currentTournament.id}`
        },
        async (payload) => {
          console.debug('Tournament update received:', payload.eventType);
          await this.loadTournamentEntries();
          this.notifyListeners();
        }
      )
      .subscribe();
  }

  // Submit a score to the tournament
  static async submitScore(stats: {
    score: number;
    distance: number;
    enemiesDefeated: number;
    levelsCompleted: number;
    playerName: string;
  }): Promise<{ success: boolean; rank?: number; isNewBest?: boolean }> {
    if (!currentTournament || currentTournament.status !== 'active') {
      return { success: false };
    }
    
    const playerId = this.getPlayerId();
    const isNewBest = !playerEntry || stats.score > playerEntry.score;
    
    // Only update if it's a new best score
    if (!isNewBest) {
      return { success: true, rank: playerEntry?.rank, isNewBest: false };
    }
    
    const entry: TournamentEntry = {
      tournamentId: currentTournament.id,
      playerId,
      playerName: stats.playerName,
      score: stats.score,
      distance: stats.distance,
      enemiesDefeated: stats.enemiesDefeated,
      levelsCompleted: stats.levelsCompleted,
      submittedAt: new Date().toISOString()
    };
    
    // Save to server
    if (supabaseClient && isOnline) {
      try {
        // Check if entry exists
        const { data: existing } = await supabaseClient
          .from(ENTRIES_TABLE)
          .select('id')
          .eq('tournament_id', currentTournament.id)
          .eq('player_id', playerId)
          .single();
        
        if (existing) {
          // Update existing entry
          await supabaseClient.from(ENTRIES_TABLE).update({
            player_name: stats.playerName,
            score: stats.score,
            distance: stats.distance,
            enemies_defeated: stats.enemiesDefeated,
            levels_completed: stats.levelsCompleted,
            submitted_at: entry.submittedAt
          }).eq('id', existing.id);
        } else {
          // Insert new entry
          await supabaseClient.from(ENTRIES_TABLE).insert({
            tournament_id: currentTournament.id,
            player_id: playerId,
            player_name: stats.playerName,
            score: stats.score,
            distance: stats.distance,
            enemies_defeated: stats.enemiesDefeated,
            levels_completed: stats.levelsCompleted,
            submitted_at: entry.submittedAt
          });
        }
        
        // Refresh entries
        await this.loadTournamentEntries();
      } catch (e) {
        console.error('Error submitting tournament score:', e);
      }
    } else {
      // Save locally
      const existingIndex = tournamentEntries.findIndex(e => e.playerId === playerId);
      if (existingIndex >= 0) {
        tournamentEntries[existingIndex] = entry;
      } else {
        tournamentEntries.push(entry);
      }
      
      // Re-sort and assign ranks
      tournamentEntries.sort((a, b) => b.score - a.score);
      tournamentEntries.forEach((e, i) => e.rank = i + 1);
      
      playerEntry = tournamentEntries.find(e => e.playerId === playerId) || null;
      
      localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify({
        tournamentId: currentTournament.id,
        entries: tournamentEntries
      }));
    }
    
    this.notifyListeners();
    
    return { 
      success: true, 
      rank: playerEntry?.rank, 
      isNewBest: true 
    };
  }

  // Get current tournament
  static getCurrentTournament(): Tournament | null {
    return currentTournament;
  }

  // Get tournament entries (top players)
  static getEntries(): TournamentEntry[] {
    return tournamentEntries;
  }

  // Get player's entry
  static getPlayerEntry(): TournamentEntry | null {
    return playerEntry;
  }

  // Get time remaining in tournament
  static getTimeRemaining(): { days: number; hours: number; minutes: number } | null {
    if (!currentTournament || currentTournament.status !== 'active') {
      return null;
    }
    
    const now = new Date();
    const endDate = new Date(currentTournament.endDate);
    const diff = endDate.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  }

  // Get time until tournament starts
  static getTimeUntilStart(): { days: number; hours: number; minutes: number } | null {
    if (!currentTournament || currentTournament.status !== 'upcoming') {
      return null;
    }
    
    const now = new Date();
    const startDate = new Date(currentTournament.startDate);
    const diff = startDate.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  }

  // Get player ID
  private static getPlayerId(): string {
    const localId = localStorage.getItem('laturaivo_player_id');
    if (localId) return localId;
    
    const newId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('laturaivo_player_id', newId);
    return newId;
  }

  // Add listener
  static addListener(listener: TournamentListener): void {
    listeners.add(listener);
  }

  // Remove listener
  static removeListener(listener: TournamentListener): void {
    listeners.delete(listener);
  }

  // Notify listeners
  private static notifyListeners(): void {
    listeners.forEach(listener => {
      try {
        listener(currentTournament, tournamentEntries, playerEntry);
      } catch (e) {
        console.error('Error notifying tournament listener:', e);
      }
    });
  }

  // Check if connected
  static isConnected(): boolean {
    return isOnline;
  }

  // Cleanup
  static cleanup(): void {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    listeners.clear();
  }
}
