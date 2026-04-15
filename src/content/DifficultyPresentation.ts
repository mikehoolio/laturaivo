export type DifficultyTier = "espoo" | "vantaa" | "lahti";

export const LAHTI_ENDING_MUSIC_KEY = "lahti_story_ending_theme";
export const DEFAULT_DIFFICULTY_TIER: DifficultyTier = "vantaa";

const LAHTI_LEVEL_MUSIC_KEYS: Readonly<Record<number, string>> = {
  2: "lahti_level_2_theme",
  3: "lahti_level_3_theme",
  4: "lahti_level_4_theme",
  5: "lahti_level_5_theme",
  6: "lahti_level_6_theme",
  7: "lahti_level_7_theme",
  8: "lahti_level_8_theme",
  9: "lahti_level_9_theme",
  10: "lahti_level_10_theme",
};

export function normalizeDifficultyTier(value: unknown): DifficultyTier {
  const normalized = String(value || DEFAULT_DIFFICULTY_TIER).trim().toLowerCase();
  if (normalized === "vantaa") return "vantaa";
  if (normalized === "lahti") return "lahti";
  return normalized === "espoo" ? "espoo" : DEFAULT_DIFFICULTY_TIER;
}

export function shouldDifficultyShowVideos(value: unknown): boolean {
  // Cinematics and interstitial videos must play on every difficulty tier.
  // Difficulty still affects gameplay tuning and Lahti-specific music, but not video visibility.
  void value;
  return true;
}

export function getDifficultyLevelMusicKey(level: number, difficulty: unknown, fallbackKey: string): string {
  if (normalizeDifficultyTier(difficulty) !== "lahti") {
    return fallbackKey;
  }

  return LAHTI_LEVEL_MUSIC_KEYS[level] || fallbackKey;
}
