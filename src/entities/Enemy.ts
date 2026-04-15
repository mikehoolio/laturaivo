import Phaser from "phaser";
import * as utils from "../utils";
import { enemyConfig } from "../gameConfig.json";
import { EnemyFSM } from "./EnemyFSM";
import { sanitizePlayerFacingText } from "../content/PlayerTextPolicy";
import { ENEMY_DIALOG_EXTRA } from "../humor/HumorPack";

type Direction = "left" | "right";

// Espoo douchebag quotes for regular enemies - annoying ski track stereotypes + absurd humor
const ENEMY_TAUNTS: string[] = [
  // Classic ladun omistaja -asenne
  '"TÄMÄ LATU ON VARATTU!"',
  '"VÄISTÄ TAI VÄISTÄN PUOLESTASI!"',
  '"OSAATKO EDES LUKEA LATUMERKKEJÄ?!"',
  '"KAHDEKSANSATAA EUROA SUKSET JA SÄ TUUT TÄHÄN?!"',
  '"ESPOO ON SUOMEN MONACO!"',
  '"KEHÄ KOLMOSEN SISÄPUOLELLA EI OO LATUJA!"',
  '"SÄÄNNÖT ON KEKSITTY SUN TAKIA!"',
  '"KAUSIKORTTI TASKUSSA, ASENNE KOHDILLAAN!"',
  '"LATUPOLIISI ON SPEED DIALISSA!"',
  '"TESLA LÄMMITTELEE PARKKIKSELLA!"',
  
  // Ylimielisyys ja status
  '"OLIN TÄÄLLÄ ENNEN SUN SYNTYMÄÄ!"',
  '"JURISTI VAIMONI HOITAA TÄMÄN!"',
  '"GOOGLAA NIMENI!"',
  '"GOLFKENTTÄ SULKI NIIN TULIN TÄNNE!"',
  '"LAPSENI ON LAHJAKKAAMPI KUIN SINÄ!"',
  '"WESTENDIN PARAS HIIHTOASU PÄÄLLÄ!"',
  '"PADEL ON LIIAN HELPPOA MULLE!"',
  '"SYKEMITTARINI ON KALLIIMPI KUIN ASUNTOSI!"',
  '"KOIRAT KUULUU KOIRALADULLE!"',
  '"LATU EI OO LEIKKIKENTTÄ!"',
  
  // Absurdi ylimielisyys
  '"MÖKKI NAANTALISSA, SIELÄ EI OO TÄLLAISIA!"',
  '"HIIHDIN SDP:TÄ NOPEAMMIN!"',
  '"HOT JOOGAN JÄLKEEN OON VAARALLINEN!"',
  '"14 EURON SMOOTHIE VIRTAA SUONISSANI!"',
  '"AUTONI PAINAA ENEMMÄN KUIN ELÄMÄSI!"',
  '"VEGAANISUUS TEKEE MINUT YLIVOIMAISEKSI!"',
  '"KOMBUCHALLA ON VOIMAA!"',
  '"TUBETTAJA-PT OPETTI TÄMÄN LIIKKEEN!"',
  '"ALEXA! SOITA LATUPOLIISI!"',
  '"SUN ÄITIS TEKI MULLE AAMUPALAN!"',
  
  // Tech-hifistely
  '"PREMIUMILLA ON MERKITYSTÄ!"',
  '"NFT:NI ON KOHTA ARVOKAS!"',
  '"NAVIGAATTORI SANOO OLEVASI VÄÄRÄSSÄ!"',
  '"PSYKOLOGINI VAROITTI SUN KALTAISISTA!"',
  '"KOIRANI EI KESTÄ RUUHKA-AIKAA!"',
  '"WOLT TUO MULLE AVOKADOT TÄNNEKIN!"',
  '"BIOHAKKEROINTI TEKI MINUT TÄYDELLISEKSI!"',
  '"16:8 PAASTO ON ELÄMÄNTAPA!"',
  '"GOLF-HANDICAP KOLME, MITÄ SULLA?"',
  '"GUCCI-ASU, GUCCI-ASENNE!"',
  
  // Sääntöpykälät
  '"HYPPIMINEN KIELLETTY TÄÄLLÄ!"',
  '"COLD PLUNGE TEKI MINUT KOVAKSI!"',
  '"KRYPTO PORTFOLIONI DOMINOI!"',
  '"AMBIVERTTINÄ VIHAAN KAIKKIA TASAPUOLISESTI!"',
  '"TERAPEUTTI KUULEE TÄSTÄ!"',
  '"STRAVA-SEURANTANI NÄKEE KAIKEN!"',
  '"HUONO AURASI PILAA PÄIVÄNI!"',
  '"20 VUOTTA TÄÄLLÄ JA SÄ TUUT NYT?!"',
  '"SE SAUVAKULMASI ON TÄYSIN VÄÄRIN!"',
  '"30K SEURAAJAA ODOTTAA SISÄLTÖÄ!"',
];

