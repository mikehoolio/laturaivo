import Phaser from 'phaser';
import * as utils from '../utils';
import { LeaderboardManager } from '../managers/LeaderboardManager';
import type { LeaderboardEntry } from '../managers/LeaderboardManager';
import { LEADERBOARD_TITLES } from '../humor/HumorPack';

/**
 * LeaderboardUIScene - Displays Top 1000 global leaderboard
 * iOS-optimized with:
 * - Large touch targets for buttons
 * - Safe area support
 * - Smooth scrolling
 * - Real-time updates via Supabase
 */
export class LeaderboardUIScene extends Phaser.Scene {
  private uiContainer: Phaser.GameObjects.DOMElement | null = null;
  private isClosing: boolean = false;
  private leaderboardEntries: LeaderboardEntry[] = [];
  private searchQuery: string = "";
  private previousScene: string = 'TitleScreen';
  
  // For real-time updates
  private updateListener: ((entries: LeaderboardEntry[]) => void) | null = null;

  constructor() {
    super({ key: 'LeaderboardUIScene' });
  }

  init(data: { previousScene?: string }) {
    this.isClosing = false;
    this.previousScene = data.previousScene || 'TitleScreen';
  }

  async create(): Promise<void> {
    // Fetch latest leaderboard data
    this.leaderboardEntries = await LeaderboardManager.getLeaderboardAsync();
    
    // Create dark overlay background
    this.createBackground();
    
    // Create the DOM UI
    this.createDOMUI();
    
    // Setup input handlers
    this.setupInputs();
    
    // Subscribe to real-time updates
    this.subscribeToUpdates();
    
    // Cleanup on scene shutdown
    this.events.once('shutdown', () => {
      this.cleanup();
    });
  }
  
