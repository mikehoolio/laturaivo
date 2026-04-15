import Phaser from "phaser";
import * as utils from "../utils";
import { bossConfig } from "../gameConfig.json";
import { BossFSM } from "./BossFSM";
import { BOSS_INTRO_LINES, BOSS_TAUNT_EXTRA, BOSS_WEAKNESS_LINE, pickHumorLine } from "../humor/HumorPack";
import { FLAVOR_TEXT_ENABLED, sanitizePlayerFacingText } from "../content/PlayerTextPolicy";

type Direction = "left" | "right";
type BossType =
  | "marja_liisa"
  | "elsa_mummo"
  | "jari_isometsa"
  | "matti_nykanen"
  | "timo_soini"
  | "jari_litmanen"
  | "jeti"
  | "tero_afterwork";
const BOSS_HEALTH_MULTIPLIER = 3.0; // +200% health
const BOSS_STRIKE_DAMAGE_MULTIPLIER = 0.6; // -40% outgoing damage
const BOSS_DAMAGE_BUFF_MULTIPLIER = 1.3; // User request: increase all boss attack damage by +30%.
const BOSS_DAMAGE_NERF_MULTIPLIER = 0.9; // Current request: reduce all boss damage by 10%.
const BOSS_GLOBAL_DAMAGE_TUNING = 0.28 * BOSS_DAMAGE_BUFF_MULTIPLIER * BOSS_DAMAGE_NERF_MULTIPLIER;
const DEFAULT_BOSS_MAX_COMBAT_SCALE = 2.0;
const TIMO_SOINI_MAX_COMBAT_SCALE = 3.6;

// Espoo douchebag quotes for each boss type
const BOSS_TAUNTS: { [key in BossType]: string[] } = {
  // Espoo Karen - entitled suburban mom
  marja_liisa: [
    '"LAPSET ENSIN, JUOPOT ULOS LADULTA!"',
    '"ÄITIENERGIA EI KYSY LUPAA!"',
    '"MUN LATU ON TURVA-ALUE PERHEILLE!"',
    '"JUOPPOJEN BILEET LOPPUI TÄHÄN!"',
    '"LASTEN EDESSÄ EI SEKOILLA!"',
    '"MÄ OON TÄN LADUN ÄITIVAHTI!"',
    '"VAUNUKAISTA ON PYHÄ!"',
    '"MÄ SUOJELEN NÄITÄ MUKSUJA!"',
    '"PULKAT TURVAAN, NYT TOIMINTAAN!"',
    '"ÄIDIN RAIVO ON RAUHAN TYÖKALU!"',
    '"MUN KANSSA EI HÄIRITÄ PERHEITÄ!"',
    '"LAPSIPERHEET EDELLE, JUOPOT TAAKSE!"',
  ],
  // Elsa-Mummo - level 3 rollator chaos
  elsa_mummo: [
    '"ROLLAATTORI EI JARRUTA, KULTA!"',
    '"MUMMON KÄSILAUKKU TUNTEE JÄRJESTYKSEN!"',
    '"SEURAAVAKSI TULEE VIHREÄ PILVI!"',
    '"MUMMO KÄÄNTYY, NYT PIDÄT HENGITYSTÄ!"',
    '"TÄMÄ EI OLE KAHVIKERHO!"',
    '"TULE TÄNNE NIIN NÄYTÄN UZIN!"',
    '"ROLLAATTORI LINJALLE, LOPUT SIVUUN!"',
    '"MUMMON VUORO JOHTAA TÄTÄ LATUA!"',
    '"LASIT SUORASSA, TÄHTÄIN VALMIS!"',
    '"ÄLÄ TESTAA MUMMON HERMORAJAA!"',
  ],
  // LATU KEISARI (internally jari_litmanen for compatibility) - Lahtelainen räppäri
  jari_litmanen: [
    '"LATU KEISARI MIKISSÄ, LATU TÄRISEE!"',
    '"LAHTI EI NUKU, LATU KEISARI EI JARRUTA!"',
    '"BASSO TULEE, OLETKO VALMIS?"',
    '"TORVISTA SUORAAN TAISTELUUN!"',
    '"LAHTELAISTA LIEKKIÄ, TÄYSI VOLUME!"',
    '"KEISARI-DROPPI, SUOJAUS POIS!"',
    '"MUN FLOW LEIKKAA ILMAN HALK!"',
    '"RÄPPI ISKEE ENNEN KUIN HUOMAAT!"',
    '"YKS BIITTI, KAKS ISKUA!"',
    '"TÄMÄ KEIKKA ON SOTAA!"',
  ],
  // SLIIZU - paparazzi photographer boss
  jari_isometsa: [
    '"KATSO SUORAAN KAMERAAN!"',
    '"VALO ON HYVÄ, MAINE EI NIINKÄÄN!"',
    '"YKSI FLASH JA OLET ETUSIVULLA!"',
    '"PAPARAZZI EI PYYDÄ LUPAA!"',
    '"KLIK! KLIK! TÄMÄ MENEE JULKI!"',
    '"PUNAINEN KAMERA EI MISSAA MITÄÄN!"',
    '"TÄÄ ON MUN KUVAUSALUE!"',
    '"POSEERAA TAI VÄISTÄ!"',
    '"TÄMÄ KUVAKULMA SATTUU!"',
    '"SULJIN LAUKEAA JA HERMOT MYÖS!"',
  ],
  // Golf Pro - wealthy country club type
  matti_nykanen: [
    '"FUENGIROLAN AURINKO ANTAA VOIMAN!"',
    '"RANTAKATU ON MUN KUNTOSALI!"',
    '"AAMU-UINTI, ILTARAIVO!"',
    '"RUSKETUS VALMIS, NYT TULEE ISKU!"',
    '"PROMENADE ON MUN REVIIRI!"',
    '"MUN LOMA EI OLE LEPOA VAAN PAINETTA!"',
    '"TÄNÄÄN EI OTETA SIESTA!"',
    '"AALLOT NÄKEE TÄN DUELIN!"',
    '"SUN ASKEL ON HITAAMPI KUIN HELLE!"',
    '"FUENGIROLA-MOODI: TÄYSI AGGRESSIO!"',
  ],
  // PASI - Turku-raivobossi (original parody character)
  jeti: [
    '"MÄ TYHJENNÄN HUUSSIT, SÄ TYHJENNÄT LADUN!"',
    '"HUUSSIN KANSI AUKI, NYT LÄHTEE RAIVO!"',
    '"MULLA ON HESEN KUPONKI, MULLA ON ETU!"',
    '"KUPONKIVIHKO EI PETÄ KOSKAAN!"',
    '"AURAJOKI NÄKEE KAIKEN, MYÖS SUN VIRHEET!"',
    '"FÖLI TULEE, MUT MÄ EN VÄISTÄ!"',
    '"HUUSSIREKKA PARKISSA, HERMOT EI!"',
    '"TURUSSA HUUSSI TYHJENEE, LADULLA EI!"',
    '"KAKS JUUSTOA YHDEN HINNALLA, PASI JOHTAA!"',
    '"PASI ON LADUN HUUHTELUPÄÄLLIKKÖ!"',
  ],
  // Timo Soini - late-game heavy hitter, populist politician vibes
  timo_soini: [
    '"JANSEN PAANSEN!"',
    '"MÄ OLEN KANSAN MIES!"',
    '"MISSÄ ON MUN PANNUKAKKU?!"',
    '"TÄMÄ ON MINUN HIIHTOLADUN!"',
    '"MUN VILLA GRANDESSA ON SAUNA!"',
    '"POLITIIKKA ON TEATTERIA!"',
    '"TULIN ESPOO GOLFISTA!"',
    '"MUN LIHAPULLAT ON PARHAITA!"',
    '"EN ANNA PERIKSI KOSKAAN!"',
    '"ESPOO KUULUU MEILLE!"',
    '"LAITAN SINUT JÄÄHYLLE!"',
    '"MUN TUKKA ON LUONNOLLINEN!"',
  ],
  // Tero Afterwork - level 6 business chaos boss
  tero_afterwork: [
    '"AFTERWORK EI OLE OHI, NYT VASTA ALKAA!"',
    '"SALKKU EDELLA, TULOSKUNTO TAYDELLA!"',
    '"PALAVERI SIIRTYY - TAMA ON PRIORITEETTI!"',
    '"TEAMS-KAMERA PAALLA JA HYOKKAYS KAYNTIIN!"',
    '"KPI NAYTTAA PUNAISTA, NYT RYNNATAAN!"',
    '"TUNNIT KIRJAAN MYYHEMMIN, NYT SOTA!"',
    '"SALKKUSLAMMI ON UUSI STRATEGIA!"',
    '"SHURIKENIT LENTAA, BUDJETTI EI!"',
    '"TERO AFTERWORK EI KYSY LUPAA!"',
    '"JOKAINEN LADUN METRI ON LIIKEVAIHTOA!"',
  ],
};

// Quotes when boss enters enraged phase
const BOSS_ENRAGE_TAUNTS: { [key in BossType]: string[] } = {
  marja_liisa: [
    '"NYT RIITTI! LASTEN PUOLESTA LOPPUUN ASTI!"',
    '"ÄITIKILPI PÄÄLLE, ETTE PÄÄSE OHI!"',
    '"JUOPPOJUNA PYSÄHTYY TÄHÄN!"',
  ],
  elsa_mummo: [
    '"MUMMO-MODE MAKSIMIIN!"',
    '"NYT TULEE UZI + PILVI YHDESSÄ!"',
    '"ROLLAATTORI RALLAA, SINÄ VÄISTÄT!"',
  ],
  jari_litmanen: [
    '"LATU KEISARI OVERDRIVE PÄÄLLE!"',
    '"BASSO TÄYSILLE - NYT SATTUU!"',
    '"LAHTI-MODE: RAAKA AGGRESSIO!"',
  ],
  jari_isometsa: [
    '"TÄMÄ ON PÄIVÄN ETUSIVU!"',
    '"SALAMA TÄYSILLE!"',
    '"KLIKIT LUKITTU, NYT SATTUU!"',
  ],
  matti_nykanen: [
    '"KUUMIN HETKI ALKAA NYT!"',
    '"PROMENADE EI SAA ARMOA!"',
    '"HELLE-HURMOS TÄYSILLÄ!"',
  ],
  jeti: [
    '"Nyt huussi huuhtoutuu täysillä!"',
    '"Kuponkiraivo päälle, nyt mennään!"',
    '"Turun huussimyrsky alkaa nyt!"',
  ],
  timo_soini: [
    '"PERSUT EI ANNA PERIKSI!"',
    '"MINUN VUORONI LYÖDÄ!"',
    '"MAMUKRIITIKKO MODE!"',
  ],
  tero_afterwork: [
    '"Nyt meni overtimeksi - KAIKKI PELIIN!"',
    '"SALKKU AUKI, FULL AGGRESSIO!"',
    '"AFTERWORK BERSERK MODE PAALLA!"',
  ],
};

// Quotes when boss takes damage
const BOSS_HURT_TAUNTS: { [key in BossType]: string[] } = {
  marja_liisa: [
    '"EI NYT, MUKSUT KATSOO!"',
    '"ÄITI EI KAADU HELPOSTI!"',
    '"LASTEN VUOKSI NOUSEN HETI TAKAISIN!"',
  ],
  elsa_mummo: [
    '"MUMMO EI KAADU YHDESTÄ TÖNÄISYSTÄ!"',
    '"LASIT VINOSSA, MUTTA TAHTO EI!"',
    '"KÄSILAUKKU EI VIELÄ SANONUT VIIMEISTÄ!"',
  ],
  jari_litmanen: [
    '"MUN BIITTI KATKESI!"',
    '"EI NÄIN HELPOSTI!"',
    '"TÄMÄ VAIN LÄMMITTELYÄ!"',
  ],
  jari_isometsa: [
    '"KAMERA TÄRÄHTI!"',
    '"OBJEKTIIVI HALKESI!"',
    '"EI TÄTÄ KUVAA JULKAISTA!"',
  ],
  matti_nykanen: [
    '"AURINKOLASIT VINOON!"',
    '"HIEKKA LENSI SILMIIN!"',
    '"RANTARYTMI SEKOSI!"',
  ],
  jeti: [
    '"Mun kuponki kastui, se on sun vika!"',
    '"Huussiletku irtos, nyt suututtaa!"',
    '"Hese jäi haaveeksi!"',
  ],
  timo_soini: [
    '"VAALIT HÄVIÄÄ!"',
    '"MUN SUOSIO!"',
    '"EI NÄIN!"',
  ],
  tero_afterwork: [
    '"KAHVI LOPAHTI... mutta en mina!"',
    '"MUN SARKYI SMARTWATCH!"',
    '"KUKA SIIRSI MUN PALAVERIN?"',
  ],
};