const ENEMY_TAUNTS_EXTRA: string[] = [
  '"KELLOTAAN TÄMÄ KILPASOVELLUKSEEN!"',
  '"LATU ON MINUN TYÖHYVINVOINTIA!"',
  '"NÄILLÄ MONOILLA EI ODOTELLA!"',
  '"VÄISTÄ, MULLA ON PALAVERI 12:15!"',
  '"HIDAS LATU, NOPEA ASENNE!"',
  '"TÄMÄ ON PREMIUM-HIIHTOA!"',
  '"MUN KALENTERI EI SIEDÄ RUUHKAA!"',
  '"JONON PERÄ TULEE TUOLTA!"',
  '"TÄÄLTÄ TULEE KAUSIKORTTILAINEN!"',
  '"KATSO LINJA, ÄLÄ MINUA!"',
  '"SAUVAT PUHUU TÄNÄÄN!"',
  '"MULLA ON KAKSI VARA-LATUA MUISTISSA!"',
  '"SÄÄNNÖT ON YKSINKERTAISET: MINÄ ENSIN!"',
  '"LATU EI OO KESKUSTELUPAIKKA!"',
  '"HIIHTO ON KURIA, EI TAIDETTA!"',
  '"MUN STRAVA-SEGMENTTI EI ODOTTELE!"',
  '"PARKKIKSELTA TÄNNE 43 SEKUNTIA!"',
  '"TÄMÄN LINGONTAHTI ON KALLIS!"',
  '"HIIHTOLASIT ON AIDOT KISAMALLIT!"',
  '"POLAR HUUTAA UUTTA ENNÄTYSTÄ!"',
  '"MUN TERMOS MAASTOUTUU SUN TAKIA!"',
  '"LADUN ETIKETTI ON HENGENASIA!"',
  '"MULLA ON TÄSSÄ AJO-OIKEUS!"',
  '"NÄILLÄ SAUVOILLA EI JARRUTETA!"',
  '"SÄ OOT VÄÄRÄSSÄ KAISTASSA!"',
  '"VÄISTÖTILAUS LÄHETETTY!"',
  '"LADUN LIIKENNEKESKUS VAROITTI SINUSTA!"',
  '"SUKSIPARI MAKSAA ENEMMÄN KUIN VUOKRASI!"',
  '"TÄMÄ ON HIIHTO, EI SIGHTSEEING!"',
  '"OHITUS OIKEALTA, KIITOS!"',
  '"MUN HUOLTOTIIMI ITKEE TÄTÄ!"',
  '"TAHTI ON KOVA, KOITA PYSYÄ!"',
  '"AAMUN KOLMAS TREENI VASTA MENOSSA!"',
  '"LATU EI SOVI EPÄRÖINNILLE!"',
  '"MUN RECOVERY-DRINKKI JÄÄHTYY!"',
  '"TÄMÄ ON KAAOS, JOTA EN TILANNUT!"',
  '"VOISITKO OLLA HIDAS JOSKUS MUUALLA?"',
  '"SIVUSILMÄLLÄKIN NÄEN TÄMÄN VIRHEEN!"',
  '"MULLA ON GPS-POHJAINEN ETU!"',
  '"LATU ON TARKKUUSLAJI!"',
  '"MUN KISALINJA MENI PILALLE!"',
  '"TÄSSÄ TARVITAAN JÄRJESTYSMIES!"',
  '"LADUN SOPIMUSEHDOT RIKOTTU!"',
  '"LIIAN PALJON HARRASTELIJOITA TÄNÄÄN!"',
  '"KOITA NYT OLLA TÖRMÄÄMÄTTÄ TYÖPÄIVÄÄNI!"',
  '"MUN PULSSI ON BUDJETOITU TARKASTI!"',
  '"KOKO WESTEND NÄKEE TÄMÄN!"',
  '"EI NÄIN, EI IKINÄ NÄIN!"',
  '"MUN HIIHTOAPPI ANTOI PUNAISEN HÄLYN!"',
  '"OLEN AJANHALLINNAN UHRI!"',
  '"KELI ON TÄYDELLINEN, KANSSA EI!"',
  '"MULLE LUVATTIIN TYHJÄ LATU!"',
  '"TÄMÄ PILAA KOKO HARJOITUSJAKSON!"',
  '"LATUPROTOKOLLA SANOO EI!"',
  '"SUKSIVOIDE EI PELASTA TÄTÄ!"',
  '"TÄSSÄ TARVITAAN AMMATTIAJOA!"',
  '"MUN KUNTO ON EXCELISSÄ TODISTETTU!"',
  '"TAHTI ON TUTKITTU, ÄLÄ RIKO DATAA!"',
  '"HUOMAAKO KUKAAN MUU TÄMÄN EPÄJÄRJESTYKSEN?!"',
  '"TÄMÄ LATU TARVITSEE LAATUKÄSIKIRJAN!"'
];

