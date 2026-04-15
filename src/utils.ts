import Phaser from 'phaser';
import { ENEMY_DIALOG_EXTRA, ENEMY_FALL_LINES } from './humor/HumorPack';
import { FLAVOR_TEXT_ENABLED, sanitizePlayerFacingText } from './content/PlayerTextPolicy';
import { getPlatformCapabilities, isIOSLike } from './platform';

interface TriggerOrigin {
  x: number;
  y: number;
}

interface ZoneWithOwner extends Phaser.GameObjects.Zone {
  owner?: any;  // Any type of object that can be the owner of the trigger
}

const warnedResetOriginIssues = new Set<string>();
const DEATH_QUOTE_EXTRA_DURATION_MS = 1000;
const MOBILE_ONLY_BUILD = false;
const ENEMY_DEATH_QUOTES_ENABLED = false;
export const GAME_MASTER_VOLUME_MULTIPLIER = 0.7;
const TUTORIAL_COMPLETED_STORAGE_KEY = "laturaivo_tutorial_completed_v1";
const EXTRA_LEVEL_SELECT_UNLOCKED_STORAGE_KEY = "laturaivo_extra_level_select_unlocked_v1";
const CAMPAIGN_SAVE_STORAGE_KEY = "laturaivo_campaign_save_v1";

export interface CampaignSaveData {
  highestUnlockedLevel: number;
  playerName?: string;
  characterType?: string;
  difficulty?: string;
  bossCheckpointLevel?: number;
  updatedAt: string;
}
const KNOWN_MUSIC_KEYS: readonly string[] = [
  "laturaivo_theme",
  "level_1_theme",
  "level_2_theme",
  "level_2_boss_theme",
  "level_3_theme",
  "level_4_theme",
  "lahti_level_4_boss_theme",
  "level_5_theme",
  "lahti_level_5_boss_theme",
  "level_6_theme",
  "level_7_theme",
  "level_8_theme",
  "level_9_theme",
  "level_10_theme",
  "level_11_theme",
  "lahti_level_2_theme",
  "lahti_level_3_theme",
  "lahti_level_4_theme",
  "lahti_level_5_theme",
  "lahti_level_6_theme",
  "lahti_level_7_theme",
  "lahti_level_8_theme",
  "lahti_level_9_theme",
  "lahti_level_10_theme",
  "lahti_story_ending_theme",
  "ice_club_arena_theme",
  "elsa_mixdown_1",
  "level_1_2_theme",
  "level_3_4_theme",
  "level_5_6_theme",
  "level_7_8_theme",
  "level_9_10_theme",
  "miniboss_theme",
  "final_boss_theme"
];

export const isMobileOnlyBuild = (): boolean => MOBILE_ONLY_BUILD;

export const applyGameVolume = (volume: unknown, fallback: number = 1): number => {
  const rawVolume = Number(volume);
  const normalizedVolume = Number.isFinite(rawVolume) ? rawVolume : fallback;
  return Phaser.Math.Clamp(normalizedVolume * GAME_MASTER_VOLUME_MULTIPLIER, 0, 1);
};

export const applyGameMasterVolumeToSoundManager = (soundManager: unknown): void => {
  const manager = soundManager as { volume?: number } | undefined;
  if (!manager || typeof manager.volume !== "number") return;
  manager.volume = GAME_MASTER_VOLUME_MULTIPLIER;
};

