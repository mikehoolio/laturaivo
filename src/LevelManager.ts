import { normalizeDifficultyTier } from "./content/DifficultyPresentation";
import { resolvePlatformVideoUrl } from "./platform";

/**
 * Level Manager - Manages game level order and navigation
 * 10 official levels with escalating difficulty
 * Boss levels: 2, 3, 4, 5, 6, 7, 8 (mini-bosses), 9 (Peter Kantele), 10 (official final boss Iso Timo)
 */
export class LevelManager {
  static readonly LAHTI_DISTANCE_BONUS = 400;
  // Boss level configuration - Finnish celebrity parody bosses!
  static readonly BOSS_LEVELS: { [level: number]: BossConfig } = {
    2: {
      bossType: "marja_liisa",
      bossName: "Månika Stensvik",
      bossNameFi: "Månika Stensvik",
      bossDescription: "Månikalle ei paljon vattuilla. Nelikymppinen äitiraivo syöksyy ladulle, ja nyt alkaa armoton lastenpuolustus.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/marja_liisa_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/marja_liisa_defeat.mov"),
      isFinalBoss: false
    },
    3: {
      bossType: "elsa_mummo",
      bossName: "Elsa-Mummo",
      bossNameFi: "Elsa-Mummo",
      bossDescription: "Rollaattori tutisee, käsilaukku on viritetty ja Elsa-Mummo tulee kohti ilman armoa. Uzi laulaa ja vihreä pilvi seuraa kannoilla.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/elsa_mummo_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/elsa_mummo_defeat.mov"),
      bossDefeatFollowupVideoUrls: [resolvePlatformVideoUrl("assets/custom/story/final/interlude_taso3after-elsa-defeat.mov")],
      isFinalBoss: false
    },
    4: {
      bossType: "jari_litmanen",
      bossName: "LATU KEISARI",
      bossNameFi: "LATU KEISARI",
      bossDescription: "Lahti vapisee, kun LATU KEISARI droppaa basson. Nopeat kombot ja megadrop pakottavat liikkeeseen tai murskaavat alleen.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jari_litmanen_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jari_litmanen_defeat.mov"),
      isFinalBoss: false
    },
    5: {
      bossType: "jari_isometsa",
      bossName: "SLIIZU",
      bossNameFi: "SLIIZU",
      bossDescription: "Pinkki tukka, punainen kamera, nolla armoa. Yksi salama naamalle ja maine on mennyttä.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jari_isometsa_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jari_isometsa_defeat.mov"),
      isFinalBoss: false
    },
    6: {
      bossType: "tero_afterwork",
      bossName: "TERO AFTERWORK",
      bossNameFi: "TERO AFTERWORK",
      bossDescription: "Afterwork on ohi, ja tilalle astuu puhdas kaaos. Salkku heiluu, shurikenit viiltävät ja taistelun tempo kiihtyy sekunti sekunnilta.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/tero_afterwork_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/tero_afterwork_defeat.mov"),
      isFinalBoss: false
    },
    7: {
      bossType: "jeti",
      bossName: "PASI",
      bossNameFi: "PASI",
      bossDescription: "Turun huussipomo PASI ei anna hengähdystaukoa. Kuponkiraivo, pitkät loikat ja letku iskevät aalto toisensa jälkeen.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jeti_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/jeti_defeat.mov"),
      isFinalBoss: false
    },
    8: {
      bossType: "matti_nykanen",
      bossName: "Sun Isoisä",
      bossNameFi: "Sun Isoisä",
      bossDescription: "Fuengirolan rantalatu käy kuumana, kun Sun Isoisä saapuu paikalle paahdetulla raivolla. Nopeat pyrähdykset ja armoton hyökkäysrytmi pitävät paineen jatkuvasti päällä.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/matti_nykanen_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/matti_nykanen_defeat.mov"),
      isFinalBoss: false
    },
    9: {
      bossType: "peter_sync",
      bossName: "Peter Kantele",
      bossNameFi: "Peter Kantele",
      bossDescription: "Peter Kantele ei ole ollut synkassa, sitten poikabändi Spice Boysin hajottua. Siksi hän on vaarallinen kuin mikä vatsalihaksineen ja luistimineen.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/peter_sync_intro.mov"),
      bossMidfightVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/peter_sync_midfight.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/peter_sync_defeat.mov"),
      isFinalBoss: false
    },
    10: {
      bossType: "timo_soini",
      bossName: "Iso Timo",
      bossNameFi: "Iso Timo",
      bossDescription: "Viimeinen näytös kuuluu Iso Timolle. Keilaniemen ladulla paine nousee nopeasti tappiin, kun jytky vyöryy viimeiseen taisteluun.",
      bossIntroVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/timo_soini_intro.mov"),
      bossDefeatVideoUrl: resolvePlatformVideoUrl("assets/custom/story/final/timo_soini_defeat.mov"),
      isFinalBoss: true
    }
  };

  // Check if a level is a boss level
  static isBossLevel(level: number): boolean {
    return level in LevelManager.BOSS_LEVELS;
  }

  // Get boss config for a level
  static getBossConfig(level: number): BossConfig | null {
    return LevelManager.BOSS_LEVELS[level] || null;
  }
  // All levels use the same scene key but with different level numbers
  static readonly LEVEL_ORDER: string[] = [
    "GameScene" // Single scene that handles all 10 levels
  ];
  
  static readonly TOTAL_LEVELS: number = 10; // Official campaign ends at level 10
  
  // Level configuration for enemy spawning - HARD MODE: Way more enemies!
  static readonly LEVEL_CONFIG: { [level: number]: LevelEnemyConfig } = {
    // LEVEL 1 – TUTORIAL (★☆☆☆☆) - Easy intro level to learn controls
    // Fewer enemies, slower spawns, shorter distance
    1: {
      families: { min: 1, max: 2 },
      headphoneWalkers: { min: 1, max: 2 },
      drunks: { min: 0, max: 1 },
      proSkiers: { min: 0, max: 0 },  // No pro skiers in tutorial
      powerWalkers: { min: 1, max: 2 },
      regularEnemies: { min: 1, max: 2 },
      teslaChance: 0,  // No Teslas in tutorial
      spawnInterval: 2000,  // Slower spawns for learning
      distance: 1200  // Extended tutorial distance (+800m) for easier mechanic testing
    },
    
    // LEVEL 2 – Passive Chaos (★★☆☆☆) - More crowded trails!
    2: {
      families: { min: 4, max: 6 },
      headphoneWalkers: { min: 2, max: 4 },
      drunks: { min: 2, max: 3 },
      proSkiers: { min: 1, max: 2 },
      powerWalkers: { min: 2, max: 3 },
      regularEnemies: { min: 3, max: 5 },
      teslaChance: 0,
      spawnInterval: 1300,
      distance: 600
    },
    
    // LEVEL 3 – TAPIOLA: Kulttuurikeskus! (★★★☆☆) - Cultural elite!
    // Tapiola garden city - cultured families and brunch ladies
    3: {
      families: { min: 4, max: 6 },        // Many cultured families
      headphoneWalkers: { min: 2, max: 3 }, // Joggers with podcasts
      drunks: { min: 2, max: 3 },           // Wine enthusiasts
      proSkiers: { min: 2, max: 3 },        // Athletic types
      powerWalkers: { min: 3, max: 4 },     // Nordic walking ladies
      regularEnemies: { min: 3, max: 5 },
      teslaChance: 0.2,                     // Some Teslas in Tapiola
      spawnInterval: 1100,
      distance: 700
    },
    
    // LEVEL 4 – LAHTI: Dopingskandaali! (★★★☆☆) - Doping vibes!
    // Lahti 2001 scandal parody level - pro skiers and "enhanced" athletes
    4: {
      families: { min: 2, max: 3 },        // Fewer families in Lahti
      headphoneWalkers: { min: 1, max: 2 }, // Less casual walkers
      drunks: { min: 4, max: 6 },           // More drunks (Torvi ravintola visitors)
      proSkiers: { min: 4, max: 6 },        // LOTS of pro skiers (doping athletes)
      powerWalkers: { min: 1, max: 2 },
      regularEnemies: { min: 5, max: 7 },
      teslaChance: 0,                       // No Teslas in Lahti - TunedCars instead!
      spawnInterval: 900,
      distance: 800
    },
    
    // LEVEL 5 – The Pro Skier (★★★★☆) - Elite athletes attacking!
    5: {
      families: { min: 5, max: 6 },
      headphoneWalkers: { min: 3, max: 4 },
      drunks: { min: 4, max: 5 },
      proSkiers: { min: 3, max: 5 },
      powerWalkers: { min: 3, max: 4 },
      regularEnemies: { min: 5, max: 8 },
      teslaChance: 0.35,
      spawnInterval: 1000,
      distance: 900
    },
    
    // LEVEL 6 – Weekend Madness (★★★★☆) - Total chaos!
    6: {
      families: { min: 6, max: 8 },
      headphoneWalkers: { min: 4, max: 5 },
      drunks: { min: 5, max: 7 },
      proSkiers: { min: 3, max: 5 },
      powerWalkers: { min: 3, max: 5 },
      regularEnemies: { min: 6, max: 9 },
      teslaChance: 0.4,
      spawnInterval: 900,
      distance: 1000
    },
    
    // LEVEL 7 – Turku Raivo (★★★★☆) - PASI odottaa!
    7: {
      families: { min: 6, max: 8 },
      headphoneWalkers: { min: 4, max: 6 },
      drunks: { min: 6, max: 8 },
      proSkiers: { min: 4, max: 6 },
      powerWalkers: { min: 4, max: 5 },
      regularEnemies: { min: 7, max: 10 },
      teslaChance: 0.45,
      spawnInterval: 800,
      distance: 1100
    },
    
    // LEVEL 8 – Peak Absurdity (★★★★★) - Maximum population!
    8: {
      families: { min: 7, max: 9 },
      headphoneWalkers: { min: 5, max: 7 },
      drunks: { min: 7, max: 9 },
      proSkiers: { min: 5, max: 7 },
      powerWalkers: { min: 4, max: 6 },
      regularEnemies: { min: 8, max: 12 },
      teslaChance: 0.5,
      spawnInterval: 700,
      distance: 1200
    },
    
    // LEVEL 9 – ICE CLUB SHOWDOWN (☠️☠️☠️☠️☠️)
    // Kantsu run before Peter's club-areena boss phase.
    9: {
      families: { min: 8, max: 12 },
      headphoneWalkers: { min: 7, max: 10 },
      drunks: { min: 8, max: 12 },
      proSkiers: { min: 6, max: 9 },
      powerWalkers: { min: 6, max: 8 },
      regularEnemies: { min: 12, max: 18 },
      teslaChance: 0.6,
      spawnInterval: 500,
      distance: 1500
    },
    
    // LEVEL 10 – FINAL SHOWDOWN (☠️☠️☠️☠️)
    // Keilaniemi pressure run before final Iso Timo encounter.
    10: {
      families: { min: 7, max: 10 },
      headphoneWalkers: { min: 5, max: 8 },
      drunks: { min: 7, max: 10 },
      proSkiers: { min: 5, max: 8 },
      powerWalkers: { min: 5, max: 7 },
      regularEnemies: { min: 9, max: 13 },
      teslaChance: 0.55,
      spawnInterval: 650,
      distance: 1300
    }
  };

  // Get level config
  static getLevelConfig(level: number, difficulty: unknown = "vantaa"): LevelEnemyConfig {
    const baseConfig = LevelManager.LEVEL_CONFIG[level] || LevelManager.LEVEL_CONFIG[1];
    if (normalizeDifficultyTier(difficulty) !== "lahti") {
      return baseConfig;
    }

    return {
      ...baseConfig,
      distance: baseConfig.distance + LevelManager.LAHTI_DISTANCE_BONUS
    };
  }

  // Get the key of the next level scene
  static getNextLevelScene(currentSceneKey: string): string | null {
    // All levels use the same scene, so always return GameScene
    return "GameScene";
  }

  // Check if it's the last level
  static isLastLevel(currentLevel: number): boolean {
    return currentLevel >= LevelManager.TOTAL_LEVELS;
  }

  // Get the key of the first level scene
  static getFirstLevelScene(): string | null {
    return LevelManager.LEVEL_ORDER.length > 0 ? LevelManager.LEVEL_ORDER[0] : null;
  }
  
  // Get level name in Finnish - News headline edition
  // Level 1 is tutorial, story begins after completing it
  static getLevelName(level: number): string {
    const names: { [key: number]: string } = {
      1: "Tutoriaali - Oittaa",
      2: "Taso 2 - Leppävaara",
      3: "Taso 3 - Tapiola",
      4: "Taso 4 - Lahti",
      5: "Taso 5 - Lappi",
      6: "Taso 6 - Oulu",
      7: "Taso 7 - Oulu",
      8: "Taso 8 - Fuge",
      9: "Taso 9 - Chanelmäki",
      10: "Taso 10 - Keilaniemi",
    };
    return names[level] || `Taso ${level}`;
  }
  
  // Check if level is the Ice Club Arena boss level
  static isIceClubArenaLevel(level: number): boolean {
    return level === 9;
  }
  
  // Check if level is the Peter Kantele boss fight
  static isPeterSyncLevel(level: number): boolean {
    return level === 9;
  }
  
  // Check if a level is the Lahti level (special doping-themed content)
  static isLahtiLevel(level: number): boolean {
    return level === 4;
  }
}

export interface BossConfig {
  bossType: string;
  bossName: string;
  bossNameFi: string;
  bossDescription: string;
  bossIntroVideoUrl?: string;
  bossMidfightVideoUrl?: string;
  bossDefeatVideoUrl?: string;
  bossDefeatFollowupVideoUrls?: string[];
  isFinalBoss: boolean;
}

interface EnemyRange {
  min: number;
  max: number;
}

export interface LevelEnemyConfig {
  families: EnemyRange;
  headphoneWalkers: EnemyRange;
  drunks: EnemyRange;
  proSkiers: EnemyRange;
  powerWalkers: EnemyRange;
  regularEnemies: EnemyRange;
  teslaChance: number;
  spawnInterval: number;
  distance: number;
}