const BOSS_ATTACK_NAMES: { [key in BossType]: { [attackType: string]: string } } = {
  marja_liisa: {
    normal: "ÄITI-KOMENTO",
    charge: "ÄITIRAIVO-RYNNI",
    combo: "LASTENKILPI-KOMBO",
    fakeout: "VAROITUS-HUIJAUS",
    leap: "TURVAHYPY",
    barrage: "VAUNUVARTIO-MYRSKY",
    hazard: "PERHEALUE-KIELTO",
    special: "ÄITIENERGIA: JUOPPOSTOPPI",
  },
  elsa_mummo: {
    normal: "ROLLAATTORI-ISKU",
    charge: "ROLLAATTORI-RYNNI",
    combo: "KÄSILAUKKU-KOMBO",
    fakeout: "MUMMO-HÄMÄYS",
    leap: "MUMMO-LOIKKA",
    barrage: "UZI-SUIHKU",
    hazard: "PIERUPILVI-ALUE",
    special: "ELSAN VIHREÄ MYRSKY",
  },
  jari_litmanen: {
    normal: "KEISARI-LYÖNTI",
    charge: "LAHTI-SYOKSY",
    combo: "FLOW-KOMBO",
    fakeout: "BIITTI-STOPPI",
    leap: "LAVAHYPPY-SLAM",
    barrage: "BASSOTULI",
    hazard: "TORVI-SAVUPOMMI",
    special: "MEGADROPPI",
  },
  jari_isometsa: {
    normal: "KAMERA-OSUMA",
    charge: "FLASH-RYNNI",
    combo: "SNAP-KETJU",
    fakeout: "POSE-HÄMÄYS",
    leap: "SALAMA-LOIKKA",
    barrage: "PAPARAZZI-SARJA",
    hazard: "VALOKEILA-ALUE",
    special: "MAINESHOTTI",
  },
  matti_nykanen: {
    normal: "PROMENADE-OSUMA",
    charge: "AURINKORYNNI",
    combo: "RANTAKOMBO",
    fakeout: "SIESTA-HUIJAUS",
    leap: "AALTOLOIKKA",
    barrage: "HELLEKUURO",
    hazard: "HIEKKA-ANSA",
    special: "FUENGIROLA-FINISHER",
  },
  jeti: {
    normal: "HUUSSI-HEILAUS",
    charge: "KUPONKIRYNNI",
    combo: "FOLI-KOMBO",
    fakeout: "HUUSSI-HARHA",
    leap: "HUUSSIHYPY",
    barrage: "LETKUKUURO",
    hazard: "FOLI-ESTEALUE",
    special: "TURUN HUUSSIMYRSKY",
  },
  timo_soini: {
    normal: "JYTKY-LAPSY",
    charge: "VAALI-RYNNI",
    combo: "PUHEKIERROS",
    fakeout: "LAUSE-LOUKKU",
    leap: "EDUSKUNTA-SLAM",
    barrage: "LAUSUNTO-MYRSKY",
    hazard: "TORI-ERISTYS",
    special: "ISO JYTKY",
  },
  tero_afterwork: {
    normal: "AFTERWORK-ISKU",
    charge: "KPI-RYNNI",
    combo: "SALKKU-KOMBO",
    fakeout: "PALAVERI-DECOY",
    leap: "KOKOUSHUONE-HYPY",
    barrage: "SHURIKEN-STORMI",
    hazard: "NEUVOTTELUALUE",
    special: "TERO OVERDRIVE",
  },
};