const TURKU_ENEMY_TAUNTS: string[] = [
  '"Eläksääki viel"',
  '"Olek Raumalt ku oot noi kiukkune?"',
  '"olek sää Täältpuolt jokkee-vai tuolt puolt jokkee"',
  '"siel olis Tepsi peli tänää telkkaris"',
  '"Kui sää tommottii hiihät?"',
  '"Mää ole se joka teki ne poliisimurhat"',
  '"Henki lähtis, tää täst viel puuttuki"',
  '"Mää heitä sut Aurajokkee"',
  '"Heses on muute vaik kui herkulliset majoneesit"'
];

const TURKU_ENEMY_TAUNTS_EXTRA: string[] = [
  '"Mikä hoppu, torilki ehtii viel"',
  '"Nyt menee kyl aivan vihkoon"',
  '"Mää en kyl jaksa tätä sekoiluu"',
  '"Sää hiihät ko puurokattila"',
  '"Ei näin voi ajaa ladul"',
  '"Tää o iha sekasikiömäine ruuhka"',
  '"Mää soita ny heti huoltoolle"',
  '"Sää et oo nähnykkää kunno hiihtoo"',
  '"Jokkee varres o parempi meno"',
  '"Nyt kyl hermo meni ja pitkäst"'
];

// Attack taunts - said when enemy starts attacking
const ENEMY_ATTACK_TAUNTS: string[] = [
  '"LUNTA NAAMAAN!"',
  '"NYT OPETELLAAN!"',
  '"TÄMÄ ON OPETUSHETKI!"',
  '"ESPOO-STYLE!"',
  '"HÄPEÄ ITSEÄSI!"',
  '"SUKSESI KUOLEE!"',
  '"BRUNCHITON SUNNUNTAI SULLE!"',
  '"PADEL-SMASH!"',
  '"HIIHTOKOULU EI OPETTANUT TÄTÄ!"',
  '"WESTEND SPECIAL!"',
  '"ÄITINI KUULEE TÄSTÄ!"',
  '"PULSSI 180, LYÖNTI TULOSSA!"',
  '"PROTEIINIVOIMA!"',
  '"AUTOPILOT HYÖKKÄYS!"',
  '"GOLFLYÖNTI!"',
  '"MINDFUL MUKILOINTI!"',
  '"KOTIRUOKAENERGIA!"',
  '"AVOKADO-ISKU!"',
  '"PREMIUM-POTKU!"',
  '"UNBOXING: SUN NAAMA!"',
  '"TERVEELLINEN VÄKIVALTA!"',
  '"HIIHTÄJÄN KUNNIA!"',
  '"SUKSIVOIDE SUONISSA!"',
  '"LAKTOOSITON LÄIMÄYTYS!"',
];

