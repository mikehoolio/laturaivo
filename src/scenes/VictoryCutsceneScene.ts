import Phaser from "phaser";
import * as utils from "../utils";
import { LevelManager } from "../LevelManager";
import { LeaderboardManager } from "../managers/LeaderboardManager";
import type { LeaderboardEntry } from "../managers/LeaderboardManager";

// Victory cutscene with champagne celebration and leaderboard
export class VictoryCutsceneScene extends Phaser.Scene {
  currentLevel: number = 1;
  totalDistance: number = 0;
  enemiesDefeated: number = 0;
  score: number = 0;
  lives: number = 3;
  playerName: string = "PELAAJA";
  showingLeaderboard: boolean = false;

  constructor() {
    super({ key: "VictoryCutsceneScene" });
  }

  init(data: { currentLevel: number; totalDistance: number; enemiesDefeated: number; score: number; lives?: number }): void {
    this.currentLevel = data.currentLevel || 1;
    this.totalDistance = data.totalDistance || 0;
    this.enemiesDefeated = data.enemiesDefeated || 0;
    this.score = data.score || 0;
    this.lives = data.lives !== undefined ? data.lives : 3;
    this.showingLeaderboard = false;
    
    // Get player name from registry
    this.playerName = LeaderboardManager.sanitizePlayerName(
      String(this.registry.get('playerName') || 'PELAAJA')
    ) || "PELAAJA";
  }

  create(): void {
    // Dark overlay
    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.7
    );
    overlay.setDepth(100);

    // Use appropriate clubhouse based on level
    // Level 4 (Lahti) uses Ravintola Torvi - the legendary Lahti dive bar
    // All other levels use ski clubhouse
    const isLahtiLevel = this.currentLevel === 4;
    const clubhouseKey = isLahtiLevel ? "ravintola_torvi" : `clubhouse_level_${this.currentLevel}`;
    
    // Calculate clubhouse size - grows bigger with each level
    const baseHeight = 280;
    const heightIncrease = this.currentLevel * 20;
    const clubhouseScale = baseHeight + heightIncrease;
    
    // Show clubhouse in center
    const clubhouse = this.add.image(this.scale.width / 2, this.scale.height - 100, clubhouseKey);
    utils.initScale(clubhouse, { x: 0.5, y: 1.0 }, undefined, clubhouseScale);
    clubhouse.setDepth(101);
    
    // Add appropriate tint based on level
    if (isLahtiLevel) {
      clubhouse.setTint(0xffaaff); // Pink neon tint for Lahti bar
    } else if (this.currentLevel >= 8) {
      clubhouse.setTint(0xffd700); // Golden tint for levels 8-10
    } else if (this.currentLevel >= 5) {
      clubhouse.setTint(0xffe4b5); // Light gold tint for levels 5-7
    }
    
    // Add parked cars - tuned cars for Lahti, Teslas for Espoo levels
    const carCount = Math.min(this.currentLevel, 5);
    if (isLahtiLevel) {
      this.addTunedCarsInFront(carCount);
    } else {
      this.addTeslasInFront(carCount);
    }

    // Get character type from registry to show correct character
    const characterType = this.registry.get('characterType') || 'male';
    const playerIdleFrame = characterType === 'female' 
      ? 'female_player_ski_idle_R_frame1' 
      : 'player_ski_idle_R_frame1';

    // Show player entering (simple animation)
    const player = this.add.image(this.scale.width / 2 - 150, this.scale.height - 100, playerIdleFrame);
    utils.initScale(player, { x: 0.5, y: 1.0 }, undefined, 128);
    player.setDepth(102);

    // Animate player walking to clubhouse
    this.tweens.add({
      targets: player,
      x: this.scale.width / 2 - 80,
      duration: 1500,
      ease: "Linear",
      onComplete: () => {
        // Show champagne celebration with player
        this.showChampagneCelebration(player);
      }
    });

    // "Level X Complete" text - positioned below distance meter area (top bar is ~100px)
    const levelText = this.add.text(
      this.scale.width / 2,
      130,
      `TASO ${this.currentLevel} LÄPÄISTY!`,
      {
        fontFamily: "PublicPixel",
        fontSize: "48px",
        color: "#FFD700",
        stroke: "#000000",
        strokeThickness: 6
      }
    );
    levelText.setOrigin(0.5, 0.5);
    levelText.setDepth(103);
    levelText.setAlpha(0);

