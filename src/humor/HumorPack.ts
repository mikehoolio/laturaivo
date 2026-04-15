import Phaser from "phaser";

// Single master switch for easy rollback.
export const HUMOR_PACK_ENABLED = true;

export function isHumorEnabled(scene: Phaser.Scene): boolean {
  if (!HUMOR_PACK_ENABLED) return false;
  return scene.registry.get("humorPackEnabled") !== false;
}

export function pickHumorLine(
  scene: Phaser.Scene,
  lines: string[],
  fallback: string
): string {
  if (!isHumorEnabled(scene) || lines.length === 0) return fallback;
  return Phaser.Math.RND.pick(lines);
}

// Non-main-character flavor lines are disabled so scenes fall back to original text.
export const TITLE_START_LINES: string[] = [];
export const CONTINUE_LINES: string[] = [];
export const TITLE_TAGLINES: string[] = [];
export const PAUSE_HEADLINES: string[] = [];
export const PAUSE_PROMPTS: string[] = [];
export const GAME_OVER_LINES: string[] = [];

export const ABILITY_UNLOCK_LINES: Record<string, string[]> = {
  axe: [],
  rage: [],
  dashAxe: [],
};

export const COMMENTATOR_LINES: string[] = [];

export const COMBO_NAMES: string[] = [
  "KOMBO 1",
  "KOMBO 2",
  "KOMBO 3",
  "KOMBO 4",
  "KOMBO 5",
];

export const CRIT_LINES: string[] = [
  "Kriittinen osuma!",
  "Täysosuma!",
  "Napakka isku!",
];

export const DODGE_LINES: string[] = [
  "Väistö onnistui!",
  "Läheltä piti!",
  "Sivuaskel onnistui!",
];

export const ACHIEVEMENT_LINES: {
  no_swear: string;
  voltti_fail: string;
  instant_rage: string;
} = {
  no_swear: "SAAVUTUS: Selviydyit ilman kirosanaa.",
  voltti_fail: "SAAVUTUS: Voltti väärässä paikassa 10 kertaa.",
  instant_rage: "SAAVUTUS: Käytit Raivoa heti sen valmistuttua.",
};

export const LEADERBOARD_TITLES: string[] = [];
export const MANTRA_LINES: string[] = [];
export const EXCUSE_LINES: string[] = [];
export const INTERVIEW_QUESTIONS: string[] = [];

export const BOSS_WEAKNESS_LINE = "Heikkous: rakentava palaute";

export const ENEMY_DIALOG_EXTRA: string[] = [];

// Main character lines kept as requested.
export const PLAYER_SHOUTS: string[] = [
  "Tee tilaa ladulla!",
  "Varo, ohitan vasemmalta!",
  "Nyt tulee nopea pätkä!",
  "Linja pysyy, jatketaan!",
  "Raivo päälle, vauhti kasvaa!",
  "Tassa mennään ilman jarrua!",
  "Sauvat valmiina!",
  "Nyt mennään puhtaasti läpi!",
  "Nyt revitään tämä osuus auki!",
  "Pito kohdallaan, paina eteenpäin!",
  "Ei pysähdytä, nyt on vire päällä!",
  "Tämä latu kuuluu vauhdille!",
  "Rytmi lukittu, painetaan läpi!",
  "Tästä ei luisteta taaksepäin!",
  "Annan suksille täyden luvan!",
  "Kiri alkaa nyt!",
  "Pidä linja, minä hoidan loput!",
  "Tänään ei hölläillä!",
  "Vauhti kasvaa joka potkulla!",
  "Tämä on minun segmentti!"
];

export const HIT_REACTIONS: string[] = [
  "Osui kunnolla!",
  "Kova osuma!",
  "Sattui, mutta jatketaan!",
  "Nyt meni kuppi nurin!",
  "Otetaan rytmi takaisin!",
];

export const ENEMY_FALL_LINES: string[] = [];
export const BOSS_INTRO_LINES: string[] = [];
export const BOSS_TAUNT_EXTRA: string[] = [];

export const STATUS_LINES = {
  powerLow: [
    "Energia loppumassa.",
    "Varoitus: energia matala.",
  ],
  hpLow: [
    "Elämäpisteet matalat.",
    "Varoitus: terveys matala.",
  ],
  energyFull: [
    "Energia täynnä.",
  ],
  powerFull: [
    "Elämäpisteet palautettu.",
  ],
};
