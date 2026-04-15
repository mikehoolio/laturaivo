// Authentication Manager - Handles Supabase Auth for player profiles
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseClientFactory';
import { isOfflineModeEnabled } from '../config/offlineMode';

// Player profile interface
export interface PlayerProfile {
  id: string;
  displayName: string;
  email?: string;
  createdAt: string;
  // Lifetime stats
  totalGamesPlayed: number;
  totalScore: number;
  totalDistance: number;
  totalEnemiesDefeated: number;
  highestLevel: number;
  highestScore: number;
  // Achievements
  badges: string[];
  // Preferences
  lastPlayedAt: string;
}

// Supabase configuration
const SUPABASE_URL = 'https://nzxcitprapshrbdkanys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eGNpdHByYXBzaHJiZGthbnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMjgzNjcsImV4cCI6MjA2NTkwNDM2N30.rPhNvxjYpo3_kxfluLx_LT2WOOCYmKHx6sxNLX0ZnzE';
const PROFILES_TABLE = 'player_profiles';

// Local storage keys
const LOCAL_PROFILE_KEY = 'laturaivo_player_profile';
const LOCAL_GUEST_KEY = 'laturaivo_guest_profile';

// Singleton instance
let supabaseClient: SupabaseClient | null = null;
let currentUser: User | null = null;
let currentProfile: PlayerProfile | null = null;
let isInitialized = false;

// Auth state listeners
type AuthListener = (profile: PlayerProfile | null) => void;
const authListeners: Set<AuthListener> = new Set();

export class AuthManager {
  // Initialize the auth manager
  static async initialize(): Promise<void> {
    if (isInitialized) return;

    if (isOfflineModeEnabled()) {
      supabaseClient = null;
      currentUser = null;
      this.loadGuestProfile();
      isInitialized = true;
      console.debug('AuthManager initialized in OFFLINE mode, profile:', currentProfile?.displayName || 'Guest');
      return;
    }
    
    try {
      supabaseClient = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Check for existing session
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (session?.user) {
        currentUser = session.user;
        await this.loadProfile();
      } else {
        // Load guest profile from localStorage
        this.loadGuestProfile();
      }
      
      // Listen for auth changes
      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.debug('Auth state changed:', event);
        if (session?.user) {
          currentUser = session.user;
          await this.loadProfile();
        } else {
          currentUser = null;
          currentProfile = null;
          this.loadGuestProfile();
        }
        this.notifyListeners();
      });
      