// Boss enemy class for LATURAIVO - Mini-bosses and Final Boss
export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  // State machine
  fsm: BossFSM;

  // Boss type
  bossType: BossType;
  isFinalBoss: boolean;

  // Character attributes
  facingDirection: Direction;
  speed: number;

  // State flags
  isDead: boolean;
  isAttacking: boolean;
  isHurting: boolean;
  canAttack: boolean;
  attackCooldown: number;
  isEnraged: boolean;
  private chasePauseUntil: number = 0;
  private attackLockStartedAt: number = 0;
  
  // Phase system - bosses have multiple phases based on health
  currentPhase: number;
  phaseThresholds: number[]; // Health percentages when phases change
  
  // Special attack patterns
  specialAttackCooldown: number;
  canSpecialAttack: boolean;
  currentAttackPattern: string;
  attackPatternIndex: number;
  attackPatterns: string[][];  // Different patterns per phase
  private attackDecksByPhase: Map<number, string[]>;
  private lastAttackType: string | null;
  private pendingPhaseOpeners: string[];
  private readonly phaseOpenersByPhase: { [phase: number]: string[] };
  private nextSpecialAttackAt: number = 0;
  private specialDamageScaleMultiplier: number = 1;
  private rageMeter: number = 0;
  private readonly rageMeterMax: number = 100;
  private pendingRageSpecial: boolean = false;
  private isFinisherMode: boolean = false;
  private lastLowHealthPulseAt: number = -99999;
  private shieldHitsRemaining: number = 0;
  private shieldActive: boolean = false;
  private hasActivatedPhaseShield: boolean = false;
  private interruptWindowUntil: number = 0;
  private interruptStunExtraMs: number = 0;
  private lastSuccessfulInterruptAt: number = -99999;
  private damageReactionLockUntil: number = 0;
  private nextHurtReactionAt: number = 0;
  private recentAttackHistory: string[] = [];
  private specialPressureCounter: number = 0;
  private readonly directionalAnimKeyCache: Map<string, string | null> = new Map();
  private usingDirectionalLeftFrames: boolean = false;

  // Attack target tracking
  currentMeleeTargets: Set<any>;

  // Health system
  maxHealth: number;
  health: number;
  damage: number;
  scoreValue: number;

  // Attack trigger
  meleeTrigger: Phaser.GameObjects.Zone;

  // Sound effects
  attackSound?: Phaser.Sound.BaseSound;
  hitSound?: Phaser.Sound.BaseSound;
  appearSound?: Phaser.Sound.BaseSound;
  defeatSound?: Phaser.Sound.BaseSound;
  
  // Ground Y position
  groundY: number;

  // Health bar
  healthBarBg?: Phaser.GameObjects.Graphics;
  healthBarFill?: Phaser.GameObjects.Graphics;
  private healthBarWidth: number = 150;
  private readonly healthBarHeight: number = 12;
  private readonly healthBarYOffset: number = 20;
  private lastHealthBarFillWidth: number = -1;
  private lastHealthBarFillColor: number = -1;
  private baseScaleX: number = 1;
  private baseScaleY: number = 1;
  private combatScaleMultiplier: number = 1;
  private maxCombatScaleMultiplier: number = DEFAULT_BOSS_MAX_COMBAT_SCALE;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number, bossType: BossType, isFinalBoss: boolean = false) {
    // Get the correct idle frame based on boss type
    const idleFrame = Boss.getIdleFrame(bossType);
    super(scene, x, y, idleFrame);

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Store ground Y for collision
    this.groundY = groundY;
    this.bossType = bossType;
    this.isFinalBoss = isFinalBoss;
    const currentLevel = Number((scene as any).currentLevel ?? 0);
    const isTurkuBoss = this.bossType === "jeti" || currentLevel === 7;
    // Previous baseline was 0.5:
    // Turku/PASI +70% => 0.85, others +40% => 0.70
    this.tauntChanceMultiplier = isTurkuBoss ? 0.85 : 0.7;

    // Initialize character attributes
    this.facingDirection = "left";
    this.speed = isFinalBoss ? 80 : 100;

    // Initialize state flags
    this.isDead = false;
    this.isAttacking = false;
    this.isHurting = false;
    this.canAttack = true;
    this.attackCooldown = 2000; // Bosses attack more frequently
    this.isEnraged = false;
    
    // Initialize phase system - bosses have 3 phases
    this.currentPhase = 1;
    this.phaseThresholds = [0.7, 0.4]; // Phase 2 at 70%, Phase 3 at 40%
    
    // Initialize attack pattern system
    this.specialAttackCooldown = isFinalBoss ? 4200 : 3600;
    this.canSpecialAttack = true;
    this.currentAttackPattern = "normal";
    this.attackPatternIndex = 0;
    this.attackDecksByPhase = new Map();
    this.lastAttackType = null;
    this.pendingPhaseOpeners = [];
    this.phaseOpenersByPhase = {
      2: ["fakeout", "charge", "combo", "barrage"],
      3: ["special", "hazard", "leap", "barrage", "combo"]
    };
    
    // Attack patterns per phase - increasingly aggressive.
    // Phase 1 starts mostly with normal pressure.
    // Phase 2 introduces clear special pressure.
    // Phase 3 is full boss kit.
    this.attackPatterns = [
      ["normal", "charge", "combo", "fakeout", "normal", "charge"],
      ["charge", "combo", "barrage", "special", "fakeout", "hazard", "charge", "special", "combo"],
      ["combo", "leap", "special", "barrage", "hazard", "charge", "special", "leap", "fakeout", "combo", "special"]
    ];

    // Initialize attack system
    this.currentMeleeTargets = new Set();

    // Initialize health system based on boss type - apply difficulty multiplier
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;
    this.maxHealth = Math.round(
      (isFinalBoss ? bossConfig.finalBossHealth.value : bossConfig.miniBossHealth.value) *
      difficultyMultiplier *
      BOSS_HEALTH_MULTIPLIER
    );
    this.health = this.maxHealth;
    this.damage = Math.max(
      1,
      Math.round(
        (isFinalBoss ? bossConfig.finalBossDamage.value : bossConfig.miniBossDamage.value) *
        difficultyMultiplier *
        BOSS_STRIKE_DAMAGE_MULTIPLIER *
        BOSS_GLOBAL_DAMAGE_TUNING
      )
    );
    this.scoreValue = bossConfig.bossScoreValue.value * (isFinalBoss ? 3 : 1);

    // Progressive boss balance:
    // - Månika is the baseline.
    // - Each next boss increases pressure and durability.
    // - Timo targets ~2x durability vs Månika baseline.
    const monikaReferenceHealth = Math.round(
      bossConfig.miniBossHealth.value *
      difficultyMultiplier *
      BOSS_HEALTH_MULTIPLIER
    );

    // Månika (level 2) baseline: fair pace and readable attacks.
    if (this.bossType === "marja_liisa") {
      this.maxHealth = monikaReferenceHealth;
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.12);
      this.attackCooldown = Math.max(1050, Math.round(this.attackCooldown * 0.8));
      this.specialAttackCooldown = 3000;
      this.phaseThresholds = [0.74, 0.46];
      this.attackPatterns = [
        ["normal", "charge", "normal", "combo", "fakeout", "charge", "combo"],
        ["charge", "combo", "barrage", "fakeout", "special", "charge", "combo", "hazard"],
        ["combo", "leap", "barrage", "special", "hazard", "charge", "combo", "special", "leap"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 0.9));
    }

    // Elsa-Mummo (level 3) - slight step up from Månika.
    if (this.bossType === "elsa_mummo") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.1));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.18);
      this.attackCooldown = Math.max(980, Math.round(this.attackCooldown * 0.75));
      this.specialAttackCooldown = 2850;
      this.phaseThresholds = [0.75, 0.48];
      this.attackPatterns = [
        ["normal", "charge", "combo", "barrage", "fakeout", "normal"],
        ["charge", "combo", "barrage", "special", "hazard", "fakeout", "combo", "special"],
        ["combo", "leap", "special", "barrage", "hazard", "charge", "special", "barrage", "fakeout", "special"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 0.98));
    }

    // LATU KEISARI (level 4) - faster tempo and stronger pressure.
    if (this.bossType === "jari_litmanen") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.2));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.24);
      this.attackCooldown = Math.max(920, Math.round(this.attackCooldown * 0.7));
      this.specialAttackCooldown = 2700;
      this.phaseThresholds = [0.76, 0.48];
      this.attackPatterns = [
        ["normal", "charge", "combo", "fakeout", "normal", "charge"],
        ["charge", "combo", "barrage", "special", "fakeout", "hazard", "charge", "combo", "special"],
        ["combo", "leap", "special", "barrage", "hazard", "charge", "combo", "special", "leap", "special"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.05));
    }

    // Elon (level 5) - notably more pressure and shorter punish windows.
    if (this.bossType === "jari_isometsa") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.35));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.3);
      this.attackCooldown = Math.max(860, Math.round(this.attackCooldown * 0.64));
      this.specialAttackCooldown = 2400;
      this.phaseThresholds = [0.78, 0.5];
      this.attackPatterns = [
        ["normal", "charge", "combo", "barrage", "charge", "fakeout", "special"],
        ["charge", "combo", "barrage", "special", "hazard", "charge", "combo", "special", "barrage"],
        ["charge", "leap", "special", "barrage", "combo", "hazard", "special", "leap", "charge", "special", "combo"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.12));
    }

    // Tero Afterwork (level 6) - continued progression in aggression and durability.
    if (this.bossType === "tero_afterwork") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.5));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.36);
      this.attackCooldown = Math.max(820, Math.round(this.attackCooldown * 0.6));
      this.specialAttackCooldown = 2300;
      this.phaseThresholds = [0.8, 0.52];
      this.attackPatterns = [
        ["normal", "charge", "combo", "fakeout", "normal", "charge"],
        ["charge", "combo", "barrage", "special", "leap", "fakeout", "hazard", "charge", "special"],
        ["combo", "leap", "special", "barrage", "hazard", "charge", "combo", "barrage", "special", "leap", "special"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.18));
    }

    // PASI (level 7) - aggressive and relentless.
    if (this.bossType === "jeti") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.65));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.42);
      this.attackCooldown = Math.max(760, Math.round(this.attackCooldown * 0.56));
      this.specialAttackCooldown = 2200;
      this.phaseThresholds = [0.82, 0.55];
      this.attackPatterns = [
        ["normal", "charge", "combo", "fakeout", "charge", "normal"],
        ["charge", "combo", "barrage", "special", "fakeout", "hazard", "combo", "special", "charge"],
        ["leap", "combo", "special", "charge", "barrage", "hazard", "special", "leap", "combo", "fakeout", "charge", "special"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.24));
    }

    // Isoisä (level 8) - one step before endgame bosses.
    if (this.bossType === "matti_nykanen") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 1.8));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.62);
      this.attackCooldown = Math.max(620, Math.round(this.attackCooldown * 0.46));
      this.specialAttackCooldown = 1650;
      this.phaseThresholds = [0.88, 0.62];
      this.attackPatterns = [
        ["charge", "combo", "normal", "barrage", "fakeout", "combo", "charge", "special"],
        ["charge", "combo", "barrage", "special", "hazard", "leap", "combo", "special", "charge", "barrage"],
        ["leap", "special", "combo", "barrage", "hazard", "charge", "special", "leap", "combo", "special", "barrage", "hazard"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.24));
    }

    // Timo (late-game): target roughly 2x Månika baseline durability.
    if (this.bossType === "timo_soini") {
      this.maxHealth = Math.max(1, Math.round(monikaReferenceHealth * 2));
      this.health = this.maxHealth;
      this.speed = Math.round(this.speed * 1.45);
      this.attackCooldown = Math.max(900, Math.round(this.attackCooldown * 0.7));
      this.specialAttackCooldown = 2000;
      this.phaseThresholds = [0.84, 0.6];
      this.attackPatterns = [
        ["normal", "charge", "combo", "fakeout", "charge", "combo", "barrage"],
        ["charge", "combo", "barrage", "special", "hazard", "charge", "leap", "combo", "special"],
        ["leap", "combo", "special", "barrage", "hazard", "charge", "special", "leap", "combo", "special", "hazard", "barrage"]
      ];
      this.damage = Math.max(1, Math.round(this.damage * 1.08));
    }

    const specialLeadIn = Math.max(900, Math.round(this.specialAttackCooldown * 0.56));
    this.nextSpecialAttackAt = (scene.time?.now ?? 0) + Phaser.Math.Between(
      Math.max(550, Math.round(specialLeadIn * 0.4)),
      Math.max(760, Math.round(specialLeadIn * 0.85))
    );

    // Reset phase attack deck/openers after all boss-specific overrides.
    this.resetPhaseAttackState(this.currentPhase, true);

    // Use utility function to initialize sprite's size, scale, etc.
    // Bosses are bigger! Final boss is even bigger!
    const standardHeight = isFinalBoss ? 200 : 160;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.5, 0.9);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    this.combatScaleMultiplier = 1;
    this.maxCombatScaleMultiplier = this.bossType === "timo_soini"
      ? TIMO_SOINI_MAX_COMBAT_SCALE
      : DEFAULT_BOSS_MAX_COMBAT_SCALE;

    // IMPORTANT: Disable gravity for boss - boss stays on ground level
    this.body.setAllowGravity(false);
    
    // Ensure boss starts on ground
    this.y = this.groundY;

    // Create attack trigger - bosses have larger attack range
    const attackRange = isFinalBoss ? 150 : 120;
    const attackWidth = isFinalBoss ? 120 : 100;
    this.meleeTrigger = utils.createTrigger(this.scene, this, 0, 0, attackRange, attackWidth);
    
    // Add melee trigger to scene's enemyMeleeTriggers group
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }

    // Initialize sound effects
    this.initializeSounds();

    // Create health bar
    this.createHealthBar();

    // Initialize state machine
    this.fsm = new BossFSM(scene, this);

    // Play boss appear sound
    this.appearSound?.play();
    
    // Show entrance taunt after a short delay
    scene.time.delayedCall(800, () => {
      if (!this.canRunSceneEffects()) return;
      if (!this.isDead) {
        const introLine = pickHumorLine(this.scene, BOSS_INTRO_LINES, "BOSSI SAAPUU!");
        (this.scene as any).events?.emit?.("floatingAnnouncement", {
          text: `${introLine} • ${BOSS_WEAKNESS_LINE.toUpperCase()}`,
          duration: 2600
        });
        this.showTaunt(this.getRandomTaunt(), 3000);
      }
    });
  }

  static getIdleFrame(bossType: BossType): string {
    // Map boss types to their idle animation frames
    const frameMap: { [key in BossType]: string } = {
      marja_liisa: "karen_boss_idle_R_frame1",
      elsa_mummo: "elsa_boss_idle_R_frame1",
      jari_litmanen: "litmanen_boss_idle_R_frame1",
      jari_isometsa: "tesla_ceo_boss_idle_R_frame1",
      matti_nykanen: "golf_boss_idle_R_frame1",
      jeti: "jeti_boss_idle_R_frame1",
      timo_soini: "timo_soini_boss_idle_R_frame1",
      tero_afterwork: "level6_boss_idle_R_frame1"
    };
    return frameMap[bossType];
  }

  getAnimationKey(action: string): string {
    // Map boss types to their animation keys
    const animMap: { [key in BossType]: { [action: string]: string } } = {
      marja_liisa: {
        idle: "karen_boss_idle_anim",
        walk: "karen_boss_walk_anim",
        attack: "karen_boss_attack_anim",
        charge: "karen_boss_charge_anim",
        combo: "karen_boss_combo_anim",
        leap: "karen_boss_leap_anim",
        barrage: "karen_boss_barrage_anim",
        special: "karen_boss_special_anim",
        hurt: "karen_boss_hurt_anim",
        die: "karen_boss_die_anim",
        enrage: "karen_boss_enrage_anim",
        taunt: "karen_boss_taunt_anim"
      },
      elsa_mummo: {
        idle: "elsa_boss_idle_anim",
        walk: "elsa_boss_walk_anim",
        intro: "elsa_boss_intro_anim",
        attack: "elsa_boss_attack_anim",
        charge: "elsa_boss_charge_anim",
        combo: "elsa_boss_combo_anim",
        leap: "elsa_boss_leap_anim",
        barrage: "elsa_boss_barrage_anim",
        special: "elsa_boss_special_anim",
        hurt: "elsa_boss_hurt_anim",
        die: "elsa_boss_die_anim",
        enrage: "elsa_boss_enrage_anim",
        taunt: "elsa_boss_taunt_anim"
      },
      jari_litmanen: {
        idle: "litmanen_boss_idle_anim",
        walk: "litmanen_boss_walk_anim",
        intro: "litmanen_boss_intro_anim",
        attack: "litmanen_boss_attack_anim",
        kick: "litmanen_boss_kick_anim",
        charge: "litmanen_boss_charge_anim",
        combo: "litmanen_boss_combo_anim",
        leap: "litmanen_boss_leap_anim",
        barrage: "litmanen_boss_barrage_anim",
        special: "litmanen_boss_special_anim",
        hurt: "litmanen_boss_hurt_anim",
        die: "litmanen_boss_die_anim",
        enrage: "litmanen_boss_enrage_anim",
        taunt: "litmanen_boss_taunt_anim"
      },
      jari_isometsa: {
        idle: "tesla_ceo_boss_idle_anim",
        walk: "tesla_ceo_boss_walk_anim",
        attack: "tesla_ceo_boss_attack_anim",
        charge: "tesla_ceo_boss_walk_anim",
        combo: "tesla_ceo_boss_attack_anim",
        leap: "tesla_ceo_boss_walk_anim",
        barrage: "tesla_ceo_boss_attack_anim",
        special: "tesla_ceo_boss_attack_anim",
        hurt: "tesla_ceo_boss_idle_anim",
        die: "tesla_ceo_boss_idle_anim",
        enrage: "tesla_ceo_boss_idle_anim",
        taunt: "tesla_ceo_boss_idle_anim"
      },
      matti_nykanen: {
        idle: "golf_boss_idle_anim",
        walk: "golf_boss_walk_anim",
        attack: "golf_boss_attack_anim",
        charge: "golf_boss_charge_anim",
        combo: "golf_boss_combo_anim",
        leap: "golf_boss_leap_anim",
        barrage: "golf_boss_barrage_anim",
        special: "golf_boss_special_anim",
        hurt: "golf_boss_hurt_anim",
        die: "golf_boss_die_anim",
        enrage: "golf_boss_enrage_anim",
        taunt: "golf_boss_taunt_anim"
      },
      jeti: {
        idle: "jeti_boss_idle_anim",
        walk: "jeti_boss_walk_anim",
        attack: "jeti_boss_attack_anim",
        jump: "jeti_boss_jump_anim",
        charge: "jeti_boss_walk_anim",
        combo: "jeti_boss_attack_anim",
        leap: "jeti_boss_jump_anim",
        barrage: "jeti_boss_attack_anim",
        special: "jeti_boss_attack_anim",
        hurt: "jeti_boss_idle_anim",
        die: "jeti_boss_idle_anim",
        enrage: "jeti_boss_idle_anim",
        taunt: "jeti_boss_idle_anim"
      },
      timo_soini: {
        idle: "timo_soini_boss_idle_anim",
        walk: "timo_soini_boss_walk_anim",
        attack: "timo_soini_boss_attack_anim",
        charge: "timo_soini_boss_walk_anim",
        combo: "timo_soini_boss_attack_anim",
        leap: "timo_soini_boss_walk_anim",
        barrage: "timo_soini_boss_attack_anim",
        special: "timo_soini_boss_attack_anim",
        hurt: "timo_soini_boss_idle_anim",
        die: "timo_soini_boss_idle_anim",
        enrage: "timo_soini_boss_idle_anim",
        taunt: "timo_soini_boss_idle_anim"
      },
      tero_afterwork: {
        idle: "level6_boss_idle_anim",
        walk: "level6_boss_walk_anim",
        intro: "level6_boss_intro_anim",
        attack: "level6_boss_attack_anim",
        charge: "level6_boss_charge_anim",
        combo: "level6_boss_briefcase_slam_anim",
        leap: "level6_boss_leap_anim",
        barrage: "level6_boss_shuriken_attack_anim",
        special: "level6_boss_special_anim",
        hurt: "level6_boss_hurt_anim",
        die: "level6_boss_die_anim",
        enrage: "level6_boss_enrage_anim",
        taunt: "level6_boss_taunt_anim"
      }
    };
    const key = animMap[this.bossType]?.[action];
    if (key && this.scene.anims.exists(key)) return key;

    const actionFallbackMap: Record<string, string> = {
      charge: "walk",
      combo: "attack",
      leap: "walk",
      barrage: "attack",
      special: "attack",
      hurt: "idle",
      die: "idle",
      enrage: "idle",
      taunt: "idle"
    };
    const fallbackAction = actionFallbackMap[action] || "idle";
    const ownFallback = animMap[this.bossType]?.[fallbackAction] || animMap[this.bossType]?.idle;
    const fallback = ownFallback || animMap.marja_liisa.idle;
    if (fallback && this.scene.anims.exists(fallback)) {
      console.warn(
        `[Boss] Missing animation key/asset for bossType=${this.bossType} action=${action}, using fallback=${fallback}`
      );
      return fallback;
    }
    console.warn(
      `[Boss] Missing animation key/asset for bossType=${this.bossType} action=${action}, using fallback=${fallback}`
    );
    return fallback;
  }

  private resolveDirectionalAnimationKey(animKey: string): { key: string; usesLeftFrames: boolean } {
    if (!animKey || this.facingDirection !== "left" || animKey.endsWith("__left")) {
      return { key: animKey, usesLeftFrames: false };
    }

    if (this.directionalAnimKeyCache.has(animKey)) {
      const cachedKey = this.directionalAnimKeyCache.get(animKey);
      return cachedKey
        ? { key: cachedKey, usesLeftFrames: true }
        : { key: animKey, usesLeftFrames: false };
    }

    const baseAnim = this.scene.anims.get(animKey) as any;
    if (!baseAnim || !Array.isArray(baseAnim.frames) || baseAnim.frames.length === 0) {
      this.directionalAnimKeyCache.set(animKey, null);
      return { key: animKey, usesLeftFrames: false };
    }

    const leftFrames: string[] = [];
    for (const frame of baseAnim.frames) {
      const sourceFrame = String(frame?.textureFrame ?? "");
      if (!sourceFrame.includes("_R_")) {
        this.directionalAnimKeyCache.set(animKey, null);
        return { key: animKey, usesLeftFrames: false };
      }
      const leftFrame = sourceFrame.replace(/_R_/g, "_L_");
      if (!this.scene.textures.exists(leftFrame)) {
        this.directionalAnimKeyCache.set(animKey, null);
        return { key: animKey, usesLeftFrames: false };
      }
      leftFrames.push(leftFrame);
    }

    const directionalKey = `${animKey}__left`;
    if (!this.scene.anims.exists(directionalKey)) {
      this.scene.anims.create({
        key: directionalKey,
        frames: leftFrames.map((frameKey) => ({ key: frameKey })),
        frameRate: baseAnim.frameRate,
        repeat: baseAnim.repeat,
        yoyo: baseAnim.yoyo,
        showOnStart: baseAnim.showOnStart,
        hideOnComplete: baseAnim.hideOnComplete,
        delay: baseAnim.delay,
        repeatDelay: baseAnim.repeatDelay
      });
    }

    this.directionalAnimKeyCache.set(animKey, directionalKey);
    return { key: directionalKey, usesLeftFrames: true };
  }

  syncFacingVisual(): void {
    // Elsa art was authored left-facing even though frame keys use "_R_",
    // so her flip polarity must be inverted to keep gaze toward the player.
    const leftFacingByDefault = this.bossType === "elsa_mummo";
    const shouldFlipX = leftFacingByDefault
      ? this.facingDirection === "right"
      : this.facingDirection === "left";
    this.setFlipX(shouldFlipX && !this.usingDirectionalLeftFrames);
  }

  // Play animation and reset origin and offset
  playAnimation(animKey: string) {
    try {
      if (!animKey) return;
      const resolved = this.resolveDirectionalAnimationKey(animKey);
      this.usingDirectionalLeftFrames = resolved.usesLeftFrames;
      this.play(resolved.key, true);
      this.syncFacingVisual();
      const offsetDirection = this.usingDirectionalLeftFrames ? "right" : this.facingDirection;
      utils.resetOriginAndOffset(this, offsetDirection);
    } catch (error) {
      console.error(`[BossAnimationError] ${this.bossType} anim=${animKey}`, error);
    }
  }

  createHealthBar(): void {
    // Create health bar background
    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.setDepth(100);
    
    // Create health bar fill
    this.healthBarFill = this.scene.add.graphics();
    this.healthBarFill.setDepth(101);

    this.healthBarWidth = this.isFinalBoss ? 200 : 150;

    // Background is static in local coordinates; we only move container position each frame.
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x000000, 0.8);
    this.healthBarBg.fillRect(-2, -2, this.healthBarWidth + 4, this.healthBarHeight + 4);
    this.healthBarBg.lineStyle(2, 0xffffff, 1);
    this.healthBarBg.strokeRect(-2, -2, this.healthBarWidth + 4, this.healthBarHeight + 4);
    this.drawHealthBarSegments();
    
    this.updateHealthBar();
  }

  private drawHealthBarSegments(): void {
    if (!this.healthBarBg) return;
    const marks = [...this.phaseThresholds, 0.1]
      .filter((v) => v > 0 && v < 1)
      .sort((a, b) => b - a);
    this.healthBarBg.lineStyle(1, 0xffffff, 0.35);
    for (const mark of marks) {
      const x = Math.round(this.healthBarWidth * mark);
      this.healthBarBg.lineBetween(x, -1, x, this.healthBarHeight + 1);
    }
  }

  updateHealthBar(): void {
    if (!this.healthBarBg || !this.healthBarFill) return;
    
    const barX = this.x - this.healthBarWidth / 2;
    const barY = this.y - this.displayHeight - this.healthBarYOffset;

    this.healthBarBg.setPosition(barX, barY);
    this.healthBarFill.setPosition(barX, barY);
    
    const healthPercent = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    const fillWidth = Math.round(this.healthBarWidth * healthPercent);
    
    // Color based on health
    let fillColor = 0xff0000; // Red for boss
    if (this.isFinalBoss) {
      fillColor = this.isEnraged ? 0xff00ff : 0xff4400; // Purple when enraged, orange-red normally
    }
    if (this.shieldActive) {
      fillColor = 0x66ccff;
    }

    if (fillWidth === this.lastHealthBarFillWidth && fillColor === this.lastHealthBarFillColor) {
      return;
    }

    this.lastHealthBarFillWidth = fillWidth;
    this.lastHealthBarFillColor = fillColor;
    this.healthBarFill.clear();
    if (fillWidth > 0) {
      this.healthBarFill.fillStyle(fillColor, 1);
      this.healthBarFill.fillRect(0, 0, fillWidth, this.healthBarHeight);
    }
  }

  pauseChaseFor(durationMs: number): void {
    const now = this.scene?.time?.now ?? 0;
    this.chasePauseUntil = Math.max(this.chasePauseUntil, now + Math.max(0, durationMs));
    this.setVelocityX(0);
  }

  isChasePaused(now: number): boolean {
    return now < this.chasePauseUntil;
  }

  private getPhaseScaleFloor(phase: number): number {
    if (phase <= 1) return 1;
    const maxBoost = this.maxCombatScaleMultiplier - 1;
    if (phase === 2) return 1 + maxBoost * 0.58;
    if (phase === 3) return 1 + maxBoost * 0.85;
    return this.maxCombatScaleMultiplier;
  }

  private updateCombatScale(delta: number): void {
    const healthPercent = Phaser.Math.Clamp(this.health / Math.max(1, this.maxHealth), 0, 1);
    const healthGrowthMultiplier = 1 + (1 - healthPercent) * (this.maxCombatScaleMultiplier - 1);
    const phaseFloor = this.getPhaseScaleFloor(this.currentPhase);
    const targetMultiplier = Phaser.Math.Clamp(
      Math.max(phaseFloor, healthGrowthMultiplier),
      1,
      this.maxCombatScaleMultiplier
    );

    // Keep growth monotonic for the whole fight.
    this.combatScaleMultiplier = Math.max(this.combatScaleMultiplier, targetMultiplier);
    const targetScaleX = this.baseScaleX * this.combatScaleMultiplier;
    const targetScaleY = this.baseScaleY * this.combatScaleMultiplier;
    const lerp = Phaser.Math.Clamp(delta / 240, 0.05, 0.22);
    this.scaleX = Phaser.Math.Linear(this.scaleX, targetScaleX, lerp);
    this.scaleY = Phaser.Math.Linear(this.scaleY, targetScaleY, lerp);
  }
  
  // Main update method - called every frame
  update(time: number, delta: number) {
    // Safety check
    if (!this.body || !this.active || this.isDead || !this.scene) {
      return;
    }
    
    const allowVerticalMotion =
      this.scene.tweens.isTweening(this) ||
      this.fsm?.state === "leapSlamming" ||
      this.fsm?.state === "specialAttacking" ||
      (this.bossType === "jeti" && this.fsm?.state === "charging");

    if (!allowVerticalMotion) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    } else if (this.y > this.groundY) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }
    
    // Keep boss within screen boundaries during boss fight
    const minX = 100;
    const maxX = this.scene.scale.width - 100;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);

    // Update attack trigger position
    const attackRange = this.isFinalBoss ? 150 : 120;
    const attackWidth = this.isFinalBoss ? 120 : 100;
    utils.updateMeleeTrigger(this, this.meleeTrigger, this.facingDirection, attackRange, attackWidth);

    // Update state machine
    this.fsm.update(time, delta);

    // Safety net: if attack unlock timer/event is missed (pause/resume edge cases),
    // force-recover canAttack so boss does not become permanently passive.
    if (!this.canAttack && !this.isAttacking && !this.isHurting && !this.isDead) {
      if (this.attackLockStartedAt <= 0) {
        this.attackLockStartedAt = time;
      } else if (!this.isChasePaused(time)) {
        const lockDuration = time - this.attackLockStartedAt;
        const staleThreshold = Math.max(2200, this.attackCooldown * 2.1);
        if (lockDuration >= staleThreshold) {
          this.canAttack = true;
          this.attackLockStartedAt = 0;
        }
      }
    } else {
      this.attackLockStartedAt = 0;
    }

    // Update flip based on facing direction
    this.syncFacingVisual();
    
    // Check for enrage (below 30% health)
    if (!this.isEnraged && this.health < this.maxHealth * 0.3) {
      this.enterEnrage();
    }
    
    // Check for phase transitions
    this.checkPhaseTransition();
    this.updateCombatScale(delta);

    // Update health bar position after scale updates so the bar stays anchored.
    this.updateHealthBar();

    // Last 10% is a dedicated finisher state.
    const healthPercent = this.health / this.maxHealth;
    if (!this.isFinisherMode && healthPercent <= 0.1) {
      this.enterFinisherMode();
    }

    // Heartbeat pulse when near defeat.
    if (healthPercent <= 0.18 && time - this.lastLowHealthPulseAt >= 1150) {
      this.lastLowHealthPulseAt = time;
      this.scene.events.emit("bossLowHealthPulse", {
        bossType: this.bossType,
        intensity: this.isFinisherMode ? "critical" : "high"
      });
    }

    // Rage-meter special: trigger once safe to avoid clashing with current attack.
    if (
      this.pendingRageSpecial &&
      !this.isAttacking &&
      !this.isHurting &&
      this.canAttack &&
      this.canUseSpecialAttackNow(time)
    ) {
      this.pendingRageSpecial = false;
      this.canAttack = false;
      this.fsm.goto("specialAttacking");
    }
  }
  
  // Check and handle phase transitions based on health
  checkPhaseTransition(): void {
    const healthPercent = this.health / this.maxHealth;
    
    if (this.currentPhase === 1 && healthPercent <= this.phaseThresholds[0]) {
      this.transitionToPhase(2);
    } else if (this.currentPhase === 2 && healthPercent <= this.phaseThresholds[1]) {
      this.transitionToPhase(3);
    }
  }
  
  // Transition to a new phase with visual feedback
  transitionToPhase(newPhase: number): void {
    if (this.currentPhase === newPhase) return;
    
    const oldPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.attackPatternIndex = 0; // Reset pattern
    this.resetPhaseAttackState(newPhase);
    
    // Visual feedback for phase transition
    this.scene.cameras.main.shake(400, 0.015);
    this.scene.cameras.main.flash(200, 255, 100, 0, true);
    
    // Boss flashes and temporarily becomes faster
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.alpha = 1;
      }
    });
    
    // Phase-specific buffs
    if (newPhase === 2) {
      this.speed *= 1.2; // 20% faster
      this.attackCooldown *= 0.85; // 15% faster attacks
      this.activatePhaseShield(3);
    } else if (newPhase === 3) {
      this.speed *= 1.15; // Additional 15% faster
      this.attackCooldown *= 0.8; // Additional 20% faster attacks
      this.damage = Math.max(1, Math.floor(this.damage * 1.25)); // 25% more damage
    }

    const phaseScaleFloor = this.getPhaseScaleFloor(newPhase);
    if (phaseScaleFloor > this.combatScaleMultiplier) {
      this.combatScaleMultiplier = phaseScaleFloor;
      this.scene.tweens.add({
        targets: this,
        scaleX: this.baseScaleX * this.combatScaleMultiplier,
        scaleY: this.baseScaleY * this.combatScaleMultiplier,
        duration: 280,
        ease: "Back.Out"
      });
    }
    
    // Emit phase change event for UI
    this.scene.events.emit("bossPhaseChanged", {
      bossType: this.bossType,
      oldPhase: oldPhase,
      newPhase: newPhase
    });

    // Immediately telegraph the new danger profile.
    const phaseAttackCallout = newPhase >= 3
      ? this.getAttackName("leap")
      : this.getAttackName("combo");
    this.scene.events.emit("bossAttackTelegraph", {
      kind: "phase",
      attackName: phaseAttackCallout,
      bossType: this.bossType
    });

    if (newPhase === 2) {
      this.showTaunt('"TÄSTÄ TÄMÄ VASTA ALKAA!"', 2200);
    } else if (newPhase === 3) {
      this.showTaunt('"NYT EI SÄÄSTELLÄ ENÄÄ!"', 2200);
    }
    
    // Play phase transition sound
    this.scene.sound.play("boss_appear", { volume: 0.4 });
  }

  private activatePhaseShield(hitsToBreak: number): void {
    if (this.hasActivatedPhaseShield || this.isDead) return;
    this.hasActivatedPhaseShield = true;
    this.shieldActive = true;
    this.shieldHitsRemaining = Math.max(1, hitsToBreak);
    this.scene.events.emit("floatingAnnouncement", {
      text: "BOSSIN SUOJA AKTIVOITUI!",
      duration: 1700
    });
  }

  private enterFinisherMode(): void {
    this.isFinisherMode = true;
    this.speed *= 1.18;
    this.attackCooldown *= 0.72;
    this.damage = Math.max(1, Math.round(this.damage * 1.18));
    this.combatScaleMultiplier = this.maxCombatScaleMultiplier;
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScaleX * this.combatScaleMultiplier,
      scaleY: this.baseScaleY * this.combatScaleMultiplier,
      duration: 360,
      ease: "Back.Out"
    });
    this.pendingPhaseOpeners.unshift("special", "hazard", "combo");
    this.scheduleNextSpecialAttack(0.35);
    this.scene.events.emit("bossPhaseChanged", {
      bossType: this.bossType,
      oldPhase: this.currentPhase,
      newPhase: 4
    });
    this.scene.events.emit("bossAttackTelegraph", {
      kind: "phase",
      attackName: "VIIMEINEN YRITYS",
      bossType: this.bossType
    });
    this.showTaunt('"VIIMEINEN YRITYS! NYT KAIKKI PELIIN!"', 2500);
  }
  
  // Get next attack type from current phase pattern
  getNextAttackType(): string {
    const phase = Phaser.Math.Clamp(this.currentPhase, 1, this.attackPatterns.length);
    let attackType: string | undefined;

    // Phase change openers guarantee visible escalation.
    if (this.pendingPhaseOpeners.length > 0) {
      const preferredIndex = this.pendingPhaseOpeners.findIndex((attack) => attack !== this.lastAttackType);
      const openerIndex = preferredIndex >= 0 ? preferredIndex : 0;
      attackType = this.pendingPhaseOpeners.splice(openerIndex, 1)[0];
    } else {
      let phaseDeck = this.attackDecksByPhase.get(phase);
      if (!phaseDeck || phaseDeck.length === 0) {
        phaseDeck = this.refillAttackDeckForPhase(phase);
      }
      attackType = phaseDeck.shift();

      // Prevent same attack repeating back-to-back when alternatives exist.
      if (attackType && attackType === this.lastAttackType && phaseDeck.length > 0) {
        const altIndex = phaseDeck.findIndex((attack) => attack !== this.lastAttackType);
        if (altIndex >= 0) {
          const altAttack = phaseDeck.splice(altIndex, 1)[0];
          phaseDeck.unshift(attackType);
          attackType = altAttack;
        }
      }
    }

    if (!attackType) {
      attackType = "normal";
    }

    // Prefer pressure over normal swings after phase 1, and still reduce normal spam in phase 1.
    if (phase === 1 && attackType === "normal") {
      if (this.canUseSpecialAttackNow() && Math.random() < 0.4) {
        attackType = "special";
      } else if (Math.random() < 0.62) {
        attackType = Phaser.Math.RND.pick(["charge", "combo", "barrage", "hazard", "fakeout"]);
      }
    } else if (phase >= 2 && attackType === "normal") {
      if (this.canUseSpecialAttackNow() && Math.random() < (phase >= 3 ? 0.8 : 0.66)) {
        attackType = "special";
      } else {
        const aggressiveFallback = this.getAggressiveFallbackPool(phase, false);
        attackType = Phaser.Math.RND.pick(aggressiveFallback);
      }
    }

    const specialReady = this.canUseSpecialAttackNow();
    if (phase >= 2 && attackType !== "special" && specialReady) {
      const opportunisticSpecialChance = phase >= 3 ? 0.42 : 0.3;
      if (Math.random() < opportunisticSpecialChance) {
        attackType = "special";
      } else {
        const forceThreshold = phase >= 3 ? 2 : 3;
        if (this.specialPressureCounter >= forceThreshold - 1) {
          attackType = "special";
        } else {
          this.specialPressureCounter = Math.min(this.specialPressureCounter + 1, 8);
        }
      }
    }

    // If special is on cooldown, immediately replace it with another aggressive move.
    if (attackType === "special" && !this.canUseSpecialAttackNow()) {
      const pattern = this.getPhasePattern(phase);
      const candidates = pattern.filter((attack) => attack !== "special" && attack !== this.lastAttackType);
      const aggressiveFallback = candidates.length > 0
        ? candidates
        : this.getAggressiveFallbackPool(phase, false);
      attackType = Phaser.Math.RND.pick(aggressiveFallback);
    }

    if (attackType === "special") {
      this.specialPressureCounter = 0;
    } else if (!specialReady) {
      this.specialPressureCounter = 0;
    }

    attackType = this.pickVariedAttackForPhase(phase, attackType || "normal");

    this.lastAttackType = attackType;
    this.attackPatternIndex++;
    return attackType;
  }

  private pickVariedAttackForPhase(phase: number, preferredAttack: string): string {
    const now = this.scene?.time?.now ?? 0;
    const avoidDepth = this.getAttackAvoidDepth();
    const recent = this.recentAttackHistory.slice(-avoidDepth);
    const avoid = new Set(recent);

    const fallbackPool = this.getAggressiveFallbackPool(phase, true);
    const patternPool = [...this.getPhasePattern(phase), ...fallbackPool];
    const uniquePool = [...new Set(patternPool.filter((attack) => !!attack))];

    const specialReady = this.canUseSpecialAttackNow(now);
    const availablePool = uniquePool.filter((attack) => attack !== "special" || specialReady);
    const nonRecentPool = availablePool.filter((attack) => !avoid.has(attack));

    let selected = preferredAttack;
    const preferredInvalid =
      !selected ||
      (selected === "special" && !specialReady) ||
      (phase >= 2 && selected === "normal") ||
      avoid.has(selected);

    if (preferredInvalid) {
      const candidatePool = nonRecentPool.length > 0 ? nonRecentPool : availablePool;
      if (candidatePool.length > 0) {
        selected = Phaser.Math.RND.pick(candidatePool);
      }
    }

    if (!selected) {
      selected = phase >= 3 ? "combo" : "charge";
    }

    this.recentAttackHistory.push(selected);
    if (this.recentAttackHistory.length > 6) {
      this.recentAttackHistory.shift();
    }
    return selected;
  }

  private getAttackAvoidDepth(): number {
    switch (this.bossType) {
      case "timo_soini":
        return 4;
      case "matti_nykanen":
      case "jeti":
      case "tero_afterwork":
      case "jari_litmanen":
      case "elsa_mummo":
      case "jari_isometsa":
        return 3;
      case "marja_liisa":
      default:
        return 2;
    }
  }

  canUseSpecialAttackNow(now: number = this.scene?.time?.now ?? 0): boolean {
    if (!this.canSpecialAttack) return false;
    return now >= this.nextSpecialAttackAt;
  }

  private getAggressiveFallbackPool(phase: number, favorSpecial: boolean): string[] {
    // Level 8 Isoisa should feel versatile: avoid looping only one or two attack types.
    if (this.bossType === "matti_nykanen") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "leap", "barrage", "combo", "charge", "hazard", "fakeout", "combo", "leap"]
          : ["leap", "barrage", "combo", "charge", "hazard", "fakeout", "combo", "charge"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "special", "combo", "barrage", "charge", "leap", "hazard", "fakeout"]
          : ["combo", "barrage", "charge", "leap", "hazard", "fakeout", "combo"];
      }
      return favorSpecial
        ? ["special", "combo", "charge", "barrage", "leap", "hazard", "fakeout"]
        : ["combo", "charge", "barrage", "leap", "hazard", "fakeout"];
    }

    if (this.bossType === "marja_liisa") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "combo", "barrage", "charge", "hazard", "leap", "fakeout"]
          : ["combo", "barrage", "charge", "hazard", "leap", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "combo", "charge", "barrage", "hazard", "fakeout"]
          : ["combo", "charge", "barrage", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "fakeout", "barrage"]
        : ["charge", "combo", "fakeout", "barrage"];
    }

    if (this.bossType === "elsa_mummo") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "barrage", "hazard", "combo", "leap", "charge", "fakeout"]
          : ["barrage", "hazard", "combo", "leap", "charge", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "barrage", "hazard", "combo", "charge", "fakeout"]
          : ["barrage", "hazard", "combo", "charge", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "hazard", "fakeout"]
        : ["charge", "combo", "hazard", "fakeout"];
    }

    if (this.bossType === "jari_litmanen") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "barrage", "leap", "combo", "charge", "hazard", "fakeout"]
          : ["barrage", "leap", "combo", "charge", "hazard", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "barrage", "combo", "charge", "hazard", "fakeout"]
          : ["barrage", "combo", "charge", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "barrage", "fakeout"]
        : ["charge", "combo", "barrage", "fakeout"];
    }

    if (this.bossType === "jari_isometsa") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "charge", "combo", "barrage", "leap", "hazard", "fakeout"]
          : ["charge", "combo", "barrage", "leap", "hazard", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "charge", "combo", "barrage", "hazard", "fakeout"]
          : ["charge", "combo", "barrage", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "barrage", "fakeout"]
        : ["charge", "combo", "barrage", "fakeout"];
    }

    if (this.bossType === "tero_afterwork") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "barrage", "charge", "combo", "leap", "hazard", "fakeout"]
          : ["barrage", "charge", "combo", "leap", "hazard", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "barrage", "charge", "combo", "hazard", "fakeout"]
          : ["barrage", "charge", "combo", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "barrage", "fakeout"]
        : ["charge", "combo", "barrage", "fakeout"];
    }

    if (this.bossType === "jeti") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "combo", "charge", "barrage", "leap", "hazard", "fakeout"]
          : ["combo", "charge", "barrage", "leap", "hazard", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "combo", "charge", "barrage", "hazard", "fakeout"]
          : ["combo", "charge", "barrage", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "barrage", "fakeout"]
        : ["charge", "combo", "barrage", "fakeout"];
    }

    if (this.bossType === "timo_soini") {
      if (phase >= 3) {
        return favorSpecial
          ? ["special", "special", "special", "barrage", "charge", "combo", "leap", "hazard", "fakeout"]
          : ["barrage", "charge", "combo", "leap", "hazard", "fakeout"];
      }
      if (phase === 2) {
        return favorSpecial
          ? ["special", "special", "charge", "combo", "barrage", "hazard", "fakeout"]
          : ["charge", "combo", "barrage", "hazard", "fakeout"];
      }
      return favorSpecial
        ? ["special", "charge", "combo", "barrage", "fakeout"]
        : ["charge", "combo", "barrage", "fakeout"];
    }

    if (phase >= 3) {
      return favorSpecial
        ? ["special", "special", "special", "combo", "charge", "barrage", "leap", "hazard", "fakeout"]
        : ["combo", "charge", "barrage", "leap", "hazard", "fakeout"];
    }
    if (phase === 2) {
      return favorSpecial
        ? ["special", "special", "combo", "charge", "barrage", "hazard", "fakeout"]
        : ["combo", "charge", "barrage", "hazard", "fakeout"];
    }
    return favorSpecial
      ? ["special", "charge", "combo", "barrage", "hazard", "fakeout"]
      : ["charge", "combo", "barrage", "hazard", "fakeout"];
  }

  private getSpecialCadenceMultiplier(): number {
    let phaseMultiplier = this.currentPhase >= 3 ? 0.62 : this.currentPhase === 2 ? 0.78 : 0.92;
    if (this.isFinisherMode) phaseMultiplier *= 0.82;
    if (this.isEnraged) phaseMultiplier *= 0.88;
    return phaseMultiplier;
  }

  private scheduleNextSpecialAttack(cooldownMultiplier: number = 1): void {
    const now = this.scene?.time?.now ?? 0;
    const jitter = Phaser.Math.Between(-200, 260);
    const adaptiveMultiplier = cooldownMultiplier * this.getSpecialCadenceMultiplier();
    const baseCooldown = Math.max(700, Math.round(this.specialAttackCooldown * adaptiveMultiplier));
    this.nextSpecialAttackAt = now + Math.max(620, baseCooldown + jitter);
  }

  setInterruptWindow(durationMs: number): void {
    const now = this.scene?.time?.now ?? 0;
    this.interruptWindowUntil = Math.max(this.interruptWindowUntil, now + Math.max(0, durationMs));
  }

  setDamageReactionLock(durationMs: number): void {
    const now = this.scene?.time?.now ?? 0;
    this.damageReactionLockUntil = Math.max(this.damageReactionLockUntil, now + Math.max(0, durationMs));
  }

  private isDamageReactionLocked(now: number = this.scene?.time?.now ?? 0): boolean {
    return now < this.damageReactionLockUntil;
  }

  private isCommittedAttackState(): boolean {
    const state = String((this.fsm as any)?.state || "");
    return (
      state === "specialAttacking" ||
      state === "charging" ||
      state === "comboAttacking" ||
      state === "leapSlamming" ||
      state === "barrageAttacking" ||
      state === "hazardAttacking"
    );
  }

  consumeInterruptStunBonus(defaultMs: number): number {
    if (this.interruptStunExtraMs <= 0) return defaultMs;
    const total = defaultMs + this.interruptStunExtraMs;
    this.interruptStunExtraMs = 0;
    return total;
  }

  tryShowAttackTaunt(attackType: string): void {
    if (!FLAVOR_TEXT_ENABLED && this.bossType !== "marja_liisa") return;
    if (Math.random() > 0.34 * this.tauntChanceMultiplier) return;
    const attackName = this.getAttackName(attackType);
    const templates = [
      `"${attackName} VALMIS!"`,
      `"VARO! ${attackName}!"`,
      `"NYT TULEE: ${attackName}!"`,
    ];
    this.showTaunt(Phaser.Math.RND.pick(templates), 1500);
  }

  playImpactWarningCue(): void {
    if (!this.canRunSceneEffects()) return;
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.28,
      rate: 1.75,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.events.emit("floatingAnnouncement", {
      text: "VARO!",
      duration: 650
    });
  }

  private resetPhaseAttackState(phase: number, clearLastAttack: boolean = false): void {
    this.attackDecksByPhase.delete(phase);
    this.pendingPhaseOpeners = [...(this.phaseOpenersByPhase[phase] || [])];
    this.recentAttackHistory = [];
    this.specialPressureCounter = 0;
    if (clearLastAttack) {
      this.lastAttackType = null;
    }
  }

  private getPhasePattern(phase: number): string[] {
    const index = Phaser.Math.Clamp(phase - 1, 0, this.attackPatterns.length - 1);
    const pattern = this.attackPatterns[index];
    return Array.isArray(pattern) && pattern.length > 0 ? pattern : ["normal"];
  }

  private refillAttackDeckForPhase(phase: number): string[] {
    const freshDeck = [...this.getPhasePattern(phase)];
    Phaser.Utils.Array.Shuffle(freshDeck);
    this.attackDecksByPhase.set(phase, freshDeck);
    return freshDeck;
  }

  getAttackName(attackType: string): string {
    const namesByBoss = BOSS_ATTACK_NAMES[this.bossType] || BOSS_ATTACK_NAMES.marja_liisa;
    return namesByBoss[attackType] || "BOSSI-ISKU";
  }

  enterEnrage(): void {
    if (this.isEnraged) return;
    
    this.isEnraged = true;
    this.speed *= 1.5; // Faster when enraged
    this.attackCooldown *= 0.6; // Attack more frequently
    
    // Visual effect - red tint
    this.setTint(0xff6666);
    const enrageAnim = this.getAnimationKey("enrage");
    if (this.scene.anims.exists(enrageAnim)) {
      this.playAnimation(enrageAnim);
    }
    
    // Screen shake
    this.scene.cameras.main.shake(500, 0.01);
    
    // Show enrage taunt!
    this.showEnrageTaunt();
    
    // Trigger boss-specific special attack at 30% health.
    // If current state blocks it, retry shortly so telegraph and actual special stay in sync.
    const enrageSpecialTriggered = this.performSpecialAttack("enrage");
    if (!enrageSpecialTriggered) {
      this.scene.time.delayedCall(450, () => {
        if (!this.canRunSceneEffects() || this.isDead) return;
        this.performSpecialAttack("enrage");
      });
    }
  }
  
  // ========== BOSS SPECIAL ATTACKS ==========
  // Each boss has a unique special attack, now available repeatedly with cooldown.
  performSpecialAttack(source: "enrage" | "pattern" = "pattern"): boolean {
    if (this.isDead) return false;
    if (source !== "enrage" && !this.canUseSpecialAttackNow()) return false;
    
    const gameScene = this.scene as any;
    const player = gameScene.player;
    if (!player || player.isDead) return false;
    this.pendingRageSpecial = false;

    this.specialDamageScaleMultiplier = source === "enrage" ? 1 : 0.72;
    this.scheduleNextSpecialAttack(source === "enrage" ? 0.9 : 1);
    if (typeof gameScene.triggerBossAttackCinematic === "function") {
      gameScene.triggerBossAttackCinematic(this);
    }

    this.scene.events.emit("bossAttackTelegraph", {
      kind: "super",
      attackName: this.getAttackName("special"),
      bossType: this.bossType
    });

    try {
      switch (this.bossType) {
        case "marja_liisa":
          this.performKarenSpecialAttack(player);
          return true;
        case "elsa_mummo":
          this.performElsaSpecialAttack(player);
          return true;
        case "jari_litmanen":
          this.performLitmanenSpecialAttack(player);
          return true;
        case "jari_isometsa":
          this.performTeslaSpecialAttack(player);
          return true;
        case "tero_afterwork":
          this.performTeroSpecialAttack(player);
          return true;
        case "matti_nykanen":
          this.performGolfSpecialAttack(player);
          return true;
        case "jeti":
          this.performGolfSpecialAttack(player);
          return true;
        case "timo_soini":
          this.performTimoSpecialAttack(player);
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error(`[BossSpecialError] type=${this.bossType} source=${source}`, error);
      return false;
    }
  }

  // Elsa-Mummo: toxic fart cloud + short uzi barrage.
  performElsaSpecialAttack(player: any): void {
    this.pauseChaseFor(1700);
    this.setVelocityX(0);
    const specialAnim = this.getAnimationKey("special");
    if (this.scene.anims.exists(specialAnim)) {
      this.playAnimation(specialAnim);
    }

    this.showTaunt('"ELSAN VIHREÄ MYRSKY!"', 3300);
    this.scene.cameras.main.flash(420, 140, 255, 120, true);
    this.scene.sound.play("fart_death", {
      volume: 0.78,
      rate: 0.76,
      detune: -120
    });
    this.scene.time.delayedCall(520, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });

    // Fart cloud VFX burst from behind Elsa.
    this.scene.time.delayedCall(680, () => {
      if (!this.canRunSceneEffects()) return;
      if (this.isDead) return;

      if (this.scene.anims.exists("elsa_fart_cloud_vfx_anim")) {
        const offsetX = this.facingDirection === "left" ? 26 : -26;
        const cloud = this.scene.add.sprite(this.x + offsetX, this.y - 55, "elsa_fart_cloud_R_frame1");
        cloud.setDepth(175);
        cloud.setScale(0.62);
        cloud.play("elsa_fart_cloud_vfx_anim");
        cloud.once("animationcomplete-elsa_fart_cloud_vfx_anim", () => cloud.destroy());
      }
    });

    // Toxic pulse check.
    this.scene.time.delayedCall(900, () => {
      if (!this.canRunSceneEffects()) return;
      if (player.isDead || this.isDead) return;

      const cloudCenterX = this.facingDirection === "left" ? this.x + 28 : this.x - 28;
      const cloudCenterY = this.y - 55;
      const cloudRadius = 190;
      const dist = Phaser.Math.Distance.Between(cloudCenterX, cloudCenterY, player.x, player.y - 36);
      if (dist <= cloudRadius) {
        const gasDamage = Math.max(1, Math.round(this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.18))));
        player.takeDamage(gasDamage, { source: "boss" });
      }
    });

    // Uzi volley.
    const barrageAnim = this.scene.anims.exists("elsa_boss_uzi_attack_anim")
      ? "elsa_boss_uzi_attack_anim"
      : this.getAnimationKey("barrage");
    if (this.scene.anims.exists(barrageAnim)) {
      this.scene.time.delayedCall(420, () => {
        if (!this.canRunSceneEffects() || this.isDead) return;
        this.playAnimation(barrageAnim);
      });
    }

    const shots = 5;
    for (let i = 0; i < shots; i++) {
      this.scene.time.delayedCall(920 + i * 110, () => {
        if (!this.canRunSceneEffects()) return;
        if (player.isDead || this.isDead) return;

        if (this.scene.anims.exists("elsa_uzi_muzzle_flash_anim")) {
          const flashX = this.facingDirection === "left" ? this.x - 34 : this.x + 34;
          const flash = this.scene.add.sprite(flashX, this.y - 82, "elsa_uzi_muzzle_flash_frame1");
          flash.setDepth(182);
          flash.setScale(0.45);
          flash.play("elsa_uzi_muzzle_flash_anim");
          flash.once("animationcomplete-elsa_uzi_muzzle_flash_anim", () => flash.destroy());
        }

        const targetX = player.x + Phaser.Math.Between(-28, 28);
        const targetY = player.y - 40 + Phaser.Math.Between(-20, 20);
        const shotLine = this.scene.add.rectangle(this.x, this.y - 82, 18, 4, 0xb6f9ff, 0.85);
        shotLine.setDepth(181);
        const angle = Phaser.Math.Angle.Between(this.x, this.y - 82, targetX, targetY);
        shotLine.setRotation(angle);
        this.scene.tweens.add({
          targets: shotLine,
          x: targetX,
          y: targetY,
          alpha: 0,
          duration: 150,
          ease: "Linear",
          onComplete: () => shotLine.destroy()
        });

        if (player.canProcessBossAttack?.()) {
          const dist = Phaser.Math.Distance.Between(targetX, targetY, player.x, player.y - 38);
          if (dist <= 88) {
            const shotDamage = Math.max(1, Math.round(this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.08))));
            player.takeDamage(shotDamage, { source: "boss" });
          }
        }
      });
    }
  }

  // Tero Afterwork: briefcase burst + shuriken volley.
  performTeroSpecialAttack(player: any): void {
    this.pauseChaseFor(1600);
    this.setVelocityX(0);
    const specialAnim = this.getAnimationKey("special");
    if (this.scene.anims.exists(specialAnim)) {
      this.playAnimation(specialAnim);
    }

    this.showTaunt('"TERO OVERDRIVE! AFTERWORK EI LOPU!"', 3400);
    this.scene.cameras.main.flash(450, 255, 170, 40, true);
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.8,
      rate: 0.72,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(500, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });

    this.scene.time.delayedCall(700, () => {
      if (!this.canRunSceneEffects()) return;
      if (player.isDead || this.isDead) return;

      if (this.scene.anims.exists("level6_briefcase_burst_vfx_anim")) {
        const burst = this.scene.add.sprite(this.x, this.y - 70, "level6_briefcase_burst_vfx_frame1");
        burst.setDepth(170);
        burst.setScale(0.55);
        burst.play("level6_briefcase_burst_vfx_anim");
        burst.once("animationcomplete-level6_briefcase_burst_vfx_anim", () => burst.destroy());
      }

      const volleyCount = 4;
      for (let i = 0; i < volleyCount; i++) {
        this.scene.time.delayedCall(i * 120, () => {
          if (!this.canRunSceneEffects()) return;
          if (player.isDead || this.isDead) return;

          const startX = this.facingDirection === "left" ? this.x - 42 : this.x + 42;
          const startY = this.y - 74 + Phaser.Math.Between(-16, 16);
          const targetX = player.x + Phaser.Math.Between(-32, 32);
          const targetY = player.y - 36 + Phaser.Math.Between(-18, 18);

          const shuriken = this.scene.add.sprite(startX, startY, "level6_shuriken_vfx_frame1");
          shuriken.setDepth(175);
          shuriken.setScale(0.42);
          if (this.scene.anims.exists("level6_shuriken_vfx_anim")) {
            shuriken.play("level6_shuriken_vfx_anim");
          }

          this.scene.tweens.add({
            targets: shuriken,
            x: targetX,
            y: targetY,
            alpha: 0.25,
            duration: 310,
            ease: "Sine.In",
            onComplete: () => {
              if (!player.isDead && player.canProcessBossAttack?.()) {
                const dist = Phaser.Math.Distance.Between(shuriken.x, shuriken.y, player.x, player.y - 35);
                if (dist < 78) {
                  const hitDamage = Math.max(1, Math.round(this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.16))));
                  player.takeDamage(hitDamage, { source: "boss" });
                }
              }
              shuriken.destroy();
            }
          });
        });
      }
    });
  }
  
  // Karen: Summons her "manager husband" who screams so loud it damages player
  performKarenSpecialAttack(player: any): void {
    this.pauseChaseFor(1300);
    this.setVelocityX(0);
    const specialAnim = this.getAnimationKey("special");
    if (this.scene.anims.exists(specialAnim)) {
      this.playAnimation(specialAnim);
    }

    // Show special attack taunt
    this.showTaunt('"ÄITIENERGIA! LAPSET TURVAAN, JUOPOT POIS!"', 3000);
    
    // Flash the screen red
    this.scene.cameras.main.flash(500, 255, 0, 0, true);
    
    // Play boss attack sound
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.8,
      rate: 0.6,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(600, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });
    
    // Delay the damage for dramatic effect
    this.scene.time.delayedCall(800, () => {
      if (!this.canRunSceneEffects()) return;
      if (player.isDead || this.isDead) return;
      
      // Show the scream text
      const screamText = this.scene.add.text(
        this.x,
        this.y - 100,
        '"LASTENKILPI AKTIVOITU!"',
        {
          fontFamily: "PublicPixel",
          fontSize: "24px",
          color: "#ff0000",
          backgroundColor: "#000000",
          padding: { x: 10, y: 6 },
        }
      );
      screamText.setOrigin(0.5, 1);
      screamText.setDepth(200);
      
      // Animate scream text
      this.scene.tweens.add({
        targets: screamText,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        y: screamText.y - 80,
        duration: 2500,
        ease: "Power2",
        onComplete: () => screamText.destroy()
      });
      
      // Deal 50% of player's MAX health as damage
      const damage = this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.5));
      player.takeDamage(damage, { source: "boss" });
      
      // Heavy screen shake
      this.scene.cameras.main.shake(600, 0.03);
      
      // Show floating damage
      const gameScene = this.scene as any;
      if (gameScene.showFloatingText) {
        gameScene.showFloatingText(player.x, player.y - 50, `-${damage} HP!`, 0xff0000, 2000);
      }
    });
  }
  
  // SLIIZU: camera flash bursts + paparazzi finisher.
  public triggerSliizuFlashPhoto(targetX?: number, targetY?: number): void {
    if (this.bossType !== "jari_isometsa" || !this.canRunSceneEffects()) return;

    const centerX = Number.isFinite(targetX) ? Number(targetX) : this.x + (this.facingDirection === "left" ? -54 : 54);
    const centerY = Number.isFinite(targetY) ? Number(targetY) : this.y - 76;
    const snapX = Phaser.Math.Clamp(centerX, 56, Math.max(56, this.scene.scale.width - 56));
    const snapY = Phaser.Math.Clamp(centerY, 56, Math.max(56, this.scene.scale.height - 56));

    this.scene.cameras.main.flash(80, 255, 255, 255, true);

    const flash = this.scene.add.circle(snapX, snapY, 16, 0xffffff, 0.82);
    flash.setDepth(193);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 3.4,
      scaleY: 3.4,
      alpha: 0,
      duration: 180,
      ease: "Sine.Out",
      onComplete: () => flash.destroy()
    });

    const frame = this.scene.add.rectangle(snapX, snapY, 94, 70, 0xffffff, 0.94);
    frame.setStrokeStyle(3, 0x171717, 0.95);
    const photo = this.scene.add.rectangle(snapX, snapY - 7, 74, 44, 0xd5ecff, 0.95);
    photo.setStrokeStyle(2, 0x1f2937, 0.9);
    const label = this.scene.add.text(snapX, snapY + 20, "KLIK!", {
      fontFamily: "PublicPixel",
      fontSize: "10px",
      color: "#111111"
    });
    label.setOrigin(0.5, 0.5);

    const polaroid = this.scene.add.container(snapX, snapY, [frame, photo, label]);
    polaroid.setDepth(194);
    this.scene.tweens.add({
      targets: polaroid,
      y: snapY - 28,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 440,
      ease: "Quad.Out",
      onComplete: () => {
        polaroid.destroy(true);
      }
    });
  }

  performTeslaSpecialAttack(player: any): void {
    this.pauseChaseFor(1500);
    this.setVelocityX(0);
    const specialAnim = this.getAnimationKey("special");
    if (this.scene.anims.exists(specialAnim)) {
      this.playAnimation(specialAnim);
    }

    this.showTaunt('"HYPER-BURST KÄYNNISSÄ!"', 3200);
    this.triggerSliizuFlashPhoto(this.x, this.y - 74);
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.72,
      rate: 1.18,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(220, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });

    let landedBurstHits = 0;
    const burstTimings = [320, 560, 800];
    burstTimings.forEach((delayMs, burstIndex) => {
      this.scene.time.delayedCall(delayMs, () => {
        if (!this.canRunSceneEffects()) return;
        if (player.isDead || this.isDead) return;

        this.facingDirection = player.x < this.x ? "left" : "right";
        this.syncFacingVisual();

        const burstAnim = this.getAnimationKey("attack");
        if (this.scene.anims.exists(burstAnim)) {
          this.playAnimation(burstAnim);
        }

        const startX = this.x;
        const targetX = Phaser.Math.Clamp(
          player.x + Phaser.Math.Between(-26, 26),
          120,
          this.scene.scale.width - 120
        );
        this.triggerSliizuFlashPhoto(targetX, player.y - 44);
        const targetY = this.y;
        this.scene.tweens.add({
          targets: this,
          x: targetX,
          y: targetY,
          duration: 120,
          ease: "Quad.Out"
        });

        const trail = this.scene.add.particles(startX, this.y - 60, "snowflake", {
          speed: { min: 120, max: 250 },
          angle: this.facingDirection === "left" ? { min: 145, max: 215 } : { min: -35, max: 35 },
          scale: { start: 0.42, end: 0.08 },
          lifespan: 260,
          quantity: 18,
          tint: 0xffffff,
          blendMode: "ADD"
        });
        this.scene.time.delayedCall(110, () => {
          if (!this.canRunSceneEffects()) return;
          trail.stop();
          this.scene.time.delayedCall(260, () => {
            if (!this.canRunSceneEffects()) return;
            trail.destroy();
          });
        });

        if (player.canProcessBossAttack?.() && landedBurstHits < 2) {
          const dist = Phaser.Math.Distance.Between(targetX, this.y - 40, player.x, player.y - 38);
          const hitRadius = burstIndex === 2 ? 170 : 145;
          if (dist <= hitRadius) {
            landedBurstHits++;
            const burstDamage = Math.max(
              1,
              Math.round(this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.2)))
            );
            player.takeDamage(burstDamage, { source: "boss" });
          }
        }
      });
    });

    this.scene.time.delayedCall(980, () => {
      if (!this.canRunSceneEffects()) return;
      if (player.isDead || this.isDead) return;
      this.triggerSliizuFlashPhoto(player.x, player.y - 40);

      // Powder cloud finish.
      const particles = this.scene.add.particles(this.x, this.y - 60, "snowflake", {
        speed: { min: 210, max: 430 },
        angle: this.facingDirection === "left" ? { min: 150, max: 210 } : { min: -30, max: 30 },
        scale: { start: 0.56, end: 0.1 },
        lifespan: 920,
        quantity: 36,
        tint: 0xffffff,
        blendMode: "ADD"
      });

      this.scene.time.delayedCall(220, () => {
        if (!this.canRunSceneEffects()) return;
        particles.stop();
        this.scene.time.delayedCall(950, () => {
          if (!this.canRunSceneEffects()) return;
          particles.destroy();
        });
      });

      const powderText = this.scene.add.text(
        (this.x + player.x) / 2,
        this.y - 80,
        '"VALKOINEN PILVI!"',
        {
          fontFamily: "PublicPixel",
          fontSize: "20px",
          color: "#ffffff",
          backgroundColor: "#333333",
          padding: { x: 8, y: 4 },
        }
      );
      powderText.setOrigin(0.5, 1);
      powderText.setDepth(200);
      
      this.scene.tweens.add({
        targets: powderText,
        alpha: 0,
        y: powderText.y - 50,
        duration: 2100,
        onComplete: () => powderText.destroy()
      });

      const finishDamage = this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.28));
      if (player.canProcessBossAttack?.()) {
        player.takeDamage(finishDamage, { source: "boss" });
      }
      this.scene.cameras.main.shake(420, 0.022);

      const gameScene = this.scene as any;
      if (gameScene.showFloatingText && !player.isInvulnerable) {
        gameScene.showFloatingText(player.x, player.y - 50, `-${finishDamage} HP!`, 0xff0000, 2000);
      }
    });
  }
  
  // Golf Pro: Drives a golf ball at player
  performGolfSpecialAttack(player: any): void {
    // Show special attack taunt
    this.showTaunt('"HOLE IN ONE, KÖYHÄ!"', 3000);
    
    // Play attack sound
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.7,
      rate: 0.9,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(500, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });
    
    this.scene.time.delayedCall(700, () => {
      if (!this.canRunSceneEffects()) return;
      if (!player || player.isDead || player.active === false || this.isDead) return;
      
      // Create golf ball projectile visual
      const golfBall = this.scene.add.circle(this.x, this.y - 50, 12, 0xffffff);
      golfBall.setDepth(150);
      
      // Animate golf ball toward player
      this.scene.tweens.add({
        targets: golfBall,
        x: player.x,
        y: player.y - 50,
        duration: 400,
        ease: "Power2",
        onComplete: () => {
          golfBall.destroy();
          if (!this.canRunSceneEffects()) return;
          if (!player || player.isDead || player.active === false || this.isDead) return;

          // Deal 50% of player's MAX health as damage, with sane fallback.
          const playerMaxHealth = Number(player.maxHealth);
          const baseDamage = Math.floor((Number.isFinite(playerMaxHealth) ? playerMaxHealth : 100) * 0.5);
          const damage = this.scaleSpecialAttackDamage(Math.max(1, baseDamage));
          if (typeof player.takeDamage === "function" && player.canProcessBossAttack?.()) {
            player.takeDamage(damage, { source: "boss" });
          }

          // Screen shake
          this.scene.cameras.main.shake(400, 0.025);
          this.scene.cameras.main.flash(100, 255, 255, 255, true);

          // Show floating damage
          const gameScene = this.scene as any;
          if (gameScene.showFloatingText && !player.isInvulnerable) {
            gameScene.showFloatingText(player.x, player.y - 50, `-${damage} HP!`, 0xff0000, 2000);
          }
        }
      });
    });
  }
  
  // Timo Soini: Yells "TÄSS SINULLE ISO JYTKY" and spits mucus - 60% damage!
  performTimoSpecialAttack(player: any): void {
    // Show special attack taunt - THE FAMOUS JYTKY!
    this.showTaunt('"TÄSS SINULLE ISO JYTKY!"', 4000);
    
    // Flash the screen with Perussuomalaiset colors (blue/white)
    this.scene.cameras.main.flash(400, 0, 100, 200, true);
    
    // Play attack sound with low pitch for dramatic effect
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.9,
      rate: 0.5,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(780, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });
    
    this.scene.time.delayedCall(1000, () => {
      if (!this.canRunSceneEffects()) return;
      if (player.isDead || this.isDead) return;
      
      // Create mucus/spit projectile effect
      const mucusColors = [0x88ff88, 0x66cc66, 0x99ff99];
      
      // Create multiple mucus globs
      for (let i = 0; i < 5; i++) {
        const mucus = this.scene.add.circle(
          this.x + Phaser.Math.Between(-20, 20),
          this.y - 60 + Phaser.Math.Between(-10, 10),
          Phaser.Math.Between(8, 15),
          Phaser.Math.RND.pick(mucusColors)
        );
        mucus.setDepth(150);
        mucus.setAlpha(0.9);
        
        // Animate mucus toward player with slight spread
        this.scene.tweens.add({
          targets: mucus,
          x: player.x + Phaser.Math.Between(-30, 30),
          y: player.y - 30 + Phaser.Math.Between(-20, 20),
          duration: 500 + i * 50,
          ease: "Power1",
          onComplete: () => {
            // Splat effect
            this.scene.tweens.add({
              targets: mucus,
              scaleX: 2,
              scaleY: 0.5,
              alpha: 0,
              duration: 300,
              onComplete: () => mucus.destroy()
            });
          }
        });
      }
      
      // Show the famous text
      const jytkyText = this.scene.add.text(
        this.scene.scale.width / 2,
        this.scene.scale.height / 2 - 100,
        'ISO JYTKY!',
        {
          fontFamily: "PublicPixel",
          fontSize: "48px",
          color: "#ffff00",
          backgroundColor: "#0000aa",
          padding: { x: 20, y: 10 },
        }
      );
      jytkyText.setOrigin(0.5, 0.5);
      jytkyText.setDepth(300);
      jytkyText.setScrollFactor(0);
      
      this.scene.tweens.add({
        targets: jytkyText,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        y: jytkyText.y - 100,
        duration: 3000,
        ease: "Power2",
        onComplete: () => jytkyText.destroy()
      });
      
      // Deal 60% of player's MAX health as damage - THE ULTIMATE JYTKY!
      const damage = this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.6));
      player.takeDamage(damage, { source: "boss" });
      
      // Heavy screen shake for the JYTKY
      this.scene.cameras.main.shake(800, 0.04);
      
      // Show floating damage
      const gameScene = this.scene as any;
      if (gameScene.showFloatingText) {
        gameScene.showFloatingText(player.x, player.y - 50, `-${damage} HP!`, 0xff0000, 2000);
      }
    });
  }
  
  // LATU KEISARI (Level 4): bass-drop shockwave special attack.
  performLitmanenSpecialAttack(player: any): void {
    this.pauseChaseFor(1700);
    this.setVelocityX(0);

    const specialAnim = this.getAnimationKey("special");
    if (this.scene.anims.exists(specialAnim)) {
      this.playAnimation(specialAnim);
    }

    this.showTaunt('"LATU KEISARI MEGADROPPI! BASSO MURTAA LADUN!"', 3600);
    this.scene.cameras.main.flash(450, 255, 40, 180, true);
    utils.playManagedSound(this.scene, "boss_attack", {
      volume: 0.85,
      rate: 0.72,
      pitchVariation: 0,
      detuneVariation: 0
    });
    this.scene.time.delayedCall(120, () => {
      if (!this.canRunSceneEffects()) return;
      this.playImpactWarningCue();
    });

    // Three expanding neon pulses to telegraph and sell the impact.
    const pulseOffsets = [260, 520, 760];
    const pulseRadius = [220, 290, 360];
    const pulseColor = [0xff4fd7, 0xff8f2b, 0x5ee8ff];
    let hitApplied = false;

    pulseOffsets.forEach((offsetMs, index) => {
      this.scene.time.delayedCall(offsetMs, () => {
        if (!this.canRunSceneEffects() || player.isDead || this.isDead) return;

        const wave = this.scene.add.circle(this.x, this.y - 58, 32, pulseColor[index], 0.33);
        wave.setDepth(190);
        wave.setStrokeStyle(5, pulseColor[index], 0.9);
        this.scene.tweens.add({
          targets: wave,
          scaleX: 6.1 + index,
          scaleY: 4.2 + index * 0.7,
          alpha: 0,
          duration: 420,
          ease: "Sine.Out",
          onComplete: () => wave.destroy()
        });

        this.scene.cameras.main.shake(130, 0.012 + index * 0.002);

        if (hitApplied || !player.canProcessBossAttack?.()) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y - 58, player.x, player.y - 40);
        if (dist <= pulseRadius[index]) {
          hitApplied = true;
          const damage = this.scaleSpecialAttackDamage(Math.floor(player.maxHealth * 0.5));
          player.takeDamage(damage, { source: "boss" });

          const gameScene = this.scene as any;
          if (gameScene.showFloatingText) {
            gameScene.showFloatingText(player.x, player.y - 50, `-${damage} HP!`, 0xff0044, 2000);
          }
        }
      });
    });
  }

  // ========== LEGACY FOOTBALL ATTACK (no longer default in Level 4) ==========
  // Kept for compatibility with older attack paths.
  performFootballKickAttack(): void {
    if (this.bossType !== "jari_litmanen") return;
    
    const gameScene = this.scene as any;
    const player = gameScene.player;
    if (!player || player.isDead || this.isDead) return;
    
    // Play kick animation
    this.playAnimation(this.getAnimationKey("kick"));
    
    // Play football kick sound
    this.scene.sound.play("football_kick", { volume: 0.5 });
    
    // Small delay for kick animation to show
    this.scene.time.delayedCall(100, () => {
      if (!this.canRunSceneEffects()) return;
      if (this.isDead) return;
      
      // Spawn football from boss's feet
      const startX = this.facingDirection === "left" ? this.x - 50 : this.x + 50;
      const startY = this.y - 40;
      
      const football = this.scene.add.image(startX, startY, "football_projectile");
      utils.initScale(football, { x: 0.5, y: 0.5 }, undefined, 30);
      football.setDepth(150);
      
      // Target player position
      const targetX = player.x;
      const targetY = player.body.center.y;
      
      // Calculate rotation direction
      const rotationDir = this.facingDirection === "left" ? -1 : 1;
      
      // Animate football toward player
      this.scene.tweens.add({
        targets: football,
        x: targetX,
        y: targetY,
        rotation: rotationDir * Math.PI * 4, // Spin the ball
        duration: 400,
        ease: "Power1.easeIn",
        onComplete: () => {
          // Check if player is hit (simple distance check)
          const distToPlayer = Phaser.Math.Distance.Between(
            football.x, football.y,
            player.x, player.body.center.y
          );
          
          if (distToPlayer < 60 && !player.isDead && player.canProcessBossAttack?.()) {
            // Hit player with damage
            player.takeDamage(this.damage, { source: "boss" });
            
            // Impact effect
            this.scene.cameras.main.shake(100, 0.01);
            
            // Show damage number
            if (gameScene.showDamageNumber) {
              gameScene.showDamageNumber(player.x, player.y - 50, this.damage);
            }
          }
          
          football.destroy();
        }
      });
    });
  }

  // Damage method
  takeDamage(damage: number) {
    if (this.isDead) return;
    const now = this.scene?.time?.now ?? 0;
    const inInterruptWindow = now <= this.interruptWindowUntil;
    this.interruptWindowUntil = 0;

    let appliedDamage = Math.max(1, Math.round(damage));
    if (this.shieldActive) {
      this.shieldHitsRemaining = Math.max(0, this.shieldHitsRemaining - 1);
      appliedDamage = 1;
      this.scene.events.emit("floatingAnnouncement", {
        text: `SUOJA KESTO: ${this.shieldHitsRemaining}`,
        duration: 900
      });
      if (this.shieldHitsRemaining <= 0) {
        this.shieldActive = false;
        this.scene.cameras.main.flash(120, 120, 255, 255, true);
        this.showTaunt('"SUOJA MURTUI!"', 1400);
      }
    } else {
      const rageGain = Phaser.Math.Clamp((appliedDamage / this.maxHealth) * 220, 4, 24);
      this.rageMeter = Phaser.Math.Clamp(this.rageMeter + rageGain, 0, this.rageMeterMax);
      if (this.rageMeter >= this.rageMeterMax) {
        this.rageMeter -= this.rageMeterMax;
        this.pendingRageSpecial = true;
        this.scheduleNextSpecialAttack(0.4);
        this.scene.events.emit("floatingAnnouncement", {
          text: "BOSSI LATAA SUPERIA!",
          duration: 1100
        });
      }
    }

    if (inInterruptWindow && now - this.lastSuccessfulInterruptAt > 600) {
      this.lastSuccessfulInterruptAt = now;
      this.interruptStunExtraMs = Math.max(this.interruptStunExtraMs, 700);
      this.scene.events.emit("bossAttackTelegraph", {
        kind: "phase",
        attackName: "KESKEYTYS!",
        bossType: this.bossType
      });
      this.showTaunt('"KESKEYTYS?! EI SAATANA!"', 1300);
    }

    this.health -= appliedDamage;
    
    // Screen shake on boss hit
    this.scene.cameras.main.shake(100, 0.005);
    
    this.updateHealthBar();

    if (this.health <= this.maxHealth * 0.1) {
      const gameScene = this.scene as any;
      if (typeof gameScene.triggerBossFinisherImpact === "function") {
        gameScene.triggerBossFinisherImpact(this);
      }
    }
    
    if (this.health <= 0) {
      this.fsm.goto("dying");
    } else {
      const flinchCooldownMs = this.currentPhase >= 3 ? 240 : this.currentPhase === 2 ? 310 : 380;
      const hurtOnCooldown = now < this.nextHurtReactionAt;
      const shouldIgnoreFlinch =
        !inInterruptWindow &&
        (
          hurtOnCooldown ||
          (
            this.isAttacking &&
            (this.isDamageReactionLocked(now) || this.isCommittedAttackState())
          )
        );

      if (shouldIgnoreFlinch) {
        this.setTint(0xffdddd);
        this.scene.time.delayedCall(85, () => {
          if (!this.active || this.isDead || this.isHurting) return;
          if (this.isEnraged) {
            this.setTint(0xff6666);
          } else {
            this.clearTint();
          }
        });
      } else {
        this.nextHurtReactionAt = now + flinchCooldownMs;
        this.fsm.goto("hurting");
      }
    }
  }

  // Get health percentage
  getHealthPercentage(): number {
    return (this.health / this.maxHealth) * 100;
  }

  private scaleSpecialAttackDamage(rawDamage: number): number {
    return Math.max(
      1,
      Math.floor(
        rawDamage *
        BOSS_STRIKE_DAMAGE_MULTIPLIER *
        BOSS_GLOBAL_DAMAGE_TUNING *
        this.specialDamageScaleMultiplier
      )
    );
  }

  // Initialize sound effects
  initializeSounds(): void {
    this.attackSound = utils.safeAddSound(this.scene, "boss_attack", { volume: 0.4 });
    this.hitSound = utils.safeAddSound(this.scene, "enemy_hit", { volume: 0.4 });
    this.appearSound = utils.safeAddSound(this.scene, "boss_appear", { volume: 0.5 });
    this.defeatSound = utils.safeAddSound(this.scene, "boss_defeat", { volume: 0.6 });
  }

  // ========== BOSS TAUNT SYSTEM ==========
  
  // Taunt cooldown tracking
  lastTauntTime: number = 0;
  tauntCooldown: number = 4000; // 4 seconds between taunts
  tauntExtraDurationMs: number = 2000; // Keep taunts visible +2s for readability
  private tauntChanceMultiplier: number = 0.7;
  private tauntTextObject?: Phaser.GameObjects.Text;

  private canRunSceneEffects(): boolean {
    return !!this.scene && this.scene.sys.isActive() && this.active;
  }

  private acquireTauntText(): Phaser.GameObjects.Text | null {
    if (!this.scene) return null;
    if (!this.tauntTextObject || this.tauntTextObject.scene !== this.scene) {
      this.tauntTextObject = this.scene.add.text(0, 0, "", {
        fontFamily: "PublicPixel",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 8, y: 4 },
        align: "center",
        wordWrap: { width: 200 }
      });
      this.tauntTextObject.setOrigin(0.5, 1);
      this.tauntTextObject.setDepth(150);
      this.tauntTextObject.setVisible(false);
      this.tauntTextObject.setActive(false);
    }

    this.scene.tweens.killTweensOf(this.tauntTextObject);
    this.tauntTextObject.setActive(true);
    this.tauntTextObject.setVisible(true);
    this.tauntTextObject.setAlpha(1);
    this.tauntTextObject.setScale(1);
    return this.tauntTextObject;
  }

  private recycleTauntText(destroy: boolean = false): void {
    if (!this.tauntTextObject) return;
    if (this.scene && this.tauntTextObject.scene === this.scene) {
      this.scene.tweens.killTweensOf(this.tauntTextObject);
    }

    if (destroy) {
      this.tauntTextObject.destroy();
      this.tauntTextObject = undefined;
      return;
    }

    this.tauntTextObject.setActive(false);
    this.tauntTextObject.setVisible(false);
    this.tauntTextObject.setAlpha(1);
    this.tauntTextObject.setScale(1);
  }
  
  // Get a random taunt quote for this boss
  getRandomTaunt(): string {
    const taunts = [...BOSS_TAUNTS[this.bossType], ...BOSS_TAUNT_EXTRA];
    return Phaser.Math.RND.pick(taunts);
  }
  
  // Get a random enrage taunt for this boss
  getEnrageTaunt(): string {
    const taunts = BOSS_ENRAGE_TAUNTS[this.bossType];
    return Phaser.Math.RND.pick(taunts);
  }
  
  // Get a random hurt taunt for this boss
  getHurtTaunt(): string {
    const taunts = BOSS_HURT_TAUNTS[this.bossType];
    return Phaser.Math.RND.pick(taunts);
  }
  
  // Show a taunt speech bubble above the boss
  showTaunt(text: string, duration: number = 2500): void {
    if (!FLAVOR_TEXT_ENABLED && this.bossType !== "marja_liisa") return;
    if (!this.scene || this.isDead) return;
    const safeText = sanitizePlayerFacingText(text);
    if (!safeText) return;

    const prefersLevel6Intro = this.bossType === "tero_afterwork"
      && this.scene.anims.exists("level6_boss_intro_anim");
    const prefersLahtiIntro = this.bossType === "jari_litmanen"
      && this.scene.anims.exists("litmanen_boss_intro_anim");
    const prefersElsaIntro = this.bossType === "elsa_mummo"
      && this.scene.anims.exists("elsa_boss_intro_anim");
    const prefersIntroTauntAnim = (prefersLevel6Intro || prefersLahtiIntro || prefersElsaIntro) && Math.random() < 0.45;
    const tauntAnim = prefersIntroTauntAnim
      ? (
        this.bossType === "tero_afterwork"
          ? "level6_boss_intro_anim"
          : this.bossType === "elsa_mummo"
            ? "elsa_boss_intro_anim"
            : "litmanen_boss_intro_anim"
      )
      : this.getAnimationKey("taunt");
    if (this.scene.anims.exists(tauntAnim) && !this.isAttacking && !this.isHurting) {
      this.playAnimation(tauntAnim);
      this.scene.time.delayedCall(Math.min(duration, 700), () => {
        if (!this.canRunSceneEffects() || this.isAttacking || this.isHurting || this.isDead) return;
        this.playAnimation(this.getAnimationKey("idle"));
      });
    }
    
    // Create speech bubble text
    // Position above boss's head (origin is 0.5, 1.0 so y is at feet)
    const bossTopY = this.y - this.displayHeight;
    const tauntText = this.acquireTauntText();
    if (!tauntText) return;
    tauntText.setPosition(this.x, bossTopY - 30);
    tauntText.setText(safeText);
    
    // Animate the taunt
    this.scene.tweens.add({
      targets: tauntText,
      y: tauntText.y - 20,
      alpha: { from: 1, to: 0 },
      duration: duration + this.tauntExtraDurationMs,
      ease: "Power2",
      onComplete: () => {
        this.recycleTauntText();
      }
    });
  }
  
  // Try to show a random taunt (respects cooldown)
  tryShowTaunt(): void {
    const now = this.scene.time.now;
    if (now - this.lastTauntTime < this.tauntCooldown) return;
    if (Math.random() > this.tauntChanceMultiplier) return;
    
    this.lastTauntTime = now;
    this.showTaunt(this.getRandomTaunt());
  }
  
  // Show taunt when entering enrage mode
  showEnrageTaunt(): void {
    this.showTaunt(this.getEnrageTaunt(), 3000);
  }
  
  // Show taunt when hurt (with lower chance to not spam)
  tryShowHurtTaunt(): void {
    if (Math.random() < 0.3 * this.tauntChanceMultiplier) {
      this.showTaunt(this.getHurtTaunt(), 1500);
    }
  }

  // Override destroy to clean up
  destroy(fromScene?: boolean): void {
    // Remove melee trigger
    if (this.meleeTrigger && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene && gameScene.enemyMeleeTriggers) {
        gameScene.enemyMeleeTriggers.remove(this.meleeTrigger, true, true);
      }
      if (this.meleeTrigger.active) {
        this.meleeTrigger.destroy();
      }
    }
    
    // Destroy health bar
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
    }
    if (this.healthBarFill) {
      this.healthBarFill.destroy();
    }
    this.attackSound?.destroy();
    this.hitSound?.destroy();
    this.appearSound?.destroy();
    this.defeatSound?.destroy();
    this.recycleTauntText(true);
    
    super.destroy(fromScene);
  }
}