const ENEMY_ATTACK_TAUNTS_EXTRA: string[] = [
  '"NYT TULEE LATU-LÄKSY!"',
  '"OHITUS KOVALLA KÄDELLÄ!"',
  '"LINJA KUNTOON NYT!"',
  '"TÄMÄ ON NOPEA OIKAISU!"',
  '"SUKSET ETEEN, JÄRKI PERÄÄN!"',
  '"VAROITUS ISKU ALKAA!"',
  '"SIVUUN TAI SAUVAT PUHUU!"',
  '"TÄÄ OLI VIIMEINEN VAROITUS!"',
  '"NÄILLÄ KIERROKSILLA EI ARMOA!"',
  '"TASOERO NÄKYY NYT!"',
  '"HIIHTOTUNTI ALKAA HETI!"',
  '"RATKAISEVA KIRI NYT!"',
  '"NOPEA PALAUTE TULOSSA!"',
  '"SUUNTA KORJAUS LYÖMÄLLÄ!"',
  '"TÄMÄ ON LATU-KONTROLLI!"',
  '"ENNUSTAN NOPEAN TÖRMÄYKSEN!"',
  '"SAUVAPARIN OIKEA KÄYTTÖKOE!"',
  '"KISARYTMI RUMMUTTAA!"',
  '"NYT MENEE AEROBINEN YLI!"',
  '"MOBIILI-MUKILOINTI!"',
  '"ASENNEISKU TULOSSA!"',
  '"AJOITUS ON TÄYDELLINEN!"',
  '"LATUBOOSTI NAAMAAN!"',
  '"TÄSTÄ TULEE OPPIMISKOKEMUS!"'
];

// Hurt taunts - said when enemy takes damage
const ENEMY_HURT_TAUNTS: string[] = [
  '"AU! GORE-TEX REPEÄÄ!"',
  '"APUVA!"',
  '"112! 112! 112!"',
  '"SE TAKKI MAKSOI TONNIN!"',
  '"NÄIN EI TEHTY TAPIOLASSA!"',
  '"FACEBOOK-RYHMÄ KUULEE TÄSTÄ!"',
  '"APPLE WATCH HAJOSI!"',
  '"TÄSTÄ TULEE INSTAGRAM-STORY!"',
  '"HIUSTENVÄRJÄYS MENI PILALLE!"',
  '"ÄITINI SOITTAA ISÄLLESI!"',
  '"AURANI REPEÄÄ!"',
  '"GOOGLE-ARVOSTELU TULOSSA!"',
  '"KYNSILLE TULI NAARMU!"',
  '"CHAKRANI SEKOITTUU!"',
  '"TÄMÄ EI OLE WELLNESS!"',
  '"SMOOTHIENI KAATUI!"',
  '"JURISTI SPEED DIALISSA!"',
  '"EGONI EI KESTÄ!"',
  '"FLOW-TILA KATOSI!"',
  '"HENGITYSHARJOITUS KESKEYTYY!"',
  '"VAKAVASTI!? IHAN OIKEESTI!?"',
  '"ISÄ TIETÄÄ IHMISIÄ!"',
  '"SELF-CARE-PÄIVÄ PILALLA!"',
  '"VAKUUTUS KORVAA!"',
  '"DESIGNER-HANSKAT LIKAANTUI!"',
  '"TÄSTÄ TEHDÄÄN PODCAST!"',
  '"ILMOITAN KULUTTAJAVIRASTOON!"',
  '"TÄTÄ EN TILANNUT!"',
];

const ENEMY_HURT_TAUNTS_EXTRA: string[] = [
  '"EI NÄIN PITÄNYT MENNÄ!"',
  '"MUN TEKNIKKA ROMAHTI!"',
  '"TÄMÄ OLI PAHA BUMPPI!"',
  '"LATU HYLKÄSI MUT!"',
  '"MUN RYTMI HAJOSI!"',
  '"TÄSTÄ JÄÄ PALAUTELOMAKE!"',
  '"NISKATUKI KIITOS!"',
  '"MUN PULSSIKÄYRÄ MENI SEKAISIN!"',
  '"KAIKKI MENI VINOOON!"',
  '"TÄSTÄ TULEE PITKÄ ILTA!"',
  '"EN OLLUT VALMIS TÄHÄN!"',
  '"SUKSI LIPSAHTI JA ELÄMÄ MYÖS!"',
  '"TÄMÄ SATUTTAA MYÖS EGOON!"',
  '"MUN KUNTOKELLO ITKEE!"',
  '"REISILIHAS LÄHETTI VALITUKSEN!"',
  '"MUN JUOMAVYÖ PAKENI!"',
  '"TÄMÄ EI MAHDU RAPORTTIIN!"',
  '"POLVI EI HYVÄKSY TÄTÄ!"',
  '"KYPÄRÄANALYTIIKKA PUNAISELLA!"',
  '"SILMÄLASIT HUURTUI PANIIKISTA!"',
  '"TÄMÄ EI OLLUT MEDITAATIOTA!"',
  '"KOKO VIIKKO PILALLA!"',
  '"TÄMÄN PITI OLLA KEVYT TREENI!"',
  '"MUN TASAPAINO LÄHTI ETÄTÖIHIN!"',
  '"JÄRKI JA SAUVAT EROSI!"',
  '"EI OLE REILUA, EI OLE!"',
  '"TÄMÄ MENI SUORAAN MUISTIIN!"',
  '"AAH! SIINÄ MENI FLOW!"'
];