  private createBackground(): void {
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.85
    );
    overlay.setDepth(100);
  }
  
  private subscribeToUpdates(): void {
    // Listen for real-time leaderboard updates
    this.updateListener = (entries: LeaderboardEntry[]) => {
      this.leaderboardEntries = entries;
      this.updateLeaderboardDisplay();
    };
    
    LeaderboardManager.addListener(this.updateListener);
  }
  
  private updateLeaderboardDisplay(): void {
    const listContainer = this.uiContainer?.node?.querySelector('#leaderboard-list') as HTMLElement;
    if (!listContainer) return;

    const displayedEntries = this.getDisplayedEntries();
    listContainer.innerHTML = this.generateLeaderboardHTML(displayedEntries);

    const searchStatus = this.uiContainer?.node?.querySelector('#leaderboard-search-status') as HTMLElement;
    if (searchStatus) {
      searchStatus.textContent = this.getSearchStatusText(displayedEntries.length, this.leaderboardEntries.length);
    }
  }

  private escapeHtml(value: string): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private getDisplayedEntries(): Array<{ entry: LeaderboardEntry; rank: number }> {
    const normalizedQuery = LeaderboardManager.sanitizePlayerName(this.searchQuery);
    const withRank = this.leaderboardEntries.map((entry, index) => ({ entry, rank: index + 1 }));
    if (!normalizedQuery) return withRank;
    return withRank.filter(({ entry }) =>
      LeaderboardManager.sanitizePlayerName(entry.playerName).includes(normalizedQuery)
    );
  }

  private getSearchStatusText(displayCount: number, totalCount: number): string {
    if (!this.searchQuery.trim()) {
      return `NAYTETAAN ${displayCount}/${totalCount}`;
    }
    return `HAKUOSUMAT ${displayCount}/${totalCount}`;
  }
  
  private generateLeaderboardHTML(displayedEntries: Array<{ entry: LeaderboardEntry; rank: number }>): string {
    if (this.leaderboardEntries.length === 0) {
      return `
        <div class="text-gray-400 text-center py-8" style="font-family: 'PublicPixel';">
          Ei vielä tuloksia.<br/>Ole ensimmäinen!
        </div>
      `;
    }

    if (displayedEntries.length === 0) {
      return `
        <div class="text-gray-400 text-center py-8" style="font-family: 'PublicPixel';">
          Hakuehdoilla ei löytynyt tuloksia.
        </div>
      `;
    }
    
    const playerName = this.registry.get('playerName') || '';
    
    return displayedEntries.map(({ entry, rank }) => {
      const isPlayer = entry.playerName.toUpperCase() === playerName.toUpperCase();
      const title = LEADERBOARD_TITLES.length > 0
        ? LEADERBOARD_TITLES[(rank - 1) % LEADERBOARD_TITLES.length]
        : '';
      const safePlayerName = this.escapeHtml(entry.playerName);
      const safeTitle = this.escapeHtml(title);
      
      // Medal colors for top 3
      let medalEmoji = '';
      let rankColor = 'text-gray-300';
      let bgClass = 'bg-gray-800 bg-opacity-50';
      
      if (rank === 1) {
        medalEmoji = '🥇';
        rankColor = 'text-yellow-400';
        bgClass = 'bg-yellow-900 bg-opacity-40';
      } else if (rank === 2) {
        medalEmoji = '🥈';
        rankColor = 'text-gray-300';
        bgClass = 'bg-gray-700 bg-opacity-40';
      } else if (rank === 3) {
        medalEmoji = '🥉';
        rankColor = 'text-orange-400';
        bgClass = 'bg-orange-900 bg-opacity-30';
      }
      
      // Highlight player's own entry
      if (isPlayer) {
        bgClass = 'bg-blue-800 bg-opacity-60 border-2 border-blue-400';
      }
      
      return `
        <div class="flex flex-shrink-0 items-center justify-between px-3 py-2 rounded ${bgClass}" style="min-height: 48px;">
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="${rankColor} text-lg font-bold w-8 text-center" style="font-family: 'PublicPixel';">${medalEmoji || rank}</span>
            <span class="text-white text-sm truncate max-w-[120px]" style="font-family: 'PublicPixel';">${safePlayerName}</span>
            ${safeTitle ? `<span class="text-cyan-300 text-[10px] uppercase" style="font-family: 'PublicPixel';">(${safeTitle})</span>` : ''}
            ${isPlayer ? '<span class="text-blue-300 text-xs">(SINÄ)</span>' : ''}
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span class="text-yellow-400 text-sm font-bold" style="font-family: 'PublicPixel';">${entry.score.toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  private createDOMUI(): void {
    const isOnline = LeaderboardManager.isConnected();
    const initialDisplayedEntries = this.getDisplayedEntries();
    
    const uiHTML = `
      <div id="leaderboard-container" class="absolute top-0 left-0 w-full h-full z-[1000] flex flex-col justify-start items-center overflow-hidden" style="font-family: 'PublicPixel';">
        
        <!-- Safe Area Padding for iOS notch -->
        <div class="w-full" style="padding-top: env(safe-area-inset-top, 20px);"></div>
        
        <!-- Main Content Container - iOS scroll optimized -->
        <div class="flex flex-col items-center gap-3 p-4 w-full max-w-lg mx-auto flex-1 overflow-hidden">
          
          <!-- Header -->
          <div class="flex items-center justify-between w-full">
            <button id="back-button" class="game-pixel-container-clickable-gray-600 px-4 py-3 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" style="min-width: 80px; min-height: 48px;">
              <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">⬅️ TAKAISIN</span>
            </button>
            
            <!-- Connection Status -->
            <div class="flex items-center gap-1">
              <span class="text-xs ${isOnline ? 'text-green-400' : 'text-yellow-400'}" style="font-family: 'PublicPixel';">
                ${isOnline ? '🟢 ONLINE' : '🟡 OFFLINE'}
              </span>
            </div>
          </div>
          
          <!-- Title -->
          <div class="text-center">
            <div class="text-yellow-400 font-bold text-2xl md:text-3xl" style="text-shadow: 3px 3px 0px #000000;">
              🏆 TOP RAIVOOJAT 🏆
            </div>
            <div class="text-cyan-300 text-sm mt-1" style="text-shadow: 2px 2px 0px #000;">
              PARHAAT LATURAIVOOJAT
            </div>
          </div>
          
          <!-- Leaderboard List Container - Scrollable on iOS -->
          <div class="game-pixel-container-gray-800 p-3 w-full flex-1 overflow-hidden flex flex-col" style="min-height: 300px; max-height: 450px;">
            <div class="mb-2 flex-shrink-0">
              <input
                id="leaderboard-search"
                type="text"
                inputmode="text"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
                maxlength="20"
                placeholder="ETSI NIMI..."
                value="${this.escapeHtml(this.searchQuery)}"
                class="w-full px-3 py-2 text-white bg-black bg-opacity-50 border border-gray-600 rounded outline-none focus:border-cyan-400"
                style="font-family: 'PublicPixel'; font-size: 12px;"
              />
              <div id="leaderboard-search-status" class="text-gray-400 text-[10px] mt-1 px-1" style="font-family: 'PublicPixel';">
                ${this.getSearchStatusText(initialDisplayedEntries.length, this.leaderboardEntries.length)}
              </div>
            </div>
            
            <!-- Column Headers -->
            <div class="flex items-center justify-between px-3 py-2 border-b border-gray-600 mb-2 flex-shrink-0">
              <div class="flex items-center gap-2">
                <span class="text-gray-400 text-xs w-8 text-center" style="font-family: 'PublicPixel';">#</span>
                <span class="text-gray-400 text-xs" style="font-family: 'PublicPixel';">NIMI</span>
              </div>
              <span class="text-gray-400 text-xs" style="font-family: 'PublicPixel';">PISTEET</span>
            </div>
            
            <!-- Scrollable List - iOS momentum scrolling -->
            <div id="leaderboard-list" class="flex flex-col gap-2 overflow-y-scroll flex-1" style="-webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior-y: contain; overscroll-behavior-x: none;">
              ${this.generateLeaderboardHTML(initialDisplayedEntries)}
            </div>
          </div>
          
          <!-- Refresh Button - Large touch target for iOS -->
          <button id="refresh-button" class="game-pixel-container-clickable-blue-600 px-6 py-3 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform" style="min-height: 48px;">
            <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">🔄 PÄIVITÄ</span>
          </button>
          
          <!-- Your Stats Summary (if player has submitted) -->
          ${this.renderPlayerStats()}
          
        </div>
        
        <!-- Safe Area Padding for iOS home indicator -->
        <div class="w-full" style="padding-bottom: env(safe-area-inset-bottom, 20px);"></div>
        
        <!-- Custom scrollbar styles for iOS -->
        <style>
          #leaderboard-list::-webkit-scrollbar {
            width: 4px;
          }
          #leaderboard-list::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
            border-radius: 2px;
          }
          #leaderboard-list::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
          }
          
          /* iOS-specific touch improvements */
          @supports (-webkit-touch-callout: none) {
            #leaderboard-list {
              -webkit-overflow-scrolling: touch;
            }
            button, [role="button"] {
              -webkit-tap-highlight-color: transparent;
            }
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(101);
    
    // Use a small delay to ensure DOM is fully rendered before attaching listeners
    this.time.delayedCall(50, () => {
      this.attachButtonListeners();
    });
  }
  
  private attachButtonListeners(): void {
    // Add button event listeners using the DOM element's node
    const backButton = this.uiContainer?.node?.querySelector('#back-button') as HTMLElement;
    const refreshButton = this.uiContainer?.node?.querySelector('#refresh-button') as HTMLElement;
    const searchInput = this.uiContainer?.node?.querySelector('#leaderboard-search') as HTMLInputElement;
    const leaderboardList = this.uiContainer?.node?.querySelector('#leaderboard-list') as HTMLElement;
    
    if (backButton) {
      backButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goBack();
      });
      backButton.addEventListener('touchend', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.goBack();
      });
    }
    
    if (refreshButton) {
      refreshButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.refreshLeaderboard();
      });
      refreshButton.addEventListener('touchend', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.refreshLeaderboard();
      });
    }

    if (searchInput) {
      const handleSearch = (event: Event) => {
        event.stopPropagation();
        const input = event.target as HTMLInputElement;
        this.searchQuery = input?.value || '';
        this.updateLeaderboardDisplay();
      };
      searchInput.addEventListener('click', (event) => event.stopPropagation());
      searchInput.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
      searchInput.addEventListener('input', handleSearch);
      searchInput.addEventListener('change', handleSearch);
      searchInput.addEventListener('keydown', (event) => {
        event.stopPropagation();
      });
    }

    if (leaderboardList) {
      // Keep gesture events inside the list so underlying scenes never steal scroll.
      const isolateScrollGesture = (event: Event) => {
        event.stopPropagation();
      };
      leaderboardList.addEventListener('wheel', isolateScrollGesture, { passive: true });
      leaderboardList.addEventListener('touchstart', isolateScrollGesture, { passive: true });
      leaderboardList.addEventListener('touchmove', isolateScrollGesture, { passive: true });
      leaderboardList.style.webkitOverflowScrolling = 'touch';
      leaderboardList.style.touchAction = 'pan-y';
      leaderboardList.style.overflowY = 'scroll';
    }

  }
  
  private renderPlayerStats(): string {
    const playerName = this.registry.get('playerName');
    if (!playerName) return '';
    
    // Find player's rank
    const playerRank = this.leaderboardEntries.findIndex(
      e => e.playerName.toUpperCase() === playerName.toUpperCase()
    );
    
    if (playerRank === -1) {
      return `
        <div class="text-gray-400 text-xs text-center mt-2" style="font-family: 'PublicPixel';">
          Pelaa ja voita päästäksesi tulostaulukkoon!
        </div>
      `;
    }
    
    const playerEntry = this.leaderboardEntries[playerRank];
    
    return `
      <div class="game-pixel-container-blue-800 p-3 w-full flex items-center justify-between mt-2">
        <div class="flex items-center gap-2">
          <span class="text-blue-300 text-sm" style="font-family: 'PublicPixel';">SIJOITUKSESI:</span>
          <span class="text-yellow-400 text-lg font-bold" style="font-family: 'PublicPixel';">#${playerRank + 1}</span>
        </div>
        <div class="text-white text-sm" style="font-family: 'PublicPixel';">${playerEntry.score.toLocaleString()} pts</div>
      </div>
    `;
  }
  
  private setupInputs(): void {
    // Mobile-only build: navigation is touch/pointer based.
  }
  
  private async refreshLeaderboard(): Promise<void> {
    // Show loading state
    const refreshButton = this.uiContainer?.node?.querySelector('#refresh-button') as HTMLElement;
    if (refreshButton) {
      refreshButton.innerHTML = '<span class="text-white text-sm font-bold" style="font-family: \'PublicPixel\';">⏳ LADATAAN...</span>';
    }
    
    // Play click sound
    this.sound.play('ui_click_sound', { volume: 0.3 });
    
    // Fetch fresh data
    this.leaderboardEntries = await LeaderboardManager.getLeaderboardAsync();
    
    // Update display
    this.updateLeaderboardDisplay();
    
    // Restore button
    if (refreshButton) {
      refreshButton.innerHTML = '<span class="text-white text-sm font-bold" style="font-family: \'PublicPixel\';">🔄 PÄIVITÄ</span>';
    }
  }
  
  private goBack(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    
    // Play click sound
    this.sound.play('ui_click_sound', { volume: 0.3 });
    
    // Cleanup
    this.cleanup();
    
    // Return to previous scene
    this.scene.stop();
    
    // If we came from title screen, resume it
    if (this.previousScene === 'TitleScreen' && this.scene.isPaused('TitleScreen')) {
      this.scene.resume('TitleScreen');
    }
  }
  
  private cleanup(): void {
    // Remove real-time listener
    if (this.updateListener) {
      LeaderboardManager.removeListener(this.updateListener);
      this.updateListener = null;
    }
  }
}
