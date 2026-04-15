import Phaser from "phaser";
import { registerRuntimeScenes } from "./registerRuntimeScenes";

export class Preloader extends Phaser.Scene {

	constructor() {
		super("Preloader");
	}

	preload(): void {
		// Keep default cross-origin behavior; forcing anonymous CORS can break
		// remote audio playback on some iOS/WebKit + CDN combinations.
		
		// Load progress bar
		this.setupLoadingProgressUI(this);
		// Load core assets first (exclude heavy background music files for faster/lighter startup).
			this.load.pack('assetPack', 'assets/asset-pack-core.json');
			// Keep full pack metadata available for runtime URL lookups and music lazy fallback.
			this.load.json('assetPackFull', 'assets/asset-pack.json');
		this.load.on('loaderror', (file: any) => {
			const src = file?.src || file?.url || 'unknown-src';
			console.error(`[AssetLoadError] type=${file?.type || 'unknown'} key=${file?.key || 'unknown'} src=${src}`);
		});
	}

	async create(): Promise<void> {
		try {
			const audioKeys = this.cache.audio.getKeys();
			console.log(`[PreloaderAudio] loaded=${audioKeys.length}`);
		} catch {
			console.log("[PreloaderAudio] cache-audio-unavailable");
		}

		this.ensureTextureFallbacks();

		// Initialize online managers asynchronously so Supabase does not block boot or inflate initial JS.
		void this.initializeOnlineManagers();

		try {
			await registerRuntimeScenes(this.game);
		} catch (error) {
			console.error("[Preloader] Runtime scene registration failed", error);
		}

		const hasUberIntroScene = !!(this.scene as any)?.manager?.keys?.UberIntroScene;
		if (hasUberIntroScene) {
			this.scene.start("UberIntroScene");
			return;
		}

		console.error("[Preloader] UberIntroScene missing after runtime registration");
	}

	private async initializeOnlineManagers(): Promise<void> {
		try {
			const [
				{ LeaderboardManager },
				{ AuthManager },
				{ DailyChallengeManager },
				{ TournamentManager }
			] = await Promise.all([
				import("../managers/LeaderboardManager"),
				import("../managers/AuthManager"),
				import("../managers/DailyChallengeManager"),
				import("../managers/TournamentManager")
			]);

			await Promise.all([
				LeaderboardManager.initialize().catch(e => console.debug("Leaderboard init failed:", e)),
				AuthManager.initialize().catch(e => console.debug("Auth init failed:", e)),
				DailyChallengeManager.initialize().catch(e => console.debug("DailyChallenge init failed:", e)),
				TournamentManager.initialize().catch(e => console.debug("Tournament init failed:", e))
			]);
		} catch (error) {
			console.debug("[Preloader] Online manager import/init failed:", error);
		}
	}

	private ensureTextureFallbacks(): void {
		// iOS/WebKit may intermittently fail to decode or fetch some remote boss frames.
		// Alias missing keys to existing Kiia frames to keep gameplay functional.
		const fallbackPairs: Array<[string, string]> = [
			["peter_sync_idle_R_frame1", "kiia_boss_idle_R_frame1"],
			["peter_sync_idle_R_frame2", "kiia_boss_idle_R_frame2"],
			["peter_sync_glide_R_frame1", "kiia_boss_walk_R_frame1"],
			["peter_sync_glide_R_frame2", "kiia_boss_walk_R_frame2"],
			["peter_sync_jump_R_frame1", "kiia_boss_walk_R_frame1"],
			["peter_sync_jump_R_frame2", "kiia_boss_walk_R_frame2"],
			["peter_sync_spin_attack_R_frame1", "kiia_boss_attack_R_frame1"],
			["peter_sync_spin_attack_R_frame2", "kiia_boss_attack_R_frame2"],
			["peter_sync_taunt_R_frame1", "kiia_boss_taunt_R_frame1"],
			["peter_sync_taunt_R_frame2", "kiia_boss_taunt_R_frame2"],
			["peter_sync_dash_R_frame1", "kiia_boss_dash_R_frame1"],
			["peter_sync_dash_R_frame2", "kiia_boss_dash_R_frame2"],
			["peter_sync_die_R_frame1", "kiia_boss_die_R_frame1"],
			["peter_sync_die_R_frame2", "kiia_boss_die_R_frame2"]
		];

		for (const [targetKey, fallbackKey] of fallbackPairs) {
			if (this.textures.exists(targetKey) || !this.textures.exists(fallbackKey)) continue;
			const fallbackTexture = this.textures.get(fallbackKey);
			const fallbackSource = fallbackTexture?.getSourceImage();
			if (!fallbackSource) continue;

			if (fallbackSource instanceof HTMLCanvasElement) {
				this.textures.addCanvas(targetKey, fallbackSource);
			} else {
				this.textures.addImage(targetKey, fallbackSource as HTMLImageElement);
			}
			console.debug(`[Preloader] Missing texture "${targetKey}", aliased to "${fallbackKey}"`);
		}
	}

	private setupLoadingProgressUI(scene: Phaser.Scene): void {
		const cam = scene.cameras.main;
		const width = cam.width;
		const height = cam.height;
		const loadingTips = [
		  "Fakta: tämä peli ei sisällä yhtään kiireetöntä hetkeä.",
		  "Vinkki: jos paniikki nousee, paina silti eteenpäin.",
		  "Muistutus: kahvi ei korvaa jarrutusta.",
		  "Säävaroitus: paikallista draamaa ladulla.",
		  "Päivän mantra: rauha, rytmi, raivo tarvittaessa."
		];
	  
		const barWidth = Math.floor(width * 0.6);
		const barHeight = 20;
		const x = Math.floor((width - barWidth) / 2);
		const y = Math.floor(height * 0.5);
	  
		const progressBox = scene.add.graphics();
		progressBox.fillStyle(0x222222, 0.8);
		progressBox.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);
	  
		const progressBar = scene.add.graphics();
	  
		const loadingText = scene.add.text(width / 2, y - 20, 'Loading...', {
		  fontSize: '20px',
		  color: '#ffffff',
		  stroke: '#000000',
		  strokeThickness: 3,
		}).setOrigin(0.5, 0.5);

		const tipText = scene.add.text(width / 2, y + 42, loadingTips[0], {
		  fontSize: '12px',
		  color: '#9fd7ff',
		  stroke: '#000000',
		  strokeThickness: 2,
		  align: 'center',
		  wordWrap: { width: barWidth + 40 }
		}).setOrigin(0.5, 0.5);

		let tipIndex = 0;
		const tipTimer = scene.time.addEvent({
		  delay: 1600,
		  loop: true,
		  callback: () => {
		    tipIndex = (tipIndex + 1) % loadingTips.length;
		    tipText.setText(loadingTips[tipIndex]);
		  }
		});
	  
		const onProgress = (value: number): void => {
		  progressBar.clear();
		  progressBar.fillStyle(0xffffff, 1);
		  progressBar.fillRect(x, y, barWidth * value, barHeight);
		};
		
		const onComplete = (): void => {
		  cleanup();
		};
	  
		scene.load.on('progress', onProgress);
		scene.load.once('complete', onComplete);
	  
		const cleanup = (): void => {
		  scene.load.off('progress', onProgress);
		  tipTimer.destroy();
		  progressBar.destroy();
		  progressBox.destroy();
		  loadingText.destroy();
		  tipText.destroy();
		};
	}
}