const ALL_ENEMY_TAUNTS: string[] = [...ENEMY_TAUNTS, ...ENEMY_TAUNTS_EXTRA];
const ALL_TURKU_ENEMY_TAUNTS: string[] = [...TURKU_ENEMY_TAUNTS, ...TURKU_ENEMY_TAUNTS_EXTRA];
const ALL_ENEMY_ATTACK_TAUNTS: string[] = [...ENEMY_ATTACK_TAUNTS, ...ENEMY_ATTACK_TAUNTS_EXTRA];
const ALL_ENEMY_HURT_TAUNTS: string[] = [...ENEMY_HURT_TAUNTS, ...ENEMY_HURT_TAUNTS_EXTRA];

// ========== UNIFIED SPRITE SCALING RULE ==========
// All humanoid enemies should use these standard heights for visual consistency:
// STANDARD_ENEMY_HEIGHT: 120px - base height for normal enemies
// TALL_ENEMY_HEIGHT: 135px - for tall characters (pro skiers, power walkers)
// SHORT_ENEMY_HEIGHT: 100px - for shorter characters (e-scooter riders)
// CHILD_HEIGHT: 70px - for children in family groups
// VEHICLE_HEIGHT: 80px - for vehicles (Tesla, Golf cart)
export const ENEMY_SCALING = {
  STANDARD: 120,
  TALL: 135,
  SHORT: 100,
  CHILD: 70,
  VEHICLE: 80,
  SIZE_VARIATION: 0.1 // +/- 10% random variation
};

