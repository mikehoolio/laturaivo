import Phaser from "phaser";
import * as utils from "../utils";
import { teslaConfig } from "../gameConfig.json";

// Tesla obstacle class for LATURAIVO
export class Tesla extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  // Attributes
  speed: number;
  damage: number;
  direction: number; // 1 = right, -1 = left

  // Sound effects
  hornSound?: Phaser.Sound.BaseSound;
  engineSound?: Phaser.Sound.BaseSound;

  // Flags
  hasHonked: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: number = 1,
    textureKey?: string
  ) {
    const sceneLevel = (scene as any)?.currentLevel;
    const level7ReplacementKey = "level_7_funi_vehicle_v2";
    const resolvedTextureKey =
      textureKey ||
      (sceneLevel === 7 && scene.textures.exists(level7ReplacementKey)
        ? level7ReplacementKey
        : "tesla_model_y");
    super(scene, x, y, resolvedTextureKey);

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Initialize attributes
    this.speed = teslaConfig.speed.value;
    this.damage = teslaConfig.damage.value;
    this.direction = direction;
    this.hasHonked = false;

    // Level 7 funicular replacement should read clearly larger than regular cars.
    const isLevel7FunicularVehicle = resolvedTextureKey === level7ReplacementKey;
    const standardHeight = isLevel7FunicularVehicle ? 160 : 80;
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.9, 0.6);

    // Flip sprite if going left
    this.setFlipX(direction === -1);

    // Make immovable
    this.body.setImmovable(true);

    // Initialize sound effects
    this.initializeSounds();

    // Play engine sound
    this.engineSound?.play();
    
    // NOTE: Velocity must be set AFTER adding to group, call setInitialVelocity() after adding to group
  }

  // Call this method after adding Tesla to a group to set velocity
  // (velocity gets reset when added to physics group)
  setInitialVelocity(): void {
    this.body.setVelocityX(this.speed * this.direction);
  }

  // Main update method - called every frame
  update(time: number, delta: number) {
    // Safety check - also check if scene exists (may be undefined during shutdown)
    if (!this.body || !this.active || !this.scene) {
      return;
    }

    // Honk when close to player
    const player = (this.scene as any).player;
    if (player && !this.hasHonked) {
      const distanceToPlayer = Math.abs(this.x - player.x);
      if (distanceToPlayer < 300) {
        this.hornSound?.play();
        this.hasHonked = true;
      }
    }

    // Destroy if off screen
    const screenWidth = this.scene.scale.width;
    if ((this.direction === 1 && this.x > screenWidth + 200) ||
        (this.direction === -1 && this.x < -200)) {
      this.destroy();
    }
  }

  // Initialize sound effects
  initializeSounds(): void {
    this.hornSound = utils.safeAddSound(this.scene, "tesla_horn", { volume: 0.4 });
    this.engineSound = utils.safeAddSound(this.scene, "tesla_engine", { volume: 0.3 });
  }

  // Override destroy to stop sounds
  destroy(fromScene?: boolean): void {
    if (this.engineSound) {
      this.engineSound.stop();
    }
    super.destroy(fromScene);
  }
}
