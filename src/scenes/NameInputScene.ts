import Phaser from 'phaser';
import * as utils from '../utils';
import { LevelManager } from '../LevelManager';

// Character type definition - only male character available
export type CharacterType = 'male';

// Difficulty type definition
export type DifficultyType = 'espoo' | 'vantaa' | 'lahti';

const LAST_PLAYER_NAME_STORAGE_KEY = 'laturaivo_last_player_name';

type NameHeadlineCard = {
  kicker: string;
  text: string;
};

const NAME_INPUT_HEADLINE_LEFT: NameHeadlineCard[] = [
  { kicker: 'BÄNDIUUTISET', text: 'Spice boys?' },
  { kicker: 'TAPIOLA', text: 'Elsa-Mummo terrorisoi Tapiolaa pieruillaan!' },
  { kicker: 'MUSASKOOPPI', text: 'Latukeisari droppasi uuden sinkun' },
  { kicker: 'PERHEELLE', text: 'Månika Stensvik paljastaa parhaat ladut lapsille' }
];

const NAME_INPUT_HEADLINE_RIGHT: NameHeadlineCard[] = [
  { kicker: 'AFTERWORK', text: 'Afterworkillä törppöillyt Timo kertoo kaiken!' },
  { kicker: 'LAPPI', text: 'Huippu paparazzi Sliizu häiriköi ihmisiä lapissa!' },
  { kicker: 'POLITIIKKA', text: 'JYTKY' },
  { kicker: 'FUENGIROLA', text: 'Veropakolainen Fuengirolassa' }
];

// Scene for entering player name before starting the game
export class NameInputScene extends Phaser.Scene {
  uiContainer!: Phaser.GameObjects.DOMElement;
  playerName: string = '';
  selectedCharacter: CharacterType = 'male';
  selectedDifficulty: DifficultyType = 'vantaa'; // Default to medium (Vantaa)
  selectedReplayLevel: number | null = null;
  private nameInputEl?: HTMLInputElement | null;
  private startButtonEl?: HTMLButtonElement | null;
  private continueSaveButtonEl?: HTMLButtonElement | null;
  private clearSaveButtonEl?: HTMLButtonElement | null;
  private nameValidationLabelEl?: HTMLElement | null;
  private replaySelectionStatusEl?: HTMLElement | null;
  private tutorialPromptOverlayEl?: HTMLElement | null;
  private tutorialPromptYesEl?: HTMLButtonElement | null;
  private tutorialPromptNoEl?: HTMLButtonElement | null;
  private pendingTutorialPromptResolver?: ((value: boolean) => void) | null;
  private layoutResizeHandler?: () => void;
  private viewportResizeHandler?: () => void;
  private viewportScrollHandler?: () => void;
  private isStartingGame: boolean = false;
  private extraLevelSelectUnlocked: boolean = false;
  private campaignSave: utils.CampaignSaveData | null = null;
  
  constructor() {
    super({ key: 'NameInputScene' });
  }

  init(): void {
    this.resetTransientUiState();
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupResponsiveLayout, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupResponsiveLayout, this);

    // iOS Audio Unlock: Must unlock audio context on first user interaction
    this.unlockAudioForIOS();
    
    // Only male character is available
    this.selectedCharacter = 'male';
    this.campaignSave = utils.getCampaignSave();
    this.selectedDifficulty = this.getSavedDifficultyOrDefault(this.campaignSave?.difficulty);
    this.extraLevelSelectUnlocked = utils.hasUnlockedExtraLevelSelect();
    this.initializeRememberedPlayerName();
    
    // Create Phaser background image (covers entire canvas properly)
    this.createBackground();
    