      isInitialized = true;
      console.debug('AuthManager initialized, profile:', currentProfile?.displayName || 'Guest');
    } catch (e) {
      console.debug('AuthManager initialization failed:', e);
      this.loadGuestProfile();
      isInitialized = true;
    }
  }

  // Get Supabase client
  static getClient(): SupabaseClient | null {
    return supabaseClient;
  }

  // Sign up with email
  static async signUpWithEmail(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    if (!supabaseClient) return { success: false, error: 'Not initialized' };
    
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data.user) {
        // Create profile in database
        await this.createProfile(data.user.id, displayName, email);
        return { success: true };
      }
      
      return { success: false, error: 'Unknown error' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Sign in with email
  static async signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!supabaseClient) return { success: false, error: 'Not initialized' };
    
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data.user) {
        currentUser = data.user;
        await this.loadProfile();
        this.notifyListeners();
        return { success: true };
      }
      
      return { success: false, error: 'Unknown error' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Sign in with Google
  static async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    if (!supabaseClient) return { success: false, error: 'Not initialized' };
    
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Sign out
  static async signOut(): Promise<void> {
    if (!supabaseClient) return;
    
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    this.loadGuestProfile();
    this.notifyListeners();
  }

  // Create a new profile in the database
  private static async createProfile(userId: string, displayName: string, email?: string): Promise<void> {
    if (!supabaseClient) return;
    
    const newProfile: Partial<PlayerProfile> = {
      id: userId,
      displayName,
      email,
      createdAt: new Date().toISOString(),
      totalGamesPlayed: 0,
      totalScore: 0,
      totalDistance: 0,
      totalEnemiesDefeated: 0,
      highestLevel: 0,
      highestScore: 0,
      badges: [],
      lastPlayedAt: new Date().toISOString()
    };
    
    try {
      await supabaseClient.from(PROFILES_TABLE).insert([{
        id: userId,
        display_name: displayName,
        email,
        created_at: newProfile.createdAt,
        total_games_played: 0,
        total_score: 0,
        total_distance: 0,
        total_enemies_defeated: 0,
        highest_level: 0,
        highest_score: 0,
        badges: [],
        last_played_at: newProfile.lastPlayedAt
      }]);
    } catch (e) {
      console.error('Error creating profile:', e);
    }
  }

  // Load profile from database
  private static async loadProfile(): Promise<void> {
    if (!supabaseClient || !currentUser) return;
    
    try {
      const { data, error } = await supabaseClient
        .from(PROFILES_TABLE)
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        // Profile doesn't exist, create it
        const displayName = currentUser.user_metadata?.display_name || 
                           currentUser.email?.split('@')[0] || 
                           'HIIHTÄJÄ';
        await this.createProfile(currentUser.id, displayName, currentUser.email);
        await this.loadProfile();
        return;
      }
      
      if (data) {
        currentProfile = {
          id: data.id,
          displayName: data.display_name,
          email: data.email,
          createdAt: data.created_at,
          totalGamesPlayed: data.total_games_played || 0,
          totalScore: data.total_score || 0,
          totalDistance: data.total_distance || 0,
          totalEnemiesDefeated: data.total_enemies_defeated || 0,
          highestLevel: data.highest_level || 0,
          highestScore: data.highest_score || 0,
          badges: data.badges || [],
          lastPlayedAt: data.last_played_at
        };
        
        // Save to localStorage as backup
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(currentProfile));
      }
    } catch (e) {
      console.error('Error loading profile:', e);
      // Try to load from localStorage
      const cached = localStorage.getItem(LOCAL_PROFILE_KEY);
      if (cached) {
        currentProfile = JSON.parse(cached);
      }
    }
  }

  // Load guest profile from localStorage
  private static loadGuestProfile(): void {
    const cached = localStorage.getItem(LOCAL_GUEST_KEY);
    if (cached) {
      currentProfile = JSON.parse(cached);
    } else {
      // Create new guest profile
      currentProfile = {
        id: 'guest_' + Date.now(),
        displayName: 'VIERAS',
        createdAt: new Date().toISOString(),
        totalGamesPlayed: 0,
        totalScore: 0,
        totalDistance: 0,
        totalEnemiesDefeated: 0,
        highestLevel: 0,
        highestScore: 0,
        badges: [],
        lastPlayedAt: new Date().toISOString()
      };
      this.saveGuestProfile();
    }
  }

  // Save guest profile to localStorage
  private static saveGuestProfile(): void {
    if (currentProfile && !currentUser) {
      localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(currentProfile));
    }
  }

  // Update profile stats after a game
  static async updateStats(gameStats: {
    score: number;
    distance: number;
    enemiesDefeated: number;
    levelReached: number;
  }): Promise<void> {
    if (!currentProfile) return;
    
    // Update local profile
    currentProfile.totalGamesPlayed++;
    currentProfile.totalScore += gameStats.score;
    currentProfile.totalDistance += gameStats.distance;
    currentProfile.totalEnemiesDefeated += gameStats.enemiesDefeated;
    currentProfile.highestLevel = Math.max(currentProfile.highestLevel, gameStats.levelReached);
    currentProfile.highestScore = Math.max(currentProfile.highestScore, gameStats.score);
    currentProfile.lastPlayedAt = new Date().toISOString();
    
    // Save to database if logged in
    if (supabaseClient && currentUser) {
      try {
        await supabaseClient.from(PROFILES_TABLE).update({
          total_games_played: currentProfile.totalGamesPlayed,
          total_score: currentProfile.totalScore,
          total_distance: currentProfile.totalDistance,
          total_enemies_defeated: currentProfile.totalEnemiesDefeated,
          highest_level: currentProfile.highestLevel,
          highest_score: currentProfile.highestScore,
          last_played_at: currentProfile.lastPlayedAt
        }).eq('id', currentUser.id);
        
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(currentProfile));
      } catch (e) {
        console.error('Error updating stats:', e);
      }
    } else {
      // Save guest profile locally
      this.saveGuestProfile();
    }
    
    this.notifyListeners();
  }

  // Add a badge to the profile
  static async addBadge(badgeId: string): Promise<void> {
    if (!currentProfile || currentProfile.badges.includes(badgeId)) return;
    
    currentProfile.badges.push(badgeId);
    
    if (supabaseClient && currentUser) {
      try {
        await supabaseClient.from(PROFILES_TABLE).update({
          badges: currentProfile.badges
        }).eq('id', currentUser.id);
      } catch (e) {
        console.error('Error adding badge:', e);
      }
    } else {
      this.saveGuestProfile();
    }
    
    this.notifyListeners();
  }

  // Get current profile
  static getProfile(): PlayerProfile | null {
    return currentProfile;
  }

  // Get current user
  static getUser(): User | null {
    return currentUser;
  }

  // Check if user is logged in (not guest)
  static isLoggedIn(): boolean {
    return currentUser !== null;
  }

  // Check if user is a guest
  static isGuest(): boolean {
    return currentUser === null;
  }

  // Get display name
  static getDisplayName(): string {
    return currentProfile?.displayName || 'VIERAS';
  }

  // Set display name (for guests)
  static setGuestDisplayName(name: string): void {
    if (currentProfile && !currentUser) {
      currentProfile.displayName = name;
      this.saveGuestProfile();
      this.notifyListeners();
    }
  }

  // Add listener for auth changes
  static addListener(listener: AuthListener): void {
    authListeners.add(listener);
  }

  // Remove listener
  static removeListener(listener: AuthListener): void {
    authListeners.delete(listener);
  }

  // Notify all listeners
  private static notifyListeners(): void {
    authListeners.forEach(listener => {
      try {
        listener(currentProfile);
      } catch (e) {
        console.error('Error notifying auth listener:', e);
      }
    });
  }
}