export const hasCompletedTutorial = (): boolean => {
  try {
    return window.localStorage?.getItem(TUTORIAL_COMPLETED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const markTutorialCompleted = (): void => {
  try {
    window.localStorage?.setItem(TUTORIAL_COMPLETED_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures and continue normally.
  }
};

export const hasUnlockedExtraLevelSelect = (): boolean => {
  try {
    return window.localStorage?.getItem(EXTRA_LEVEL_SELECT_UNLOCKED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const unlockExtraLevelSelect = (): void => {
  try {
    window.localStorage?.setItem(EXTRA_LEVEL_SELECT_UNLOCKED_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures and continue normally.
  }
};

const clampCampaignLevel = (level: unknown): number => {
  const parsed = Math.floor(Number(level));
  if (!Number.isFinite(parsed)) return 1;
  return Phaser.Math.Clamp(parsed, 1, 10);
};

export const getCampaignSave = (): CampaignSaveData | null => {
  try {
    const raw = window.localStorage?.getItem(CAMPAIGN_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignSaveData>;
    const highestUnlockedLevel = clampCampaignLevel(parsed.highestUnlockedLevel);
    if (highestUnlockedLevel <= 1) return null;
    return {
      highestUnlockedLevel,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName : undefined,
      characterType: typeof parsed.characterType === "string" ? parsed.characterType : undefined,
      difficulty: typeof parsed.difficulty === "string" ? parsed.difficulty : undefined,
      bossCheckpointLevel: parsed.bossCheckpointLevel !== undefined
        ? clampCampaignLevel(parsed.bossCheckpointLevel)
        : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
};

export const saveCampaignProgress = (data: {
  unlockedLevel: number;
  playerName?: string;
  characterType?: string;
  difficulty?: string;
}): void => {
  try {
    const existing = getCampaignSave();
    const nextUnlockedLevel = clampCampaignLevel(data.unlockedLevel);
    const highestUnlockedLevel = Math.max(existing?.highestUnlockedLevel || 1, nextUnlockedLevel);
    if (highestUnlockedLevel <= 1) return;

    const saveData: CampaignSaveData = {
      highestUnlockedLevel,
      playerName: data.playerName || existing?.playerName,
      characterType: data.characterType || existing?.characterType || "male",
      difficulty: data.difficulty || existing?.difficulty || "vantaa",
      bossCheckpointLevel: existing?.bossCheckpointLevel !== undefined && existing.bossCheckpointLevel >= highestUnlockedLevel
        ? existing.bossCheckpointLevel
        : undefined,
      updatedAt: new Date().toISOString()
    };
    window.localStorage?.setItem(CAMPAIGN_SAVE_STORAGE_KEY, JSON.stringify(saveData));
  } catch {
    // Ignore storage failures and keep the game playable.
  }
};

export const saveBossCheckpoint = (data: {
  level: number;
  playerName?: string;
  characterType?: string;
  difficulty?: string;
}): void => {
  try {
    const checkpointLevel = clampCampaignLevel(data.level);
    if (checkpointLevel <= 1) return;

    const existing = getCampaignSave();
    const saveData: CampaignSaveData = {
      highestUnlockedLevel: Math.max(existing?.highestUnlockedLevel || checkpointLevel, checkpointLevel),
      playerName: data.playerName || existing?.playerName,
      characterType: data.characterType || existing?.characterType || "male",
      difficulty: data.difficulty || existing?.difficulty || "vantaa",
      bossCheckpointLevel: checkpointLevel,
      updatedAt: new Date().toISOString()
    };
    window.localStorage?.setItem(CAMPAIGN_SAVE_STORAGE_KEY, JSON.stringify(saveData));
  } catch {
    // Ignore storage failures and keep the game playable.
  }
};

export const clearBossCheckpoint = (level?: number): void => {
  try {
    const existing = getCampaignSave();
    if (!existing?.bossCheckpointLevel) return;
    if (level !== undefined && existing.bossCheckpointLevel !== clampCampaignLevel(level)) return;

    const saveData: CampaignSaveData = {
      ...existing,
      bossCheckpointLevel: undefined,
      updatedAt: new Date().toISOString()
    };
    window.localStorage?.setItem(CAMPAIGN_SAVE_STORAGE_KEY, JSON.stringify(saveData));
  } catch {
    // Ignore storage failures and keep the game playable.
  }
};

export const getBossCheckpointLevel = (): number | null => {
  const checkpointLevel = getCampaignSave()?.bossCheckpointLevel;
  if (!checkpointLevel || checkpointLevel <= 1) return null;
  return clampCampaignLevel(checkpointLevel);
};

export const clearCampaignSave = (): void => {
  try {
    window.localStorage?.removeItem(CAMPAIGN_SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the game playable.
  }
};

export const stopKnownMusicByKey = (scene: Phaser.Scene): void => {
  if (!scene || !(scene as any).sound) return;
  for (const key of KNOWN_MUSIC_KEYS) {
    scene.sound.stopByKey(key);
  }
};

export const stopGameplayMusic = (scene: Phaser.Scene, gameplayScene?: any): void => {
  stopKnownMusicByKey(scene);

  const runtimeScene = gameplayScene as any;
  if (!runtimeScene) return;

  if (typeof runtimeScene.stopAllMusicPlayback === "function") {
    runtimeScene.stopAllMusicPlayback({ destroyBackgroundMusic: true });
    return;
  }

  try {
    runtimeScene.backgroundMusic?.stop?.();
  } catch {
    // Ignore one-off stop failures during transitions.
  }

  try {
    runtimeScene.stopNativeBackgroundMusicFallback?.();
  } catch {
    // Ignore one-off native fallback stop failures during transitions.
  }
};

/**
 * Create collision trigger - useful for attack area detection, etc.
 * @param owner - The owner of the trigger (usually the character)
 */
export const createTrigger = (
    scene: Phaser.Scene,
    owner: any,
    x: number,
    y: number,
    width: number,
    height: number,
    origin: TriggerOrigin = { x: 0.5, y: 0.5 }
): ZoneWithOwner => {
    const zoneWithOwner = scene.add.zone(x, y, width, height).setOrigin(origin.x, origin.y) as ZoneWithOwner;
    zoneWithOwner.owner = owner;
    scene.physics.add.existing(zoneWithOwner);
    const body = zoneWithOwner.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false); // Not affected by gravity
    body.setImmovable(true);
    // Trigger zones should never render in Arcade debug overlay.
    body.debugShowBody = false;
    body.debugShowVelocity = false;
    return zoneWithOwner;
};

/**
 * Initialize UI DOM element for UI scenes
 * IMPORTANT: Always use this instead of add.dom and createFromHTML
 */
export const initUIDom = (scene: Phaser.Scene, html: string): Phaser.GameObjects.DOMElement => {
  const sceneKey = scene.scene?.key || "UnknownScene";

  // Remove stale DOM wrappers from previous runs of the same scene.
  if (typeof document !== "undefined") {
    const staleNodes = document.querySelectorAll<HTMLElement>(
      `[data-laturaivo-ui-scene="${sceneKey}"]`
    );
    staleNodes.forEach((node) => node.remove());
  }

  const gameWidth = scene.scale.width;
  const gameHeight = scene.scale.height;
  
  // Create DOM at center of game canvas with explicit pixel dimensions
  const dom = scene.add.dom(gameWidth / 2, gameHeight / 2, 'div', 
    `width: ${gameWidth}px; height: ${gameHeight}px; position: relative;`
  ).setHTML(html);
  // Use 'auto' to allow button clicks inside DOM element
  dom.pointerEvents = 'auto';
  dom.setOrigin(0.5, 0.5);
  dom.setScrollFactor(0);

  const domNode = (dom as any).node as HTMLElement | undefined;
  if (domNode) {
    domNode.setAttribute("data-laturaivo-ui-scene", sceneKey);
    domNode.setAttribute("data-laturaivo-ui-root", "1");
  }

  const syncDomSize = () => {
    const width = scene.scale.width;
    const height = scene.scale.height;
    dom.setPosition(width / 2, height / 2);

    const node = (dom as any).node as HTMLElement | undefined;
    if (node) {
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
  };

  syncDomSize();
  scene.scale.on(Phaser.Scale.Events.RESIZE, syncDomSize);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    scene.scale.off(Phaser.Scale.Events.RESIZE, syncDomSize);

    try {
      if ((dom as any).scene) {
        dom.destroy();
      }
    } catch {
      // Ignore destroy errors if Phaser already tore down this object.
    }

    try {
      const node = (dom as any).node as HTMLElement | undefined;
      if (node && node.isConnected) {
        node.remove();
      }
    } catch {
      // Ignore DOM cleanup errors.
    }
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  return dom;
}

/**
 * Create a decoration and add it to a group
 * Used to create and set decoration size and position, each decoration type needs different height settings
 * but different variants of the same decoration type should have the same height
 * The height of each decoration is determined by its relative height to a person in reality, where each person is 128px tall
 */
export const createDecoration = (
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Group,
  key: string,
  x: number,
  y: number,
  maxDisplayHeight: number
): Phaser.GameObjects.Image => {
  const decoration = scene.add.image(x, y, key);
  initScale(decoration, { x: 0.5, y: 1.0 }, undefined, maxDisplayHeight);
  group.add(decoration);
  return decoration;
}

/**
 * Update melee attack trigger position and size based on character facing direction
 * Supports 4 directions: left, right, up, down
 * @param attackRange - Attack forward distance (how far the attack reaches)
 * @param attackWidth - Attack coverage width (perpendicular to attack direction)
 */
export const updateMeleeTrigger = (
  character: any,
  meleeTrigger: ZoneWithOwner,
  facingDirection: "left" | "right" | "up" | "down",
  attackRange: number,
  attackWidth: number
): void => {

  // Stability guard: avoid runtime crashes from malformed direction values.
  if (facingDirection !== "up" && facingDirection !== "down" && facingDirection !== "left" && facingDirection !== "right") {
    console.debug(`updateMeleeTrigger: invalid facingDirection "${String(facingDirection)}", falling back to "right"`);
    facingDirection = "right";
  }

  const characterBody = character.body as Phaser.Physics.Arcade.Body;
  const triggerBody = meleeTrigger.body as Phaser.Physics.Arcade.Body;

  let triggerX = 0;
  let triggerY = 0;

  const characterCenterX = characterBody.center.x;
  const characterCenterY = characterBody.center.y;

  switch (facingDirection) {
    case "right":
      triggerX = characterCenterX + attackRange / 2; // Offset to the right of character center
      triggerY = characterCenterY;
      triggerBody.setSize(attackRange, attackWidth);
      break;
    case "left":
      triggerX = characterCenterX - attackRange / 2; // Offset to the left of character center
      triggerY = characterCenterY;
      triggerBody.setSize(attackRange, attackWidth);
      break;
    case "up":
      triggerX = characterCenterX;
      triggerY = characterCenterY - attackRange / 2; // Offset above character center
      triggerBody.setSize(attackWidth, attackRange);
      break;
    case "down":
      triggerX = characterCenterX;
      triggerY = characterCenterY + attackRange / 2; // Offset below character center
      triggerBody.setSize(attackWidth, attackRange);
      break;
  }

  meleeTrigger.setPosition(triggerX, triggerY);
}

/**
 * Reset origin and offset for sprite after playing animation
 * IMPORTANT: Must be called every time after playing any animation
 * Requires all animation info in animations.json
 */
export const resetOriginAndOffset = (
  sprite: any, 
  facingDirection: "left" | "right" | "up" | "down"
): void => {

  // Stability guard: avoid runtime crashes from malformed direction values.
  if (facingDirection !== "up" && facingDirection !== "down" && facingDirection !== "left" && facingDirection !== "right") {
    console.debug(`resetOriginAndOffset: invalid facingDirection "${String(facingDirection)}", falling back to "right"`);
    facingDirection = "right";
  }

  const animationsData = sprite?.scene?.cache?.json?.get("animations");
  const animationList = Array.isArray(animationsData?.anims) ? animationsData.anims : null;
  if (!animationList && !warnedResetOriginIssues.has("missing-animations-json")) {
    warnedResetOriginIssues.add("missing-animations-json");
    console.debug("resetOriginAndOffset: animations metadata missing, using default origin/offset values");
  }

  // Return corresponding origin data based on different animations
  // Get origin data from loaded animations data
  let baseOriginX = 0.5;
  let baseOriginY = 1.0;
  const currentAnim = sprite.anims.currentAnim;
  if (currentAnim && animationList) {
    // Find animation config by key from loaded JSON
    const animConfig = animationList.find((anim: any) => anim.key === currentAnim.key);
    if (animConfig) {
      baseOriginX = animConfig.originX || 0.5;
      baseOriginY = animConfig.originY || 1.0;
    } else if (!warnedResetOriginIssues.has(currentAnim.key)) {
      warnedResetOriginIssues.add(currentAnim.key);
      console.debug(`resetOriginAndOffset: animation config not found for key: ${currentAnim.key}, using defaults`);
    }
  }

  let animOriginX = facingDirection === "left" ? (1 - baseOriginX) : baseOriginX;
  let animOriginY = baseOriginY;
  
  // Set origin
  sprite.setOrigin(animOriginX, animOriginY);
  
  // Calculate offset to align collision box's bottomCenter with animation frame's origin
  const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
  if (!body || typeof body.setOffset !== "function") return;

  const unscaledBodyWidth = typeof body.sourceWidth === "number" ? body.sourceWidth : body.width;
  const unscaledBodyHeight = typeof body.sourceHeight === "number" ? body.sourceHeight : body.height;
  if (!Number.isFinite(unscaledBodyWidth) || !Number.isFinite(unscaledBodyHeight)) return;

  body.setOffset(
    sprite.width * animOriginX - unscaledBodyWidth / 2, 
    sprite.height * animOriginY - unscaledBodyHeight
  );
}

/**
 * Initialize sprite scale, size, and offset
 * IMPORTANT: All image assets must use initScale for scaling, DO NOT use setScale or setDisplaySize directly
 */
export const initScale = (
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, 
    origin: { x: number; y: number }, 
    maxDisplayWidth?: number,
    maxDisplayHeight?: number, 
    bodyWidthFactorToDisplayWidth?: number,
    bodyHeightFactorToDisplayHeight?: number
): void => {
  sprite.setOrigin(origin.x, origin.y)

  let displayScale
  let displayHeight
  let displayWidth
  if (maxDisplayHeight && maxDisplayWidth) {
    if (sprite.height / sprite.width > maxDisplayHeight / maxDisplayWidth) {
      displayHeight = maxDisplayHeight
      displayScale = maxDisplayHeight / sprite.height
      displayWidth = sprite.width * displayScale
    } else {
      displayWidth = maxDisplayWidth
      displayScale = maxDisplayWidth / sprite.width
      displayHeight = sprite.height * displayScale
    }
  } else if (maxDisplayHeight) {
    displayHeight = maxDisplayHeight
    displayScale = maxDisplayHeight / sprite.height
    displayWidth = sprite.width * displayScale
  } else if (maxDisplayWidth) {
    displayWidth = maxDisplayWidth
    displayScale = maxDisplayWidth / sprite.width
    displayHeight = sprite.height * displayScale
  } else {
    throw new Error("initScale input parameter maxDisplayHeight and maxDisplayWidth cannot be undefined at the same time");
  }

  sprite.setScale(displayScale)

  // Provide default values for body factor parameters to avoid NaN
  const widthFactor = bodyWidthFactorToDisplayWidth ?? 1.0;
  const heightFactor = bodyHeightFactorToDisplayHeight ?? 1.0;
  
  const displayBodyWidth = displayWidth * widthFactor
  const displayBodyHeight = displayHeight * heightFactor
  
  if (sprite.body instanceof Phaser.Physics.Arcade.Body) {
      // Body.setSize requires the unscaled body size as input, because the size of the Dynamic Body will scale with sprite.setScale
      const unscaledBodyWidth = displayBodyWidth / displayScale
      const unscaledBodyHeight = displayBodyHeight / displayScale 
      sprite.body.setSize(unscaledBodyWidth, unscaledBodyHeight)

      // Body.setOffset requires the unscaled offset as input, because the offset of the Dynamic Body will scale with sprite.setScale
      const unscaledOffsetX = sprite.width * origin.x - unscaledBodyWidth * origin.x
      const unscaledOffsetY = sprite.height * origin.y - unscaledBodyHeight * origin.y
      sprite.body.setOffset(unscaledOffsetX, unscaledOffsetY)
  } else if (sprite.body instanceof Phaser.Physics.Arcade.StaticBody) {
      // StaticBody.setSize requires the scaled body size(displayBodyWidth, displayBodyHeight) as input, because the size of StaticBody will not scale with sprite.setScale
      sprite.body.setSize(displayBodyWidth, displayBodyHeight)

      // **Don't use StaticBody.setOffset**: this function has a serious bug.
      // Use StaticBody.position.set instead
      const displayTopLeft = sprite.getTopLeft();
      const bodyPositionX = displayTopLeft.x + (sprite.displayWidth * origin.x - displayBodyWidth * origin.x);
      const bodyPositionY = displayTopLeft.y + (sprite.displayHeight * origin.y - displayBodyHeight * origin.y);
      sprite.body.position.set(bodyPositionX, bodyPositionY);
  }
}

/**
 * Add collider/overlap with guaranteed parameter order
 * IMPORTANT: Use these instead of scene.physics.add.collider/overlap to avoid internal bugs
 * These functions ensure that the callback always receives parameters in the order (object1, object2)
 */
export const addCollider = (
  scene: Phaser.Scene,
  object1: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  object2: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  collideCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  callbackContext?: any
): Phaser.Physics.Arcade.Collider => {
  if (shouldSwap(object1, object2)) {
    return scene.physics.add.collider(object1, object2, (obj1: any, obj2: any) => {
      collideCallback?.call(callbackContext, obj2, obj1)
    }, (obj1: any, obj2: any) => {
      processCallback?.call(callbackContext, obj2, obj1)
    }, callbackContext);
  } else {
    return scene.physics.add.collider(object1, object2, collideCallback, processCallback, callbackContext);
  }
};
export const addOverlap = (
  scene: Phaser.Scene,
  object1: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  object2: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  collideCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  callbackContext?: any
): Phaser.Physics.Arcade.Collider => {
  if (shouldSwap(object1, object2)) {
    return scene.physics.add.overlap(object1, object2, (obj1: any, obj2: any) => {
      collideCallback?.call(callbackContext, obj2, obj1)
    }, (obj1: any, obj2: any) => {
      processCallback?.call(callbackContext, obj2, obj1)
    }, callbackContext);
  } else {
    return scene.physics.add.overlap(object1, object2, collideCallback, processCallback, callbackContext);
  }
};

const shouldSwap = (object1: any, object2: any) => {
  const object1IsPhysicsGroup = object1 && (object1 as any).isParent && !((object1 as any).physicsType === undefined);
  const object1IsTilemap = object1 && (object1 as any).isTilemap;
  const object2IsPhysicsGroup = object2 && (object2 as any).isParent && !((object2 as any).physicsType === undefined);
  const object2IsTilemap = object2 && (object2 as any).isTilemap;

  // In the following cases, Phaser internally calls collideCallback.call(callbackContext, object2, object1), causing parameter order reversal
  return (
      (object1IsPhysicsGroup && !object2IsPhysicsGroup && !object2IsTilemap) ||
      (object1IsTilemap && !object2IsPhysicsGroup && !object2IsTilemap) ||
      (object1IsTilemap && object2IsPhysicsGroup)
  );
}

/**
 * Must use the following method to correctly calculate sprite rotation in radians (e.g., bullets, arrows, etc.)
 * Calculate rotation radians based on asset's current direction and target direction, with coordinate origin at top-left of canvas
 * If currently facing right, direction vector is (1, 0); if currently facing up, direction vector is (0, -1)
 */
export function computeRotation(assetDirection: Phaser.Math.Vector2, targetDirection: Phaser.Math.Vector2) {
  const assetAngle = Math.atan2(assetDirection.y, assetDirection.x);
  const targetAngle = Math.atan2(targetDirection.y, targetDirection.x); 
  return targetAngle - assetAngle;
}

type SceneCombatSfxManager = {
  playLegacyKey?: (
    key: string,
    options?: {
      baseVolume?: number;
      volume?: number;
      rate?: number;
      detune?: number;
      pitchVariation?: number;
      detuneVariation?: number;
      bypassCooldown?: boolean;
    }
  ) => boolean;
};

// Temporary runtime profile to keep mobile performance stable:
// allow only critical SFX (rage, requested gameplay cues, selected player voice lines, super-hit cues).
const DEFAULT_MINIMAL_SFX_MODE = true;
const MINIMAL_SFX_ALLOWLIST = new Set<string>([
  "rage_activate",
  "rage_scream_1",
  "rage_scream_2",
  "rage_scream_3",
  "rage_scream_4",
  "rage_scream_5",
  "rage_scream_6",
  "rage_scream_7",
  "rage_scream_8",
  "rage_scream_9",
  "rage_scream_legacy_1",
  "rage_scream_legacy_2",
  "rage_scream_legacy_3",
  "rage_scream_legacy_4",
  "rage_scream_legacy_5",
  "rage_scream_legacy_6",
  "rage_scream_legacy_7",
  "rage_scream_legacy_8",
  "rage_scream_legacy_9",
  "player_hurt",
  "player_jump",
  "player_land",
  "fart_death",
  "life_lost",
  "speed_boost",
  "tesla_horn",
  "dog_bark",
  "combo_hit",
  "axe_explosion",
]);

// Requested tuning: remove impact-heavy hit cues globally.
const DISABLED_IMPACT_SFX_KEYS = new Set<string>([
  "axe_explosion",
  "combo_hit",
  "punch_hit",
  "combat_combo_01",
  "combat_combo_02",
  "combat_enemy_hit_01",
  "combat_enemy_hit_02",
]);

export function isMinimalSfxMode(): boolean {
  try {
    const forcedProfile = window.localStorage?.getItem?.("laturaivo_sfx_profile");
    if (forcedProfile === "full") return false;
    if (forcedProfile === "minimal") return true;
  } catch {
    // Ignore storage access failures and use default profile.
  }
  return DEFAULT_MINIMAL_SFX_MODE;
}

export function isSfxAllowed(soundKey: string): boolean {
  if (!soundKey) return false;
  if (DISABLED_IMPACT_SFX_KEYS.has(soundKey)) return false;
  if (!isMinimalSfxMode()) return true;
  return MINIMAL_SFX_ALLOWLIST.has(soundKey);
}

function getSceneCombatSfxManager(scene: Phaser.Scene): SceneCombatSfxManager | undefined {
  try {
    return scene?.data?.get?.("combatSfxManager") as SceneCombatSfxManager | undefined;
  } catch {
    return undefined;
  }
}

export interface ManagedSoundConfig {
  volume?: number;
  rate?: number;
  detune?: number;
  pitchVariation?: number;
  detuneVariation?: number;
  bypassCooldown?: boolean;
}

export function playManagedSound(
  scene: Phaser.Scene,
  key: string,
  config: ManagedSoundConfig = {}
): boolean {
  if (!isSfxAllowed(key)) return false;

  // On iOS we prefer direct scene.sound.play so all one-shot SFX can use
  // the runtime native bridge in main.ts.
  const shouldUseLegacyCombatManager = !isIOS();

  if (shouldUseLegacyCombatManager) {
    const manager = getSceneCombatSfxManager(scene);
    const playedViaManager = manager?.playLegacyKey?.(key, {
      baseVolume: config.volume ?? 1,
      volume: config.volume,
      rate: config.rate,
      detune: config.detune,
      pitchVariation: config.pitchVariation,
      detuneVariation: config.detuneVariation,
      bypassCooldown: config.bypassCooldown,
    });
    if (playedViaManager) {
      return true;
    }
  }

  try {
    return !!scene.sound.play(key, {
      volume: config.volume,
      rate: config.rate,
      detune: config.detune,
    });
  } catch {
    return false;
  }
}

/**
 * Play a sound effect with random variations in pitch and detune
 * This creates more natural and less repetitive audio
 * @param scene - The current Phaser scene
 * @param key - The sound effect key
 * @param baseVolume - Base volume (0-1)
 * @param pitchVariation - How much to vary the pitch (0-0.3 recommended)
 * @param detuneVariation - How much to vary the detune in cents (-100 to 100 recommended)
 */
export function playSoundWithVariation(
  scene: Phaser.Scene,
  key: string,
  baseVolume: number = 0.3,
  pitchVariation: number = 0.15,
  detuneVariation: number = 50
): void {
  if (!isSfxAllowed(key)) return;

  if (!isIOS()) {
    const manager = getSceneCombatSfxManager(scene);
    if (manager?.playLegacyKey?.(key, { baseVolume, pitchVariation, detuneVariation })) {
      return;
    }
  }

  // Random pitch variation (rate)
  const rate = 1 + (Math.random() - 0.5) * 2 * pitchVariation;
  
  // Random detune variation (in cents)
  const detune = (Math.random() - 0.5) * 2 * detuneVariation;
  
  // Slight volume variation for more natural sound
  const volume = baseVolume * (0.9 + Math.random() * 0.2);
  
  scene.sound.play(key, {
    volume: volume,
    rate: rate,
    detune: detune
  });
}

/**
 * Play one of multiple sound variants randomly
 * Use this when you have multiple versions of the same sound (e.g., hit_1, hit_2, hit_3)
 * @param scene - The current Phaser scene
 * @param baseKey - Base key of the sound (without number suffix)
 * @param variantCount - Number of variants available
 * @param volume - Volume level
 */
export function playRandomSoundVariant(
  scene: Phaser.Scene,
  baseKey: string,
  variantCount: number,
  volume: number = 0.3
): void {
  if (!isSfxAllowed(baseKey)) return;

  const variant = Math.floor(Math.random() * variantCount) + 1;
  const key = `${baseKey}_${variant}`;
  
  // Check if this specific variant exists, otherwise play without variant suffix
  try {
    scene.sound.play(key, { volume });
  } catch (e) {
    // Fallback to base key if variant doesn't exist
    scene.sound.play(baseKey, { volume });
  }
}

// ========== DEATH QUOTES (COMEBACK QUOTES) SYSTEM ==========
// Funny Finnish comeback quotes shown when enemies die

// Death quotes by enemy type - each enemy has their own personality
export const DEATH_QUOTES: { [key: string]: string[] } = {
  // Generic enemy (ski trail douchebag)
  enemy: [
    '"1200€ SUKSET JA NÄIN KÄVI?!"',
    '"LAKIMIES SOITTAA PERÄÄN!"',
    '"TUNNEN ESPOON KAUPUNGINJOHTAJAN!"',
    '"ALOITIN JUST PADELIN!"',
    '"TESLA JÄÄTYY PARKKIKSELLE!"',
    '"AINO-SOFIA EI SAA TIETÄÄ!"',
    '"PT VAROITTI TÄSTÄ!"',
    '"VEROVÄHENNYS MENETETTY!"',
    '"NAAPURIT KUULEE!"',
    '"WESTEND MENETTI PIIRIMESTARUUDEN!"',
    '"AIRPODSIT LENTÄÄ!"',
    '"VERONMAKSAJA KAATUU!"',
    '"COACH EI PUHUNUT TÄSTÄ!"',
    '"MITEN LINKEDIN-POSTAUKSENI?!"',
    '"PADEL-VARAUS MENEE HUKKAAN!"',
    '"KAIKKI SAUNAVUOROT TURHA!"',
    '"KESÄMÖKKISUUNNITELMAT ROMUTTUU!"',
    '"GOLF-JÄSENYYS PÄÄTTYY NÄIN?!"',
    ...ENEMY_DIALOG_EXTRA,
    ...ENEMY_FALL_LINES.map((line) => `"${line}"`),
  ],
  
  // CryptoBro - Obnoxious crypto investor
  crypto_bro: [
    '"HODL... IKUISESTI..."',
    '"EI MULLA OLLU PRIVATE KEYT!"',
    '"BITCOIN KORJAA... EI KORJAA..."',
    '"NFT:T HÄVIÄÄ MUKANA!"',
    '"TÄMÄ ON VAIN... DIP... permanentti dip..."',
    '"WAGMI... EIKU..."',
    '"LEDGER VARASTETAAN!"',
    '"TIMANTTIKÄDET MURSKAKSI!"',
    '"ELON! TWIITTAA JOTAIN!"',
    '"LAMBO... EHKÄ ENSI ELÄMÄSSÄ..."',
    '"KUKA MYI?! KEN MYI?!"',
    '"TO THE MOON... YKSIN..."',
  ],
  
  // WineMom - Tipsy suburban mom
  wine_mom: [
    '"VIINILASI KAATUU LUMEEN!"',
    '"BOOK CLUB EI USKO TÄTÄ!"',
    '"ROSÉ ALL DAY... LOPPUU..."',
    '"PROSECCO-BRUNCHI PERUUNTUU!"',
    '"GIRLS NIGHT KESKEYTYY!"',
    '"YOGA-RETREATTI OLI TURHA!"',
    '"MINDFULNESS EI AUTA NYT!"',
    '"WELLNESS-MATKA J\u00c4I KESKEN!"',
    '"LAPSET NÄKEE TÄMÄN!"',
    '"STORY JÄÄÄ POSTAAMATTA!"',
    '"ÄITIRYHMÄ KESKUSTELEE!"',
    '"DRINKKINI LÄIKKYY!"',
  ],
  
  // BluetoothBomber - Loud speakerphone caller
  bluetooth_bomber: [
    '"SOITAN TAKASIN! ...tai en..."',
    '"AIRPODS MAX LENTÄÄ!"',
    '"OOTAS, PUHELU... katkee..."',
    '"FACETIME NÄYTTÄÄ KAIKEN!"',
    '"BLUETOOTH YHTEYS KATKEAA!"',
    '"VIDEOPUHELU SAA PÄÄTÖKSEN!"',
    '"KOKOUS PÄÄTTYY NÄIN!"',
    '"TEAMS-MEETING STRIIMAA TÄTÄ!"',
    '"ÄITI NÄKEE ZOOMISSA!"',
    '"SOITTOÄÄNI VAIKENEE!"',
    '"KALENTERIIN: KUOLEMA 15:30"',
    '"OUTLOOK REMINDER TURHA!"',
  ],
  
  // HeadphoneWalker - Oblivious person with headphones
  headphone_walker: [
    '"SPOTIFY-LISTA KESKETYY!"',
    '"PODCAST JÄÄÄ KUULEMATTA!"',
    '"NOISE CANCELLING TOIMI LIIANKIN HYVIN!"',
    '"EN KUULLUT MITÄÄN! KIRJAIMELLISESTI!"',
    '"BEATS PUTOS!"',
    '"ÄÄNIKIRJA OLI JUURI JÄNNÄSSÄ KOHDASSA!"',
    '"TRUE WIRELESS, TRUE KUOLEMA!"',
    '"MIKÄ SE BIISI OLIKAAN..."',
    '"PREMIUM TURHA!"',
    '"SHUFFLE SHUFFLASI ELÄMÄNI!"',
    '"BASSO TIPPU!"',
    '"KUUNTELIN MEDITAATIOTA!"',
  ],
  
  // PadelPlayer - Sporty padel player
  padel_player: [
    '"PADEL ON PAREMPI KUIN... kaikki..."',
    '"MAILA TIPPUU!"',
    '"VARAUS MENI HUKKAAN!"',
    '"ELO-RANKING LASKEE!"',
    '"MATCH POINT SINULLE, PELI MULLE!"',
    '"60€ KENTTÄAIKA MENI HARAKOILLE!"',
    '"ESPANJAN PADEL-LOMA PERUUNTUU!"',
    '"RANNE ANTOI PERIKSI!"',
    '"COACH EI VAROITTANUT!"',
    '"LASI HAJOSI... SIIS KENTÄN LASI!"',
    '"PAREJA EI LÖYDY ENÄÄ!"',
  ],
  
  // PowerWalker - Fast walking person with poles
  power_walker: [
    '"SYKEMITTARI PYSÄHTYY!"',
    '"INTERVALLIT KESKEYTYI PAHASTI!"',
    '"SAUVAT LENTÄÄ!"',
    '"STRAVA EI SAANUT TÄTÄ TALTEEN!"',
    '"GPS-KELLO KADOTTI SIGNAALIN!"',
    '"10K ASKELTA PUUTTUU!"',
    '"POLVET ANTOI PERIKSI!"',
    '"RASVANPOLTO PÄÄTTYI!"',
    '"PT EI MAININNUT TÄSTÄ!"',
    '"JUOKSUKENGÄT EI AUTTANUT!"',
    '"VO2MAX LOPPU!"',
    '"COOPER-TESTI EPÄONNISTUU!"',
  ],
  
  // CrossfitBro - Intense crossfit enthusiast
  crossfit_bro: [
    '"NOSTATKO SÄ EDES?!"',
    '"WOD KESKEYTYI!"',
    '"BURPEES... IKUISESTI... eiku..."',
    '"CROSSFIT-BOKSI MENETTÄÄ JÄSENEN!"',
    '"GAINSSIT KATOSI!"',
    '"PROTEIINISHEIKKI VALUI!"',
    '"OVERHEAD SQUAT FEILASI!"',
    '"PUNTTEJA EI VOI KULJETTAA MUKAAN!"',
    '"SNATCH MISSASI!"',
    '"BRO... SPLIT... PYSYVÄSTI..."',
    '"KEHO ON TEMPPELI... RAUNIO..."',
    '"PR JÄÄÄ TEKEMÄTTÄ!"',
  ],
  
  // InfluencerSelfie - Social media influencer
  influencer_selfie: [
    '"FOLLOWERSIT EI NÄE TÄTÄ!"',
    '"TÄMÄ EI OLE INSTAGRAMMABLE!"',
    '"ENGAGEMENT RATE TIPPUU!"',
    '"CONTENT... WAS... KING..."',
    '"BRAND DEAL PERUUNTUU!"',
    '"MIKÄÄN FILTTERI EI AUTA TÄHÄN!"',
    '"AESTHETIC MENI!"',
    '"STORY JÄÄÄ IKUISESTI POSTAAMATTA!"',
    '"COLLAB CANCELLED!"',
    '"LIKE AND SUBSCRIBE... TAIVAASEEN..."',
    '"ALGORITMI HYLKÄÄ!"',
    '"VIIMEINEN POSTAUS!"',
  ],
  
  // RealEstateAgent - Pushy real estate agent
  real_estate_agent: [
    '"SIJAINTI SIJAINTI KUOLEMA!"',
    '"MYYNTILISTA LYHENEE!"',
    '"TÄMÄ OLI UPEA TILAISUUS!"',
    '"NÄYTTÖ PERUUNTUU PYSYVÄSTI!"',
    '"PROVISIO JÄÄ SAAMATTA!"',
    '"ASUNTO-OSAKKEET MYYMÄTTÄ!"',
    '"KÄYNTIKORTTEJA EI ENÄÄ TARVITA!"',
    '"TARJOUKSIA EI ENÄÄ TULE!"',
    '"HINTA OLI NEUVOTELTAVISSA!"',
    '"AVOIMET OVET SULKEUTUU!"',
    '"ASUNTOKAUPPA KARIUTUU!"',
    '"ETUOVI.COM POISTAA ILMOITUKSEN!"',
  ],
  
  // CityCyclist - Aggressive city cyclist
  city_cyclist: [
    '"PYÖRÄ HAJOSI!"',
    '"PYÖRÄILIJÄN OIKEUDET TALLOTTU!"',
    '"KYPÄRÄ EI RIITTÄNYT!"',
    '"PYÖRÄTIE OLI MINUN!"',
    '"SHIMANO-VAIHTEET VAURIOITUI!"',
    '"PYÖRÄKAISTAT OLIS TARVINNUT!"',
    '"LYCRA REPESI!"',
    '"AUTOILIJAT VOITTI... tällä kertaa..."',
    '"FILLARI RUTISTUI!"',
    '"CRITICAL MASS JATKUU ILMAN MINUA!"',
    '"POLKUPYÖRÄVAKUUTUS!"',
    '"KETJUT KATKESI!"',
  ],
  
  // EScooterRider - Electric scooter rider
  escooter_rider: [
    '"AKKU LOPPU... MINÄKIN!"',
    '"LIME TIME OVER!"',
    '"TIER TIPAHTAA!"',
    '"15KM/H EI RIITTÄNYT PAKOON!"',
    '"VUOKRA-AIKA PÄÄTTYI!"',
    '"JALKAKÄYTÄVÄ VOITTI!"',
    '"VOI VIETIIN!"',
    '"SKUUTTI SKUUTTAA POIS!"',
    '"VIIMEINEN KYYTI!"',
    '"SÄHKÖ SAMMUI!"',
    '"PARKKEERASIN VÄÄRIN!"',
    '"KAUPUNKIPYÖRÄ OLIS OLLUT TURVALLISEMPI!"',
  ],
  
  // DrunkPerson - Intoxicated person on trail
  drunk_person: [
    '"HIC... MISSÄS TÄÄ ON...?"',
    '"KALJA KAATU!"',
    '"LONKERO... viimeinen..."',
    '"EN OLE EDES KÄNNISSÄ! ...niin kännissä..."',
    '"KARHU KARKASI!"',
    '"SEURAAVA KIERROS PERUUNTUU!"',
    '"TERASSIKAUSI PÄÄTTYI!"',
    '"LISÄÄ SKUMPPAA... EIKU..."',
    '"AFTER SKI AFTER LIFE!"',
    '"KIPPIS! HIC! ...kuolema..."',
    '"BAARI SULKEUTUU!"',
    '"DRINKKINI LÄIKKYY!"',
  ],
  
  // SmokingLady - Person smoking on ski trail  
  smoking_lady: [
    '"TUPAKKA SAMMU!"',
    '"VIIMEISET HENKOSET!"',
    '"SÄHKÖTUPAKKA HAJOSI!"',
    '"VAPE NATION... FALLEN..."',
    '"NIKOTIINIVIEROITUS ALKAA!"',
    '"RÖÖKITAUKO PÄÄTTYI!"',
    '"MARLBORO MIES KAATUI!"',
    '"TÄMÄ OLIKIN VIIMEINEN!"',
    '"MENTHOL-MAKU KATOSI!"',
    '"VAROITUS PAKETIN KYLJESSÄ OLI TOTTA!"',
    '"SAVUA ILMAN TULTA... eiku..."',
    '"KEUHKOT KIITTÄÄ... EI OIKEESTI!"',
  ],
  
  // PassiveGrandpa - Slow moving elderly person
  passive_grandpa: [
    '"MEIDÄN AIKAAN KUNNIOITETTIIN VANHUKSIA!"',
    '"NUORISO NYKYÄÄN..."',
    '"LONKAT PETTI!"',
    '"ENNEN OLI PAREMMIN!"',
    '"ROLLAATTORI KAATUI!"',
    '"ELÄKE MENI TURHUUTEEN!"',
    '"VERENPAINEET NOUSI!"',
    '"KYLLÄ MÄ VIELÄ... EIKU EN..."',
    '"TERVEYSKESKUS EI AUTA ENÄÄ!"',
    '"ENNEN TÄÄLLÄ OLI KUNNIOITUSTA!"',
    '"KELAN LOMAKE JÄÄ TÄYTTÄMÄTTÄ!"',
    '"APTEEKKI JÄÄ KÄYMÄTTÄ!"',
  ],
  
  // FamilyGroup - Large family blocking trail
  family_group: [
    '"LAPSET JUOSKAA! ...liian myöhään..."',
    '"ÄITIYSLOMA PÄÄTTYI NÄIN?!"',
    '"RATTAAT KAATUI!"',
    '"PERHEAUTO JÄÄÄ YKSIN!"',
    '"ISÄNPÄIVÄ PILALLA!"',
    '"LASTENHOITAJA SAA LISÄTYÖTÄ!"',
    '"ÄITIPIIRI SAA AIHETTA!"',
    '"NEUVOLA EI VAROITTANUT!"',
    '"LAPSET ENSIN... SITTEN VANHEMMAT..."',
    '"VAUVAVUOSI PÄÄTTYI!"',
    '"PÄIVÄKOTIPAIKKOJA VAPAUTUU!"',
    '"PIRKKO-TÄTI HOITAA NYT!"',
  ],
  
  // PrivateSchoolSUV - Giant SUV on ski trail
  private_school_suv: [
    '"VOLVO XC90 ROMUTTUU!"',
    '"YKSITYISKOULU ODOTTAA TURHAAN!"',
    '"RANGE ROVER RANKKASI!"',
    '"PENKINLÄMMITYS EI AUTA!"',
    '"BMW X7 RÄJÄHTI!"',
    '"NELIVETO EI RIITTÄNYT!"',
    '"PARKKIRUUTU JÄÄ TYHJÄKSI!"',
    '"AUTOPESU PERUUNTUU!"',
    '"AUTOETU PÄÄTTYY!"',
    '"LEASING LOPPU!"',
    '"VAKUUTUSYHTIÖ EI KORVAA!"',
    '"HUOLTOKIRJA SULKEUTUU!"',
  ],
  
  // TunedCar - Modified car with loud exhaust
  tuned_car: [
    '"FIAT PANDA ROMPSI!"',
    '"SPOILERI SPOILATTIIN!"',
    '"TÄYSLEDIT SAMMUU!"',
    '"SUBWOOFERI HILJENI!"',
    '"MADALLUS MAADOITTI!"',
    '"MOOTTORI SAMMU!"',
    '"RACING STRIPES EI RIITTÄNYT!"',
    '"NITRO TYHJÄ!"',
    '"NEONVALOT PIMENI!"',
    '"VAUHTI LOPPU!"',
    '"KATSELUAUTO KATSELTIIN!"',
    '"VIIMEINEN KAAHARI!"',
  ],
  
  // GolfCartDriver - Golf cart on ski trail
  golf_cart_driver: [
    '"GOLF CART GOLFFATTIIN!"',
    '"HANDICAP NOUSI ÄÄRETTÖMIIN!"',
    '"TEE TIME PERUUNTUU!"',
    '"DOUBLE BOGEY... triple... kuolema..."',
    '"JÄSENYYS PÄÄTTYY!"',
    '"BUNKKERI VOITTI!"',
    '"VIIMEINEN PUTTI!"',
    '"CLUBHOUSE ODOTTAA TURHAAN!"',
    '"CADDIE EI VOI AUTTAA!"',
    '"PAR JÄÄÄ SAAVUTTAMATTA!"',
    '"19. REIKÄ LÖYTYI!"',
    '"GOLFKÄRRY KÄRRYTTIIN!"',
  ],
  
  // WellnessWarrior - Spiritual wellness person
  wellness_warrior: [
    '"NAMASTE... GOODBYE!"',
    '"CHAKRAT SEKAISIN!"',
    '"KARMA ISKI TAKAISIN!"',
    '"ENERGIAT LOPPU!"',
    '"KRISTALLIT EI AUTTANUT!"',
    '"MEDITAATIO KESKEYTYY!"',
    '"HENGITÄ SISÄÄN... UL... ei enää..."',
    '"AURA SAMMUU!"',
    '"MANIFESTOIN VÄÄRIN!"',
    '"REIKI EI RIITÄ!"',
    '"WELLNESS MENI UNWELL!"',
    '"KOLMAS SILMÄ SULKEUTUU!"',
  ],
  
  // YachtOwner - Wealthy yacht owner
  yacht_owner: [
    '"PURJEVENE JÄÄ SATAMAAN!"',
    '"REGATTA PERUUNTUI!"',
    '"JOLLAPAIKKA JÄÄ TYHJÄKSI!"',
    '"MERENRANTAHUVILA ODOTTAA!"',
    '"KIPPARI JÄÄ YKSIN!"',
    '"ANKKURI LASKETTIIN VIIMEISEN KERRAN!"',
    '"SATAMAMAKSUT TURHA!"',
    '"TUULI TYYNTYI PYSYVÄSTI!"',
    '"YACHT CLUB MENETTÄÄ JÄSENEN!"',
    '"KÖYSI KATKESI!"',
    '"PURJEHDUSKAUSI PÄÄTTYI!"',
    '"MERIKORTIT TURHAT!"',
  ],
  
  // BrunchLady - Brunch obsessed person
  brunch_lady: [
    '"PÖYTÄVARAUS PERUUNTUU!"',
    '"AVOKADOLEIPÄ LEVISI LUMEEN!"',
    '"MIMOSA KAATUI!"',
    '"EGGS BENEDICT KYLMENEE IKUISESTI!"',
    '"BRUNCH-PAIKKA MENETTÄÄ ASIAKKAAN!"',
    '"MENUA EN ENÄÄ LUE!"',
    '"ARVOSTELU JÄÄ KIRJOITTAMATTA!"',
    '"TARJOILIJA EI ENÄÄ TULE!"',
    '"FOODIE-INSTA PÄÄTTYY!"',
    '"TIPPIÄ EI JÄÄ!"',
    '"KAHVIT KYLMENEE!"',
    '"CROISSANTIT TURHAT!"',
  ],
  
  // TennisPlayer - Tennis player on ski trail
  tennis_player: [
    '"TENNISTUNTI PERUUNTUU!"',
    '"SERVE EPÄONNISTUI!"',
    '"WILSON HAJOSI!"',
    '"MATCH POINT SINULLE!"',
    '"TENNISKYYNÄRPÄÄ TAPPOI!"',
    '"KENTTÄVARAUS TURHA!"',
    '"TENNISHAME LIKAANTUI!"',
    '"LOVE TARKOITTAA NOLLAA... JA NIIN TARKOITTAA ELÄMÄNI NYT!"',
    '"VIIMEINEN SMASH!"',
    '"DOUBLE FAULT FOREVER!"',
    '"MAILA KATKESI!"',
    '"PALLOT LOPPU!"',
  ],
  
  // AfterSkiAlpha - Loud après-ski party person
  after_ski_alpha: [
    '"AFTER SKI IS OVER!"',
    '"KUOHUVIINI KAATUI!"',
    '"YÖKERHO SULKEE!"',
    '"VIP-PÖYTÄ JÄÄ TYHJÄKSI!"',
    '"BILEET LOPPUI!"',
    '"SHOTIT SAMMUI!"',
    '"DJ LOPETTI!"',
    '"RINNERAVINTOLA MENETTI VIP:IN!"',
    '"SKUMPPA LÄIKKYI LUMEEN!"',
    '"HISSIKORTTI JÄÄ KÄYTTÄMÄTTÄ!"',
    '"PARTY PEOPLE MENETTI YHDEN!"',
    '"VIIMEINEN TANSSI!"',
  ],
  
  // ProSkier - Professional skier
  pro_skier: [
    '"MAAILMANCUP PÄÄTTYY!"',
    '"PUJOTTELU PUJOTELTIIN!"',
    '"SPONSORIT KATOAA!"',
    '"OLYMPIAUNELMAT OHI!"',
    '"VALMENTAJA EI VAROITTANUT!"',
    '"KILPAILU HÄVITTY PAHASTI!"',
    '"KISAPUKU REPESI!"',
    '"LASKUAIKA EI RIITÄ!"',
    '"SUKSIVOIDE EI AUTTANUT!"',
    '"KULTAMITALI KATOSI!"',
    '"KANSALLISSANKARI KAATUI!"',
    '"URHEILUELÄMÄ PÄÄTTYY!"',
  ],
  
  // SomaliSkier - Somali-Finnish skier (positive representation)
  somali_skier: [
    '"SUOMEN TALVI ON KOVA!"',
    '"HIIHTOTUNTI JÄÄÄ KESKEN!"',
    '"AFROSKIING FOREVER!"',
    '"LATU OLI KAUNIS!"',
    '"HIIHTOLOMAAN ASTI... EIKU..."',
    '"VUOKRASUKSET PALAUTUU AJOISSA!"',
    '"LUMI ON KYLMÄÄ!"',
    '"TERMOSPULLO KAATUI!"',
    '"HARJOITTELU JATKUU... JOSSAIN..."',
    '"SOMALIA-SUOMI-SNOW!"',
    '"INTEGRAATIO EDISTYY!"',
    '"SUOMALAISTUIN LIIKAA!"',
  ],
  
  // AsianTechWorker - Startup tech worker
  asian_tech_worker: [
    '"STARTUP LOPPU!"',
    '"SPRINT FEILASI!"',
    '"MACBOOK HAJOSI!"',
    '"DAILY STANDUP PERUUNTUU!"',
    '"SLACK-VIESTI JÄÄ LUKEMATTA!"',
    '"DEPLOY KAATUI... NIIN MINÄKIN!"',
    '"STOCK OPTIOT ARVOTON!"',
    '"AGILE EI AUTTANUT!"',
    '"SCRUM MASTER EI PELASTA!"',
    '"SERIES A JÄÄÄ SAAMATTA!"',
    '"KOODI JÄÄÄ COMMITOIMATTA!"',
    '"PIVOTTI EI PELASTA!"',
  ],
  
  // Boss death quotes by type
  boss_marja_liisa: [
    '"TIEDÄTKÖ KUKA MIEHENI ON?!"',
    '"FACEBOOK-RYHMÄ KUULEE TÄSTÄ!"',
    '"ESPOO-KORTTI EI PELASTA!"',
    '"STEINERKOULUN JOHTOKUNTA KOSTAA!"',
    '"PERSONAL TRAINER PETTYI!"',
    '"ÄITIYSPAKKAUS OLI PAREMPI!"',
  ],
  
  boss_jari_litmanen: [
    '"LATU KEISARI HILJENI, MIKKI PUTOSI!"',
    '"BASSO JÄI TORVIN PIHAAN..."',
    '"FLOW KATKESI KESKEN KEIKAN!"',
    '"LAHTI KATSOI JA NYÖKKÄSI."',
    '"TÄÄ SETTI EI MENNYT SUUNNITELMIIN."',
    '"NÄHDÄÄN UUDESTAAN LAVALLA."',
  ],
  
  boss_jari_isometsa: [
    '"AUTOPILOT CRASHED!"',
    '"TO THE MOON... YKSIN..."',
    '"PORTFOLION ARVO: NOLLA!"',
    '"BITCOIN KUOLEE... NIIN MINÄKIN..."',
    '"ELON EI TWIITTAA APUA!"',
    '"MARS JÄÄ SAAVUTTAMATTA!"',
  ],
  
  boss_matti_nykanen: [
    '"HOLE IN ONE... HAUTAAN!"',
    '"GREEN FEE MENI HUKKAAN!"',
    '"HANDICAP INFINITY!"',
    '"CADDIE EI PELASTA!"',
    '"GOLF CART KARKAS!"',
    '"MÄKIHYPPY OLI PAREMPI LAJI!"',
  ],

  boss_jeti: [
    '"HUUSSI TYHJENI... JA NIIN MINÄKIN!"',
    '"KUPONKIVIHKO KATOSI HANGEEN!"',
    '"FÖLI KULKEE ILMAN PASIA..."',
    '"TURUN LATU EI ANTANUT ARMOO!"',
    '"HESEN KUPONKI JÄI KÄYTTÄMÄTTÄ!"',
    '"PASI SULI HANKEEN!"',
  ],
  
  boss_timo_soini: [
    '"JYTKY LYTKÄHTI!"',
    '"PERUSSUOMALAISET MUISTAA!"',
    '"PANNUKAKKU KYLMENEE!"',
    '"VILLA GRANDE ODOTTAA... TURHAAN!"',
    '"PERSUT EI ANNA PERIKSI... YLEENSÄ!"',
    '"POLITIIKKA ON VAIKEAA!"',
  ],
  
  // Litmanen Parody (special boss)
  litmanen_parody: [
    '"AJAX MUISTAA IKUISESTI!"',
    '"EI OLLUT DOPINGIA... EHKÄ VÄHÄN..."',
    '"KULTAINEN KENKÄ KATOSI!"',
    '"LAHTI ON URHEILUKAUPUNKI... OLI..."',
    '"SUOMEN KUNINGAS SYÖSTIIN VALTAISTUIMELTA!"',
    '"MAAJOUKKUE PELAA ILMAN MINUA!"',
  ],
};

/**
 * Show a floating death quote above a dying enemy
 * @param scene - The current Phaser scene
 * @param x - X position for the quote
 * @param y - Y position for the quote (will float upward)
 * @param enemyType - Type of enemy (key for DEATH_QUOTES)
 * @param chance - Probability to show quote (0-1), default 0.35
 */
export function showDeathQuote(
  scene: Phaser.Scene,
  x: number,
  y: number,
  enemyType: string,
  chance: number = 0.35
): void {
  if (!ENEMY_DEATH_QUOTES_ENABLED || !FLAVOR_TEXT_ENABLED) return;

  // Random chance check
  if (Math.random() > chance) return;
  
  // Get quotes for this enemy type, fallback to generic enemy quotes
  const quotes = DEATH_QUOTES[enemyType] || DEATH_QUOTES['enemy'];
  if (!quotes || quotes.length === 0) return;
  
  // Pick a random quote
  const quote = sanitizePlayerFacingText(Phaser.Math.RND.pick(quotes));
  if (!quote) return;
  
  // Create the floating text
  const deathText = scene.add.text(
    x,
    y - 60,
    quote,
    {
      fontFamily: 'PublicPixel',
      fontSize: '13px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: 180 }
    }
  );
  deathText.setOrigin(0.5);
  deathText.setDepth(1001);
  
  // Float up and fade animation
  scene.tweens.add({
    targets: deathText,
    y: deathText.y - 80,
    alpha: 0,
    scale: 1.15,
    duration: 2200 + DEATH_QUOTE_EXTRA_DURATION_MS,
    ease: 'Power2',
    onComplete: () => deathText.destroy()
  });
}

// ========== iOS COMPATIBILITY HELPERS ==========

/**
 * Check if the current device is iOS
 */
export function isIOS(): boolean {
  return isIOSLike();
}

/**
 * Pick the most compatible audio URL from a pack entry.
 * iOS prefers MP3/M4A/AAC/WAV before OGG for reliability.
 */
export function pickPreferredAudioUrl(url: unknown, iosPreferMp3First: boolean = isIOS()): string | null {
  if (typeof url === "string") return url;
  if (!Array.isArray(url)) return null;

  const candidates = url.filter((candidate): candidate is string => typeof candidate === "string");
  if (candidates.length === 0) return null;

  const preferredOrder = iosPreferMp3First
    ? [".mp3", ".m4a", ".aac", ".wav", ".ogg"]
    : [".ogg", ".mp3", ".m4a", ".aac", ".wav"];

  const lowerCandidates = candidates.map((candidate) => candidate.toLowerCase());
  for (const extension of preferredOrder) {
    const idx = lowerCandidates.findIndex((candidate) => candidate.endsWith(extension));
    if (idx >= 0) return candidates[idx];
  }

  return candidates[0];
}

/**
 * Check if the current device is a mobile device
 */
export function isMobileDevice(): boolean {
  if (isMobileOnlyBuild()) return true;
  return getPlatformCapabilities().isMobile;
}

/**
 * Clamp delta time to prevent physics explosions after iOS background/foreground
 * iOS pauses JS execution when app is backgrounded, causing massive delta spikes
 * @param delta - The delta time from Phaser's update
 * @param maxDelta - Maximum allowed delta (default 100ms = 10fps minimum)
 */
export function clampDelta(delta: number, maxDelta: number = 100): number {
  return Math.min(delta, maxDelta);
}

/**
 * Safe audio play - handles iOS audio context unlocking
 * @param scene - Current Phaser scene
 * @param key - Sound key to play
 * @param config - Sound config
 */
export function safePlaySound(
  scene: Phaser.Scene, 
  key: string, 
  config?: Phaser.Types.Sound.SoundConfig
): Phaser.Sound.BaseSound | null {
  if (!isSfxAllowed(key)) return null;

  try {
    // Check if sound exists
    if (!scene.cache.audio.exists(key)) {
      console.debug(`Sound "${key}" not found in cache`);
      return null;
    }
    
    // Try to play
    return scene.sound.play(key, config) ? scene.sound.get(key) : null;
  } catch (e) {
    console.debug(`Failed to play sound "${key}":`, e);
    return null;
  }
}

/**
 * Safe audio add - never throws if asset is missing from cache.
 * Useful for startup paths where missing packs should not crash gameplay.
 */
export function safeAddSound(
  scene: Phaser.Scene,
  key: string,
  config?: Phaser.Types.Sound.SoundConfig
): Phaser.Sound.BaseSound | undefined {
  if (!isSfxAllowed(key)) return undefined;

  try {
    if (!scene?.cache?.audio?.exists?.(key)) {
      console.debug(`Sound "${key}" not found in cache (safeAddSound)`);
      return undefined;
    }
    return scene.sound.add(key, config);
  } catch (e) {
    console.debug(`Failed to add sound "${key}":`, e);
    return undefined;
  }
}

/**
 * Resolve an asset URL from loaded asset-pack metadata by asset key.
 * Useful for DOM <img> / @font-face sources that should stay offline-compatible.
 */
export function resolveAssetUrl(scene: Phaser.Scene, key: string, fallback: string = ""): string {
  try {
    const pack = scene.cache.json.get("assetPack");
    if (!pack || typeof pack !== "object") return fallback;

    for (const section of Object.values(pack as Record<string, any>)) {
      const files = Array.isArray(section?.files) ? section.files : [];
      const match = files.find((file: any) => file?.key === key && typeof file?.url !== "undefined");
      if (!match) continue;

      if (typeof match.url === "string") return match.url;
      if (Array.isArray(match.url) && typeof match.url[0] === "string") return match.url[0];
    }
  } catch {
    // Ignore cache lookup failures and return fallback.
  }
  return fallback;
}

/**
 * Ensure Phaser audio is awake on iOS and after app foreground transitions.
 * This is safe to call often (pointer, visibility, scene start).
 */
export function ensureSceneAudioReady(scene: Phaser.Scene): void {
  const soundManager = scene.sound as any;

  // Phaser HTML5AudioSoundManager on touch devices marks audio tags as locked
  // and waits for a touchend before it actually loads/plays audio.
  // In native iOS app builds we explicitly allow autoplay at WKWebView level,
  // so we can safely force-unlock these tags and flush queued audio actions.
  try {
    const isHtml5Manager = !!soundManager && !!soundManager.lockedActionsQueue && scene.game.device.audio.webAudio === false;
    if (isHtml5Manager) {
      const cacheEntries = (scene.cache.audio as any)?.entries;
      if (cacheEntries && typeof cacheEntries.each === "function") {
        cacheEntries.each((_: string, tags: any[]) => {
          if (!Array.isArray(tags)) return true;
          for (const tag of tags) {
            if (!tag) continue;
            if (!tag.dataset) {
              tag.dataset = {};
            }
            if (tag.dataset.locked === "true") {
              tag.dataset.locked = "false";
              try {
                tag.preload = "auto";
              } catch {
                // Ignore preload assignment errors.
              }
              try {
                if (typeof tag.load === "function") tag.load();
              } catch {
                // Ignore per-tag load failures.
              }
            }
          }
          return true;
        });
      }

      if (soundManager.locked) {
        soundManager.locked = false;
      }
      soundManager.unlocked = true;

      if (Array.isArray(soundManager.lockedActionsQueue) && soundManager.lockedActionsQueue.length > 0) {
        while (soundManager.lockedActionsQueue.length > 0) {
          const lockedAction = soundManager.lockedActionsQueue.shift();
          if (!lockedAction?.sound || !lockedAction?.prop) continue;
          try {
            const target = lockedAction.sound[lockedAction.prop];
            if (target && typeof target.apply === "function") {
              target.apply(lockedAction.sound, lockedAction.value || []);
            } else {
              lockedAction.sound[lockedAction.prop] = lockedAction.value;
            }
          } catch {
            // Ignore failing queued actions and continue.
          }
        }
      }
    }
  } catch {
    // Ignore force-unlock issues and continue with normal wake path.
  }

  try {
    if (scene.sound.locked) {
      scene.sound.unlock();
    }
  } catch {
    // Ignore unlock errors and keep trying on next interaction.
  }

  try {
    const ctx = (scene.sound as any)?.context as AudioContext | undefined;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    // Ignore context resume errors.
  }

  try {
    scene.sound.resumeAll();
  } catch {
    // Ignore resume errors if sound manager is not ready yet.
  }

  // Safety: ensure audio is not globally muted or volume-clamped to zero.
  try {
    if (scene.sound.mute) {
      scene.sound.mute = false;
    }
    if (typeof (scene.sound as any).volume === "number" && (scene.sound as any).volume <= 0) {
      (scene.sound as any).volume = 1;
    }
  } catch {
    // Ignore mute/volume recovery errors.
  }
}

/**
 * Throttle function for performance optimization
 * Useful for throttling expensive operations on iOS
 * @param func - Function to throttle
 * @param limit - Minimum time between calls in ms
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function for preventing rapid repeated calls
 * @param func - Function to debounce
 * @param wait - Wait time in ms
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get safe area insets for iOS notch/home indicator handling
 * Returns CSS env() values or fallbacks
 */
export function getSafeAreaInsets(): { top: number; right: number; bottom: number; left: number } {
  const computedStyle = getComputedStyle(document.documentElement);
  
  const parseInset = (property: string, fallback: number = 0): number => {
    const value = computedStyle.getPropertyValue(property);
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  };
  
  return {
    top: parseInset('--sat', 0) || parseInset('env(safe-area-inset-top)', 0),
    right: parseInset('--sar', 0) || parseInset('env(safe-area-inset-right)', 0),
    bottom: parseInset('--sab', 0) || parseInset('env(safe-area-inset-bottom)', 0),
    left: parseInset('--sal', 0) || parseInset('env(safe-area-inset-left)', 0),
  };
}

/**
 * Request iOS haptic feedback if available
 * Uses Taptic Engine on supported devices
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'): void {
  // Try iOS-specific Taptic Engine first
  if ((window as any).webkit?.messageHandlers?.haptic) {
    try {
      (window as any).webkit.messageHandlers.haptic.postMessage({ type });
      return;
    } catch (e) {
      // Fall through to vibration API
    }
  }
  
  // Fallback to standard Vibration API
  if (!navigator.vibrate) return;
  
  const patterns: { [key: string]: number | number[] } = {
    light: 8,
    medium: 20,
    heavy: 40,
    selection: 5,
    success: [15, 50, 15],
    warning: [40, 30, 40],
    error: [60, 20, 60, 20, 60]
  };
  
  navigator.vibrate(patterns[type] || 10);
}
