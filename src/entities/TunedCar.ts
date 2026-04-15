import Phaser from "phaser";
import * as utils from "../utils";
import { teslaConfig } from "../gameConfig.json";

/**
 * TunedCar - Lahti Level 4 exclusive vehicle obstacle
 * Replaces Tesla in Level 4 with a more aggressive tuned car
 * More chaotic behavior, loud engine, aggressive driving
 */
export class TunedCar extends Phaser.Physics.Arcade.Sprite {
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
  
  // Tuned car specific - more aggressive behavior
  wobbleTimer?: Phaser.Time.TimerEvent;
  isWobbling: boolean = false;

  // Track if using fallback texture
  private usingFallback: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, direction: number = 1) {
    // Use tuned_car_lahti sprite, fallback to Tesla if not available
    const hasTunedCarAsset = scene.textures.exists("tuned_car_lahti");
    const textureKey = hasTunedCarAsset 
      ? "tuned_car_lahti" 
      : "tesla_model_y";
    super(scene, x, y, textureKey);
    
    this.usingFallback = !hasTunedCarAsset;

    // Add to scene and physics system
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Initialize attributes - tuned car is FASTER and more dangerous
    this.speed = teslaConfig.speed.value * 1.3; // 30% faster than Tesla
    this.damage = teslaConfig.damage.value * 1.2; // 20% more damage
    this.direction = direction;
    this.hasHonked = false;

    // Use utility function to initialize sprite's size, scale, etc.
    const standardHeight = 85; // Slightly taller (lowered suspension but bigger rims)
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, standardHeight, 0.9, 0.6);

    // Flip sprite if going left
    this.setFlipX(direction === -1);
    
    // Add tuning-style tint (purple/blue glow)
    // If using fallback Tesla texture, use a stronger purple tint to distinguish
    if (this.usingFallback) {
      this.setTint(0x9944ff); // Deeper purple for fallback Tesla
    } else {
      this.setTint(0xcc88ff); // Light purple for tuned car asset
    }

    // Make immovable
    this.body.setImmovable(true);

    // Initialize sound effects
    this.initializeSounds();

    // Play engine sound (louder than Tesla)
    this.engineSound?.play();
    
    // Start wobble effect (unstable driving)
    this.startWobble();
  }

  // Call this method after adding TunedCar to a group to set velocity
  setInitialVelocity(): void {
    this.body.setVelocityX(this.speed * this.direction);
  }
  
  // Tuned car wobbles chaotically
  startWobble(): void {
    this.wobbleTimer = this.scene.time.addEvent({
      delay: 200,
      callback: () => {
        if (!this.active || !this.scene) return;
        
        // Random vertical wobble
        const wobbleY = Phaser.Math.Between(-8, 8);
        this.y = this.y + wobbleY * 0.3;
        
        // Random angle wobble
        this.angle = Phaser.Math.Between(-3, 3);
      },
      loop: true
    });
  }

  // Main update method - called every frame
  update(time: number, delta: number) {
    // Safety check
    if (!this.body || !this.active || !this.scene) {
      return;
    }

    // Honk aggressively when close to player (multiple honks!)
    const player = (this.scene as any).player;
    if (player && !this.hasHonked) {
      const distanceToPlayer = Math.abs(this.x - player.x);
      if (distanceToPlayer < 350) { // Honk earlier than Tesla
        this.hornSound?.play();
        this.hasHonked = true;
        
        // Second honk for extra aggression
        this.scene.time.delayedCall(200, () => {
          this.hornSound?.play();
        });
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
    this.hornSound = utils.safeAddSound(this.scene, "tesla_horn", { volume: 0.6 }); // Louder horn
    this.engineSound = utils.safeAddSound(this.scene, "tesla_engine", { volume: 0.5, rate: 1.3 }); // Higher pitched engine
  }

  // Override destroy to stop sounds and timers
  destroy(fromScene?: boolean): void {
    if (this.engineSound) {
      this.engineSound.stop();
    }
    if (this.wobbleTimer) {
      this.wobbleTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
