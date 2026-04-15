import Phaser from "phaser";
import * as utils from "../utils";

export type JumpRampSize = "small" | "medium" | "large";

type JumpRampProfile = {
  textureKey: string;
  visualHeight: number;
  launchVelocityY: number;
  horizontalBoost: number;
  perfectMinMs: number;
  perfectMaxMs: number;
  perfectBonus: number;
  requiredPeakPx: number;
};

const JUMP_RAMP_PROFILES: Record<JumpRampSize, JumpRampProfile> = {
  small: {
    textureKey: "jump_ramp_small_texture",
    visualHeight: 46,
    launchVelocityY: 480,
    horizontalBoost: 120,
    perfectMinMs: 360,
    perfectMaxMs: 1240,
    perfectBonus: 80,
    requiredPeakPx: 66,
  },
  medium: {
    textureKey: "jump_ramp_medium_texture",
    visualHeight: 58,
    launchVelocityY: 620,
    horizontalBoost: 160,
    perfectMinMs: 500,
    perfectMaxMs: 1600,
    perfectBonus: 125,
    requiredPeakPx: 94,
  },
  large: {
    textureKey: "jump_ramp_large_texture",
    visualHeight: 72,
    launchVelocityY: 730,
    horizontalBoost: 190,
    perfectMinMs: 640,
    perfectMaxMs: 1940,
    perfectBonus: 180,
    requiredPeakPx: 126,
  },
};

export class JumpRamp extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly rampSize: JumpRampSize;
  readonly launchVelocityY: number;
  readonly horizontalBoost: number;
  readonly perfectMinMs: number;
  readonly perfectMaxMs: number;
  readonly perfectBonus: number;
  readonly requiredPeakPx: number;
  hasRiskRoute: boolean = false;

  private lastLaunchAt: number = -99999;
  private launchCooldownMs: number = 700;

  constructor(scene: Phaser.Scene, x: number, groundY: number, rampSize: JumpRampSize) {
    const profile = JUMP_RAMP_PROFILES[rampSize];
    super(scene, x, groundY, profile.textureKey);

    this.rampSize = rampSize;
    this.launchVelocityY = profile.launchVelocityY;
    this.horizontalBoost = profile.horizontalBoost;
    this.perfectMinMs = profile.perfectMinMs;
    this.perfectMaxMs = profile.perfectMaxMs;
    this.perfectBonus = profile.perfectBonus;
    this.requiredPeakPx = profile.requiredPeakPx;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Keep ramps compact and clear on the track.
    utils.initScale(this, { x: 0.5, y: 1.0 }, undefined, profile.visualHeight, 0.9, 1.0);
    this.setDepth(6);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    const bodyWidth = Math.max(28, this.displayWidth * 0.82);
    const bodyHeight = Math.max(12, this.displayHeight * 0.42);
    this.body.setSize(bodyWidth, bodyHeight);
    this.body.setOffset((this.displayWidth - bodyWidth) * 0.5, this.displayHeight - bodyHeight);
  }

  canLaunch(time: number): boolean {
    return time - this.lastLaunchAt >= this.launchCooldownMs;
  }

  markLaunched(time: number): void {
    this.lastLaunchAt = time;
  }
}