// Enemy skier class for LATURAIVO
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  
  // State machine
  fsm: EnemyFSM;

  // Character attributes
  facingDirection: Direction;
  speed: number;

  // State flags
  isDead: boolean;
  isAttacking: boolean;
  isHurting: boolean;
  canAttack: boolean;
  attackCooldown: number;

  // Attack target tracking
  currentMeleeTargets: Set<any>;

  // Health system
  maxHealth: number;
  health: number;
  damage: number;
  scoreValue: number;

  // Attack trigger
  meleeTrigger: Phaser.GameObjects.Zone;
  attackTriggerRange: number;
  attackTriggerWidth: number;

  // Sound effects
  attackSound?: Phaser.Sound.BaseSound;
  hitSound?: Phaser.Sound.BaseSound;
  
  // Ground Y position
  groundY: number;
  
  // Visual diversity - color tint for this instance
  colorTint: number;
  
  // Speech bubble system
  currentTauntText?: Phaser.GameObjects.Text;
  lastTauntTime: number = -99999;
  tauntCooldown: number = 2200; // Tuned up for denser enemy chatter.
  hasSaidSpawnTaunt: boolean = false;
  tauntDurationMultiplier: number = 1.5; // Taunts stay visible longer
  tauntExtraDurationMs: number = 1000; // Keep lines on screen +1s for readability
  private readonly tauntChanceMultiplier: number = 1.0;
  private spawnTauntTimer?: Phaser.Time.TimerEvent;
  private tauntTimers: Phaser.Time.TimerEvent[] = [];
  private readonly defaultAttackTriggerRange = 80;
  private readonly defaultAttackTriggerWidth = 60;

  constructor(scene: Phaser.Scene, x: number, y: number, groundY: number) {
    super(scene, x, y, "enemy_ski_idle_R_frame1");

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Store ground Y for collision
    this.groundY = groundY;
    
    // Get difficulty multiplier from scene (espoo=0.7, vantaa=1.0, lahti=1.4)
    const difficultyMultiplier = (scene as any).difficultyMultiplier || 1.0;

    // Initialize character attributes
    this.facingDirection = "left";
    this.speed = enemyConfig.speed.value;

    // Initialize state flags
    this.isDead = false;
    this.isAttacking = false;
    this.isHurting = false;
    this.canAttack = true;
    this.attackCooldown = enemyConfig.attackCooldown.value;

    // Initialize attack system
    this.currentMeleeTargets = new Set();

    // Keep the base regular enemy at a fixed 30 HP.
    this.maxHealth = enemyConfig.maxHealth.value;
    this.health = this.maxHealth;
    this.damage = Math.round(enemyConfig.damage.value * difficultyMultiplier);
    this.scoreValue = enemyConfig.scoreValue.value;

    // Use utility function to initialize sprite's size, scale, etc.
    // Use unified scaling rule with small random variation for visual diversity
    const sizeVariation = 1 - ENEMY_SCALING.SIZE_VARIATION + Math.random() * (ENEMY_SCALING.SIZE_VARIATION * 2);
    const standardHeight = ENEMY_SCALING.STANDARD * sizeVariation;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.4, 0.8);
    
    // Apply random color tint for visual diversity (jacket colors)
    this.colorTint = this.getRandomColorTint();
    this.setTint(this.colorTint);

    // Create attack trigger
    this.attackTriggerRange = this.defaultAttackTriggerRange;
    this.attackTriggerWidth = this.defaultAttackTriggerWidth;
    this.meleeTrigger = utils.createTrigger(
      this.scene,
      this,
      0,
      0,
      this.attackTriggerRange,
      this.attackTriggerWidth
    );
    
    // Add melee trigger to scene's enemyMeleeTriggers group
    const gameScene = scene as any;
    if (gameScene.enemyMeleeTriggers) {
      gameScene.enemyMeleeTriggers.add(this.meleeTrigger);
    }

    // Initialize sound effects
    this.initializeSounds();

    // Initialize state machine
    this.fsm = new EnemyFSM(scene, this);
    
    // Always attempt a spawn taunt; global budget in GameScene throttles total lines per level.
    const delay = Phaser.Math.Between(250, 700);
    this.spawnTauntTimer = this.scene.time.delayedCall(delay, () => {
      this.spawnTauntTimer = undefined;
      this.tryShowSpawnTaunt(0);
    });
  }

  // Play animation and reset origin and offset
  playAnimation(animKey: string) {
    this.play(animKey, true);
    utils.resetOriginAndOffset(this, this.facingDirection);
  }

  // Main update method - called every frame
  update(time: number, delta: number) {
    // Safety check - also check if scene exists (may be undefined during shutdown)
    if (!this.body || !this.active || this.isDead || !this.scene) {
      return;
    }
    
    // Ground clamping - keep enemy on ground
    if (this.y > this.groundY) {
      this.y = this.groundY;
      this.body.setVelocityY(0);
    }

    // Update attack trigger position
    utils.updateMeleeTrigger(
      this,
      this.meleeTrigger,
      this.facingDirection,
      this.attackTriggerRange,
      this.attackTriggerWidth
    );

    // Update state machine
    this.fsm.update(time, delta);

    // Update flip based on facing direction
    this.setFlipX(this.facingDirection === "left");
    
    // Update speech bubble position to follow enemy
    this.updateTauntPosition();
  }

  // Damage method
  takeDamage(damage: number) {
    if (this.isDead) return;

    this.health -= damage;
    
    if (this.health <= 0) {
      // Will trigger death in FSM
      this.fsm.goto("dying");
    } else {
      this.fsm.goto("hurting");
    }
  }

  // Get health percentage
  getHealthPercentage(): number {
    return (this.health / this.maxHealth) * 100;
  }
  
  // Get random color tint for visual diversity
  // Returns various winter jacket colors
  getRandomColorTint(): number {
    const winterColors = [
      0xffffff, // White (no tint - original)
      0xfff8f0, // Off-white
      0xe8e8ff, // Light blue tint
      0xffe8e8, // Light red/pink tint
      0xe8ffe8, // Light green tint
      0xfff0e0, // Light orange/peach tint
      0xf0f0ff, // Light purple tint
      0xffffe8, // Light yellow tint
      0xe0f0ff, // Sky blue tint
      0xffe0f0, // Pink tint
      0xd8e8ff, // Darker blue tint
      0xffd8d8, // Salmon tint
    ];
    return Phaser.Math.RND.pick(winterColors);
  }

  // Initialize sound effects
  initializeSounds(): void {
    this.attackSound = utils.safeAddSound(this.scene, "pole_strike", { volume: 0.2 });
    this.hitSound = utils.safeAddSound(this.scene, "enemy_hit", { volume: 0.3 });
  }

  setAttackTriggerProfile(range: number, width: number): void {
    this.attackTriggerRange = Phaser.Math.Clamp(Math.floor(range), 40, 180);
    this.attackTriggerWidth = Phaser.Math.Clamp(Math.floor(width), 36, 120);
  }

  resetAttackTriggerProfile(): void {
    this.attackTriggerRange = this.defaultAttackTriggerRange;
    this.attackTriggerWidth = this.defaultAttackTriggerWidth;
  }
  
  // Play hit sound with pitch variation for variety
  playHitSoundWithVariation(): void {
    utils.playSoundWithVariation(this.scene, "enemy_hit", 0.3, 0.15);
  }

  private getActiveScene(): Phaser.Scene | undefined {
    const scene = this.scene;
    if (!scene || !scene.sys || !scene.sys.isActive()) return undefined;
    return scene;
  }

  private addTrackedTimer(timer: Phaser.Time.TimerEvent): void {
    this.tauntTimers.push(timer);
  }

  private clearTrackedTimers(): void {
    for (const timer of this.tauntTimers) {
      if (timer && !timer.hasDispatched) {
        timer.destroy();
      }
    }
    this.tauntTimers = [];
  }

  private isEnemyTauntsEnabled(): boolean {
    const sceneWithRegistry = this.scene as (Phaser.Scene & { registry?: Phaser.Data.DataManager }) | undefined;
    const explicitSetting = sceneWithRegistry?.registry?.get?.("enemyTauntsEnabled");
    if (typeof explicitSetting === "boolean") return explicitSetting;
    return !!sceneWithRegistry;
  }

  private isTurkuLevel(): boolean {
    const gameScene = this.scene as any;
    return gameScene?.currentLevel === 7;
  }

  private tryReserveTauntSlot(now: number): boolean {
    if (now - this.lastTauntTime < this.tauntCooldown) return false;
    const gameScene = this.scene as any;
    if (typeof gameScene?.consumeEnemyTauntBudget === "function") {
      if (!gameScene.consumeEnemyTauntBudget(now)) return false;
    }
    this.lastTauntTime = now;
    return true;
  }

  private tryShowSpawnTaunt(attempt: number): void {
    if (!this.isEnemyTauntsEnabled()) return;
    const scene = this.getActiveScene();
    if (!scene) return;
    if (!this.active || this.isDead || this.hasSaidSpawnTaunt) return;

    const now = scene.time.now;
    if (this.tryReserveTauntSlot(now)) {
      this.hasSaidSpawnTaunt = true;
      this.showTaunt(this.getRandomTaunt(), 2500);
      return;
    }

    if (attempt >= 8) return;
    const retryDelay = Phaser.Math.Between(450, 900);
    const retryTimer = scene.time.delayedCall(retryDelay, () => this.tryShowSpawnTaunt(attempt + 1));
    this.addTrackedTimer(retryTimer);
  }

  // ========== SPEECH BUBBLE SYSTEM ==========
  
  // Get a random taunt quote
  getRandomTaunt(): string {
    if (this.isTurkuLevel() && Math.random() < 0.75) {
      return Phaser.Math.RND.pick(ALL_TURKU_ENEMY_TAUNTS);
    }
    const pool = ENEMY_DIALOG_EXTRA.length > 0
      ? [...ALL_ENEMY_TAUNTS, ...ENEMY_DIALOG_EXTRA]
      : ALL_ENEMY_TAUNTS;
    return Phaser.Math.RND.pick(pool);
  }
  
  // Get a random attack taunt
  getAttackTaunt(): string {
    return Phaser.Math.RND.pick(ALL_ENEMY_ATTACK_TAUNTS);
  }
  
  // Get a random hurt taunt
  getHurtTaunt(): string {
    return Phaser.Math.RND.pick(ALL_ENEMY_HURT_TAUNTS);
  }
  
  // Show a floating speech bubble above the enemy that wobbles
  showTaunt(text: string, duration: number = 2000): void {
    if (!this.isEnemyTauntsEnabled()) return;
    const scene = this.getActiveScene();
    if (!scene || this.isDead) return;
    const safeText = sanitizePlayerFacingText(text);
    if (!safeText) return;
    
    // Destroy existing taunt if any
    if (this.currentTauntText && this.currentTauntText.active) {
      this.currentTauntText.destroy();
    }
    
    // Create speech bubble text
    // Position above enemy's head (origin is 0.5, 1.0 so y is at feet)
    const enemyTopY = this.y - this.displayHeight;
    const tauntText = scene.add.text(
      this.x,
      enemyTopY - 25,
      safeText,
      {
        fontFamily: "PublicPixel",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 10, y: 6 },
        align: "center",
        wordWrap: { width: 180 },
        stroke: "#000000",
        strokeThickness: 2
      }
    );
    tauntText.setOrigin(0.5, 1);
    tauntText.setDepth(120);
    
    this.currentTauntText = tauntText;
    
    // Destroy after duration (with multiplier for longer visibility).
    // Skip fade/wobble tweens to keep enemy chatter cheap on mobile.
    const actualDuration = duration * this.tauntDurationMultiplier + this.tauntExtraDurationMs;
    const expireTimer = scene.time.delayedCall(actualDuration, () => {
      if (tauntText && tauntText.active) {
        tauntText.destroy();
        if (this.currentTauntText === tauntText) {
          this.currentTauntText = undefined;
        }
      }
    });
    this.addTrackedTimer(expireTimer);
  }
  
  // Update speech bubble position to follow enemy
  updateTauntPosition(): void {
    if (this.currentTauntText && this.currentTauntText.active) {
      // Update X to follow enemy
      this.currentTauntText.x = this.x;
      
      // Update Y relative to enemy position + wobble offset
      // Use body top position (since origin is 0.5, 1.0, we need to calculate top of sprite)
      const enemyTopY = this.y - this.displayHeight;
      this.currentTauntText.y = enemyTopY - 25;
    }
  }
  
  // Try to show attack taunt (called when enemy attacks)
  tryShowAttackTaunt(): void {
    if (!this.isEnemyTauntsEnabled()) return;
    const scene = this.getActiveScene();
    if (!scene) return;
    if (Math.random() >= 0.65 * this.tauntChanceMultiplier) return;
    const now = scene.time.now;
    if (!this.tryReserveTauntSlot(now)) return;
    this.showTaunt(this.getAttackTaunt(), 1800);
  }
  
  // Try to show hurt taunt (called when enemy takes damage)
  tryShowHurtTaunt(): void {
    if (!this.isEnemyTauntsEnabled()) return;
    const scene = this.getActiveScene();
    if (!scene) return;
    if (Math.random() >= 0.5 * this.tauntChanceMultiplier) return;
    const now = scene.time.now;
    if (!this.tryReserveTauntSlot(now)) return;
    this.showTaunt(this.getHurtTaunt(), 1500);
  }

  // Override destroy to clean up melee trigger and speech bubble
  destroy(fromScene?: boolean): void {
    this.fsm?.dispose();

    if (this.spawnTauntTimer) {
      this.spawnTauntTimer.destroy();
      this.spawnTauntTimer = undefined;
    }
    this.clearTrackedTimers();

    // Remove melee trigger from the group and destroy it
    // Check if scene still exists (may be undefined during scene shutdown)
    if (this.meleeTrigger && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene && gameScene.enemyMeleeTriggers) {
        gameScene.enemyMeleeTriggers.remove(this.meleeTrigger, true, true);
      }
      if (this.meleeTrigger.active) {
        this.meleeTrigger.destroy();
      }
    }
    
    // Destroy speech bubble if exists
    if (this.currentTauntText && this.currentTauntText.active) {
      this.currentTauntText.destroy();
    }
    
    super.destroy(fromScene);
  }
}
