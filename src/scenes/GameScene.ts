import Phaser from "phaser";
import * as utils from "../utils";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Tesla } from "../entities/Tesla";
import { FamilyGroup } from "../entities/FamilyGroup";
import { DrunkPerson } from "../entities/DrunkPerson";
import { ProSkier } from "../entities/ProSkier";
import { PowerWalker } from "../entities/PowerWalker";
import { HeadphoneWalker } from "../entities/HeadphoneWalker";
import { SmokingLady } from "../entities/SmokingLady";
import { PadelPlayer } from "../entities/PadelPlayer";
import { TennisPlayer } from "../entities/TennisPlayer";
import { PowerUp } from "../entities/PowerUp";
import type { PowerUpType } from "../entities/PowerUp";
import { IcePatch, FallenTree, MooseCrossing } from "../entities/Hazard";
import { Chihuahua } from "../entities/Chihuahua";
import { SomaliSkier } from "../entities/SomaliSkier";
import { AsianTechWorker } from "../entities/AsianTechWorker";
import { CryptoBro } from "../entities/CryptoBro";
import { InfluencerSelfie } from "../entities/InfluencerSelfie";
import { EScooterRider } from "../entities/EScooterRider";
import { CrossfitBro } from "../entities/CrossfitBro";
import { BrunchLady } from "../entities/BrunchLady";
import { GolfCartDriver } from "../entities/GolfCartDriver";
import { YachtOwner } from "../entities/YachtOwner";
import { RealEstateAgent } from "../entities/RealEstateAgent";
import { WineMom } from "../entities/WineMom";
import { PrivateSchoolSUV } from "../entities/PrivateSchoolSUV";
import { LitmanenParody } from "../entities/LitmanenParody";
import { TunedCar } from "../entities/TunedCar";
import { BluetoothBomber } from "../entities/BluetoothBomber";
import { AfterSkiAlpha } from "../entities/AfterSkiAlpha";
import { PassiveGrandpa } from "../entities/PassiveGrandpa";
import { CityCyclist } from "../entities/CityCyclist";
import { WellnessWarrior } from "../entities/WellnessWarrior";
import { LahtiPowerUp } from "../entities/LahtiPowerUp";
import type { LahtiPowerUpType } from "../entities/LahtiPowerUp";
import { JumpRamp } from "../entities/JumpRamp";
import type { JumpRampSize } from "../entities/JumpRamp";
import { LevelManager } from "../LevelManager";
import { gameConfig, teslaConfig, playerConfig, livesConfig, abilityUnlockConfig } from "../gameConfig.json";
import { Boss } from "../entities/Boss";
import { PeterSync } from "../entities/PeterSync";
import { KanniBoss } from "../entities/KanniBoss";
import { CombatSfxManager } from "../managers/CombatSfxManager";
import { GAME_CENTER_ACHIEVEMENT_IDS, GameCenterAchievementManager } from "../managers/GameCenterAchievementManager";
import {
  ACHIEVEMENT_LINES,
  COMMENTATOR_LINES,
  COMBO_NAMES,
  CRIT_LINES,
  DODGE_LINES,
  EXCUSE_LINES,
  HIT_REACTIONS,
  MANTRA_LINES,
  pickHumorLine,
  PLAYER_SHOUTS,
  STATUS_LINES
} from "../humor/HumorPack";
import { getDifficultyLevelMusicKey, normalizeDifficultyTier, shouldDifficultyShowVideos } from "../content/DifficultyPresentation";
import { FLAVOR_TEXT_ENABLED, sanitizePlayerFacingText } from "../content/PlayerTextPolicy";
import { shouldIgnoreKeyboardEvent } from "../platform";
import { formatSkipHintLine } from "../controlPrompts";

type WeaponMasteryKey = "pole" | "axe" | "voltti";
type StyleRank = "D" | "C" | "B" | "A" | "S";
type RouteChoiceId = "safe_lane" | "chaos_lane" | "precision_lane";
type PassiveChoiceId = "thick_skin" | "battery_saver" | "combo_rush" | "stomp_engine" | "lucky_star";
type MicroObjectiveKind = "no_hit" | "kill_count" | "combo_peak" | "trick_count";
type EnemyRole = "vanguard" | "flanker" | "disruptor" | "support";
type EnemyAffix = "iron_skin" | "berserker" | "nimble" | "vampiric" | "bulwark";
type EnemyRoleGroupId = "rush_pack" | "shield_wall";
type LevelMomentKind = "wave_surge" | "weather_spike" | "elite_patrol" | "miniboss_ambush";
type RunModifierId = "packed_tracks" | "glass_cannon" | "second_wind" | "adrenaline";
type SafeCameraPreset = "light_hit" | "heavy_hit" | "boss_super";
type BossPlayerAttackKind = "pole" | "axe" | "voltti" | "stomp";
type BossCounterWindowKind = "perfectDodge" | "telegraph" | "stagger";
type GameplayInputType = "jump" | "pole" | "axe" | "voltti" | "rage" | "dodge" | "left" | "right";
type GameplayInputState = Record<GameplayInputType, boolean>;

const createGameplayInputState = (): GameplayInputState => ({
  jump: false,
  pole: false,
  axe: false,
  voltti: false,
  rage: false,
  dodge: false,
  left: false,
  right: false
});

const KEYBOARD_INPUT_BINDINGS: Record<string, GameplayInputType> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "dodge",
  KeyS: "dodge",
  ShiftLeft: "dodge",
  ShiftRight: "dodge",
  KeyJ: "pole",
  KeyZ: "pole",
  KeyK: "axe",
  KeyX: "axe",
  KeyL: "voltti",
  KeyC: "voltti",
  KeyR: "rage",
  KeyV: "rage"
};

interface EnemySpawnContext {
  forcedType?: string;
  forcedRole?: EnemyRole;
  roleGroup?: EnemyRoleGroupId;
  source?: "default" | "wave" | "event" | "ambush";
  forceElite?: boolean;
  forceMiniBoss?: boolean;
  bypassPopulationCap?: boolean;
  bypassSpawnThrottle?: boolean;
}

interface EnemyCombatProfile {
  role: EnemyRole;
  affixes: EnemyAffix[];
  isElite: boolean;
  isLeader: boolean;
  isMiniBoss: boolean;
  baseSpeed: number;
  baseDamage: number;
  baseAttackCooldown: number;
  baseMaxHealth: number;
  baseScoreValue: number;
  speedMultiplier: number;
  damageMultiplier: number;
  healthMultiplier: number;
  attackCooldownMultiplier: number;
  damageTakenMultiplier: number;
  evadeChance: number;
  feintChance: number;
  lifestealRatio: number;
  morale: number;
  maxPoise: number;
  poise: number;
  staggeredUntil: number;
  fleeUntil: number;
  enragedUntil: number;
  auraSpeedMultiplier: number;
  auraDamageMultiplier: number;
  auraMoraleBonus: number;
  lastEvasiveAt: number;
}

interface LevelEventMoment {
  threshold: number;
  kind: LevelMomentKind;
  triggered: boolean;
}

interface RunModifierSpec {
  id: RunModifierId;
  label: string;
  description: string;
}

interface RouteChoice {
  id: RouteChoiceId;
  label: string;
  description: string;
}

interface PassiveChoice {
  id: PassiveChoiceId;
  label: string;
  description: string;
}

interface WeaponMasteryState {
  xp: number;
  level: number;
  buffUntil: number;
}

interface MicroObjectiveState {
  kind: MicroObjectiveKind;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardScore: number;
  rewardEnergy: number;
  timeLimitMs: number;
  startedAt: number;
  completed: boolean;
  failed: boolean;
}

interface LevelGradeResult {
  grade: StyleRank;
  bonusScore: number;
  score: number;
}

interface BossCombatDamageResult {
  damage: number;
  multiplier: number;
  repeatPenalty: number;
  isCounterHit: boolean;
  isSuggestedCounter: boolean;
}

interface CinematicParallaxBand {
  node: Phaser.GameObjects.Rectangle;
  speed: number;
  phase: number;
  amplitude: number;
  baseY: number;
}

interface CinematicDustMote extends Phaser.GameObjects.Arc {
  driftX: number;
  driftY: number;
  wobble: number;
  baseAlpha: number;
}

// Main game scene for LATURAIVO - Level-based ski combat
export class GameScene extends Phaser.Scene {
  private static readonly RAMP_BASE_SPAWN_DELAY_MS = 8600;
  private static readonly BOSS_BASE_HEALTH_MULTIPLIER = 0.9; // +20% vs previous 0.75 baseline
  private static readonly BOSS_RETRY_HEALTH_DECAY_MULTIPLIER = 0.8;
  private static readonly LAHTI_BOSS_HEALTH_MULTIPLIER = 1.2;

  // Scene properties
  mapWidth: number = 3000;
  mapHeight: number = 720;
  groundY: number = 0;

  // Level system
  currentLevel: number = 1;
  levelDistance: number = 0; // Distance required to complete current level
  levelCompleted: boolean = false;
  clubhouseSpawned: boolean = false;
  clubhouse?: Phaser.GameObjects.Image;
  clubhouseX: number = 0;

  // Lives system
  lives: number = 3;
  maxLives: number = 5;

  // Boss system
  currentBoss?: Boss | PeterSync;
  kanniSupportBoss?: KanniBoss;
  bossDefeated: boolean = false;
  isBossLevel: boolean = false;
  bossSpawned: boolean = false;
  bossActive: boolean = false; // True when boss is on screen and fight is happening
  bossPerfectDodgeRageUsed: boolean = false;
  level2IntroBridgeShown: boolean = false;
  private bossCounterWindowUntil: number = 0;
  private bossCounterWindowKind: BossCounterWindowKind | null = null;
  private bossCounterSuggestedAttack: WeaponMasteryKey | null = null;
  private bossAttackChainKind: BossPlayerAttackKind | null = null;
  private bossAttackChainCount: number = 0;
  private bossAttackChainLastAt: number = -99999;
  private lastBossCombatHintAt: number = -99999;
  private lastBossPoleRewardAt: number = -99999;
  private lastBossPoleHealAt: number = -99999;

  // Game objects
  player!: Player;
  enemies!: Phaser.GameObjects.Group;
  enemyMeleeTriggers!: Phaser.GameObjects.Group;
  teslas!: Phaser.GameObjects.Group;
  jumpRamps!: Phaser.GameObjects.Group;
  decorations!: Phaser.GameObjects.Group;
  backgrounds!: Phaser.GameObjects.Group;

  // Scrolling
  scrollSpeed: number = 0;
  distanceTraveled: number = 0;
  
  // Stats tracking
  totalDistanceTraveled: number = 0;
  enemiesDefeated: number = 0;
  
  // Background scrolling
  scaledBgWidth: number = 0;

  // Spawning timers
  enemySpawnTimer?: Phaser.Time.TimerEvent;
  teslaSpawnTimer?: Phaser.Time.TimerEvent;
  rampSpawnTimer?: Phaser.Time.TimerEvent;
  decorationSpawnTimer?: Phaser.Time.TimerEvent;

  // Audio
  backgroundMusic?: Phaser.Sound.BaseSound;
  private currentMusicKey: string = "level_1_theme";
  private currentMusicVolume: number = 0.6;
  private level2BossThemeStarted: boolean = false;
  private level3BossThemeStarted: boolean = false;
  private level10BossThemeStarted: boolean = false;
  private readonly level3BossThemeKey: string = "elsa_mixdown_1";
  private readonly level4BossThemeKey: string = "lahti_level_4_boss_theme";
  private readonly level5BossThemeKey: string = "lahti_level_5_boss_theme";
  private audioRetryHandlersInstalled: boolean = false;
  private audioRetryHandler?: (event: Event) => void;
  private audioBootstrapTimer?: Phaser.Time.TimerEvent;
  private nativeFallbackMusic?: HTMLAudioElement;
  private nativeFallbackMusicKey?: string;
  private nativeFallbackMusicStartInFlight: boolean = false;
  private nativeFallbackRequestToken: number = 0;
  private levelMusicTitleCard?: Phaser.GameObjects.Text;
  private combatSfx?: CombatSfxManager;

  // Decoration keys for random spawning
  decorationKeys: string[] = [
    "spruce_tree_variant_1",
    "spruce_tree_variant_2",
    "spruce_tree_variant_3",
    "pine_sapling_variant_1",
    "pine_sapling_variant_2",
    "snow_pile_variant_1",
    "snow_pile_variant_2",
    "wooden_fence_variant_1"
  ];

  // Level 7 (Turku) decorations for local city flavor.
  turkuDecorationKeys: string[] = [
    "spruce_tree_variant_1",
    "spruce_tree_variant_2",
    "pine_sapling_variant_1",
    "snow_pile_variant_1",
    "snow_pile_variant_2",
    "wooden_fence_variant_1"
  ];

  // Spawn these in fixed rotation at regular intervals on Level 7.
  turkuFeatureDecorationKeys: string[] = [
    "turku_aurajoki_bridge"
  ];
  turkuDecorationSpawnCount: number = 0;
  turkuFeatureSpawnInterval: number = 4;
  
  // Night lighting decorations - lamp posts and lanterns for evening atmosphere
  nightLightingKeys: string[] = [
    "ski_trail_lamp_post",
    "glowing_trail_lantern_variant_1",
    "glowing_trail_lantern_variant_2",
    "glowing_trail_lantern_variant_3",
    "glowing_trail_lantern_variant_4",
    "glowing_trail_lantern_variant_5"
  ];
  
  // Night lighting group for glow effects
  nightLights!: Phaser.GameObjects.Group;
  lastLampSpawnX: number = 0;
  lampSpawnInterval: number = 400; // Spawn a lamp post every 400 pixels
  
  // Level landmark per level - one unique landmark per level on the track
  // NOTE: Level 4 (Lahti) uses Salpausselkä ski jumps in the background, no separate landmark
  levelLandmarks: { [level: number]: { key: string; name: string; height: number } } = {
    1: { key: "pine_sapling_variant_1", name: "Pieni kuusi", height: 100 },
    2: { key: "pine_sapling_variant_1", name: "Pieni kuusi", height: 100 },
    3: { key: "tapiola_buildings", name: "Tapiolan rakennukset", height: 180 },
    4: { key: "lahti_sign", name: "Lahden kaupunkikyltti", height: 120 },  // LAHTI landmark - Salpausselkä visible in background
    5: { key: "espoo_city_sign", name: "Espoon kaupunkikyltti", height: 130 },
    6: { key: "haukilahti_water_tower", name: "Haukilahden vesitorni", height: 220 },
    7: { key: "turku_cathedral_landmark", name: "Turun tuomiokirkko", height: 270 },
    8: { key: "wooden_fence_variant_1", name: "Puuaita", height: 80 },
    9: { key: "haukilahti_tower", name: "Haukilahden näkötorni", height: 240 }
  };
  
  // Lahti-specific decorations for Level 4 (Lahti 2001 doping scandal themed!)
  // NOTE: Landmarks are NOT included here - they spawn once via lahtiUniqueLandmarks system
  lahtiDecorationKeys: string[] = [
    "spruce_tree_variant_1",
    "spruce_tree_variant_2",
    "spruce_tree_variant_3",
    "snow_pile_variant_1",
    "snow_pile_variant_2",
    "pine_sapling_variant_1"
  ];
  
  // Lahti unique landmarks - each spawns ONCE at specific distance percentages
  // NOTE: Salpausselkä appears only ONCE (ski jump towers at 65%)
  lahtiUniqueLandmarks: { key: string; name: string; height: number; spawnAtPercent: number }[] = [
    { key: "lahti_sign", name: "Lahden kyltti", height: 120, spawnAtPercent: 0.15 },
    { key: "lahti_radio_mast", name: "Lahden radiomasto", height: 300, spawnAtPercent: 0.40 },
    { key: "salpausselka_ski_jumps", name: "Salpausselän mäkihyppytornit", height: 280, spawnAtPercent: 0.65 }
  ];
  
  // Track which Lahti landmarks have been spawned (reset per level)
  lahtiLandmarksSpawned: Set<string> = new Set();
  
  // Track landmark for this level
  levelLandmark?: Phaser.GameObjects.Image;
  level4BossTorviBackdrop?: Phaser.GameObjects.Image;
  landmarkSpawned: boolean = false;
  landmarkSpawnTimer?: Phaser.Time.TimerEvent;
  bossCameoSpawnTimer?: Phaser.Time.TimerEvent;
  
  // Track spawned enemy counts per type
  spawnedEnemyCounts: { [key: string]: number } = {};
  
  // Airtime tracking
  airtimeStart: number = 0;
  isInAir: boolean = false;
  currentAirtimeMultiplier: number = 1;
  airtimeBonusThreshold: number = 500; // ms in air before bonus starts
  lastAirtimeBonusSound: number = 0;
  hasStompedEnemy: boolean = false; // Ilmalento bonus only activates after first stomp
  
  // Stomp combo system - chain stomps without landing for multiplier!
  stompComboCount: number = 0;
  stompComboMultiplier: number = 1;
  maxStompComboMultiplier: number = 10;
  lastStompTime: number = 0;
  private stompHitsPerTargetThisAir: WeakMap<Phaser.GameObjects.GameObject, number> = new WeakMap();
  private readonly maxStompsPerSameTargetPerAir: number = 3;
  private bossStompReboundLockUntil: number = 0;
  
  // Session statistics for end-of-game summary
  sessionStats: {
    totalStomps: number;
    maxStompCombo: number;
    longestAirtime: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    powerUpsCollected: number;
    perfectLandings: number;
  } = {
    totalStomps: 0,
    maxStompCombo: 0,
    longestAirtime: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    powerUpsCollected: 0,
    perfectLandings: 0
  };
  private achievementAirtime3sUnlocked: boolean = false;
  private achievementScore100kUnlocked: boolean = false;
  private achievementStompCombo5Unlocked: boolean = false;
  
  // Performance optimization: frame counters for throttling expensive operations
  private frameCounter: number = 0;
  private lastParticleTime: number = 0;
  private lastDifficultyUpdateTime: number = 0;
  
  // Mobile device detection for performance optimization
  private isMobile: boolean = false;
  private lowEndDevice: boolean = false;
  
  // Low Power Mode detection (battery saver)
  private isLowPowerMode: boolean = false;
  
  // Adaptive quality system
  public qualityTier: "high" | "medium" | "low" = "high";
  private fpsEma: number = 60;
  private lastQualityCheckTime: number = 0;
  private particleBudgetMultiplier: number = 1;
  private spawnDelayMultiplier: number = 1;
  private enemyUpdateStride: number = 1;
  private maxFloatingTexts: number = 10;
  private optionalEffectsEnabled: boolean = true;
  private hardFpsEmergencyActive: boolean = false;
  private lowFpsSince: number = 0;
  private fpsRecoverySince: number = 0;
  private readonly hardFpsEmergencyThreshold: number = 32;
  private readonly hardFpsRecoveryThreshold: number = 38;
  private readonly hardFpsEmergencyHoldMs: number = 1200;
  private readonly hardFpsRecoveryHoldMs: number = 3500;
  
  // Enemy type tracking removed - enemies now speak for themselves with taunts!
  
  // Power-ups system
  powerUps!: Phaser.GameObjects.Group;
  powerUpSpawnTimer?: Phaser.Time.TimerEvent;
  
  // Hazards system
  hazards!: Phaser.GameObjects.Group;
  hazardSpawnTimer?: Phaser.Time.TimerEvent;
  private riskRouteSpawnedThisLevel: boolean = false;
  private lastRiskRouteAt: number = -99999;
  private activeRampLanding:
    | {
        startedAt: number;
        size: JumpRampSize;
        minMs: number;
        maxMs: number;
        bonusScore: number;
        requiredPeakPx: number;
        riskRoute: boolean;
      }
    | undefined;
  private rampJumpPeakHeight: number = 0;
  private rampGlobalCooldownUntil: number = 0;
  private rampVolttiBonusAvailable: boolean = false;
  
  // Chihuahuas (special enemy with dragging leash tripwire)
  chihuahuas!: Phaser.GameObjects.Group;
  
  // Weather system - Multiple weather types
  currentWeather: "clear" | "snowstorm" | "sleet" | "blizzard" | "blackice" | "sunglare" | "arcticfreeze" | "acidrain" = "clear";
  isSnowstorm: boolean = false; // Legacy support for UI
  weatherOverlay?: Phaser.GameObjects.Rectangle;
  snowstormOverlay?: Phaser.GameObjects.TileSprite;
  windHowlSound?: Phaser.Sound.BaseSound;
  weatherChangeTimer?: Phaser.Time.TimerEvent;
  weatherEndTimer?: Phaser.Time.TimerEvent;
  weatherSpeedMultiplier: number = 1.0; // Affects player/enemy speed
  weatherEnergyDrain: number = 0; // Extra energy drain per second
  sunGlareFlashTimer?: Phaser.Time.TimerEvent;
  iceParticles?: Phaser.GameObjects.Group;
  frostOverlay?: Phaser.GameObjects.Graphics;
  
  // Ambient snowfall - scales with level (light in level 1, heavy in level 10)
  snowflakes: Phaser.GameObjects.Group | null = null;
  ambientSnowSpawnTimer?: Phaser.Time.TimerEvent;
  ambientAcidSpawnTimer?: Phaser.Time.TimerEvent;
  ambientAcidSplashTimer?: Phaser.Time.TimerEvent;
  ambientRainSpawnTimer?: Phaser.Time.TimerEvent;
  sleetSpawnTimer?: Phaser.Time.TimerEvent;
  
  // Ghost/rival system
  ghostData: { x: number; y: number; time: number }[] = [];
  ghostSprite?: Phaser.GameObjects.Sprite;
  isRecordingGhost: boolean = true;
  ghostRecordInterval: number = 100; // Record position every 100ms
  lastGhostRecordTime: number = 0;
  
  // ========== ESPOO DOUCHE COMEDY SYSTEM ==========
  // Random hilarious Espoo-themed events and quotes
  lastDoucheEventTime: number = 0;
  doucheEventCooldown: number = 8000; // 8 seconds between events
  espooQuotes: string[] = [
    '"Lapseni ovat ranskalaisessa koulussa, sagre blöe!"',
    '"Hiihto on talviurheilun Burberry"',
    '"Padel on identiteettini terävin kulmakivi"',
    '"LÄRKAN-HANKEN-HANDELSBANKEN!"',
    '"Helly Hanssen, Sebago skor-jättebra!"',
    '"Hullut Päivät börjar imorgon!"',
    '"Mikä idea asua kerrostalossa Westendissä, barbariskt!"',
    '"Täällähän on täyttä tänään!"',
    '"Onks täällä gluteenitonta sushia?"',
    '"Pitäis ladata Tesla, bode ladda Teslan"'
  ];
  
  // LAHTI Level 4 exclusive quotes
  lahtiQuotes: string[] = [
    '"Varusteet hukassa, mutta meno jatkuu!"',
    '"Lääkäri käski levätä!"',
    '"Tää on salaliitto latua vastaan!"',
    '"Salppuri silpuks!"',
    '"Kaikki on tänään liikkeellä..."',
    '"Torvi on auki! Juomaan!"',
    '"Salpausselän kisat alkaa! Sauvat teroitukseen! Sauvat teroitukseen!"',
    '"Aikataulu karkaa käsistä!"',
    '"Salaiset eväät taskussa..."',
    '"Lahden stadionilla mennyt monta kuppia!"',
    '"Radiomasto näkyy!"',
    '"Täällä on aina huhuja..."',
    '"Mun ystävän kaveri on täällä taas!"',
    '" Torveen keikalle, siel saa kiljua!"'
  ];
  
  // Track active floating text displays
  activeFloatingTexts: Phaser.GameObjects.Text[] = [];
  private readonly floatingTextChance: number = 0.25; // Extra sparse chatter for readability and compliance.
  private floatingTextPool: Phaser.GameObjects.Text[] = [];
  private stompTextPool: Phaser.GameObjects.Text[] = [];
  private damageTextPool: Phaser.GameObjects.Text[] = [];
  private enemyTauntTargetCount: number = 15;
  private enemyTauntShownCount: number = 0;
  private enemyTauntBudget: number = 2.25;
  private enemyTauntDistancePerLine: number = 100;
  private enemyTauntLastEmitAt: number = -99999;
  private readonly enemyTauntMinIntervalMs: number = 420;
  private lastPlayerShoutAt: number = -99999;
  private readonly playerShoutCooldownMs: number = 2200;
  private dramaticSlowMoTimeoutId?: number;
  private dramaticSlowMoEndsAt: number = 0;
  private dramaticCameraTween?: Phaser.Tweens.Tween;
  private dramaticCameraReturnTimer?: Phaser.Time.TimerEvent;
  private safeCameraPresetTween?: Phaser.Tweens.Tween;
  private safeCameraPresetResetTimer?: Phaser.Time.TimerEvent;
  private lastSafeCameraPresetAt: number = -99999;
  private bossTelegraph?: Phaser.GameObjects.Rectangle;
  private bossTelegraphLabel?: Phaser.GameObjects.Text;
  private bossTelegraphTween?: Phaser.Tweens.Tween;
  private bossTelegraphClearTimer?: Phaser.Time.TimerEvent;
  private cinematicColorOverlay?: Phaser.GameObjects.Rectangle;
  private cinematicStrobeOverlay?: Phaser.GameObjects.Rectangle;
  private cinematicTopGradient?: Phaser.GameObjects.Rectangle;
  private cinematicBottomGradient?: Phaser.GameObjects.Rectangle;
  private cinematicParallaxBands: CinematicParallaxBand[] = [];
  private cinematicDustMotes: CinematicDustMote[] = [];
  private bossRiskRewardOrb?: Phaser.GameObjects.Arc;
  private readonly bossRiskRewardEnabled: boolean = false;
  private startAtBossFightOnCreate: boolean = false;
  private bossRetryDeathsThisLevel: number = 0;
  private nextBossRiskRewardSpawnAt: number = 0;
  private bossRiskBuffUntil: number = 0;
  private bossRiskDamageMultiplier: number = 1;
  private bossRiskOrbCollectedCount: number = 0;
  private lastBossTelegraphInfo: { kind: string; attackName?: string; at: number } = {
    kind: "normal",
    attackName: undefined,
    at: -99999
  };
  private bossCombatTelemetry: Array<{
    level: number;
    bossType: string;
    outcome: "player_death" | "boss_defeated";
    phase?: number;
    attackName?: string;
    attackKind?: string;
    timestamp: string;
  }> = [];
  private lastBossFinisherFxAt: number = -99999;
  private lastRageDramaticFxAt: number = -99999;
  private bossDeathSequenceActive: boolean = false;
  private bossDeathFinalizeTimer?: Phaser.Time.TimerEvent;
  private peterKanniRescueTriggered: boolean = false;
  private effectCirclePool: Phaser.GameObjects.Arc[] = [];
  private weatherParticlePool: Array<
    (Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle) & {
      __weatherKind?: "snow" | "acid" | "rain";
      fallSpeed?: number;
      drift?: number;
      wobble?: number;
      isAcidDrop?: boolean;
      isRainDrop?: boolean;
    }
  > = [];

  // Humor pack systems
  pullaComboCount: number = 0;
  rageActivationTimes: number[] = [];
  lastRageReadyAt: number = 0;
  wasRageReady: boolean = false;
  volttiFailCount: number = 0;
  lastFailedJumpSfxAt: number = 0;
  humorSpeedModifier: number = 1.0;
  humorSpeedModifierUntil: number = 0;
  commentatorTimer?: Phaser.Time.TimerEvent;
  humorMiniEventTimer?: Phaser.Time.TimerEvent;
  doucheEventTimer?: Phaser.Time.TimerEvent;
  discoOverlayPulseTimer?: Phaser.Time.TimerEvent;
  discoSparkleTimers: Phaser.Time.TimerEvent[] = [];
  achievementNoSwearShown: boolean = false;
  achievementVolttiFailShown: boolean = false;
  achievementInstantRageShown: boolean = false;
  lowPowerWarned: boolean = false;
  lowHealthWarned: boolean = false;
  lastStatusLineAt: number = 0;
  
  // ========== DYNAMIC DIFFICULTY SYSTEM ==========
  // Adjusts spawn rates and enemy count based on player performance
  dynamicDifficulty: {
    performanceScore: number;        // 0-100, higher = player doing well
    consecutiveDeaths: number;       // Deaths since last level completion
    recentDamageTaken: number;       // Damage taken in last 30 seconds
    recentKills: number;             // Kills in last 30 seconds
    difficultyMultiplier: number;    // 0.5-1.5, affects spawn rate
    lastAdjustmentTime: number;      // Last time difficulty was adjusted
  } = {
    performanceScore: 50,
    consecutiveDeaths: 0,
    recentDamageTaken: 0,
    recentKills: 0,
    difficultyMultiplier: 1.0,
    lastAdjustmentTime: 0
  };

  // Lightweight run systems: combo meter, mastery, and micro objectives.
  public currentStyleRank: StyleRank = "D";
  public styleRankScore: number = 0;
  public styleRankPeak: StyleRank = "D";
  public microObjectiveHudText: string = "";
  public microObjectiveHudProgress: string = "";
  public routeLabel: string = "Peruslinja";
  public passiveLabel: string = "Ei passiivia";

  private awaitingLoadoutSelection: boolean = false;
  private loadoutAutoPickTimer?: Phaser.Time.TimerEvent;
  private selectedRouteId: RouteChoiceId = "safe_lane";
  private selectedPassiveId: PassiveChoiceId = "battery_saver";
  private routeEnemyPressure: number = 1;
  private routeHazardPressure: number = 1;
  private routePowerupPressure: number = 1;
  private routeScoreMultiplier: number = 1;
  private passiveIncomingDamageMultiplier: number = 1;
  private passivePowerupScoreBonus: number = 0;
  private activeRunModifiers: RunModifierId[] = [];
  private runEnemySpawnMultiplier: number = 1;
  private runEnemyDamageTakenMultiplier: number = 1;
  private runEnemyDamageDealtMultiplier: number = 1;
  private runScoreMultiplier: number = 1;
  private runPlayerSpeedMultiplier: number = 1;
  private runEliteChanceBonus: number = 0;

  private rhythmWaveTimer?: Phaser.Time.TimerEvent;
  private weatherPulseTimer?: Phaser.Time.TimerEvent;
  private levelEventMoments: LevelEventMoment[] = [];
  private recentEnemyDefeatTimes: number[] = [];
  private minibossAmbushesTriggered: number = 0;
  private lastCombatDynamicsAt: number = -99999;

  private dynamicWeatherSpeedMultiplier: number = 1;
  private dynamicWeatherEnergyDrainBonus: number = 0;
  private dynamicWeatherAggroMultiplier: number = 1;
  private dynamicWeatherPulseEndsAt: number = 0;

  private styleLastDecayAt: number = 0;
  private readonly styleDecayIntervalMs: number = 900;
  private readonly styleDecayPerTick: number = 2;
  private readonly styleThresholds: Record<StyleRank, number> = {
    D: 0,
    C: 24,
    B: 52,
    A: 90,
    S: 132
  };

  private weaponMastery: Record<WeaponMasteryKey, WeaponMasteryState> = {
    pole: { xp: 0, level: 0, buffUntil: 0 },
    axe: { xp: 0, level: 0, buffUntil: 0 },
    voltti: { xp: 0, level: 0, buffUntil: 0 }
  };

  private activeMicroObjective?: MicroObjectiveState;
  private microObjectiveCompleted: boolean = false;
  private objectiveKillsAtStart: number = 0;
  private objectiveTricksCompleted: number = 0;
  private objectiveNoHitBroken: boolean = false;
  private objectiveBonusTotal: number = 0;

  private cursedPowerupUntil: number = 0;
  private cursedEnergyDrainPerSec: number = 0;
  private cursedIncomingDamageMultiplier: number = 1;

  private levelStartTimeMs: number = 0;
  private levelDamageTaken: number = 0;
  private levelEnemiesAtStart: number = 0;
  private lastLevelGradeResult: LevelGradeResult = {
    grade: "D",
    bonusScore: 0,
    score: 0,
  };
  
  // ========== DIFFICULTY SETTING (Espoo/Vantaa/Lahti) ==========
  // Player-selected difficulty multiplier
  difficultyMultiplier: number = 1.0; // espoo=0.7, vantaa=1.0, lahti=1.0 (longer tracks only)

  // Player max health by selected difficulty.
  // Espoo: +100%, Vantaa: +50%, Lahti: baseline.
  getPlayerHealthMultiplier(difficulty: string): number {
    switch (difficulty) {
      case "espoo": return 2.0;
      case "vantaa": return 1.5;
      case "lahti": return 1.5;
      default: return 1.0;
    }
  }
  
  // Get difficulty multiplier based on difficulty name
  getDifficultyMultiplier(difficulty: string): number {
    switch (difficulty) {
      case 'espoo': return 0.7;  // Easy
      case 'lahti': return 1.0;  // Same combat difficulty as Vantaa, but with longer tracks
      case 'vantaa':
      default: return 1.0;       // Medium (default)
    }
  }

  private getSelectedDifficultyTier(): "espoo" | "vantaa" | "lahti" {
    return normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private getRouteChoices(): RouteChoice[] {
    return [
      {
        id: "safe_lane",
        label: "Turvalinja",
        description: "Vähemmän uhkaa, tasainen eteneminen."
      },
      {
        id: "chaos_lane",
        label: "Kaaoslinja",
        description: "Enemmän painetta, isompi pistekerroin."
      },
      {
        id: "precision_lane",
        label: "Tarkkuuslinja",
        description: "Neutraali paine, tarkasta suorituksesta lisäpisteitä."
      }
    ];
  }

  private getPassivePool(): PassiveChoice[] {
    return [
      {
        id: "thick_skin",
        label: "Rautanahka",
        description: "Saat hieman vähemmän vahinkoa."
      },
      {
        id: "battery_saver",
        label: "Akunhallinta",
        description: "Energia palautuu nopeammin."
      },
      {
        id: "combo_rush",
        label: "Combo Rush",
        description: "Comboikkuna on pidempi."
      },
      {
        id: "stomp_engine",
        label: "Stomp Engine",
        description: "Stompit antavat enemmän energiaa."
      },
      {
        id: "lucky_star",
        label: "Onnen Tähti",
        description: "Powerupeista enemmän pisteitä."
      }
    ];
  }

  private pickPassiveChoicesForLevel(level: number): PassiveChoice[] {
    const pool = [...this.getPassivePool()];
    const seed = this.hashSeed(`${new Date().toISOString().slice(0, 10)}:passive:${level}`);
    const picks: PassiveChoice[] = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = (seed + i * 3) % pool.length;
      picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  }

  private resetAdvancedRunSystems(): void {
    this.currentStyleRank = "D";
    this.styleRankScore = 0;
    this.styleRankPeak = "D";
    this.styleLastDecayAt = 0;
    this.levelStartTimeMs = 0;
    this.levelDamageTaken = 0;
    this.levelEnemiesAtStart = this.enemiesDefeated;
    this.objectiveBonusTotal = 0;
    this.activeMicroObjective = undefined;
    this.microObjectiveCompleted = false;
    this.objectiveKillsAtStart = this.enemiesDefeated;
    this.objectiveTricksCompleted = 0;
    this.objectiveNoHitBroken = false;
    this.microObjectiveHudText = "";
    this.microObjectiveHudProgress = "";
    this.weaponMastery = {
      pole: { xp: 0, level: 0, buffUntil: 0 },
      axe: { xp: 0, level: 0, buffUntil: 0 },
      voltti: { xp: 0, level: 0, buffUntil: 0 }
    };
    this.cursedPowerupUntil = 0;
    this.cursedEnergyDrainPerSec = 0;
    this.cursedIncomingDamageMultiplier = 1;
    this.passiveIncomingDamageMultiplier = 1;
    this.passivePowerupScoreBonus = 0;
    this.routeEnemyPressure = 1;
    this.routeHazardPressure = 1;
    this.routePowerupPressure = 1;
    this.routeScoreMultiplier = 1;
    this.activeRunModifiers = [];
    this.runEnemySpawnMultiplier = 1;
    this.runEnemyDamageTakenMultiplier = 1;
    this.runEnemyDamageDealtMultiplier = 1;
    this.runScoreMultiplier = 1;
    this.runPlayerSpeedMultiplier = 1;
    this.runEliteChanceBonus = 0;
    this.resetBossCombatDirector();
    this.routeLabel = "Peruslinja";
    this.passiveLabel = "Ei passiivia";
    this.selectedRouteId = "safe_lane";
    this.selectedPassiveId = "battery_saver";
    this.levelEventMoments = [];
    this.recentEnemyDefeatTimes = [];
    this.minibossAmbushesTriggered = 0;
    this.lastCombatDynamicsAt = -99999;
    this.dynamicWeatherSpeedMultiplier = 1;
    this.dynamicWeatherEnergyDrainBonus = 0;
    this.dynamicWeatherAggroMultiplier = 1;
    this.dynamicWeatherPulseEndsAt = 0;
  }

  private requestPreRunLoadoutSelection(): void {
    if (!this.player || this.player.isDead || this.levelCompleted) return;
    this.applyDefaultRunSetup();
  }

  private applyDefaultRunSetup(): void {
    if (!this.player || this.player.isDead || this.levelCompleted) return;
    if (this.levelStartTimeMs > 0) return;

    // Pre-level passive/route choice UI removed: run starts with neutral baseline.
    this.awaitingLoadoutSelection = false;
    this.selectedRouteId = "safe_lane";
    this.selectedPassiveId = "battery_saver";
    this.routeEnemyPressure = 1;
    this.routeHazardPressure = 1;
    this.routePowerupPressure = 1;
    this.routeScoreMultiplier = 1;
    this.passiveIncomingDamageMultiplier = 1;
    this.passivePowerupScoreBonus = 0;
    this.routeLabel = "Peruslinja";
    this.passiveLabel = "Ei passiivia";
    this.player.comboTimeWindow = 4000;
    this.levelStartTimeMs = this.time.now;

    this.setupMicroObjective();
    this.events.emit("preRunLoadoutResolved", {
      routeLabel: this.routeLabel,
      passiveLabel: this.passiveLabel,
      automatic: true
    });
  }

  private resolvePreRunLoadoutSelection(data: { routeId?: RouteChoiceId; passiveId?: PassiveChoiceId; automatic?: boolean }): void {
    if (!this.awaitingLoadoutSelection) return;

    const routeId = data.routeId || "safe_lane";
    const passiveId = data.passiveId || "battery_saver";
    const automatic = !!data.automatic;

    this.selectedRouteId = routeId;
    this.selectedPassiveId = passiveId;
    this.levelStartTimeMs = this.time.now;

    if (routeId === "safe_lane") {
      this.routeEnemyPressure = 0.9;
      this.routeHazardPressure = 0.88;
      this.routePowerupPressure = 1.1;
      this.routeScoreMultiplier = 0.97;
      this.routeLabel = "Turvalinja";
    } else if (routeId === "chaos_lane") {
      this.routeEnemyPressure = 1.15;
      this.routeHazardPressure = 1.12;
      this.routePowerupPressure = 1.04;
      this.routeScoreMultiplier = 1.17;
      this.routeLabel = "Kaaoslinja";
    } else {
      this.routeEnemyPressure = 1.02;
      this.routeHazardPressure = 0.98;
      this.routePowerupPressure = 0.96;
      this.routeScoreMultiplier = 1.11;
      this.routeLabel = "Tarkkuuslinja";
    }

    // Reset before applying chosen passive.
    this.passiveIncomingDamageMultiplier = 1;
    this.passivePowerupScoreBonus = 0;
    this.player.comboTimeWindow = 4000;

    if (passiveId === "thick_skin") {
      this.passiveIncomingDamageMultiplier = 0.9;
      this.passiveLabel = "Rautanahka";
    } else if (passiveId === "battery_saver") {
      this.player.energyRegenRate *= 1.18;
      this.passiveLabel = "Akunhallinta";
    } else if (passiveId === "combo_rush") {
      this.player.comboTimeWindow += 640;
      this.passiveLabel = "Combo Rush";
    } else if (passiveId === "stomp_engine") {
      this.player.stompEnergyRecovery += 1;
      this.player.stompDamage += 4;
      this.passiveLabel = "Stomp Engine";
    } else {
      this.passivePowerupScoreBonus = 35;
      this.passiveLabel = "Onnen Tähti";
    }

    this.awaitingLoadoutSelection = false;
    if (this.loadoutAutoPickTimer) {
      this.loadoutAutoPickTimer.destroy();
      this.loadoutAutoPickTimer = undefined;
    }

    this.setupMicroObjective();
    this.events.emit("preRunLoadoutResolved", {
      routeLabel: this.routeLabel,
      passiveLabel: this.passiveLabel,
      automatic
    });
    this.events.emit("floatingAnnouncement", {
      text: `${this.routeLabel} + ${this.passiveLabel}`,
      duration: 2300
    });
  }

  private setupMicroObjective(): void {
    const templates: Array<Omit<MicroObjectiveState, "startedAt" | "completed" | "failed" | "progress">> = [
      {
        kind: "no_hit",
        title: "Puhdas suoritus",
        description: "Selviä 20s ilman osumaa.",
        target: 20,
        rewardScore: 240,
        rewardEnergy: 15,
        timeLimitMs: 21000
      },
      {
        kind: "kill_count",
        title: "Siivousvuoro",
        description: "Kaada 8 vihua 28s aikana.",
        target: 8,
        rewardScore: 300,
        rewardEnergy: 12,
        timeLimitMs: 28000
      },
      {
        kind: "combo_peak",
        title: "Ketjutaidot",
        description: "Nosta combo x5:een.",
        target: 5,
        rewardScore: 280,
        rewardEnergy: 14,
        timeLimitMs: 24000
      },
      {
        kind: "trick_count",
        title: "Tyylinäyte",
        description: "Tee 2 volttia ilman failia.",
        target: 2,
        rewardScore: 300,
        rewardEnergy: 16,
        timeLimitMs: 34000
      }
    ];

    const index = (this.hashSeed(`${this.currentLevel}:${this.selectedRouteId}:${Date.now()}`) + this.currentLevel) % templates.length;
    const template = templates[index];
    this.activeMicroObjective = {
      ...template,
      progress: 0,
      startedAt: this.time.now,
      completed: false,
      failed: false
    };
    this.objectiveKillsAtStart = this.enemiesDefeated;
    this.objectiveTricksCompleted = 0;
    this.objectiveNoHitBroken = false;
    this.refreshMicroObjectiveHud();
    this.emitGameplayTelegraph(`MINITAVOITE: ${template.description}`, "orange", "🎯", 2500);
  }

  private refreshMicroObjectiveHud(): void {
    if (!this.activeMicroObjective) {
      this.microObjectiveHudText = "";
      this.microObjectiveHudProgress = "";
      return;
    }

    if (this.activeMicroObjective.completed) {
      this.microObjectiveHudText = "";
      this.microObjectiveHudProgress = "";
      return;
    }

    if (this.activeMicroObjective.failed) {
      this.microObjectiveHudText = "";
      this.microObjectiveHudProgress = "";
      return;
    }

    this.microObjectiveHudText = this.activeMicroObjective.description;
    const pct = Math.floor(Phaser.Math.Clamp((this.activeMicroObjective.progress / Math.max(1, this.activeMicroObjective.target)) * 100, 0, 100));
    this.microObjectiveHudProgress = `${pct}%`;
  }

  private completeMicroObjective(): void {
    if (!this.activeMicroObjective || this.activeMicroObjective.completed || this.activeMicroObjective.failed) return;
    this.activeMicroObjective.completed = true;

    const baseReward = this.activeMicroObjective.rewardScore;
    const reward = Math.max(
      60,
      Math.round(baseReward * this.routeScoreMultiplier)
    );
    this.objectiveBonusTotal += reward;
    this.player.addScore(reward, this.time.now);
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + this.activeMicroObjective.rewardEnergy);
    this.microObjectiveCompleted = true;
    this.addStylePoints(18);
    this.refreshMicroObjectiveHud();
    this.events.emit("floatingAnnouncement", {
      text: `MINITAVOITE VALMIS! +${reward} PISTETTÄ`,
      duration: 2200
    });
  }

  private failMicroObjective(): void {
    if (!this.activeMicroObjective || this.activeMicroObjective.completed || this.activeMicroObjective.failed) return;
    this.activeMicroObjective.failed = true;
    this.addStylePoints(-6);
    this.refreshMicroObjectiveHud();
  }

  private updateMicroObjective(time: number): void {
    if (!this.activeMicroObjective || this.activeMicroObjective.completed || this.activeMicroObjective.failed) return;
    const objective = this.activeMicroObjective;

    if (objective.kind === "no_hit") {
      if (this.objectiveNoHitBroken) {
        this.failMicroObjective();
        return;
      }
      const elapsedSec = Math.max(0, (time - objective.startedAt) / 1000);
      objective.progress = Math.min(objective.target, elapsedSec);
      if (elapsedSec >= objective.target) {
        this.completeMicroObjective();
        return;
      }
    } else if (objective.kind === "kill_count") {
      objective.progress = Math.max(0, this.enemiesDefeated - this.objectiveKillsAtStart);
      if (objective.progress >= objective.target) {
        this.completeMicroObjective();
        return;
      }
    } else if (objective.kind === "combo_peak") {
      objective.progress = Math.max(objective.progress, this.player.comboCount);
      if (objective.progress >= objective.target) {
        this.completeMicroObjective();
        return;
      }
    } else if (objective.kind === "trick_count") {
      objective.progress = this.objectiveTricksCompleted;
      if (objective.progress >= objective.target) {
        this.completeMicroObjective();
        return;
      }
    }

    if (time - objective.startedAt > objective.timeLimitMs) {
      this.failMicroObjective();
      return;
    }

    this.refreshMicroObjectiveHud();
  }

  private resolveStyleRank(score: number): StyleRank {
    if (score >= this.styleThresholds.S) return "S";
    if (score >= this.styleThresholds.A) return "A";
    if (score >= this.styleThresholds.B) return "B";
    if (score >= this.styleThresholds.C) return "C";
    return "D";
  }

  private styleRankValue(rank: StyleRank): number {
    if (rank === "S") return 5;
    if (rank === "A") return 4;
    if (rank === "B") return 3;
    if (rank === "C") return 2;
    return 1;
  }

  private addStylePoints(points: number): void {
    // Style evaluation is disabled.
    void points;
    this.currentStyleRank = "D";
    this.styleRankScore = 0;
    this.styleRankPeak = "D";
  }

  private applyStyleDecay(time: number): void {
    // Style evaluation is disabled.
    void time;
  }

  private mapAttackTypeToMastery(attackType: string): WeaponMasteryKey | null {
    if (attackType === "pole" || attackType === "superPole") return "pole";
    if (attackType === "axe" || attackType === "dashAxe" || attackType === "superDashAxe") return "axe";
    if (attackType === "voltti" || attackType === "tornadoVoltti" || attackType === "jump" || attackType === "spinKick") return "voltti";
    return null;
  }

  private updateWeaponMasteryFromAttack(attackType: string): void {
    const key = this.mapAttackTypeToMastery(attackType);
    if (!key) return;
    const state = this.weaponMastery[key];
    const xpGain = attackType.startsWith("super") ? 3 : 1;
    state.xp += xpGain;
    const threshold = 7 + state.level * 4;
    if (state.xp < threshold) return;

    state.xp = 0;
    state.level = Math.min(3, state.level + 1);
    state.buffUntil = this.time.now + 8500;
    const masteryName = key === "axe" ? "KIRVES" : key === "pole" ? "SAUVA" : "VOLTTI";
    this.events.emit("floatingAnnouncement", {
      text: `${masteryName}-MASTERY ${state.level}: +VAHINKO`,
      duration: 1700
    });
    this.addStylePoints(7);
  }

  private getWeaponMasteryDamageMultiplier(key: WeaponMasteryKey): number {
    const state = this.weaponMastery[key];
    if (!state) return 1;
    if (state.level <= 0) return 1;
    if (this.time.now > state.buffUntil) return 1;
    return 1 + state.level * 0.1;
  }

  private resetBossCombatDirector(): void {
    this.bossCounterWindowUntil = 0;
    this.bossCounterWindowKind = null;
    this.bossCounterSuggestedAttack = null;
    this.bossAttackChainKind = null;
    this.bossAttackChainCount = 0;
    this.bossAttackChainLastAt = -99999;
    this.lastBossCombatHintAt = -99999;
    this.lastBossPoleRewardAt = -99999;
    this.lastBossPoleHealAt = -99999;
  }

  private getBossCounterForTelegraph(kind: string): WeaponMasteryKey | null {
    switch (kind) {
      case "charge":
      case "leap":
      case "aoe":
      case "hazard":
        return "voltti";
      case "combo":
      case "barrage":
      case "super":
      case "phase":
      case "normal":
        return "axe";
      default:
        return null;
    }
  }

  private getBossTelegraphCounterDuration(kind: string): number {
    switch (kind) {
      case "super":
      case "aoe":
      case "phase":
        return 1250;
      case "charge":
      case "combo":
      case "leap":
      case "barrage":
      case "hazard":
        return 950;
      default:
        return 620;
    }
  }

  private openBossCounterWindow(
    kind: BossCounterWindowKind,
    durationMs: number,
    suggestedAttack: WeaponMasteryKey | null,
    announcement?: string
  ): void {
    const now = this.time.now;
    this.bossCounterWindowUntil = Math.max(this.bossCounterWindowUntil, now + Math.max(0, durationMs));
    this.bossCounterWindowKind = kind;
    this.bossCounterSuggestedAttack = suggestedAttack;

    if (announcement && now - this.lastBossCombatHintAt >= 650) {
      this.lastBossCombatHintAt = now;
      this.events.emit("floatingAnnouncement", {
        text: announcement,
        duration: 1050
      });
    }
  }

  private registerBossTelegraphCounter(kind: string): void {
    const suggestedAttack = this.getBossCounterForTelegraph(kind);
    if (!suggestedAttack) return;

    this.openBossCounterWindow(
      "telegraph",
      this.getBossTelegraphCounterDuration(kind),
      suggestedAttack
    );
  }

  private getBossRepeatPenalty(attackKind: BossPlayerAttackKind, now: number, isCounterHit: boolean, isSuggestedCounter: boolean): number {
    if (attackKind === "stomp") {
      this.bossAttackChainKind = attackKind;
      this.bossAttackChainCount = 1;
      this.bossAttackChainLastAt = now;
      return 1;
    }

    const chainWindowMs = 2300;
    const repeatsSameAttack =
      this.bossAttackChainKind === attackKind &&
      now - this.bossAttackChainLastAt <= chainWindowMs;

    this.bossAttackChainKind = attackKind;
    this.bossAttackChainCount = repeatsSameAttack ? this.bossAttackChainCount + 1 : 1;
    this.bossAttackChainLastAt = now;

    const repeatIndex = Math.max(0, this.bossAttackChainCount - 1);
    const polePenalty = [1, 0.62, 0.38, 0.24];
    const axePenalty = [1, 0.82, 0.68, 0.55];
    const volttiPenalty = [1, 0.78, 0.55, 0.4];
    const table = attackKind === "pole" ? polePenalty : attackKind === "axe" ? axePenalty : volttiPenalty;
    let penalty = table[Math.min(repeatIndex, table.length - 1)];

    if (isCounterHit) {
      penalty = Math.max(penalty, isSuggestedCounter ? 0.78 : 0.62);
    }

    return penalty;
  }

  private showBossCombatHint(text: string, x: number, y: number, color: number = 0xfff176, cooldownMs: number = 950): void {
    const now = this.time.now;
    if (now - this.lastBossCombatHintAt < cooldownMs) return;
    this.lastBossCombatHintAt = now;
    this.showFloatingText(x, y, text, color, 1100, { force: true });
  }

  private resolveBossCombatDamage(
    boss: any,
    baseDamage: number,
    attackKind: BossPlayerAttackKind,
    options: {
      isBasicPoleStrike?: boolean;
      isSuperPoleFrenzy?: boolean;
      isShieldContact?: boolean;
    } = {}
  ): BossCombatDamageResult {
    const now = this.time.now;
    const isCounterHit = now <= this.bossCounterWindowUntil;
    const suggestedAttack = this.bossCounterSuggestedAttack;
    const isSuggestedCounter = isCounterHit && suggestedAttack === attackKind;
    const bossIsInterruptible = now <= Math.max(0, Number(boss?.interruptWindowUntil || 0));

    let multiplier = 1;

    if (attackKind === "pole") {
      if (options.isBasicPoleStrike) {
        multiplier *= 0.48;
      } else if (options.isSuperPoleFrenzy) {
        multiplier *= 0.58;
      } else if (options.isShieldContact) {
        multiplier *= 0.35;
      } else {
        multiplier *= 0.7;
      }

      if (boss?.isEnraged) {
        multiplier *= 0.72;
      }
    }

    if (isCounterHit) {
      if (isSuggestedCounter) {
        multiplier *= attackKind === "axe" ? 1.75 : attackKind === "voltti" ? 1.55 : 1.15;
      } else if (attackKind === "axe") {
        multiplier *= 1.32;
      } else if (attackKind === "voltti") {
        multiplier *= 1.24;
      } else if (attackKind === "pole") {
        multiplier *= 1.08;
      }
    }

    if (bossIsInterruptible && attackKind === "axe") {
      multiplier *= 1.65;
      this.openBossCounterWindow("stagger", 1100, null, "KESKEYTYS! BOSSI AUKI!");
    } else if (isSuggestedCounter) {
      const label = attackKind === "axe" ? "KIRVES OSUI IKKUNAAN!" : attackKind === "voltti" ? "VOLTTI OSUI IKKUNAAN!" : "AVOIN!";
      this.openBossCounterWindow("stagger", 850, null, label);
    }

    const repeatPenalty = this.getBossRepeatPenalty(attackKind, now, isCounterHit, isSuggestedCounter || bossIsInterruptible);
    multiplier *= repeatPenalty;

    const damage = Math.max(1, Math.round(baseDamage * multiplier));
    const hintX = Number(boss?.x) || this.scale.width * 0.72;
    const hintY = (Number(boss?.y) || this.groundY) - 112;

    if (attackKind === "pole" && repeatPenalty <= 0.38) {
      this.showBossCombatHint("SAUVA EI PURE - VAIHDA!", hintX, hintY, 0xffd166, 1250);
    } else if (attackKind === "pole" && boss?.isEnraged) {
      this.showBossCombatHint("RAIVOVAIHE - KIRVES/VOLTTI!", hintX, hintY, 0xffd166, 1250);
    } else if (repeatPenalty <= 0.55) {
      this.showBossCombatHint("VAIHDA TAKTIIKKAA!", hintX, hintY, 0xffd166, 1250);
    } else if (isCounterHit && !isSuggestedCounter && suggestedAttack) {
      const suggestion = suggestedAttack === "axe" ? "KIRVES NYT!" : "VOLTTI NYT!";
      this.showBossCombatHint(suggestion, hintX, hintY, 0x90caf9, 1000);
    } else if (isSuggestedCounter || bossIsInterruptible) {
      this.showBossCombatHint("AVOIN!", hintX, hintY, 0xa5d6a7, 850);
    }

    return {
      damage,
      multiplier,
      repeatPenalty,
      isCounterHit,
      isSuggestedCounter: isSuggestedCounter || bossIsInterruptible
    };
  }

  private grantPoleHitEnergy(isBossTarget: boolean): void {
    if (!this.player || this.player.isDead) return;
    if (isBossTarget) {
      const now = this.time.now;
      if (now - this.lastBossPoleRewardAt < 2200) return;
      this.lastBossPoleRewardAt = now;
    }
    const masteryState = this.weaponMastery.pole;
    const masteryBonus = masteryState.level > 0 && this.time.now <= masteryState.buffUntil
      ? masteryState.level * 0.25
      : 0;
    // Keep pole strike stamina behavior consistent: hit-confirm can refund a little,
    // but never enough to cancel the base stamina cost.
    const energyGain = (isBossTarget ? 2.2 : 1.6) + masteryBonus;
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + energyGain);
  }

  private markPowerUpAsCursed(powerUp: any): void {
    if (!powerUp || powerUp.isCollected) return;
    powerUp.__cursedPowerUp = true;
    powerUp.setTint?.(0xb23cff);
    powerUp.setAlpha?.(0.92);
  }

  private isPowerUpCursed(powerUp: any): boolean {
    return !!powerUp?.__cursedPowerUp;
  }

  private applyCursedPowerupEffect(): void {
    this.cursedPowerupUntil = Math.max(this.cursedPowerupUntil, this.time.now + 8500);
    this.cursedEnergyDrainPerSec = 9;
    this.cursedIncomingDamageMultiplier = 1.18;
    const cursedScore = Math.round(150 * this.routeScoreMultiplier);
    this.player.score += cursedScore;
    this.events.emit("powerUpCollected", {
      type: "cursed",
      name: "KIROTTU PICKUP",
      description: "+PISTEET, ENERGIA VUOTAA 8.5s",
      icon: "☠️",
      duration: 8500,
      endTime: this.time.now + 8500,
      color: "purple"
    });
    this.emitGameplayTelegraph("KIROUS AKTIIVINEN: ENERGIA VUOTAA!", "red", "☠️", 2300);
    this.addStylePoints(5);
  }

  private updateCursedPowerupState(time: number, delta: number): void {
    if (time < this.cursedPowerupUntil) {
      if (this.cursedEnergyDrainPerSec > 0) {
        const drain = this.cursedEnergyDrainPerSec * delta / 1000;
        this.player.energy = Math.max(0, this.player.energy - drain);
      }
      return;
    }
    if (this.cursedIncomingDamageMultiplier !== 1 || this.cursedEnergyDrainPerSec !== 0) {
      this.cursedIncomingDamageMultiplier = 1;
      this.cursedEnergyDrainPerSec = 0;
      this.events.emit("floatingAnnouncement", {
        text: "KIROUS RAUKESI",
        duration: 1300
      });
    }
  }

  private emitGameplayTelegraph(
    text: string,
    color: "orange" | "red" | "blue" = "orange",
    icon: string = "⚠️",
    duration: number = 1700
  ): void {
    this.events.emit("gameplayTelegraph", { text, color, icon, duration });
  }

  private applyRunScoreMultiplier(baseScore: number): number {
    return Math.max(
      1,
      Math.round(baseScore * this.routeScoreMultiplier * this.runScoreMultiplier)
    );
  }

  private getRunModifierPool(): RunModifierSpec[] {
    return [
      {
        id: "packed_tracks",
        label: "Tungoslatu",
        description: "Enemmän vihuja, enemmän eliittejä."
      },
      {
        id: "glass_cannon",
        label: "Lasitykki",
        description: "Teet enemmän damagea, mutta otat enemmän osumaa."
      },
      {
        id: "second_wind",
        label: "Toinen hengitys",
        description: "Parempi palautuminen, vihut hieman pehmeämpiä."
      },
      {
        id: "adrenaline",
        label: "Adrenaliinijuoksu",
        description: "Liikut nopeammin, pistekerroin nousee."
      }
    ];
  }

  private applyRunModifiersForCurrentLevel(): void {
    this.activeRunModifiers = [];
    this.runEnemySpawnMultiplier = 1;
    this.runEnemyDamageTakenMultiplier = 1;
    this.runEnemyDamageDealtMultiplier = 1;
    this.runScoreMultiplier = 1;
    this.runPlayerSpeedMultiplier = 1;
    this.runEliteChanceBonus = 0;

    const pool = [...this.getRunModifierPool()];
    const pickCount = this.currentLevel >= 7 ? 2 : 1;
    const seed = this.hashSeed(`${new Date().toISOString().slice(0, 10)}:runmods:${this.currentLevel}`);
    const picked: RunModifierSpec[] = [];

    for (let i = 0; i < pickCount && pool.length > 0; i++) {
      const idx = (seed + i * 11 + this.currentLevel * 5) % pool.length;
      picked.push(pool.splice(idx, 1)[0]);
    }

    for (const modifier of picked) {
      this.activeRunModifiers.push(modifier.id);
      switch (modifier.id) {
        case "packed_tracks":
          this.runEnemySpawnMultiplier *= 1.22;
          this.runEliteChanceBonus += 0.07;
          break;
        case "glass_cannon":
          this.runEnemyDamageTakenMultiplier *= 1.2;
          this.runEnemyDamageDealtMultiplier *= 1.16;
          this.runScoreMultiplier *= 1.1;
          break;
        case "second_wind":
          this.runEnemyDamageTakenMultiplier *= 0.92;
          this.runEnemyDamageDealtMultiplier *= 0.88;
          if (this.player) {
            this.player.energyRegenRate *= 1.18;
          }
          break;
        case "adrenaline":
          this.runPlayerSpeedMultiplier *= 1.12;
          this.runEnemyDamageDealtMultiplier *= 1.08;
          this.runScoreMultiplier *= 1.16;
          break;
      }
    }

    if (this.player) {
      this.player.baseSpeed = Math.round(this.player.baseSpeed * this.runPlayerSpeedMultiplier);
      this.player.maxSpeed = Math.round(this.player.maxSpeed * this.runPlayerSpeedMultiplier);
      this.player.currentSpeed = Phaser.Math.Clamp(
        this.player.currentSpeed,
        this.player.baseSpeed * 0.5,
        this.player.maxSpeed
      );
    }

    this.events.emit("runModifiersChanged", {
      ids: this.activeRunModifiers,
      labels: picked.map((entry) => entry.label)
    });
    if (picked.length > 0) {
      this.events.emit("floatingAnnouncement", {
        text: `RUN MOD: ${picked.map((entry) => entry.label.toUpperCase()).join(" + ")}`,
        duration: 2400
      });
    }
  }

  private setupRhythmWaveSpawner(): void {
    if (this.rhythmWaveTimer) {
      this.rhythmWaveTimer.destroy();
      this.rhythmWaveTimer = undefined;
    }

    const baseDelay = Math.max(7600, 14800 - this.currentLevel * 460);
    this.rhythmWaveTimer = this.time.addEvent({
      delay: baseDelay,
      loop: true,
      callback: () => {
        if (this.player.isDead || this.levelCompleted || this.bossActive || this.clubhouseSpawned) return;
        this.triggerRhythmWave("timer");
      }
    });
  }

  private setupLevelEventMoments(): void {
    this.levelEventMoments = [
      { threshold: 0.24, kind: "wave_surge", triggered: false }
    ];
    if (this.pickForcedWeatherForLevelEvent()) {
      this.levelEventMoments.push({ threshold: 0.5, kind: "weather_spike", triggered: false });
    }
    if (this.currentLevel >= 4) {
      this.levelEventMoments.push({ threshold: 0.68, kind: "elite_patrol", triggered: false });
    }
    if (this.currentLevel >= 5) {
      this.levelEventMoments.push({ threshold: 0.82, kind: "miniboss_ambush", triggered: false });
    }
  }

  private updateLevelEventMoments(): void {
    if (this.levelEventMoments.length === 0) return;
    if (this.player.isDead || this.levelCompleted || this.clubhouseSpawned || this.bossActive) return;

    const progress = Phaser.Math.Clamp(this.distanceTraveled / Math.max(1, this.levelDistance), 0, 1);
    for (const moment of this.levelEventMoments) {
      if (moment.triggered) continue;
      if (progress < moment.threshold) continue;
      moment.triggered = true;
      this.triggerLevelEventMoment(moment.kind);
      break;
    }
  }

  private triggerLevelEventMoment(kind: LevelMomentKind): void {
    if (kind === "wave_surge") {
      this.emitGameplayTelegraph("EVENT: RYTMIAALTO", "orange", "🌊", 2000);
      this.triggerRhythmWave("event");
      return;
    }

    if (kind === "weather_spike") {
      this.triggerLevelWeatherSpike();
      return;
    }

    if (kind === "elite_patrol") {
      this.emitGameplayTelegraph("EVENT: ELIITTIPARTIO", "red", "⚔️", 2100);
      const count = Phaser.Math.Clamp(2 + Math.floor(this.currentLevel / 4), 2, 4);
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * 210, () => {
          this.spawnRandomEnemy({
            source: "event",
            forceElite: true,
            roleGroup: i % 2 === 0 ? "shield_wall" : "rush_pack",
            bypassPopulationCap: true,
            bypassSpawnThrottle: true
          });
        });
      }
      return;
    }

    this.triggerMiniBossAmbush();
  }

  private pickForcedWeatherForLevelEvent(): "snowstorm" | "acidrain" | null {
    if (this.currentLevel === 4) return "acidrain";
    if (this.currentLevel >= 5) return "snowstorm";
    return null;
  }

  private triggerLevelWeatherSpike(): void {
    const forcedWeather = this.pickForcedWeatherForLevelEvent();
    if (!forcedWeather) return;
    if (this.currentWeather === "clear") {
      this.startWeather(forcedWeather);
    }
  }

  private triggerRhythmWave(source: "timer" | "event"): void {
    const roleGroup: EnemyRoleGroupId = Math.random() < 0.5 ? "rush_pack" : "shield_wall";
    const burstCount = Phaser.Math.Clamp(2 + Math.floor(this.currentLevel / 3) + (source === "event" ? 1 : 0), 2, 6);
    const spacing = source === "event" ? 170 : 220;
    const label = roleGroup === "rush_pack" ? "RUSH PACK" : "SHIELD WALL";
    const waveColor: "orange" | "red" = roleGroup === "rush_pack" ? "red" : "orange";
    const waveIcon = roleGroup === "rush_pack" ? "⚡" : "🛡️";
    this.emitGameplayTelegraph(`AALTO: ${label}`, waveColor, waveIcon, 1900);
    if (this.optionalEffectsEnabled) {
      this.triggerSafeCameraPreset(
        roleGroup === "rush_pack" ? "heavy_hit" : "light_hit",
        { x: this.scale.width * 0.58, y: this.groundY - 100 }
      );
    }

    for (let i = 0; i < burstCount; i++) {
      this.time.delayedCall(i * spacing, () => {
        if (this.player.isDead || this.levelCompleted || this.clubhouseSpawned || this.bossActive) return;
        const forcedRole: EnemyRole = roleGroup === "rush_pack"
          ? (Math.random() < 0.55 ? "flanker" : "disruptor")
          : (Math.random() < 0.55 ? "vanguard" : "support");
        const spawnedEnemy = this.spawnRandomEnemy({
          source: "wave",
          roleGroup,
          forcedRole,
          forceElite: this.currentLevel >= 6 && Math.random() < 0.28,
          bypassPopulationCap: source === "event",
          bypassSpawnThrottle: true
        });
        if (!spawnedEnemy) return;

        // Short visibility pulse so wave enemies are clearly distinguishable at spawn.
        const baseAlpha = Number.isFinite(spawnedEnemy.alpha) ? spawnedEnemy.alpha : 1;
        this.tweens.add({
          targets: spawnedEnemy,
          alpha: Math.max(0.45, baseAlpha * 0.45),
          duration: 110,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            if (spawnedEnemy?.active && !spawnedEnemy.isDead) {
              spawnedEnemy.setAlpha(baseAlpha);
            }
          }
        });

        if (i === 0 || i === burstCount - 1) {
          const tag = roleGroup === "shield_wall" ? "MUURI" : "RUSH";
          const color = roleGroup === "shield_wall" ? 0x9bd3ff : 0xffb86b;
          this.showFloatingText(spawnedEnemy.x, spawnedEnemy.y - 100, tag, color, 800, { force: true });
        }
      });
    }
  }

  private triggerMiniBossAmbush(): void {
    if (this.player.isDead || this.levelCompleted || this.clubhouseSpawned || this.bossActive) return;

    const allowedAmbushes = this.currentLevel >= 8 ? 2 : 1;
    if (this.minibossAmbushesTriggered >= allowedAmbushes) return;

    const miniBossTypeOptions: Array<{ type: string; minLevel: number }> = [
      { type: "powerWalker", minLevel: 1 },
      { type: "proSkier", minLevel: 3 },
      { type: "crossfitBro", minLevel: 5 },
      { type: "cityCyclist", minLevel: 4 },
      { type: "brunchLady", minLevel: 6 },
      { type: "regularEnemy", minLevel: 1 }
    ];
    const available = miniBossTypeOptions.filter((entry) => this.currentLevel >= entry.minLevel);
    const forcedType = Phaser.Math.RND.pick(available).type;
    const spawned = this.spawnRandomEnemy({
      source: "ambush",
      forcedType,
      forcedRole: "vanguard",
      forceElite: true,
      forceMiniBoss: true,
      bypassPopulationCap: true,
      bypassSpawnThrottle: true
    });
    if (!spawned) return;

    this.minibossAmbushesTriggered++;
    this.emitGameplayTelegraph("MINIBOSS AMBUSH!", "red", "🔥", 2400);
  }

  private setupDynamicWeatherPulse(): void {
    if (this.weatherPulseTimer) {
      this.weatherPulseTimer.destroy();
      this.weatherPulseTimer = undefined;
    }
    this.weatherPulseTimer = this.time.addEvent({
      delay: 9200,
      loop: true,
      callback: () => {
        if (this.player.isDead || this.levelCompleted || this.clubhouseSpawned || this.bossActive) return;
        this.triggerDynamicWeatherPulse(false);
      }
    });
  }

  private triggerDynamicWeatherPulse(force: boolean): void {
    if (this.bossActive) return;
    if (!force && Math.random() < 0.45) return;

    const pulseOptions = this.currentWeather === "clear"
      ? [
          { speed: force ? 0.78 : 0.88, aggro: force ? 1.2 : 1.1, drain: force ? 1 : 0, text: "SÄÄPULSSI: KOVA VASTATUULI", icon: "🌬️", color: "blue" as const },
          { speed: force ? 1.26 : 1.12, aggro: force ? 0.9 : 0.96, drain: 0, text: "SÄÄPULSSI: MYÖTÄTUULI BOOST", icon: "💨", color: "orange" as const }
        ]
      : [
          { speed: force ? 0.74 : 0.84, aggro: force ? 1.22 : 1.12, drain: force ? 3 : 2, text: "SÄÄPULSSI: RÄNTÄPIISKA", icon: "🌨️", color: "blue" as const },
          { speed: force ? 1.12 : 1.04, aggro: force ? 1.12 : 1.06, drain: force ? 2 : 1, text: "SÄÄPULSSI: KOVA PUUSKA", icon: "🌪️", color: "orange" as const }
        ];
    const choice = Phaser.Math.RND.pick(pulseOptions);
    this.dynamicWeatherSpeedMultiplier = choice.speed;
    this.dynamicWeatherAggroMultiplier = choice.aggro;
    this.dynamicWeatherEnergyDrainBonus = choice.drain;
    const pulseDurationMs = force ? Phaser.Math.Between(6200, 9800) : Phaser.Math.Between(4200, 7600);
    this.dynamicWeatherPulseEndsAt = this.time.now + pulseDurationMs;
    this.emitGameplayTelegraph(choice.text, choice.color, choice.icon, force ? 2100 : 1500);
    this.events.emit("floatingAnnouncement", { text: choice.text, duration: 1500 });
    if (force && this.optionalEffectsEnabled) {
      this.triggerSafeCameraPreset(
        choice.speed < 1 ? "heavy_hit" : "light_hit",
        { x: this.scale.width * 0.56, y: this.groundY - 120 }
      );
    }
  }

  private getRoleGroupEnemyTypes(roleGroup: EnemyRoleGroupId): string[] {
    if (roleGroup === "rush_pack") {
      return [
        "regularEnemy",
        "proSkier",
        "cityCyclist",
        "crossfitBro",
        "escooterRider",
        "drunk"
      ];
    }
    return [
      "regularEnemy",
      "family",
      "powerWalker",
      "headphoneWalker",
      "brunchLady",
      "passiveGrandpa"
    ];
  }

  private resolveEnemyRoleForType(enemyType: string, context?: EnemySpawnContext): EnemyRole {
    if (context?.forcedRole) return context.forcedRole;

    if (context?.roleGroup === "rush_pack") {
      return Math.random() < 0.54 ? "flanker" : "disruptor";
    }
    if (context?.roleGroup === "shield_wall") {
      return Math.random() < 0.54 ? "vanguard" : "support";
    }

    if (["family", "powerWalker", "brunchLady", "yachtOwner", "privateSchoolSUV"].includes(enemyType)) {
      return "vanguard";
    }
    if (["headphoneWalker", "passiveGrandpa", "cryptoBro", "influencerSelfie", "wineMom", "realEstateAgent"].includes(enemyType)) {
      return "support";
    }
    if (["drunk", "smokingLady", "padelPlayer", "tennisPlayer", "bluetoothBomber", "chihuahua"].includes(enemyType)) {
      return "disruptor";
    }
    return "flanker";
  }

  private getEnemyCombatProfile(enemy: any): EnemyCombatProfile | undefined {
    return enemy?.__combatProfile as EnemyCombatProfile | undefined;
  }

  private ensureEnemyCombatProfile(
    enemy: any,
    enemyType: string,
    context: EnemySpawnContext = {}
  ): EnemyCombatProfile | undefined {
    if (!enemy || !enemy.active || enemy.isDead) return undefined;
    if (enemy instanceof Boss || enemy instanceof PeterSync || enemy instanceof KanniBoss) return undefined;
    const existing = this.getEnemyCombatProfile(enemy);
    if (existing) return existing;

    const baseSpeed = Math.max(20, Number(enemy.speed ?? 70));
    const baseDamage = Math.max(4, Number(enemy.damage ?? 11));
    const baseAttackCooldown = Math.max(650, Number(enemy.attackCooldown ?? 1900));
    const rawBaseMaxHealth = Number(enemy.maxHealth ?? enemy.health ?? 44);
    const baseMaxHealth = Math.max(16, rawBaseMaxHealth);
    const baseScoreValue = Math.max(40, Number(enemy.scoreValue ?? 100));
    const isLightweightEnemy = enemyType === "drunk" || enemyType === "regularEnemy";

    const profile: EnemyCombatProfile = {
      role: this.resolveEnemyRoleForType(enemyType, context),
      affixes: [],
      isElite: false,
      isLeader: false,
      isMiniBoss: !!context.forceMiniBoss,
      baseSpeed,
      baseDamage,
      baseAttackCooldown,
      baseMaxHealth,
      baseScoreValue,
      speedMultiplier: 1,
      damageMultiplier: 1,
      healthMultiplier: 1,
      attackCooldownMultiplier: 1,
      damageTakenMultiplier: 1,
      evadeChance: 0.02,
      feintChance: 0.03,
      lifestealRatio: 0,
      morale: 58,
      maxPoise: 72,
      poise: 72,
      staggeredUntil: 0,
      fleeUntil: 0,
      enragedUntil: 0,
      auraSpeedMultiplier: 1,
      auraDamageMultiplier: 1,
      auraMoraleBonus: 0,
      lastEvasiveAt: -99999
    };

    switch (profile.role) {
      case "vanguard":
        profile.healthMultiplier *= 1.3;
        profile.speedMultiplier *= 0.88;
        profile.damageMultiplier *= 1.05;
        profile.maxPoise += 28;
        break;
      case "flanker":
        profile.speedMultiplier *= 1.2;
        profile.healthMultiplier *= 0.9;
        profile.evadeChance += 0.08;
        profile.feintChance += 0.05;
        break;
      case "disruptor":
        profile.speedMultiplier *= 1.08;
        profile.damageMultiplier *= 1.16;
        profile.attackCooldownMultiplier *= 0.9;
        profile.feintChance += 0.12;
        break;
      case "support":
        profile.healthMultiplier *= 1.06;
        profile.damageMultiplier *= 0.9;
        profile.attackCooldownMultiplier *= 0.94;
        profile.morale += 12;
        break;
    }

    if (isLightweightEnemy) {
      // Keep the red-jacket default punks clearly easier than specialty enemies.
      profile.healthMultiplier = 1;
      profile.damageMultiplier *= 0.82;
      profile.speedMultiplier *= 0.92;
      profile.attackCooldownMultiplier *= 1.14;
      profile.damageTakenMultiplier = 1;
      profile.evadeChance = Math.min(profile.evadeChance, 0.02);
      profile.feintChance = Math.min(profile.feintChance, 0.03);
      profile.maxPoise = Math.min(profile.maxPoise, 58);
      profile.morale = Math.min(profile.morale, 52);
    }

    // Wave role groups now apply clear gameplay modifiers so "AALTO" events
    // feel different from normal random spawns.
    if (context.source === "wave" && !isLightweightEnemy) {
      if (context.roleGroup === "shield_wall") {
        profile.healthMultiplier *= 1.24;
        profile.damageTakenMultiplier *= 0.82;
        profile.speedMultiplier *= 0.84;
        profile.attackCooldownMultiplier *= 1.06;
        profile.maxPoise += 36;
        profile.morale += 10;
      } else if (context.roleGroup === "rush_pack") {
        profile.healthMultiplier *= 0.9;
        profile.speedMultiplier *= 1.24;
        profile.damageMultiplier *= 1.14;
        profile.attackCooldownMultiplier *= 0.82;
        profile.evadeChance += 0.05;
        profile.feintChance += 0.08;
      }
    }

    const baseEliteChance = Phaser.Math.Clamp(
      0.04 + this.currentLevel * 0.014 + this.runEliteChanceBonus + (context.source === "wave" ? 0.04 : 0),
      0.04,
      0.48
    );
    profile.isElite = !isLightweightEnemy && (!!context.forceElite || profile.isMiniBoss || Math.random() < baseEliteChance);
    if (profile.isElite) {
      profile.healthMultiplier *= 1.45;
      profile.damageMultiplier *= 1.2;
      profile.attackCooldownMultiplier *= 0.9;
      profile.maxPoise += 48;
      profile.morale += 10;
      profile.evadeChance += 0.03;

      const affixPool: EnemyAffix[] = ["iron_skin", "berserker", "nimble", "vampiric", "bulwark"];
      const affixCount = profile.isMiniBoss ? 2 : (Math.random() < 0.3 ? 2 : 1);
      for (let i = 0; i < affixCount && affixPool.length > 0; i++) {
        const idx = Phaser.Math.Between(0, affixPool.length - 1);
        const affix = affixPool.splice(idx, 1)[0];
        profile.affixes.push(affix);
        switch (affix) {
          case "iron_skin":
            profile.healthMultiplier *= 1.28;
            profile.maxPoise += 34;
            break;
          case "berserker":
            profile.damageMultiplier *= 1.26;
            profile.speedMultiplier *= 1.1;
            break;
          case "nimble":
            profile.evadeChance += 0.16;
            profile.feintChance += 0.08;
            break;
          case "vampiric":
            profile.lifestealRatio += 0.12;
            break;
          case "bulwark":
            profile.damageTakenMultiplier *= 0.8;
            profile.maxPoise += 50;
            break;
        }
      }
    }

    const leaderChance = Phaser.Math.Clamp(
      0.03 + this.currentLevel * 0.005 + (context.source === "wave" ? 0.02 : 0),
      0.03,
      0.22
    );
    profile.isLeader = !isLightweightEnemy && (profile.isMiniBoss || Math.random() < leaderChance);
    if (profile.isLeader) {
      profile.morale += 18;
      profile.damageMultiplier *= 1.08;
      profile.speedMultiplier *= 1.06;
      profile.maxPoise += 24;
    }

    if (profile.isMiniBoss) {
      profile.isElite = true;
      profile.healthMultiplier *= 2.2;
      profile.damageMultiplier *= 1.36;
      profile.speedMultiplier *= 1.08;
      profile.attackCooldownMultiplier *= 0.84;
      profile.maxPoise += 70;
      profile.morale = 100;
    }

    profile.maxPoise = Math.max(40, Math.round(profile.maxPoise));
    profile.poise = profile.maxPoise;
    enemy.__combatProfile = profile;
    enemy.__spawnType = enemyType;
    this.applyEnemyProfileStats(enemy, profile, false);

    if (profile.isMiniBoss) {
      if (typeof enemy.setScale === "function" && !enemy.__miniBossScaled) {
        enemy.setScale(enemy.scaleX * 1.2, enemy.scaleY * 1.2);
        enemy.__miniBossScaled = true;
      }
      this.showFloatingText(enemy.x, enemy.y - 120, "MINIBOSS!", 0xff8a65, 1400, { force: true });
    } else if (profile.isElite && Math.random() < 0.45) {
      const affixTag = profile.affixes.length > 0 ? ` [${profile.affixes[0].toUpperCase()}]` : "";
      this.showFloatingText(enemy.x, enemy.y - 110, `ELIITTI${affixTag}`, 0xffd54f, 1200, { force: true });
    } else if (profile.isLeader && Math.random() < 0.35) {
      this.showFloatingText(enemy.x, enemy.y - 110, "LEADER", 0x80deea, 1100, { force: true });
    }
    return profile;
  }

  private applyEnemyProfileStats(enemy: any, profile: EnemyCombatProfile, preserveHealthRatio: boolean): void {
    if (!enemy || !profile) return;

    const previousMax = Math.max(1, Number(enemy.maxHealth ?? profile.baseMaxHealth));
    const previousHealth = Math.max(0, Number(enemy.health ?? previousMax));
    const ratio = preserveHealthRatio ? Phaser.Math.Clamp(previousHealth / previousMax, 0, 1) : 1;

    const dynamicSpeedMultiplier = profile.auraSpeedMultiplier
      * (this.time.now < profile.enragedUntil ? 1.18 : 1)
      * (this.time.now < profile.fleeUntil ? 1.24 : 1)
      * this.dynamicWeatherAggroMultiplier;
    const dynamicDamageMultiplier = profile.auraDamageMultiplier
      * (this.time.now < profile.enragedUntil ? 1.22 : 1)
      * (this.time.now < profile.fleeUntil ? 0.74 : 1)
      * this.dynamicWeatherAggroMultiplier;
    const dynamicCooldownMultiplier =
      (this.time.now < profile.enragedUntil ? 0.85 : 1) * (this.time.now < profile.fleeUntil ? 1.12 : 1);

    let nextSpeed = Math.max(20, Math.round(profile.baseSpeed * profile.speedMultiplier * dynamicSpeedMultiplier));
    let nextDamage = Math.max(3, Math.round(profile.baseDamage * profile.damageMultiplier * dynamicDamageMultiplier));
    let nextCooldown = Math.max(500, Math.round(profile.baseAttackCooldown * profile.attackCooldownMultiplier * dynamicCooldownMultiplier));
    let nextMaxHealth = Math.max(12, Math.round(profile.baseMaxHealth * profile.healthMultiplier));
    if (enemy?.__spawnType === "drunk") {
      // Keep DrunkPerson lightweight and predictable across combat-profile updates.
      nextSpeed = Math.min(nextSpeed, 60);
      nextMaxHealth = 30;
      nextDamage = Math.min(nextDamage, 12);
      nextCooldown = Math.max(nextCooldown, 2600);
    } else if (enemy?.__spawnType === "regularEnemy") {
      // Keep the default ski enemy at the requested fixed 30 HP and low pressure.
      nextSpeed = Math.min(nextSpeed, 260);
      nextMaxHealth = 30;
      nextDamage = Math.min(nextDamage, 12);
      nextCooldown = Math.max(nextCooldown, 2200);
    }

    enemy.speed = nextSpeed;
    enemy.damage = nextDamage;
    enemy.attackCooldown = nextCooldown;
    enemy.maxHealth = nextMaxHealth;
    enemy.health = Math.max(1, Math.round(nextMaxHealth * ratio));

    const baseScore = Math.max(40, Number(profile.baseScoreValue ?? enemy.scoreValue ?? 100));
    const eliteBonus = profile.isElite ? 1.45 : 1;
    const leaderBonus = profile.isLeader ? 1.2 : 1;
    const miniBossBonus = profile.isMiniBoss ? 2.2 : 1;
    enemy.scoreValue = Math.round(baseScore * eliteBonus * leaderBonus * miniBossBonus);

    if (typeof enemy.setTint === "function" && !enemy.isDead && !enemy.isHurting) {
      if (profile.isMiniBoss) {
        enemy.setTint(0xff7043);
      } else if (profile.isElite) {
        enemy.setTint(0xffd54f);
      } else if (profile.isLeader) {
        enemy.setTint(0x80deea);
      }
    }
  }

  private updateEnemyCombatDynamics(time: number): void {
    if (time - this.lastCombatDynamicsAt < 220) return;
    this.lastCombatDynamicsAt = time;

    this.recentEnemyDefeatTimes = this.recentEnemyDefeatTimes.filter((stamp) => time - stamp <= 6500);
    const casualtyPressure = this.recentEnemyDefeatTimes.length;

    const activeEnemies = this.enemies.children.entries.filter(
      (entry: any) =>
        entry?.active &&
        !entry?.isDead &&
        !(entry instanceof Boss) &&
        !(entry instanceof PeterSync) &&
        !(entry instanceof KanniBoss)
    );
    const leaders = activeEnemies.filter((entry: any) => {
      let profile = this.getEnemyCombatProfile(entry);
      if (!profile) {
        const inferredType = String(entry?.__spawnType || entry?.texture?.key || "regularEnemy");
        profile = this.ensureEnemyCombatProfile(entry, inferredType, { source: "default" });
      }
      return !!profile?.isLeader;
    });

    for (const enemy of activeEnemies) {
      let profile = this.getEnemyCombatProfile(enemy);
      if (!profile) {
        const inferredType = String(enemy?.__spawnType || enemy?.texture?.key || "regularEnemy");
        profile = this.ensureEnemyCombatProfile(enemy, inferredType, { source: "default" });
      }
      if (!profile) continue;

      profile.auraSpeedMultiplier = 1;
      profile.auraDamageMultiplier = 1;
      profile.auraMoraleBonus = 0;

      const nearestLeader = leaders.find((leader: any) => leader !== enemy && Phaser.Math.Distance.Between(enemy.x, enemy.y, leader.x, leader.y) < 240);
      if (nearestLeader) {
        profile.auraSpeedMultiplier = 1.1;
        profile.auraDamageMultiplier = 1.14;
        profile.auraMoraleBonus = 15;
      }

      const comboPressure = this.player.comboCount >= 5 ? 12 : 0;
      const healthPressure = this.player.getHealthPercentage() < 35 ? -8 : 0;
      const targetMorale = 58 + profile.auraMoraleBonus - casualtyPressure * 3 - comboPressure - healthPressure;
      profile.morale = Phaser.Math.Clamp(profile.morale + Phaser.Math.Clamp((targetMorale - profile.morale) * 0.3, -4, 4), 0, 100);

      const healthRatio = Phaser.Math.Clamp(Number(enemy.health ?? profile.baseMaxHealth) / Math.max(1, Number(enemy.maxHealth ?? profile.baseMaxHealth)), 0, 1);
      if (
        healthRatio < 0.48 &&
        time >= profile.enragedUntil &&
        (profile.isElite || profile.isLeader || profile.morale >= 66 || casualtyPressure >= 3)
      ) {
        profile.enragedUntil = time + Phaser.Math.Between(2600, 4200);
      }

      if (
        !profile.isLeader &&
        !profile.isMiniBoss &&
        profile.morale <= 24 &&
        time >= profile.fleeUntil &&
        time >= profile.staggeredUntil
      ) {
        profile.fleeUntil = time + Phaser.Math.Between(1200, 2200);
      }

      if (time < profile.staggeredUntil) {
        enemy.canAttack = false;
        enemy.isAttacking = false;
        enemy.isHurting = true;
        enemy.currentMeleeTargets?.clear?.();
        enemy.setVelocityX?.(0);
        if (enemy.fsm?.state !== "hurting" && typeof enemy.fsm?.goto === "function") {
          try {
            enemy.fsm.goto("hurting");
          } catch {
            // Ignore FSM transition races.
          }
        }
      } else if (time >= profile.fleeUntil) {
        enemy.isHurting = false;
        enemy.canAttack = true;
      }

      if (time < profile.fleeUntil) {
        enemy.canAttack = false;
        const directionAway = this.player.x < enemy.x ? 1 : -1;
        const fleeSpeed = Math.max(140, Number(enemy.speed ?? profile.baseSpeed) * 1.08);
        enemy.setVelocityX?.(directionAway * fleeSpeed);
        if (enemy.facingDirection !== undefined) {
          enemy.facingDirection = directionAway < 0 ? "left" : "right";
        }
      }

      this.applyEnemyProfileStats(enemy, profile, true);
    }
  }

  private tryEnemyEvadeOrFeint(enemy: any): boolean {
    const profile = this.getEnemyCombatProfile(enemy);
    if (!profile || enemy.isDead || enemy.isHurting) return false;
    if (this.time.now < profile.staggeredUntil || this.time.now < profile.fleeUntil) return false;
    if (this.time.now - profile.lastEvasiveAt < 850) return false;

    const evadeChance = Phaser.Math.Clamp(profile.evadeChance, 0, 0.7);
    const feintChance = Phaser.Math.Clamp(profile.feintChance, 0, 0.65);
    const roll = Math.random();
    if (roll >= evadeChance + feintChance * 0.55) return false;

    profile.lastEvasiveAt = this.time.now;
    profile.morale = Phaser.Math.Clamp(profile.morale + 8, 0, 100);
    const awayDir = this.player.x < enemy.x ? 1 : -1;

    if (roll < evadeChance) {
      enemy.setVelocityX?.(awayDir * Math.max(180, Number(enemy.speed ?? 120) * 1.2));
      enemy.currentMeleeTargets?.clear?.();
      this.showFloatingText(enemy.x, enemy.y - 85, "VÄISTÖ!", 0xa5d6a7, 900);
      return true;
    }

    enemy.setVelocityX?.(-awayDir * Math.max(130, Number(enemy.speed ?? 120)));
    this.time.delayedCall(170, () => {
      if (!enemy.active || enemy.isDead) return;
      enemy.setVelocityX?.(awayDir * Math.max(210, Number(enemy.speed ?? 120) * 1.4));
    });
    this.showFloatingText(enemy.x, enemy.y - 85, "FEINTTI!", 0x90caf9, 900);
    return true;
  }

  private applyPoiseAndDamageModifiers(
    enemy: any,
    baseDamage: number,
    attackKind: "pole" | "axe" | "voltti" | "stomp",
    isBossTarget: boolean
  ): number {
    if (isBossTarget) {
      return Math.max(1, Math.round(baseDamage * this.runEnemyDamageTakenMultiplier));
    }
    const profile = this.getEnemyCombatProfile(enemy);
    if (!profile) {
      return Math.max(1, Math.round(baseDamage * this.runEnemyDamageTakenMultiplier));
    }

    const poiseFactor = attackKind === "stomp"
      ? 1.15
      : attackKind === "axe"
        ? 1.05
        : attackKind === "voltti"
          ? 0.9
          : 0.75;
    profile.poise -= baseDamage * poiseFactor;

    if (profile.poise <= 0) {
      profile.poise = profile.maxPoise;
      profile.staggeredUntil = this.time.now + (profile.isMiniBoss ? 820 : profile.isElite ? 640 : 460);
      enemy.isAttacking = false;
      enemy.isHurting = true;
      enemy.canAttack = false;
      enemy.currentMeleeTargets?.clear?.();
      enemy.setVelocityX?.(0);
      if (typeof enemy.fsm?.goto === "function") {
        try {
          enemy.fsm.goto("hurting");
        } catch {
          // Ignore transition issues for non-standard enemies.
        }
      }
      this.showFloatingText(enemy.x, enemy.y - 92, "STAGGER!", 0xfff59d, 950);
      profile.morale = Phaser.Math.Clamp(profile.morale - 12, 0, 100);
    }

    const damage = baseDamage * this.runEnemyDamageTakenMultiplier * profile.damageTakenMultiplier;
    return Math.max(1, Math.round(damage));
  }

  private onEnemySuccessfulHit(enemy: any, dealtDamage: number): void {
    const profile = this.getEnemyCombatProfile(enemy);
    if (!profile || profile.lifestealRatio <= 0) return;
    const maxHealth = Math.max(1, Number(enemy.maxHealth ?? profile.baseMaxHealth));
    const currentHealth = Math.max(0, Number(enemy.health ?? maxHealth));
    const healAmount = Math.max(1, Math.round(dealtDamage * profile.lifestealRatio));
    enemy.health = Math.min(maxHealth, currentHealth + healAmount);
  }

  private computeLevelGradeResult(): LevelGradeResult {
    const safeStartTime = this.levelStartTimeMs > 0 ? this.levelStartTimeMs : Math.max(0, this.time.now - 1000);
    const levelDurationSec = Math.max(1, (this.time.now - safeStartTime) / 1000);
    const levelKills = Math.max(0, this.enemiesDefeated - this.levelEnemiesAtStart);
    const rawLevelScore = Math.max(0, this.player.score - this.previousScore);

    const scoreComponent = Phaser.Math.Clamp(rawLevelScore / Math.max(120, this.levelDistance * 1.7), 0, 110);
    const tempoComponent = Phaser.Math.Clamp((this.levelDistance / Math.max(1, levelDurationSec)) * 0.22, 0, 30);
    const killComponent = Phaser.Math.Clamp(levelKills * 1.8, 0, 32);
    const objectiveComponent = this.microObjectiveCompleted ? 16 : 0;
    const damagePenalty = Phaser.Math.Clamp(this.levelDamageTaken * 0.2, 0, 28);
    const score = Math.max(0, Math.round(scoreComponent + tempoComponent + killComponent + objectiveComponent - damagePenalty));

    let grade: StyleRank = "D";
    if (score >= 160) {
      grade = "S";
    } else if (score >= 124) {
      grade = "A";
    } else if (score >= 92) {
      grade = "B";
    } else if (score >= 64) {
      grade = "C";
    }

    const baseBonusMap: Record<StyleRank, number> = {
      D: 0,
      C: 140,
      B: 260,
      A: 420,
      S: 620
    };
    const bonusScore = Math.round(baseBonusMap[grade] * this.routeScoreMultiplier);
    return { grade, bonusScore, score };
  }

  private resetEnemyTauntPacing(): void {
    const effectiveDistance = Math.max(1, this.levelDistance || 1);
    const baseTargetCount = Phaser.Math.Clamp(Math.round(effectiveDistance / 75), 10, 20);
    const targetCount = Phaser.Math.Clamp(Math.round(baseTargetCount * 3), 24, 60); // +100% vs previous pacing (2x chatter)
    this.enemyTauntTargetCount = targetCount;
    this.enemyTauntShownCount = 0;
    this.enemyTauntBudget = 2.25;
    this.enemyTauntDistancePerLine = effectiveDistance / targetCount;
    this.enemyTauntLastEmitAt = -99999;
  }

  private updateEnemyTauntBudget(distanceThisFrame: number): void {
    if (!Number.isFinite(distanceThisFrame) || distanceThisFrame <= 0) return;
    if (this.enemyTauntDistancePerLine <= 0) return;
    const addedBudget = distanceThisFrame / this.enemyTauntDistancePerLine;
    this.enemyTauntBudget = Math.min(7.5, this.enemyTauntBudget + addedBudget);
  }

  consumeEnemyTauntBudget(now: number = this.time.now): boolean {
    if (this.levelCompleted || this.player?.isDead) return false;
    if (this.enemyTauntShownCount >= this.enemyTauntTargetCount) return false;
    if (this.enemyTauntBudget < 1) return false;
    if (now - this.enemyTauntLastEmitAt < this.enemyTauntMinIntervalMs) return false;

    this.enemyTauntBudget = Math.max(0, this.enemyTauntBudget - 1);
    this.enemyTauntShownCount += 1;
    this.enemyTauntLastEmitAt = now;
    return true;
  }

  private clearBossTelegraph(): void {
    if (this.bossTelegraphClearTimer) {
      this.bossTelegraphClearTimer.destroy();
      this.bossTelegraphClearTimer = undefined;
    }
    if (this.bossTelegraphTween) {
      this.bossTelegraphTween.remove();
      this.bossTelegraphTween = undefined;
    }
    if (this.bossTelegraph && this.bossTelegraph.scene) {
      this.bossTelegraph.destroy();
    }
    this.bossTelegraph = undefined;
    if (this.bossTelegraphLabel && this.bossTelegraphLabel.scene) {
      this.bossTelegraphLabel.destroy();
    }
    this.bossTelegraphLabel = undefined;
  }

  private createCinematicVisualLayers(): void {
    // Disabled globally: this layer introduced visible square artifacts ("fog boxes")
    // and spotlight-like lighting in boss fights.
    this.cinematicParallaxBands.forEach((band) => band.node.destroy());
    this.cinematicParallaxBands = [];
    this.cinematicDustMotes.forEach((mote) => mote.destroy());
    this.cinematicDustMotes = [];

    this.cinematicColorOverlay?.destroy();
    this.cinematicColorOverlay = undefined;
    this.cinematicStrobeOverlay?.destroy();
    this.cinematicStrobeOverlay = undefined;
    this.cinematicTopGradient?.destroy();
    this.cinematicTopGradient = undefined;
    this.cinematicBottomGradient?.destroy();
    this.cinematicBottomGradient = undefined;
  }

  private updateCinematicVisualLayers(time: number, clampedDelta: number): void {
    if (
      !this.cinematicColorOverlay &&
      !this.cinematicStrobeOverlay &&
      !this.cinematicTopGradient &&
      !this.cinematicBottomGradient &&
      this.cinematicParallaxBands.length === 0 &&
      this.cinematicDustMotes.length === 0
    ) {
      return;
    }

    const lowPerf =
      this.qualityTier === "low" || this.hardFpsEmergencyActive || this.isLowPowerMode || this.lowEndDevice;
    const deltaSeconds = clampedDelta / 1000;

    this.cinematicParallaxBands.forEach((band, index) => {
      const bandWidth = band.node.displayWidth || this.scale.width;
      band.node.x -= this.scrollSpeed * deltaSeconds * band.speed;
      if (band.node.x < -bandWidth * 0.55) {
        band.node.x = this.scale.width + bandWidth * 0.45;
      }
      band.phase += deltaSeconds * (0.42 + index * 0.14);
      band.node.y = band.baseY + Math.sin(time * 0.00045 + band.phase) * band.amplitude;
    });

    const dustStep = lowPerf ? 2 : 1;
    for (let i = 0; i < this.cinematicDustMotes.length; i += dustStep) {
      const mote = this.cinematicDustMotes[i];
      if (!mote || !mote.active) continue;

      mote.wobble += deltaSeconds * 1.8;
      mote.x += (mote.driftX + Math.sin(mote.wobble) * 9) * deltaSeconds;
      mote.y += mote.driftY * deltaSeconds;
      mote.alpha = Phaser.Math.Clamp(mote.baseAlpha + Math.sin(time * 0.003 + i) * 0.028, 0.025, 0.2);

      if (mote.x < -30 || mote.x > this.scale.width + 30 || mote.y < -30 || mote.y > this.scale.height + 30) {
        mote.x = Phaser.Math.Between(-10, this.scale.width + 10);
        mote.y = Phaser.Math.Between(Math.floor(this.scale.height * 0.2), this.scale.height + 10);
        mote.driftX = Phaser.Math.FloatBetween(8, 26) * (Math.random() < 0.5 ? -1 : 1);
        mote.driftY = Phaser.Math.FloatBetween(-2, 8);
        mote.baseAlpha = Phaser.Math.FloatBetween(0.05, lowPerf ? 0.11 : 0.16);
      }
    }

    let filterColor = 0x102235;
    let filterAlpha = lowPerf ? 0.03 : 0.055;
    if (this.currentWeather === "acidrain") {
      filterColor = 0x3e5120;
      filterAlpha = lowPerf ? 0.06 : 0.095;
    } else if (this.currentWeather === "snowstorm" || this.currentWeather === "blizzard") {
      filterColor = 0x2a3f66;
      filterAlpha = lowPerf ? 0.05 : 0.08;
    } else if (this.currentWeather === "sunglare") {
      filterColor = 0x6a5320;
      filterAlpha = lowPerf ? 0.04 : 0.07;
    }
    if (this.bossActive) {
      filterColor = 0x341428;
      filterAlpha = (lowPerf ? 0.07 : 0.11) + Math.sin(time * 0.01) * 0.018;
    }

    this.cinematicColorOverlay?.setFillStyle(
      filterColor,
      Phaser.Math.Clamp(filterAlpha, 0.02, 0.18)
    );

    if (this.cinematicTopGradient) {
      this.cinematicTopGradient.alpha = (lowPerf ? 0.12 : 0.17) + (this.bossActive ? 0.035 : 0);
    }
    if (this.cinematicBottomGradient) {
      this.cinematicBottomGradient.alpha = (lowPerf ? 0.08 : 0.12) + (this.currentWeather === "blizzard" ? 0.02 : 0);
    }

    if (!lowPerf && this.frameCounter % 4 === 0) {
      this.applyDecorationDepthIllusion();
    }
  }

  private applyDecorationDepthIllusion(): void {
    this.decorations.children.each((decoration: any) => {
      if (!decoration?.active || typeof decoration.setScale !== "function") return true;
      if (decoration.__depthScaleDisabled || decoration.__bossCameo) return true;

      const currentScale = Number(decoration.scaleX) || 1;
      const baseScale =
        Number(decoration.__depthBaseScale) > 0
          ? Number(decoration.__depthBaseScale)
          : currentScale;
      decoration.__depthBaseScale = baseScale;

      const normalizedDepth = Phaser.Math.Clamp(
        (Number(decoration.y) - (this.groundY - 250)) / 420,
        0,
        1
      );
      const targetScale = baseScale * (0.96 + normalizedDepth * 0.08);
      if (Math.abs(currentScale - targetScale) > 0.01) {
        decoration.setScale(targetScale, targetScale);
      }
      return true;
    });
  }

  private triggerSafeLightingStrobe(color: number, maxAlpha: number, durationMs: number): void {
    if (!this.cinematicStrobeOverlay || this.hardFpsEmergencyActive) return;
    const overlay = this.cinematicStrobeOverlay;
    const clampedAlpha = Phaser.Math.Clamp(maxAlpha, 0.03, 0.3);
    const totalDuration = Phaser.Math.Clamp(durationMs, 60, 320);

    overlay.setFillStyle(color, 1);
    this.tweens.killTweensOf(overlay);
    overlay.setAlpha(0);
    this.tweens.add({
      targets: overlay,
      alpha: clampedAlpha,
      duration: Math.round(totalDuration * 0.35),
      ease: "Sine.Out",
      yoyo: true,
      hold: Math.round(totalDuration * 0.15),
      onComplete: () => {
        if (overlay.scene === this) {
          overlay.setAlpha(0);
        }
      }
    });
  }

  private triggerSafeCameraPreset(
    preset: SafeCameraPreset,
    anchor?: { x: number; y: number }
  ): void {
    const now = this.time.now;
    const presets: Record<
      SafeCameraPreset,
      {
        shakeMs: number;
        shakeIntensity: number;
        flashMs: number;
        flashColor: [number, number, number];
        zoomDelta: number;
        tiltRad: number;
        zoomMs: number;
        holdMs: number;
        strobeColor: number;
        strobeAlpha: number;
        strobeMs: number;
        minIntervalMs: number;
      }
    > = {
      light_hit: {
        shakeMs: 50,
        shakeIntensity: 0.004,
        flashMs: 70,
        flashColor: [255, 245, 210],
        zoomDelta: 0.008,
        tiltRad: 0.002,
        zoomMs: 70,
        holdMs: 12,
        strobeColor: 0xfef2b8,
        strobeAlpha: 0.06,
        strobeMs: 90,
        minIntervalMs: 80
      },
      heavy_hit: {
        shakeMs: 90,
        shakeIntensity: 0.007,
        flashMs: 95,
        flashColor: [255, 180, 120],
        zoomDelta: 0.014,
        tiltRad: 0.0038,
        zoomMs: 90,
        holdMs: 18,
        strobeColor: 0xffa64d,
        strobeAlpha: 0.085,
        strobeMs: 120,
        minIntervalMs: 120
      },
      boss_super: {
        shakeMs: 140,
        shakeIntensity: 0.01,
        flashMs: 120,
        flashColor: [255, 110, 150],
        zoomDelta: 0.022,
        tiltRad: 0.0052,
        zoomMs: 110,
        holdMs: 26,
        strobeColor: 0xff4d8b,
        strobeAlpha: 0.12,
        strobeMs: 160,
        minIntervalMs: 170
      }
    };

    const config = presets[preset];
    if (now - this.lastSafeCameraPresetAt < config.minIntervalMs) return;
    this.lastSafeCameraPresetAt = now;

    const cam = this.cameras.main;
    if (!cam) return;

    const lowPerf =
      this.qualityTier === "low" || this.hardFpsEmergencyActive || this.isLowPowerMode || this.lowEndDevice;
    const shakeIntensity =
      config.shakeIntensity *
      (lowPerf ? 0.62 : 1) *
      (this.isMobile ? 0.85 : 1);
    const shakeMs = Math.round(config.shakeMs * (lowPerf ? 0.9 : 1));

    cam.shake(shakeMs, shakeIntensity);
    cam.flash(config.flashMs, config.flashColor[0], config.flashColor[1], config.flashColor[2], true);

    const canTiltZoom = !lowPerf && !this.dramaticCameraTween;
    if (canTiltZoom) {
      if (this.safeCameraPresetTween) {
        this.safeCameraPresetTween.remove();
        this.safeCameraPresetTween = undefined;
      }
      if (this.safeCameraPresetResetTimer) {
        this.safeCameraPresetResetTimer.destroy();
        this.safeCameraPresetResetTimer = undefined;
      }

      const startZoom = cam.zoom || 1;
      const startRotation = cam.rotation || 0;
      const targetZoom = startZoom + config.zoomDelta * (this.isMobile ? 0.82 : 1);
      const tiltDirection =
        anchor && Number.isFinite(anchor.x)
          ? (anchor.x < this.scale.width * 0.5 ? -1 : 1)
          : (Math.random() < 0.5 ? -1 : 1);
      const targetRotation = startRotation + config.tiltRad * tiltDirection;

      this.safeCameraPresetTween = this.tweens.add({
        targets: cam,
        zoom: targetZoom,
        rotation: targetRotation,
        duration: config.zoomMs,
        ease: "Sine.Out",
        yoyo: true,
        hold: config.holdMs,
        onComplete: () => {
          cam.rotation = startRotation;
          this.safeCameraPresetTween = undefined;
        }
      });

      this.safeCameraPresetResetTimer = this.time.delayedCall(
        config.zoomMs * 2 + config.holdMs + 40,
        () => {
          cam.rotation = startRotation;
          cam.zoom = startZoom;
          this.safeCameraPresetResetTimer = undefined;
        }
      );
    }

    this.triggerSafeLightingStrobe(
      config.strobeColor,
      config.strobeAlpha * (lowPerf ? 0.7 : 1),
      config.strobeMs
    );
  }

  private applyDramaticSlowMo(scale: number, durationMs: number): void {
    if (!this.sys.isActive()) return;
    const clampedScale = Phaser.Math.Clamp(scale, 0.12, 1);
    const clampedDuration = Phaser.Math.Clamp(durationMs, 40, 7000);
    const now = Date.now();
    this.dramaticSlowMoEndsAt = Math.max(this.dramaticSlowMoEndsAt, now + clampedDuration);

    this.time.timeScale = Math.min(this.time.timeScale || 1, clampedScale);

    if (typeof window === "undefined") return;
    if (this.dramaticSlowMoTimeoutId) {
      window.clearTimeout(this.dramaticSlowMoTimeoutId);
    }

    const waitMs = Math.max(16, this.dramaticSlowMoEndsAt - now);
    this.dramaticSlowMoTimeoutId = window.setTimeout(() => {
      this.dramaticSlowMoTimeoutId = undefined;
      if (!this.sys.isActive()) return;
      if (Date.now() < this.dramaticSlowMoEndsAt - 4) {
        this.applyDramaticSlowMo(clampedScale, Math.max(40, this.dramaticSlowMoEndsAt - Date.now()));
        return;
      }
      this.time.timeScale = 1;
      this.dramaticSlowMoEndsAt = 0;
    }, waitMs);
  }

  private playDramaticCameraFocus(
    targetX: number,
    targetY: number,
    zoom: number,
    focusDurationMs: number,
    holdMs: number,
    returnDurationMs: number
  ): void {
    const cam = this.cameras.main;
    if (!cam) return;

    const baseZoom = cam.zoom || 1;
    const baseScrollX = cam.scrollX;
    const baseScrollY = cam.scrollY;
    const targetZoom = Math.max(baseZoom, zoom);
    const maxScrollX = Math.max(0, this.mapWidth - this.scale.width / Math.max(targetZoom, 0.01));
    const targetScrollX = Phaser.Math.Clamp(
      targetX - this.scale.width / (2 * Math.max(targetZoom, 0.01)),
      0,
      maxScrollX
    );
    // Keep vertical camera lock stable to avoid ground/background drift artifacts.
    const targetScrollY = baseScrollY;

    if (this.dramaticCameraTween) {
      this.dramaticCameraTween.remove();
      this.dramaticCameraTween = undefined;
    }
    if (this.dramaticCameraReturnTimer) {
      this.dramaticCameraReturnTimer.destroy();
      this.dramaticCameraReturnTimer = undefined;
    }

    this.dramaticCameraTween = this.tweens.add({
      targets: cam,
      zoom: targetZoom,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      duration: focusDurationMs,
      ease: "Sine.Out",
      onComplete: () => {
        this.dramaticCameraReturnTimer = this.time.delayedCall(holdMs, () => {
          this.dramaticCameraTween = this.tweens.add({
            targets: cam,
            zoom: baseZoom,
            scrollX: baseScrollX,
            scrollY: baseScrollY,
            duration: returnDurationMs,
            ease: "Sine.InOut",
            onComplete: () => {
              this.dramaticCameraTween = undefined;
            }
          });
        });
      }
    });
  }

  triggerBossFinisherImpact(target?: Phaser.GameObjects.GameObject): void {
    const now = this.time.now;
    if (now - this.lastBossFinisherFxAt < 220) return;
    this.lastBossFinisherFxAt = now;

    this.applyDramaticSlowMo(0.2, 130);
    const focusX = (target as any)?.x ?? this.player?.x ?? this.scale.width * 0.7;
    const focusY = (target as any)?.y ?? this.groundY - 100;
    this.triggerSafeCameraPreset("heavy_hit", { x: focusX, y: focusY });
    this.playDramaticCameraFocus(
      focusX,
      focusY,
      this.isMobile ? 1.08 : 1.12,
      80,
      30,
      120
    );
  }

  triggerBossDeathCinematic(target?: Phaser.GameObjects.GameObject): void {
    this.applyDramaticSlowMo(0.35, this.isMobile ? 700 : 900);
    const focusX = (target as any)?.x ?? this.scale.width * 0.72;
    const focusY = (target as any)?.y ?? this.groundY - 120;
    this.triggerSafeCameraPreset("boss_super", { x: focusX, y: focusY });
    this.playDramaticCameraFocus(
      focusX,
      focusY,
      this.isMobile ? 1.14 : 1.24,
      220,
      300,
      500
    );
  }

  triggerBossSpawnCinematic(target?: Phaser.GameObjects.GameObject): void {
    this.applyDramaticSlowMo(0.65, 260);
    const focusX = (target as any)?.x ?? this.scale.width * 0.7;
    const focusY = (target as any)?.y ?? this.groundY - 120;
    this.triggerSafeCameraPreset("light_hit", { x: focusX, y: focusY });
    this.playDramaticCameraFocus(
      focusX,
      focusY,
      this.isMobile ? 1.06 : 1.1,
      120,
      60,
      180
    );
  }

  private getBossDefeatLine(bossType: string): string {
    const lines: Record<string, string[]> = {
      marja_liisa: [
        "TÄMÄ MENEE TALOYHTIÖN KOKOUKSEEN...",
        "MUN TESLA... JÄI LATUUN..."
      ],
      elsa_mummo: [
        "ROLLAATTORI JÄI PARKKIIN...",
        "ELSAN VIHREÄ PILVI HAIHTUI..."
      ],
      jari_litmanen: [
        "LATU KEISARI HILJENI. BASSO KATOSI.",
        "LAHTI MUISTAA TÄN KEIKAN."
      ],
      jari_isometsa: [
        "AUTOPILOT... EI PELASTANUT...",
        "STARTUP MENI JUST KONKKAAN."
      ],
      tero_afterwork: [
        "AFTERWORK PAKETOITIIN...",
        "SALKKU SULKEUTUI. KOKOUS ON OHI."
      ],
      matti_nykanen: [
        "BIRDIESTÄ TULI BOGEY...",
        "KLUBITALO EI AUTA ENÄÄ."
      ],
      jeti: [
        "HUUSSI TYHJÄ... HERMOT MYÖS...",
        "HESEN KUPONKI... JÄI TASKUUN..."
      ],
      timo_soini: [
        "JYTKY LIPUI OHI...",
        "PANNUKAKKU JÄÄHTYI LIIAN NOPEAAN."
      ],
      peter_sync: [
        "THE MUSIC... STOPS...",
        "DISCO MELTS INTO SILENCE..."
      ]
    };

    return Phaser.Math.RND.pick(lines[bossType] || ["LATU NIELI BOSSIN."]);
  }

  private showBossDefeatLine(text: string, x: number, y: number, durationMs: number = 2600): void {
    const safeText = sanitizePlayerFacingText(text);
    if (!safeText) return;

    const lineText = this.add.text(x, y, safeText, {
      fontFamily: "PublicPixel",
      fontSize: this.isMobile ? "15px" : "18px",
      color: "#ffee88",
      stroke: "#000000",
      strokeThickness: 4,
      align: "center",
      wordWrap: { width: this.isMobile ? 300 : 420 }
    });
    lineText.setOrigin(0.5, 1);
    lineText.setDepth(GameScene.DEPTH_EFFECTS + 30);

    this.tweens.add({
      targets: lineText,
      y: y - (this.isMobile ? 22 : 28),
      alpha: { from: 1, to: 0 },
      duration: durationMs,
      ease: "Sine.Out",
      onComplete: () => {
        lineText.destroy();
      }
    });
  }

  private computeCameraFocusScroll(focusX: number, focusY: number, zoom: number): { x: number; y: number } {
    const safeZoom = Math.max(zoom, 0.01);
    const maxScrollX = Math.max(0, this.mapWidth - this.scale.width / safeZoom);
    const maxScrollY = Math.max(0, this.mapHeight - this.scale.height / safeZoom);
    const lockedScrollY = 0;

    return {
      x: Phaser.Math.Clamp(focusX - this.scale.width / (2 * safeZoom), 0, maxScrollX),
      y: Phaser.Math.Clamp(lockedScrollY, 0, maxScrollY),
    };
  }

  playBossDeathFinale(
    boss: Boss | PeterSync,
    data: { bossType: string; isFinalBoss: boolean; scoreValue: number; finalLine?: string }
  ): void {
    if (!boss || !boss.active || this.levelCompleted || this.bossDeathSequenceActive) return;

    this.bossDeathSequenceActive = true;
    this.clearBossTelegraph();

    // Keep arena frozen during the death moment.
    this.bossActive = true;
    this.bossDefeated = false;
    this.scrollSpeed = 0;

    if (this.player && !this.player.isDead) {
      this.player.currentSpeed = 0;
      this.player.setVelocity(0, 0);
      this.player.body?.setEnable(false);
    }

    const bossAny = boss as any;
    bossAny.setVelocity?.(0, 0);
    bossAny.setVelocityX?.(0);
    const bossBody = bossAny.body as Phaser.Physics.Arcade.Body | undefined;
    if (bossBody) {
      bossBody.setVelocity(0, 0);
      bossBody.setAllowGravity(false);
      bossBody.enable = false;
    }

    const bossHeight = Math.max(84, Number(bossAny.displayHeight) || 140);
    bossAny.y = this.groundY + Math.min(18, bossHeight * 0.08);
    bossAny.setAngle?.(bossAny.flipX ? -88 : 88);
    bossAny.setTint?.(0xcfd8ff);
    bossAny.setDepth?.(GameScene.DEPTH_ENEMIES_BASE + 6);

    if (data.bossType === "peter_sync" && typeof bossAny.playAnimation === "function") {
      if (this.anims.exists("peter_sync_die_anim")) {
        bossAny.playAnimation("peter_sync_die_anim");
      }
    } else if (typeof bossAny.getAnimationKey === "function" && typeof bossAny.playAnimation === "function") {
      const idleAnimKey = bossAny.getAnimationKey("idle");
      const dieAnimKey = bossAny.getAnimationKey("die");
      const hasDedicatedDieAnim = Boolean(
        dieAnimKey && this.anims.exists(dieAnimKey) && dieAnimKey !== idleAnimKey
      );
      if (hasDedicatedDieAnim) {
        bossAny.playAnimation(dieAnimKey);
      } else {
        bossAny.anims?.stop?.();
        if (idleAnimKey && this.anims.exists(idleAnimKey)) {
          const idleFrame = this.anims.get(idleAnimKey)?.frames?.[0]?.textureFrame;
          if (idleFrame !== undefined && idleFrame !== null) {
            bossAny.setFrame?.(idleFrame);
          }
        }
      }
    }

    const lowPerfCinematic =
      this.qualityTier === "low" || this.hardFpsEmergencyActive || this.isLowPowerMode;
    const slowMoScale = lowPerfCinematic ? 0.5 : 0.38;
    const slowMoDuration = 2000;
    const finaleDelayMs = 2000;
    const shakeDuration = lowPerfCinematic ? 100 : 180;
    const shakeIntensity = lowPerfCinematic ? (this.isMobile ? 0.003 : 0.004) : (this.isMobile ? 0.006 : 0.009);
    const flashDuration = lowPerfCinematic ? 70 : 130;

    const defeatSfxKey = data.bossType === "elsa_mummo" ? "life_lost" : "boss_defeat";
    utils.safePlaySound(this, defeatSfxKey, { volume: data.isFinalBoss ? 0.72 : 0.62 });
    this.applyDramaticSlowMo(slowMoScale, slowMoDuration);
    this.cameras.main.shake(shakeDuration, shakeIntensity);
    this.cameras.main.flash(flashDuration, 255, 255, 255, true);

    const finalLine = data.finalLine || this.getBossDefeatLine(data.bossType);
    this.showBossDefeatLine(
      finalLine,
      bossAny.x,
      this.groundY - bossHeight * 0.56,
      lowPerfCinematic ? (this.isMobile ? 1200 : 1400) : (this.isMobile ? 1400 : 1600)
    );

    const cam = this.cameras.main;
    const targetZoom = this.isMobile
      ? (lowPerfCinematic ? (data.isFinalBoss ? 1.16 : 1.12) : (data.isFinalBoss ? 1.24 : 1.2))
      : (lowPerfCinematic ? (data.isFinalBoss ? 1.22 : 1.18) : (data.isFinalBoss ? 1.34 : 1.28));
    const focusY = this.groundY - bossHeight * 0.58;
    const targetScroll = this.computeCameraFocusScroll(bossAny.x, focusY, targetZoom);

    if (this.dramaticCameraReturnTimer) {
      this.dramaticCameraReturnTimer.destroy();
      this.dramaticCameraReturnTimer = undefined;
    }
    if (this.dramaticCameraTween) {
      this.dramaticCameraTween.remove();
      this.dramaticCameraTween = undefined;
    }
    this.dramaticCameraTween = this.tweens.add({
      targets: cam,
      zoom: targetZoom,
      scrollX: targetScroll.x,
      scrollY: targetScroll.y,
      duration: lowPerfCinematic ? 1700 : 1900,
      ease: "Sine.InOut",
      onComplete: () => {
        this.dramaticCameraTween = undefined;
      }
    });

    const shouldTriggerPeterKanniRescue =
      data.bossType === "peter_sync" &&
      boss instanceof PeterSync &&
      !this.peterKanniRescueTriggered;

    if (shouldTriggerPeterKanniRescue) {
      this.triggerPeterKanniRescuePhase(boss);
      return;
    }

    if (this.bossDeathFinalizeTimer) {
      this.bossDeathFinalizeTimer.destroy();
      this.bossDeathFinalizeTimer = undefined;
    }
    this.bossDeathFinalizeTimer = this.time.delayedCall(
      finaleDelayMs,
      () => {
      if (!this.sys.isActive()) return;

      this.events.emit("bossDefeated", {
        bossType: data.bossType,
        isFinalBoss: data.isFinalBoss,
        scoreValue: data.scoreValue
      });

      if (this.currentBoss === boss) {
        this.currentBoss = undefined;
      }
      if (boss.active) {
        boss.destroy();
      }

      this.bossDeathSequenceActive = false;
      this.bossDeathFinalizeTimer = undefined;
      }
    );
  }

  private triggerPeterKanniRescuePhase(peterBoss: PeterSync): void {
    this.peterKanniRescueTriggered = true;
    const bossConfig = LevelManager.getBossConfig(Number(this.currentLevel ?? 0));
    const difficulty = normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");
    const midfightVideoUrl = shouldDifficultyShowVideos(difficulty) ? bossConfig?.bossMidfightVideoUrl : undefined;
    const rescueDelayMs = midfightVideoUrl ? 120 : (this.isMobile ? 1050 : 1300);
    const reviveBufferMs = this.isMobile ? 700 : 900;

    this.events.emit("floatingAnnouncement", {
      text: "SPICE BOYS HERÄTTÄÄ PETERIN!",
      duration: 2200
    });
    this.showBossDefeatLine(
      '"SPICE BOYS: EI TÄÄ TÄHÄN LOPU!"',
      peterBoss.x,
      this.groundY - Math.max(120, peterBoss.displayHeight * 0.58),
      1900
    );

    if (midfightVideoUrl) {
      this.events.emit("bossMidfightVideoRequested", {
        bossType: "peter_sync",
        videoUrl: midfightVideoUrl,
        hintText: formatSkipHintLine("SPICE BOYS TULEE - NAPAUTA OHITTAKSESI"),
      });
    }

    this.time.delayedCall(rescueDelayMs, () => {
      if (!this.sys.isActive() || this.levelCompleted || this.player?.isDead) return;
      if (!peterBoss.active) return;

      try {
        const kanniSpawnX = Phaser.Math.Clamp(this.scale.width - 180, 260, this.scale.width - 120);
        this.kanniSupportBoss = new KanniBoss(
          this,
          kanniSpawnX,
          this.groundY,
          this.groundY,
          peterBoss.maxHealth
        );
        this.enemies.add(this.kanniSupportBoss);
        this.kanniSupportBoss.setDepth(GameScene.DEPTH_ENEMIES_BASE + 5);
        peterBoss.activateKanniRescuePhase(this.kanniSupportBoss, 0.5, 0.5);
      } catch (error) {
        console.error("[FinalBossRescueError] Failed to start SPICE BOYS rescue phase.", error);
        this.bossDeathSequenceActive = false;
        const isFinalBoss = LevelManager.isLastLevel(Number(this.currentLevel ?? 0));
        this.events.emit("bossDefeated", {
          bossType: "peter_sync",
          isFinalBoss,
          scoreValue: peterBoss.scoreValue
        });
        if (this.currentBoss === peterBoss) {
          this.currentBoss = undefined;
        }
        if (peterBoss.active) {
          peterBoss.destroy();
        }
        if (this.player && !this.player.isDead) {
          this.player.currentSpeed = this.player.baseSpeed;
          this.player.body?.setEnable(true);
        }
        return;
      }

      this.cameras.main.shake(260, this.isMobile ? 0.006 : 0.009);
      this.cameras.main.flash(160, 255, 40, 120, true);
      utils.safePlaySound(this, "boss_appear", { volume: 0.65 });
      this.events.emit("floatingAnnouncement", {
        text: "SPICE BOYS IS BACK, VAARALLISEMPANA KUIN KOSKAAN! KAIKKI KUOLEE AIKANANSA!",
        duration: 1700
      });

      this.time.delayedCall(reviveBufferMs, () => {
        if (!this.sys.isActive()) return;
        if (this.player && !this.player.isDead) {
          this.player.currentSpeed = this.player.baseSpeed;
          this.player.body?.setEnable(true);
        }
        if (peterBoss.active && !peterBoss.isDead) {
          peterBoss.canAttack = true;
          peterBoss.fsm?.goto("gliding");
        }
        this.bossDeathSequenceActive = false;
        this.bossDeathFinalizeTimer = undefined;
      });
    });
  }

  triggerRageActivationCinematic(): void {
    const now = this.time.now;
    if (now - this.lastRageDramaticFxAt < 900) return;
    this.lastRageDramaticFxAt = now;
    this.applyDramaticSlowMo(0.55, 260);
    this.cameras.main.shake(120, this.isMobile ? 0.004 : 0.006);
    this.playDramaticCameraFocus(
      this.player?.x ?? this.scale.width * 0.28,
      (this.player?.y ?? this.groundY) - 120,
      this.isMobile ? 1.06 : 1.1,
      120,
      70,
      220
    );
  }

  showBossAttackTelegraph(
    kind: "normal" | "charge" | "combo" | "leap" | "barrage" | "super" | "aoe" | "hazard" | "phase",
    attackName?: string
  ): void {
    if (!this.currentBoss || !this.currentBoss.active) return;
    this.clearBossTelegraph();

    const telegraphConfig: Record<string, { width: number; color: number; duration: number }> = {
      normal: { width: 220, color: 0xffcc66, duration: 300 },
      charge: { width: 320, color: 0xffa12e, duration: 460 },
      combo: { width: 250, color: 0xff445f, duration: 360 },
      leap: { width: 280, color: 0x66ddff, duration: 520 },
      barrage: { width: 300, color: 0x66b8ff, duration: 520 },
      aoe: { width: 320, color: 0x66ddff, duration: 560 },
      hazard: { width: 340, color: 0x4fb8ff, duration: 620 },
      phase: { width: 340, color: 0xffe066, duration: 620 },
      super: { width: 380, color: 0xff3333, duration: 700 }
    };
    const selected = telegraphConfig[kind] || telegraphConfig.normal;
    const assistBonusMs = Math.min(700, this.dynamicDifficulty.consecutiveDeaths * 140);
    const textDisplayDuration = selected.duration + 1000 + assistBonusMs;
    const alpha = this.isMobile ? 0.22 : 0.3;
    this.bossTelegraph = this.add.rectangle(
      this.currentBoss.x,
      this.groundY - 4,
      selected.width,
      10,
      selected.color,
      alpha
    );
    this.bossTelegraph.setOrigin(0.5, 1);
    this.bossTelegraph.setDepth(GameScene.DEPTH_EFFECTS - 3);

    if (attackName) {
      this.bossTelegraphLabel = this.add.text(
        this.currentBoss.x,
        this.currentBoss.y - 165,
        attackName,
        {
          fontFamily: "PublicPixel",
          fontSize: "16px",
          color: "#ffe78c",
          stroke: "#000000",
          strokeThickness: 5,
          align: "center"
        }
      );
      this.bossTelegraphLabel.setOrigin(0.5, 1);
      this.bossTelegraphLabel.setDepth(GameScene.DEPTH_EFFECTS + 2);
      this.tweens.add({
        targets: this.bossTelegraphLabel,
        y: this.bossTelegraphLabel.y - 28,
        alpha: 0,
        duration: textDisplayDuration,
        ease: "Sine.Out"
      });
    }

    this.bossTelegraphTween = this.tweens.add({
      targets: this.bossTelegraph,
      alpha: alpha * 1.45,
      scaleX: 1.08,
      yoyo: true,
      repeat: 2,
      duration: kind === "charge" || kind === "super" ? 85 : 70,
      ease: "Sine.InOut"
    });

    this.bossTelegraphClearTimer = this.time.delayedCall(textDisplayDuration, () => {
      this.clearBossTelegraph();
    });
  }

  private updateBossRiskRewardMechanics(time: number): void {
    if (!this.bossRiskRewardEnabled) {
      if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
        this.bossRiskRewardOrb.destroy();
      }
      this.bossRiskRewardOrb = undefined;
      this.nextBossRiskRewardSpawnAt = 0;
      this.bossRiskDamageMultiplier = 1;
      this.bossRiskBuffUntil = 0;
      return;
    }

    if (!this.bossActive || this.bossDefeated || this.player.isDead) {
      if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
        this.bossRiskRewardOrb.destroy();
      }
      this.bossRiskRewardOrb = undefined;
      this.bossRiskDamageMultiplier = 1;
      this.bossRiskBuffUntil = 0;
      return;
    }

    if (this.bossRiskBuffUntil > 0 && time >= this.bossRiskBuffUntil) {
      this.bossRiskBuffUntil = 0;
      this.bossRiskDamageMultiplier = 1;
      this.events.emit("floatingAnnouncement", {
        text: "ADRENALIINI HAIHTUI.",
        duration: 1200
      });
    }

    if (!this.bossRiskRewardOrb && time >= this.nextBossRiskRewardSpawnAt) {
      this.spawnBossRiskRewardOrb();
    }

    if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y - 40,
        this.bossRiskRewardOrb.x,
        this.bossRiskRewardOrb.y
      );
      if (dist <= 72) {
        this.collectBossRiskRewardOrb(time);
      }
    }
  }

  private spawnBossRiskRewardOrb(): void {
    if (!this.currentBoss || !this.currentBoss.active) return;
    const minX = 190;
    const maxX = this.scale.width - 180;
    let centerX = Phaser.Math.Clamp(this.currentBoss.x + Phaser.Math.Between(-220, 220), minX, maxX);
    const midX = this.scale.width * 0.5;
    const noSpawnCenterMargin = 120;
    if (Math.abs(centerX - midX) < noSpawnCenterMargin) {
      centerX = centerX < midX ? midX - noSpawnCenterMargin : midX + noSpawnCenterMargin;
      centerX = Phaser.Math.Clamp(centerX, minX, maxX);
    }
    const orbY = this.groundY - 120;
    const orb = this.add.circle(centerX, orbY, 24, 0x00f5ff, 0.35);
    orb.setStrokeStyle(4, 0xfff16d, 0.95);
    orb.setDepth(GameScene.DEPTH_EFFECTS + 10);
    this.tweens.add({
      targets: orb,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: { from: 0.42, to: 0.18 },
      yoyo: true,
      repeat: -1,
      duration: 280
    });
    this.bossRiskRewardOrb = orb;
    this.events.emit("floatingAnnouncement", {
      text: "RISKIPICKUP: AJA RENGAS LÄPI!",
      duration: 1300
    });
  }

  private collectBossRiskRewardOrb(time: number): void {
    if (!this.bossRiskRewardOrb || !this.bossRiskRewardOrb.active) return;
    this.bossRiskRewardOrb.destroy();
    this.bossRiskRewardOrb = undefined;
    this.bossRiskOrbCollectedCount++;

    // Reward: heal player and chip boss health.
    const heal = Math.max(10, Math.round(this.player.maxHealth * 0.2));
    this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
    const bossAny = this.currentBoss as any;
    if (bossAny && typeof bossAny.takeDamage === "function" && !bossAny.isDead) {
      const chipDamage = Math.max(6, Math.round((bossAny.maxHealth || 900) * 0.03));
      bossAny.takeDamage(chipDamage);
    }

    // Risk: for 8 seconds incoming damage is amplified.
    this.bossRiskDamageMultiplier = 1.45;
    this.bossRiskBuffUntil = time + 8000;
    this.nextBossRiskRewardSpawnAt = time + Phaser.Math.Between(9000, 13000);
    this.events.emit("floatingAnnouncement", {
      text: "ADRENALIINI +20% HP, VAHINKO x1.45",
      duration: 1700
    });
  }
  


  constructor() {
    super({ key: "GameScene" });
  }

  // Track previous score for level transitions
  previousScore: number = 0;

  // Character type - only male character available
  characterType: "male" = "male";
  
  // Tutorial mode flag
  isTutorial: boolean = false;
  
  init(data: { 
    level?: number; 
    totalDistance?: number; 
    enemiesDefeated?: number; 
    score?: number; 
    lives?: number; 
    characterType?: "male";
    isTutorial?: boolean;
    startAtBossFight?: boolean;
    bossRetryDeaths?: number;
    introBridgeShown?: boolean;
  }): void {
    const requestedLevel = data.level || 1;

    // Get level from data and hard-cap level access to official campaign.
    this.currentLevel = Phaser.Math.Clamp(requestedLevel, 1, LevelManager.TOTAL_LEVELS);
    this.isPaused = false;
    this.level2IntroBridgeShown = !!data.introBridgeShown;
    this.nativeFallbackMusicStartInFlight = false;
    this.nativeFallbackRequestToken += 1;
    
    // Level 1 is always treated as tutorial level.
    this.isTutorial = this.currentLevel === 1;
    
    // Only male character is available
    this.characterType = 'male';
    this.totalDistanceTraveled = data.totalDistance || 0;
    this.enemiesDefeated = data.enemiesDefeated || 0;
    this.previousScore = data.score || 0;
    
    // Lives system - use passed lives or starting lives for new game
    this.lives = data.lives !== undefined ? data.lives : livesConfig.startingLives.value;
    this.maxLives = livesConfig.maxLives.value;
    
    // Boss system
    this.isBossLevel = LevelManager.isBossLevel(this.currentLevel);
    this.startAtBossFightOnCreate = !!data.startAtBossFight && this.isBossLevel;
    this.bossRetryDeathsThisLevel = this.startAtBossFightOnCreate
      ? Math.max(0, Math.floor(Number(data.bossRetryDeaths || 0)))
      : 0;
    this.bossDefeated = false;
    this.bossSpawned = false;
    this.bossActive = false;
    this.bossPerfectDodgeRageUsed = false;
    this.level2BossThemeStarted = false;
    this.level3BossThemeStarted = false;
    this.currentBoss = undefined;
    this.kanniSupportBoss = undefined;
    this.peterKanniRescueTriggered = false;
    this.lastBossTelegraphInfo = { kind: "normal", attackName: undefined, at: -99999 };
    this.bossDeathSequenceActive = false;
    if (this.bossDeathFinalizeTimer) {
      this.bossDeathFinalizeTimer.destroy();
      this.bossDeathFinalizeTimer = undefined;
    }
    
    // Get level config from LevelManager
    const difficultyLevel = this.getSelectedDifficultyTier();
    const levelConfig = LevelManager.getLevelConfig(this.currentLevel, difficultyLevel);
    const configuredDistance = Math.max(1, Math.floor(Number(levelConfig.distance) || 0));
    // Tutorial runway is intentionally longer for mechanic testing.
    this.levelDistance = this.isTutorial ? Math.max(1200, configuredDistance) : configuredDistance;
    
    // Reset level state
    this.distanceTraveled = 0;
    this.levelCompleted = false;
    this.clubhouseSpawned = false;
    this.clubhouse = undefined;
    this.resetEnemyTauntPacing();
    
    // Reset enemy spawn counts
    this.spawnedEnemyCounts = {
      families: 0,
      headphoneWalkers: 0,
      drunks: 0,
      proSkiers: 0,
      powerWalkers: 0,
      regularEnemies: 0,
      smokingLadies: 0,
      padelPlayers: 0,
      tennisPlayers: 0
    };
    
    // Reset airtime tracking
    this.airtimeStart = 0;
    this.isInAir = false;
    this.currentAirtimeMultiplier = 1;
    this.lastAirtimeBonusSound = 0;
    this.hasStompedEnemy = false; // Reset stomp tracking for new game
    this.activeRampLanding = undefined;
    this.rampJumpPeakHeight = 0;
    this.rampGlobalCooldownUntil = 0;
    this.rampVolttiBonusAvailable = false;
    this.riskRouteSpawnedThisLevel = false;
    this.lastRiskRouteAt = -99999;
    this.nextBossRiskRewardSpawnAt = 0;
    this.bossRiskBuffUntil = 0;
    this.bossRiskDamageMultiplier = 1;
    this.bossRiskOrbCollectedCount = 0;
    if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
      this.bossRiskRewardOrb.destroy();
    }
    this.bossRiskRewardOrb = undefined;
    
    // Reset stomp combo
    this.stompComboCount = 0;
    this.stompComboMultiplier = 1;
    this.lastStompTime = 0;
    this.stompHitsPerTargetThisAir = new WeakMap();
    this.bossStompReboundLockUntil = 0;
    this.achievementAirtime3sUnlocked = false;
    this.achievementScore100kUnlocked = false;
    this.achievementStompCombo5Unlocked = false;
    
    // Reset session stats only on level 1 (new game)
    if (this.currentLevel === 1) {
      this.sessionStats = {
        totalStomps: 0,
        maxStompCombo: 0,
        longestAirtime: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        powerUpsCollected: 0,
        perfectLandings: 0
      };
      // seenEnemyTypes removed
    }
    
    // Reset weather
    this.currentWeather = "clear";
    this.isSnowstorm = false;
    this.weatherSpeedMultiplier = 1.0;
    this.weatherEnergyDrain = 0;
    this.ambientSnowSpawnTimer = undefined;
    this.ambientAcidSpawnTimer = undefined;
    this.ambientAcidSplashTimer = undefined;
    this.ambientRainSpawnTimer = undefined;
    this.sleetSpawnTimer = undefined;
    this.discoOverlayPulseTimer = undefined;
    this.discoSparkleTimers = [];
    if (this.rhythmWaveTimer) {
      this.rhythmWaveTimer.destroy();
      this.rhythmWaveTimer = undefined;
    }
    if (this.weatherPulseTimer) {
      this.weatherPulseTimer.destroy();
      this.weatherPulseTimer = undefined;
    }
    if (this.safeCameraPresetTween) {
      this.safeCameraPresetTween.remove();
      this.safeCameraPresetTween = undefined;
    }
    if (this.safeCameraPresetResetTimer) {
      this.safeCameraPresetResetTimer.destroy();
      this.safeCameraPresetResetTimer = undefined;
    }
    this.lastSafeCameraPresetAt = -99999;
    this.cinematicColorOverlay = undefined;
    this.cinematicStrobeOverlay = undefined;
    this.cinematicTopGradient = undefined;
    this.cinematicBottomGradient = undefined;
    this.cinematicParallaxBands = [];
    this.cinematicDustMotes = [];
    
    // Reset dynamic difficulty (but keep consecutive deaths)
    this.dynamicDifficulty.performanceScore = 50;
    this.dynamicDifficulty.recentDamageTaken = 0;
    this.dynamicDifficulty.recentKills = 0;
    this.dynamicDifficulty.difficultyMultiplier = 1.0;
    this.dynamicDifficulty.lastAdjustmentTime = 0;
    
    // Get difficulty setting from registry (espoo=easy, vantaa=medium, lahti=hard)
    this.difficultyMultiplier = this.getDifficultyMultiplier(difficultyLevel);
    
    // Reset ghost recording
    this.ghostData = [];
    this.isRecordingGhost = true;
    this.lastGhostRecordTime = 0;
    
    // Reset landmark for new level
    this.landmarkSpawned = false;
    this.levelLandmark = undefined;
    if (this.level4BossTorviBackdrop) {
      this.level4BossTorviBackdrop.destroy();
      this.level4BossTorviBackdrop = undefined;
    }
    this.turkuDecorationSpawnCount = 0;
    
    // Reset Lahti unique landmarks tracking
    this.lahtiLandmarksSpawned = new Set();
    
    // Reset performance optimization counters
    this.frameCounter = 0;
    this.lastParticleTime = 0;
    this.lastDifficultyUpdateTime = 0;
    this.fpsEma = 60;
    this.lastQualityCheckTime = 0;
    this.qualityTier = "high";
    this.particleBudgetMultiplier = 1;
    this.spawnDelayMultiplier = 1;
    this.enemyUpdateStride = 1;
    this.maxFloatingTexts = 10;
    this.optionalEffectsEnabled = true;
    this.hardFpsEmergencyActive = false;
    this.lowFpsSince = 0;
    this.fpsRecoverySince = 0;
    
    // Reset input state on scene restart (prevent stuck buttons)
    this.resetAllGameplayInputState();

    this.resetAdvancedRunSystems();
  }

  create(): void {
    if (this.currentLevel === 2 && !this.level2IntroBridgeShown) {
      this.scene.start("StoryScene", {
        storyKey: "intro",
        nextScene: "GameScene",
        nextSceneData: {
          level: 2,
          totalDistance: this.totalDistanceTraveled,
          enemiesDefeated: this.enemiesDefeated,
          score: this.previousScore,
          lives: this.lives,
          characterType: this.characterType,
          isTutorial: false,
          introBridgeShown: true
        }
      });
      return;
    }

    const profile = (window as any).__laturaivoDeviceProfile;
    
    // Detect mobile device for performance optimization
    this.isMobile = profile?.isMobile || utils.isMobileDevice();
    this.lowEndDevice = !!profile?.isLowEndMobile;
    
    // Detect Low Power Mode (battery saver) from global flag set in index.html
    this.isLowPowerMode = !!profile?.lowPowerMode || !!(window as any).isLowPowerMode;
    this.qualityTier = profile?.qualityTier || this.getInitialQualityTier();
    this.applyQualitySettings(this.qualityTier);
    
    // Apply Low Power Mode specific overrides
    if (this.isLowPowerMode) {
      this.applyLowPowerOptimizations();
    }
    
    // Set ground Y position
    this.groundY = gameConfig.groundY.value;

    // Create groups first
    this.enemies = this.add.group();
    this.enemyMeleeTriggers = this.add.group();
    this.teslas = this.add.group();
    this.jumpRamps = this.add.group();
    this.decorations = this.add.group();
    this.backgrounds = this.add.group();
    this.powerUps = this.add.group();
    this.hazards = this.add.group();
    this.chihuahuas = this.add.group();
    this.nightLights = this.add.group();

    // Create scrolling background
    this.createBackground();
    this.ensureJumpRampTextures();
    
    // Create night lighting overlay for evening atmosphere
    this.createNightLightingOverlay();
    this.createCinematicVisualLayers();

    // Create initial decorations
    this.createInitialDecorations();
    
    // Create initial night lighting (lamp posts)
    this.createInitialNightLighting();

    // Create player
    this.createPlayer();
    this.applyRunModifiersForCurrentLevel();

    // Setup collisions
    this.setupCollisions();

    // Start spawners
    this.startSpawners();
    
    // Setup weather system
    this.setupWeatherSystem();
    this.setupRhythmWaveSpawner();
    this.setupLevelEventMoments();
    
    // Create snowstorm overlay (hidden initially)
    this.createSnowstormOverlay();
    
    // Create ambient snowfall based on level
    this.createAmbientSnowfall();
    
    // Re-apply quality after timers/particle systems exist.
    this.applyQualitySettings(this.qualityTier);

    // Play background music based on current level
    utils.ensureSceneAudioReady(this);
    this.combatSfx?.destroy();
    if (!utils.isMinimalSfxMode()) {
      this.combatSfx = new CombatSfxManager(this);
      this.combatSfx.warmup();
      this.data.set("combatSfxManager", this.combatSfx);
    } else {
      this.combatSfx = undefined;
      this.data.remove("combatSfxManager");
    }

    const startupBossMusicKey = this.startAtBossFightOnCreate && this.isBossLevel
      ? this.getBossMusicKeyForLevel(this.currentLevel)
      : null;
    const musicKey = startupBossMusicKey && this.hasMusicTrack(startupBossMusicKey)
      ? startupBossMusicKey
      : this.getMusicKeyForLevel(this.currentLevel);
    this.currentMusicVolume = 0.48;
    this.level2BossThemeStarted = this.currentLevel === 2 && musicKey === "level_2_boss_theme";
    this.level3BossThemeStarted =
      this.currentLevel === 3 && musicKey === this.resolveLevel3BossThemeKey();
    this.level10BossThemeStarted =
      this.currentLevel === 10 && musicKey === this.getBossMusicKeyForLevel(10);
    this.currentMusicKey = musicKey;
    if (this.cache.audio.exists(musicKey)) {
      this.backgroundMusic = this.sound.add(musicKey, {
        volume: this.currentMusicVolume,
        loop: true
      });
    } else {
      this.backgroundMusic = undefined;
    }
    try {
      console.log(
        `[GameSceneAudio] key=${musicKey} locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)}`
      );
      if (utils.isIOS()) {
        this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
      } else {
        if (this.backgroundMusic) {
          this.backgroundMusic.play();
          this.time.delayedCall(650, () => {
            if (
              this.backgroundMusic &&
              !this.backgroundMusic.isPlaying &&
              !this.sound.mute &&
              !(this.scene as any).isPaused()
            ) {
              this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
            }
          });
        } else if (!this.sound.mute) {
          // Lazy path: no cached Phaser music yet, use HTMLAudio fallback directly.
          this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
        }
      }
    } catch (error) {
      console.error("[GameSceneAudio] Initial background music play failed", error);
      this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
    }
    this.startAudioBootstrap();
    this.installAudioRetryHandlers();
    this.showLevelMusicTitleCard();

    // Launch UI scene with level info
    this.scene.launch("UIScene", { 
      gameSceneKey: this.scene.key,
      currentLevel: this.currentLevel,
      levelDistance: this.levelDistance,
      lives: this.lives,
      maxLives: this.maxLives,
      isBossLevel: this.isBossLevel,
      isTutorial: this.isTutorial
    });
    
    // Launch guided tutorial overlay on level 1.
    if (this.isTutorial) {
      this.scene.launch("TutorialUIScene", {
        gameSceneKey: this.scene.key
      });
    }
    
    // Show ability unlock notifications for new abilities at specific levels
    if (!this.startAtBossFightOnCreate) {
      this.showAbilityUnlockNotification();
    }

    // Setup boss event listeners
    this.setupBossEvents();

    // Boss-life checkpoint: if player died in a boss fight and has lives left,
    // restart directly at boss intro/fight instead of replaying the whole level.
    if (this.startAtBossFightOnCreate && this.isBossLevel) {
      this.time.delayedCall(200, () => {
        if (!this.sys.isActive() || this.levelCompleted || this.player?.isDead || this.bossSpawned) return;
        this.spawnBoss();
      });
    }
    
    // Setup rage event listener - kill all enemies on screen when rage activates
    this.setupRageEvents();
    
    // Setup unified gameplay input listeners.
    this.setupTouchInputListener();
    this.setupKeyboardInputListener();

    // Initialize daily mutator + objectives without pre-run passive selection UI.
    this.time.delayedCall(260, () => {
      if (!this.player || this.player.isDead || this.levelCompleted) return;
      this.requestPreRunLoadoutSelection();
    });
    
    // Start Espoo Douche comedy system
    this.setupEspooDoucheEvents();
    this.setupHumorSystems();
    
    // iOS: Setup visibility change handler for background/foreground transitions
    this.setupiOSBackgroundHandlers();
  }
  
  // iOS background/foreground handling
  private visibilityChangeHandler?: () => void;
  private isPaused: boolean = false;
  private isTouchDevice: boolean = false;
  private keyboardInputHandlers?: {
    keydown: (event: KeyboardEvent) => void;
    keyup: (event: KeyboardEvent) => void;
    blur: () => void;
    visibilitychange: () => void;
  };
  private keyboardInputState: GameplayInputState = createGameplayInputState();
  private touchButtonInputState: GameplayInputState = createGameplayInputState();
  
  setupiOSBackgroundHandlers(): void {
    // Detect touch device
    this.isTouchDevice = utils.isMobileDevice();
    
    // Store reference to handler for cleanup
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // App went to background - auto-pause the game
        if (!this.isPaused && !this.player.isDead && !this.levelCompleted) {
          this.isPaused = true;
          if (!(this.scene as any).isPaused()) {
            this.scene.pause();
          }
          
          // Pause background music
          if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            this.backgroundMusic.pause();
          }
          this.pauseNativeBackgroundMusicFallback();
          
          // Pause all sounds
          this.sound.pauseAll();
          
          console.debug('[GameScene] iOS: Game paused due to background');
        }
      } else {
        // App came to foreground - resume if we auto-paused
        if (this.isPaused && !this.player.isDead && !this.levelCompleted) {
          // Resume the scene
          if ((this.scene as any).isPaused()) {
            this.scene.resume();
          }
          this.isPaused = false;
          this.recoverBackgroundMusicAfterResume("foreground");
          
          console.debug('[GameScene] iOS: Game resumed from background');
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    
    // Also listen for scene shutdown to clean up
    this.events.once('shutdown', () => {
      if (this.visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      }
      if (this.levelMusicTitleCard) {
        this.levelMusicTitleCard.destroy();
        this.levelMusicTitleCard = undefined;
      }
      this.stopAllMusicPlayback({ destroyBackgroundMusic: true });
    });
  }

  private startAudioBootstrap(): void {
    this.stopAudioBootstrap();

    let attempts = 0;
    this.audioBootstrapTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        attempts += 1;
        utils.ensureSceneAudioReady(this);
        if (utils.isIOS()) {
          if (!this.sound.mute && !(this.scene as any).isPaused() && !this.isNativeFallbackMusicPlaying()) {
            this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
          }
          if (!this.isNativeFallbackMusicPlaying() && attempts >= 24) {
            console.error(
              `[GameSceneAudio] bootstrap-timeout locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)} key=${this.currentMusicKey}`
            );
            this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
          }
          if (this.isNativeFallbackMusicPlaying() || attempts >= 24) {
            this.stopAudioBootstrap();
          }
          return;
        }

        if (
          this.backgroundMusic &&
          !this.backgroundMusic.isPlaying &&
          !this.sound.mute &&
          !(this.scene as any).isPaused()
        ) {
          try {
            this.backgroundMusic.play();
          } catch {
            // Keep retrying during bootstrap window.
          }
        }

        if (!this.backgroundMusic?.isPlaying && attempts >= 24) {
          console.error(
            `[GameSceneAudio] bootstrap-timeout locked=${String((this.sound as any).locked)} mute=${String(this.sound.mute)} volume=${String((this.sound as any).volume)} key=${this.currentMusicKey}`
          );
          this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
        }

        if (this.backgroundMusic?.isPlaying || this.isNativeFallbackMusicPlaying() || attempts >= 24) {
          this.stopAudioBootstrap();
        }
      }
    });
  }

  private stopAudioBootstrap(): void {
    if (!this.audioBootstrapTimer) return;
    this.audioBootstrapTimer.destroy();
    this.audioBootstrapTimer = undefined;
  }

  private isNativeFallbackMusicPlaying(): boolean {
    return !!this.nativeFallbackMusic && !this.nativeFallbackMusic.paused && !this.nativeFallbackMusic.ended;
  }

  private resolveAudioUrlFromPack(pack: any, key: string): string | null {
    if (!pack || typeof pack !== "object") return null;
    const sections = Object.values(pack);
    for (const section of sections) {
      const files = Array.isArray((section as any)?.files) ? (section as any).files : [];
      const match = files.find((file: any) => file?.type === "audio" && file?.key === key);
      if (!match) continue;
      const resolved = utils.pickPreferredAudioUrl(match.url);
      if (resolved) return resolved;
    }
    return null;
  }

  private isNativeFallbackRequestValid(token: number): boolean {
    return (
      token === this.nativeFallbackRequestToken &&
      this.sys.isActive() &&
      !(this.scene as any).isPaused() &&
      !this.levelCompleted &&
      !this.player?.isDead
    );
  }

  private startNativeBackgroundMusicWithUrl(
    url: string,
    volume: number,
    requestToken?: number,
    key?: string
  ): void {
    if (!url) return;
    const token = requestToken ?? this.nativeFallbackRequestToken;
    const activeKey = key || this.currentMusicKey;
    if (!this.isNativeFallbackRequestValid(token)) return;

    const targetSrc = (() => {
      try {
        return new URL(url, window.location.href).toString();
      } catch {
        return url;
      }
    })();

    if (this.nativeFallbackMusic) {
      const currentSrc = this.nativeFallbackMusic.src || "";
      const sameSource = currentSrc === targetSrc || currentSrc.endsWith(url);
      this.nativeFallbackMusic.loop = true;
      this.nativeFallbackMusic.volume = utils.applyGameVolume(volume);
      this.nativeFallbackMusic.muted = !!this.sound.mute;

      if (sameSource) {
        this.nativeFallbackMusicKey = activeKey;
        if (this.nativeFallbackMusic.paused && !this.sound.mute && this.isNativeFallbackRequestValid(token)) {
          void this.nativeFallbackMusic.play().catch((error) => {
            console.error("[GameSceneAudioFallback] resume failed", error);
          });
        }
        return;
      }

      this.teardownNativeFallbackMusic();
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = utils.applyGameVolume(volume);
    audio.muted = !!this.sound.mute;
    audio.preload = "auto";
    (audio as any).playsInline = true;
    (audio as any).webkitPlaysInline = true;

    this.nativeFallbackMusic = audio;
    this.nativeFallbackMusicKey = activeKey;
    console.log(`[GameSceneAudioFallback] attempt key=${activeKey} src=${url}`);
    void audio.play().then(() => {
      if (!this.isNativeFallbackRequestValid(token)) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Ignore teardown races.
        }
        return;
      }
      console.log(`[GameSceneAudioFallback] playing key=${activeKey} src=${url}`);
      // Prevent doubled music if Phaser BGM is also audible.
      try {
        if (this.backgroundMusic?.isPlaying) {
          this.backgroundMusic.stop();
        }
      } catch {
        // Ignore stop issues.
      }
    }).catch((error) => {
      if (this.isNativeFallbackRequestValid(token)) {
        console.error("[GameSceneAudioFallback] play failed", error);
      }
    });
  }

  private startNativeBackgroundMusicFallback(key: string, volume: number): void {
    const requestToken = this.nativeFallbackRequestToken;
    if (!this.isNativeFallbackRequestValid(requestToken)) return;
    if (this.nativeFallbackMusicStartInFlight) return;

    if (this.nativeFallbackMusic && this.nativeFallbackMusicKey !== key) {
      // Ensure level transitions don't keep the previous stage track alive.
      this.stopNativeBackgroundMusicFallback();
      this.startNativeBackgroundMusicFallback(key, volume);
      return;
    }

    if (this.nativeFallbackMusic) {
      this.nativeFallbackMusic.muted = !!this.sound.mute;
      this.nativeFallbackMusic.volume = utils.applyGameVolume(volume);
      if (this.nativeFallbackMusic.paused && !this.sound.mute && this.isNativeFallbackRequestValid(requestToken)) {
        void this.nativeFallbackMusic.play().catch((error) => {
          console.error("[GameSceneAudioFallback] resume failed", error);
        });
      }
      return;
    }

    const cachedPack = this.cache.json.get("assetPackFull") || this.cache.json.get("assetPack");
    const cachedUrl = this.resolveAudioUrlFromPack(cachedPack, key);
    if (cachedUrl) {
      this.startNativeBackgroundMusicWithUrl(cachedUrl, volume, requestToken, key);
      return;
    }

    this.nativeFallbackMusicStartInFlight = true;
    const fetchAssetPack = async (): Promise<any | null> => {
      const candidateUrls = ["assets/asset-pack.json", "./assets/asset-pack.json", "/assets/asset-pack.json"];
      for (const candidate of candidateUrls) {
        try {
          const response = await fetch(candidate);
          if (response.ok) return await response.json();
        } catch {
          // Try next candidate URL.
        }
      }
      return null;
    };

    void fetchAssetPack()
      .then((pack) => {
        if (!this.isNativeFallbackRequestValid(requestToken)) return;
        if (!pack) {
          console.error("[GameSceneAudioFallback] Failed to fetch asset pack from all candidate URLs");
          return;
        }
        const url = this.resolveAudioUrlFromPack(pack, key);
        if (!url) {
          console.error(`[GameSceneAudioFallback] URL not found for key=${key}`);
          return;
        }
        this.startNativeBackgroundMusicWithUrl(url, volume, requestToken, key);
      })
      .catch((error) => {
        if (this.isNativeFallbackRequestValid(requestToken)) {
          console.error("[GameSceneAudioFallback] Failed to fetch asset pack", error);
        }
      })
      .finally(() => {
        if (requestToken === this.nativeFallbackRequestToken) {
          this.nativeFallbackMusicStartInFlight = false;
        }
      });
  }

  private pauseNativeBackgroundMusicFallback(): void {
    if (!this.nativeFallbackMusic || this.nativeFallbackMusic.paused) return;
    try {
      this.nativeFallbackMusic.pause();
    } catch {
      // Ignore pause failures.
    }
  }

  private resumeNativeBackgroundMusicFallback(): void {
    const token = this.nativeFallbackRequestToken;
    if (
      !this.nativeFallbackMusic ||
      !this.nativeFallbackMusic.paused ||
      this.sound.mute ||
      !this.isNativeFallbackRequestValid(token)
    ) {
      return;
    }
    void this.nativeFallbackMusic.play().catch(() => undefined);
  }

  private stopNativeBackgroundMusicFallback(): void {
    this.nativeFallbackRequestToken += 1;
    this.nativeFallbackMusicStartInFlight = false;
    this.teardownNativeFallbackMusic();
  }

  private teardownNativeFallbackMusic(): void {
    if (!this.nativeFallbackMusic) return;
    try {
      this.nativeFallbackMusic.pause();
      this.nativeFallbackMusic.currentTime = 0;
    } catch {
      // Ignore teardown issues.
    }
    this.nativeFallbackMusic = undefined;
    this.nativeFallbackMusicKey = undefined;
  }

  public stopAllMusicPlayback(options?: { destroyBackgroundMusic?: boolean }): void {
    const destroyBackgroundMusic = !!options?.destroyBackgroundMusic;
    this.stopAudioBootstrap();
    this.removeAudioRetryHandlers();
    utils.stopKnownMusicByKey(this);

    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.stop();
        if (destroyBackgroundMusic) {
          this.backgroundMusic.destroy();
        }
      } catch {
        // Ignore teardown races during scene transitions.
      }
      if (destroyBackgroundMusic) {
        this.backgroundMusic = undefined;
      }
    }

    this.stopNativeBackgroundMusicFallback();
  }

  public applyGlobalMuteState(muted: boolean): void {
    const nextMuted = !!muted;
    this.sound.mute = nextMuted;

    if (this.nativeFallbackMusic) {
      this.nativeFallbackMusic.muted = nextMuted;
      if (nextMuted) {
        this.pauseNativeBackgroundMusicFallback();
      } else if (!(this.scene as any).isPaused() && this.sys.isActive()) {
        this.resumeNativeBackgroundMusicFallback();
      }
    }

    if (!this.backgroundMusic) return;

    if (nextMuted) {
      if (this.backgroundMusic.isPlaying) {
        this.backgroundMusic.pause();
      }
      return;
    }

    const blockedByState = (this.scene as any).isPaused() || !this.sys.isActive() || this.levelCompleted || this.player?.isDead;
    if (blockedByState) return;

    try {
      this.backgroundMusic.resume();
      if (!this.backgroundMusic.isPlaying) {
        this.backgroundMusic.play();
      }
    } catch {
      // Retry handlers cover eventual recovery.
    }
  }

  private normalizeMusicVolume(volume: number): number {
    if (!Number.isFinite(volume)) return 0.6;
    return Math.max(0, Math.min(1, volume));
  }

  private recoverBackgroundMusicAfterResume(reason: string): void {
    const tryRecover = () => {
      if (this.sound.mute || (this.scene as any).isPaused() || !this.sys.isActive() || this.levelCompleted || this.player?.isDead) {
        return;
      }

      utils.ensureSceneAudioReady(this);
      try {
        this.sound.resumeAll();
      } catch {
        // Ignore transient resume failures and continue recovery.
      }

      try {
        if (this.backgroundMusic) {
          this.backgroundMusic.setVolume(this.currentMusicVolume);
          this.backgroundMusic.resume();
          if (!this.backgroundMusic.isPlaying) {
            this.backgroundMusic.play();
          }
        }
      } catch {
        // Native fallback retry below covers this path.
      }

      this.resumeNativeBackgroundMusicFallback();

      const shouldStartFallback =
        utils.isIOS()
          ? !this.isNativeFallbackMusicPlaying()
          : !this.backgroundMusic?.isPlaying && !this.isNativeFallbackMusicPlaying();
      if (shouldStartFallback) {
        this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
      }
    };

    tryRecover();
    this.time.delayedCall(140, tryRecover);
    this.time.delayedCall(420, tryRecover);
    this.startAudioBootstrap();
    this.installAudioRetryHandlers();
    console.debug(`[GameSceneAudio] recover-after-resume reason=${reason} key=${this.currentMusicKey}`);
  }

  private installAudioRetryHandlers(): void {
    if (this.audioRetryHandlersInstalled) return;
    this.audioRetryHandlersInstalled = true;
    this.audioRetryHandler = () => {
      utils.ensureSceneAudioReady(this);
      if (utils.isIOS()) {
        if (!this.sound.mute && !(this.scene as any).isPaused() && !this.isNativeFallbackMusicPlaying()) {
          this.startNativeBackgroundMusicFallback(this.currentMusicKey, this.currentMusicVolume);
        }
        if (!this.sound.locked) {
          this.removeAudioRetryHandlers();
        }
        return;
      }
      if (
        this.backgroundMusic &&
        !this.backgroundMusic.isPlaying &&
        !this.sound.mute &&
        !(this.scene as any).isPaused()
      ) {
        try {
          this.backgroundMusic.play();
        } catch (error) {
          console.debug("[GameSceneAudio] Retry play failed", error);
          return;
        }
      }
      if (!this.sound.locked) {
        this.removeAudioRetryHandlers();
      }
    };

    const handler = this.audioRetryHandler;
    if (!handler) return;
    window.addEventListener("touchstart", handler, { passive: true, capture: true });
    window.addEventListener("pointerdown", handler, { passive: true, capture: true });
    window.addEventListener("click", handler, { passive: true, capture: true });
    document.addEventListener("visibilitychange", handler, { capture: true });
  }

  private removeAudioRetryHandlers(): void {
    if (!this.audioRetryHandlersInstalled || !this.audioRetryHandler) return;
    const handler = this.audioRetryHandler;
    window.removeEventListener("touchstart", handler, { capture: true });
    window.removeEventListener("pointerdown", handler, { capture: true });
    window.removeEventListener("click", handler, { capture: true });
    document.removeEventListener("visibilitychange", handler, { capture: true });
    this.audioRetryHandler = undefined;
    this.audioRetryHandlersInstalled = false;
  }
  
  togglePause(): void {
    if (this.player.isDead || this.levelCompleted) return;
    
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      if (!(this.scene as any).isPaused()) {
        this.scene.pause();
      }
      this.sound.pauseAll();
      if (this.backgroundMusic) this.backgroundMusic.pause();
      this.pauseNativeBackgroundMusicFallback();
    } else {
      if ((this.scene as any).isPaused()) {
        this.scene.resume();
      }
      this.recoverBackgroundMusicAfterResume("manual-pause-toggle");
    }
  }

  private switchBackgroundMusic(key: string, volume: number = 0.48): void {
    if (!key) return;

    const normalizedVolume = this.normalizeMusicVolume(volume);
    this.currentMusicKey = key;
    this.currentMusicVolume = normalizedVolume;
    this.stopAudioBootstrap();
    const cachedPack = this.cache.json.get("assetPackFull") || this.cache.json.get("assetPack");
    const resolvedFallbackUrl = this.resolveAudioUrlFromPack(cachedPack, key);
    const hasCachedTrack = this.cache.audio.exists(key);

    if (!hasCachedTrack && !resolvedFallbackUrl) {
      console.error(`[GameSceneAudio] Missing music track key=${key}; keeping current track.`);
      this.startAudioBootstrap();
      this.installAudioRetryHandlers();
      return;
    }

    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.stop();
        this.backgroundMusic.destroy();
      } catch {
        // Ignore race conditions while switching tracks.
      }
      this.backgroundMusic = undefined;
    }
    this.stopNativeBackgroundMusicFallback();

    utils.ensureSceneAudioReady(this);
    if (hasCachedTrack) {
      this.backgroundMusic = this.sound.add(key, {
        volume: normalizedVolume,
        loop: true
      });
    } else {
      this.backgroundMusic = undefined;
    }

    const canPlayNow = !this.sound.mute && !(this.scene as any).isPaused() && this.sys.isActive();
    if (!canPlayNow) {
      // Scene/audio can still be transitioning from pause/intro overlays on iOS.
      // Keep bootstrap running so playback starts automatically when ready.
      this.startAudioBootstrap();
      this.installAudioRetryHandlers();
      return;
    }

    try {
      if (utils.isIOS()) {
        if (resolvedFallbackUrl) {
          this.startNativeBackgroundMusicWithUrl(resolvedFallbackUrl, normalizedVolume);
        } else {
          this.startNativeBackgroundMusicFallback(this.currentMusicKey, normalizedVolume);
        }
      } else if (this.backgroundMusic) {
        this.backgroundMusic.play();
        this.time.delayedCall(650, () => {
          if (
            this.backgroundMusic &&
            !this.backgroundMusic.isPlaying &&
            !this.sound.mute &&
            !(this.scene as any).isPaused()
          ) {
            this.startNativeBackgroundMusicFallback(this.currentMusicKey, normalizedVolume);
          }
        });
      } else {
        this.startNativeBackgroundMusicFallback(this.currentMusicKey, normalizedVolume);
      }
    } catch {
      this.startNativeBackgroundMusicFallback(this.currentMusicKey, normalizedVolume);
    }

    this.startAudioBootstrap();
    this.installAudioRetryHandlers();
  }

  private onBossIntroDismissed(level: number): void {
    if (level !== this.currentLevel) return;
    if (!this.isBossLevel || !this.bossActive || this.levelCompleted || this.player?.isDead) return;

    const boss = this.currentBoss as any;
    if (!boss || !boss.active || boss.isDead) return;

    try {
      utils.ensureSceneAudioReady(this);
      this.sound.resumeAll();
      if (this.nativeFallbackMusic) {
        this.nativeFallbackMusic.muted = !!this.sound.mute;
      }
    } catch {
      // Keep boss intro flow robust even if audio wake throws.
    }

    const bossMusicKey = this.getBossMusicKeyForLevel(level);
    if (!bossMusicKey || !this.hasMusicTrack(bossMusicKey)) return;

    if (level === 2) {
      if (this.level2BossThemeStarted) return;
      this.level2BossThemeStarted = true;
    } else if (level === 3) {
      if (this.level3BossThemeStarted) return;
      this.level3BossThemeStarted = true;
    } else if (level === 10) {
      if (this.level10BossThemeStarted) return;
      this.level10BossThemeStarted = true;
    }

    if (this.currentMusicKey === bossMusicKey) return;

    this.switchBackgroundMusic(bossMusicKey, 0.5);
    this.showLevelMusicTitleCard();
  }

  private triggerPerfectDodgeBossRage(data?: { x?: number; y?: number }): void {
    if (!this.isBossLevel || !this.bossActive || this.bossDefeated || this.levelCompleted) return;
    if (!this.player || this.player.isDead) return;

    const boss = this.currentBoss as any;
    if (!boss || !boss.active || boss.isDead) return;
    const firstPerfectDodgeThisBoss = !this.bossPerfectDodgeRageUsed;

    this.openBossCounterWindow("perfectDodge", 1900, "axe", "AVOIN! KIRVES TEKEE KIPEÄÄ!");

    const bossMaxHealth = Math.max(1, Math.floor(Number(boss.maxHealth || 0)));
    const bossCurrentHealth = Math.max(1, Math.floor(Number(boss.health || bossMaxHealth)));
    const percentDamage = Math.max(1, Math.round(bossMaxHealth * 0.3));
    const appliedDamage = Math.min(percentDamage, bossCurrentHealth);

    if (firstPerfectDodgeThisBoss) {
      this.bossPerfectDodgeRageUsed = true;
      this.player.activateRage({ allowDuringBossFight: true, force: true });
    }

    this.events.emit("floatingAnnouncement", {
      text: firstPerfectDodgeThisBoss
        ? "Täydellinen väistö, laturaivo aktivoitu!"
        : "Täydellinen väistö - bossi auki!",
      duration: 2300
    });
    this.showFloatingText(
      Number(data?.x) || this.player.x,
      (Number(data?.y) || this.player.y) - 120,
      "TÄYDELLINEN VÄISTÖ!",
      0x8bff8b,
      1200,
      { force: true }
    );

    this.cameras.main.shake(140, 0.012);
    this.cameras.main.flash(140, 255, 90, 90, true);

    if (!firstPerfectDodgeThisBoss) {
      return;
    }

    if (typeof boss.takeDamage === "function") {
      boss.takeDamage(appliedDamage);
    } else {
      boss.health = Math.max(0, bossCurrentHealth - appliedDamage);
      if (typeof boss.updateHealthBar === "function") {
        boss.updateHealthBar();
      }
      this.events.emit("bossHealthChanged", {
        health: boss.health,
        maxHealth: boss.maxHealth
      });
    }
    this.showDamageNumber(
      Number(boss.x) || this.scale.width * 0.72,
      (Number(boss.y) || this.groundY) - 120,
      appliedDamage
    );
  }

  private hasMusicTrack(key: string): boolean {
    if (!key) return false;
    if (this.cache.audio.exists(key)) return true;

    const cachedPack = this.cache.json.get("assetPackFull") || this.cache.json.get("assetPack");
    return !!this.resolveAudioUrlFromPack(cachedPack, key);
  }

  private resolveLevel3BossThemeKey(): string {
    return this.hasMusicTrack(this.level3BossThemeKey)
      ? this.level3BossThemeKey
      : "level_3_theme";
  }

  private getBossMusicKeyForLevel(level: number): string | null {
    switch (level) {
      case 2:
        return "level_2_boss_theme";
      case 3:
        return this.resolveLevel3BossThemeKey();
      case 4:
        return this.level4BossThemeKey;
      case 5:
        return this.level5BossThemeKey;
      case 6:
        return "level_6_theme";
      case 7:
        return "level_7_theme";
      case 8:
        return "level_8_theme";
      case 9:
        return "level_9_theme";
      case 10:
        return "level_11_theme";
      default:
        return null;
    }
  }
  
  // Combined virtual input state used by the player on touch, mouse, and keyboard.
  touchInputState: GameplayInputState = createGameplayInputState();
  
  setupTouchInputListener(): void {
    // Listen for gameplay input events from UI scene and keyboard bridge.
    this.events.on("touchInput", (data: { type: string; pressed: boolean; source?: "keyboard" | "ui" }) => {
      const inputType = data.type as GameplayInputType;
      if (!(inputType in this.touchInputState)) return;

      if (data.source === "keyboard") {
        this.keyboardInputState[inputType] = data.pressed;
      } else {
        this.touchButtonInputState[inputType] = data.pressed;
      }

      this.touchInputState[inputType] = this.touchButtonInputState[inputType] || this.keyboardInputState[inputType];
      
      // Pass touch state to player
      if (this.player) {
        this.player.touchInputState = this.touchInputState;
      }

      // Achievement: Voltti attempted on ground 10 times.
      if (data.type === "voltti" && data.pressed && this.player && this.player.isOnGround) {
        this.volttiFailCount += 1;
        if (!this.achievementVolttiFailShown && this.volttiFailCount >= 10) {
          this.achievementVolttiFailShown = true;
          void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.hiddenVolttiFail);
          this.events.emit("floatingAnnouncement", {
            text: ACHIEVEMENT_LINES.voltti_fail,
            duration: 2400
          });
        }
      }

      // Small "ohoh" cue when jump is pressed while airborne.
      if (data.type === "jump" && data.pressed && this.player && !this.player.isOnGround) {
        const now = this.time.now;
        if (now - this.lastFailedJumpSfxAt > 700) {
          this.lastFailedJumpSfxAt = now;
          this.sound.play("ui_click_sound", { volume: 0.18, rate: 0.75 });
          this.showFloatingText(this.player.x, this.player.y - 90, "ohoh", 0xffd180, 700);
        }
      }
    });

    this.events.on("skipTutorialRequested", () => {
      if (this.currentLevel !== 1 || this.levelCompleted || this.player?.isDead) return;

      this.levelCompleted = true;
      this.resetAllGameplayInputState();

      this.events.emit("floatingAnnouncement", {
        text: "TUTORIAALI OHITETTU",
        duration: 900
      });

      this.time.delayedCall(120, () => {
        if (!this.player || this.player.isDead) return;
        this.triggerVictory();
      });
    });

    this.events.on("attackPerformed", (data: { attackType: string }) => {
      const attackType = String(data?.attackType || "");
      this.updateWeaponMasteryFromAttack(attackType);
      this.addStylePoints(attackType.startsWith("super") ? 4 : 1);
    });

    this.events.on("trickComplete", () => {
      this.objectiveTricksCompleted += 1;
      this.addStylePoints(9);
      this.updateMicroObjective(this.time.now);
    });
  }

  private resetAllGameplayInputState(): void {
    this.touchButtonInputState = createGameplayInputState();
    this.keyboardInputState = createGameplayInputState();
    this.touchInputState = createGameplayInputState();
    if (this.player) {
      this.player.touchInputState = this.touchInputState;
    }
  }

  private setKeyboardInput(type: GameplayInputType, pressed: boolean): void {
    if (this.keyboardInputState[type] === pressed) return;
    this.events.emit("touchInput", { type, pressed, source: "keyboard" });
  }

  private resetKeyboardInputState(): void {
    (Object.keys(this.keyboardInputState) as GameplayInputType[]).forEach((type) => {
      if (this.keyboardInputState[type]) {
        this.events.emit("touchInput", { type, pressed: false, source: "keyboard" });
      }
    });
  }

  private togglePauseFromKeyboard(): void {
    try {
      const uiScene = this.scene.get("UIScene") as any;
      if (uiScene && typeof uiScene.togglePause === "function") {
        uiScene.togglePause();
        return;
      }
    } catch {
      // Fall back to the local pause path below.
    }

    this.togglePause();
  }

  private toggleMuteFromKeyboard(): void {
    try {
      const uiScene = this.scene.get("UIScene") as any;
      if (uiScene && typeof uiScene.setGlobalMute === "function") {
        uiScene.setGlobalMute(!this.sound.mute);
        return;
      }
    } catch {
      // Fall back to direct scene mute state below.
    }

    this.applyGlobalMuteState(!this.sound.mute);
  }

  setupKeyboardInputListener(): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    this.removeKeyboardInputListener();

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;

      if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
        event.preventDefault();
        this.togglePauseFromKeyboard();
        return;
      }

      if (event.code === "KeyM" && !event.repeat) {
        event.preventDefault();
        this.toggleMuteFromKeyboard();
        return;
      }

      const inputType = KEYBOARD_INPUT_BINDINGS[event.code];
      if (!inputType) return;

      event.preventDefault();
      this.setKeyboardInput(inputType, true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const inputType = KEYBOARD_INPUT_BINDINGS[event.code];
      if (!inputType) return;

      event.preventDefault();
      this.setKeyboardInput(inputType, false);
    };

    const reset = () => this.resetKeyboardInputState();

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", reset, { capture: true });
    document.addEventListener("visibilitychange", reset, { capture: true });

    this.keyboardInputHandlers = {
      keydown: onKeyDown,
      keyup: onKeyUp,
      blur: reset,
      visibilitychange: reset
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeKeyboardInputListener());
  }

  private removeKeyboardInputListener(): void {
    if (typeof window === "undefined" || typeof document === "undefined" || !this.keyboardInputHandlers) {
      return;
    }

    const handlers = this.keyboardInputHandlers;
    window.removeEventListener("keydown", handlers.keydown, { capture: true });
    window.removeEventListener("keyup", handlers.keyup, { capture: true });
    window.removeEventListener("blur", handlers.blur, { capture: true });
    document.removeEventListener("visibilitychange", handlers.visibilitychange, { capture: true });
    this.keyboardInputHandlers = undefined;
    this.resetKeyboardInputState();
  }
	  
	  setupRageEvents(): void {
    this.events.on("rageActivated", () => {
      this.killAllEnemiesOnScreen();
      this.triggerRageActivationCinematic();
      const rageShout = Phaser.Math.RND.pick(PLAYER_SHOUTS);
      this.showFloatingText(this.player.x, this.player.y - 150, rageShout, 0xfff176, 1400, { force: true });

      const now = this.time.now;
      this.rageActivationTimes.push(now);
      this.rageActivationTimes = this.rageActivationTimes.filter((ts) => now - ts <= 15000);

      // "Naapuri meluilmoitus" if rage is spammed.
      if (this.rageActivationTimes.length >= 3) {
        this.events.emit("floatingAnnouncement", {
          text: "Löylyttää kuin Sauna-Timppa naapuriaan!",
          duration: 2200
        });
        this.incrementSarcasm(8);
      }

      if (!this.achievementInstantRageShown && this.lastRageReadyAt > 0 && now - this.lastRageReadyAt <= 1200) {
        this.achievementInstantRageShown = true;
        void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.hiddenInstantRage);
        this.events.emit("floatingAnnouncement", {
          text: ACHIEVEMENT_LINES.instant_rage,
          duration: 2500
        });
      }
    });

    this.events.on("rageGained", (data: { percentage: number }) => {
      if (data.percentage >= 100 && !this.wasRageReady) {
        this.lastRageReadyAt = this.time.now;
      }
      this.wasRageReady = data.percentage >= 100;
    });
    
    // Track damage taken for session stats and dynamic difficulty
    this.events.on("playerHit", (data: { damage: number }) => {
      this.sessionStats.totalDamageTaken += data.damage;
      this.trackDamageForDifficulty(data.damage);
      this.levelDamageTaken += data.damage;
      this.objectiveNoHitBroken = true;
      this.addStylePoints(-12);
      this.updateMicroObjective(this.time.now);

      if (Math.random() < 0.32) {
        const line = Phaser.Math.RND.pick(HIT_REACTIONS);
        this.showFloatingText(this.player.x + Phaser.Math.Between(-60, 60), this.player.y - 120, line, 0xffb347, 1500);
      }
    });

    this.events.on("powerUpCollected", (data?: { type?: string }) => {
      if (data?.type === "cursed") return;
      this.pullaComboCount += 1;
      if (this.pullaComboCount >= 3) {
        this.pullaComboCount = 0;
        this.player.rage = this.player.maxRage;
        this.events.emit("rageGained", {
          currentRage: this.player.rage,
          maxRage: this.player.maxRage,
          percentage: 100
        });
        this.events.emit("floatingAnnouncement", {
          text: "PIZZA-COMBO! ILMAINEN SALAMI-SALAMI-SALAMI-SPRITE VALMIS!",
          duration: 2400
        });
        this.incrementSarcasm(5);
      }
    });
    
    // Voltti area attack - kills all enemies within radius instantly!
    this.events.on("volttiAreaAttack", (data: { x: number; y: number; radius: number }) => {
      this.performVolttiAreaAttack(data.x, data.y, data.radius);
    });

    // "No swearing" achievement is intentionally tongue-in-cheek.
    this.time.delayedCall(120000, () => {
      if (!this.player.isDead && !this.achievementNoSwearShown) {
        this.achievementNoSwearShown = true;
        void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.hiddenNoSwear);
        this.events.emit("floatingAnnouncement", {
          text: ACHIEVEMENT_LINES.no_swear,
          duration: 2300
        });
      }
    });
  }

  incrementSarcasm(_amount: number): void {
    // Sarcasm meter feature has been removed.
  }

  setupHumorSystems(): void {
    // Daily mantra at level start.
    this.time.delayedCall(1200, () => {
      if (this.player.isDead || this.levelCompleted) return;
      const mantra = pickHumorLine(this, MANTRA_LINES, "Ystävän vinkki: pysy la dulla.");
      this.events.emit("floatingAnnouncement", { text: mantra, duration: 2300 });
    });

    // Commentator chatter disabled by request.
    if (this.commentatorTimer) {
      this.commentatorTimer.destroy();
      this.commentatorTimer = undefined;
    }

    const scheduleMiniEvent = (): void => {
      this.humorMiniEventTimer = this.time.delayedCall(Phaser.Math.Between(26000, 38000), () => {
        this.triggerHumorMiniEvent();
        scheduleMiniEvent();
      });
    };
    scheduleMiniEvent();
  }

  triggerCommentatorLine(): void {
    if (this.player.isDead || this.levelCompleted || this.bossActive) return;

    const line = pickHumorLine(this, COMMENTATOR_LINES, "Kommentaattori: jatketaan.");
    this.events.emit("floatingAnnouncement", { text: line, duration: 2100 });
    this.incrementSarcasm(2);
  }

  triggerHumorMiniEvent(): void {
    if (this.player.isDead || this.levelCompleted || this.bossActive) return;
    if (Math.random() < 0.4) return;

    const roll = Phaser.Math.Between(1, 5);
    switch (roll) {
      case 1:
        this.humorEventLiukasSuojatie();
        break;
      case 2:
        this.humorEventSaunavuoro();
        break;
      case 3:
        this.humorEventIlmainenAmpari();
        break;
      case 4:
        this.humorEventKahvitauko();
        break;
      case 5:
      default:
        this.humorEventNpcMyohassa();
        break;
    }
  }

  humorEventLiukasSuojatie(): void {
    this.humorSpeedModifier = 0.8;
    this.humorSpeedModifierUntil = this.time.now + 8000;
    this.events.emit("floatingAnnouncement", {
      text: "MINITAPAHTUMA: LIUKAS SUOJATIE!",
      duration: 2200
    });
    this.incrementSarcasm(4);
  }

  humorEventSaunavuoro(): void {
    this.player.applySpeedBoost(4500, 1.25, 0);
    this.events.emit("floatingAnnouncement", {
      text: "HÄTÄTILA: SAUNAVUORO ALKAA!",
      duration: 2200
    });
    this.incrementSarcasm(3);
  }

  humorEventIlmainenAmpari(): void {
    const lureX = this.player.x + 180;
    this.events.emit("floatingAnnouncement", {
      text: "ILMAINEN ÄMPÄRI! ÄKKIÄ JONOON!!",
      duration: 2200
    });
    this.enemies.children.each((enemy: any) => {
      if (!enemy.active || enemy.isDead) return true;
      const dir = enemy.x < lureX ? 1 : -1;
      enemy.setVelocityX(dir * 200);
      return true;
    });
    this.incrementSarcasm(5);
  }

  humorEventKahvitauko(): void {
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 30);
    const previousSpeed = this.player.currentSpeed;
    this.player.currentSpeed = Math.max(this.player.baseSpeed * 0.7, this.player.currentSpeed * 0.7);
    this.events.emit("floatingAnnouncement", {
      text: "KAHVITAUKO: +ENERGIAA, -VAUHTIA",
      duration: 2200
    });
    this.time.delayedCall(1000, () => {
      if (!this.player || this.player.isDead) return;
      this.player.currentSpeed = Math.max(this.player.currentSpeed, previousSpeed * 0.95);
    });
    this.incrementSarcasm(4);
  }

  humorEventNpcMyohassa(): void {
    this.spawnCityCyclist(this.scale.width + 120);
    this.showFloatingText(this.scale.width - 140, this.groundY - 170, "MYÖHÄSSÄ TAAS!", 0xfff176, 1800);
    this.incrementSarcasm(3);
  }
  
  // Voltti area attack - instant kill all enemies within radius
  performVolttiAreaAttack(centerX: number, centerY: number, radius: number): void {
    let killCount = 0;
    
    this.enemies.children.each((enemy: Phaser.GameObjects.GameObject) => {
      const enemySprite = enemy as Enemy;
      
      if (enemySprite.active && !enemySprite.isDead) {
        // Calculate distance from voltti center
        const dx = enemySprite.x - centerX;
        const dy = enemySprite.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If enemy is within radius, instant kill!
        if (distance <= radius) {
          // Check if this is a boss - bosses take reduced damage
          const isBoss =
            (enemySprite as any) === this.currentBoss ||
            enemySprite instanceof Boss ||
            enemySprite instanceof PeterSync ||
            enemySprite instanceof KanniBoss;
          
          if (isBoss) {
            // Bosses only take 50 damage from voltti
            const resolvedBossVoltti = this.applyPoiseAndDamageModifiers(enemySprite, 50, "voltti", true);
            enemySprite.takeDamage(resolvedBossVoltti);
          } else {
            // Regular enemies get instant killed - VOLTTI TAPPAA!
            const resolvedVoltti = this.applyPoiseAndDamageModifiers(enemySprite, 9999, "voltti", false);
            enemySprite.takeDamage(resolvedVoltti);
          }
          if (isBoss && enemySprite.isDead) {
            this.triggerBossFinisherImpact(enemySprite);
          }
          
          // Dramatic knockback - send enemies flying away from player!
          const knockbackDir = dx >= 0 ? 1 : -1;
          enemySprite.setVelocityX(knockbackDir * 500);
          enemySprite.setVelocityY(-200);
          
          // Register hit for voltti tracking
          this.player.registerVolttiHit(enemySprite);
          
          if (enemySprite.isDead) {
            this.registerEnemyDefeat(enemySprite);
            this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue * 2), this.time.now); // Double points for voltti kills!
            this.restoreHealthOnKill();
            killCount++;
          }
          
          // Add rage on successful voltti hit!
          this.player.addRage(this.player.rageGainPerHit * 2);
        }
      }
      
      return true;
    });
    
    // Screen shake for impact if any enemies were hit
    if (killCount > 0) {
      this.cameras.main.shake(100, 0.015);
      utils.playManagedSound(this, "axe_explosion", { volume: 0.4 });
    }
  }
  
  killAllEnemiesOnScreen(): void {
    // Rage is completely disabled during boss fights - this should never be called
    // but adding a safety check just in case
    if (this.bossActive && !this.bossDefeated) {
      return;
    }
    
    // Kill all active enemies on screen
    let killCount = 0;
    
    this.enemies.children.each((enemy: Phaser.GameObjects.GameObject) => {
      const enemySprite = enemy as Enemy;
      
      if (enemySprite.active && !enemySprite.isDead) {
        // Check if enemy is on screen
        if (enemySprite.x >= -50 && enemySprite.x <= this.scale.width + 50) {
          // Dramatic death effect - fly up and spin!
          enemySprite.setVelocityY(-300);
          enemySprite.setVelocityX(Phaser.Math.Between(-200, 200));
          
          // Force kill the enemy
          enemySprite.health = 0;
          enemySprite.isDead = true;
          enemySprite.isHurting = true;
          
          // Play death animation
          if (enemySprite.playAnimation) {
            enemySprite.playAnimation("enemy_die_anim");
          }
          
          // Add rotation for dramatic effect
          this.tweens.add({
            targets: enemySprite,
            angle: Phaser.Math.Between(-720, 720),
            duration: 800,
            ease: 'Power2'
          });
          
          // Add to score
          this.registerEnemyDefeat(enemySprite);
          this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue * 2), this.time.now); // Double points for rage kills!
          this.restoreHealthOnKill();
          
          killCount++;
          
          // Destroy after animation
          this.time.delayedCall(1000, () => {
            if (enemySprite && enemySprite.active) {
              enemySprite.destroy();
            }
          });
        }
      }
      
      return true;
    });
    
    // BOSS ENRAGES when player uses rage! This is a strategic risk!
    // Using rage against a boss DOUBLES the boss's remaining health!
    if (this.currentBoss && this.currentBoss.active && !this.currentBoss.isDead) {
      // Double the boss's current health (boss feeds on player's rage!)
      const currentHealth = this.currentBoss.health;
      const newHealth = Math.min(currentHealth * 2, this.currentBoss.maxHealth * 2);
      this.currentBoss.health = newHealth;
      
      // Also increase max health if needed for UI display
      if (newHealth > this.currentBoss.maxHealth) {
        this.currentBoss.maxHealth = newHealth;
      }
      
      // Visual effect - boss turns red and grows temporarily!
      this.currentBoss.setTint(0xff0000);
      this.tweens.add({
        targets: this.currentBoss,
        scaleX: this.currentBoss.scaleX * 1.2,
        scaleY: this.currentBoss.scaleY * 1.2,
        duration: 300,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          if (this.currentBoss && this.currentBoss.active) {
            this.currentBoss.clearTint();
          }
        }
      });
      
      // Dramatic screen shake and red flash
      this.cameras.main.shake(400, 0.04);
      this.cameras.main.flash(300, 255, 0, 0, true);
      
      // Show warning text
      this.showBossEnrageWarning();
      
      // Emit event for UI to update boss health bar
      this.events.emit("bossHealthChanged", {
        health: this.currentBoss.health,
        maxHealth: this.currentBoss.maxHealth
      });
    }
    
    // Play combo sound if killed multiple enemies
    if (killCount > 0) {
      utils.playManagedSound(this, "axe_explosion", { volume: 0.6 });
    }
  }
  
  private getInitialQualityTier(): "high" | "medium" | "low" {
    if (this.isLowPowerMode || this.lowEndDevice) return "low";
    if (this.isMobile) return "medium";
    return "high";
  }

  private retuneTimer(timer: Phaser.Time.TimerEvent | undefined, delayMs: number): void {
    if (!timer) return;

    const nextDelay = Math.max(250, Math.floor(delayMs));
    const progress = Phaser.Math.Clamp(timer.getProgress(), 0, 1);

    timer.reset({
      delay: nextDelay,
      callback: timer.callback,
      callbackScope: timer.callbackScope,
      args: timer.args,
      loop: timer.loop,
      repeat: timer.repeat,
      timeScale: timer.timeScale,
      paused: timer.paused,
      // Keep current phase so quality changes don't feel like random spawn jumps.
      startAt: Math.floor(nextDelay * progress),
    });
  }

  private applyQualitySettings(tier: "high" | "medium" | "low"): void {
    this.qualityTier = tier;

    if (tier === "low") {
      this.particleBudgetMultiplier = this.isMobile ? 0.14 : 0.3;
      this.spawnDelayMultiplier = this.isMobile ? 2.1 : 1.6;
      this.enemyUpdateStride = this.isMobile ? 4 : 2;
      this.maxFloatingTexts = this.isMobile ? 2 : 4;
      this.optionalEffectsEnabled = false;
    } else if (tier === "medium") {
      this.particleBudgetMultiplier = this.isMobile ? 0.32 : 0.75;
      this.spawnDelayMultiplier = this.isMobile ? 1.55 : 1.15;
      this.enemyUpdateStride = this.isMobile ? 3 : 1;
      this.maxFloatingTexts = this.isMobile ? 3 : 6;
      this.optionalEffectsEnabled = this.isMobile ? false : true;
    } else {
      this.particleBudgetMultiplier = this.isMobile ? 0.65 : 1;
      this.spawnDelayMultiplier = this.isMobile ? 1.2 : 1;
      this.enemyUpdateStride = this.isMobile ? 2 : 1;
      this.maxFloatingTexts = this.isMobile ? 4 : 10;
      this.optionalEffectsEnabled = this.isMobile ? false : true;
    }

    // Runtime timer tuning (when timers are already created).
    const levelConfig = LevelManager.getLevelConfig(this.currentLevel, this.getSelectedDifficultyTier());
    this.retuneTimer(this.enemySpawnTimer, levelConfig.spawnInterval * this.spawnDelayMultiplier);
    this.retuneTimer(this.teslaSpawnTimer, teslaConfig.spawnInterval.value * this.spawnDelayMultiplier);
    this.retuneTimer(this.rampSpawnTimer, this.getRampSpawnDelayMs() * this.spawnDelayMultiplier);
    const baseDecorationDelay = this.isMobile ? 2500 : 1500;
    this.retuneTimer(this.decorationSpawnTimer, baseDecorationDelay * this.spawnDelayMultiplier);
    this.retuneTimer(this.powerUpSpawnTimer, 8000 * this.spawnDelayMultiplier);
    this.retuneTimer(this.hazardSpawnTimer, 6000 * this.spawnDelayMultiplier);
    this.retuneTimer(this.bossCameoSpawnTimer, this.getBossCameoSpawnDelayMs());

    this.events.emit("qualityChanged", { tier: this.qualityTier });
  }

  private updateAdaptiveQuality(time: number, delta: number): void {
    // Keep low-power mode pinned to low quality.
    if (this.isLowPowerMode && this.qualityTier !== "low") {
      this.applyQualitySettings("low");
    }

    const instantFps = 1000 / Math.max(delta, 1);
    this.fpsEma = this.fpsEma * 0.9 + instantFps * 0.1;
    this.updateHardFpsGovernor(time);

    if (time - this.lastQualityCheckTime < 1800) return;
    this.lastQualityCheckTime = time;

    let targetTier: "high" | "medium" | "low" = this.qualityTier;
    const activeDynamicEntities =
      (this.enemies?.countActive(true) || 0) +
      (this.teslas?.countActive(true) || 0) +
      (this.jumpRamps?.countActive(true) || 0) +
      (this.hazards?.countActive(true) || 0) +
      (this.chihuahuas?.countActive(true) || 0);

    if (this.isMobile || this.lowEndDevice) {
      if (this.fpsEma < 54 || (activeDynamicEntities > 22 && this.fpsEma < 58)) {
        targetTier = "low";
      } else {
        targetTier = "medium";
      }
    } else {
      if (this.fpsEma < 45 || (activeDynamicEntities > 65 && this.fpsEma < 56)) {
        targetTier = "low";
      } else if (this.fpsEma < 56 || (activeDynamicEntities > 45 && this.fpsEma < 60)) {
        targetTier = "medium";
      } else {
        targetTier = "high";
      }
    }

    if (this.isLowPowerMode) {
      targetTier = "low";
    }
    if (this.hardFpsEmergencyActive) {
      targetTier = "low";
    }

    if (targetTier !== this.qualityTier) {
      this.applyQualitySettings(targetTier);
    }
  }

  private updateHardFpsGovernor(time: number): void {
    if (this.fpsEma < this.hardFpsEmergencyThreshold) {
      if (this.lowFpsSince === 0) {
        this.lowFpsSince = time;
      }
      this.fpsRecoverySince = 0;

      if (
        !this.hardFpsEmergencyActive &&
        time - this.lowFpsSince >= this.hardFpsEmergencyHoldMs
      ) {
        this.applyHardFpsEmergencyState(true);
      }
      return;
    }

    this.lowFpsSince = 0;

    if (!this.hardFpsEmergencyActive || this.isLowPowerMode) {
      return;
    }

    if (this.fpsEma >= this.hardFpsRecoveryThreshold) {
      if (this.fpsRecoverySince === 0) {
        this.fpsRecoverySince = time;
      }
      if (time - this.fpsRecoverySince >= this.hardFpsRecoveryHoldMs) {
        this.applyHardFpsEmergencyState(false);
      }
    } else {
      this.fpsRecoverySince = 0;
    }
  }

  private applyHardFpsEmergencyState(enabled: boolean): void {
    if (this.hardFpsEmergencyActive === enabled) return;
    this.hardFpsEmergencyActive = enabled;
    this.lowFpsSince = 0;
    this.fpsRecoverySince = 0;

    if (enabled) {
      this.applyQualitySettings("low");
      this.enemyUpdateStride = Math.max(this.enemyUpdateStride, this.isMobile ? 4 : 3);
      this.maxFloatingTexts = Math.min(this.maxFloatingTexts, this.isMobile ? 2 : 3);
      this.optionalEffectsEnabled = false;

      if (this.currentWeather !== "clear") {
        this.endCurrentWeather();
      }
      if (this.weatherChangeTimer) {
        this.weatherChangeTimer.paused = true;
      }
      if (this.ambientSnowSpawnTimer) {
        this.ambientSnowSpawnTimer.paused = true;
      }
      if (this.ambientAcidSpawnTimer) {
        this.ambientAcidSpawnTimer.paused = true;
      }
      if (this.ambientAcidSplashTimer) {
        this.ambientAcidSplashTimer.paused = true;
      }
      if (this.ambientRainSpawnTimer) {
        this.ambientRainSpawnTimer.paused = true;
      }
      if (this.sunGlareFlashTimer) {
        this.sunGlareFlashTimer.destroy();
        this.sunGlareFlashTimer = undefined;
      }
      if (this.sleetSpawnTimer) {
        this.sleetSpawnTimer.destroy();
        this.sleetSpawnTimer = undefined;
      }
      this.clearWeatherParticles(false);
      this.snowstormOverlay?.setAlpha(0);
      this.frostOverlay?.setAlpha(0);
      if (this.weatherOverlay) {
        this.weatherOverlay.setAlpha(this.isAcidRainLevel() ? 0.12 : this.isKeilaniemiRainLevel() ? 0.08 : 0);
      }
    } else {
      if (this.weatherChangeTimer) {
        this.weatherChangeTimer.paused = false;
      }
      if (this.ambientSnowSpawnTimer) {
        this.ambientSnowSpawnTimer.paused = false;
      }
      if (this.ambientAcidSpawnTimer) {
        this.ambientAcidSpawnTimer.paused = false;
      }
      if (this.ambientAcidSplashTimer) {
        this.ambientAcidSplashTimer.paused = false;
      }
      if (this.ambientRainSpawnTimer) {
        this.ambientRainSpawnTimer.paused = false;
      }
      this.applyQualitySettings(this.getInitialQualityTier());
    }

    this.events.emit("lowFpsEmergency", {
      enabled,
      fps: Math.round(this.fpsEma * 10) / 10
    });
  }

  // Apply optimizations when Low Power Mode is detected (battery saver)
  applyLowPowerOptimizations(): void {
    this.applyQualitySettings("low");
    
    // Disable or reduce ambient effects aggressively in battery saver mode.
    this.clearWeatherParticles(false);
    if (this.ambientRainSpawnTimer) this.ambientRainSpawnTimer.paused = true;
    
    // Reduce camera effects intensity (stop any ongoing shake)
    this.cameras.main.shake(0, 0);
    
    // Notify UI to reduce animations
    this.events.emit("lowPowerMode", { enabled: true });
  }
  
  // Cancel all player power-ups (called when boss fight starts)
  cancelPlayerPowerUps(): void {
    // Cancel speed boost
    if (this.player.hasSpeedBoost) {
      this.player.hasSpeedBoost = false;
      this.player.speedBoostMultiplier = 1.0;
      this.player.speedBoostEndTime = 0;
      this.player.speedBoostEnergyRegen = 0;
    }
    
    // Cancel salmiakki shield
    if (this.player.hasSalmiakkiShield) {
      this.player.hasSalmiakkiShield = false;
      this.player.salmiakkiEndTime = 0;
      this.player.salmiakkiContactDamage = 0;
      this.player.salmiakkiKnockback = 0;
      this.player.isInvulnerable = false;
    }
    
    // Clear any tint from power-ups
    this.player.clearTint();
    
    // Emit event for UI to update power-up indicators
    this.events.emit("powerUpsCancelled");
    
    // Show message to player
    this.showFloatingText(
      this.scale.width / 2,
      this.scale.height / 3,
      "POWER-UPIT POISTETTU!",
      0xff4444,
      2000
    );
  }

  // DEPTH LAYER CONSTANTS for consistent z-ordering
  static readonly DEPTH_BACKGROUND = -20;           // Furthest back - sky/forest
  static readonly DEPTH_DISTANT_LANDMARKS = -15;    // Espoo skyline in distance
  static readonly DEPTH_MID_DECORATIONS = -10;      // Trees behind track
  static readonly DEPTH_TRACK_DECORATIONS = -5;     // Trail markers, snow piles
  static readonly DEPTH_GROUND = 0;                 // Ground level
  static readonly DEPTH_HAZARDS = 5;                // Ice patches, fallen trees
  static readonly DEPTH_RAMPS = 6;                  // Jump ramps
  static readonly DEPTH_POWERUPS = 8;               // Collectibles
  static readonly DEPTH_ENEMIES_BASE = 10;          // Enemies start here, +Y offset
  static readonly DEPTH_PLAYER = 20;                // Player always visible
  static readonly DEPTH_TESLAS = 25;                // Teslas on top of characters
  static readonly DEPTH_CLUBHOUSE = 30;             // Clubhouse very prominent
  static readonly DEPTH_EFFECTS = 100;              // Particles, damage numbers
  static readonly DEPTH_WEATHER = 200;              // Weather overlays on top
  static readonly DEPTH_UI = 300;                   // UI elements on top of everything

  // Get the background key for the current level - Espoo area backgrounds for most levels, Lahti for level 4
  getBackgroundKeyForLevel(level: number): string {
    // Level-specific Espoo neighborhood backgrounds
    const levelBackgrounds: { [key: number]: string } = {
      1: "snowy_forest_background_night",              // Level 1: Night forest
      2: "level_2_background_leppavaara",              // Level 2: Leppävaara
      3: "level_3_background_tapiola",                 // Level 3: Tapiola
      4: "level_4_background_salpausselka_night",      // Level 4: Lahti (night)
      5: "level_5_background_westend",                 // Level 5: Lappi (Lapland theme)
      6: "level_6_background_oulu",                    // Level 6: Oulu
      7: "level_6_background_oulu",                    // Level 7: Oulu
      8: "level_8_background_fuengirola",              // Level 8: Fuengirola
      9: "level_10_background_kantsu",                 // Level 9: Kantsu run before Ice Club arena
      10: "level_10_background_keilaniemi",            // Level 10: Final Keilaniemi run
    };
    
    return levelBackgrounds[level] || "snowy_forest_background";
  }
  
  // Check if current level is the Ice Club Arena (Peter Kantele boss fight)
  isIceClubArenaLevel(): boolean {
    return LevelManager.isIceClubArenaLevel(this.currentLevel);
  }
  
  // Check if current level is Lahti (Level 4) - uses special doping-themed content
  isLahtiLevel(): boolean {
    return this.currentLevel === 4;
  }

  isTurkuLevel(): boolean {
    return this.getLevelLocationNameForLevel(this.currentLevel) === "Turku";
  }

  private shouldUseMirroredBackgroundLoop(): boolean {
    return true;
  }

  private resolveLevel7VehicleKey(): string {
    const key = "level_7_funi_vehicle_v2";
    if (this.isTurkuLevel() && this.textures.exists(key)) {
      return key;
    }
    return "tesla_model_y";
  }

  private resolveClubhouseTextureKey(): string {
    const preferredKeys = this.isLahtiLevel()
      ? ["ravintola_torvi"]
      : this.isIceClubArenaLevel()
        ? ["clubhouse_level_11", "kulttuuritalo", "clubhouse_level_10", "ski_clubhouse"]
        : [`clubhouse_level_${this.currentLevel}`, "clubhouse_level_10", "ski_clubhouse"];

    for (const key of preferredKeys) {
      if (this.textures.exists(key)) return key;
    }

    return "ski_clubhouse";
  }

  private ensureJumpRampTextures(): void {
    const renderer: any = (this.game as any)?.renderer;
    if (!renderer?.blendModes) {
      // Headless test environments don't provide a drawable renderer context.
      // Skip procedural texture generation there; gameplay builds have a renderer.
      return;
    }

    const definitions: Array<{
      key: string;
      width: number;
      height: number;
      bodyColor: number;
      stripeColor: number;
      outlineColor: number;
    }> = [
      {
        key: "jump_ramp_small_texture",
        width: 64,
        height: 32,
        bodyColor: 0xff8844,
        stripeColor: 0xffcc66,
        outlineColor: 0x472812,
      },
      {
        key: "jump_ramp_medium_texture",
        width: 88,
        height: 44,
        bodyColor: 0xff7a3d,
        stripeColor: 0xffbf55,
        outlineColor: 0x472812,
      },
      {
        key: "jump_ramp_large_texture",
        width: 112,
        height: 56,
        bodyColor: 0xff6b2f,
        stripeColor: 0xffb244,
        outlineColor: 0x472812,
      },
    ];

    definitions.forEach((definition) => {
      if (this.textures.exists(definition.key)) return;

      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      const w = definition.width;
      const h = definition.height;
      const points = [new Phaser.Geom.Point(0, h), new Phaser.Geom.Point(w, h), new Phaser.Geom.Point(w, 0)];

      graphics.fillStyle(definition.bodyColor, 1);
      graphics.fillPoints(points, true);

      graphics.fillStyle(definition.stripeColor, 0.95);
      const stripeCount = Math.max(2, Math.floor(w / 24));
      for (let i = 1; i <= stripeCount; i++) {
        const baseX = Math.floor((w / (stripeCount + 1)) * i);
        const topY = Math.max(2, h - Math.floor((h * i) / (stripeCount + 1)) - 2);
        graphics.fillRect(baseX, topY, 4, h - topY - 1);
      }

      graphics.lineStyle(2, definition.outlineColor, 1);
      graphics.strokePoints(points, true);

      graphics.generateTexture(definition.key, w, h);
      graphics.destroy();
    });
  }

  private resolveBackgroundKeyWithFallback(preferredKey: string): string {
    let backgroundKey = preferredKey;
    if (this.textures.exists(backgroundKey)) return backgroundKey;

    let fallbackCandidates: string[] = [];
    if (preferredKey === "ice_club_arena_background") {
      fallbackCandidates = ["clubhouse_level_11", "kulttuuritalo", "level_9_background_espoonlahti", "snowy_forest_background"];
    } else if (this.currentLevel === 9) {
      fallbackCandidates = ["level_10_background_kantsu", "level_10_background_keilaniemi", "snowy_forest_background"];
    } else if (this.currentLevel === 10) {
      fallbackCandidates = ["level_10_background_keilaniemi", "level_10_background_kantsu", "snowy_forest_background"];
    } else if (this.currentLevel === 8) {
      fallbackCandidates = ["level_8_background_otaniemi", "snowy_forest_background"];
    } else {
      fallbackCandidates = ["snowy_forest_background"];
    }

    const fallbackKey = fallbackCandidates.find((candidate) => this.textures.exists(candidate));
    backgroundKey = fallbackKey || "snowy_forest_background";
    console.debug(`Background ${preferredKey} not found, using fallback=${backgroundKey}`);
    return backgroundKey;
  }

  private rebuildScrollingBackground(backgroundKey: string): void {
    this.backgrounds.clear(true, true);

    // First, create a temp image to get the scaled dimensions
    const tempBg = this.add.image(0, 0, backgroundKey);
    tempBg.setOrigin(0, 0);
    utils.initScale(tempBg, { x: 0, y: 0 }, undefined, this.scale.height);
    // Use floor to avoid subpixel gaps during scrolling
    this.scaledBgWidth = Math.floor(tempBg.displayWidth);
    tempBg.destroy();

    // Create multiple background images for seamless scrolling
    // Add extra tiles to ensure full coverage during fast scrolling
    const numBgs = Math.ceil(this.scale.width / this.scaledBgWidth) + 3;
    const shouldAlternateMirroredLoop = this.shouldUseMirroredBackgroundLoop();

    for (let i = 0; i < numBgs; i++) {
      const bg = this.add.image(i * this.scaledBgWidth, 0, backgroundKey);
      bg.setOrigin(0, 0);
      utils.initScale(bg, { x: 0, y: 0 }, undefined, this.scale.height);
      if (shouldAlternateMirroredLoop && i % 2 === 1) {
        bg.setFlipX(true);
      }
      bg.setDepth(GameScene.DEPTH_BACKGROUND);
      this.backgrounds.add(bg);
    }
  }

  createBackground(preferredKey?: string, includeGround: boolean = true): void {
    // Get the appropriate background for this level (or explicit override).
    const requestedKey = preferredKey || this.getBackgroundKeyForLevel(this.currentLevel);
    const backgroundKey = this.resolveBackgroundKeyWithFallback(requestedKey);
    this.rebuildScrollingBackground(backgroundKey);

    // Create a simple ground rectangle (visual only)
    if (includeGround) {
      const groundGraphics = this.add.graphics();
      // Level 4 (Lahti) uses blue-tinted moonlit snow, other levels use bright white day snow
      const groundColor = this.isLahtiLevel() ? 0xdde8f0 : 0xf5f5f5;
      groundGraphics.fillStyle(groundColor, 1);
      groundGraphics.fillRect(0, this.groundY, this.scale.width * 3, this.scale.height - this.groundY);
      groundGraphics.setScrollFactor(0);
      groundGraphics.setDepth(GameScene.DEPTH_GROUND);
    }
  }

  private addLevel4BossTorviBackdrop(): void {
    if (this.level4BossTorviBackdrop) {
      this.level4BossTorviBackdrop.destroy();
      this.level4BossTorviBackdrop = undefined;
    }
    if (!this.textures.exists("ravintola_torvi")) return;

    const backdrop = this.add.image(this.scale.width / 2, this.scale.height / 2, "ravintola_torvi");
    backdrop.setOrigin(0.5, 0.5);
    utils.initScale(backdrop, { x: 0.5, y: 0.5 }, this.scale.width * 1.02, this.scale.height * 1.02);
    backdrop.setScrollFactor(0);
    backdrop.setDepth(GameScene.DEPTH_DISTANT_LANDMARKS);
    backdrop.setAlpha(0.9);
    this.level4BossTorviBackdrop = backdrop;
  }
  
  // ========== NIGHT LIGHTING SYSTEM ==========
  // Creates evening/night atmosphere with lamp posts and glow effects
  
  nightOverlay?: Phaser.GameObjects.Rectangle;
  
  createNightLightingOverlay(): void {
    // Only Level 4 (Lahti) uses night atmosphere - other levels are daytime in Espoo
    if (!this.isLahtiLevel()) {
      return;
    }
    
    // Create a subtle dark blue overlay for night atmosphere
    // This creates the evening/twilight feel
    this.nightOverlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width * 3,
      this.scale.height,
      0x0a1a2f, // Dark blue night color
      0.35 // Subtle transparency - not too dark
    );
    this.nightOverlay.setScrollFactor(0);
    this.nightOverlay.setDepth(GameScene.DEPTH_WEATHER - 1); // Behind weather effects but above game
  }
  
  createInitialNightLighting(): void {
    // Only Level 4 (Lahti) is a night level, but even Lahti has no lamp posts
    // All other Espoo levels are daytime - no night lighting needed
    // Skip night lighting for all levels
    return;
  }
  
  spawnNightLight(x: number): void {
    // 70% chance for lamp post, 30% chance for ground lantern
    const isLampPost = Math.random() < 0.7;
    
    let key: string;
    let maxHeight: number;
    
    if (isLampPost && this.textures.exists("ski_trail_lamp_post")) {
      key = "ski_trail_lamp_post";
      maxHeight = 180; // Tall lamp post
    } else {
      // Ground lantern
      key = Phaser.Math.RND.pick(this.nightLightingKeys.filter(k => k.includes("lantern")));
      if (!this.textures.exists(key)) {
        key = "glowing_trail_lantern_variant_1";
      }
      maxHeight = 50; // Small ground lantern
    }
    
    // Skip if texture doesn't exist
    if (!this.textures.exists(key)) {
      return;
    }
    
    // Create the light fixture
    const light = utils.createDecoration(
      this,
      this.nightLights,
      key,
      x,
      this.groundY,
      maxHeight
    );
    
    // Lamp posts go behind track decorations
    light.setDepth(GameScene.DEPTH_MID_DECORATIONS + 2);
    
    // Add warm glow effect around the light
    this.createLampGlow(x, this.groundY - maxHeight * 0.8, isLampPost);
  }
  
  createLampGlow(x: number, y: number, isLampPost: boolean): void {
    // Create a warm orange glow effect
    const glowSize = isLampPost ? 120 : 60;
    
    const glow = this.add.circle(x, y, glowSize, 0xffa500, 0.15);
    glow.setDepth(GameScene.DEPTH_MID_DECORATIONS + 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    
    // Add to decorations so it scrolls
    this.decorations.add(glow);
    
    // Subtle pulsing animation for warm glow
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.2 },
      duration: 1500 + Phaser.Math.Between(0, 500),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Add a smaller brighter core
    const core = this.add.circle(x, y, glowSize * 0.3, 0xffdd00, 0.25);
    core.setDepth(GameScene.DEPTH_MID_DECORATIONS + 1);
    core.setBlendMode(Phaser.BlendModes.ADD);
    this.decorations.add(core);
    
    // Core also pulses
    this.tweens.add({
      targets: core,
      alpha: { from: 0.2, to: 0.35 },
      duration: 1200 + Phaser.Math.Between(0, 300),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  // Update night lighting - spawn new lamps as player progresses
  updateNightLighting(): void {
    // Night lighting disabled for all levels
    // Level 4 (Lahti) is night but has no lamp posts
    // All other Espoo levels are daytime
    return;
  }
  
  // Spawn the unique landmark for this level on the track
  spawnLevelLandmark(): void {
    if (this.landmarkSpawned) return;
    if (this.shouldSkipTrackLandmarkForLevel(this.currentLevel)) {
      this.landmarkSpawned = true;
      return;
    }
    
    const landmarkConfig = this.levelLandmarks[this.currentLevel];
    if (!landmarkConfig) return;
    
    this.landmarkSpawned = true;
    
    // Spawn landmark off-screen to the right
    const x = this.scale.width + 200;
    
    // Use fallback texture if landmark asset not available
    const textureKey = this.textures.exists(landmarkConfig.key) 
      ? landmarkConfig.key 
      : "espoo_sign"; // Fallback to Espoo sign
    this.levelLandmark = this.add.image(x, this.groundY, textureKey);
    utils.initScale(this.levelLandmark, { x: 0.5, y: 1.0 }, undefined, landmarkConfig.height);
    
    // Landmark is part of the scenery, between decorations and enemies
    this.levelLandmark.setDepth(GameScene.DEPTH_TRACK_DECORATIONS + 1);
    
    // Full opacity - this is on the track, not in distance
    this.levelLandmark.setAlpha(1);
    
    // Add to decorations group so it scrolls with the world
    this.decorations.add(this.levelLandmark);
  }
  
  // Spawn Lahti unique landmarks - each one appears ONCE at specific distance
  checkAndSpawnLahtiLandmarks(): void {
    if (!this.isLahtiLevel()) return;
    
    const progressPercent = this.distanceTraveled / this.levelDistance;
    
    for (const landmark of this.lahtiUniqueLandmarks) {
      // Skip if already spawned
      if (this.lahtiLandmarksSpawned.has(landmark.key)) continue;
      
      // Check if we've reached the spawn point for this landmark
      if (progressPercent >= landmark.spawnAtPercent) {
        this.spawnLahtiLandmark(landmark);
        this.lahtiLandmarksSpawned.add(landmark.key);
      }
    }
  }
  
  // Spawn a single Lahti landmark
  spawnLahtiLandmark(config: { key: string; name: string; height: number }): void {
    // Skip if texture doesn't exist
    if (!this.textures.exists(config.key)) {
      console.debug(`Lahti landmark texture ${config.key} not found, skipping`);
      return;
    }
    
    // Spawn off-screen to the right
    const x = this.scale.width + 200;
    
    const landmark = this.add.image(x, this.groundY, config.key);
    utils.initScale(landmark, { x: 0.5, y: 1.0 }, undefined, config.height);
    
    // Landmarks go slightly behind track but visible
    landmark.setDepth(GameScene.DEPTH_MID_DECORATIONS + 1);
    landmark.setAlpha(0.95);
    
    // Add to decorations group so it scrolls
    this.decorations.add(landmark);
    
    // Show landmark name announcement via UIScene (DOM-based, won't be hidden under combo box)
    this.events.emit("floatingAnnouncement", { text: config.name.toUpperCase(), duration: 2000 });
  }

  private isBossCameoLevel(): boolean {
    // Keep boss fights intact, but remove Månika/Elsa background cameos during normal level gameplay.
    return false;
  }

  private getBossCameoSpawnDelayMs(): number {
    if (!this.isBossCameoLevel()) return Math.floor(12000 * this.spawnDelayMultiplier);
    const baseDelayMs = this.currentLevel === 2 ? 9000 : 9800;
    return Math.floor(baseDelayMs * this.spawnDelayMultiplier);
  }

  private getBossCameoFramePool(): string[] {
    const candidatesByLevel: Record<number, string[]> = {
      2: [
        "karen_boss_idle_R_frame1",
        "karen_boss_idle_R_frame2",
        "karen_boss_walk_R_frame1",
        "karen_boss_walk_R_frame2",
        "karen_boss_attack_R_frame1",
        "karen_boss_attack_R_frame2",
        "karen_boss_taunt_R_frame1",
        "karen_boss_taunt_R_frame2",
      ],
      3: [
        "elsa_boss_idle_R_frame1",
        "elsa_boss_idle_R_frame2",
        "elsa_boss_walk_R_frame1",
        "elsa_boss_walk_R_frame2",
        "elsa_boss_attack_R_frame1",
        "elsa_boss_attack_R_frame2",
      ],
    };

    const candidates = candidatesByLevel[this.currentLevel] || [];
    return candidates.filter((key) => this.textures.exists(key));
  }

  private updateBossBackgroundCameo(cameo: any, time: number, delta: number): void {
    const data = cameo?.__bossCameo;
    if (!data || !cameo.active) return;

    if (time >= data.behaviorUntil) {
      data.behavior = Phaser.Math.RND.pick(["idle", "shuffle", "showoff"]);
      data.behaviorUntil = time + Phaser.Math.Between(700, 2200);
      data.driftDir = Phaser.Math.RND.pick([-1, 1]);
      data.driftSpeed = Phaser.Math.FloatBetween(6, 20);
      data.bobAmplitude = Phaser.Math.FloatBetween(1, 5);
    }

    if (time >= data.nextFrameAt && data.framePool.length > 0) {
      let nextFrame = Phaser.Math.RND.pick(data.framePool);
      if (data.behavior === "showoff") {
        nextFrame = data.framePool[data.framePool.length - 1] || nextFrame;
      }
      cameo.setTexture(nextFrame);
      data.nextFrameAt = time + Phaser.Math.Between(120, 420);
    }

    if (data.behavior === "shuffle") {
      cameo.x += data.driftDir * data.driftSpeed * delta / 1000;
      cameo.setFlipX(data.driftDir < 0);
    } else if (data.behavior === "showoff") {
      cameo.angle = Math.sin((time + data.phaseOffset) * 0.006) * 5;
    } else {
      cameo.angle = 0;
    }

    cameo.y = data.baseY + Math.sin((time + data.phaseOffset) * data.bobFrequency) * data.bobAmplitude;
  }

  private spawnBossBackgroundCameo(): void {
    if (!this.isBossCameoLevel()) return;
    if (this.awaitingLoadoutSelection || this.player?.isDead || this.levelCompleted || this.clubhouseSpawned) return;
    if (this.bossActive || this.bossSpawned || !this.decorations) return;

    const maxActiveCameos = this.isMobile ? 1 : 2;
    const activeCameos = this.decorations.children.entries.filter(
      (entry: any) => entry.active && !!entry.__bossCameo
    ).length;
    if (activeCameos >= maxActiveCameos) return;

    const framePool = this.getBossCameoFramePool();
    if (framePool.length === 0) return;

    const spawnX = this.scale.width + Phaser.Math.Between(180, 460);
    const frame = Phaser.Math.RND.pick(framePool);
    const cameo = this.add.sprite(spawnX, this.groundY, frame);
    const cameoHeight = this.currentLevel === 2
      ? Phaser.Math.Between(92, 116)
      : Phaser.Math.Between(96, 124);
    utils.initScale(cameo, { x: 0.5, y: 1.0 }, undefined, cameoHeight);
    cameo.setDepth(GameScene.DEPTH_MID_DECORATIONS + 2);
    cameo.setAlpha(this.currentLevel === 2 ? 0.72 : 0.78);
    (cameo as any).parallaxMultiplier = 0.62;
    (cameo as any).__bossCameo = {
      framePool,
      baseY: cameo.y,
      behavior: Phaser.Math.RND.pick(["idle", "shuffle", "showoff"]),
      behaviorUntil: this.time.now + Phaser.Math.Between(700, 2100),
      nextFrameAt: this.time.now + Phaser.Math.Between(100, 320),
      driftDir: Phaser.Math.RND.pick([-1, 1]),
      driftSpeed: Phaser.Math.FloatBetween(6, 20),
      bobAmplitude: Phaser.Math.FloatBetween(1, 5),
      bobFrequency: Phaser.Math.FloatBetween(0.003, 0.006),
      phaseOffset: Phaser.Math.Between(0, 1000),
    };

    this.decorations.add(cameo);
  }

  private startBossBackgroundCameoSpawner(): void {
    if (this.bossCameoSpawnTimer) {
      this.bossCameoSpawnTimer.destroy();
      this.bossCameoSpawnTimer = undefined;
    }

    if (!this.isBossCameoLevel()) return;

    this.time.delayedCall(Phaser.Math.Between(800, 1500), () => {
      if (!this.sys.isActive()) return;
      this.spawnBossBackgroundCameo();
    });

    this.bossCameoSpawnTimer = this.time.addEvent({
      delay: this.getBossCameoSpawnDelayMs(),
      callback: () => {
        if (Math.random() < 0.88) {
          this.spawnBossBackgroundCameo();
        }
      },
      loop: true,
    });
  }

  createInitialDecorations(): void {
    // Create some initial decorations scattered across the visible area
    // Mobile: fewer decorations for performance
    const numDecorations = this.isMobile ? 5 : 10;
    for (let i = 0; i < numDecorations; i++) {
      const x = Phaser.Math.Between(100, this.scale.width + 500);
      this.spawnDecoration(x);
    }
  }

  spawnDecoration(x: number): void {
    let key: string;
    if (this.isLahtiLevel()) {
      key = Phaser.Math.RND.pick(this.lahtiDecorationKeys);
    } else if (this.isTurkuLevel()) {
      const shouldSpawnTurkuFeature =
        this.turkuDecorationSpawnCount % this.turkuFeatureSpawnInterval === 0;
      if (shouldSpawnTurkuFeature) {
        const idx =
          Math.floor(this.turkuDecorationSpawnCount / this.turkuFeatureSpawnInterval) %
          this.turkuFeatureDecorationKeys.length;
        key = this.turkuFeatureDecorationKeys[idx];
      } else {
        key = Phaser.Math.RND.pick(this.turkuDecorationKeys);
      }
      this.turkuDecorationSpawnCount += 1;
    } else {
      key = Phaser.Math.RND.pick(this.decorationKeys);
    }
    
    // Fallback to standard decorations if texture doesn't exist
    if (!this.textures.exists(key)) {
      console.debug(`Decoration texture ${key} not found, using fallback`);
      key = Phaser.Math.RND.pick(this.decorationKeys);
      // If still not found, use a guaranteed fallback
      if (!this.textures.exists(key)) {
        key = "spruce_tree_variant_1";
      }
    }
    
    let maxHeight = 180;

    // Adjust height based on decoration type
    if (key.includes("spruce_tree")) {
      maxHeight = 200;
    } else if (key.includes("pine_sapling")) {
      maxHeight = 100;
    } else if (key.includes("trail_marker")) {
      maxHeight = 80;
    } else if (key.includes("snow_pile")) {
      maxHeight = 40;
    } else if (key.includes("wooden_fence")) {
      maxHeight = 60;
    } else if (key.includes("lahti_radio_mast")) {
      // Lahti radio mast - tall landmark
      maxHeight = 300;
    } else if (key.includes("ravintola_torvi")) {
      // Ravintola Torvi - famous Lahti restaurant
      maxHeight = 180;
    } else if (key.includes("lahti_salpausselka")) {
      // Salpausselkä stadium - large structure
      maxHeight = 200;
    } else if (key.includes("lahti_sign")) {
      // Lahti city sign
      maxHeight = 120;
    } else if (key.includes("turku_funicular")) {
      maxHeight = 240;
    } else if (key.includes("turku_aurajoki_bridge")) {
      maxHeight = 130;
    } else if (key.includes("turku_cathedral_landmark")) {
      maxHeight = 270;
    }

    const decoration = utils.createDecoration(
      this,
      this.decorations,
      key,
      x,
      this.groundY,
      maxHeight
    );

    // ========== PARALLAX LAYER SEPARATION ==========
    // Background decorations: slower movement, desaturated, behind gameplay
    // These are NON-INTERACTIVE and clearly visual background elements
    if (key.includes("spruce_tree") || key.includes("pine") || key.includes("lahti_radio") || key.includes("salpausselka")) {
      decoration.setDepth(GameScene.DEPTH_MID_DECORATIONS);
      decoration.setAlpha(0.6); // More transparent for clear background separation
      decoration.setTint(0xaabbcc); // Blue-ish tint for distance/atmosphere
      // Store as background element for slower parallax scrolling
      (decoration as any).isBackgroundElement = true;
      (decoration as any).parallaxMultiplier = 0.6; // Moves 40% slower than foreground
    } else {
      // Foreground decorations: full color, on track level
      decoration.setDepth(GameScene.DEPTH_TRACK_DECORATIONS);
      decoration.setAlpha(1.0);
      (decoration as any).isBackgroundElement = false;
      (decoration as any).parallaxMultiplier = 1.0;
    }
  }

  spawnClubhouse(): void {
    if (this.clubhouseSpawned) return;
    
    this.clubhouseSpawned = true;
    
    // Resolve a valid texture key to avoid Phaser missing-texture placeholder.
    const clubhouseKey = this.resolveClubhouseTextureKey();
    if (!this.textures.exists(clubhouseKey)) {
      console.error(`[Clubhouse] Missing clubhouse texture for level ${this.currentLevel}, skipping spawn.`);
      return;
    }
    
    // Calculate clubhouse size - gets bigger with each level
    const baseHeight = 250;
    const heightIncrease = this.currentLevel * 20;
    const clubhouseHeight = baseHeight + heightIncrease;
    
    // Spawn level-specific clubhouse just off-screen to the right (reduced distance for faster arrival)
    this.clubhouseX = this.scale.width + 100;
    this.clubhouse = this.add.image(this.clubhouseX, this.groundY, clubhouseKey);
    utils.initScale(this.clubhouse, { x: 0.5, y: 1.0 }, undefined, clubhouseHeight);
    this.clubhouse.setDepth(GameScene.DEPTH_CLUBHOUSE);
    
    // Level 4 (Lahti) - Ravintola Torvi gets neon glow for that rowdy dive bar feel!
    if (this.isLahtiLevel()) {
      this.clubhouse.setTint(0xffaaff); // Pink neon tint for Lahti bar
    } else if (this.currentLevel >= 8) {
      this.clubhouse.setTint(0xffd700); // Golden tint for levels 8-10
    } else if (this.currentLevel >= 5) {
      this.clubhouse.setTint(0xffe4b5); // Light gold tint for levels 5-7
    }
    
    // Stop spawning enemies and teslas when clubhouse appears
    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();
    if (this.teslaSpawnTimer) this.teslaSpawnTimer.destroy();
    if (this.rampSpawnTimer) this.rampSpawnTimer.destroy();
    
    // Spawn parked Teslas in front of clubhouse - more teslas at higher levels
    this.spawnParkedTeslas();
  }

  spawnParkedTeslas(): void {
    // Spawn exactly 1 parked car at all levels (simplification)
    const numCars = 1;
    
    // Use tuned cars for Lahti (Level 4). On level 7, replace Tesla with funi.
    const carKey = this.isLahtiLevel() ? "tuned_car_lahti" : this.resolveLevel7VehicleKey();
    
    for (let i = 0; i < numCars; i++) {
      // Cars parked IN FRONT of the clubhouse (to the left of it, closer to player)
      const carX = this.clubhouseX - 150 - (i * 100);
      const parkedCar = this.add.image(carX, this.groundY, carKey);
      const parkedCarHeight = carKey === "level_7_funi_vehicle_v2" ? 160 : 80;
      utils.initScale(parkedCar, { x: 0.5, y: 1.0 }, undefined, parkedCarHeight);
      // Parked cars should be IN FRONT of clubhouse (higher depth)
      parkedCar.setDepth(GameScene.DEPTH_CLUBHOUSE + 1);
      parkedCar.setFlipX(true); // Face left (parked)
      
      // Add to decorations so they scroll
      this.decorations.add(parkedCar);
    }
  }

  createPlayer(): void {
    // Keep player start clearly right of the virtual joystick on touch devices.
    const mobileSpawnX = Phaser.Math.Clamp(Math.floor(this.scale.width * 0.32), 300, 420);
    const playerSpawnX = this.isMobile ? mobileSpawnX : 200;
    this.player = new Player(this, playerSpawnX, this.groundY, this.groundY, this.currentLevel, this.characterType);
    const difficultyLevel = String(this.registry.get("difficulty") || "vantaa");
    const playerHealthMultiplier = this.getPlayerHealthMultiplier(difficultyLevel);
    const adjustedPlayerMaxHealth = Math.max(1, Math.round(this.player.maxHealth * playerHealthMultiplier));
    this.player.maxHealth = adjustedPlayerMaxHealth;
    this.player.health = adjustedPlayerMaxHealth;

    // Tutorial level (level 1): temporarily enable all abilities so the player can
    // practice every core mechanic hands-on in one guided sequence.
    if (this.isTutorial) {
      this.player.currentLevel = Math.max(this.player.currentLevel, 10);
      this.player.energy = this.player.maxEnergy;
      this.player.rage = this.player.maxRage;
      (this.player as any).axeCooldownEndsAt = 0;
      (this.player as any).volttiCooldownEndsAt = 0;
    }
    this.player.setDepth(GameScene.DEPTH_PLAYER);
    
    // Restore score from previous level and reset tricks for new level
    if (this.previousScore > 0) {
      this.player.score = this.previousScore;
    }
    // Reset tricks for new level (max 5 per level)
    this.player.resetTricksForNewLevel();
  }
  
  setupCollisions(): void {
    // Player melee trigger vs enemies
    utils.addOverlap(
      this,
      this.player.meleeTrigger,
      this.enemies,
      (trigger, enemy) => {
        const enemySprite = enemy as Enemy;
        if (this.player.isAttacking && !this.player.currentMeleeTargets.has(enemySprite)) {
          if (enemySprite.isHurting || enemySprite.isDead) return;
          const isFirstMeleeTargetInAttack = this.player.currentMeleeTargets.size === 0;
          this.player.currentMeleeTargets.add(enemySprite);
          
          // Apply knockback - enemies should fall sideways, not fly up
          const knockbackDir = this.player.facingDirection === "right" ? 1 : -1;
          
          // Check current player attack state to scale knockback/damage.
          const playerState = this.player.fsm?.state;
          const currentAnim = this.player.anims.currentAnim?.key;
          const isAxeAttack = currentAnim === "player_axe_attack_anim" || currentAnim === "female_player_axe_attack_anim";
          const isDashAxeAttack = this.player.isPlayingAnimation("player_dash_axe_attack_anim") || playerState === "dashAxeAttacking";
          const isSuperDashAxeAttack = playerState === "superDashAxeAttacking";
          const isAnyAxeAttack = isAxeAttack || isDashAxeAttack || isSuperDashAxeAttack;
          const isSuperPoleFrenzy = playerState === "superPoleFrenzy";
          const isTornadoSpin = playerState === "tornadoSpinning";
          const isSpinKick = this.player.isSpinKicking;
          const isPoleFamilyAttack = !isAnyAxeAttack && !isTornadoSpin && !isSpinKick;
          const isBasicPoleStrike = isPoleFamilyAttack && !isSuperPoleFrenzy;
          const isAirbornePoleOrAxeStrike = !this.player.isOnGround && (isAnyAxeAttack || isPoleFamilyAttack);
          const isBossTarget =
            (enemySprite as any) === this.currentBoss ||
            enemySprite instanceof Boss ||
            enemySprite instanceof PeterSync ||
            enemySprite instanceof KanniBoss;

          if (!isBossTarget && this.tryEnemyEvadeOrFeint(enemySprite)) {
            return;
          }
          
          if (isSuperDashAxeAttack) {
            enemySprite.setVelocityX(knockbackDir * 920);
            enemySprite.setVelocityY(0);
            this.cameras.main.shake(130, 0.016);
            this.time.timeScale = 0.12;
            this.time.delayedCall(45, () => { this.time.timeScale = 1; });
          } else if (isAnyAxeAttack) {
            // MASSIVE sideways knockback for axe - NO upward velocity
            enemySprite.setVelocityX(knockbackDir * 600);
            enemySprite.setVelocityY(0); // No flying up!
            // Bigger screen shake for axe - but not excessive
            this.cameras.main.shake(80, 0.01);
            // FREEZE FRAME for impact!
            this.time.timeScale = 0.15;
            this.time.delayedCall(40, () => { this.time.timeScale = 1; });
          } else if (isTornadoSpin) {
            enemySprite.setVelocityX(knockbackDir * 520);
            enemySprite.setVelocityY(0);
            this.cameras.main.shake(55, 0.007);
          } else if (isSuperPoleFrenzy) {
            enemySprite.setVelocityX(knockbackDir * 420);
            enemySprite.setVelocityY(0);
            this.cameras.main.shake(40, 0.005);
          } else if (isSpinKick) {
            // Strong knockback for spin kick
            enemySprite.setVelocityX(knockbackDir * 450);
            enemySprite.setVelocityY(0); // No flying up!
            this.cameras.main.shake(50, 0.005);
          } else {
            // Normal pole strike - moderate knockback, no flying
            enemySprite.setVelocityX(knockbackDir * 300);
            enemySprite.setVelocityY(0); // No flying up!
            // No screen shake for basic pole strike - reserve for big impacts only
          }
          
          // Flash enemy white on hit
          this.flashSprite(enemySprite);
          
          // Deal damage (with airtime multiplier for aerial attacks!)
          let damage = this.player.getCurrentDamage();
          if (isSuperDashAxeAttack) {
            damage = 220;
          } else if (isAnyAxeAttack) {
            // Axe damage is intentionally fixed to prevent one-shotting bosses.
            damage = 100;
          } else if (isTornadoSpin) {
            damage = 70;
          } else if (isSuperPoleFrenzy) {
            damage = 55;
          } else if (!this.player.isOnGround) {
            damage = Math.floor(damage * this.currentAirtimeMultiplier);
          }
          if (isBossTarget) {
            if (isSuperDashAxeAttack) {
              damage = 150;
            } else if (isAnyAxeAttack) {
              damage = 100;
            } else if (isTornadoSpin) {
              damage = 45;
            } else if (isSuperPoleFrenzy) {
              damage = 40;
            }
          }

          // Requested balance change: aerial pole/axe strikes deal double damage.
          if (isAirbornePoleOrAxeStrike) {
            damage *= 2;
          }
          const masteryWeapon: WeaponMasteryKey = isAnyAxeAttack
            ? "axe"
            : (isTornadoSpin || isSpinKick)
              ? "voltti"
              : "pole";
          damage = Math.max(1, Math.round(damage * this.getWeaponMasteryDamageMultiplier(masteryWeapon)));
          const hitType: "pole" | "axe" | "voltti" | "stomp" = isAnyAxeAttack
            ? "axe"
            : (isTornadoSpin || isSpinKick)
              ? "voltti"
              : "pole";
          if (isBossTarget) {
            damage = this.resolveBossCombatDamage(enemySprite, damage, hitType, {
              isBasicPoleStrike,
              isSuperPoleFrenzy
            }).damage;
          }
          const resolvedDamage = this.applyPoiseAndDamageModifiers(enemySprite, damage, hitType, isBossTarget);
          enemySprite.takeDamage(resolvedDamage);
          if (isBossTarget && enemySprite.isDead) {
            this.triggerBossFinisherImpact(enemySprite);
          }
          
          // Show floating damage number
          this.showDamageNumber(enemySprite.x, enemySprite.y - 50, resolvedDamage);
          
          // Track kills and add score
          if (enemySprite.isDead) {
            this.registerEnemyDefeat(enemySprite);
            this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue), this.time.now);
            this.restoreHealthOnKill();
          }

          if (isBasicPoleStrike && isFirstMeleeTargetInAttack) {
            this.grantPoleHitEnergy(isBossTarget);
            if (isBossTarget) {
              this.restoreHealthFromBossCombatAction("pole");
            }
          }
          
          // Add rage on successful hit!
          this.player.addRage(this.player.rageGainPerHit);
        }
      }
    );

    // Enemy melee triggers vs player
    utils.addOverlap(
      this,
      this.enemyMeleeTriggers,
      this.player,
      (trigger, player) => {
        const zone = trigger as any;
        const enemy = zone.owner as Enemy;
        
        if (enemy && enemy.isAttacking && !enemy.currentMeleeTargets.has(this.player)) {
          enemy.currentMeleeTargets.add(this.player);
          const isBossOwner =
            enemy instanceof Boss ||
            enemy instanceof PeterSync ||
            enemy instanceof KanniBoss;
          if (this.player.isDead) return;
          if (isBossOwner) {
            if (!this.player.canProcessBossAttack?.()) return;
          } else if (this.player.isInvulnerable) {
            return;
          }
          const outgoingDamage = Math.max(
            1,
            Math.round(Number(enemy.damage || 10) * this.runEnemyDamageDealtMultiplier)
          );
          this.player.takeDamage(outgoingDamage, { source: isBossOwner ? "boss" : "generic" });
          this.onEnemySuccessfulHit(enemy, outgoingDamage);
        }
      }
    );

    // Player stomp, voltti attack, and salmiakki contact damage
    utils.addOverlap(
      this,
      this.player,
      this.enemies,
      (player, enemy) => {
        const enemySprite = enemy as Enemy;
        if (enemySprite.isDead) return;
        const isBossTarget =
          (enemySprite as any) === this.currentBoss ||
          enemySprite instanceof Boss ||
          enemySprite instanceof PeterSync ||
          enemySprite instanceof KanniBoss;

        // After far rebound from a boss stomp, briefly ignore boss contact to prevent
        // immediate re-stomping while the boss is still overlapping the player.
        if (isBossTarget && this.time.now < this.bossStompReboundLockUntil) {
          return;
        }
        
        // ========== VOLTTI ATTACK ==========
        // If player is performing a voltti (flip), damage enemies on contact!
        // VOLTTI IS INSTANT KILL FOR REGULAR ENEMIES, but bosses are immune!
        if (this.player.canHitWithVoltti(enemySprite)) {
          // Register this enemy as hit by voltti
          this.player.registerVolttiHit(enemySprite);
          
          // Check if this is a boss - bosses are immune to voltti instant kill!
          const isBoss = isBossTarget;
          
          // Apply damage - regular enemies get one-hit killed, bosses take reduced damage
          let volttiDamage: number;
          if (isBoss) {
            // Bosses only take 50 damage from voltti
            volttiDamage = 50;
          } else {
            // Regular enemies get instant killed - VOLTTI TAPPAA!
            volttiDamage = 9999;
          }
          if (isBossTarget) {
            volttiDamage = this.resolveBossCombatDamage(enemySprite, volttiDamage, "voltti").damage;
          }
          const resolvedVolttiDamage = this.applyPoiseAndDamageModifiers(enemySprite, volttiDamage, "voltti", isBossTarget);
          enemySprite.takeDamage(resolvedVolttiDamage);
          if (isBossTarget && enemySprite.isDead) {
            this.triggerBossFinisherImpact(enemySprite);
          }
          
          // Dramatic knockback - send enemies flying!
          const knockbackDir = this.player.facingDirection === "right" ? 1 : -1;
          enemySprite.setVelocityX(knockbackDir * 500);
          enemySprite.setVelocityY(-200);
          
          // Screen shake for impact
          this.cameras.main.shake(100, 0.01);
          
          // Play impact sound
          utils.playManagedSound(this, "axe_explosion", { volume: 0.4 });

          if (Math.random() < 0.35) {
            const dodgeLine = Phaser.Math.RND.pick(DODGE_LINES);
            this.showFloatingText(this.player.x + 40, this.player.y - 120, dodgeLine, 0xa5d6a7, 1200);
          }
          
          if (enemySprite.isDead) {
            this.registerEnemyDefeat(enemySprite);
            this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue * 2), this.time.now); // Double points for voltti kills!
            this.restoreHealthOnKill();
          }
          
          // Add rage on successful voltti hit!
          this.player.addRage(this.player.rageGainPerHit * 2);
          
          return; // Don't also count as stomp
        }
        
        // ========== SALMIAKKI SHIELD CONTACT DAMAGE ==========
        // If player has salmiakki shield, damage enemies on contact!
        if (this.player.hasSalmiakkiShield && this.player.salmiakkiContactDamage > 0) {
          // Apply damage
          const shieldDamage = isBossTarget
            ? this.resolveBossCombatDamage(enemySprite, this.player.salmiakkiContactDamage, "pole", {
                isShieldContact: true
              }).damage
            : this.player.salmiakkiContactDamage;
          const resolvedShieldDamage = this.applyPoiseAndDamageModifiers(
            enemySprite,
            shieldDamage,
            "pole",
            isBossTarget
          );
          enemySprite.takeDamage(resolvedShieldDamage);
          if (isBossTarget && enemySprite.isDead) {
            this.triggerBossFinisherImpact(enemySprite);
          }
          
          // Knock enemy away with salmiakki power!
          const knockbackDir = this.player.x < enemySprite.x ? 1 : -1;
          enemySprite.setVelocityX(knockbackDir * this.player.salmiakkiKnockback);
          enemySprite.setVelocityY(-150);
          
          // Play impact sound
          utils.playManagedSound(this, "combo_hit", { volume: 0.4 });
          
          if (enemySprite.isDead) {
            this.registerEnemyDefeat(enemySprite);
            this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue), this.time.now);
            this.restoreHealthOnKill();
          }
          
          return; // Don't also count as stomp
        }
        
        // ========== STOMP ATTACK ==========
        if (this.player.isFalling()) {
          const playerBottom = this.player.body.bottom;
          const enemyTop = enemySprite.body.top;
          const enemyCenter = enemySprite.body.center.y;
          
          if (playerBottom <= enemyCenter && playerBottom >= enemyTop - 20) {
            const sameTargetStompCount = this.stompHitsPerTargetThisAir.get(enemySprite) || 0;
            const maxSameTargetStomps = this.maxStompsPerSameTargetPerAir;
            if (sameTargetStompCount >= maxSameTargetStomps) {
              this.applyFarStompRebound(enemySprite, isBossTarget);
              return;
            }
            this.stompHitsPerTargetThisAir.set(enemySprite, sameTargetStompCount + 1);

            // ========== STOMP COMBO SYSTEM ==========
            this.stompComboCount++;
            this.stompComboMultiplier = Math.min(this.stompComboCount, this.maxStompComboMultiplier);
            this.lastStompTime = this.time.now;
            
            // Track session stats
            this.sessionStats.totalStomps++;
            void GameCenterAchievementManager.recordStomp();
            if (this.stompComboCount > this.sessionStats.maxStompCombo) {
              this.sessionStats.maxStompCombo = this.stompComboCount;
            }
            if (!this.achievementStompCombo5Unlocked && this.sessionStats.maxStompCombo >= 5) {
              this.achievementStompCombo5Unlocked = true;
              void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.stompCombo5);
            }
            
            // Calculate combo damage - each consecutive stomp deals more damage!
            let comboDamage = Math.floor(this.player.stompDamage * (1 + (this.stompComboMultiplier - 1) * 0.5));
            if (isBossTarget) {
              comboDamage = this.resolveBossCombatDamage(enemySprite, comboDamage, "stomp").damage;
            }
            const resolvedComboDamage = this.applyPoiseAndDamageModifiers(enemySprite, comboDamage, "stomp", isBossTarget);
            enemySprite.takeDamage(resolvedComboDamage);
            if (isBossTarget && enemySprite.isDead) {
              this.triggerBossFinisherImpact(enemySprite);
            }
            this.sessionStats.totalDamageDealt += resolvedComboDamage;
            
            enemySprite.setVelocityY(-100); // Enemy pops up slightly
            
            this.player.performStompBounce();
            if (isBossTarget) {
              this.restoreHealthFromBossCombatAction("stomp");
            }
            if (isBossTarget) {
              // Boss-specific anti-juggle: create brief separation immediately on first stomp
              // so the player cannot remain stacked on top while boss tracks horizontally.
              this.bossStompReboundLockUntil = this.time.now + 420;
              const knockDir = this.player.x < enemySprite.x ? 1 : -1;
              enemySprite.setVelocityX(knockDir * 280);
              (enemySprite as any).pauseChaseFor?.(360);
            }
            
            // Activate ilmalento bonus after stomp - reset airtime to start counting from stomp moment
            if (!this.hasStompedEnemy) {
              this.hasStompedEnemy = true;
              this.airtimeStart = this.time.now; // Start airtime bonus from stomp moment
            }
            
            // Calculate combo score bonus
            const comboScoreMultiplier = 1 + (this.stompComboMultiplier - 1) * 0.25;
            
            if (enemySprite.isDead) {
              this.registerEnemyDefeat(enemySprite);
              const comboScore = Math.floor(enemySprite.scoreValue * comboScoreMultiplier);
              this.player.addScore(this.applyRunScoreMultiplier(comboScore), this.time.now);
              this.restoreHealthOnKill();
            }
            
            // Add rage on successful stomp!
            this.player.addRage(this.player.rageGainPerStomp);
            
            // Emit stomp combo event for UI
            this.events.emit("stompCombo", {
              comboCount: this.stompComboCount,
              multiplier: this.stompComboMultiplier,
              damage: resolvedComboDamage
            });
            
            // Show stomp visual effect
            this.showStompEffect(enemySprite.x, enemySprite.y);

            if (resolvedComboDamage >= 70) {
              const critLine = Phaser.Math.RND.pick(CRIT_LINES);
              this.showFloatingText(enemySprite.x, enemySprite.y - 95, critLine, 0xfff176, 1300);
            }
            
            // Play sound with pitch variation based on combo + random variation
            const basePitch = 1 + (this.stompComboCount - 1) * 0.1;
            const randomVariation = (Math.random() - 0.5) * 0.2;
            const pitch = Math.min(basePitch + randomVariation, 1.6);
            const detune = (Math.random() - 0.5) * 80; // Random detune for variation
            utils.playManagedSound(this, "pole_strike", {
              volume: 0.4,
              rate: pitch,
              detune: detune,
              pitchVariation: 0,
              detuneVariation: 0
            });
            
            // Screen shake intensity increases with combo
            const shakeIntensity = 0.005 + this.stompComboCount * 0.002;
            this.cameras.main.shake(100, Math.min(shakeIntensity, 0.02));
            
            return; // Don't also count as contact damage
          }
        }
        
        // ========== CONTACT DAMAGE (PASS-THROUGH) ==========
        // Player passes through enemies but takes damage on contact
        // Attacking enemies deal 15% damage, walking enemies deal 2% damage
        // Only applies if none of the above special cases triggered
        // Check if this is a boss - bosses still block and deal full damage
        const isBoss = isBossTarget;
        
        if (!isBoss && !this.player.isInvulnerable && !this.player.isDead) {
          // Attacking enemies deal 15% damage, walking enemies deal 2% damage
          const baseDamagePercent = enemySprite.isAttacking ? 0.15 : 0.02;
          const baseContactDamage = Math.floor(this.player.maxHealth * baseDamagePercent);
          if (baseContactDamage > 0) {
            const finalContactDamage = Math.max(
              1,
              Math.round(baseContactDamage * this.runEnemyDamageDealtMultiplier)
            );
            this.player.takeDamage(finalContactDamage);
            this.onEnemySuccessfulHit(enemySprite, finalContactDamage);
          }
        }
      }
    );

    // Player vs road vehicles (Tesla/tuned car/funi replacement) - deals 25% of max health damage
    utils.addOverlap(
      this,
      this.player,
      this.teslas,
      (player, tesla) => {
        if (this.player.isDead || this.levelCompleted || this.player.isInvulnerable) return;
        
        // Play crash sound
        this.sound.play("tesla_crash", { volume: 0.5 });
        
        // Deal 25% of max health as damage
        const vehicleCollisionDamage = Math.floor(this.player.maxHealth * 0.25);
        this.player.takeDamage(vehicleCollisionDamage);
        
        // Strong knockback from Tesla
        this.player.setVelocityX(-300);
        this.player.setVelocityY(-200);
        
        // Extra screen shake for Tesla hit
        this.cameras.main.shake(200, 0.03);
      }
    );

    // Teslas vs enemies (comedic chaos)
    // BOSSES ARE IMMUNE TO TESLA HITS! They simply ignore the car.
    utils.addOverlap(
      this,
      this.teslas,
      this.enemies,
      (tesla, enemy) => {
        const enemySprite = enemy as Enemy;
        const teslaSprite = tesla as Tesla;
        
        // BOSSES ARE IMMUNE TO TESLAS! Boss doesn't care about fancy electric cars.
        const isBoss =
          (enemySprite as any) === this.currentBoss ||
          enemySprite instanceof Boss ||
          enemySprite instanceof PeterSync ||
          enemySprite instanceof KanniBoss;
        if (isBoss) {
          // Boss just laughs at the Tesla and pushes it aside
          teslaSprite.setVelocityX(teslaSprite.direction * -200); // Tesla bounces off boss!
          this.cameras.main.shake(100, 0.01);
          return;
        }
        
        if (!enemySprite.isDead) {
          // Exaggerated knockback into snowbank
          enemySprite.setVelocityX(teslaSprite.direction * 500);
          enemySprite.setVelocityY(-300);
          enemySprite.takeDamage(100); // Instant kill
          
          if (enemySprite.isDead) {
            this.registerEnemyDefeat(enemySprite);
            this.player.addScore(this.applyRunScoreMultiplier(enemySprite.scoreValue * 2), this.time.now);
            this.restoreHealthOnKill();
          }
        }
      }
    );
  }

  private getRampSpawnDelayMs(): number {
    if (this.currentLevel >= 10) return 6400;
    if (this.currentLevel >= 7) return 7100;
    if (this.currentLevel >= 4) return 7800;
    return GameScene.RAMP_BASE_SPAWN_DELAY_MS;
  }

  private getProgressiveBaseEnemyMultiplier(): number {
    const totalLevelSpan = Math.max(1, LevelManager.TOTAL_LEVELS - 1);
    const levelProgress = Phaser.Math.Clamp((this.currentLevel - 1) / totalLevelSpan, 0, 1);
    // Level 1 baseline -> level 10 has exactly +100% baseline enemy budget.
    return Phaser.Math.Linear(1, 2, levelProgress);
  }

  startSpawners(): void {
    // Get level-specific spawn interval
    const levelConfig = LevelManager.getLevelConfig(this.currentLevel, this.getSelectedDifficultyTier());
    const spawnScale = this.spawnDelayMultiplier;
    
    // Enemy spawner with level-specific interval
    this.enemySpawnTimer = this.time.addEvent({
      delay: Math.floor(levelConfig.spawnInterval * spawnScale),
      callback: () => this.spawnRandomEnemy(),
      loop: true
    });

    // Tesla spawner - only if level has tesla chance > 0
    if (levelConfig.teslaChance > 0) {
      this.teslaSpawnTimer = this.time.addEvent({
        delay: Math.floor(teslaConfig.spawnInterval.value * spawnScale),
        callback: () => {
          if (Math.random() < levelConfig.teslaChance) {
            this.spawnTesla();
          }
        },
        loop: true
      });
    }

    // Jump ramp spawner for all levels; boss fight startup stops spawners immediately.
    this.rampSpawnTimer = this.time.addEvent({
      delay: Math.floor(this.getRampSpawnDelayMs() * spawnScale),
      callback: () => this.spawnJumpRamp(),
      loop: true,
    });

    // Decoration spawner (slower on mobile for performance)
    this.decorationSpawnTimer = this.time.addEvent({
      delay: Math.floor((this.isMobile ? 2500 : 1500) * spawnScale),
      callback: () => this.spawnDecoration(this.scale.width + 100),
      loop: true
    });
    
    // Landmark spawner (less frequent, every ~200m traveled)
    // Level landmark spawner - spawn the unique landmark for this level
    // Spawn at 40% of level distance for good timing
    this.landmarkSpawnTimer = this.time.addEvent({
      delay: 3000, // Check every 3 seconds
      callback: () => {
        // Spawn landmark at approximately 40% of level distance
        if (!this.landmarkSpawned && this.distanceTraveled >= this.levelDistance * 0.4) {
          this.spawnLevelLandmark();
        }
      },
      loop: true
    });
    
    // Power-up spawner
    this.powerUpSpawnTimer = this.time.addEvent({
      delay: Math.floor(8000 * spawnScale),
      callback: () => this.spawnPowerUp(),
      loop: true
    });
    
    // Hazard spawner
    this.hazardSpawnTimer = this.time.addEvent({
      delay: Math.floor(6000 * spawnScale),
      callback: () => {
        this.spawnHazard();
        this.spawnChihuahua();
      },
      loop: true
    });
    
    // Setup power-up and hazard collisions
    this.setupPowerUpCollisions();
    this.setupHazardCollisions();
    this.setupJumpRampCollisions();
    this.startBossBackgroundCameoSpawner();
  }
  


  // Check if there's already an enemy too close to spawn position
  isSpawnPositionClear(x: number, minDistance: number = 100): boolean {
    let isClear = true;
    this.enemies.children.each((enemy: any) => {
      if (enemy.active && Math.abs(enemy.x - x) < minDistance) {
        isClear = false;
      }
      return true;
    });
    return isClear;
  }

  spawnRandomEnemy(context: EnemySpawnContext = {}): any | undefined {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned) return undefined;
    
    const levelConfig = LevelManager.getLevelConfig(this.currentLevel, this.getSelectedDifficultyTier());
    let x = this.scale.width + Phaser.Math.Between(100, 300);
    
    const enemyPressure = this.routeEnemyPressure;
    const level4SpawnBoost = this.currentLevel === 4 ? 1.24 : 1;
    const effectiveEnemyPressure = enemyPressure * level4SpawnBoost;

    // DYNAMIC DIFFICULTY + QUALITY TIER: cap active enemies by device capability.
    const qualityEnemyPenalty = this.qualityTier === "low" ? 2 : this.qualityTier === "medium" ? 1 : 0;
    const level1BaseMaxEnemies = this.isMobile ? 3 : 6;
    const baseMaxEnemies = Math.round(
      level1BaseMaxEnemies * this.getProgressiveBaseEnemyMultiplier()
    ) - qualityEnemyPenalty;
    const difficultyAdjustedMax = Math.floor(baseMaxEnemies * this.dynamicDifficulty.difficultyMultiplier);
    const maxCap = this.qualityTier === "low" ? (this.isMobile ? 5 : 10) : this.isMobile ? 6 : 15;
    const level4ActiveBonus = this.currentLevel === 4 ? 1 : 0;
    const maxActiveEnemies = Math.max(
      2,
      Math.min(
        maxCap,
        Math.floor(difficultyAdjustedMax * effectiveEnemyPressure * this.runEnemySpawnMultiplier) + level4ActiveBonus
      )
    ); // Clamp between 2-6 (mobile) or 2-15 (desktop)
    
    // Limit active enemies on screen to prevent overwhelming the player
    const activeEnemies = this.enemies.children.entries.filter((e: any) => e.active && !e.isDead).length;
    if (!context.bypassPopulationCap && activeEnemies >= maxActiveEnemies) return undefined;
    
    // DYNAMIC DIFFICULTY: Skip spawn chance if player is struggling
    const lowDifficultySkipChance = this.currentLevel === 4 ? 0.08 : 0.3;
    if (!context.bypassSpawnThrottle && this.dynamicDifficulty.difficultyMultiplier < 0.8 && Math.random() < lowDifficultySkipChance) {
      return undefined;
    }

    if (!context.bypassSpawnThrottle && effectiveEnemyPressure < 1 && Math.random() > effectiveEnemyPressure) return undefined;
    if (effectiveEnemyPressure > 1 && Math.random() < Math.min(0.24, (effectiveEnemyPressure - 1) * 0.3)) {
      // Extra pressure day/route: allow a second pass-through into spawn selection.
    }

    // Additional spawn throttling in low quality modes to protect frame time.
    if (!context.bypassSpawnThrottle && this.qualityTier === "low" && Math.random() < (this.currentLevel === 4 ? 0.22 : 0.35)) return undefined;
    if (!context.bypassSpawnThrottle && this.qualityTier === "medium" && Math.random() < (this.currentLevel === 4 ? 0.06 : 0.12)) return undefined;
    
    // Check if spawn position is clear, try alternative positions if not
    if (!this.isSpawnPositionClear(x, 80)) {
      // Try a few alternative positions
      for (let attempt = 0; attempt < 3; attempt++) {
        x = this.scale.width + Phaser.Math.Between(150, 400);
        if (this.isSpawnPositionClear(x, 80)) break;
      }
      // If still not clear after 3 attempts, skip this spawn
      if (!this.isSpawnPositionClear(x, 60)) return undefined;
    }
    
    // All possible enemy types with weights for balanced spawning
    // Higher weight = more likely to spawn
    // minLevel values spread across all 10 levels for gradual introduction of new enemies
    const allEnemyTypes: { type: string; weight: number; minLevel: number }[] = [
      // LEVEL 1: Basic trail obstacles - families, walkers
      { type: "family", weight: 12, minLevel: 1 },
      { type: "headphoneWalker", weight: 12, minLevel: 1 },
      { type: "powerWalker", weight: 12, minLevel: 1 },
      
      // LEVEL 2: More nuisances appear - new diverse characters
      { type: "regularEnemy", weight: 8, minLevel: 2 },
      { type: "smokingLady", weight: 8, minLevel: 2 },
      { type: "bluetoothBomber", weight: 10, minLevel: 2 },     // NEW: Multicultural video caller
      { type: "passiveGrandpa", weight: 10, minLevel: 2 },      // NEW: Elderly non-mover
      
      // LEVEL 3: Sports people blocking trails
      { type: "padelPlayer", weight: 8, minLevel: 3 },
      { type: "tennisPlayer", weight: 8, minLevel: 3 },
      { type: "somaliSkier", weight: 10, minLevel: 3 },
      { type: "afterSkiAlpha", weight: 10, minLevel: 3 },       // NEW: Macho show-off
      
      // LEVEL 4: Drunk chaos and tech workers (non-Lahti levels)
      { type: "drunk", weight: 8, minLevel: 4 },
      { type: "asianTechWorker", weight: 10, minLevel: 4 },
      { type: "chihuahua", weight: 6, minLevel: 4 },
      { type: "cityCyclist", weight: 10, minLevel: 4 },         // NEW: Lost cyclist
      
      // LEVEL 5: Pro athletes and influencers - wellness types
      { type: "proSkier", weight: 8, minLevel: 5 },
      { type: "influencerSelfie", weight: 8, minLevel: 5 },
      { type: "cryptoBro", weight: 6, minLevel: 5 },
      { type: "wellnessWarrior", weight: 10, minLevel: 5 },     // NEW: Yoga moralist
      
      // LEVEL 6: Wealthy Espoo stereotypes
      { type: "brunchLady", weight: 8, minLevel: 6 },
      { type: "wineMom", weight: 8, minLevel: 6 },
      { type: "realEstateAgent", weight: 7, minLevel: 6 },
      
      // LEVEL 7: Active lifestyle invaders
      { type: "escooterRider", weight: 6, minLevel: 7 },
      { type: "crossfitBro", weight: 6, minLevel: 7 },
      { type: "yachtOwner", weight: 6, minLevel: 7 },
      
      // LEVEL 8: Vehicle madness
      { type: "golfCartDriver", weight: 4, minLevel: 8 },
      
      // LEVEL 9: Peak Espoo absurdity
      { type: "privateSchoolSUV", weight: 3, minLevel: 9 }
    ];
    
    // LAHTI Level 4 exclusive enemy types - 2001 doping scandal themed!
    const lahtiEnemyTypes: { type: string; weight: number }[] = [
      { type: "smokingLady", weight: 12 },
      { type: "drunk", weight: 15 },           // More drunks in Lahti!
      { type: "litmanenParody", weight: 10 },  // Lahti exclusive - Jari Litmanen parody
      { type: "proSkier", weight: 12 },        // Doping athletes
      { type: "cryptoBro", weight: 8 },
      { type: "wineMom", weight: 10 },
      { type: "regularEnemy", weight: 10 }
    ];

    // LEVEL 8 (Fuengirola) special pool - beach holiday chaos.
    const fuengirolaEnemyTypes: { type: string; weight: number }[] = [
      { type: "family", weight: 10 },
      { type: "headphoneWalker", weight: 10 },
      { type: "powerWalker", weight: 9 },
      { type: "regularEnemy", weight: 8 },
      { type: "drunk", weight: 8 },
      { type: "smokingLady", weight: 8 },
      { type: "proSkier", weight: 7 },
      { type: "influencerSelfie", weight: 7 },
      { type: "escooterRider", weight: 7 },
      { type: "crossfitBro", weight: 6 },
      { type: "brunchLady", weight: 6 },
      { type: "wineMom", weight: 6 },
      { type: "cityCyclist", weight: 7 },
      { type: "wellnessWarrior", weight: 7 },
      { type: "passiveGrandpa", weight: 9 }
    ];
    
    // Filter by current level and build weighted list
    const availableTypes: string[] = [];
    
    // Use Lahti-specific enemies for Level 4
    if (this.isLahtiLevel()) {
      for (const enemy of lahtiEnemyTypes) {
        for (let i = 0; i < enemy.weight; i++) {
          availableTypes.push(enemy.type);
        }
      }
    } else if (this.currentLevel === 8) {
      for (const enemy of fuengirolaEnemyTypes) {
        for (let i = 0; i < enemy.weight; i++) {
          availableTypes.push(enemy.type);
        }
      }
    } else {
      for (const enemy of allEnemyTypes) {
        if (this.currentLevel >= enemy.minLevel) {
          // Add the type multiple times based on weight for weighted random selection
          for (let i = 0; i < enemy.weight; i++) {
            availableTypes.push(enemy.type);
          }
        }
      }
    }
    
    if (context.roleGroup) {
      const roleGroupSet = new Set(this.getRoleGroupEnemyTypes(context.roleGroup));
      const filtered = availableTypes.filter((type) => roleGroupSet.has(type));
      if (filtered.length > 0) {
        availableTypes.length = 0;
        availableTypes.push(...filtered);
      }
    }

    // Safety check
    if (!context.forcedType && availableTypes.length === 0) {
      return undefined;
    }
    
    // Pick random type from weighted list or use forced event type.
    const enemyType = context.forcedType || Phaser.Math.RND.pick(availableTypes);
    const preSpawnEntries = new Set(this.enemies.children.entries as any[]);
    
    // New enemy announcement removed - enemies now speak for themselves!
    
    switch (enemyType) {
      case "family":
        this.spawnFamily(x);
        break;
      case "headphoneWalker":
        this.spawnHeadphoneWalker(x);
        break;
      case "drunk":
        this.spawnDrunk(x);
        break;
      case "proSkier":
        this.spawnProSkier(x);
        break;
      case "powerWalker":
        this.spawnPowerWalker(x);
        break;
      case "regularEnemy":
      default:
        this.spawnRegularEnemy(x);
        break;
      case "smokingLady":
        this.spawnSmokingLady(x);
        break;
      case "padelPlayer":
        this.spawnPadelPlayer(x);
        break;
      case "tennisPlayer":
        this.spawnTennisPlayer(x);
        break;
      case "chihuahua":
        this.spawnChihuahuaEnemy(x);
        break;
      case "somaliSkier":
        this.spawnSomaliSkier(x);
        break;
      case "asianTechWorker":
        this.spawnAsianTechWorker(x);
        break;
      // LAHTI LEVEL 4 EXCLUSIVE
      case "litmanenParody":
        this.spawnLitmanenParody(x);
        break;
      // NEW ESPOO DOUCHE ENEMIES
      case "cryptoBro":
        this.spawnCryptoBro(x);
        break;
      case "influencerSelfie":
        this.spawnInfluencerSelfie(x);
        break;
      case "escooterRider":
        this.spawnEScooterRider(x);
        break;
      case "crossfitBro":
        this.spawnCrossfitBro(x);
        break;
      case "brunchLady":
        this.spawnBrunchLady(x);
        break;
      case "golfCartDriver":
        this.spawnGolfCartDriver(x);
        break;
      case "yachtOwner":
        this.spawnYachtOwner(x);
        break;
      case "realEstateAgent":
        this.spawnRealEstateAgent(x);
        break;
      case "wineMom":
        this.spawnWineMom(x);
        break;
      case "privateSchoolSUV":
        this.spawnPrivateSchoolSUV(x);
        break;
      // NEW DIVERSE ENEMY TYPES
      case "bluetoothBomber":
        this.spawnBluetoothBomber(x);
        break;
      case "afterSkiAlpha":
        this.spawnAfterSkiAlpha(x);
        break;
      case "passiveGrandpa":
        this.spawnPassiveGrandpa(x);
        break;
      case "cityCyclist":
        this.spawnCityCyclist(x);
        break;
      case "wellnessWarrior":
        this.spawnWellnessWarrior(x);
        break;
    }

    const spawnedEnemy = this.enemies.children.entries.find((entry: any) => !preSpawnEntries.has(entry) && entry?.active);
    if (spawnedEnemy) {
      this.ensureEnemyCombatProfile(spawnedEnemy, enemyType, context);
      return spawnedEnemy;
    }
    return undefined;
  }
  
  // ========== ESPOO DOUCHE SPAWN METHODS ==========
  
  spawnCryptoBro(x: number): void {
    const cryptoBro = new CryptoBro(this, x, this.groundY, this.groundY);
    this.enemies.add(cryptoBro);
    cryptoBro.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnInfluencerSelfie(x: number): void {
    const influencer = new InfluencerSelfie(this, x, this.groundY, this.groundY);
    this.enemies.add(influencer);
    influencer.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnEScooterRider(x: number): void {
    const scooter = new EScooterRider(this, x, this.groundY, this.groundY);
    this.enemies.add(scooter);
    scooter.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnCrossfitBro(x: number): void {
    const crossfit = new CrossfitBro(this, x, this.groundY, this.groundY);
    this.enemies.add(crossfit);
    crossfit.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnBrunchLady(x: number): void {
    const brunch = new BrunchLady(this, x, this.groundY, this.groundY);
    this.enemies.add(brunch);
    brunch.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnGolfCartDriver(x: number): void {
    const golfCart = new GolfCartDriver(this, x, this.groundY, this.groundY);
    this.enemies.add(golfCart);
    golfCart.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnYachtOwner(x: number): void {
    const yacht = new YachtOwner(this, x, this.groundY, this.groundY);
    this.enemies.add(yacht);
    yacht.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnRealEstateAgent(x: number): void {
    const agent = new RealEstateAgent(this, x, this.groundY, this.groundY);
    this.enemies.add(agent);
    agent.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnWineMom(x: number): void {
    const wineMom = new WineMom(this, x, this.groundY, this.groundY);
    this.enemies.add(wineMom);
    wineMom.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnPrivateSchoolSUV(x: number): void {
    const suv = new PrivateSchoolSUV(this, x, this.groundY, this.groundY);
    this.enemies.add(suv);
    suv.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnSomaliSkier(x: number): void {
    const somaliSkier = new SomaliSkier(this, x, this.groundY, this.groundY);
    this.enemies.add(somaliSkier);
    somaliSkier.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnAsianTechWorker(x: number): void {
    const asianTechWorker = new AsianTechWorker(this, x, this.groundY, this.groundY);
    this.enemies.add(asianTechWorker);
    asianTechWorker.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  // LAHTI Level 4 exclusive - Jari Litmanen parody
  spawnLitmanenParody(x: number): void {
    const litmanen = new LitmanenParody(this, x, this.groundY, this.groundY);
    this.enemies.add(litmanen);
    litmanen.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnChihuahuaEnemy(x: number): void {
    const chihuahua = new Chihuahua(this, x, this.groundY, this.groundY);
    this.chihuahuas.add(chihuahua);
    this.enemies.add(chihuahua);
    chihuahua.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnSmokingLady(x: number): void {
    const smokingLady = new SmokingLady(this, x, this.groundY, this.groundY);
    this.enemies.add(smokingLady);
    smokingLady.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.smokingLadies++;
  }
  
  spawnPadelPlayer(x: number): void {
    const padelPlayer = new PadelPlayer(this, x, this.groundY, this.groundY);
    this.enemies.add(padelPlayer);
    padelPlayer.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.padelPlayers++;
  }
  
  spawnTennisPlayer(x: number): void {
    const tennisPlayer = new TennisPlayer(this, x, this.groundY, this.groundY);
    this.enemies.add(tennisPlayer);
    tennisPlayer.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.tennisPlayers++;
  }
  
  spawnFamily(x: number): void {
    // Fail-safe: if family textures/animations are missing, do not crash startup.
    // Fallback to a regular enemy so the run can continue.
    const hasAdultTexture = this.textures.exists("family_adult_walk_R_frame1");
    const hasChildTexture = this.textures.exists("family_child_walk_R_frame1");
    const hasAdultAnim = this.anims.exists("family_adult_walk_anim");
    const hasChildAnim = this.anims.exists("family_child_walk_anim");
    if (!hasAdultTexture || !hasChildTexture || !hasAdultAnim || !hasChildAnim) {
      console.debug(
        "[SpawnFallback] family assets missing, spawning regular enemy instead"
      );
      this.spawnRegularEnemy(x);
      return;
    }

    const family = new FamilyGroup(this, x, this.groundY, this.groundY);
    this.enemies.add(family);
    family.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.families++;
  }
  
  spawnHeadphoneWalker(x: number): void {
    const walker = new HeadphoneWalker(this, x, this.groundY, this.groundY);
    this.enemies.add(walker);
    walker.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.headphoneWalkers++;
  }
  
  spawnDrunk(x: number): void {
    const drunk = new DrunkPerson(this, x, this.groundY, this.groundY);
    this.enemies.add(drunk);
    drunk.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.drunks++;
  }
  
  spawnProSkier(x: number): void {
    const proSkier = new ProSkier(this, x, this.groundY, this.groundY);
    this.enemies.add(proSkier);
    proSkier.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.proSkiers++;
  }
  
  spawnPowerWalker(x: number): void {
    const powerWalker = new PowerWalker(this, x, this.groundY, this.groundY);
    this.enemies.add(powerWalker);
    powerWalker.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.powerWalkers++;
  }
  
  spawnRegularEnemy(x: number): void {
    const enemy = new Enemy(this, x, this.groundY, this.groundY);
    this.enemies.add(enemy);
    enemy.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    this.spawnedEnemyCounts.regularEnemies++;
  }
  
  // ========== NEW DIVERSE ENEMY SPAWN METHODS ==========
  
  spawnBluetoothBomber(x: number): void {
    const bomber = new BluetoothBomber(this, x, this.groundY, this.groundY);
    this.enemies.add(bomber);
    bomber.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnAfterSkiAlpha(x: number): void {
    const alpha = new AfterSkiAlpha(this, x, this.groundY, this.groundY);
    this.enemies.add(alpha);
    alpha.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnPassiveGrandpa(x: number): void {
    const grandpa = new PassiveGrandpa(this, x, this.groundY, this.groundY);
    this.enemies.add(grandpa);
    grandpa.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnCityCyclist(x: number): void {
    const cyclist = new CityCyclist(this, x, this.groundY, this.groundY);
    this.enemies.add(cyclist);
    cyclist.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }
  
  spawnWellnessWarrior(x: number): void {
    const warrior = new WellnessWarrior(this, x, this.groundY, this.groundY);
    this.enemies.add(warrior);
    warrior.setDepth(GameScene.DEPTH_ENEMIES_BASE);
  }

  spawnTesla(): void {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned) return;
    
    // IMPORTANT: Limit to maximum 1 vehicle at a time - otherwise player cannot survive
    const activeVehicles = this.teslas.children.entries.filter(t => t.active).length;
    if (activeVehicles >= 1) return;

    const x = this.scale.width + 150;
    const direction = -1;

    // Level 4 (Lahti) uses TunedCar instead of Tesla
    if (this.isLahtiLevel()) {
      const tunedCar = new TunedCar(this, x, this.groundY, direction);
      this.teslas.add(tunedCar);
      tunedCar.setInitialVelocity();
      tunedCar.setDepth(GameScene.DEPTH_TESLAS);
    } else {
      const tesla = new Tesla(this, x, this.groundY, direction, this.resolveLevel7VehicleKey());
      this.teslas.add(tesla);
      tesla.setInitialVelocity();
      tesla.setDepth(GameScene.DEPTH_TESLAS);
    }
    this.emitGameplayTelegraph("AUTO TULOSSA LADULLE!", "red", "🚗", 1500);
  }
  
  // ========== POWER-UP SYSTEM ==========
  
  spawnPowerUp(): void {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned) return;
    
    // Power-ups only spawn from level 4+ (progressive ability unlock)
    // Level 4 (Lahti) has special doping-themed powerups
    if (this.currentLevel < abilityUnlockConfig.powerUpsUnlockLevel.value && !this.isLahtiLevel()) return;
    
    // Spawn chance increases significantly from level 6+
    // Level 4 (Lahti): 50% chance for doping powerups
    // Level 5: 30% chance, Level 6-7: 50% chance, Level 8-9: 65% chance, Level 10: 80% chance
    let spawnChance = 0.3;
    if (this.isLahtiLevel()) {
      spawnChance = 0.5; // Lahti has more powerups (doping scandal theme)
    } else if (this.currentLevel >= 10) {
      spawnChance = 0.8;
    } else if (this.currentLevel >= 8) {
      spawnChance = 0.65;
    } else if (this.currentLevel >= 6) {
      spawnChance = 0.5;
    }
    
    const adjustedSpawnChance = Phaser.Math.Clamp(spawnChance * this.routePowerupPressure, 0.05, 0.95);
    if (Math.random() > adjustedSpawnChance) return;
    
    const x = this.scale.width + Phaser.Math.Between(100, 300);
    const y = this.groundY - Phaser.Math.Between(50, 100); // Float above ground
    
    // Level 4 (Lahti) uses special doping-themed powerups
    if (this.isLahtiLevel()) {
      this.spawnLahtiPowerUp(x, y);
      return;
    }
    
    // Pick random power-up type - 500€ is rarer but more common at higher levels
    // Level 6+: 15% chance for 500€, Level 8+: 20% chance
    let type: PowerUpType;
    const euro500Chance = this.currentLevel >= 8 ? 0.2 : (this.currentLevel >= 6 ? 0.15 : 0.1);
    
    if (Math.random() < euro500Chance) {
      type = "euro500";
    } else {
      // Level 6+: Better power-ups more common (more 100€ healing)
      if (this.currentLevel >= 6) {
        const types: PowerUpType[] = ["euro20", "euro50", "euro100", "euro100"]; // Double chance for healing
        type = Phaser.Math.RND.pick(types);
      } else {
        const types: PowerUpType[] = ["euro20", "euro50", "euro100"];
        type = Phaser.Math.RND.pick(types);
      }
    }
    
    const powerUp = new PowerUp(this, x, y, type);
    const cursedChance = this.currentLevel >= 6 ? 0.18 : 0.12;
    if (Math.random() < cursedChance) {
      this.markPowerUpAsCursed(powerUp);
    }
    this.powerUps.add(powerUp);
  }
  
  // Lahti Level 4 exclusive - doping-themed powerups
  spawnLahtiPowerUp(x: number, y: number): void {
    // Pick random Lahti powerup type
    const types: LahtiPowerUpType[] = ["syringe", "cocacola", "doctorbag"];
    const type = Phaser.Math.RND.pick(types);
    
    const powerUp = new LahtiPowerUp(this, x, y, type);
    const cursedChance = this.currentLevel >= 6 ? 0.15 : 0.1;
    if (Math.random() < cursedChance) {
      this.markPowerUpAsCursed(powerUp);
    }
    this.powerUps.add(powerUp);
  }
  
  setupPowerUpCollisions(): void {
    utils.addOverlap(
      this,
      this.player,
      this.powerUps,
      (player, powerUp) => {
        // Handle both regular PowerUp and LahtiPowerUp
        const pu = powerUp as PowerUp | LahtiPowerUp;
        if (pu.isCollected) return;
        const isCursed = this.isPowerUpCursed(pu as any);
        
        // During boss fight, power-ups are disabled (except health restore)
        // Player can still collect them for score, but timed effects don't work
        const isBossFight = this.bossActive && !this.bossDefeated;
        
        // Check if this is a Lahti powerup
        if (pu instanceof LahtiPowerUp) {
          this.handleLahtiPowerUpCollection(pu, isBossFight, isCursed);
          return;
        }
        
        const result = pu.collect();
        
        // Track power-up collection in session stats
        this.sessionStats.powerUpsCollected++;
        void GameCenterAchievementManager.recordPowerUp();
        if (isCursed) {
          this.applyCursedPowerupEffect();
        }
        
        // Apply power-up effect based on type - ALL EURO BANKNOTES!
        switch (result.type) {
          case "euro20":
            // Speed boost + energy regen bonus - DISABLED DURING BOSS FIGHT
            if (!isBossFight) {
              this.player.applySpeedBoost(
                result.effect.duration, 
                result.effect.speedMultiplier,
                result.effect.energyRegenBonus
              );
              // Emit event for UI
              this.events.emit("powerUpCollected", {
                type: "euro20",
                name: "20€ SETELI (neljä annosta) (neljä annosta)",
                description: "+50% NOPEUS",
                icon: "💶",
                duration: result.effect.duration,
                endTime: this.time.now + result.effect.duration,
                color: "yellow"
              });
            } else {
              // Show message that power-ups are disabled
              this.showFloatingText(
                this.player.x,
                this.player.y - 100,
                "EI TOIMI BOSS-TUKARILLA!",
                0xff4444,
                1500
              );
            }
            this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
            break;
          case "euro50":
            // Invincibility + contact damage + knockback - DISABLED DURING BOSS FIGHT
            if (!isBossFight) {
              this.player.applySalmiakkiShield(
                result.effect.duration,
                result.effect.contactDamage,
                result.effect.knockbackForce
              );
              // Emit event for UI
              this.events.emit("powerUpCollected", {
                type: "euro50",
                name: "50€ SETELI",
                description: "SUOJA + TÖRMÄYSVAHINKO",
                icon: "💶",
                duration: result.effect.duration,
                endTime: this.time.now + result.effect.duration,
                color: "cyan"
              });
            } else {
              // Show message that power-ups are disabled
              this.showFloatingText(
                this.player.x,
                this.player.y - 100,
                "EI TOIMI BOSS-TUKARILLA!",
                0xff4444,
                1500
              );
            }
            this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
            break;
          case "euro100":
            // Health + energy restore
            this.player.applyHealthRestore(
              result.effect.healthRestore,
              result.effect.energyRestore
            );
            this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
            // Emit event for UI (instant effect, no duration)
            this.events.emit("powerUpCollected", {
              type: "euro100",
              name: "100€ SETELI",
              description: `+${result.effect.healthRestore} HP, +${result.effect.energyRestore} ENERGIA`,
              icon: "💶",
              duration: 0,
              endTime: 0,
              color: "green"
            });
            break;
          case "euro500":
            // Extra life power-up - RARE 500€!
            if (this.lives < this.maxLives) {
              this.lives++;
              this.events.emit("livesChanged", this.lives);
              this.sound.play("extra_life", { volume: 0.5 });
            }
            this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
            // Emit event for UI (instant effect, no duration)
            this.events.emit("powerUpCollected", {
              type: "euro500",
              name: "500€ SETELI",
              description: "+1 ELÄMÄ",
              icon: "💶",
              duration: 0,
              endTime: 0,
              color: "purple"
            });
            break;
        }
      }
    );
  }
  
  // ========== LAHTI POWER-UP HANDLER (Level 4 exclusive) ==========
  
  handleLahtiPowerUpCollection(powerUp: LahtiPowerUp, isBossFight: boolean, isCursed: boolean = false): void {
    const result = powerUp.collect();
    
    // Track power-up collection
    this.sessionStats.powerUpsCollected++;
    void GameCenterAchievementManager.recordPowerUp();
    if (isCursed) {
      this.applyCursedPowerupEffect();
    }
    
    // Apply effect based on type
    switch (result.type) {
      case "syringe":
        // Speed boost - enhanced performance (doping parody)
        if (!isBossFight) {
          this.player.applySpeedBoost(
            result.effect.duration,
            result.effect.speedMultiplier,
            result.effect.energyRegenBonus
          );
          this.events.emit("powerUpCollected", {
            type: "syringe",
            name: "💉 SUORITUSTA AVITTAVA PIIKKI",
            description: result.effect.description,
            icon: "💉",
            duration: result.effect.duration,
            endTime: this.time.now + result.effect.duration,
            color: "green"
          });
        } else {
          this.showFloatingText(this.player.x, this.player.y - 100, "EI TOIMI BOSS-TUKARILLA!", 0xff4444, 1500);
        }
        this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
        break;
        
      case "cocacola":
        // Shield + contact damage
        if (!isBossFight) {
          this.player.applySalmiakkiShield(
            result.effect.duration,
            result.effect.contactDamage,
            result.effect.knockbackForce
          );
          this.events.emit("powerUpCollected", {
            type: "cocacola",
            name: "🥤 COCA-COLA / LIHAMUKI / LIHAMUKI",
            description: result.effect.description,
            icon: "🥤",
            duration: result.effect.duration,
            endTime: this.time.now + result.effect.duration,
            color: "red"
          });
        } else {
          this.showFloatingText(this.player.x, this.player.y - 100, "EI TOIMI BOSS-TUKARILLA!", 0xff4444, 1500);
        }
        this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
        break;
        
      case "doctorbag":
        // Health + energy restore
        this.player.applyHealthRestore(
          result.effect.healthRestore,
          result.effect.energyRestore
        );
        this.player.score += this.applyRunScoreMultiplier(result.effect.scoreBonus + this.passivePowerupScoreBonus);
        this.events.emit("powerUpCollected", {
          type: "doctorbag",
          name: "🧳 LÄÄKÄRILAUKKU",
          description: result.effect.description,
          icon: "🧳",
          duration: 0,
          endTime: 0,
          color: "gray"
        });
        break;
    }
  }
  
  // ========== JUMP RAMP SYSTEM ==========

  private isRampSpawnPositionClear(x: number, minDistance: number = 170): boolean {
    let isClear = true;

    this.jumpRamps.children.each((ramp: any) => {
      if (ramp.active && Math.abs(ramp.x - x) < minDistance) {
        isClear = false;
      }
      return true;
    });

    if (!isClear) return false;

    this.hazards.children.each((hazard: any) => {
      if (hazard.active && Math.abs(hazard.x - x) < minDistance) {
        isClear = false;
      }
      return true;
    });

    return isClear;
  }

  private pickJumpRampSize(): JumpRampSize {
    const roll = Math.random();
    if (this.currentLevel >= 8) {
      if (roll < 0.2) return "large";
      if (roll < 0.64) return "medium";
      return "small";
    }
    if (this.currentLevel >= 4) {
      if (roll < 0.1) return "large";
      if (roll < 0.52) return "medium";
      return "small";
    }
    return roll < 0.2 ? "medium" : "small";
  }

  private spawnRiskRoutePowerUp(x: number, y: number, preferredType?: PowerUpType): void {
    if (this.isLahtiLevel()) {
      this.spawnLahtiPowerUp(x, y);
      return;
    }

    const fallbackPool: PowerUpType[] = ["euro20", "euro50", "euro100"];
    const type = preferredType || Phaser.Math.RND.pick(fallbackPool);
    const powerUp = new PowerUp(this, x, y, type);
    if (Math.random() < 0.14) {
      this.markPowerUpAsCursed(powerUp);
    }
    this.powerUps.add(powerUp);
  }

  private spawnRampRiskRoute(ramp: JumpRamp): void {
    if (this.isBossLevel || this.bossActive || this.riskRouteSpawnedThisLevel) return;

    const now = this.time.now;
    if (now - this.lastRiskRouteAt < 16000) return;

    this.riskRouteSpawnedThisLevel = true;
    this.lastRiskRouteAt = now;
    ramp.hasRiskRoute = true;

    const anchorX = ramp.x + Phaser.Math.Between(250, 320);
    const bonusY = this.groundY - Phaser.Math.Between(155, 190);

    const gateTree = new FallenTree(this, anchorX, this.groundY);
    this.hazards.add(gateTree);
    gateTree.setDepth(GameScene.DEPTH_HAZARDS);

    const icyExit = new IcePatch(this, anchorX + 120, this.groundY);
    this.hazards.add(icyExit);
    icyExit.setDepth(GameScene.DEPTH_HAZARDS);

    this.spawnRiskRoutePowerUp(anchorX - 70, bonusY, "euro100");
    this.spawnRiskRoutePowerUp(anchorX + 10, bonusY - 26, "euro500");
    this.spawnRiskRoutePowerUp(anchorX + 92, bonusY, "euro100");

    this.events.emit("floatingAnnouncement", {
      text: "RISKIREITTI AVAUTUI! KORKEA LINJA = ISOT PISTEET",
      duration: 2300,
    });
  }

  spawnJumpRamp(): void {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned || this.bossActive || this.levelCompleted) return;
    if (this.currentLevel < 2) return;

    const baseSpawnChance = this.qualityTier === "low" ? 0.33 : this.qualityTier === "medium" ? 0.5 : 0.65;
    const routeRampBonus = this.selectedRouteId === "precision_lane" ? 0.14 : this.selectedRouteId === "safe_lane" ? -0.06 : 0.04;
    const spawnChance = Phaser.Math.Clamp(baseSpawnChance + routeRampBonus, 0.15, 0.92);
    if (Math.random() > spawnChance) return;

    let x = this.scale.width + Phaser.Math.Between(180, 380);
    if (!this.isRampSpawnPositionClear(x)) {
      let resolved = false;
      for (let i = 0; i < 3; i++) {
        x = this.scale.width + Phaser.Math.Between(220, 460);
        if (this.isRampSpawnPositionClear(x)) {
          resolved = true;
          break;
        }
      }
      if (!resolved) return;
    }

    const size = this.pickJumpRampSize();
    const ramp = new JumpRamp(this, x, this.groundY, size);
    ramp.setDepth(GameScene.DEPTH_RAMPS);
    this.jumpRamps.add(ramp);

    const progress = this.levelDistance > 0 ? this.distanceTraveled / this.levelDistance : 0;
    if (!this.riskRouteSpawnedThisLevel && progress >= 0.22 && progress <= 0.86 && this.currentLevel <= 10) {
      this.spawnRampRiskRoute(ramp);
    }
  }

  private activateJumpRamp(ramp: JumpRamp): void {
    if (!ramp.active || this.player.isDead || this.levelCompleted || this.bossActive) return;
    if (!this.player.isOnGround) return;

    const now = this.time.now;
    if (now < this.rampGlobalCooldownUntil) return;
    if (!ramp.canLaunch(now)) return;

    ramp.markLaunched(now);
    this.rampGlobalCooldownUntil = now + 320;

    const direction = this.player.facingDirection === "left" ? -1 : 1;
    const minHorizontal = this.player.baseSpeed + ramp.horizontalBoost;
    const nextVelocityX = direction * Math.max(Math.abs(this.player.body.velocity.x), minHorizontal);

    this.player.setVelocityX(nextVelocityX);
    this.player.setVelocityY(-ramp.launchVelocityY);
    this.player.isJumping = true;
    this.player.isOnGround = false;
    this.player.jumpSound?.play();

    this.activeRampLanding = {
      startedAt: now,
      size: ramp.rampSize,
      minMs: ramp.perfectMinMs,
      maxMs: ramp.perfectMaxMs,
      bonusScore: ramp.perfectBonus,
      requiredPeakPx: ramp.requiredPeakPx,
      riskRoute: ramp.hasRiskRoute,
    };
    this.rampJumpPeakHeight = 0;
    this.rampVolttiBonusAvailable = true;

    this.sound.play("player_jump", { volume: 0.18, rate: 1.08 });
    this.cameras.main.shake(55, 0.004);
    this.showFloatingText(this.player.x, this.player.y - 80, `HYPPYRI ${ramp.rampSize.toUpperCase()}!`, 0x7fd6ff, 900);
  }

  setupJumpRampCollisions(): void {
    utils.addOverlap(
      this,
      this.player,
      this.jumpRamps,
      (_player, ramp) => {
        this.activateJumpRamp(ramp as JumpRamp);
      }
    );
  }

  public consumeRampVolttiPerfectBonus(): boolean {
    if (!this.activeRampLanding || !this.rampVolttiBonusAvailable) return false;
    this.rampVolttiBonusAvailable = false;
    return true;
  }

  // ========== HAZARD SYSTEM ==========
  
  spawnHazard(): void {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned) return;
    
    // Random chance to spawn hazard (25%)
    const qualityHazardChance = this.qualityTier === "low" ? 0.12 : this.qualityTier === "medium" ? 0.2 : 0.25;
    const hazardChance = Phaser.Math.Clamp(
      qualityHazardChance * this.routeHazardPressure,
      0.05,
      0.65
    );
    if (Math.random() > hazardChance) return;
    
    const x = this.scale.width + Phaser.Math.Between(150, 400);
    
    // Pick random hazard type based on level
    const hazardRoll = Math.random();
    
    if (hazardRoll < 0.4) {
      // Ice patch (40%)
      const icePatch = new IcePatch(this, x, this.groundY);
      this.hazards.add(icePatch);
      this.emitGameplayTelegraph("JÄÄLÄIKKÄ EDELLÄ", "blue", "🧊", 1300);
    } else if (hazardRoll < 0.7) {
      // Fallen tree (30%)
      const fallenTree = new FallenTree(this, x, this.groundY);
      this.hazards.add(fallenTree);
      this.emitGameplayTelegraph("KAATUNUT PUU EDELLÄ", "orange", "🌲", 1300);
    } else if (this.currentLevel >= 5) {
      // Moose crossing (30%, appears first time on level 5)
      const moose = new MooseCrossing(this, x, this.groundY);
      this.hazards.add(moose);
      this.emitGameplayTelegraph("HIRVIVAARA!", "red", "🫎", 1500);
    } else {
      // Before level 5, fallback to non-moose hazards so hazard density stays stable.
      const fallbackHazard = Math.random() < 0.5
        ? new IcePatch(this, x, this.groundY)
        : new FallenTree(this, x, this.groundY);
      this.hazards.add(fallbackHazard);
      this.emitGameplayTelegraph(
        fallbackHazard instanceof IcePatch ? "JÄÄLÄIKKÄ EDELLÄ" : "KAATUNUT PUU EDELLÄ",
        fallbackHazard instanceof IcePatch ? "blue" : "orange",
        fallbackHazard instanceof IcePatch ? "🧊" : "🌲",
        1300
      );
    }
  }
  
  spawnChihuahua(): void {
    if (this.awaitingLoadoutSelection || this.player.isDead || this.clubhouseSpawned) return;
    if (this.currentLevel < 2) return; // Only spawn from level 2
    
    // Lower spawn chance (15%)
    const qualityChihuahuaChance = this.qualityTier === "low" ? 0.08 : this.qualityTier === "medium" ? 0.12 : 0.15;
    const finalChance = Phaser.Math.Clamp(
      qualityChihuahuaChance * this.routeHazardPressure,
      0.03,
      0.35
    );
    if (Math.random() > finalChance) return;
    
    const x = this.scale.width + Phaser.Math.Between(200, 400);
    const chihuahua = new Chihuahua(this, x, this.groundY, this.groundY);
    this.chihuahuas.add(chihuahua);
    this.enemies.add(chihuahua);
    chihuahua.setDepth(GameScene.DEPTH_ENEMIES_BASE);
    if (Math.random() < 0.4) {
      this.emitGameplayTelegraph("CHIHUAHUA + TALUTINVAARA", "orange", "🐕", 1300);
    }
  }
  
  setupHazardCollisions(): void {
    // Player vs ice patches
    utils.addOverlap(
      this,
      this.player,
      this.hazards,
      (player, hazard) => {
        const hz = hazard as any;
        if (hz.onPlayerCollision) {
          hz.onPlayerCollision(this.player, this.time.now);
        }
      }
    );
    
    // Player vs chihuahua leashes
    this.chihuahuas.children.each((chihuahua: any) => {
      if (chihuahua.leashLine) {
        utils.addOverlap(
          this,
          this.player,
          chihuahua.leashLine,
          () => {
            chihuahua.tripPlayer(this.player);
          }
        );
      }
      return true;
    });
  }
  
  // ========== WEATHER SYSTEM ==========
  
  createSnowstormOverlay(): void {
    // Create a tilesprite for snowstorm effect
    this.snowstormOverlay = this.add.tileSprite(
      0, 0,
      this.scale.width,
      this.scale.height,
      "snowstorm_overlay"
    );
    this.snowstormOverlay.setOrigin(0, 0);
    this.snowstormOverlay.setScrollFactor(0);
    this.snowstormOverlay.setDepth(GameScene.DEPTH_WEATHER);
    this.snowstormOverlay.setAlpha(0); // Hidden initially
  }
  
  // Create ambient snowfall that scales with level (very light in level 1, heavy in level 10)
  // Check if current level has acid rain (Level 4 - Nuuksio)
  isAcidRainLevel(): boolean {
    return this.currentLevel === 4;
  }

  isKeilaniemiRainLevel(): boolean {
    return this.currentLevel === 10;
  }

  private getActiveWeatherParticleCount(): number {
    return this.snowflakes ? this.snowflakes.countActive(true) : 0;
  }

  private clearWeatherParticles(destroyObjects: boolean = false): void {
    if (!this.snowflakes) return;
    if (destroyObjects) {
      this.snowflakes.clear(true, true);
      this.weatherParticlePool = [];
      return;
    }

    this.snowflakes.children.each((particle: Phaser.GameObjects.GameObject) => {
      this.recycleWeatherParticle(particle as any);
      return true;
    });
  }

  private acquireWeatherParticle(kind: "snow" | "acid" | "rain"): any {
    const reusable = this.weatherParticlePool.find(
      (particle) => particle && particle.scene === this && !particle.active && particle.__weatherKind === kind
    );

    let particle: any = reusable;
    if (!particle) {
      if (kind === "acid") {
        particle = this.add.rectangle(0, 0, 2, 12, 0x88ff00, 0.8);
      } else if (kind === "rain") {
        particle = this.add.rectangle(0, 0, 2, 18, 0x9fc5e8, 0.62);
      } else {
        particle = this.add.circle(0, 0, 3, 0xffffff, 0.6);
      }
      particle.__weatherKind = kind;
      particle.setDepth(GameScene.DEPTH_EFFECTS - 10);
      this.weatherParticlePool.push(particle);
      if (this.snowflakes && !this.snowflakes.contains(particle)) {
        this.snowflakes.add(particle);
      }
    }

    particle.setActive(true);
    particle.setVisible(true);
    particle.alpha = 1;
    particle.isAcidDrop = kind === "acid";
    particle.isRainDrop = kind === "rain";
    return particle;
  }

  private recycleWeatherParticle(particle: any): void {
    if (!particle || !particle.scene) return;
    particle.setActive(false);
    particle.setVisible(false);
    particle.alpha = 0;
  }
  
  createAmbientSnowfall(): void {
    // Create snowflakes group (also used for acid rain particles)
    this.snowflakes = this.add.group();
    
    // Level 4 has ACID RAIN instead of snow - Nuuksio environmental disaster!
    if (this.isAcidRainLevel()) {
      this.createAmbientAcidRain();
      return;
    }

    // Level 10 / Keilaniemi uses rain instead of snow to match the new stormy skyline.
    if (this.isKeilaniemiRainLevel()) {
      this.createAmbientKeilaniemiRain();
      return;
    }
    
    // Mobile + quality optimization: reduce particle count on constrained devices.
    const mobileMultiplier = this.isMobile ? 0.2 : 1.0;
    const particleMultiplier = mobileMultiplier * this.particleBudgetMultiplier;
    
    // Calculate snow intensity based on level (1-10)
    // Level 1: barely visible (2-3 flakes), Level 10: full winter (30-40 flakes)
    // Mobile: Reduced by 70%
    const minFlakes = Math.floor((2 + Math.floor((this.currentLevel - 1) * 3)) * particleMultiplier);
    const maxFlakes = Math.floor((4 + Math.floor((this.currentLevel - 1) * 4)) * particleMultiplier);
    const numFlakes = Phaser.Math.Between(Math.max(1, minFlakes), Math.max(2, maxFlakes));
    
    // Snowflake size also increases with level
    const minSize = 2;
    const maxSize = 3 + Math.floor(this.currentLevel / 3); // 3-6 based on level
    
    // Create initial snowflakes
    for (let i = 0; i < numFlakes; i++) {
      this.createSnowflake(minSize, maxSize, true);
    }
    
    // Continuously spawn new snowflakes
    // Spawn rate increases with level (slower on mobile)
    const baseSpawnDelay = Math.max(100, 500 - (this.currentLevel * 40)); // 460ms (L1) to 100ms (L10)
    const spawnDelay = Math.floor((this.isMobile ? baseSpawnDelay * 3 : baseSpawnDelay * 1.2) / Math.max(this.particleBudgetMultiplier, 0.25));
    
    if (this.ambientSnowSpawnTimer) {
      this.ambientSnowSpawnTimer.destroy();
    }
    this.ambientSnowSpawnTimer = this.time.addEvent({
      delay: spawnDelay,
      callback: () => {
        const maxAllowed = this.isMobile ? maxFlakes : maxFlakes * 1.5;
        if (this.snowflakes && this.getActiveWeatherParticleCount() < maxAllowed) {
          this.createSnowflake(minSize, maxSize, false);
        }
      },
      loop: true
    });
  }

  // ========== LEVEL 10 SPECIAL: AMBIENT KEILANIEMI RAIN ==========
  createAmbientKeilaniemiRain(): void {
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x203650, 0.12);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1800 });
    }

    this.weatherEnergyDrain = 0;

    const rainScale = Math.max(this.particleBudgetMultiplier, 0.25);
    const initialDrops = Math.max(8, Math.floor((this.isMobile ? 18 : 55) * rainScale));
    for (let i = 0; i < initialDrops; i++) {
      this.createRainDrop(true);
    }

    if (this.ambientRainSpawnTimer) {
      this.ambientRainSpawnTimer.destroy();
    }
    this.ambientRainSpawnTimer = this.time.addEvent({
      delay: Math.floor((this.isMobile ? 85 : 35) / rainScale),
      callback: () => {
        const maxDrops = Math.max(18, Math.floor((this.isMobile ? 42 : 110) * rainScale));
        if (this.snowflakes && this.getActiveWeatherParticleCount() < maxDrops) {
          this.createRainDrop(false);
        }
      },
      loop: true
    });
  }

  createRainDrop(randomX: boolean): void {
    const x = randomX
      ? Phaser.Math.Between(-40, this.scale.width + 60)
      : Phaser.Math.Between(0, this.scale.width + 80);
    const y = randomX
      ? Phaser.Math.Between(-60, this.scale.height)
      : -20;

    const colors = [0x9fc5e8, 0xb8d7ff, 0x6fa8dc, 0xe8f4ff];
    const color = Phaser.Math.RND.pick(colors);
    const width = Phaser.Math.Between(1, 2);
    const height = Phaser.Math.Between(16, 28);

    const rainDrop = this.acquireWeatherParticle("rain");
    rainDrop.setPosition(x, y);
    rainDrop.setSize(width, height);
    rainDrop.setFillStyle(color, Phaser.Math.FloatBetween(0.45, 0.72));
    rainDrop.setAngle(12);

    (rainDrop as any).fallSpeed = Phaser.Math.Between(420, 620);
    (rainDrop as any).drift = Phaser.Math.Between(-95, -35);
    (rainDrop as any).isRainDrop = true;
  }
  
  // ========== LEVEL 4 SPECIAL: AMBIENT ACID RAIN (HAPPOSADE) ==========
  // Nuuksio National Park has been hit by environmental disaster!
  createAmbientAcidRain(): void {
    // Green-yellow toxic overlay
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x556622, 0.15);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 3000 });
    }
    
    // Set constant acid rain energy drain (3 per second - survivable but noticeable)
    this.weatherEnergyDrain = 3;
    
    // Create initial acid drops (reduced on mobile)
    const numDrops = Math.max(3, Math.floor((this.isMobile ? 6 : 25) * this.particleBudgetMultiplier));
    for (let i = 0; i < numDrops; i++) {
      this.createAcidDrop(true);
    }
    
    // Continuously spawn acid rain drops (slower on mobile)
    if (this.ambientAcidSpawnTimer) {
      this.ambientAcidSpawnTimer.destroy();
    }
    this.ambientAcidSpawnTimer = this.time.addEvent({
      delay: Math.floor((this.isMobile ? 200 : 60) / Math.max(this.particleBudgetMultiplier, 0.25)),
      callback: () => {
        const maxDrops = Math.max(8, Math.floor((this.isMobile ? 16 : 60) * this.particleBudgetMultiplier));
        if (this.snowflakes && this.getActiveWeatherParticleCount() < maxDrops) {
          this.createAcidDrop(false);
        }
      },
      loop: true
    });
    
    // Random acid splash damage events (every 8-15 seconds)
    if (this.ambientAcidSplashTimer) {
      this.ambientAcidSplashTimer.destroy();
    }
    this.ambientAcidSplashTimer = this.time.addEvent({
      delay: Phaser.Math.Between(8000, 15000),
      callback: () => this.acidSplashDamage(),
      loop: true
    });
  }
  
  createAcidDrop(randomX: boolean): void {
    const x = randomX 
      ? Phaser.Math.Between(0, this.scale.width) 
      : Phaser.Math.Between(0, this.scale.width);
    const y = randomX 
      ? Phaser.Math.Between(-50, this.scale.height) 
      : -10;
    
    // Acid drops are elongated rectangles - green/yellow toxic colors
    const colors = [0x88ff00, 0xaaff33, 0x66cc00, 0xccff66, 0x99ff00];
    const color = Phaser.Math.RND.pick(colors);
    const width = Phaser.Math.Between(2, 3);
    const height = Phaser.Math.Between(8, 15);
    
    const acidDrop = this.acquireWeatherParticle("acid");
    acidDrop.setPosition(x, y);
    acidDrop.setSize(width, height);
    acidDrop.setFillStyle(color, 0.8);
    acidDrop.setAngle(15); // Slight angle for wind effect
    
    // Faster falling speed than snow - acid rain is heavier
    const fallSpeed = 150 + Phaser.Math.Between(0, 50);
    const drift = Phaser.Math.Between(-30, 10);
    
    (acidDrop as any).fallSpeed = fallSpeed;
    (acidDrop as any).drift = drift;
    (acidDrop as any).isAcidDrop = true; // Mark as acid for update logic
  }
  
  acidSplashDamage(): void {
    if (!this.player || this.player.isDead || this.player.isInvulnerable) return;
    if (!this.isAcidRainLevel()) return; // Safety check
    
    // 30% chance to actually hit player with acid splash
    if (Math.random() > 0.3) return;
    
    // Small acid damage (5 HP)
    const acidDamage = 5;
    this.player.takeDamage(acidDamage);
    
    // Green flash
    this.cameras.main.flash(100, 100, 255, 0, true);
  }
  
  createSnowflake(minSize: number, maxSize: number, randomX: boolean): void {
    const x = randomX 
      ? Phaser.Math.Between(0, this.scale.width) 
      : Phaser.Math.Between(0, this.scale.width);
    const y = randomX 
      ? Phaser.Math.Between(-50, this.scale.height) 
      : -10;
    
    const size = Phaser.Math.Between(minSize, maxSize);
    
    // Alpha based on level - more visible at higher levels
    const baseAlpha = 0.3 + (this.currentLevel * 0.06); // 0.36 (L1) to 0.9 (L10)
    const alpha = Phaser.Math.FloatBetween(baseAlpha * 0.5, baseAlpha);
    
    const snowflake = this.acquireWeatherParticle("snow");
    snowflake.setPosition(x, y);
    if (typeof snowflake.setRadius === "function") {
      snowflake.setRadius(size);
    } else {
      snowflake.setScale(size / 3);
    }
    snowflake.setFillStyle(0xffffff, alpha);
    
    // Falling speed varies - faster at higher levels
    const fallSpeed = 30 + Phaser.Math.Between(0, 20) + (this.currentLevel * 5);
    const drift = Phaser.Math.Between(-20, 10); // Slight horizontal drift
    
    // Store velocity data on the snowflake
    (snowflake as any).fallSpeed = fallSpeed;
    (snowflake as any).drift = drift;
    (snowflake as any).wobble = Phaser.Math.FloatBetween(0, Math.PI * 2); // Random starting phase
  }
  
  updateSnowfall(delta: number): void {
    if (!this.snowflakes) return;
    if (this.isMobile) {
      if (this.qualityTier === "low" && this.frameCounter % 3 !== 0) return;
      if (this.qualityTier === "medium" && this.frameCounter % 2 !== 0) return;
    } else if (this.qualityTier === "low" && this.frameCounter % 2 === 1) {
      return;
    }
    
    const deltaSeconds = delta / 1000;
    
    this.snowflakes.children.each((flake: Phaser.GameObjects.GameObject) => {
      const particle = flake as any;
      if (!particle.active) return true;
      
      // Check if this is a rain/acid drop (rectangle) or snowflake (circle).
      if (particle.isAcidDrop || particle.isRainDrop) {
        // Rain-like drops fall faster and straighter than snow.
        particle.y += particle.fallSpeed * deltaSeconds;
        particle.x += particle.drift * deltaSeconds;
        
        // Remove if off-screen
        if (particle.y > this.scale.height + 20 || particle.x < -20 || particle.x > this.scale.width + 20) {
          this.recycleWeatherParticle(particle);
        }
      } else {
        // Regular snowflake behavior
        const snowflake = particle as Phaser.GameObjects.Arc & { fallSpeed: number; drift: number; wobble: number };
        
        // Update wobble for gentle side-to-side motion
        snowflake.wobble += deltaSeconds * 2;
        const wobbleOffset = Math.sin(snowflake.wobble) * 15;
        
        // Move snowflake down and slightly sideways
        snowflake.y += snowflake.fallSpeed * deltaSeconds;
        snowflake.x += (snowflake.drift + wobbleOffset * 0.5) * deltaSeconds;
        
        // Remove if off-screen
        if (snowflake.y > this.scale.height + 20 || snowflake.x < -20 || snowflake.x > this.scale.width + 20) {
          this.recycleWeatherParticle(snowflake);
        }
      }
      
      return true;
    });
  }
  
  setupWeatherSystem(): void {
    // Create weather overlay (for tint effects)
    this.weatherOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x000000, 0
    );
    this.weatherOverlay.setScrollFactor(0);
    this.weatherOverlay.setDepth(GameScene.DEPTH_WEATHER - 1);
    
    // Create frost overlay for arctic freeze
    this.frostOverlay = this.add.graphics();
    this.frostOverlay.setScrollFactor(0);
    this.frostOverlay.setDepth(GameScene.DEPTH_UI - 1);
    this.frostOverlay.setAlpha(0);
    
    // Create ice particles group
    this.iceParticles = this.add.group();
    
    // Random weather changes every 25-50 seconds
    const weatherDelayMin = this.qualityTier === "low" ? 38000 : 25000;
    const weatherDelayMax = this.qualityTier === "low" ? 65000 : 50000;
    this.weatherChangeTimer = this.time.addEvent({
      delay: Phaser.Math.Between(weatherDelayMin, weatherDelayMax),
      callback: () => this.triggerRandomWeather(),
      loop: true
    });
  }
  
  triggerRandomWeather(): void {
    if (this.player.isDead || this.clubhouseSpawned || this.bossActive) return;
    
    // End current weather if active
    if (this.currentWeather !== "clear") {
      this.endCurrentWeather();
      return;
    }
    
    // Weather availability by level (cleaned):
    // Level 4: Acid rain events
    // Level 5+: Snowstorm events
    // Other levels: no random weather events
    
    let chance = this.currentLevel >= 7 ? 0.5 
                 : this.currentLevel >= 5 ? 0.4 
                 : this.currentLevel >= 3 ? 0.3 
                 : 0.2;
    if (this.qualityTier === "low") {
      chance *= 0.7;
    } else if (this.qualityTier === "medium") {
      chance *= 0.85;
    }
    
    if (Math.random() > chance) return;
    
    // Build available weather types based on level.
    // Keep only snow + acid rain random weather variants.
    const availableWeather: Array<"snowstorm" | "acidrain"> = [];

    // Level 4 special: Acid rain weather events (Nuuksio environmental disaster)
    if (this.currentLevel === 4) {
      availableWeather.push("acidrain");
      availableWeather.push("acidrain"); // Double chance for acid rain on level 4
    }

    // Snowstorm events from level 5+
    if (this.currentLevel >= 5) {
      availableWeather.push("snowstorm");
    }

    if (availableWeather.length === 0) return;

    // Pick random weather
    const weather = Phaser.Math.RND.pick(availableWeather);
    this.startWeather(weather);
  }
  
  startWeather(type: "snowstorm" | "sleet" | "blizzard" | "blackice" | "sunglare" | "arcticfreeze" | "acidrain"): void {
    // Hard-clean guard: allow only snowstorm + acid rain.
    if (type !== "snowstorm" && type !== "acidrain") return;

    this.currentWeather = type;
    
    // Emit event for UI to show warning
    this.events.emit("weatherChanged", { type, active: true });
    
    switch (type) {
      case "snowstorm":
        this.startSnowstorm();
        break;
      case "acidrain":
        this.startAcidRainWeather();
        break;
    }
  }
  
  // ========== WEATHER TYPE 7: ACID RAIN WEATHER EVENT (HAPPOSADE SÄÄILMIÖ) ==========
  // Triggered as random weather event on Level 4 - intensifies the acid rain!
  startAcidRainWeather(): void {
    // Intensify acid rain effect
    this.weatherEnergyDrain = 8; // Double energy drain during weather event
    
    // Stronger green overlay
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x446611, 0.35);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1500 });
    }
    
    // Camera shake for intensity
    this.cameras.main.shake(500, 0.005);
    
    // Play wind sound as acid rain sfx
    this.windHowlSound = utils.safeAddSound(this, "wind_howl", { volume: 0.25, loop: true });
    this.windHowlSound?.play();
    
    // Schedule end (10-18 seconds)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(10000, 18000), () => {
      // Return to normal acid rain level (not clear weather on level 4)
      if (this.isAcidRainLevel()) {
        this.currentWeather = "clear";
        this.weatherEnergyDrain = 3; // Back to normal acid rain drain
        this.weatherSpeedMultiplier = 1.0;
        this.isSnowstorm = false;
        
        if (this.weatherOverlay) {
          this.weatherOverlay.setFillStyle(0x556622, 0.15);
        }
        if (this.windHowlSound) {
          this.windHowlSound.stop();
        }
        
        this.events.emit("weatherChanged", { type: "clear", active: false });
      } else {
        this.endCurrentWeather();
      }
    });
  }
  
  endCurrentWeather(): void {
    const previousWeather = this.currentWeather;
    this.currentWeather = "clear";
    this.weatherSpeedMultiplier = 1.0;
    this.isSnowstorm = false;
    
    // On Level 4 (acid rain level), keep base energy drain active
    if (this.isAcidRainLevel()) {
      this.weatherEnergyDrain = 3; // Base acid rain drain
    } else {
      this.weatherEnergyDrain = 0;
    }
    
    // Emit event for UI
    this.events.emit("weatherChanged", { type: "clear", active: false });
    
    // Stop weather end timer
    if (this.weatherEndTimer) {
      this.weatherEndTimer.destroy();
      this.weatherEndTimer = undefined;
    }
    
    // Stop sun glare flash timer
    if (this.sunGlareFlashTimer) {
      this.sunGlareFlashTimer.destroy();
      this.sunGlareFlashTimer = undefined;
    }
    if (this.sleetSpawnTimer) {
      this.sleetSpawnTimer.destroy();
      this.sleetSpawnTimer = undefined;
    }
    
    // Fade out overlays (but keep slight green tint on Level 4)
    if (this.snowstormOverlay) {
      this.tweens.add({ targets: this.snowstormOverlay, alpha: 0, duration: 1500 });
    }
    if (this.weatherOverlay) {
      if (this.isAcidRainLevel()) {
        // Keep light green tint on acid rain level
        this.weatherOverlay.setFillStyle(0x556622, 0.15);
        this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1500 });
      } else if (this.isKeilaniemiRainLevel()) {
        // Keep the subtle storm tint on Keilaniemi even after temporary weather events end.
        this.weatherOverlay.setFillStyle(0x203650, 0.12);
        this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1500 });
      } else {
        this.tweens.add({ targets: this.weatherOverlay, alpha: 0, duration: 1500 });
      }
    }
    if (this.frostOverlay) {
      this.tweens.add({ targets: this.frostOverlay, alpha: 0, duration: 1500 });
    }
    
    // Stop wind sound
    if (this.windHowlSound) {
      this.windHowlSound.stop();
    }
    
    // Clear ice particles
    if (this.iceParticles) {
      this.iceParticles.clear(true, true);
    }
    
    // Reset player slip state if was black ice
    if (previousWeather === "blackice" && this.player) {
      this.player.isSlipping = false;
    }
    
  }
  
  // ========== WEATHER TYPE 1: SNOWSTORM (LUMIMYRSKY) ==========
  startSnowstorm(): void {
    this.isSnowstorm = true;

    // Fade in overlay
    if (this.snowstormOverlay) {
      this.tweens.add({ targets: this.snowstormOverlay, alpha: 0.6, duration: 2000 });
    }
    
    // Play wind sound
    this.windHowlSound = utils.safeAddSound(this, "wind_howl", { volume: 0.3, loop: true });
    this.windHowlSound?.play();
    
    // Schedule end
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(15000, 25000), () => {
      this.endCurrentWeather();
    });
  }
  
  // Legacy method for backwards compatibility
  endSnowstorm(): void {
    this.endCurrentWeather();
  }
  
  // ========== WEATHER TYPE 2: SLEET (RÄNTÄSADE) ==========
  startSleet(): void {
    // Sleet slows everyone down significantly
    this.weatherSpeedMultiplier = 0.65; // 35% speed reduction

    // Gray-blue tint overlay
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x556677, 0.35);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 2000 });
    }
    
    // Play rain-like sound (use wind_howl at lower volume)
    this.windHowlSound = utils.safeAddSound(this, "wind_howl", { volume: 0.15, loop: true });
    this.windHowlSound?.play();
    
    // Create sleet particles
    this.createSleetParticles();
    
    // Schedule end (8-15 seconds)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(8000, 15000), () => {
      this.endCurrentWeather();
    });
  }
  
  createSleetParticles(): void {
    // Create diagonal rain/sleet effect
    const numParticles = Math.max(10, Math.floor(30 * this.particleBudgetMultiplier));
    for (let i = 0; i < numParticles; i++) {
      this.time.delayedCall(i * 50, () => {
        if (this.currentWeather !== "sleet") return;
        this.spawnSleetDrop();
      });
    }
    
    // Continuously spawn sleet
    if (this.sleetSpawnTimer) {
      this.sleetSpawnTimer.destroy();
    }
    this.sleetSpawnTimer = this.time.addEvent({
      delay: Math.floor(80 / Math.max(this.particleBudgetMultiplier, 0.35)),
      callback: () => {
        if (this.currentWeather === "sleet") {
          this.spawnSleetDrop();
        }
      },
      loop: true
    });
  }
  
  spawnSleetDrop(): void {
    const x = Phaser.Math.Between(0, this.scale.width + 100);
    const y = -20;
    const drop = this.add.rectangle(x, y, 2, 12, 0xaabbcc, 0.7);
    drop.setAngle(20); // Diagonal
    drop.setDepth(GameScene.DEPTH_WEATHER + 1);
    
    // Fall diagonally
    this.tweens.add({
      targets: drop,
      x: x - 80,
      y: this.scale.height + 20,
      duration: 600,
      ease: "Linear",
      onComplete: () => drop.destroy()
    });
  }
  
  // ========== WEATHER TYPE 3: BLIZZARD (LUMIPYRY) ==========
  startBlizzard(): void {
    this.isSnowstorm = true;

    // Heavy white overlay for visibility reduction
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0xffffff, 0.5);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1500 });
    }
    
    // Also fade in snowstorm overlay
    if (this.snowstormOverlay) {
      this.tweens.add({ targets: this.snowstormOverlay, alpha: 0.8, duration: 1500 });
    }
    
    // Play loud wind
    this.windHowlSound = utils.safeAddSound(this, "wind_howl", { volume: 0.5, loop: true });
    this.windHowlSound?.play();
    
    // Camera shake for intensity
    if (this.optionalEffectsEnabled) {
      this.cameras.main.shake(500, 0.005);
    }
    
    // Schedule end (10-20 seconds)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(10000, 20000), () => {
      this.endCurrentWeather();
    });
  }
  
  // ========== WEATHER TYPE 4: BLACK ICE (MUSTA JÄÄ) ==========
  startBlackIce(): void {
    // Player slips - reduced control
    if (this.player) {
      this.player.isSlipping = true;
    }
    
    // Subtle blue sheen overlay
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x4488cc, 0.15);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 1000 });
    }
    
    // Create ice sparkle particles
    this.createIceSparkles();
    
    // Play ice sound
    this.sound.play("ice_slip", { volume: 0.3 });
    
    // Schedule end (5-10 seconds)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(5000, 10000), () => {
      this.endCurrentWeather();
    });
  }
  
  createIceSparkles(): void {
    // Create sparkle effects on ground
    const sparkleCount = Math.max(4, Math.floor(15 * this.particleBudgetMultiplier));
    for (let i = 0; i < sparkleCount; i++) {
      const x = Phaser.Math.Between(50, this.scale.width - 50);
      const y = this.groundY - Phaser.Math.Between(0, 30);
      
      const sparkle = this.add.circle(x, y, 3, 0xaaddff, 0.8);
      sparkle.setDepth(GameScene.DEPTH_EFFECTS);
      if (this.iceParticles) this.iceParticles.add(sparkle);
      
      // Twinkle animation
      this.tweens.add({
        targets: sparkle,
        alpha: 0.2,
        duration: 300,
        yoyo: true,
        repeat: -1,
        delay: i * 100
      });
    }
  }
  
  // ========== WEATHER TYPE 5: SUN GLARE (AURINGON HÄIKÄISY) ==========
  startSunGlare(): void {
    // Flash effect pulses
    this.sunGlareFlash();
    
    // Schedule repeated flashes
    this.sunGlareFlashTimer = this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.sunGlareFlash(),
      loop: true
    });
    
    // Schedule end (2-4 second pulses over 6-12 seconds total)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(6000, 12000), () => {
      this.endCurrentWeather();
    });
  }
  
  sunGlareFlash(): void {
    if (this.currentWeather !== "sunglare") return;
    
    // Bright white flash
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0xffffee, 0.8);
      this.weatherOverlay.setAlpha(0);
      
      this.tweens.add({
        targets: this.weatherOverlay,
        alpha: 0.9,
        duration: 200,
        yoyo: true,
        hold: 800,
        onComplete: () => {
          if (this.weatherOverlay) this.weatherOverlay.setAlpha(0);
        }
      });
    }
    
    // Camera flash effect
    this.cameras.main.flash(200, 255, 255, 200, true);
  }
  
  // ========== WEATHER TYPE 6: ARCTIC FREEZE (PAKKASAALTO) ==========
  startArcticFreeze(): void {
    // Energy drains faster, but enemies also slow down
    this.weatherEnergyDrain = 8; // 8 energy per second extra drain
    this.weatherSpeedMultiplier = 0.85; // 15% slower for everyone

    // Blue-ish tint
    if (this.weatherOverlay) {
      this.weatherOverlay.setFillStyle(0x4466aa, 0.25);
      this.tweens.add({ targets: this.weatherOverlay, alpha: 1, duration: 2000 });
    }
    
    // Frost around edges
    this.drawFrostOverlay();
    
    // Play wind sound quietly
    this.windHowlSound = utils.safeAddSound(this, "wind_howl", { volume: 0.2, loop: true });
    this.windHowlSound?.play();
    
    // Create breath vapor effect on player periodically
    this.createBreathVapor();
    
    // Schedule end (15-25 seconds)
    this.weatherEndTimer = this.time.delayedCall(Phaser.Math.Between(15000, 25000), () => {
      this.endCurrentWeather();
    });
  }
  
  drawFrostOverlay(): void {
    if (!this.frostOverlay) return;
    
    this.frostOverlay.clear();
    
    // Create gradient frost effect on edges
    const w = this.scale.width;
    const h = this.scale.height;
    const edgeSize = 80;
    
    // Top edge
    this.frostOverlay.fillGradientStyle(0xaaddff, 0xaaddff, 0xaaddff, 0xaaddff, 0.4, 0.4, 0, 0);
    this.frostOverlay.fillRect(0, 0, w, edgeSize);
    
    // Bottom edge
    this.frostOverlay.fillGradientStyle(0xaaddff, 0xaaddff, 0xaaddff, 0xaaddff, 0, 0, 0.3, 0.3);
    this.frostOverlay.fillRect(0, h - edgeSize, w, edgeSize);
    
    // Left edge
    this.frostOverlay.fillGradientStyle(0xaaddff, 0xaaddff, 0xaaddff, 0xaaddff, 0.3, 0, 0.3, 0);
    this.frostOverlay.fillRect(0, 0, edgeSize, h);
    
    // Right edge
    this.frostOverlay.fillGradientStyle(0xaaddff, 0xaaddff, 0xaaddff, 0xaaddff, 0, 0.3, 0, 0.3);
    this.frostOverlay.fillRect(w - edgeSize, 0, edgeSize, h);
    
    this.tweens.add({ targets: this.frostOverlay, alpha: 1, duration: 2000 });
  }
  
  createBreathVapor(): void {
    if (this.currentWeather !== "arcticfreeze" || !this.player || this.player.isDead) return;
    
    // Create small white puff near player
    const puff = this.add.circle(
      this.player.x + 20,
      this.player.y - this.player.body.height * 0.7,
      4, 0xffffff, 0.6
    );
    puff.setDepth(GameScene.DEPTH_EFFECTS);
    
    this.tweens.add({
      targets: puff,
      x: puff.x + 30,
      y: puff.y - 15,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 800,
      onComplete: () => puff.destroy()
    });
    
    // Schedule next breath
    this.time.delayedCall(1200, () => this.createBreathVapor());
  }
  
  // Legacy toggle for backwards compatibility
  toggleWeather(): void {
    this.triggerRandomWeather();
  }
  
  updateWeather(delta: number): void {
    if (this.dynamicWeatherPulseEndsAt > 0 && this.time.now >= this.dynamicWeatherPulseEndsAt) {
      this.dynamicWeatherPulseEndsAt = 0;
      this.dynamicWeatherSpeedMultiplier = 1;
      this.dynamicWeatherEnergyDrainBonus = 0;
      this.dynamicWeatherAggroMultiplier = 1;
    }

    // Animate snowstorm/blizzard overlay
    if ((this.currentWeather === "snowstorm" || this.currentWeather === "blizzard") && this.snowstormOverlay) {
      this.snowstormOverlay.tilePositionX += 2;
      this.snowstormOverlay.tilePositionY += 3;
    }
    
    // Apply weather speed modifier to player
    const effectiveWeatherSpeedMultiplier = this.weatherSpeedMultiplier * this.dynamicWeatherSpeedMultiplier;
    if (this.player && effectiveWeatherSpeedMultiplier !== 1.0) {
      // Speed is already handled in Player update based on isSlipping for black ice
      // For other weather, we modify currentSpeed
      if (this.currentWeather === "sleet" || this.currentWeather === "arcticfreeze" || this.dynamicWeatherPulseEndsAt > this.time.now) {
        const targetSpeed = this.player.baseSpeed * effectiveWeatherSpeedMultiplier;
        if (this.player.currentSpeed > targetSpeed) {
          this.player.currentSpeed = Math.max(this.player.currentSpeed - 2.4, targetSpeed);
        } else if (this.player.currentSpeed < targetSpeed && effectiveWeatherSpeedMultiplier > 1) {
          this.player.currentSpeed = Math.min(this.player.currentSpeed + 2.2, targetSpeed);
        }
      }
    }
    
    // Apply extra energy drain during arctic freeze
    const totalWeatherDrain = this.weatherEnergyDrain + this.dynamicWeatherEnergyDrainBonus;
    if (totalWeatherDrain > 0 && this.player) {
      const drainPerFrame = totalWeatherDrain * (delta / 1000);
      this.player.energy = Math.max(0, this.player.energy - drainPerFrame);
    }
  }
  
  // ========== GHOST/RIVAL SYSTEM ==========
  
  recordGhostPosition(time: number): void {
    if (!this.isRecordingGhost) return;
    if (time - this.lastGhostRecordTime < this.ghostRecordInterval) return;
    
    this.lastGhostRecordTime = time;
    
    // Cap ghost data to prevent memory leak (max 3000 positions = 5 mins at 100ms interval)
    const MAX_GHOST_DATA = 3000;
    if (this.ghostData.length >= MAX_GHOST_DATA) {
      // Remove oldest entries when cap is reached
      this.ghostData.shift();
    }
    
    this.ghostData.push({
      x: this.player.x,
      y: this.player.y,
      time: time
    });
  }
  
  // Save ghost data to local storage for future runs
  saveGhostData(): void {
    if (this.ghostData.length === 0) return;
    
    const ghostRecord = {
      level: this.currentLevel,
      distance: this.distanceTraveled,
      score: this.player.score,
      positions: this.ghostData
    };
    
    try {
      const existingData = localStorage.getItem("laturaivo_ghost");
      const bestGhost = existingData ? JSON.parse(existingData) : null;
      
      // Only save if better than existing
      if (!bestGhost || ghostRecord.score > bestGhost.score) {
        localStorage.setItem("laturaivo_ghost", JSON.stringify(ghostRecord));
      }
    } catch (e) {
      // localStorage not available
    }
  }

  private applyFarStompRebound(enemySprite: Enemy | Boss | PeterSync | KanniBoss, isBossTarget: boolean): void {
    const awayDirection = this.player.x <= enemySprite.x ? -1 : 1;
    // Send player ~300% farther after exceeding same-target stomp limit.
    const reboundX = Math.max(1380, (Math.abs(this.player.body.velocity.x) + 180) * 3);
    const reboundY = Math.max(Math.floor(this.player.stompBounce * 1.45), 520);

    this.player.body.setVelocityX(awayDirection * reboundX);
    this.player.body.setVelocityY(-reboundY);
    this.player.isJumping = true;
    this.player.jumpSound?.play();

    if (isBossTarget) {
      // Keep boss from instantly re-attaching to player after forced rebound.
      this.bossStompReboundLockUntil = this.time.now + 900;
      (enemySprite as any).pauseChaseFor?.(900);
      enemySprite.setVelocityX(-awayDirection * 340);
    }

    this.showFloatingText(this.player.x, this.player.y - 70, "KIMPO! 3x MAX", 0xffcc66, 700);
    this.cameras.main.shake(90, 0.01);
  }

  // Track airtime for score multiplier
  updateAirtimeMultiplier(time: number): void {
    const wasInAir = this.isInAir;
    this.isInAir = !this.player.isOnGround;
    
    if (this.isInAir && !wasInAir) {
      // Just jumped - start tracking airtime, reset stomp flag for this jump
      this.airtimeStart = time;
      this.currentAirtimeMultiplier = 1;
      this.hasStompedEnemy = false; // Reset stomp flag at start of each jump
      this.stompHitsPerTargetThisAir = new WeakMap();
    } else if (this.isInAir) {
      if (this.activeRampLanding) {
        const peakHeight = Math.max(0, this.groundY - this.player.y);
        if (peakHeight > this.rampJumpPeakHeight) {
          this.rampJumpPeakHeight = peakHeight;
        }
        if (time - this.activeRampLanding.startedAt > this.activeRampLanding.maxMs + 1500) {
          this.activeRampLanding = undefined;
          this.rampJumpPeakHeight = 0;
          this.rampVolttiBonusAvailable = false;
        }
      }

      // Still in air - calculate multiplier based on time in air
      // Ilmalento bonus only activates after player has stomped on an enemy during this jump!
      if (!this.hasStompedEnemy) {
        this.currentAirtimeMultiplier = 1;
        return;
      }
      
      const airtimeDuration = time - this.airtimeStart;
      
      if (airtimeDuration >= this.airtimeBonusThreshold) {
        // Increase multiplier every 500ms in air, capped at 5x
        const bonusSteps = Math.floor((airtimeDuration - this.airtimeBonusThreshold) / 500) + 1;
        this.currentAirtimeMultiplier = Math.min(1 + bonusSteps * 0.5, 5);
        
        // Play airtime bonus sound periodically
        if (time - this.lastAirtimeBonusSound >= 600) {
          this.sound.play("airtime_bonus", { volume: 0.18 });
          this.lastAirtimeBonusSound = time;
        }
      }
    } else if (!this.isInAir && wasInAir) {
      // Just landed - calculate final airtime
      const airtimeDuration = time - this.airtimeStart;

      if (this.activeRampLanding) {
        const inWindow =
          airtimeDuration >= this.activeRampLanding.minMs &&
          airtimeDuration <= this.activeRampLanding.maxMs;
        const reachedHeight = this.rampJumpPeakHeight >= this.activeRampLanding.requiredPeakPx;

        if (inWindow && reachedHeight) {
          const riskBonus = this.activeRampLanding.riskRoute ? 80 : 0;
          const landingBonus = this.activeRampLanding.bonusScore + riskBonus;
          this.player.score += this.applyRunScoreMultiplier(landingBonus);
          this.sessionStats.perfectLandings++;
          void GameCenterAchievementManager.recordPerfectLanding();
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 12);
          this.sound.play("trick_complete", { volume: 0.26, rate: 1.18 });
          this.showFloatingText(
            this.player.x,
            this.player.y - 84,
            `PERFECT LASKU! +${landingBonus}`,
            0x66ffcc,
            1300
          );
        }

        this.activeRampLanding = undefined;
        this.rampJumpPeakHeight = 0;
        this.rampVolttiBonusAvailable = false;
      }
      
      // Track longest airtime in session
      if (airtimeDuration > this.sessionStats.longestAirtime) {
        this.sessionStats.longestAirtime = airtimeDuration;
      }
      
      // Give bonus points if airtime was long enough AND stomped during this jump
      if (this.hasStompedEnemy) {
        if (airtimeDuration >= this.airtimeBonusThreshold) {
          const airtimeBonus = Math.floor(this.currentAirtimeMultiplier * 50);
          this.player.score += this.applyRunScoreMultiplier(airtimeBonus);
        }
      }
      
      // If had a stomp combo, emit landing event with final combo stats
      if (this.stompComboCount > 0) {
        this.events.emit("stompComboEnd", {
          finalCombo: this.stompComboCount,
          multiplier: this.stompComboMultiplier
        });
        
        // Perfect landing bonus if combo was 3+
        if (this.stompComboCount >= 3) {
          this.sessionStats.perfectLandings++;
          void GameCenterAchievementManager.recordPerfectLanding();
          const landingBonus = this.stompComboCount * 25;
          this.player.score += this.applyRunScoreMultiplier(landingBonus);
        }
      }
      
      // Reset stomp combo on landing
      this.stompComboCount = 0;
      this.stompComboMultiplier = 1;
      
      // Reset multiplier and stomp flag on landing
      this.currentAirtimeMultiplier = 1;
      this.hasStompedEnemy = false;
      this.stompHitsPerTargetThisAir = new WeakMap();
    }
  }
  
  // Show stomp visual effect with combo text
  showStompEffect(x: number, y: number): void {
    if (!this.optionalEffectsEnabled && this.isMobile) return;

    const comboName = this.stompComboCount >= 3
      ? COMBO_NAMES[(this.stompComboCount - 3) % COMBO_NAMES.length]
      : "";

    // Create "STOMP!" text with combo counter
    const comboText = this.stompComboCount > 1 
      ? `STOMP x${this.stompComboCount}!${comboName ? `\n${comboName}` : ""}` 
      : "STOMP!";
    
    const textColor = this.stompComboCount >= 5 ? "#ff0000" 
      : this.stompComboCount >= 3 ? "#ff8800" 
      : "#ffff00";
    
    const stompText = this.acquireStompText();
    stompText.setPosition(x, y - 30);
    stompText.setText(comboText);
    stompText.setStyle({
      fontFamily: "PublicPixel",
      fontSize: `${20 + this.stompComboCount * 2}px`,
      color: textColor,
      stroke: "#000000",
      strokeThickness: 4
    });
    
    // Animate text floating up and fading
    this.tweens.add({
      targets: stompText,
      y: y - 80,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 600,
      ease: "Power2",
      onComplete: () => this.recycleStompText(stompText)
    });
    
    const canSpawnParticleBurst =
      !this.hardFpsEmergencyActive &&
      this.fpsEma >= (this.isMobile ? 27 : 30);
    if (canSpawnParticleBurst) {
      const fpsBudgetMultiplier = this.fpsEma < 40 ? 0.6 : this.fpsEma < 50 ? 0.8 : 1;
      const particleQuantity = Math.max(1, Math.floor((this.isMobile
        ? Math.min(3 + this.stompComboCount, 6)
        : 5 + this.stompComboCount * 2) * this.particleBudgetMultiplier * fpsBudgetMultiplier));

      for (let i = 0; i < particleQuantity; i += 1) {
        const angle = Phaser.Math.FloatBetween(Phaser.Math.DegToRad(220), Phaser.Math.DegToRad(320));
        const travel = Phaser.Math.Between(26, 70);
        const burst = this.acquireEffectCircle(
          x,
          y,
          Phaser.Math.Between(2, 5),
          0xf4fbff,
          0.88,
          GameScene.DEPTH_EFFECTS
        );

        this.tweens.add({
          targets: burst,
          x: x + Math.cos(angle) * travel,
          y: y + Math.sin(angle) * travel,
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(300, 460),
          ease: "Power2",
          onComplete: () => this.recycleEffectCircle(burst)
        });
      }
    }
  }

  checkLevelComplete(): void {
    // Check if player reached the level distance
    if (this.distanceTraveled >= this.levelDistance && !this.clubhouseSpawned) {
      // On boss levels, spawn the boss first, then clubhouse after boss is defeated
      if (this.isBossLevel && !this.bossSpawned) {
        this.spawnBoss();
        return;
      }
      
      // Only spawn clubhouse if not boss level OR boss is defeated
      if (!this.isBossLevel || this.bossDefeated) {
        this.spawnClubhouse();
      }
    }
    
    // Check if player reached the clubhouse
    if (this.clubhouse && !this.levelCompleted) {
      // Calculate the right edge of the clubhouse (origin is 0.5, so add half the display width)
      const clubhouseRightEdge = this.clubhouse.x + this.clubhouse.displayWidth / 2;
      
      // Player reaches clubhouse when their right edge touches the clubhouse's right edge
      const playerRightEdge = this.player.x + (this.player.body?.width || 0) / 2;
      
      if (playerRightEdge >= clubhouseRightEdge) {
        this.levelCompleted = true;
        this.triggerVictory();
      }
    }
  }

  // ========== ABILITY UNLOCK NOTIFICATIONS ==========
  
  /**
   * Show ability unlock notification when new abilities become available
   * - Level 2: Axe attack (X key)
   * - Level 3: Laturaivo/Rage (V key)
   * - Level 6: Dash Axe upgrade
   * - Level 5+: 1s hold charged supers (Myrskyvoltti + Supersauva, ~2s effect)
   * - Level 7: Charged super dash
   */
  showAbilityUnlockNotification(): void {
    // Determine which ability to show based on current level
    let abilityToShow: string | null = null;
    
    // Use abilityUnlockConfig to check unlock levels
    const axeUnlockLevel = abilityUnlockConfig.axeAttackUnlockLevel.value;
    const rageUnlockLevel = abilityUnlockConfig.rageUnlockLevel.value;
    const dashAxeUnlockLevel = 6; // Dash axe upgrade at level 6
    const superDashAxeUnlockLevel = 7; // Charged super dash at level 7
    const tornadoVolttiUnlockLevel = 5; // Charged tornado voltti at level 5
    const superPoleUnlockLevel = 5; // Charged super pole frenzy at level 5
    
    if (this.currentLevel === axeUnlockLevel) {
      abilityToShow = "axe";
    } else if (this.currentLevel === rageUnlockLevel) {
      abilityToShow = "rage";
    } else if (this.currentLevel === dashAxeUnlockLevel) {
      abilityToShow = "dashAxe";
    } else if (this.currentLevel === superDashAxeUnlockLevel) {
      abilityToShow = "superDashAxe";
    } else if (this.currentLevel === tornadoVolttiUnlockLevel) {
      abilityToShow = "tornadoVoltti";
    } else if (this.currentLevel === superPoleUnlockLevel) {
      abilityToShow = "superPole";
    }
    
    // Launch ability unlock UI if there's a new ability
    if (abilityToShow) {
      // Small delay to let the level start first
      this.time.delayedCall(1500, () => {
        this.scene.launch("AbilityUnlockUIScene", {
          abilityType: abilityToShow,
          gameSceneKey: this.scene.key
        });
      });
    }
  }

  // ========== BOSS SYSTEM ==========

  private stopSpawnersForBossFight(): void {
    if (this.enemySpawnTimer) {
      this.enemySpawnTimer.destroy();
      this.enemySpawnTimer = undefined;
    }
    if (this.teslaSpawnTimer) {
      this.teslaSpawnTimer.destroy();
      this.teslaSpawnTimer = undefined;
    }
    if (this.rampSpawnTimer) {
      this.rampSpawnTimer.destroy();
      this.rampSpawnTimer = undefined;
    }
    if (this.decorationSpawnTimer) {
      this.decorationSpawnTimer.destroy();
      this.decorationSpawnTimer = undefined;
    }
    if (this.powerUpSpawnTimer) {
      this.powerUpSpawnTimer.destroy();
      this.powerUpSpawnTimer = undefined;
    }
    if (this.hazardSpawnTimer) {
      this.hazardSpawnTimer.destroy();
      this.hazardSpawnTimer = undefined;
    }
    if (this.bossCameoSpawnTimer) {
      this.bossCameoSpawnTimer.destroy();
      this.bossCameoSpawnTimer = undefined;
    }
  }

  private recoverFromBossSpawnFailure(bossType: string): void {
    this.currentBoss = undefined;
    this.kanniSupportBoss = undefined;
    this.bossSpawned = false;
    this.bossActive = false;
    this.bossDefeated = false;
    this.peterKanniRescueTriggered = false;
    this.nextBossRiskRewardSpawnAt = 0;
    this.bossRiskBuffUntil = 0;
    this.bossRiskDamageMultiplier = 1;

    // Prevent immediate frame-by-frame retry loop if boss assets are broken.
    this.levelDistance += Math.max(120, Math.round(this.levelDistance * 0.08));

    this.events.emit("floatingAnnouncement", {
      text: `BOSSI (${bossType.toUpperCase()}) VIIVÄSTYI. JATKA MATKAA!`,
      duration: 1900
    });
  }

  setupBossEvents(): void {
    this.events.on("bossIntroDismissed", (data?: { level?: number }) => {
      this.onBossIntroDismissed(Number(data?.level ?? this.currentLevel));
    });

    this.events.on("bossPerfectDodge", (data?: { x?: number; y?: number }) => {
      this.triggerPerfectDodgeBossRage(data);
    });

    this.events.on("bossAttackTelegraph", (data: { kind?: string; attackName?: string }) => {
      this.lastBossTelegraphInfo = {
        kind: data?.kind || "normal",
        attackName: data?.attackName,
        at: this.time.now
      };

      const kindMap: Record<string, "normal" | "charge" | "combo" | "leap" | "barrage" | "super" | "aoe" | "hazard" | "phase"> = {
        normal: "normal",
        charge: "charge",
        combo: "combo",
        leap: "leap",
        barrage: "barrage",
        super: "super",
        aoe: "aoe",
        hazard: "hazard",
        phase: "phase"
      };
      const kind = kindMap[data?.kind || "normal"] || "normal";
      this.showBossAttackTelegraph(kind, data?.attackName);
      this.registerBossTelegraphCounter(kind);

      const liveBoss: any = this.currentBoss as any;
      const anchor = {
        x: Number(liveBoss?.x) || this.scale.width * 0.72,
        y: Number(liveBoss?.y) || this.groundY - 120
      };
      if (kind === "super" || kind === "aoe" || kind === "phase") {
        this.triggerSafeCameraPreset("boss_super", anchor);
      } else if (kind === "charge" || kind === "combo" || kind === "leap" || kind === "barrage" || kind === "hazard") {
        this.triggerSafeCameraPreset("heavy_hit", anchor);
      } else {
        this.triggerSafeCameraPreset("light_hit", anchor);
      }
    });

    this.events.on("kanniSupportDefeated", () => {
      const liveBoss = this.currentBoss;
      if (liveBoss instanceof PeterSync) {
        liveBoss.notifySupportBossDefeated(this.kanniSupportBoss);
      }
      this.kanniSupportBoss = undefined;
      this.events.emit("floatingAnnouncement", {
        text: "SPICE BOYS KAATUI - PETER JATKAA YKSIN",
        duration: 1700
      });
    });

    // Listen for boss defeated event (emitted after death animation for score tracking)
    this.events.on("bossDefeated", (data: { bossType: string; isFinalBoss: boolean; scoreValue: number }) => {
      this.clearBossTelegraph();
      this.bossDeathSequenceActive = false;
      if (this.bossDeathFinalizeTimer) {
        this.bossDeathFinalizeTimer.destroy();
        this.bossDeathFinalizeTimer = undefined;
      }
      this.bossActive = false;
      this.bossDefeated = true;
      this.bossPerfectDodgeRageUsed = false;
      this.nextBossRiskRewardSpawnAt = 0;
      this.bossRiskBuffUntil = 0;
      this.bossRiskDamageMultiplier = 1;
      if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
        this.bossRiskRewardOrb.destroy();
      }
      this.bossRiskRewardOrb = undefined;
      if (this.kanniSupportBoss?.active) {
        this.kanniSupportBoss.destroy();
      }
      this.kanniSupportBoss = undefined;
      this.peterKanniRescueTriggered = false;

      this.bossCombatTelemetry.push({
        level: this.currentLevel,
        bossType: data.bossType,
        outcome: "boss_defeated",
        phase: (this.currentBoss as any)?.currentPhase,
        attackName: this.lastBossTelegraphInfo.attackName,
        attackKind: this.lastBossTelegraphInfo.kind,
        timestamp: new Date().toISOString()
      });
      try {
        localStorage.setItem("laturaivo_boss_telemetry", JSON.stringify(this.bossCombatTelemetry.slice(-120)));
      } catch (error) {
        // Ignore storage errors.
      }

      // Add boss score (bossActive, bossDefeated, and clubhouse spawning are handled immediately in BossFSM)
      this.player.addScore(this.applyRunScoreMultiplier(data.scoreValue), this.time.now);
      void GameCenterAchievementManager.unlockBossAchievementForBossType(data.bossType);
      this.registerEnemyDefeat();

      // Boss levels now complete immediately after the boss death cinematic.
      if (this.isBossLevel && !this.levelCompleted && !this.player.isDead) {
        this.levelCompleted = true;
        this.triggerVictory();
      }
    });
  }

  spawnBoss(): void {
    if (this.bossSpawned || !this.isBossLevel) return;
    
    this.bossSpawned = true;
    this.bossActive = true; // Boss fight starts - scrolling will stop!
    this.resetBossCombatDirector();
    this.peterKanniRescueTriggered = false;
    if (this.kanniSupportBoss?.active) {
      this.kanniSupportBoss.destroy();
    }
    this.kanniSupportBoss = undefined;
    this.nextBossRiskRewardSpawnAt = this.time.now + Phaser.Math.Between(6200, 8600);
    this.bossRiskBuffUntil = 0;
    this.bossRiskDamageMultiplier = 1;
    if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
      this.bossRiskRewardOrb.destroy();
    }
    this.bossRiskRewardOrb = undefined;
    
    // Get boss config for this level
    const bossConfig = LevelManager.getBossConfig(this.currentLevel);
    if (!bossConfig) return;
    this.rememberBossCheckpoint();
    
    // Spawn boss at right side of screen - fixed position for boss fight
    const bossX = this.scale.width - 250;
    
    // Handle special boss types
    if (bossConfig.bossType === "peter_sync") {
      // PETER KANTELE - The disco figure skater boss!
      // Special handling for Ice Club Arena level
      try {
        this.spawnPeterSync(bossX, bossConfig);
      } catch (error) {
        console.error("[BossSpawnError] Failed to spawn Peter Kantele boss.", error);
        this.recoverFromBossSpawnFailure(String(bossConfig.bossType || "unknown"));
        return;
      }
    } else {
      // Standard boss types
      try {
        this.currentBoss = new Boss(
          this,
          bossX,
          this.groundY,
          this.groundY,
          bossConfig.bossType as any,
          bossConfig.isFinalBoss
        );
        
        this.enemies.add(this.currentBoss);
        this.currentBoss.setDepth(GameScene.DEPTH_ENEMIES_BASE + 5);
        
        // Screen shake + short warm flash for boss reveal.
        // Keep flash brief so intro pauses never get stuck with a full-screen red tint.
        this.cameras.main.shake(500, 0.01);
        this.cameras.main.flash(140, 255, 235, 180, true);
      } catch (error) {
        console.error(`[BossSpawnError] Failed to spawn boss type=${bossConfig.bossType} level=${this.currentLevel}.`, error);
        this.recoverFromBossSpawnFailure(String(bossConfig.bossType || "unknown"));
        return;
      }
    }

    if (!this.currentBoss || !this.currentBoss.active) {
      this.recoverFromBossSpawnFailure(String(bossConfig.bossType || "unknown"));
      return;
    }

    // Level 4 boss arena keeps base level background and adds Ravintola Torvi layer on top of it.
    if (bossConfig.bossType === "jari_litmanen") {
      this.addLevel4BossTorviBackdrop();
    }

    this.applyBossSpawnHealthAdjustments(this.currentBoss);

    // Stop normal world spawners only after a boss has been successfully created.
    this.stopSpawnersForBossFight();

    // Clear all enemies from screen for boss fight.
    this.enemies.children.each((enemy: any) => {
      if (enemy !== this.currentBoss && enemy.active) {
        enemy.destroy();
      }
      return true;
    });

    // Cancel all active power-ups when boss fight starts - no cheating!
    this.cancelPlayerPowerUps();
    
    const introRevealDelayMs = this.isMobile ? 1300 : 2000;
    const spawnedBoss: any = this.currentBoss as any;
    if (spawnedBoss?.pauseChaseFor) {
      spawnedBoss.pauseChaseFor(introRevealDelayMs + 350);
    }
    if (spawnedBoss?.setVelocityX) {
      spawnedBoss.setVelocityX(0);
    }
    if (typeof spawnedBoss?.canAttack === "boolean") {
      spawnedBoss.canAttack = false;
    }

    // Show boss physically in arena first, then display the intro card.
    this.time.delayedCall(introRevealDelayMs, () => {
      if (!this.sys.isActive()) return;
      const liveBoss: any = this.currentBoss as any;
      if (!liveBoss || !liveBoss.active || liveBoss.isDead || this.player?.isDead || this.levelCompleted) return;

      if (typeof liveBoss.canAttack === "boolean") {
        liveBoss.canAttack = true;
      }

      this.events.emit("bossSpawned", {
        bossName: bossConfig.bossNameFi,
        isFinalBoss: bossConfig.isFinalBoss,
        bossDescription: bossConfig.bossDescription || "Tyypillinen espoolainen uhka",
        bossType: bossConfig.bossType,
        bossRetryDeaths: this.bossRetryDeathsThisLevel
      });
    });
  }

  private rememberBossCheckpoint(): void {
    if (!this.isBossLevel || this.currentLevel <= 1 || this.registry.get("cheatCodeUsed") === true) {
      return;
    }

    utils.saveBossCheckpoint({
      level: this.currentLevel,
      playerName: String(this.registry.get("playerName") || ""),
      characterType: this.characterType,
      difficulty: String(this.registry.get("difficulty") || "vantaa")
    });
  }
  
  /**
   * Spawn Peter Kantele - the disco figure skater boss for Ice Club Arena
   * Special visual effects and disco arena setup
   */
  spawnPeterSync(bossX: number, bossConfig: any): void {
    // Peter fight always switches to club/disco background at boss start.
    this.createBackground("ice_club_arena_background", false);

    // Create Peter Kantele boss
    this.currentBoss = new PeterSync(
      this,
      bossX,
      this.groundY,
      this.groundY
    );
    
    this.enemies.add(this.currentBoss);
    this.currentBoss.setDepth(GameScene.DEPTH_ENEMIES_BASE + 5);
    
    // Disco entrance effects!
    // Purple/magenta flash for disco vibes
    this.cameras.main.flash(500, 255, 0, 255);
    this.cameras.main.shake(600, 0.015);

    // Keep Ice Club Arena stable even if optional disco effects fail on device/runtime.
    try {
      this.spawnDiscoBalls();
      if (!this.isMobile && !this.hardFpsEmergencyActive) {
        this.startDiscoLightingEffects();
      }
    } catch (error) {
      console.error("[PeterSyncFXError] Failed to initialize disco FX, continuing without them.", error);
    }
  }

  private applyBossSpawnHealthAdjustments(boss: Boss | PeterSync): void {
    const bossAny = boss as any;
    const rawMaxHealth = Number(bossAny?.maxHealth);
    if (!Number.isFinite(rawMaxHealth) || rawMaxHealth <= 0) return;

    const lahtiBossHealthMultiplier = this.getSelectedDifficultyTier() === "lahti"
      ? GameScene.LAHTI_BOSS_HEALTH_MULTIPLIER
      : 1;
    const retryMultiplier = Math.pow(
      GameScene.BOSS_RETRY_HEALTH_DECAY_MULTIPLIER,
      Math.max(0, this.bossRetryDeathsThisLevel)
    );
    const combinedMultiplier =
      GameScene.BOSS_BASE_HEALTH_MULTIPLIER *
      retryMultiplier *
      lahtiBossHealthMultiplier;
    const adjustedMaxHealth = Math.max(1, Math.round(rawMaxHealth * combinedMultiplier));

    bossAny.maxHealth = adjustedMaxHealth;
    bossAny.health = adjustedMaxHealth;
    if (typeof bossAny.updateHealthBar === "function") {
      bossAny.updateHealthBar();
    }
    this.events.emit("bossHealthChanged", {
      health: adjustedMaxHealth,
      maxHealth: adjustedMaxHealth
    });
  }
  
  /**
   * Spawn disco balls for the Ice Club Arena boss fight
   * Uses graphics-based disco balls for reliable display
   */
  spawnDiscoBalls(): void {
    this.discoSparkleTimers.forEach(timer => timer.destroy());
    this.discoSparkleTimers = [];

    // Spawn 3 disco balls across the arena using graphics (no texture needed)
    const discoBallPositions = [
      { x: this.scale.width * 0.2, y: 80 },
      { x: this.scale.width * 0.5, y: 60 },
      { x: this.scale.width * 0.8, y: 80 }
    ];
    
    discoBallPositions.forEach((pos, index) => {
      // Create disco ball using graphics instead of image texture
      const discoBallContainer = this.add.container(pos.x, pos.y);
      
      // Main ball body (silver/gray)
      const ballBody = this.add.circle(0, 0, 30, 0xcccccc, 1);
      discoBallContainer.add(ballBody);
      
      // Add mirror facets (small squares that sparkle)
      const facetColors = [0xffffff, 0xff00ff, 0x00ffff, 0xffff00, 0xff1493];
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 20;
        const facetX = Math.cos(angle) * radius;
        const facetY = Math.sin(angle) * radius;
        const facet = this.add.rectangle(facetX, facetY, 8, 8, facetColors[i % facetColors.length], 0.9);
        discoBallContainer.add(facet);
      }
      
      // Inner highlight circle
      const highlight = this.add.circle(-8, -8, 10, 0xffffff, 0.5);
      discoBallContainer.add(highlight);
      
      discoBallContainer.setDepth(GameScene.DEPTH_MID_DECORATIONS);
      discoBallContainer.setScrollFactor(0); // Fixed on screen
      
      // Rotate disco ball
      this.tweens.add({
        targets: discoBallContainer,
        angle: 360,
        duration: 4000 + (index * 500),
        repeat: -1,
        ease: 'Linear'
      });
      
      // Add sparkle effect
      let sparkleTimer!: Phaser.Time.TimerEvent;
      sparkleTimer = this.time.addEvent({
        delay: 500 + (index * 200),
        callback: () => {
          if (!this.bossActive || !discoBallContainer.active) {
            sparkleTimer.destroy();
            this.discoSparkleTimers = this.discoSparkleTimers.filter(timer => timer !== sparkleTimer);
            return;
          }

          // Random sparkle flash
          const randomFacet = discoBallContainer.list[Phaser.Math.Between(1, 12)] as Phaser.GameObjects.Rectangle;
          if (randomFacet) {
            this.tweens.add({
              targets: randomFacet,
              alpha: { from: 1, to: 0.3 },
              duration: 200,
              yoyo: true
            });
          }
        },
        loop: true
      });
      this.discoSparkleTimers.push(sparkleTimer);
      
      // Add to decorations for cleanup
      this.decorations.add(discoBallContainer as any);
    });
  }
  
  /**
   * Start disco lighting effects for Peter Kantele boss fight
   */
  startDiscoLightingEffects(): void {
    // Disabled: avoid spotlight-like boss overlay in final boss arena.
    if (this.discoOverlayPulseTimer) {
      this.discoOverlayPulseTimer.destroy();
      this.discoOverlayPulseTimer = undefined;
    }
    return;
  }

  triggerVictory(): void {
    if (this.currentLevel === 1) {
      utils.markTutorialCompleted();
    }
    utils.clearBossCheckpoint(this.currentLevel);
    const unlockedLevel = Math.min(LevelManager.TOTAL_LEVELS, this.currentLevel + 1);
    utils.saveCampaignProgress({
      unlockedLevel,
      playerName: String(this.registry.get("playerName") || ""),
      characterType: this.characterType,
      difficulty: String(this.registry.get("difficulty") || "vantaa")
    });

    // Reset consecutive deaths on level completion (player succeeded!)
    this.dynamicDifficulty.consecutiveDeaths = 0;
    this.bossRetryDeathsThisLevel = 0;
    
    // Stop player movement and freeze player position
    this.player.currentSpeed = 0;
    this.scrollSpeed = 0;
    this.player.setVelocity(0, 0);  // Stop all movement immediately
    this.player.body.setEnable(false);  // Disable physics body to prevent falling
    
    // Keep current level music running through the level-complete screen.
    // Music is stopped on explicit continue/menu transitions instead.
    
    // Stop all spawners
    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();
    if (this.teslaSpawnTimer) this.teslaSpawnTimer.destroy();
    if (this.rampSpawnTimer) this.rampSpawnTimer.destroy();
    if (this.decorationSpawnTimer) this.decorationSpawnTimer.destroy();
    if (this.landmarkSpawnTimer) this.landmarkSpawnTimer.destroy();
    if (this.powerUpSpawnTimer) this.powerUpSpawnTimer.destroy();
    if (this.hazardSpawnTimer) this.hazardSpawnTimer.destroy();
    if (this.bossCameoSpawnTimer) this.bossCameoSpawnTimer.destroy();
    if (this.loadoutAutoPickTimer) this.loadoutAutoPickTimer.destroy();
    if (this.weatherChangeTimer) this.weatherChangeTimer.destroy();
    if (this.ambientSnowSpawnTimer) this.ambientSnowSpawnTimer.destroy();
    if (this.ambientAcidSpawnTimer) this.ambientAcidSpawnTimer.destroy();
    if (this.ambientAcidSplashTimer) this.ambientAcidSplashTimer.destroy();
    if (this.ambientRainSpawnTimer) this.ambientRainSpawnTimer.destroy();
    if (this.sleetSpawnTimer) this.sleetSpawnTimer.destroy();
    if (this.rhythmWaveTimer) this.rhythmWaveTimer.destroy();
    if (this.weatherPulseTimer) this.weatherPulseTimer.destroy();
    if (this.doucheEventTimer) this.doucheEventTimer.destroy();
    if (this.discoOverlayPulseTimer) this.discoOverlayPulseTimer.destroy();
    this.discoSparkleTimers.forEach(timer => timer.destroy());
    this.discoSparkleTimers = [];
    this.levelEventMoments = [];
    
    // End any active weather
    if (this.currentWeather !== "clear") this.endCurrentWeather();
    
    // Save ghost data
    this.saveGhostData();
    
    // Stop tutorial and ability unlock UI scenes if they're running
    this.scene.stop("TutorialUIScene");
    this.scene.stop("AbilityUnlockUIScene");

    const dailyExcuse = pickHumorLine(this, EXCUSE_LINES, "Ladut on viistossa-V***T on juustossa!");
    this.events.emit("floatingAnnouncement", { text: dailyExcuse, duration: 900 });

    const levelGrade = this.computeLevelGradeResult();
    this.lastLevelGradeResult = levelGrade;
    if (levelGrade.bonusScore > 0) {
      this.player.score += levelGrade.bonusScore;
    }
    this.events.emit("floatingAnnouncement", {
      text: `ARVOSANA ${levelGrade.grade} ${levelGrade.bonusScore > 0 ? `+${levelGrade.bonusScore}` : ""}`,
      duration: 1700
    });
    this.time.delayedCall(260, () => {
      if (!this.sys.isActive()) return;
      const saveNotice = this.currentLevel >= LevelManager.TOTAL_LEVELS
        ? "TALLENNETTU: FINAALI LÄPÄISTY"
        : `TALLENNETTU: TASO ${unlockedLevel} AVATTU`;
      this.events.emit("floatingAnnouncement", {
        text: saveNotice,
        duration: 1600
      });
    });
    
    // Launch appropriate victory scene based on level
    this.time.delayedCall(500, () => {
      const isLastLevel = this.currentLevel >= LevelManager.TOTAL_LEVELS;
      
      if (isLastLevel) {
        // Final level complete - show game complete UI with session stats
        this.scene.launch("GameCompleteUIScene", {
          currentLevelKey: this.scene.key,
          totalDistance: this.totalDistanceTraveled,
          enemiesDefeated: this.enemiesDefeated,
          score: this.player.score,
          lives: this.lives,
          sessionStats: this.sessionStats,
          levelGrade: levelGrade.grade
        });
      } else {
        // Normal level complete - show victory UI
        this.scene.launch("VictoryUIScene", {
          currentLevelKey: this.scene.key,
          currentLevel: this.currentLevel,
          levelScore: this.player.score - this.previousScore,
          levelGrade: levelGrade.grade,
          levelGradeScore: levelGrade.score,
          levelBonusScore: levelGrade.bonusScore,
          objectiveCompleted: this.microObjectiveCompleted,
          enemiesDefeated: this.enemiesDefeated,
          totalDistance: this.totalDistanceTraveled,
          totalScore: this.player.score,
          lives: this.lives
        });
      }
      this.scene.pause();
    });
  }

  private checkGameplayAchievementThresholds(time: number): void {
    if (
      !this.achievementAirtime3sUnlocked &&
      this.isInAir &&
      this.airtimeStart > 0 &&
      time - this.airtimeStart >= 3000
    ) {
      this.achievementAirtime3sUnlocked = true;
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.airtime3s);
    }

    if (!this.achievementScore100kUnlocked && this.player.score >= 100000) {
      this.achievementScore100kUnlocked = true;
      void GameCenterAchievementManager.unlock(GAME_CENTER_ACHIEVEMENT_IDS.score100k);
    }
  }

  update(time: number, delta: number): void {
    if (this.player.isDead || this.levelCompleted) return;

    // iOS FIX: Clamp delta time to prevent physics explosions after background/foreground
    // iOS pauses JS execution when app is backgrounded, causing massive delta spikes
    const clampedDelta = Math.min(delta, 100); // Max 100ms = 10fps minimum
    this.updateAdaptiveQuality(time, clampedDelta);

    if (this.awaitingLoadoutSelection) {
      this.scrollSpeed = 0;
      this.player.currentSpeed = 0;
      this.player.setVelocity(0, 0);
      return;
    }

    this.applyStyleDecay(time);
    this.updateMicroObjective(time);
    this.updateLevelEventMoments();
    this.updateCursedPowerupState(time, clampedDelta);

    if (this.humorSpeedModifierUntil > 0 && time >= this.humorSpeedModifierUntil) {
      this.humorSpeedModifierUntil = 0;
      this.humorSpeedModifier = 1.0;
    }

    // Calculate scroll speed based on player speed
    // During boss fight, scrolling is stopped - player and boss fight in fixed arena
    if (this.bossActive) {
      this.scrollSpeed = 0;
    } else {
      this.scrollSpeed = this.player.currentSpeed * this.humorSpeedModifier;
    }
    
    // Apply distance scale to convert pixels to meters
    // With distanceScale of 0.05, 400 px/s becomes 20 m/s which feels like fast skiing
    const distanceScale = playerConfig.distanceScale?.value || 0.05;
    const distanceThisFrame = this.scrollSpeed * distanceScale * clampedDelta / 1000;
    this.distanceTraveled += distanceThisFrame;
    this.totalDistanceTraveled += distanceThisFrame;
    this.updateEnemyTauntBudget(distanceThisFrame);

    // Update player with clamped delta
    this.player.update(time, clampedDelta);
    this.applyTutorialTrainingOverrides();
    this.updateBossRiskRewardMechanics(time);
    (this.player as any).bossRiskDamageMultiplier =
      this.bossRiskDamageMultiplier * this.cursedIncomingDamageMultiplier * this.passiveIncomingDamageMultiplier;

    // Flavor status lines (low HP/energy and recovery moments).
    if (time - this.lastStatusLineAt > 5000) {
      const healthPercent = this.player.getHealthPercentage();
      const energyPercent = this.player.getEnergyPercentage();

      if (healthPercent <= 25 && !this.lowHealthWarned) {
        this.lowHealthWarned = true;
        this.lastStatusLineAt = time;
        const line = Phaser.Math.RND.pick(STATUS_LINES.hpLow);
        this.events.emit("floatingAnnouncement", { text: line, duration: 1900 });
      } else if (energyPercent <= 20 && !this.lowPowerWarned) {
        this.lowPowerWarned = true;
        this.lastStatusLineAt = time;
        const line = Phaser.Math.RND.pick(STATUS_LINES.powerLow);
        this.events.emit("floatingAnnouncement", { text: line, duration: 1900 });
      } else if (energyPercent >= 98 && this.lowPowerWarned) {
        this.lowPowerWarned = false;
        this.lastStatusLineAt = time;
        const line = Phaser.Math.RND.pick(STATUS_LINES.energyFull);
        this.events.emit("floatingAnnouncement", { text: line, duration: 1700 });
      } else if (healthPercent >= 95 && this.lowHealthWarned) {
        this.lowHealthWarned = false;
        this.lastStatusLineAt = time;
        const line = Phaser.Math.RND.pick(STATUS_LINES.powerFull);
        this.events.emit("floatingAnnouncement", { text: line, duration: 1700 });
      }
    }

    // Track airtime for multiplier system
    this.updateAirtimeMultiplier(time);

    // Check for level completion
    this.checkLevelComplete();
    
    // Check and spawn Lahti unique landmarks (Level 4 only)
    this.checkAndSpawnLahtiLandmarks();

    // Update and scroll backgrounds - seamless infinite looping (use clamped delta)
    this.backgrounds.children.each((bg: any) => {
      bg.x -= this.scrollSpeed * clampedDelta / 1000 * 0.3;
      
      // When background goes completely off-screen to the left, reposition it to the right
      if (bg.x + this.scaledBgWidth <= 0) {
        // Find the rightmost background edge
        let maxRightEdge = -Infinity;
        let rightmostBg: any = undefined;
        this.backgrounds.children.each((other: any) => {
          if (other !== bg) { // Don't include current bg in calculation
            const rightEdge = other.x + this.scaledBgWidth;
            if (rightEdge > maxRightEdge) {
              maxRightEdge = rightEdge;
              rightmostBg = other;
            }
          }
          return true;
        });
        // Position this background exactly at the rightmost edge (seamless)
        // Use floor to avoid subpixel gaps
        bg.x = Math.floor(maxRightEdge);
        if (this.shouldUseMirroredBackgroundLoop() && rightmostBg) {
          bg.setFlipX(!rightmostBg.flipX);
        }
      }
      return true;
    });
    
    // Update and scroll decorations (including clubhouse and parked teslas)
    // Use parallax multiplier for background elements (slower scroll = depth illusion)
    this.decorations.children.each((decoration: any) => {
      const parallaxMultiplier = decoration.parallaxMultiplier || 1.0;
      decoration.x -= this.scrollSpeed * clampedDelta / 1000 * parallaxMultiplier;
      if (decoration.__bossCameo) {
        this.updateBossBackgroundCameo(decoration, time, clampedDelta);
      }
      
      if (decoration.x < -200) {
        decoration.destroy();
      }
      return true;
    });
    this.updateCinematicVisualLayers(time, clampedDelta);

    // Scroll clubhouse
    if (this.clubhouse) {
      this.clubhouse.x -= this.scrollSpeed * clampedDelta / 1000;
    }

    // Update enemies (use clamped delta for physics stability)
    const enemyUpdateThisFrame = this.enemyUpdateStride <= 1 || this.frameCounter % this.enemyUpdateStride === 0;
    const secondaryUpdateThisFrame =
      this.enemyUpdateStride <= 1 || this.frameCounter % (this.enemyUpdateStride + 1) === 0;
    const offscreenUpdateMargin = this.qualityTier === "low" ? 120 : 220;
    this.enemies.children.each((enemy: any) => {
      if (enemy.active) {
        enemy.x -= this.scrollSpeed * clampedDelta / 1000;
        const shouldUpdateEnemy = enemy.x > -offscreenUpdateMargin && enemy.x < this.scale.width + offscreenUpdateMargin;
        if (shouldUpdateEnemy || enemyUpdateThisFrame) {
          enemy.update(time, clampedDelta);
        }
        
        if (enemy.x < -200) {
          enemy.destroy();
        }
      }
      return true;
    });
    this.updateEnemyCombatDynamics(time);

    // Update Teslas (use clamped delta)
    this.teslas.children.each((tesla: any) => {
      if (tesla.active) {
        const shouldUpdateTesla = tesla.x > -180 && tesla.x < this.scale.width + 260;
        if (shouldUpdateTesla && (this.qualityTier === "high" || secondaryUpdateThisFrame)) {
          tesla.update(time, clampedDelta);
        }
        
        // Remove if off screen
        if (tesla.x < -200 || tesla.x > this.scale.width + 500) {
          tesla.destroy();
        }
      }
      return true;
    });

    // Add distance score periodically
    if (Math.floor(this.distanceTraveled / 100) > Math.floor((this.distanceTraveled - distanceThisFrame) / 100)) {
      this.player.score += this.applyRunScoreMultiplier(10);
    }
    
    // Update and scroll power-ups (use clamped delta)
    this.powerUps.children.each((powerUp: any) => {
      if (powerUp.active) {
        powerUp.x -= this.scrollSpeed * clampedDelta / 1000;
        if (powerUp.x < this.scale.width + 200) {
          powerUp.update(time, clampedDelta);
        }
        
        if (powerUp.x < -100) {
          powerUp.destroy();
        }
      }
      return true;
    });

    // Update and scroll jump ramps.
    this.jumpRamps.children.each((ramp: any) => {
      if (ramp.active) {
        ramp.x -= this.scrollSpeed * clampedDelta / 1000;
        if (ramp.x < -240) {
          ramp.destroy();
        }
      }
      return true;
    });
    
    // Update and scroll hazards (use clamped delta)
    this.hazards.children.each((hazard: any) => {
      if (hazard.active) {
        hazard.x -= this.scrollSpeed * clampedDelta / 1000;
        const shouldUpdateHazard = hazard.x > -120 && hazard.x < this.scale.width + 220;
        if (hazard.update && shouldUpdateHazard && (this.qualityTier !== "low" || secondaryUpdateThisFrame)) {
          hazard.update(time, clampedDelta);
        }
        
        if (hazard.x < -300) {
          hazard.destroy();
        }
      }
      return true;
    });
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    const playerLeft = playerBody
      ? playerBody.left
      : this.player.x - this.player.displayWidth * this.player.originX;
    const playerTop = playerBody
      ? playerBody.top
      : this.player.y - this.player.displayHeight * this.player.originY;
    const playerRight = playerBody ? playerBody.right : playerLeft + this.player.displayWidth;
    const playerBottom = playerBody ? playerBody.bottom : playerTop + this.player.displayHeight;

    // Update chihuahuas (use clamped delta)
    this.chihuahuas.children.each((chihuahua: any) => {
      if (chihuahua.active) {
        chihuahua.x -= this.scrollSpeed * clampedDelta / 1000;
        const shouldUpdateChihuahua = chihuahua.x > -160 && chihuahua.x < this.scale.width + 260;
        if (shouldUpdateChihuahua && (this.qualityTier !== "low" || secondaryUpdateThisFrame)) {
          chihuahua.update(time, clampedDelta);
        }
        
        // Check leash collision manually - leash drags behind chihuahua
        const shouldProcessLeashCollision = this.qualityTier === "high" || this.frameCounter % 2 === 0;
        if (shouldProcessLeashCollision && chihuahua.leashLine && chihuahua.leashLine.active) {
          chihuahua.leashLine.x = chihuahua.x + chihuahua.leashLength / 2;

          const leashBody = chihuahua.leashLine.body as Phaser.Physics.Arcade.Body | undefined;
          leashBody?.updateFromGameObject?.();

          const leashLeft = leashBody
            ? leashBody.left
            : chihuahua.leashLine.x - chihuahua.leashLine.displayWidth * chihuahua.leashLine.originX;
          const leashTop = leashBody
            ? leashBody.top
            : chihuahua.leashLine.y - chihuahua.leashLine.displayHeight * chihuahua.leashLine.originY;
          const leashRight = leashBody ? leashBody.right : leashLeft + chihuahua.leashLine.displayWidth;
          const leashBottom = leashBody ? leashBody.bottom : leashTop + chihuahua.leashLine.displayHeight;

          if (
            playerRight > leashLeft &&
            playerLeft < leashRight &&
            playerBottom > leashTop &&
            playerTop < leashBottom
          ) {
            chihuahua.tripPlayer(this.player);
          }
        }
        
        if (chihuahua.x < -300) {
          chihuahua.destroy();
        }
      }
      return true;
    });
    
    // Update weather effects (use clamped delta)
    const shouldUpdateWeather =
      this.qualityTier === "low"
        ? this.frameCounter % 3 === 0
        : this.isMobile
          ? this.frameCounter % 2 === 0
          : true;
    if (!this.hardFpsEmergencyActive && shouldUpdateWeather) {
      this.updateWeather(clampedDelta);
      this.applyTutorialTrainingOverrides();
    }
    
    // Update ambient snowfall (use clamped delta)
    if (!this.hardFpsEmergencyActive) {
      this.updateSnowfall(clampedDelta);
    }
    
    // Update night lighting - spawn new lamp posts as player progresses
    this.updateNightLighting();
    
    // Update dynamic difficulty system (throttled - every 5 seconds)
    // Performance optimization: only check periodically
    if (time - this.lastDifficultyUpdateTime > 5000) {
      this.lastDifficultyUpdateTime = time;
      this.updateDynamicDifficulty(time, clampedDelta);
    }
    
    // Increment frame counter for throttling (reset to prevent overflow)
    this.frameCounter++;
    if (this.frameCounter > 100000) {
      this.frameCounter = 0;
    }
    
    // Record ghost position
    this.recordGhostPosition(time);
    
    // Create ski snow particles periodically (throttled to every 100ms when moving)
    // Performance optimization: use time comparison instead of modulo
    const particleInterval = this.qualityTier === "low"
      ? (this.isMobile ? 300 : 240)
      : this.qualityTier === "medium"
        ? (this.isMobile ? 220 : 160)
        : (this.isMobile ? 160 : 110);
    if (this.scrollSpeed > 100 && time - this.lastParticleTime > particleInterval) {
      this.lastParticleTime = time;
      this.createSkiSnowParticles();
    }
    
    // UX Improvement: Auto-pause game if window loses focus (but not on mobile)
    if (!this.isTouchDevice && document.hidden && !this.isPaused) {
      this.togglePause();
    }
    
    // Create power-up visual effects on player
    if (this.optionalEffectsEnabled || (!this.isMobile && this.qualityTier !== "low")) {
      this.updatePowerUpVisualEffects(time);
    }
    
    // Update boss if exists - boss stays on screen at fixed position during boss fight
    if (this.currentBoss && this.currentBoss.active) {
      // During boss fight, boss doesn't scroll away - it stays on screen!
      // Keep boss within bounds of the screen
      const minBossX = 300; // Don't let boss go too far left
      const maxBossX = this.scale.width - 100; // Don't let boss go off right side
      
      // Boss can move left/right for chasing player, but clamped to screen
      if (this.currentBoss.x < minBossX) {
        this.currentBoss.x = minBossX;
      }
      if (this.currentBoss.x > maxBossX) {
        this.currentBoss.x = maxBossX;
      }

      try {
        this.currentBoss.update(time, clampedDelta);
      } catch (error) {
        console.error("[BossUpdateError] Boss update failed; recovering by ending boss fight.", error);
        this.bossActive = false;
        this.bossDefeated = true;
        if (this.currentBoss && this.currentBoss.active) {
          this.currentBoss.destroy();
        }
        this.currentBoss = undefined;
        this.nextBossRiskRewardSpawnAt = 0;
        this.bossRiskBuffUntil = 0;
        this.bossRiskDamageMultiplier = 1;
        if (this.isBossLevel && !this.levelCompleted && !this.player.isDead) {
          this.events.emit("floatingAnnouncement", {
            text: "BOSSI KAATUI BUGIIN. TASO LÄPI.",
            duration: 1800
          });
          this.levelCompleted = true;
          this.triggerVictory();
        } else if (!this.clubhouseSpawned) {
          this.spawnClubhouse();
        }
      }
    }

    this.checkGameplayAchievementThresholds(time);
  }

  private applyTutorialTrainingOverrides(): void {
    if (!this.isTutorial || !this.player || this.player.isDead) return;
    // Tutorial should stay forgiving: all abilities available all the time.
    this.player.energy = this.player.maxEnergy;
    this.player.rage = this.player.maxRage;
    (this.player as any).axeCooldownEndsAt = 0;
    (this.player as any).volttiCooldownEndsAt = 0;
    (this.player as any).dodgeCooldownEndsAt = 0;
  }

  // ========== DYNAMIC DIFFICULTY SYSTEM ==========
  
  updateDynamicDifficulty(time: number, delta: number): void {
    // Only adjust every 5 seconds
    if (time - this.dynamicDifficulty.lastAdjustmentTime < 5000) return;
    this.dynamicDifficulty.lastAdjustmentTime = time;
    
    // Decay recent stats (fade over time)
    this.dynamicDifficulty.recentDamageTaken *= 0.7;
    this.dynamicDifficulty.recentKills *= 0.7;
    
    // Calculate performance score (0-100)
    // High kills + low damage = high performance
    // Low kills + high damage = low performance
    const killScore = Math.min(this.dynamicDifficulty.recentKills * 10, 50); // Max 50 from kills
    const damageScore = Math.max(50 - this.dynamicDifficulty.recentDamageTaken, 0); // Max 50 from avoiding damage
    this.dynamicDifficulty.performanceScore = killScore + damageScore;
    
    // Adjust difficulty based on consecutive deaths
    let deathPenalty = this.dynamicDifficulty.consecutiveDeaths * 0.1; // -0.1 per death
    deathPenalty = Math.min(deathPenalty, 0.4); // Max 40% reduction from deaths
    
    // Calculate multiplier: 0.6-1.4 range
    // High performance (80+) = 1.2-1.4 multiplier (harder)
    // Medium performance (40-80) = 0.8-1.2 multiplier (normal)
    // Low performance (<40) = 0.6-0.8 multiplier (easier)
    let newMultiplier = 0.8 + (this.dynamicDifficulty.performanceScore / 100) * 0.6;
    newMultiplier -= deathPenalty;
    
    // Clamp to valid range
    newMultiplier = Math.max(0.5, Math.min(1.5, newMultiplier));
    
    // Smooth transition (don't change too abruptly)
    const transitionSpeed = 0.1;
    this.dynamicDifficulty.difficultyMultiplier += 
      (newMultiplier - this.dynamicDifficulty.difficultyMultiplier) * transitionSpeed;
  }
  
  // Track enemy defeat - call this whenever an enemy is killed
  registerEnemyDefeat(defeatedEnemy?: any): void {
    this.enemiesDefeated++;
    void GameCenterAchievementManager.recordEnemyDefeat();
    this.dynamicDifficulty.recentKills++;
    this.addStylePoints(6);
    this.updateMicroObjective(this.time.now);
    this.recentEnemyDefeatTimes.push(this.time.now);
    if (defeatedEnemy) {
      const profile = this.getEnemyCombatProfile(defeatedEnemy);
      if (profile) {
        profile.morale = 0;
      }
    }

    const now = this.time.now;
    if (now - this.lastPlayerShoutAt >= this.playerShoutCooldownMs && Math.random() < 0.45) {
      this.lastPlayerShoutAt = now;
      const shout = Phaser.Math.RND.pick(PLAYER_SHOUTS);
      this.showFloatingText(
        this.player.x + Phaser.Math.Between(-40, 40),
        this.player.y - 140,
        shout,
        0xfff176,
        1300,
        { force: true }
      );
    }
  }
  
  // Track damage for dynamic difficulty
  trackDamageForDifficulty(damage: number): void {
    this.dynamicDifficulty.recentDamageTaken += damage;
  }
  
  // ========== LIVES SYSTEM ==========

  handlePlayerDeath(): void {
    // Play life lost sound
    this.sound.play("life_lost", { volume: 0.5 });

    if (this.bossActive) {
      const bossType = (this.currentBoss as any)?.bossType || (this.currentBoss instanceof PeterSync ? "peter_sync" : "unknown");
      const phase = (this.currentBoss as any)?.currentPhase;
      this.bossCombatTelemetry.push({
        level: this.currentLevel,
        bossType,
        outcome: "player_death",
        phase,
        attackName: this.lastBossTelegraphInfo.attackName,
        attackKind: this.lastBossTelegraphInfo.kind,
        timestamp: new Date().toISOString()
      });
      try {
        localStorage.setItem("laturaivo_boss_telemetry", JSON.stringify(this.bossCombatTelemetry.slice(-120)));
      } catch (error) {
        // Ignore storage errors.
      }
    }
    if (this.bossRiskRewardOrb && this.bossRiskRewardOrb.active) {
      this.bossRiskRewardOrb.destroy();
    }
    this.bossRiskRewardOrb = undefined;
    this.bossRiskBuffUntil = 0;
    this.bossRiskDamageMultiplier = 1;
    
    // Track consecutive deaths for dynamic difficulty
    this.dynamicDifficulty.consecutiveDeaths++;
    
    // Decrease lives
    this.lives--;
    
    // Stop all music paths and disable retry/bootstrap to prevent restart leaks.
    this.stopAllMusicPlayback();
    
    // Emit lives update event for UI
    this.events.emit("livesChanged", this.lives);
    
    if (this.lives <= 0) {
      // No more lives - GAME OVER
      this.scene.launch("GameOverUIScene", {
        currentLevelKey: this.scene.key,
        currentLevel: this.currentLevel,
        totalDistance: this.totalDistanceTraveled,
        enemiesDefeated: this.enemiesDefeated,
        score: this.player.score,
        lives: 0,
        characterType: this.characterType
      });
    } else {
      const restartAtBossFight = this.isBossLevel && this.bossActive && !this.bossDefeated;
      const nextBossRetryDeaths = restartAtBossFight ? this.bossRetryDeathsThisLevel + 1 : 0;
      // Has lives remaining - restart from level start or boss intro checkpoint.
      this.time.delayedCall(1500, () => {
        // Stop current scenes
        this.scene.stop("UIScene");
        
        // Restart the current level with remaining lives
        this.scene.restart({
          level: this.currentLevel,
          totalDistance: this.totalDistanceTraveled - this.distanceTraveled, // Remove distance from this attempt
          enemiesDefeated: this.enemiesDefeated,
          score: this.previousScore, // Reset to score before this level
          lives: this.lives,
          characterType: this.characterType,
          startAtBossFight: restartAtBossFight,
          bossRetryDeaths: nextBossRetryDeaths
        });
      });
    }
  }

  // ========== VISUAL EFFECTS ==========
  
  // Flash sprite white on hit with enhanced feedback
  flashSprite(sprite: any): void {
    // Check if sprite has setTint method (some enemy types like FamilyGroup may not have it)
    if (!sprite || typeof sprite.setTint !== 'function') {
      return;
    }
    
    // Enhanced flash effect with scale animation for better visual feedback
    sprite.setTint(0xffffff);
    const originalScale = sprite.scaleX;
    
    // Brief scale pulse for impact
    this.tweens.add({
      targets: sprite,
      scaleX: originalScale * 1.1,
      scaleY: originalScale * 1.1,
      duration: 40,
      yoyo: true,
      ease: 'Power2'
    });
    
    // Return to normal after short delay
    this.time.delayedCall(80, () => {
      if (sprite.active && typeof sprite.clearTint === 'function') {
        sprite.clearTint();
      }
    });
  }
  
  private acquireDamageText(): Phaser.GameObjects.Text {
    const reusable = this.damageTextPool.find((textObject) => !textObject.active && textObject.scene === this);
    const damageText = reusable || this.add.text(0, 0, "", {
      fontFamily: "PublicPixel",
      fontSize: "24px",
      color: "#ff4444",
      stroke: "#000000",
      strokeThickness: 4
    });

    if (!reusable) {
      damageText.setOrigin(0.5);
      damageText.setDepth(GameScene.DEPTH_EFFECTS);
      damageText.setActive(false);
      damageText.setVisible(false);
      this.damageTextPool.push(damageText);
    }

    this.tweens.killTweensOf(damageText);
    damageText.setActive(true);
    damageText.setVisible(true);
    damageText.setAlpha(1);
    damageText.setScale(1);
    return damageText;
  }

  private recycleDamageText(damageText: Phaser.GameObjects.Text): void {
    if (!damageText || !damageText.scene) return;
    this.tweens.killTweensOf(damageText);
    damageText.setActive(false);
    damageText.setVisible(false);
    damageText.setAlpha(1);
    damageText.setScale(1);
  }

  private acquireEffectCircle(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
    depth: number
  ): Phaser.GameObjects.Arc {
    const reusable = this.effectCirclePool.find((circleObject) => !circleObject.active && circleObject.scene === this);
    const circle = reusable || this.add.circle(0, 0, 2, 0xffffff, 1);

    if (!reusable) {
      circle.setActive(false);
      circle.setVisible(false);
      this.effectCirclePool.push(circle);
    }

    this.tweens.killTweensOf(circle);
    circle.setPosition(x, y);
    circle.setRadius(radius);
    circle.setFillStyle(color, alpha);
    circle.setDepth(depth);
    circle.setScale(1);
    circle.setAlpha(alpha);
    circle.setActive(true);
    circle.setVisible(true);
    return circle;
  }

  private recycleEffectCircle(circle: Phaser.GameObjects.Arc): void {
    if (!circle || !circle.scene) return;
    this.tweens.killTweensOf(circle);
    circle.setActive(false);
    circle.setVisible(false);
    circle.setAlpha(1);
    circle.setScale(1);
  }

  // Show floating damage number with type-specific colors (or heal number if isHeal=true)
  showDamageNumber(x: number, y: number, damage: number, isHeal: boolean = false, damageType: string = "contact"): void {
    const text = isHeal ? `+${damage}` : `-${damage}`;
    
    // Different colors for different damage types
    let color: string;
    if (isHeal) {
      color = "#44ff44"; // Green for healing
    } else {
      switch (damageType) {
        case "attack":
          color = "#ff0000"; // Red for direct attacks (melee/projectile)
          break;
        case "contact":
          color = "#ff8800"; // Orange for contact damage (walking into enemy)
          break;
        case "environmental":
          color = "#ffffff"; // White for environmental damage (tesla, ice, etc.)
          break;
        default:
          color = "#ff4444"; // Default red
      }
    }
    
    const damageText = this.acquireDamageText();
    damageText.setPosition(x, y);
    damageText.setText(text);
    damageText.setStyle({
      fontFamily: "PublicPixel",
      fontSize: isHeal ? "18px" : "24px",
      color: color,
      stroke: "#000000",
      strokeThickness: 4
    });
    
    // Float up and fade out
    this.tweens.add({
      targets: damageText,
      y: y - 60,
      alpha: 0,
      scale: isHeal ? 1.2 : 1.5,
      duration: isHeal ? 600 : 800,
      ease: "Power2",
      onComplete: () => this.recycleDamageText(damageText)
    });
  }
  
  // Power-up visual effect timing
  private lastPowerUpEffectTime: number = 0;
  
  // Create visual effects around player when power-ups are active
  updatePowerUpVisualEffects(time: number): void {
    if (!this.player || this.player.isDead) return;
    if (!this.optionalEffectsEnabled && this.isMobile) return;
    
    const baseEffectInterval = this.qualityTier === "low" ? 420 : this.qualityTier === "medium" ? 320 : 200;
    const fpsIntervalMultiplier = this.fpsEma < 32 ? 2.3 : this.fpsEma < 40 ? 1.8 : this.fpsEma < 50 ? 1.3 : 1;
    const effectInterval = Math.floor(baseEffectInterval * fpsIntervalMultiplier);
    if (time - this.lastPowerUpEffectTime < effectInterval) return;
    this.lastPowerUpEffectTime = time;
    if (this.isMobile && this.qualityTier !== "high" && Math.random() < 0.45) return;

    const fpsParticleBudget = this.fpsEma < 32 ? 0.2 : this.fpsEma < 40 ? 0.45 : this.fpsEma < 50 ? 0.7 : 1;
    if (fpsParticleBudget <= 0.45 && Math.random() < 0.25) return;
    
    // Speed boost effect - yellow/orange sparks trailing behind
    if (this.player.hasSpeedBoost) {
      const spark = this.acquireEffectCircle(
        this.player.x - Phaser.Math.Between(20, 40),
        this.player.y - Phaser.Math.Between(30, 70),
        Phaser.Math.Between(3, 6),
        0xffcc00,
        0.9,
        GameScene.DEPTH_PLAYER - 1
      );
      
      this.tweens.add({
        targets: spark,
        x: spark.x - 60,
        y: spark.y - Phaser.Math.Between(-10, 20),
        alpha: 0,
        scale: 0.3,
        duration: 300,
        onComplete: () => this.recycleEffectCircle(spark)
      });
    }
    
    // Salmiakki shield effect - cyan/blue rotating particles
    if (this.player.hasSalmiakkiShield) {
      const angle = (time / 200) % (Math.PI * 2);
      const radius = 45;
      
      const orbitX = this.player.x + Math.cos(angle) * radius;
      const orbitY = this.player.y - 50 + Math.sin(angle) * radius * 0.5;
      
      const shield = this.acquireEffectCircle(
        orbitX,
        orbitY,
        5,
        0x00ffff,
        0.8,
        GameScene.DEPTH_PLAYER + 1
      );
      
      this.tweens.add({
        targets: shield,
        alpha: 0,
        scale: 2,
        duration: 400,
        onComplete: () => this.recycleEffectCircle(shield)
      });
      
      // Create second orbiting particle on opposite side
      const orbitX2 = this.player.x + Math.cos(angle + Math.PI) * radius;
      const orbitY2 = this.player.y - 50 + Math.sin(angle + Math.PI) * radius * 0.5;
      
      const shield2 = this.acquireEffectCircle(
        orbitX2,
        orbitY2,
        4,
        0x88ffff,
        0.6,
        GameScene.DEPTH_PLAYER + 1
      );
      
      this.tweens.add({
        targets: shield2,
        alpha: 0,
        scale: 1.5,
        duration: 350,
        onComplete: () => this.recycleEffectCircle(shield2)
      });
    }
    
    // Rage mode effect - red flames around player
    if (this.player.isRaging) {
      const flameCount = Math.max(1, Math.floor(3 * this.particleBudgetMultiplier * fpsParticleBudget));
      for (let i = 0; i < flameCount; i++) {
        const flame = this.acquireEffectCircle(
          this.player.x + Phaser.Math.Between(-25, 25),
          this.player.y - Phaser.Math.Between(20, 80),
          Phaser.Math.Between(4, 8),
          Phaser.Math.RND.pick([0xff0000, 0xff4400, 0xff6600]),
          0.9,
          GameScene.DEPTH_PLAYER - 1
        );
        
        this.tweens.add({
          targets: flame,
          y: flame.y - 40,
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(200, 400),
          onComplete: () => this.recycleEffectCircle(flame)
        });
      }
    }
  }

  // Create ski snow particles
  createSkiSnowParticles(): void {
    if (!this.player || this.player.isDead) return;
    if (!this.player.isOnGround) return;
    
    // Only create particles when moving
    if (Math.abs(this.scrollSpeed) < 50) return;
    
    // Mobile optimization: skip 50% of particle spawns
    if (this.isMobile && Math.random() < 0.75) return;
    if (this.qualityTier === "low" && Math.random() < 0.6) return;

    const fpsParticleBudget = this.fpsEma < 32 ? 0.2 : this.fpsEma < 40 ? 0.45 : this.fpsEma < 50 ? 0.7 : 1;
    if (fpsParticleBudget <= 0.45 && Math.random() < 0.35) return;
    
    // Create a few snow particles at player's feet (fewer on mobile)
    const particleCount = Math.max(1, Math.floor((this.isMobile ? 1 : 2) * this.particleBudgetMultiplier * fpsParticleBudget));
    for (let i = 0; i < particleCount; i++) {
      const particle = this.acquireEffectCircle(
        this.player.x + Phaser.Math.Between(-20, 20),
        this.player.y + 5,
        Phaser.Math.Between(2, 5),
        0xffffff,
        0.8,
        GameScene.DEPTH_PLAYER - 1
      );
      
      this.tweens.add({
        targets: particle,
        x: particle.x - Phaser.Math.Between(20, 50),
        y: particle.y - Phaser.Math.Between(5, 20),
        alpha: 0,
        duration: Phaser.Math.Between(200, 400),
        onComplete: () => this.recycleEffectCircle(particle)
      });
    }
  }
  
  // Show warning when boss enrages from player's rage attack
  showBossEnrageWarning(): void {
    const warningText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 3,
      "BOSSI RAGEE!",
      {
        fontFamily: "PublicPixel",
        fontSize: "48px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 6
      }
    );
    warningText.setOrigin(0.5);
    warningText.setDepth(GameScene.DEPTH_EFFECTS + 50);
    warningText.setScrollFactor(0);
    
    // Dramatic animation
    this.tweens.add({
      targets: warningText,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      y: warningText.y - 50,
      duration: 1500,
      ease: "Power2",
      onComplete: () => warningText.destroy()
    });
    
    // Also show sub-text explaining the mechanic
    const subText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 3 + 60,
      "Energia x2!",
      {
        fontFamily: "PublicPixel",
        fontSize: "28px",
        color: "#ffff00",
        stroke: "#000000",
        strokeThickness: 4
      }
    );
    subText.setOrigin(0.5);
    subText.setDepth(GameScene.DEPTH_EFFECTS + 50);
    subText.setScrollFactor(0);
    
    this.tweens.add({
      targets: subText,
      alpha: 0,
      y: subText.y - 30,
      duration: 1500,
      delay: 300,
      ease: "Power2",
      onComplete: () => subText.destroy()
    });
  }
  
  // ========== MUSIC SYSTEM ==========
  private showLevelMusicTitleCard(): void {
    const locationName = this.getLevelLocationNameForLevel(this.currentLevel);
    const musicTitle = this.getMusicDisplayNameForLevel(this.currentLevel);
    const title = musicTitle
      ? `TASO ${this.currentLevel} - ${locationName}\n${musicTitle}`
      : `TASO ${this.currentLevel} - ${locationName}`;

    if (this.levelMusicTitleCard) {
      this.levelMusicTitleCard.destroy();
      this.levelMusicTitleCard = undefined;
    }

    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height - 68,
      title,
      {
        fontFamily: "PublicPixel",
        fontSize: musicTitle ? "15px" : "18px",
        color: "#ffe082",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
        lineSpacing: musicTitle ? 6 : 0
      }
    );
    text.setOrigin(0.5, 1);
    text.setScrollFactor(0);
    text.setDepth(GameScene.DEPTH_EFFECTS + 80);
    text.setAlpha(0);
    this.levelMusicTitleCard = text;

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 350,
      ease: "Sine.easeOut"
    });

    this.time.delayedCall(10000, () => {
      if (!text.active) return;
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 500,
        ease: "Sine.easeIn",
        onComplete: () => {
          if (this.levelMusicTitleCard === text) {
            this.levelMusicTitleCard = undefined;
          }
          text.destroy();
        }
      });
    });
  }

  private getLevelLocationNameForLevel(level: number): string {
    const locations: { [key: number]: string } = {
      1: "Oittaa",
      2: "Leppävaara",
      3: "Tapiola",
      4: "Lahti",
      5: "Lappi",
      6: "Oulu",
      7: "Oulu",
      8: "Fuge",
      9: "Chanelmäki",
      10: "Keilaniemi"
    };
    return locations[level] || `Taso ${level}`;
  }

  private shouldSkipTrackLandmarkForLevel(level: number): boolean {
    return this.getLevelLocationNameForLevel(level) === "Oulu";
  }

  private getMusicDisplayNameForLevel(level: number, musicKey: string = this.currentMusicKey): string | null {
    if (level === 1) {
      return "Laturaivo tutorial song (chiptune rmx)";
    }
    if (level === 2 && musicKey === "level_2_boss_theme") {
      return "Månika - Månika! Månika";
    }
    if (level === 2) {
      return "LEPPÄVAARA ANTHEM";
    }
    if (level === 3) {
      return "Elsa-Mummo - Elsa-Mummo uzittaa";
    }
    if (level === 4 && musicKey === this.level4BossThemeKey) {
      return "LATU KEISARI - Boss Fight";
    }
    if (level === 4) {
      return "Latukeisari - Latulegenda";
    }
    if (level === 5 && musicKey === this.level5BossThemeKey) {
      return "SLIIZU - Boss Fight";
    }
    if (level === 5) {
      return "LappiRAGE ANTHEM";
    }
    if (level === 6) {
      return "OuluRAGE ANTHEM";
    }
    if (level === 7) {
      return "TurkuRAGE ANTHEM";
    }
    if (level === 8) {
      return "FUGERAGE - Spanish guitar RMX";
    }
    if (level === 9) {
      return "HYSTK laturaivo RMX - Kaikki kuolee aikanansa";
    }
    if (level === 10 && musicKey === "level_10_theme") {
      return "Dj Lussu - Jytky (Bass Ventura Tilipaiva REMIX)";
    }
    if (level === 10) {
      return "Espoolainen keski-ikäinen mies - Viimeinen laturaivo";
    }
    return null;
  }

  // Get the appropriate background music key based on current level
  getMusicKeyForLevel(level: number): string {
    // Use level-specific tracks for every stage:
    // level1..10 -> dedicated tracks, 11+ -> level 10 fallback.
    const difficulty = normalizeDifficultyTier(this.registry.get("difficulty") || "vantaa");

    let defaultKey = "level_10_theme";
    if (level <= 1) defaultKey = "level_1_theme";
    else if (level === 2) defaultKey = "level_2_theme";
    else if (level === 3) defaultKey = this.resolveLevel3BossThemeKey();
    else if (level === 4) defaultKey = "level_4_theme";
    else if (level === 5) defaultKey = "level_5_theme";
    else if (level === 6) defaultKey = "level_6_theme";
    else if (level === 7) defaultKey = "level_7_theme";
    else if (level === 8) defaultKey = "level_8_theme";
    else if (level === 9) defaultKey = "level_9_theme";
    else if (level === 10) defaultKey = "level_11_theme";

    return getDifficultyLevelMusicKey(level, difficulty, defaultKey);
  }

  // ========== ESPOO DOUCHE COMEDY SYSTEM ==========
  // 10 hilarious Espoo-themed random events that make the player laugh
  
  setupEspooDoucheEvents(): void {
    // Timer to trigger random Espoo douche events
    if (this.doucheEventTimer) {
      this.doucheEventTimer.destroy();
    }
    this.doucheEventTimer = this.time.addEvent({
      delay: 5000, // Check every 5 seconds
      callback: () => this.triggerRandomDoucheEvent(),
      loop: true
    });
  }
  
  triggerRandomDoucheEvent(): void {
    if (this.player.isDead || this.levelCompleted || this.bossActive) return;
    
    const now = this.time.now;
    if (now - this.lastDoucheEventTime < this.doucheEventCooldown) return;
    
    // 40% chance to trigger an event (50% in Lahti level - more chaos!)
    const triggerChance = this.isLahtiLevel() ? 0.5 : 0.4;
    if (Math.random() > triggerChance) return;
    
    this.lastDoucheEventTime = now;
    this.incrementSarcasm(6);
    
    // LAHTI Level 4 has its own special doping scandal events!
    if (this.isLahtiLevel()) {
      const lahtiEventType = Phaser.Math.Between(1, 10);
      switch (lahtiEventType) {
        case 1: this.lahtiEvent_DopingTest(); break;
        case 2: this.lahtiEvent_HemofarmDelivery(); break;
        case 3: this.lahtiEvent_TorviRestaurant(); break;
        case 4: this.lahtiEvent_SkiJumpTower(); break;
        case 5: this.lahtiEvent_SuspiciousSyringe(); break;
        case 6: this.lahtiEvent_RadioMast(); break;
        case 7: this.lahtiEvent_SalpausselkaRace(); break;
        case 8: this.lahtiEvent_TunedCarRacing(); break;
        case 9: this.lahtiEvent_VitaminExcuse(); break;
        case 10: this.lahtiEvent_FinnishConspiracy(); break;
      }
      return;
    }
    
    // Pick random event from 18 hilarious Espoo stereotype options
    const eventType = Phaser.Math.Between(1, 18);
    
    switch (eventType) {
      case 1: this.doucheEvent_TeslaHonking(); break;
      case 2: this.doucheEvent_PadelBragging(); break;
      case 3: this.doucheEvent_HousePriceDiscussion(); break;
      case 4: this.doucheEvent_AirPodsIgnoring(); break;
      case 5: this.doucheEvent_GlutenFreeComplaining(); break;
      case 6: this.doucheEvent_KidsInFrenchSchool(); break;
      case 7: this.doucheEvent_TeslaAutopilotFail(); break;
      case 8: this.doucheEvent_ExpensiveGearFlexing(); break;
      case 9: this.doucheEvent_PTSaysSkiingIsDead(); break;
      case 10: this.doucheEvent_WestendNotEspoo(); break;
      case 11: this.doucheEvent_CryptoAdvice(); break;
      case 12: this.doucheEvent_TapiolaMall(); break;
      case 13: this.doucheEvent_StartupFounder(); break;
      case 14: this.doucheEvent_SUVParking(); break;
      case 15: this.doucheEvent_PrivateSchoolDrama(); break;
      case 16: this.doucheEvent_DesignerDogWalker(); break;
      case 17: this.doucheEvent_SummerCottage(); break;
      case 18: this.doucheEvent_BioWasteExpert(); break;
    }
  }
  
  // Event 1: Tesla honking and driver yelling "HEI SUKSIPÄSSI-HEI SUKSIPÄSSI-LATU ON AUTOILLE!"
  doucheEvent_TeslaHonking(): void {
    // Spawn a Tesla that honks extra aggressively
    const tesla = new Tesla(this, this.scale.width + 100, this.groundY, -1, this.resolveLevel7VehicleKey());
    this.teslas.add(tesla);
    tesla.setInitialVelocity();
    tesla.setDepth(GameScene.DEPTH_TESLAS);
    
    // Show the funny yell
    this.showFloatingText(
      this.scale.width - 200,
      this.groundY - 120,
      '"HEI SUKSIPÄSSI-LATU ON AUTOILLE!"',
      0xff4444,
      2500
    );
    
    // Extra honking
    this.time.delayedCall(500, () => {
      this.sound.play("tesla_horn", { volume: 0.5 });
    });
    this.time.delayedCall(1000, () => {
      this.sound.play("tesla_horn", { volume: 0.4 });
    });
  }
  
  // Event 2: Padel player yelling about how amazing padel is
  doucheEvent_PadelBragging(): void {
    const quotes = [
      '"PADEL ON PARASTA IKINÄ! SANOINKO ETTÄ PADEL ON PARASTA?"',
      '"Tennistä? LOL, Boomerhommaa"',
      '"Yök, ihmisjäte ladulla!"',
      '"Vaalislogan:Kaikille ilmainen purjevene ja golf!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      100,
      quote,
      0x00ff88,
      3000
    );
    
    // Spawn a padel player
    this.spawnPadelPlayer(this.scale.width + 50);
  }
  
  // Event 3: Someone loudly discussing house prices on the ski trail
  doucheEvent_HousePriceDiscussion(): void {
    const quotes = [
      '"Beige on mun lemppariväri!"',
      '"Neliöt kiikkuu, ja hinta on edullinen, vain 8000€ "',
      '"Brekkis, brunssi, you name it!"',
      '"Sinusta voi poikani tulla mitä tahansa: Kauppatieteilijä tai sijoitusneuvoja  "',
      '" SKI TO FAK!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2 + Phaser.Math.Between(-100, 100),
      150,
      quote,
      0xffd700,
      3500
    );
    
    // Camera slight shake for emphasis
    this.cameras.main.shake(100, 0.003);
  }
  
  // Event 4: AirPods Max wearer completely ignoring the trail
  doucheEvent_AirPodsIgnoring(): void {
    const quotes = [
      '"Koirani nimi on Tryffeli, Tryffel på svenska"',
      '"*ei reaktiota*"',
      '"Hmmm? Sanoitko jotain? Säger du något? Säger du något?"',
      '"Ootko kuunnellu tätä Podcastia? "'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn a headphone walker
    this.spawnHeadphoneWalker(this.scale.width + 50);
    
    this.time.delayedCall(500, () => {
      this.showFloatingText(
        this.scale.width - 150,
        this.groundY - 150,
        quote,
        0x88ccff,
        3000
      );
    });
  }
  
  // Event 5: Someone complaining about gluten-free options
  doucheEvent_GlutenFreeComplaining(): void {
    const quotes = [
      '"Onko täällä gluteeniton-suksivoidetta?!"',
      '"Mun nutritionisti kieltää hiilihydraatit"',
      '"Tää on KETO-latu vai?"',
      '"Missä on OATLY-koju,?!"',
      '"Ehdoton EI hiihtämiselle ilman proteiinismoothieta!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      Phaser.Math.Between(200, this.scale.width - 200),
      120,
      quote,
      0xff88ff,
      3000
    );
  }
  
  // Event 6: Bragging about kids in French language immersion school
  doucheEvent_KidsInFrenchSchool(): void {
    const quotes = [
      '"Meidän lapset on Ranskan kielikylvyssä"',
      '"Aino-Sofia puhuu jo kolmea kieltä, HÄN ON 4!"',
      '"Onni-Matias on ihan normaali nero"',
      '"Bilingual daycare maksaa vaan 2000€/kk"',
      '"IB-koulu oli SELVÄ valinta"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn a family group
    this.spawnFamily(this.scale.width + 50);
    
    this.time.delayedCall(800, () => {
      this.showFloatingText(
        this.scale.width - 180,
        this.groundY - 180,
        quote,
        0xffcc00,
        3500
      );
    });
  }
  
  // Event 7: Tesla autopilot failing hilariously
  doucheEvent_TeslaAutopilotFail(): void {
    // Spawn a Tesla that drives erratically
    const tesla = new Tesla(this, this.scale.width + 100, this.groundY, -1, this.resolveLevel7VehicleKey());
    this.teslas.add(tesla);
    tesla.setInitialVelocity();
    tesla.setDepth(GameScene.DEPTH_TESLAS);
    
    // Make it wobble like autopilot is confused
    this.tweens.add({
      targets: tesla,
      y: this.groundY - 30,
      duration: 300,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut'
    });
    
    this.showFloatingText(
      this.scale.width - 150,
      this.groundY - 100,
      '"AUTOPILOT CALCULATIONS... ERROR"',
      0xff0000,
      2500
    );
    
    this.time.delayedCall(1500, () => {
      this.showFloatingText(
        this.scale.width / 2,
        this.groundY - 80,
        '"Oura Pois ja Oksa sinne minne aurinko ei paista!"',
        0xffff00,
        2000
      );
    });
  }
  
  // Event 8: Someone flexing expensive ski gear
  doucheEvent_ExpensiveGearFlexing(): void {
    const quotes = [
      '"Nää on Fischer Carbonlite, 1200€"',
      '"Mun sukset maksoi enemmän ku sun auto"',
      '"Tää takki on Arc\'teryx, ei mikään Halti"',
      '"Nää on Swix-hanskat, KILPASARJA"',
      '"Tää hiihtokellon maksoi 800€, Roleksi 10800€, Roleksi 10800€"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn a pro skier to flex
    this.spawnProSkier(this.scale.width + 50);
    
    this.time.delayedCall(600, () => {
      this.showFloatingText(
        this.scale.width - 150,
        this.groundY - 160,
        quote,
        0x00ffff,
        3500
      );
    });
  }
  
  // Event 9: PT (Personal Trainer) says skiing is dead
  doucheEvent_PTSaysSkiingIsDead(): void {
    const quotes = [
      '"Hullut Päivät börjar imorgon!"',
      '"Mikset oo crossfitissä niinku normaali Finlandsvensk?"',
      '"Hiihto EI kehitä corea tarpeeks!"',
      '"Hei oletko jo kokeillut joogaa Porce-liikkeesä autojen välissä?"',
      '"Hiihto? Missä on PROGRESSIVE OVERLOAD?"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      100,
      quote,
      0xff8800,
      3500
    );
    
    // Small screen pulse for drama
    this.cameras.main.flash(100, 255, 100, 0, true);
  }
  
  // Event 10: "We don't live in Espoo, we live in WESTEND"
  doucheEvent_WestendNotEspoo(): void {
    const quotes = [
      '"PILATES AND PADEL!"',
      '"Anteeksi, kerroinko jo että asun Westendissä?"',
      '"Oulu on jo vähän... noh...Matinkylässä asumista Westendin hinnoillaMatinkylässä asumista Westendin hinnoilla"',
      '"Tapiola pitäisi purkaa ja rakentaa tilalle isompi kauppakeskus!"',
      '"Olarilaista-ehdottoman maanlaista, jos olet tiellä ole hyvä ja vaihda kaistaa!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      120,
      quote,
      0xff66ff,
      4000
    );
    
    // Dramatic pause effect
    this.time.timeScale = 0.5;
    this.time.delayedCall(300, () => {
      this.time.timeScale = 1;
    });
  }
  
  // Event 11: Crypto bro giving unsolicited investment advice
  doucheEvent_CryptoAdvice(): void {
    const quotes = [
      '"Ootkos miettiny cryptoo? Mä voin neuvoo"',
      '"BITCOIN ON TULEVAISUUS, sheeple!"',
      '"Mun portfolio on -80% mut se on STRATEGIA"',
      '"HODL! Tää on vaan market correction"',
      '"Tämä on ENNÄTYSKVARTAALI"',
      '"Tää kurssi SKY-RAKETOI!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      110,
      quote,
      0xf7931a,
      3500
    );
    
    this.cameras.main.flash(100, 247, 147, 26, true);
  }
  
  // Event 12: Tapiola shopping center obsession
  doucheEvent_TapiolaMall(): void {
    const quotes = [
      '"Tesla on huono auto, ei voi ajaa lappiin!"',
      '"Jätte fina ski-byxor!"',
      '"Stokkassa iskän rinnakkaiskortti on kätevä"',
      '"Verkkokauppa.com on meidän pyhättö"',
      '"Emmäksen tunnen, käyn vaan Isossa Omenassa"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      Phaser.Math.Between(200, this.scale.width - 200),
      130,
      quote,
      0x00aaff,
      3500
    );
  }
  
  // Event 13: Startup founder who mentions it constantly
  doucheEvent_StartupFounder(): void {
    const quotes = [
      '"Mun startup sai just pre-seed fundingin"',
      '"Oon perustaja, CTO ja hallituksen pj"',
      '"Pivotoidaan hiihto AI-pohjaiseks!"',
      '"Illalla tulee miesten lätkää telkkarista"',
      '"Mä disruptoin hiihtoalaa, stealth-modessa"',
      '"Meidän valuaatio on 10 miljoonaa... kuulitko 10 miljoonaa... melkein"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2 + Phaser.Math.Between(-80, 80),
      100,
      quote,
      0x00ff00,
      3500
    );
  }
  
  // Event 14: SUV parked on the ski trail
  doucheEvent_SUVParking(): void {
    const quotes = [
      '"HAVUJA PIRKALE!"',
      '"Pyörällä ajaa vaan urheilijat ja persaukiset!"',
      '"Kokoomus! Kokoomus! Kokoomus!"',
      '"Mä oon vaan hakemassa lasta, RELAX!"',
      '"Ei BMW:ssäni ole vilkkuja"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn a Tesla as the SUV
    const tesla = new Tesla(this, this.scale.width + 100, this.groundY, -1, this.resolveLevel7VehicleKey());
    this.teslas.add(tesla);
    tesla.setInitialVelocity();
    tesla.setDepth(GameScene.DEPTH_TESLAS);
    
    this.showFloatingText(
      this.scale.width - 180,
      this.groundY - 130,
      quote,
      0xff6600,
      3000
    );
  }
  
  // Event 15: Private school drama
  doucheEvent_PrivateSchoolDrama(): void {
    const quotes = [
      '"Koulun VANHEMPAINYHDISTYS on sota-alue!"',
      '"Kuka päättää pikkujoulujen teeman?!"',
      '"Lapsemme sai B+, tää on KATASTROFI!"',
      '"Opettaja EI YMMÄRRÄ Ollin lahjakkuutta"',
      '"Rehtori kuulee tästä, LUOTA SIIHEN!"',
      '"Steinerilläkin on omat haasteensa..."'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      120,
      quote,
      0xff88aa,
      3500
    );
    
    this.cameras.main.shake(150, 0.004);
  }
  
  // Event 16: Designer dog walker blocking the trail
  doucheEvent_DesignerDogWalker(): void {
    const quotes = [
      '"Hugo-Maximus tarvitsee TILAA!"',
      '"Labradoodle on hypoallergeeninen, KIITOS"',
      '"Koira maksoi 3000€, kyllä se SAA olla ladulla"',
      '"Meidän Bichonfrisee on influensseri, 5k seuraajaa"',
      '"KAKKAPUSSI? Se on luonnonmukaista lannoitetta!"',
      '"Koira ON perheenjäsen!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      Phaser.Math.Between(200, this.scale.width - 200),
      this.groundY - 160,
      quote,
      0xffaacc,
      3500
    );
  }
  
  // Event 17: Summer cottage one-upmanship
  doucheEvent_SummerCottage(): void {
    const quotes = [
      '"Ei, en käytä julkinen kulkuneuvo. Olenhan yli 30 vuotias."',
      '"Mökki? Tarkoitatko kesäasunto saaristossa?"',
      '"Mennään Chamonix på hiihtoloma"',
      '"Herregud, senkin yksikielinen juntti!"',
      '"Rapujuhlaan enään muutama kuukausi, skål på den saken!"',
      '"Mökkitie on yksityinen, mene pois köyhä!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      110,
      quote,
      0x88ff88,
      3500
    );
  }
  
  // Event 18: Bio waste expert lecturing everyone
  doucheEvent_BioWasteExpert(): void {
    const quotes = [
      '"LAITTOIKO TUO MUOVIN BIOJÄTTEESEEN?!"',
      '"Kompostointi on elämäntapa, ei harrastus"',
      '"Kierrätyspiste on 50m, SINNE KIPINKAPIN!"',
      '"Facebook puskaradiot, here i come!"',
      '"Tää suksenvoide EI OO biopohjaista!"',
      '"EI MINUN TAKAPIHALLANI!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      Phaser.Math.Between(200, this.scale.width - 200),
      130,
      quote,
      0x00cc00,
      3500
    );
    
    this.cameras.main.flash(100, 0, 200, 0, true);
  }
  
  // ========== LAHTI LEVEL 4 EXCLUSIVE EVENTS ==========
  // Parody of the infamous 2001 Lahti doping scandal
  
  // Lahti Event 1: Doping test announcement
  lahtiEvent_DopingTest(): void {
    const quotes = [
      '"DOPINGTESTI ALKAA! JUOSKAA!"',
      '"KIKKELIS-KOKKELIS! MITÄS LÄKSIT?"',
      '"Doupit jemmaan!"',
      '"Onks mitää EPO:i hanassa?"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      100,
      quote,
      0xff0000,
      3500
    );
    
    // Spawn extra pro skiers running away
    this.spawnProSkier(this.scale.width + 50);
    this.spawnProSkier(this.scale.width + 150);
    
    // Alarm effect
    this.cameras.main.flash(200, 255, 0, 0, true);
  }
  
  // Lahti Event 2: Hemofarm delivery truck reference
  lahtiEvent_HemofarmDelivery(): void {
    const quotes = [
      '"Ei, tämä ei ole starttipistooli"',
      '"Vitamiinitoimitus täällä!"',
      '"VÄISTÄ SPURGU!"',
      '"Tää on vaan... rautalisää!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn a tuned car as "delivery truck"
    const tunedCar = new TunedCar(this, this.scale.width + 100, this.groundY, -1);
    this.teslas.add(tunedCar);
    tunedCar.setInitialVelocity();
    tunedCar.setDepth(GameScene.DEPTH_TESLAS);
    
    this.showFloatingText(
      this.scale.width - 180,
      this.groundY - 120,
      quote,
      0xff8800,
      3000
    );
  }
  
  // Lahti Event 3: Ravintola Torvi reference
  lahtiEvent_TorviRestaurant(): void {
    const quotes = [
      '"Torvi on auki! Juomaan!"',
      '"Kuka maksaa kierroksen?"',
      '"JOU MÄÄN- CHIGAAGOO!!"',
      '"Mitalikahvit Torvessa!"',
      '"ANT BREW:n bisset pärisee!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      120,
      quote,
      0xffdd00,
      3500
    );
    
    // Spawn drunk people celebrating
    this.spawnDrunk(this.scale.width + 50);
    this.spawnDrunk(this.scale.width + 120);
  }
  
  // Lahti Event 4: Ski jump tower sighting
  lahtiEvent_SkiJumpTower(): void {
    const quotes = [
      '"Sytytin just littipatsaan tuleen"',
      '"Mäkihyppy on oikeaa urheilua!"',
      '"HALUUTKO SÄ TURPAAN?"',
      '"Tornit on Lahden symboli!"',
      '"Janne Ahonen kävi tuolla aamu-Jannella"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      80,
      quote,
      0x00ccff,
      3000
    );
    
    // Camera shake for drama
    this.cameras.main.shake(100, 0.003);
  }
  
  // Lahti Event 5: Suspicious syringe found
  lahtiEvent_SuspiciousSyringe(): void {
    const quotes = [
      '"Mikä tää neula on?!"',
      '"Se on... vitamiinipiikki!"',
      '"Kenen EPO-ruisku tää on?!"',
      '"Tää on B-vitamiinia, luota muhun!"',
      '"Piilota se nopeesti!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      Phaser.Math.Between(200, this.scale.width - 200),
      this.groundY - 150,
      quote,
      0x00ff00,
      3500
    );
    
    // Spawn a power-up (doping themed in Lahti)
    const powerUpX = this.scale.width + 80;
    const powerUpY = this.groundY - Phaser.Math.Between(50, 100);
    this.spawnLahtiPowerUp(powerUpX, powerUpY);
  }
  
  // Lahti Event 6: Radio mast landmark
  lahtiEvent_RadioMast(): void {
    const quotes = [
      '"Radiomasto näkyy! Ollaan lähellä!"',
      '"Suurin radiomasto Suomessa!"',
      '"Masto on 150m korkea!"',
      '"Näkyy kauas Salpausselälle!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      100,
      quote,
      0x8888ff,
      3000
    );
  }
  
  // Lahti Event 7: Salpausselkä race start
  lahtiEvent_SalpausselkaRace(): void {
    const quotes = [
      '"SALPAUSSELÄN KISAT ALKAA!"',
      '"Pujotellaan stadionille!"',
      '"Kaikki kilpailuun!"',
      '"Salpausselkä 2001 nevö föget"',
      '"Maailmancup-tunnelmaa!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      90,
      quote,
      0xffff00,
      3500
    );
    
    // Spawn multiple pro skiers for race atmosphere
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 300, () => {
        this.spawnProSkier(this.scale.width + 50 + i * 80);
      });
    }
    
    this.cameras.main.flash(150, 255, 255, 0, true);
  }
  
  // Lahti Event 8: Tuned car racing (Lahti car culture)
  lahtiEvent_TunedCarRacing(): void {
    const quotes = [
      '"BENSALENKKARI WARNING!"',
      '"Kuka viritti tän Corollan?!"',
      '"Bassot soi, latu tärisee!"',
      '"Lahden parkkipaikka-rallii!"',
      '"TORI-TUUNING!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    // Spawn tuned car
    const tunedCar = new TunedCar(this, this.scale.width + 100, this.groundY, -1);
    this.teslas.add(tunedCar);
    tunedCar.setInitialVelocity();
    tunedCar.setDepth(GameScene.DEPTH_TESLAS);
    
    this.showFloatingText(
      this.scale.width - 150,
      this.groundY - 100,
      quote,
      0xff00ff,
      3000
    );
    
    // Extra horn/sound effect
    this.sound.play("tesla_horn", { volume: 0.4 });
  }
  
  // Lahti Event 9: Vitamin excuse
  lahtiEvent_VitaminExcuse(): void {
    const quotes = [
      '"Ei ollu dopingia, vaan vitamiineja!"',
      '"Lääkäri määräs!"',
      '"Salppuri silpuks!"',
      '"Se oli vaan proteiinijuoma!"',
      '"Kaikki käyttää, mä jäin vaan kiinni!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      120,
      quote,
      0xffaa00,
      4000
    );
    
    this.time.timeScale = 0.5;
    this.time.delayedCall(300, () => {
      this.time.timeScale = 1;
    });
  }
  
  // Lahti Event 10: Finnish conspiracy theory
  lahtiEvent_FinnishConspiracy(): void {
    const quotes = [
      '"Tää on salaliitto Suomea vastaan!"',
      '"Norjalaiset lavasti tän!"',
      '"Ruotsalaiset haluu meidät ulos!"',
      '"WADA vihaa suomalaisia!"',
      '"Media liioittelee!"',
      '"Suomi-neito itkee!"'
    ];
    const quote = Phaser.Math.RND.pick(quotes);
    
    this.showFloatingText(
      this.scale.width / 2,
      100,
      quote,
      0xff4444,
      4000
    );
    
    this.cameras.main.shake(200, 0.005);
    this.cameras.main.flash(100, 255, 100, 100, true);
  }
  
  // Helper: Restore health on enemy kill (1% of max health)
  restoreHealthOnKill(): void {
    const restorePercent = playerConfig.healthRestoreOnKill.value;
    const restoreAmount = Math.floor(this.player.maxHealth * (restorePercent / 100));
    
    if (restoreAmount > 0 && this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.health + restoreAmount, this.player.maxHealth);
      
      // Show small green floating text for health restore
      this.showDamageNumber(this.player.x, this.player.y - 80, restoreAmount, true);
    }
  }

  private restoreHealthFromBossCombatAction(actionType: "pole" | "stomp"): void {
    if (!this.player || this.player.isDead) return;
    if (!this.bossActive || this.bossDefeated) return;
    if (this.player.health >= this.player.maxHealth) return;
    if (actionType === "pole") {
      const now = this.time.now;
      if (now - this.lastBossPoleHealAt < 2800) return;
      this.lastBossPoleHealAt = now;
    }

    const restorePercent = actionType === "stomp" ? 2 : 1;
    const restoreAmount = Math.max(1, Math.round(this.player.maxHealth * (restorePercent / 100)));
    this.player.health = Math.min(this.player.maxHealth, this.player.health + restoreAmount);
    this.showDamageNumber(this.player.x, this.player.y - 88, restoreAmount, true);
  }

  private acquireFloatingText(): Phaser.GameObjects.Text {
    const reusable = this.floatingTextPool.find((textObject) => !textObject.active && textObject.scene === this);
    const floatingText = reusable || this.add.text(0, 0, "", {
      fontFamily: "PublicPixel",
      fontSize: "18px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      align: "center"
    });

    if (!reusable) {
      floatingText.setOrigin(0.5);
      floatingText.setDepth(GameScene.DEPTH_EFFECTS);
      floatingText.setScrollFactor(0);
      floatingText.setActive(false);
      floatingText.setVisible(false);
      this.floatingTextPool.push(floatingText);
    }

    this.tweens.killTweensOf(floatingText);
    floatingText.setActive(true);
    floatingText.setVisible(true);
    floatingText.setAlpha(1);
    floatingText.setScale(1);
    return floatingText;
  }

  private acquireStompText(): Phaser.GameObjects.Text {
    const reusable = this.stompTextPool.find((textObject) => !textObject.active && textObject.scene === this);
    const stompText = reusable || this.add.text(0, 0, "", {
      fontFamily: "PublicPixel",
      fontSize: "20px",
      color: "#ffff00",
      stroke: "#000000",
      strokeThickness: 4,
      align: "center"
    });

    if (!reusable) {
      stompText.setOrigin(0.5, 0.5);
      stompText.setDepth(GameScene.DEPTH_EFFECTS);
      stompText.setActive(false);
      stompText.setVisible(false);
      this.stompTextPool.push(stompText);
    }

    this.tweens.killTweensOf(stompText);
    stompText.setActive(true);
    stompText.setVisible(true);
    stompText.setAlpha(1);
    stompText.setScale(1);
    return stompText;
  }

  private recycleStompText(stompText: Phaser.GameObjects.Text): void {
    if (!stompText || !stompText.scene) return;
    this.tweens.killTweensOf(stompText);
    stompText.setActive(false);
    stompText.setVisible(false);
    stompText.setAlpha(1);
    stompText.setScale(1);
  }

  private recycleFloatingText(floatingText: Phaser.GameObjects.Text): void {
    if (!floatingText || !floatingText.scene) return;
    this.tweens.killTweensOf(floatingText);
    const index = this.activeFloatingTexts.indexOf(floatingText);
    if (index > -1) {
      this.activeFloatingTexts.splice(index, 1);
    }
    floatingText.setActive(false);
    floatingText.setVisible(false);
    floatingText.setAlpha(1);
    floatingText.setScale(1);
  }
  
  // Helper: Show floating text with style
  showFloatingText(
    x: number,
    y: number,
    text: string,
    color: number,
    duration: number,
    options?: { force?: boolean }
  ): void {
    const sanitizedText = sanitizePlayerFacingText(text);
    if (!sanitizedText) return;
    const force = options?.force === true;

    // Skip floating texts in the top area (below y=200) to avoid cluttering the UI
    // This filters out the "Espoo douche" quote events while keeping combat-related texts
    if (!force && y < 200) {
      return;
    }

    const isCriticalHint = sanitizedText.includes("EI TOIMI BOSSILLA");
    if (!isCriticalHint && !force && !FLAVOR_TEXT_ENABLED) {
      return;
    }
    if (!isCriticalHint && !force && Math.random() > this.floatingTextChance) {
      return;
    }

    if (this.activeFloatingTexts.length >= this.maxFloatingTexts) {
      const oldest = this.activeFloatingTexts.shift();
      if (oldest && oldest.active) {
        this.recycleFloatingText(oldest);
      }
    }
    
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const floatingText = this.acquireFloatingText();
    floatingText.setPosition(x, y);
    floatingText.setText(sanitizedText);
    floatingText.setColor(colorHex);
    
    // Add to active list
    this.activeFloatingTexts.push(floatingText);
    
    // Pop in animation
    floatingText.setScale(0);
    this.tweens.add({
      targets: floatingText,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
    
    // Float up and fade out
    this.tweens.add({
      targets: floatingText,
      y: y - 40,
      alpha: 0,
      duration: duration,
      delay: duration * 0.6,
      ease: 'Power2',
      onComplete: () => {
        this.recycleFloatingText(floatingText);
      }
    });
  }

  // Create landing dust puff
  createLandingEffect(): void {
    if (!this.player) return;
    if (!this.optionalEffectsEnabled && this.isMobile) return;
    
    // Create multiple particles for dust puff
    const dustBase = this.isMobile ? 4 : 8;
    const dustCount = Math.max(2, Math.floor(dustBase * this.particleBudgetMultiplier));
    for (let i = 0; i < dustCount; i++) {
      const angle = (i / 8) * Math.PI; // Semi-circle
      const speed = Phaser.Math.Between(30, 60);
      
      const particle = this.add.circle(
        this.player.x,
        this.player.y,
        Phaser.Math.Between(4, 10),
        0xe8e8e8,
        0.9
      );
      particle.setDepth(GameScene.DEPTH_PLAYER - 1);
      
      this.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * speed,
        y: particle.y - Math.sin(angle) * Phaser.Math.Between(10, 30),
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: "Power2",
        onComplete: () => particle.destroy()
      });
    }
    
    // Play land sound
    utils.playManagedSound(this, "pole_strike", { volume: 0.15 });
  }

  shutdown(): void {
    if (typeof window !== "undefined" && this.dramaticSlowMoTimeoutId) {
      window.clearTimeout(this.dramaticSlowMoTimeoutId);
      this.dramaticSlowMoTimeoutId = undefined;
    }
    this.dramaticSlowMoEndsAt = 0;
    this.time.timeScale = 1;

    if (this.dramaticCameraReturnTimer) {
      this.dramaticCameraReturnTimer.destroy();
      this.dramaticCameraReturnTimer = undefined;
    }
    if (this.dramaticCameraTween) {
      this.dramaticCameraTween.remove();
      this.dramaticCameraTween = undefined;
    }
    if (this.safeCameraPresetTween) {
      this.safeCameraPresetTween.remove();
      this.safeCameraPresetTween = undefined;
    }
    if (this.safeCameraPresetResetTimer) {
      this.safeCameraPresetResetTimer.destroy();
      this.safeCameraPresetResetTimer = undefined;
    }
    if (this.bossDeathFinalizeTimer) {
      this.bossDeathFinalizeTimer.destroy();
      this.bossDeathFinalizeTimer = undefined;
    }
    this.clearBossTelegraph();
    this.bossDeathSequenceActive = false;

    // Destroy all timers
    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();
    if (this.teslaSpawnTimer) this.teslaSpawnTimer.destroy();
    if (this.rampSpawnTimer) this.rampSpawnTimer.destroy();
    if (this.decorationSpawnTimer) this.decorationSpawnTimer.destroy();
    if (this.landmarkSpawnTimer) this.landmarkSpawnTimer.destroy();
    if (this.powerUpSpawnTimer) this.powerUpSpawnTimer.destroy();
    if (this.hazardSpawnTimer) this.hazardSpawnTimer.destroy();
    if (this.bossCameoSpawnTimer) this.bossCameoSpawnTimer.destroy();
    if (this.weatherChangeTimer) this.weatherChangeTimer.destroy();
    if (this.weatherEndTimer) this.weatherEndTimer.destroy();
    if (this.sunGlareFlashTimer) this.sunGlareFlashTimer.destroy();
    if (this.ambientSnowSpawnTimer) this.ambientSnowSpawnTimer.destroy();
    if (this.ambientAcidSpawnTimer) this.ambientAcidSpawnTimer.destroy();
    if (this.ambientAcidSplashTimer) this.ambientAcidSplashTimer.destroy();
    if (this.ambientRainSpawnTimer) this.ambientRainSpawnTimer.destroy();
    if (this.sleetSpawnTimer) this.sleetSpawnTimer.destroy();
    if (this.doucheEventTimer) this.doucheEventTimer.destroy();
    if (this.discoOverlayPulseTimer) this.discoOverlayPulseTimer.destroy();
    this.discoSparkleTimers.forEach(timer => timer.destroy());
    this.discoSparkleTimers = [];
    
    // Stop all music paths and disable retry/bootstrap before teardown.
    this.stopAllMusicPlayback({ destroyBackgroundMusic: true });
    if (this.windHowlSound) this.windHowlSound.stop();
    this.data.remove("combatSfxManager");
    this.combatSfx?.destroy();
    this.combatSfx = undefined;
    
    // Save ghost data
    this.saveGhostData();
    
    // Remove all event listeners to prevent stacking
    this.events.off("rageActivated");
    this.events.off("rageGained");
    this.events.off("playerHit");
    this.events.off("powerUpCollected");
    this.events.off("volttiAreaAttack");
    this.events.off("bossDefeated");
    this.events.off("bossAttackTelegraph");
	    this.events.off("bossIntroDismissed");
	    this.events.off("bossPerfectDodge");
	    this.events.off("kanniSupportDefeated");
	    this.removeKeyboardInputListener();
	    this.events.off("touchInput");
    this.events.off("attackPerformed");
    this.events.off("trickComplete");
    
    // Destroy all game object groups properly
    if (this.enemies) {
      this.enemies.children.each((enemy: any) => {
        if (enemy && enemy.destroy) {
          enemy.destroy();
        }
        return true;
      });
      this.enemies.clear(true, true);
    }
    
    if (this.teslas) {
      this.teslas.children.each((tesla: any) => {
        if (tesla && tesla.destroy) {
          tesla.destroy();
        }
        return true;
      });
      this.teslas.clear(true, true);
    }

    if (this.jumpRamps) {
      this.jumpRamps.children.each((ramp: any) => {
        if (ramp && ramp.destroy) {
          ramp.destroy();
        }
        return true;
      });
      this.jumpRamps.clear(true, true);
    }
    
    if (this.powerUps) {
      this.powerUps.children.each((powerUp: any) => {
        if (powerUp && powerUp.destroy) {
          powerUp.destroy();
        }
        return true;
      });
      this.powerUps.clear(true, true);
    }
    
    if (this.hazards) {
      this.hazards.children.each((hazard: any) => {
        if (hazard && hazard.destroy) {
          hazard.destroy();
        }
        return true;
      });
      this.hazards.clear(true, true);
    }
    
    if (this.chihuahuas) {
      this.chihuahuas.children.each((chihuahua: any) => {
        if (chihuahua && chihuahua.destroy) {
          chihuahua.destroy();
        }
        return true;
      });
      this.chihuahuas.clear(true, true);
    }
    
    if (this.decorations) {
      this.decorations.clear(true, true);
    }
    
    if (this.backgrounds) {
      this.backgrounds.clear(true, true);
    }

    this.cinematicParallaxBands.forEach((band) => {
      if (band?.node?.scene) {
        band.node.destroy();
      }
    });
    this.cinematicParallaxBands = [];

    this.cinematicDustMotes.forEach((mote) => {
      if (mote?.scene) {
        mote.destroy();
      }
    });
    this.cinematicDustMotes = [];

    this.cinematicColorOverlay?.destroy();
    this.cinematicColorOverlay = undefined;
    this.cinematicStrobeOverlay?.destroy();
    this.cinematicStrobeOverlay = undefined;
    this.cinematicTopGradient?.destroy();
    this.cinematicTopGradient = undefined;
    this.cinematicBottomGradient?.destroy();
    this.cinematicBottomGradient = undefined;

    if (this.level4BossTorviBackdrop) {
      this.level4BossTorviBackdrop.destroy();
      this.level4BossTorviBackdrop = undefined;
    }
    
    this.clearWeatherParticles(true);
    
    if (this.iceParticles) {
      this.iceParticles.clear(true, true);
    }
    
    // Clean up pooled text/effect objects
    this.floatingTextPool.forEach((text) => {
      if (text && text.scene) {
        text.destroy();
      }
    });
    this.floatingTextPool = [];

    this.stompTextPool.forEach((text) => {
      if (text && text.scene) {
        text.destroy();
      }
    });
    this.stompTextPool = [];

    this.damageTextPool.forEach((text) => {
      if (text && text.scene) {
        text.destroy();
      }
    });
    this.damageTextPool = [];

    this.effectCirclePool.forEach((circle) => {
      if (circle && circle.scene) {
        circle.destroy();
      }
    });
    this.effectCirclePool = [];

    this.activeFloatingTexts = [];
    
    // Destroy player shadow
    if (this.player && this.player.shadow) {
      this.player.shadow.destroy();
    }
    
    // Destroy clubhouse if exists
    if (this.clubhouse) {
      this.clubhouse.destroy();
      this.clubhouse = undefined;
    }
    
    // Clear boss reference
    this.currentBoss = undefined;
    this.kanniSupportBoss = undefined;
    this.peterKanniRescueTriggered = false;
  }
}