    this.createDOMUI();
    this.setupInputHandlers();
    this.setupResponsiveLayout();
  }

  private resetTransientUiState(): void {
    this.isStartingGame = false;
    this.pendingTutorialPromptResolver = null;
    this.tutorialPromptOverlayEl = null;
    this.tutorialPromptYesEl = null;
    this.tutorialPromptNoEl = null;
    this.nameInputEl = null;
    this.startButtonEl = null;
    this.continueSaveButtonEl = null;
    this.clearSaveButtonEl = null;
    this.nameValidationLabelEl = null;
    this.replaySelectionStatusEl = null;
    this.selectedReplayLevel = null;
    this.extraLevelSelectUnlocked = false;
    this.campaignSave = null;
  }

  private getSavedDifficultyOrDefault(value: unknown): DifficultyType {
    return value === 'espoo' || value === 'lahti' || value === 'vantaa'
      ? value
      : 'vantaa';
  }

  private initializeRememberedPlayerName(): void {
    const registryName = this.sanitizePlayerName(String(this.registry.get('playerName') || ''));
    if (registryName.trim().length > 0) {
      this.playerName = registryName;
      return;
    }

    try {
      const storedName = this.sanitizePlayerName(window.localStorage?.getItem(LAST_PLAYER_NAME_STORAGE_KEY) || '');
      this.playerName = storedName.trim();
    } catch {
      this.playerName = '';
    }
  }

  private renderHeadlineCards(cards: NameHeadlineCard[], side: 'left' | 'right'): string {
    return cards.map((card, index) => {
      const tiltClass = this.getHeadlineTiltClass(side, index);
      return `
        <div class="name-headline-card ${tiltClass}">
          <span class="name-headline-kicker">${card.kicker}</span>
          <span class="name-headline-text">${card.text}</span>
        </div>
      `;
    }).join('');
  }

  private getHeadlineTiltClass(side: 'left' | 'right', index: number): string {
    if (side === 'left') {
      return index % 2 === 0 ? 'name-headline-card-tilt-left' : 'name-headline-card-tilt-right';
    }
    return index % 2 === 0 ? 'name-headline-card-feature' : 'name-headline-card-tilt-left';
  }

  private shouldPersistPlayerName(name: string): boolean {
    const normalized = name.trim().toUpperCase();
    if (!normalized) return false;
    if (!this.areNameCheatsEnabled()) return true;
    if (normalized === 'HEMOHES' || normalized === 'KIIA40') return false;
    return !/^HEMOHES(10|[1-9])$/.test(normalized);
  }

  private areNameCheatsEnabled(): boolean {
    if (import.meta.env.DEV) return true;
    try {
      return window.localStorage?.getItem('laturaivo_enable_name_cheats') === '1';
    } catch {
      return false;
    }
  }

  private persistRememberedPlayerName(name: string): void {
    const sanitized = this.sanitizePlayerName(name).trim();
    if (!this.shouldPersistPlayerName(sanitized)) return;

    try {
      window.localStorage?.setItem(LAST_PLAYER_NAME_STORAGE_KEY, sanitized);
    } catch {
      // Ignore localStorage failures and keep game flow working.
    }
  }
  
  /**
   * iOS Audio Unlock - Critical for App Store compliance
   */
  unlockAudioForIOS(): void {
    if (this.sound.locked) {
      this.input.once('pointerdown', () => {
        utils.ensureSceneAudioReady(this);
      });
    }
    utils.ensureSceneAudioReady(this);
  }
  
  createBackground(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Add background image using Phaser (scales properly with canvas)
    const bg = this.add.image(width / 2, height / 2, 'snowy_forest_background_night');
    
    // Scale to cover entire screen using initScale for iOS consistency
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const maxDimension = Math.max(scaleX, scaleY) * Math.max(bg.width, bg.height);
    utils.initScale(bg, { x: 0.5, y: 0.5 }, maxDimension, maxDimension);
    
    // Add dark overlay for better text readability
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);
    overlay.setDepth(1);
  }

  createDOMUI(): void {
    const characterPreviewSrc = utils.resolveAssetUrl(
      this,
      'player_ski_idle_R_frame1',
      'assets/custom/main_character_v2/player_ski_idle_R_frame1.png'
    );
    const leftHeadlinesHtml = this.renderHeadlineCards(NAME_INPUT_HEADLINE_LEFT, 'left');
    const rightHeadlinesHtml = this.renderHeadlineCards(NAME_INPUT_HEADLINE_RIGHT, 'right');
    const continueSaveHtml = this.renderContinueSaveHtml();
    const extraLevelSelectHtml = this.renderExtraLevelSelectHtml();

    const uiHTML = `
      <div id="name-input-container" class="absolute inset-0 z-[1000] flex flex-col items-center overflow-hidden" style="image-rendering: pixelated; font-family: 'PublicPixel'; padding-top: calc(env(safe-area-inset-top, 0px) + 14px); padding-right: calc(env(safe-area-inset-right, 0px) + 6px); padding-left: calc(env(safe-area-inset-left, 0px) + 6px);">
        <div id="name-headline-left" class="name-headline-rail pointer-events-none" aria-hidden="true">
          ${leftHeadlinesHtml}
        </div>

        <div id="name-headline-right" class="name-headline-rail pointer-events-none" aria-hidden="true">
          ${rightHeadlinesHtml}
        </div>

        <!-- Main Content Container -->
        <div id="name-input-scroll" class="w-full flex-1 flex flex-col items-center overflow-y-auto overflow-x-hidden pointer-events-auto" style="padding-top: 10px; padding-bottom: 6px;">
          <div id="name-input-content" class="relative flex flex-col items-center gap-2 md:gap-3 px-3 py-2 md:py-4 text-center w-full max-w-[980px]" style="transform-origin: top center; padding-top: clamp(14px, 3vh, 30px);">
          
          <!-- Title -->
          <div class="text-yellow-400 font-bold" style="font-family: 'PublicPixel'; font-size: clamp(22px, 3.8vw, 34px); text-shadow: 3px 3px 0px #000000;">
            ANNA NIMESI
          </div>
          
          <!-- Subtitle -->
          <div class="text-cyan-300 text-sm md:text-base" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000;">
            Syötä nimesi tulostaulukkoa varten
          </div>

          <!-- Name Input Container -->
          <div class="game-pixel-container-gray-800 p-2 md:p-3 flex flex-col gap-2 items-center" style="width: min(92vw, 420px);">
            <input 
              type="text" 
              id="player-name-input" 
              maxlength="12"
              placeholder="NIMI..."
              autocomplete="off"
              autocapitalize="characters"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="done"
              inputmode="text"
              class="w-full px-3 py-2 text-base md:text-xl text-center text-white bg-gray-900 border-4 border-gray-600 focus:border-yellow-400 focus:outline-none uppercase"
              style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000; -webkit-user-select: text; user-select: text; -webkit-touch-callout: default;"
            />
            <span class="text-gray-400 text-xs" style="font-family: 'PublicPixel';">Napauta kenttää kirjoittaaksesi • enintään 12 merkkiä</span>
            <span id="name-validation-label" class="text-red-300 text-xs hidden" style="font-family: 'PublicPixel';">Nimi on pakollinen</span>
          </div>
          
          <!-- Character Display -->
          <div id="character-section" class="flex flex-col items-center gap-2 mt-1">
            <div class="text-yellow-400 text-lg font-bold" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000000;">HAHMOSI</div>
            
            <!-- Character Display - Single character -->
            <div id="character-card" class="game-pixel-container-blue-600 p-2 md:p-3 flex flex-col items-center gap-1 border-4 border-yellow-400" style="min-width: 170px;">
              <img 
                src="${characterPreviewSrc}" 
                alt="Keski-ikäinen Espoolaismies" 
                id="character-preview-img"
                class="h-16 md:h-24 object-contain"
                style="image-rendering: pixelated;"
              />
              <span class="text-white text-xs md:text-sm font-bold text-center" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">Keski-ikäinen</span>
              <span class="text-white text-xs md:text-sm font-bold text-center" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">Espoolaismies</span>
            </div>
          </div>

          <!-- Difficulty Selection -->
          <div id="difficulty-section" class="flex flex-col gap-1 w-full mt-1">
            <div class="text-yellow-400 text-xs font-bold" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000000;">VAIKEUSASTE</div>
            <div class="difficulty-buttons-row flex gap-2 justify-center flex-wrap">
              <button id="difficulty-espoo" class="difficulty-btn game-pixel-container-clickable-green-600 px-3 py-2 flex flex-col items-center justify-center cursor-pointer hover:brightness-110 transition-all" style="min-width: 92px;">
                <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">ESPOO</span>
                <span class="text-green-300 text-xs" style="font-family: 'PublicPixel';">Helppo</span>
              </button>
              <button id="difficulty-vantaa" class="difficulty-btn is-selected game-pixel-container-clickable-yellow-600 px-3 py-2 flex flex-col items-center justify-center cursor-pointer hover:brightness-110 transition-all" style="min-width: 92px;">
                <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">VANTAA</span>
                <span class="text-yellow-300 text-xs" style="font-family: 'PublicPixel';">Keskivaikea</span>
              </button>
              <button id="difficulty-lahti" class="difficulty-btn game-pixel-container-clickable-red-600 px-3 py-2 flex flex-col items-center justify-center cursor-pointer hover:brightness-110 transition-all" style="min-width: 92px;">
                <span class="text-white text-sm font-bold" style="font-family: 'PublicPixel';">LAHTI</span>
                <span class="text-red-300 text-xs" style="font-family: 'PublicPixel';">Pitkä rata</span>
              </button>
            </div>
          </div>

          ${continueSaveHtml}

          ${extraLevelSelectHtml}

          </div>
        </div>

        <!-- Sticky footer: always visible start action -->
        <div id="name-input-footer" class="w-full flex flex-col items-center pointer-events-auto" style="padding: 4px 10px calc(env(safe-area-inset-bottom, 0px) + 6px); background: linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.45) 100%);">
          <button 
            id="start-button"
            class="game-pixel-container-clickable-green-600 px-6 py-3 text-white text-lg md:text-2xl font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000; min-width: min(92vw, 460px);"
          >
            ALOITA PELI ▶️
          </button>
          <div class="text-gray-300 text-[10px] mt-1" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">
            Napauta aloittaaksesi
          </div>
        </div>

        <div id="tutorial-replay-overlay" class="absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200" style="z-index: 1200; background: rgba(2, 6, 23, 0.84); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);">
          <div class="game-pixel-container-gray-800 flex flex-col items-center gap-4 px-5 py-5 text-center" style="width: min(88vw, 420px);">
            <div class="text-yellow-400 font-bold" style="font-family: 'PublicPixel'; font-size: clamp(16px, 2vw, 22px); text-shadow: 2px 2px 0px #000;">
              HALUATKO PELATA
              <br />
              TUTORIAALITASON ENSIN?
            </div>
            <div class="flex gap-3 justify-center flex-wrap w-full">
              <button id="tutorial-replay-no" class="game-pixel-container-clickable-red-600 px-4 py-3 text-white text-sm md:text-base font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000; min-width: 120px;">
                EI
              </button>
              <button id="tutorial-replay-yes" class="game-pixel-container-clickable-green-600 px-4 py-3 text-white text-sm md:text-base font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000; min-width: 120px;">
                KYLLÄ
              </button>
            </div>
          </div>
        </div>

        <style>
          input::placeholder {
            color: #666;
            font-family: 'PublicPixel';
          }

          .difficulty-btn {
            position: relative;
            margin-top: 2px;
            border: 2px solid rgba(255, 255, 255, 0.35);
            transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease, border-color 140ms ease;
          }

          .extra-mode-btn,
          .extra-level-btn {
            position: relative;
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease, border-color 140ms ease;
          }

          .extra-level-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
            gap: 8px;
            width: 100%;
          }

          .difficulty-buttons-row {
            padding-top: 2px;
          }

          #difficulty-section {
            scroll-margin-bottom: 118px;
          }

          #continue-save-panel {
            flex-shrink: 0;
          }

          #name-input-scroll {
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          .name-headline-rail {
            position: absolute;
            top: clamp(124px, 20vh, 224px);
            width: min(21vw, 240px);
            display: flex;
            flex-direction: column;
            gap: 14px;
            z-index: 1100;
          }

          #name-headline-left {
            left: 12px;
            align-items: flex-start;
          }

          #name-headline-right {
            right: 12px;
            align-items: flex-end;
          }

          .name-headline-card {
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
            box-sizing: border-box;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(255, 249, 219, 0.98) 0%, rgba(246, 232, 184, 0.94) 100%);
            border: 4px solid #111827;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
            padding: 10px 12px;
            color: #111827;
          }

          .name-headline-card-tilt-left {
            transform: rotate(-4deg);
          }

          .name-headline-card-tilt-right {
            transform: rotate(3deg);
          }

          .name-headline-card-feature {
            transform: rotate(4deg);
          }

          .name-headline-kicker {
            display: inline-block;
            align-self: flex-start;
            padding: 3px 6px;
            background: #b91c1c;
            color: #fef2f2;
            font-size: clamp(8px, 0.72vw, 10px);
            line-height: 1.2;
            letter-spacing: 0.04em;
            text-shadow: none;
          }

          .name-headline-text {
            font-size: clamp(10px, 1vw, 15px);
            line-height: 1.45;
            text-align: left;
            text-shadow: none;
            max-width: 100%;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          }

          .difficulty-btn.is-selected {
            border-color: #67e8f9;
            transform: translateY(-2px) scale(1.05);
            filter: brightness(1.16);
            box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.5), 0 0 20px rgba(34, 211, 238, 0.35);
          }

          .extra-mode-btn.is-selected,
          .extra-level-btn.is-selected {
            border-color: #67e8f9;
            transform: translateY(-2px);
            filter: brightness(1.14);
            box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.45), 0 0 18px rgba(34, 211, 238, 0.3);
          }

          #start-button:disabled {
            cursor: not-allowed;
            opacity: 0.5;
            filter: saturate(0.65);
            transform: none !important;
          }

          @media (max-width: 980px) {
            #name-input-container {
              padding-top: max(28px, calc(env(safe-area-inset-top, 0px) + 18px)) !important;
            }

            .name-headline-rail {
              width: min(26vw, 190px);
              top: clamp(132px, 22vh, 216px);
            }
          }

          @media (max-width: 720px) {
            #name-input-container {
              padding-top: max(42px, calc(env(safe-area-inset-top, 0px) + 22px)) !important;
            }

            #name-input-scroll {
              padding-top: 14px !important;
            }

            #name-input-content {
              padding-top: 20px !important;
            }

            .name-headline-rail {
              width: min(30vw, 148px);
              gap: 10px;
              top: clamp(138px, 21vh, 190px);
            }

            .name-headline-card {
              padding: 8px 9px;
              border-width: 3px;
            }

            .name-headline-text {
              font-size: clamp(8px, 2.2vw, 11px);
              line-height: 1.35;
            }

            #continue-save-panel {
              width: min(92vw, 460px) !important;
            }
          }

          @media (max-width: 560px) {
            #name-input-container {
              padding-top: max(56px, calc(env(safe-area-inset-top, 0px) + 26px)) !important;
            }

            #name-input-scroll {
              padding-top: 18px !important;
            }

            #name-input-content {
              padding-top: 24px !important;
            }

            .name-headline-rail {
              width: min(31vw, 126px);
              top: max(124px, calc(env(safe-area-inset-top, 0px) + 96px));
              gap: 8px;
            }

            #name-headline-left {
              left: 4px;
            }

            #name-headline-right {
              right: 4px;
            }

            .name-headline-card {
              padding: 7px 7px;
              box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24);
            }

            .name-headline-kicker {
              font-size: 7px;
              padding: 2px 5px;
            }

            .name-headline-text {
              font-size: 7px;
              line-height: 1.3;
            }
          }

          @media (max-height: 460px) and (orientation: landscape) {
            #name-input-container {
              padding-left: max(26px, calc(env(safe-area-inset-left, 0px) + 18px)) !important;
              padding-right: max(26px, calc(env(safe-area-inset-right, 0px) + 18px)) !important;
            }

            .name-headline-rail {
              width: clamp(92px, 16vw, 122px);
              top: clamp(76px, 20vh, 94px);
              gap: 9px;
            }

            .name-headline-card {
              padding: 8px 9px;
            }

            .name-headline-kicker {
              font-size: clamp(6px, 0.8vw, 7px);
              padding: 2px 5px;
            }

            .name-headline-text {
              font-size: clamp(8px, 0.95vw, 9px);
              line-height: 1.22;
            }

            #name-headline-left {
              left: max(68px, calc(env(safe-area-inset-left, 0px) + 42px));
            }

            #name-headline-right {
              right: max(68px, calc(env(safe-area-inset-right, 0px) + 42px));
            }

            #character-section {
              flex-direction: row;
              gap: 8px;
            }

            #character-card {
              min-width: 126px !important;
              padding: 6px !important;
            }

            #character-preview-img {
              height: 42px !important;
            }

            #continue-save-panel {
              gap: 5px !important;
              padding: 7px !important;
            }
          }

          @media (max-height: 520px) {
            #name-input-content {
              gap: 6px !important;
            }

            #name-input-scroll {
              padding-top: 8px !important;
              padding-bottom: 14px !important;
            }

            .difficulty-buttons-row {
              padding-top: 2px;
            }

            .extra-level-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            #character-section {
              gap: 4px !important;
              margin-top: 0 !important;
            }

            #character-card {
              padding: 6px !important;
            }

            #character-preview-img {
              height: 44px !important;
            }

            #continue-save-panel {
              gap: 5px !important;
              padding: 7px !important;
            }
          }

          @media (max-height: 700px) and (orientation: portrait) {
            #name-input-content {
              gap: 6px !important;
              padding-top: 12px !important;
            }

            #character-section {
              gap: 4px !important;
            }

            #character-card {
              padding: 6px !important;
              min-width: 138px !important;
            }

            #character-preview-img {
              height: 48px !important;
            }

            #continue-save-panel {
              gap: 5px !important;
              padding: 7px !important;
            }
          }
        </style>
      </div>
    `;

    this.uiContainer = utils.initUIDom(this, uiHTML);
    this.uiContainer.setDepth(10);
  }

  private fitContentToViewport(): void {
    const container = document.getElementById('name-input-container') as HTMLElement | null;
    const content = document.getElementById('name-input-content') as HTMLElement | null;
    const footer = document.getElementById('name-input-footer') as HTMLElement | null;
    if (!container || !content || !footer) return;

    content.style.transform = 'scale(1)';

    // iOS can fail to focus text inputs that are inside transformed parents.
    // Keep this screen scrollable instead of scaled on iOS so first-tap focus works.
    if (utils.isIOS()) {
      return;
    }

    const availableHeight = Math.max(1, container.clientHeight - footer.getBoundingClientRect().height - 8);
    const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);

    if (contentHeight > availableHeight) {
      const scale = Phaser.Math.Clamp(availableHeight / contentHeight, 0.68, 1);
      content.style.transform = `scale(${scale})`;
    }
  }

  private setupResponsiveLayout(): void {
    const apply = () => this.fitContentToViewport();
    this.layoutResizeHandler = apply;
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);

    if (window.visualViewport) {
      this.viewportResizeHandler = apply;
      this.viewportScrollHandler = apply;
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
    }

    this.time.delayedCall(0, apply);
    this.time.delayedCall(120, apply);
    this.time.delayedCall(320, apply);
  }

  private cleanupResponsiveLayout(): void {
    if (this.layoutResizeHandler) {
      window.removeEventListener('resize', this.layoutResizeHandler);
      window.removeEventListener('orientationchange', this.layoutResizeHandler);
      this.layoutResizeHandler = undefined;
    }

    if (window.visualViewport && this.viewportResizeHandler) {
      window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
      this.viewportResizeHandler = undefined;
    }

    if (window.visualViewport && this.viewportScrollHandler) {
      window.visualViewport.removeEventListener('scroll', this.viewportScrollHandler);
      this.viewportScrollHandler = undefined;
    }
  }

  setupInputHandlers(): void {
    // Get input element
    this.nameInputEl = document.getElementById('player-name-input') as HTMLInputElement | null;
    this.startButtonEl = document.getElementById('start-button') as HTMLButtonElement | null;
    this.continueSaveButtonEl = document.getElementById('continue-save-button') as HTMLButtonElement | null;
    this.clearSaveButtonEl = document.getElementById('clear-save-button') as HTMLButtonElement | null;
    this.nameValidationLabelEl = document.getElementById('name-validation-label');
    this.replaySelectionStatusEl = document.getElementById('replay-selection-status');
    this.tutorialPromptOverlayEl = document.getElementById('tutorial-replay-overlay');
    this.tutorialPromptYesEl = document.getElementById('tutorial-replay-yes') as HTMLButtonElement | null;
    this.tutorialPromptNoEl = document.getElementById('tutorial-replay-no') as HTMLButtonElement | null;

    const inputElement = this.nameInputEl;
    const startButton = this.startButtonEl;
    
    if (inputElement) {
      inputElement.value = this.playerName;

      const focusNameInput = (): void => {
        utils.ensureSceneAudioReady(this);
        // Retry focus on next tick to handle iOS viewport settling.
        const focus = () => {
          try {
            inputElement.focus({ preventScroll: true } as FocusOptions);
          } catch {
            inputElement.focus();
          }
        };
        focus();
        window.setTimeout(focus, 0);
      };

      inputElement.addEventListener('click', () => {
        focusNameInput();
      });
      inputElement.addEventListener('pointerdown', () => {
        focusNameInput();
      });
      inputElement.addEventListener('touchstart', () => {
        focusNameInput();
      }, { passive: true });

      // Handle normal input - let player type their own name
      inputElement.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        // Convert to uppercase and remove invalid characters
        this.playerName = this.sanitizePlayerName(target.value);
        target.value = this.playerName;
        this.updateNameValidationState(false);
      });
      
      // Handle Enter key
      inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.hasValidPlayerName()) {
            this.startGame();
          } else {
            this.updateNameValidationState(true);
            focusNameInput();
          }
        }
      });
    }
    
    if (startButton) {
      startButton.addEventListener('click', () => {
        this.startGame();
      });
      startButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.startGame();
      }, { passive: false });
    }

    if (this.continueSaveButtonEl) {
      this.continueSaveButtonEl.addEventListener('click', () => this.startSavedGame());
      this.continueSaveButtonEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.startSavedGame();
      }, { passive: false });
    }

    if (this.clearSaveButtonEl) {
      this.clearSaveButtonEl.addEventListener('click', () => this.clearSavedProgress());
      this.clearSaveButtonEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.clearSavedProgress();
      }, { passive: false });
    }
    
    // Difficulty button handlers
    this.setupExtraLevelButtons();
    this.setupDifficultyButtons();
    this.setupTutorialReplayPrompt();
    this.updateNameValidationState(false);
    this.updateReplayLevelSelection(this.selectedReplayLevel, false);
  }

  private renderContinueSaveHtml(): string {
    if (!this.campaignSave) return '';

    const savedLevel = Phaser.Math.Clamp(
      Math.floor(Number(this.campaignSave.highestUnlockedLevel || 1)),
      1,
      LevelManager.TOTAL_LEVELS
    );
    if (savedLevel <= 1) return '';

    const savedName = this.sanitizePlayerName(this.campaignSave.playerName || '').trim();
    const savedDifficulty = this.getSavedDifficultyOrDefault(this.campaignSave.difficulty).toUpperCase();
    const savedLevelName = LevelManager.getLevelName(savedLevel).toUpperCase();
    const nameLine = savedName ? `${savedName} • ${savedDifficulty}` : savedDifficulty;
    const continuesAtBoss = utils.getBossCheckpointLevel() === savedLevel && LevelManager.isBossLevel(savedLevel);
    const continueTargetLine = continuesAtBoss ? `${savedLevelName}<br />BOSS-CHECKPOINT` : savedLevelName;
    const continueButtonLabel = continuesAtBoss ? 'JATKA BOSSILTA' : `JATKA TASOLTA ${savedLevel}`;

    return `
      <div id="continue-save-panel" class="game-pixel-container-cyan-900 name-save-panel p-2 md:p-3 flex flex-col gap-2 items-center w-full mt-1" style="width: min(94vw, 560px); border-color: #67e8f9;">
        <div class="text-cyan-200 text-[10px] md:text-xs font-bold" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000;">
          TALLENNUS: ${nameLine}
        </div>
        <div class="text-white text-[9px] md:text-[10px] leading-relaxed" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">
          ${continueTargetLine} • Vaihda vaikeus ensin, jatka sitten.
        </div>
        <div class="flex justify-center gap-2 flex-wrap w-full">
          <button
            id="continue-save-button"
            class="game-pixel-container-clickable-cyan-600 px-3 py-2 text-white text-[10px] md:text-xs font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000; min-width: min(60vw, 260px);"
          >
            ${continueButtonLabel} ▶️
          </button>
          <button
            id="clear-save-button"
            class="game-pixel-container-clickable-gray-600 px-3 py-2 text-white text-[9px] md:text-[10px] font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000; min-width: min(48vw, 190px);"
          >
            POISTA
          </button>
        </div>
      </div>
    `;
  }

  private renderExtraLevelSelectHtml(): string {
    if (!this.extraLevelSelectUnlocked) {
      return '';
    }

    const levelButtons = Array.from({ length: LevelManager.TOTAL_LEVELS }, (_, index) => {
      const level = index + 1;
      const heading = level === 1 ? 'TUTOR.' : `TASO ${level}`;
      const subheading = this.getReplayLevelSubheading(level);
      return `
        <button
          data-replay-level="${level}"
          class="extra-level-btn game-pixel-container-clickable-purple-600 px-2 py-2 flex flex-col items-center justify-center text-center cursor-pointer hover:brightness-110"
          style="min-height: 72px;"
          aria-pressed="false"
        >
          <span class="text-white text-xs md:text-sm font-bold" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">${heading}</span>
          <span class="text-cyan-200 text-[10px] md:text-xs" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">${subheading}</span>
        </button>
      `;
    }).join('');

    return `
      <div id="extra-level-select-panel" class="game-pixel-container-purple-900 p-3 md:p-4 flex flex-col gap-3 w-full mt-2" style="width: min(94vw, 760px);">
        <div class="text-fuchsia-300 text-sm md:text-base font-bold" style="font-family: 'PublicPixel'; text-shadow: 2px 2px 0px #000;">
          EXTRA AVATTU
        </div>
        <div class="text-cyan-200 text-[10px] md:text-xs leading-relaxed" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">
          Lahti läpäisty. Valitse tästä kenttä uudelleenpeluuseen tai jätä valinta pois normaalia kampanja-aloitusta varten.
        </div>
        <div class="flex justify-center">
          <button
            id="replay-reset-button"
            class="extra-mode-btn is-selected game-pixel-container-clickable-gray-600 px-3 py-2 text-white text-[10px] md:text-xs font-bold cursor-pointer hover:brightness-110"
            style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;"
            aria-pressed="true"
          >
            NORMAALI KAMPANJA
          </button>
        </div>
        <div class="extra-level-grid">
          ${levelButtons}
        </div>
        <div id="replay-selection-status" class="text-yellow-300 text-[10px] md:text-xs" style="font-family: 'PublicPixel'; text-shadow: 1px 1px 0px #000;">
          Valinta: normaali kampanja-aloitus
        </div>
      </div>
    `;
  }

  private getReplayLevelSubheading(level: number): string {
    const rawName = LevelManager.getLevelName(level);
    const [, subheading = rawName] = rawName.split(' - ');
    return subheading.toUpperCase();
  }

  private getReplaySelectionLabel(level: number | null): string {
    if (level === null) {
      return 'Valinta: normaali kampanja-aloitus';
    }
    return `Valinta: ${LevelManager.getLevelName(level).toUpperCase()}`;
  }

  private getStartButtonLabel(): string {
    if (this.selectedReplayLevel === null) {
      return 'ALOITA PELI ▶️';
    }

    if (this.selectedReplayLevel === 1) {
      return 'PELAA TUTORIAALI ▶️';
    }

    return `PELAA TASO ${this.selectedReplayLevel} ▶️`;
  }

  private updateStartButtonLabel(): void {
    if (!this.startButtonEl) return;
    this.startButtonEl.textContent = this.getStartButtonLabel();
  }

  private sanitizePlayerName(rawName: string): string {
    return rawName.toUpperCase().replace(/[^A-ZÄÖÅ0-9 ]/g, '').substring(0, 12);
  }

  private hasValidPlayerName(): boolean {
    return this.playerName.trim().length > 0;
  }

  private updateNameValidationState(showError: boolean): void {
    const hasValidName = this.hasValidPlayerName();

    if (this.startButtonEl) {
      this.startButtonEl.disabled = !hasValidName;
      this.startButtonEl.setAttribute('aria-disabled', hasValidName ? 'false' : 'true');
      this.startButtonEl.title = hasValidName ? '' : 'Anna nimi ennen pelin aloitusta';
    }

    if (this.continueSaveButtonEl) {
      const saveHasName = !!this.sanitizePlayerName(this.campaignSave?.playerName || '').trim();
      const canContinue = saveHasName || hasValidName;
      this.continueSaveButtonEl.disabled = !canContinue;
      this.continueSaveButtonEl.setAttribute('aria-disabled', canContinue ? 'false' : 'true');
      this.continueSaveButtonEl.title = canContinue ? '' : 'Anna nimi tai aloita uusi peli';
    }

    if (!this.nameValidationLabelEl) return;
    const shouldShowError = showError && !hasValidName;
    this.nameValidationLabelEl.classList.toggle('hidden', !shouldShowError);
  }

  private startSavedGame(): void {
    if (this.isStartingGame || !this.campaignSave) return;

    const savedLevel = Phaser.Math.Clamp(
      Math.floor(Number(this.campaignSave.highestUnlockedLevel || 1)),
      1,
      LevelManager.TOTAL_LEVELS
    );
    if (savedLevel <= 1) {
      this.startGame();
      return;
    }

    const savedName = this.sanitizePlayerName(this.campaignSave.playerName || '').trim();
    const fallbackName = this.sanitizePlayerName(this.playerName || '').trim();
    const playerName = savedName || fallbackName;
    if (!playerName) {
      this.updateNameValidationState(true);
      this.nameInputEl?.focus();
      return;
    }

    this.isStartingGame = true;
    this.playerName = playerName;
    this.persistRememberedPlayerName(this.playerName);

    const difficulty = this.getSavedDifficultyOrDefault(this.selectedDifficulty);
    const characterType = this.campaignSave.characterType === 'male' ? 'male' : this.selectedCharacter;
    const startAtBossFight = utils.getBossCheckpointLevel() === savedLevel && LevelManager.isBossLevel(savedLevel);

    utils.markTutorialCompleted();
    this.registry.set('playerName', this.playerName);
    this.registry.set('godModeActivated', false);
    this.registry.set('cheatCodeUsed', false);
    this.registry.set('leaderboardEligible', true);
    this.registry.set('characterType', characterType);
    this.registry.set('difficulty', difficulty);
    this.registry.set('humorPackEnabled', true);
    this.registry.set('selectedReplayLevel', savedLevel);
    this.registry.set('isReturningPlayerSession', true);
    this.registry.set('tutorialReplayPromptShown', false);

    this.sound.play('ui_click_sound', { volume: 0.5 });
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.time.delayedCall(500, () => {
      if (savedLevel === 2 && !startAtBossFight) {
        this.scene.start("StoryScene", {
          storyKey: "intro",
          nextScene: "GameScene",
          nextSceneData: {
            level: 2,
            characterType,
            isTutorial: false
          }
        });
        return;
      }

      this.scene.start('GameScene', {
        level: savedLevel,
        characterType,
        isTutorial: false,
        startAtBossFight,
        bossRetryDeaths: startAtBossFight ? 1 : 0
      });
    });
  }

  private clearSavedProgress(): void {
    if (this.isStartingGame) return;

    utils.clearCampaignSave();
    this.campaignSave = null;
    this.continueSaveButtonEl = null;
    this.clearSaveButtonEl = null;
    document.getElementById('continue-save-panel')?.remove();
    this.sound.play('ui_click_sound', { volume: 0.3 });
    this.updateNameValidationState(false);
    this.fitContentToViewport();
  }
  
  setupDifficultyButtons(): void {
    const espooBtn = document.getElementById('difficulty-espoo');
    const vantaaBtn = document.getElementById('difficulty-vantaa');
    const lahtiBtn = document.getElementById('difficulty-lahti');

    const updateDifficultySelection = (difficulty: DifficultyType, playSound: boolean = true) => {
      this.selectedDifficulty = difficulty;
      if (playSound) {
        this.sound.play('ui_click_sound', { volume: 0.3 });
      }
      
      // Remove selection from all buttons
      [espooBtn, vantaaBtn, lahtiBtn].forEach(btn => {
        if (btn) {
          btn.classList.remove('is-selected');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
      
      // Add selection to active button
      const activeBtn = document.getElementById(`difficulty-${difficulty}`);
      if (activeBtn) {
        activeBtn.classList.add('is-selected');
        activeBtn.setAttribute('aria-pressed', 'true');
      }
    };
    
    if (espooBtn) {
      espooBtn.addEventListener('click', () => updateDifficultySelection('espoo'));
      espooBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        updateDifficultySelection('espoo');
      }, { passive: false });
    }
    if (vantaaBtn) {
      vantaaBtn.addEventListener('click', () => updateDifficultySelection('vantaa'));
      vantaaBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        updateDifficultySelection('vantaa');
      }, { passive: false });
    }
    if (lahtiBtn) {
      lahtiBtn.addEventListener('click', () => updateDifficultySelection('lahti'));
      lahtiBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        updateDifficultySelection('lahti');
      }, { passive: false });
    }

    // Ensure default selection visuals are always in sync.
    updateDifficultySelection(this.selectedDifficulty, false);
  }

  private setupExtraLevelButtons(): void {
    if (!this.extraLevelSelectUnlocked) {
      return;
    }

    const resetButton = document.getElementById('replay-reset-button');
    const levelButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-replay-level]'));

    const bindReplaySelection = (element: HTMLElement, level: number | null): void => {
      element.addEventListener('click', () => this.updateReplayLevelSelection(level));
      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.updateReplayLevelSelection(level);
      }, { passive: false });
    };

    if (resetButton) {
      bindReplaySelection(resetButton, null);
    }

    levelButtons.forEach((button) => {
      const level = Number(button.dataset.replayLevel || '');
      if (!Number.isFinite(level)) return;
      bindReplaySelection(button, level);
    });
  }

  private updateReplayLevelSelection(level: number | null, playSound: boolean = true): void {
    this.selectedReplayLevel = level;

    if (playSound) {
      this.sound.play('ui_click_sound', { volume: 0.3 });
    }

    const resetButton = document.getElementById('replay-reset-button');
    const levelButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-replay-level]'));

    if (resetButton) {
      const isSelected = level === null;
      resetButton.classList.toggle('is-selected', isSelected);
      resetButton.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }

    levelButtons.forEach((button) => {
      const buttonLevel = Number(button.dataset.replayLevel || '');
      const isSelected = level !== null && buttonLevel === level;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    if (this.replaySelectionStatusEl) {
      this.replaySelectionStatusEl.textContent = this.getReplaySelectionLabel(level);
    }

    this.updateStartButtonLabel();
  }

  startGame(): void {
    if (this.isStartingGame) return;

    // Name is mandatory for leaderboard integrity.
    if (!this.hasValidPlayerName()) {
      this.updateNameValidationState(true);
      this.nameInputEl?.focus();
      return;
    }

    this.isStartingGame = true;

    this.playerName = this.playerName.trim();
    this.persistRememberedPlayerName(this.playerName);
    
    const playerNameUpper = this.playerName.toUpperCase();
    const nameCheatsEnabled = this.areNameCheatsEnabled();
    const isKiia40Code = nameCheatsEnabled && playerNameUpper === "KIIA40";

    // Check for direct level access code:
    // HEMOHES1 ... HEMOHES10 starts directly from that level.
    const directLevelMatch = nameCheatsEnabled ? playerNameUpper.match(/^HEMOHES(10|[1-9])$/) : null;
    const directCodeLevel = isKiia40Code
      ? 10
      : (directLevelMatch ? Number(directLevelMatch[1]) : null);

    // All HEMOHES name codes should start directly in a boss fight.
    // - HEMOHES (without number) defaults to first boss level (2)
    // - HEMOHES1 maps to level 2 boss fight (level 1 has no boss)
    const isHemohesBossCode = nameCheatsEnabled && (playerNameUpper === "HEMOHES" || directCodeLevel !== null);
    const directStartLevel = (() => {
      if (nameCheatsEnabled && playerNameUpper === "HEMOHES") return 2;
      if (directCodeLevel === null) return null;
      return LevelManager.isBossLevel(directCodeLevel) ? directCodeLevel : 2;
    })();
    const directStartAtBossFight = isHemohesBossCode && directStartLevel !== null;

    // God mode easter egg:
    // Exact HEMOHES enables god mode.
    // KIIA40 enables god mode + direct level 10 final boss start.
    // HEMOHES1...10 start directly at that level's boss fight (without god mode).
    const isGodMode = nameCheatsEnabled && (playerNameUpper === "HEMOHES" || isKiia40Code);
    if (isGodMode) {
      console.debug('🔱 JUMAL MODE ACTIVATED! Welcome, hemohes! 🔱');
    }
    if (isKiia40Code) {
      console.debug("⚔️ KIIA40 CODE: jump to level 10 final boss fight + god mode");
    }
    
    // Leaderboard integrity flags:
    // - Explicit cheat-name sessions never submit to global leaderboard.
    const cheatCodeUsed = isHemohesBossCode;
    const leaderboardEligible = !cheatCodeUsed;

    // Store player name, character type, difficulty, and god mode status in registry
    this.registry.set('playerName', this.playerName);
    this.registry.set('godModeActivated', isGodMode);
    this.registry.set('cheatCodeUsed', cheatCodeUsed);
    this.registry.set('leaderboardEligible', leaderboardEligible);
    this.registry.set('characterType', this.selectedCharacter);
    this.registry.set('difficulty', this.selectedDifficulty);
    this.registry.set('humorPackEnabled', true);
    this.registry.set('selectedReplayLevel', this.selectedReplayLevel);
    const continueToGame = async () => {
      const hasCompletedTutorial = utils.hasCompletedTutorial();
      this.registry.set('isReturningPlayerSession', hasCompletedTutorial);
      this.registry.set('tutorialReplayPromptShown', false);

      // Returning players choose immediately whether to replay tutorial.
      let selectedStartLevel = hasCompletedTutorial ? 2 : 1;
      let showIntroBridgeBeforeLevel2 = hasCompletedTutorial;
      if (this.selectedReplayLevel !== null) {
        selectedStartLevel = this.selectedReplayLevel;
        showIntroBridgeBeforeLevel2 = false;
      } else if (directStartLevel === null && hasCompletedTutorial) {
        const wantsTutorialFirst = await this.showTutorialReplayPrompt();
        selectedStartLevel = wantsTutorialFirst ? 1 : 2;
        showIntroBridgeBeforeLevel2 = !wantsTutorialFirst;
      }

      // Play click sound
      this.sound.play('ui_click_sound', { volume: 0.5 });

      // Fade out and start game
      this.cameras.main.fadeOut(500, 0, 0, 0);

      this.time.delayedCall(500, () => {

        // Name code access: HEMOHES1...10
        if (directStartLevel !== null) {
          this.scene.start('GameScene', {
            level: directStartLevel,
            characterType: this.selectedCharacter,
            isTutorial: false,
            startAtBossFight: directStartAtBossFight
          });
        } else {
          // If player skips tutorial, show intro cinematic/story before level 2.
          if (selectedStartLevel === 2 && showIntroBridgeBeforeLevel2) {
            this.scene.start("StoryScene", {
              storyKey: "intro",
              nextScene: "GameScene",
              nextSceneData: {
                level: 2,
                characterType: this.selectedCharacter,
                isTutorial: false
              }
            });
            return;
          }

          this.scene.start('GameScene', { 
            level: selectedStartLevel,
            characterType: this.selectedCharacter,
            isTutorial: false
          });
        }
      });
    };

    void continueToGame().catch(() => {
      this.isStartingGame = false;
    });
  }

  private setupTutorialReplayPrompt(): void {
    const resolveChoice = (value: boolean): void => {
      utils.ensureSceneAudioReady(this);
      this.sound.play('ui_click_sound', { volume: 0.3 });
      this.setTutorialReplayPromptVisible(false);
      const resolver = this.pendingTutorialPromptResolver;
      this.pendingTutorialPromptResolver = null;
      resolver?.(value);
    };

    this.tutorialPromptYesEl?.addEventListener('click', () => resolveChoice(true));
    this.tutorialPromptYesEl?.addEventListener('touchend', (e) => {
      e.preventDefault();
      resolveChoice(true);
    }, { passive: false });

    this.tutorialPromptNoEl?.addEventListener('click', () => resolveChoice(false));
    this.tutorialPromptNoEl?.addEventListener('touchend', (e) => {
      e.preventDefault();
      resolveChoice(false);
    }, { passive: false });
  }

  private setTutorialReplayPromptVisible(visible: boolean): void {
    if (!this.tutorialPromptOverlayEl) return;
    this.tutorialPromptOverlayEl.style.opacity = visible ? '1' : '0';
    this.tutorialPromptOverlayEl.style.pointerEvents = visible ? 'auto' : 'none';
  }

  private showTutorialReplayPrompt(): Promise<boolean> {
    if (!this.tutorialPromptOverlayEl) {
      return Promise.resolve(false);
    }

    this.setTutorialReplayPromptVisible(true);

    return new Promise<boolean>((resolve) => {
      this.pendingTutorialPromptResolver = resolve;
    });
  }
}