    // Fade in level text
    this.tweens.add({
      targets: levelText,
      alpha: 1,
      duration: 500,
      delay: 500
    });
  }

  showChampagneCelebration(player: Phaser.GameObjects.Image): void {
    // Position champagne bottle near player
    const champagne = this.add.image(
      player.x + 60,
      this.scale.height / 2 + 30,
      "champagne_bottle"
    );
    utils.initScale(champagne, { x: 0.5, y: 0.5 }, undefined, 160);
    champagne.setDepth(104);
    champagne.setAlpha(0);

    // Fade in champagne
    this.tweens.add({
      targets: champagne,
      alpha: 1,
      y: this.scale.height / 2 - 20,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Play pop sound
        utils.ensureSceneAudioReady(this);
        const popPlayed = this.sound.play("champagne_pop", { volume: 0.6 });
        if (!popPlayed) {
          const fallbackPop = utils.safePlaySound(this, "champagne_pop", { volume: 0.6 });
          if (!fallbackPop && utils.isIOS()) {
            const popUrl = utils.resolveAssetUrl(this, "champagne_pop", "assets/audio_local/champagne_pop.mp3");
            const popAudio = new Audio(popUrl);
            popAudio.volume = utils.applyGameVolume(0.6);
            popAudio.preload = "auto";
            (popAudio as any).playsInline = true;
            (popAudio as any).webkitPlaysInline = true;
            void popAudio.play().catch(() => undefined);
          }
        }

        // Shake bottle
        this.tweens.add({
          targets: champagne,
          angle: { from: -5, to: 5 },
          duration: 50,
          yoyo: true,
          repeat: 5,
          onComplete: () => {
            // Create particle burst effect
            this.createBubbleEffect(champagne.x, champagne.y - 80);
            
            // Animate player drinking champagne
            this.animatePlayerDrinking(player, champagne);
            
            // Show stats after celebration
            this.time.delayedCall(2000, () => {
              this.showStats(champagne, player);
            });
          }
        });
      }
    });
  }
  
  // Animate player celebrating with champagne
  animatePlayerDrinking(player: Phaser.GameObjects.Image, champagne: Phaser.GameObjects.Image): void {
    // Player tilts back slightly (drinking pose)
    this.tweens.add({
      targets: player,
      angle: -15,
      y: player.y - 10,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Then bob up and down happily in celebration
        this.tweens.add({
          targets: player,
          y: player.y - 8,
          duration: 200,
          yoyo: true,
          repeat: 5,
          ease: 'Sine.easeInOut'
        });
      }
    });
    
    // Move champagne bottle toward player (drinking motion)
    this.tweens.add({
      targets: champagne,
      x: player.x + 30,
      y: champagne.y + 30,
      angle: -35,
      duration: 300,
      ease: 'Quad.easeOut'
    });
  }

  createBubbleEffect(x: number, y: number): void {
    // Create simple bubble/sparkle effect with graphics
    for (let i = 0; i < 20; i++) {
      const bubble = this.add.circle(
        x + Phaser.Math.Between(-20, 20),
        y,
        Phaser.Math.Between(3, 8),
        0xFFD700,
        1
      );
      bubble.setDepth(105);

      // Animate bubbles flying up and fading
      this.tweens.add({
        targets: bubble,
        y: y - Phaser.Math.Between(100, 200),
        x: bubble.x + Phaser.Math.Between(-50, 50),
        alpha: 0,
        duration: Phaser.Math.Between(800, 1500),
        ease: "Power2",
        delay: i * 30,
        onComplete: () => {
          bubble.destroy();
        }
      });
    }
  }

  showStats(champagne: Phaser.GameObjects.Image, player?: Phaser.GameObjects.Image): void {
    // Fade out champagne and player
    this.tweens.add({
      targets: champagne,
      alpha: 0,
      y: champagne.y - 50,
      duration: 400
    });
    
    if (player) {
      this.tweens.add({
        targets: player,
        alpha: 0,
        y: player.y - 30,
        duration: 400
      });
    }

    const centerX = this.scale.width / 2;
    const startY = 150;
    const spacing = 40;

    // Different flavor stats based on level theme
    const isLahtiLevel = this.currentLevel === 4;
    const stats = isLahtiLevel ? [
      `Matka: ${Math.floor(this.totalDistance)}m`,
      `Kohtaamiset: ${this.enemiesDefeated}`,
      `Tuning-autoilta säästytty: ${Math.floor(Math.random() * 10) + 1}`,
      `Kierroksia hallittu: ${Math.floor(this.enemiesDefeated * 0.3)}`,
      `Pisteet: ${this.score}`
    ] : [
      `Matka: ${Math.floor(this.totalDistance)}m`,
      `Kohtaamiset: ${this.enemiesDefeated}`,
      `Tesloilta säästytty: ${Math.floor(Math.random() * 10) + 1}`,
      `Pisteet: ${this.score}`
    ];

    stats.forEach((stat, index) => {
      const text = this.add.text(centerX, startY + index * spacing, stat, {
        fontFamily: "PublicPixel",
        fontSize: "24px",
        color: "#FFFFFF",
        stroke: "#000000",
        strokeThickness: 4
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(106);
      text.setAlpha(0);

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 300,
        delay: index * 150
      });
    });

    // Show leaderboard after stats
    this.time.delayedCall(800, () => {
      this.showLeaderboard();
    });
  }

  showLeaderboard(): void {
    this.showingLeaderboard = true;
    
    // Get leaderboard data
    const leaderboard = LeaderboardManager.getLeaderboard();
    
    const centerX = this.scale.width / 2;
    const startY = 320;
    
    // Leaderboard title
    const title = this.add.text(centerX, startY, "TULOSTAULUKKO", {
      fontFamily: "PublicPixel",
      fontSize: "28px",
      color: "#00FFFF",
      stroke: "#000000",
      strokeThickness: 4
    });
    title.setOrigin(0.5, 0.5);
    title.setDepth(106);
    title.setAlpha(0);
    
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 300
    });
    
    // Show top 5 entries
    const displayEntries = leaderboard.slice(0, 5);
    displayEntries.forEach((entry, index) => {
      const isCurrentPlayer = entry.playerName === this.playerName && 
        Math.abs(entry.score - this.score) < 10;
      
      const color = isCurrentPlayer ? "#FFD700" : "#FFFFFF";
      
      const entryText = this.add.text(
        centerX, 
        startY + 50 + index * 35,
        `#${index + 1} ${entry.playerName} - ${entry.score} pts`,
        {
          fontFamily: "PublicPixel",
          fontSize: "20px",
          color: color,
          stroke: "#000000",
          strokeThickness: 3
        }
      );
      entryText.setOrigin(0.5, 0.5);
      entryText.setDepth(106);
      entryText.setAlpha(0);
      
      this.tweens.add({
        targets: entryText,
        alpha: 1,
        duration: 200,
        delay: 300 + index * 100
      });
    });
    
    // Show continue button after leaderboard
    this.time.delayedCall(1500, () => {
      this.showContinueButton();
    });
  }

  showContinueButton(): void {
    const isLastLevel = LevelManager.isLastLevel(this.currentLevel);

    const buttonText = isLastLevel ? "PELI LÄPISTÄ!" : "JATKA SEURAAVALLE TASOLLE";
    
    const button = this.add.text(
      this.scale.width / 2,
      this.scale.height - 80,
      buttonText,
      {
        fontFamily: "PublicPixel",
        fontSize: "32px",
        color: "#00FF00",
        stroke: "#000000",
        strokeThickness: 4
      }
    );
    button.setOrigin(0.5, 0.5);
    button.setDepth(107);
    button.setInteractive({ useHandCursor: true });

    // Blinking effect
    this.tweens.add({
      targets: button,
      alpha: { from: 1, to: 0.5 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // Handle click/enter
    button.on("pointerdown", () => this.proceedToNext(isLastLevel));
  }

  // Add tuned cars parked in front of Ravintola Torvi (Lahti Level 4)
  addTunedCarsInFront(count: number): void {
    // Level 4 (Lahti) specific - tuned cars for the dive bar
    let actualCount = Math.min(count, 4); // Up to 4 tuned cars for Lahti
    
    if (actualCount <= 0) return;
    
    const baseX = this.scale.width / 2 - 200;
    const spacing = 80;
    const baseY = this.scale.height - 60;
    
    for (let i = 0; i < actualCount; i++) {
      // Use tuned_car_lahti for Lahti level
      const car = this.add.image(baseX + (i * spacing), baseY, "tuned_car_lahti");
      utils.initScale(car, { x: 0.5, y: 1.0 }, 75, undefined);
      car.setDepth(100 + i);
      car.setAlpha(0);
      
      // Animate tuned cars driving in from the right with slight wobble for that Lahti feel
      car.x = this.scale.width + 100;
      this.tweens.add({
        targets: car,
        x: baseX + (i * spacing),
        alpha: 1,
        duration: 500,
        delay: 300 + (i * 200),
        ease: "Power2"
      });
    }
  }
  
  // Add Teslas parked in front of ski clubhouse (Espoo levels)
  addTeslasInFront(count: number): void {
    // Calculate number of Teslas based on level
    let actualCount = 0;
    if (this.currentLevel <= 2) {
      actualCount = 0; // Humble cabin, no fancy cars
    } else if (this.currentLevel <= 5) {
      actualCount = 1;
    } else if (this.currentLevel <= 7) {
      actualCount = 2;
    } else if (this.currentLevel <= 9) {
      actualCount = 3;
    } else {
      actualCount = Math.min(count, 5); // Maximum Espoo luxury for level 10
    }

    // Remove one extra Tesla from each end-of-level clubhouse lineup.
    actualCount = Math.max(0, actualCount - 1);
    
    if (actualCount <= 0) return;
    
    const baseX = this.scale.width / 2 - 200;
    const spacing = 80;
    const baseY = this.scale.height - 60;
    
    for (let i = 0; i < actualCount; i++) {
      // Use tesla_model_y for Espoo levels
      const car = this.add.image(baseX + (i * spacing), baseY, "tesla_model_y");
      utils.initScale(car, { x: 0.5, y: 1.0 }, 75, undefined);
      car.setDepth(100 + i);
      car.setAlpha(0);
      
      // Animate Teslas driving in silently (electric power!)
      car.x = this.scale.width + 100;
      this.tweens.add({
        targets: car,
        x: baseX + (i * spacing),
        alpha: 1,
        duration: 600,
        delay: 300 + (i * 200),
        ease: "Power2"
      });
    }
  }

  proceedToNext(isLastLevel: boolean): void {
    this.sound.play("ui_click_sound", { volume: 0.3 });

    const currentScene = this.scene.get("GameScene") as any;
    utils.stopGameplayMusic(this, currentScene);

    // Save current run snapshot to leaderboard on every level transition,
    // including final campaign completion.
    const levelsCompletedForLeaderboard = Math.min(this.currentLevel, LevelManager.TOTAL_LEVELS);
    const entry: LeaderboardEntry = {
      playerName: this.playerName,
      totalDistance: Math.floor(this.totalDistance),
      enemiesDefeated: this.enemiesDefeated,
      levelsCompleted: levelsCompletedForLeaderboard,
      score: this.score,
      date: new Date().toISOString().split("T")[0]
    };
    LeaderboardManager.addEntry(entry, {
      leaderboardEligible: this.registry.get("leaderboardEligible") !== false,
      cheatCodeUsed: !!this.registry.get("cheatCodeUsed"),
      godModeActivated: !!this.registry.get("godModeActivated"),
      difficulty: String(this.registry.get("difficulty") || "vantaa"),
      levelReached: this.currentLevel
    })
      .then(result => {
        if (!result.success) {
          console.debug("Leaderboard validation failed:", result.error);
        }
      })
      .catch(e => console.debug("Failed to save score:", e));

    const shouldCompleteCampaign = isLastLevel || this.currentLevel >= LevelManager.TOTAL_LEVELS;

    if (shouldCompleteCampaign) {
      // Go to game complete scene with special animation
      this.scene.stop("GameScene");
      this.scene.stop("UIScene");
      this.scene.start("GameCompleteUIScene", {
        totalDistance: this.totalDistance,
        enemiesDefeated: this.enemiesDefeated,
        score: this.score,
        levelsCompleted: this.currentLevel
      });
    } else {
      // Proceed to next level - pass score and lives too
      // IMPORTANT: Stop GameScene first before starting new level (it was paused in triggerVictory)
      this.scene.stop("GameScene");
      this.scene.stop("UIScene");
      this.scene.stop("TutorialUIScene");
      this.scene.stop("AbilityUnlockUIScene");
      
      // Preserve character type from registry
      const characterType = this.registry.get('characterType') || 'male';
      
      // Show story screen before next level
      const nextLevel = this.currentLevel + 1;
      if (nextLevel > LevelManager.TOTAL_LEVELS) {
        this.scene.start("GameCompleteUIScene", {
          totalDistance: this.totalDistance,
          enemiesDefeated: this.enemiesDefeated,
          score: this.score,
          levelsCompleted: LevelManager.TOTAL_LEVELS
        });
        return;
      }
      const storyKey = `level_${nextLevel}`;
      this.scene.start("StoryScene", {
        storyKey: storyKey,
        nextScene: "GameScene",
        nextSceneData: {
          level: nextLevel,
          totalDistance: this.totalDistance,
          enemiesDefeated: this.enemiesDefeated,
          score: this.score,
          lives: this.lives,
          characterType
        }
      });
    }
  }
}
