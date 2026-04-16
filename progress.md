Original prompt: Haluaisin tehdä boss fighteista monivaiheisempia, dramaattisempia, enemmän bosseilta superiskuja. Kullekkin bossille pitäisi tehdä lisää hyökkäyksiä, pystytkö generoimaan lisää spritejä nykyisten hahmojen pohjalta? Näille hyökkäyksille olisi hyvä saada myös nimet, jotka sopivat kysyiselle bossille/hahmolle . Sen lisäksi pelaajalle haluisin tuoda parempia hyökkäksiä korkeammilla leveleillä esim. pitää 1,5s kirves nappia pohjassa, niin pelaaja hyökkää koko ruudun mitan kirveellä eteenpäin (superdash). Samanlainen volttinapille, kun pelaaja pitää pohjassa niin pelaaja pyörii supernopeasti tornadon tapaan. Sekä supersauva hyökkäys, kun nappia pitää pohjassa niin pelaaja huitoo raivoisasti ympärilleen 2s ajan. Onko näissä järkeä ja onnistuuko teknisesti?

TODO
- Add hold-to-charge super attacks for axe/voltti/pole at high levels.
- Add boss attack variety (new attack states + phase patterns) and boss-specific attack names.
- Wire dramatic telegraphs/announcements for boss attacks.
- Run tests/build and verify no regressions.
- Attempt sprite generation via imagegen if OPENAI_API_KEY is available; otherwise document blocker.

Notes
- Project target: /Users/mikkoantikainen/Documents/New project/latu2_ios_ready
- OPENAI_API_KEY is currently not set in environment.

Update 2026-02-13
- Implemented hold-to-charge player supers:
  - Axe hold (1.5s) -> `superDashAxeAttacking` with full-width forward hitbox.
  - Voltti hold -> `tornadoSpinning` (2s sustained multi-hit).
  - Pole hold -> `superPoleFrenzy` (2s sustained multi-hit).
- Added new unlock progression + notifications:
  - Level 7: superDashAxe
  - Level 8: tornadoVoltti
  - Level 9: superPole
- Added charged-input tracking in `Player` and reliable melee trigger profile overrides.
- Added boss combat expansion:
  - New attack states: `leapSlamming`, `barrageAttacking`.
  - Expanded per-phase attack patterns to include new attacks.
  - Added per-boss attack names and telegraph text via `bossAttackTelegraph` events.
  - Charge attack now actually applies damage on contact.
- Validation:
  - `npm run build` passes.
  - `npm run test` fails in existing headless Phaser path (`blendModes` null in `ensureJumpRampTextures`), unrelated to these gameplay changes.
- Image generation status:
  - `python3 $IMAGE_GEN ... --dry-run` works.
  - Live generation blocked because `OPENAI_API_KEY` is not set in environment.

TODO (next)
- Generate real boss/player super attack sprite variants after OPENAI_API_KEY is available.
- Integrate generated sprite files into `public/assets/asset-pack.json` and `public/assets/animations.json`.
- Tried to run develop-web-game Playwright loop, but local environment lacks `playwright` package for the skill client; skipped visual automation run in this turn.

Image generation update (after OPENAI_API_KEY setup)
- Installed Python `openai` SDK and ran real image generation batches.
- Main batch (27 prompts) produced 19 images; 8 jobs failed due moderation/rate limits.
- Retry batch (8 prompts, concurrency=1) completed remaining assets.
- Final result: 27 generated sprite images in `output/imagegen/`.
- Adjusted one blocked prompt to fictional/non-identifiable football legend wording.

Update 2026-02-14
- Consolidated active game workspace to a single project folder:
  - Kept: `/Users/mikkoantikainen/Documents/New project/latu2_ios_ready`
  - Removed duplicate game copies: `laturaivo_ios_check`, `laturaivo_ios_check_clean`, `laturaivo_ios_check_regen`
- Verified boss sprite integrity across all current bosses in `latu2_ios_ready`:
  - Checked `public/assets/animations.json` boss animations against `public/assets/asset-pack.json`
  - Result: no missing frame keys and no missing local files
- Rebuilt and synced iOS web assets from this same folder:
  - `npm run build`
  - Node 22 Capacitor sync to `ios/App/App/public`
- Re-verified same boss sprite integrity in `ios/App/App/public/assets` after sync:
  - Result: no missing frame keys and no missing local files
- 2026-02-14: Enabled `CapacitorBridgeEvalGuard.install()` for all build configs in `/ios/App/App/AppDelegate.swift` (not DEBUG-only) so `JS Eval error` lines include full context in runtime logs. Verified iOS simulator build succeeds.
- 2026-02-14: Enemy/main-character line pass:
  - Added large `ENEMY_TAUNTS_EXTRA`, `ENEMY_ATTACK_TAUNTS_EXTRA`, and `ENEMY_HURT_TAUNTS_EXTRA` pools (+Turku extra pool) and wired combined pools in `Enemy.ts`.
  - Increased enemy chatter throughput: enemy taunt cooldown 4000ms -> 2200ms; GameScene taunt pacing multiplier 1.5x -> 3x baseline; budget 1.125 -> 2.25 and cap 3.75 -> 7.5.
  - Fixed missing player lines by forcing `PLAYER_SHOUTS` texts through `showFloatingText(..., { force: true })` so they display even when flavor-text filtering is active.
  - Added rage-activation player shout + expanded `PLAYER_SHOUTS` variety in `HumorPack.ts`.
  - Validation: `npm run build` OK; `cap sync ios` OK.
- 2026-02-14: Månika boss overhaul
  - Wired all available Månika sprite frames from `public/assets/custom/monika` into asset packs (29 `karen_boss_*` keys) and added dedicated animations: charge/combo/leap/barrage/special/hurt/die/enrage/taunt.
  - Updated Boss FSM to actually use these animations in corresponding states (charge/combo/leap/barrage/hurt/dying).
  - Increased Månika aggression/diversity with boss-specific speed/cooldown/pattern tuning while keeping bounded multipliers.
  - Updated Månika taunts/attack names to “lasten suojelu juopoilta / äitienergia” theme.
  - Added UI warning mapping from `bossAttackTelegraph` for non-normal attacks, including explicit super warning (`ERIKOIS: ...`) before special attacks.
  - Validation: `npm run build` OK, `cap sync ios` OK, no missing boss animation keys/files in both web and iOS public assets.
- 2026-02-14: UI consistency + level 9 regression hardening
  - Removed legacy HUD widgets globally from `UIScene` so no level can show old indicators:
    - removed axe charge HUD (`axe-power-container` / `axe-power-indicator`),
    - removed compact voltti counter row (`trick-counter`),
    - removed dormant voltti charge DOM (`voltti-charge-indicator`) and related update logic.
  - Kept touch ability buttons themselves (controls remain), but removed old “ready/charges” overlays.
- Level 9 reliability updates:

Update 2026-03-13
- Fixed tutorial pause-menu input blocking in `/src/scenes/TutorialUIScene.ts` and `/src/scenes/UIScene.ts`.
- Root cause: the TutorialUIScene Phaser DOM wrapper stayed full-screen with pointer input enabled even when the inner tutorial overlay was hidden, which blocked pause-menu taps.
- Fix:
  - force the tutorial DOM wrapper itself to `pointerEvents = "none"`,
  - hide the whole tutorial DOM element while pause is open,
  - explicitly sync tutorial pause presentation from `UIScene` before pausing/resuming the tutorial scene.
- Validation:
  - `npm run build` OK.
  - Mobile-style Playwright regression passed via `.tmp_tutorial_pause_menu_check.mjs`:
    - tutorial pause opens,
    - `TEESKENTELE...` closes pause overlay,
    - `PÄÄVALIKKO` returns to title screen.
    - `GameScene.getMusicKeyForLevel(9)` now uses `ice_club_arena_theme`.
    - Added level-aware background fallback chain for level 9 before generic forest fallback.
    - Added `ice_club_arena_theme` to iOS background music key set and stop-lists in victory/game over/game complete scenes.
  - Validation:
    - `npm run build` OK.
    - `cap sync ios` OK (web assets copied to `ios/App/App/public`).
    - Source/diff checks confirm old HUD IDs/strings removed from active source.
  - develop-web-game skill check:
    - Tried running Playwright client from skill.
    - Blocked because `playwright` package is missing and network is restricted (`npm install -D playwright` failed with `ENOTFOUND registry.npmjs.org`).
- 2026-02-14 hotfix: level 9 startup crash fixed.
  - Root cause: lingering `compactTrickRow` variable reference in `UIScene.applyTouchUILayout()` after removing trick row element.
  - Fix: removed the stale reference line.
  - Validation: `npm run build` OK, `cap sync ios` OK.
- 2026-02-14 startup black-screen mitigation (iOS):
  - Forced Phaser renderer to Canvas on iOS (`phaserRendererType = isIOS ? Phaser.CANVAS : Phaser.AUTO`) in `src/main.ts`.
  - Rationale: avoid intermittent iOS/WebKit WebGL device-context startup failures causing black screen.
  - Validation: `npm run build` OK, `cap sync ios` OK.
- 2026-02-14 crash guard + asset path hardening:
  - Added `utils.safeAddSound(...)` and migrated startup-critical audio initializers (Player, Enemy, Boss, Tesla, TunedCar) to prevent hard crash when cache key is missing.
  - Hardened GameScene weather `wind_howl` setup to optional-play when sound is unavailable.
  - Changed Preloader pack paths to absolute iOS-safe URLs:
    - `/assets/asset-pack-core.json`
    - `/assets/asset-pack.json`
  - Added candidate URL fallback fetch for title/game audio fallback pack lookups:
    - `/assets/asset-pack.json`, `assets/asset-pack.json`, `./assets/asset-pack.json`
  - Validation: `npm run build` OK, `cap sync ios` OK, iOS public bundle updated to `index-CJhmDKRH.js`.

Update 2026-02-17
- Boss intro card portrait pilot (level 2 only):
  - Added `boss-intro-portrait` image slot to `UIScene` boss intro card layout.
  - Added logic in `showBossIntroCard(...)` to show portrait only on level 2 (Månika):
    - `assets/custom/monika/karen_boss_idle_R_frame1.png`
  - Non-level-2 behavior:
    - portrait is hidden and `src` is cleared so other boss cards remain unchanged.
- Validation:
  - `npm run build` OK.
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` OK.
  - develop-web-game visual automation still blocked locally because `playwright` package is missing for skill client.

Update 2026-02-17 (iOS black-screen startup fix)
- Investigated Xcode runtime error:
  - `Unknown class _TtC3App14ViewController in Interface Builder file.`
- Root cause:
  - `ios/App/App/Base.lproj/Main.storyboard` hardcoded `customModule="App"` for `ViewController`.
  - Workspace currently contains both `App.xcodeproj` and `Laturaivo.xcodeproj`; when launching with `Laturaivo` target, hardcoded module `App` fails.
- Fix applied:
  - Changed storyboard VC binding to target-resolved module:
    - `customClass="ViewController" customModuleProvider="target"`
  - File: `ios/App/App/Base.lproj/Main.storyboard`
- Validation:
  - `xcodebuild` (simulator, no-sign) passed for both:
    - `ios/App/App.xcodeproj` scheme `App`
    - `ios/App/Laturaivo.xcodeproj` scheme `Laturaivo`
  - `cap sync ios` OK.

Update 2026-02-17 (boss phase/attack variety pass)
- Problem targeted:
  - Bosses could appear to spam the same few attacks/sprites and not clearly escalate by phase.
- Boss attack selection overhaul in `src/entities/Boss.ts`:
  - Added per-phase shuffled attack decks + anti-repeat selection to avoid back-to-back same attack loops.
  - Added phase opener queue to force visible escalation after phase transitions:
    - phase 2 opens with `charge`/`combo`
    - phase 3 opens with `leap`/`barrage`
  - Rebalanced base and boss-specific phase attack patterns so phase 1 is mostly normal pressure and phase 2/3 introduce dangerous specials.
  - Added explicit phase danger telegraph emission (`bossAttackTelegraph` with phase callout) on phase transition.
- Boss FSM robustness in `src/entities/BossFSM.ts`:
  - Added fallback timeout completion for normal attacks if `animationcomplete-*` is missed.
  - Added fallback timeout progression for combo hits if `animationcomplete-*` is missed.
  - Goal: prevent getting stuck in one attack state forever.
- Validation:
  - `npm run build` OK.
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` OK.

Update 2026-02-17 (all boss fights incl. PeterSync)
- Applied same anti-repeat/phase-opener model to `PeterSync` (level 9 boss path):
  - Added per-phase shuffled attack deck, anti-repeat selection, and phase-2 opener queue (`dash` + `jump`) in `src/entities/PeterSync.ts`.
  - Updated `PeterSyncFSM.chooseNextAction()` close-range branch to respect pattern-derived action instead of always forcing spin.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-17 (Level 6 boss: TERO AFTERWORK full sprite integration)
- Added complete Level 6 Tero sprite set (44 PNG files) into:
  - `public/assets/custom/level6/tero_afterwork/`
- Wired assets into both packfiles:
  - `public/assets/asset-pack.json`
  - `public/assets/asset-pack-core.json`
  - new block: `level6_tero_afterwork`
- Added 19 new animations in `public/assets/animations.json`:
  - all boss states: idle/walk/intro/attack/charge/combo/briefcase_slam/leap/barrage/shuriken_attack/special/hurt/die/enrage/taunt
  - VFX: briefcase burst, shuriken, charge skid, shuriken trail
- Gameplay wiring:
  - Added new boss type `tero_afterwork` in `src/entities/Boss.ts` (taunts, hurt/enrage lines, attack names, idle frame map, animation map, phase tuning, special attack).
  - Added Tero special attack method with briefcase burst + shuriken volley.
  - Added Tero-specific animation variability in `src/entities/BossFSM.ts`:
    - normal attack may use combo animation variant
    - combo alternates between combo and briefcase slam
    - barrage alternates between shuriken attack and barrage animation
    - charge can spawn skid VFX
    - barrage projectile visuals use shuriken + trail VFX
  - Added level 6 boss config in `src/LevelManager.ts`:
    - boss type/name: `TERO AFTERWORK`
  - Added level 6 naming update (`Afterwork-Kaaos: TERO AFTERWORK`) in `LevelManager`.
  - Added boss defeat lines for `tero_afterwork` in `src/scenes/GameScene.ts`.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - `xcodebuild` (Laturaivo scheme, simulator no-sign) `BUILD SUCCEEDED`.
  - Sanity check: level6 frame references in animations map 1:1 to pack keys (0 missing).

Update 2026-02-17 (Level 4 boss refresh: Lahtelainen Räppäri CHIKI)
- Synced latest Level 4 CHIKI sprite files (33 PNG) into:
  - `public/assets/custom/lahti/chiki/`
- Boss behavior updates in `src/entities/Boss.ts`:
  - Re-themed `jari_litmanen` (internal id kept for compatibility) to CHIKI flavor:
    - taunts, hurt/enrage lines, attack names.
  - Added Level 4 tuning for faster, more varied pressure:
    - speed/cooldown/special cooldown/phase thresholds/attack patterns adjusted.
  - Updated animation map for full sprite coverage:
    - idle/walk/intro/attack/kick/charge/combo/leap/barrage/special/hurt/enrage/taunt/die.
  - Replaced Litmanen special with CHIKI bass-drop shockwave (`performLitmanenSpecialAttack`) using special sprite + wave pulses.
  - Added intro taunt animation support for Level 4 (`litmanen_boss_intro_anim`).
- Boss FSM updates in `src/entities/BossFSM.ts`:
  - Removed old forced football-kick-only normal attack path for Level 4.
  - Added Level 4 animation variants so attacks use more sprite states:

Update 2026-04-11 (campaign save system)
- Added lightweight local campaign save in `src/utils.ts`:
  - stores highest unlocked campaign level, player name, character type, difficulty, and timestamp in localStorage.
  - save updates on `GameScene.triggerVictory()` when a level is completed.
- Added `JATKA TASOLTA X` panel to `NameInputScene` when a save exists.
- Game over restart now uses the latest saved unlocked level instead of always returning to level 1/2.
- Intended scope: checkpoint between levels only, not mid-fight realtime state.
- TODO: visual/manual test the mobile UI flow after iOS build: new run -> complete level -> quit/reopen -> continue button -> correct level.

Update 2026-03-30
- Added persistent extra menu unlock for completed Lahti campaign runs:
  - New localStorage helper keys/functions in `src/utils.ts`
  - `GameCompleteUIScene` now unlocks extra level select after a clean full Lahti campaign clear
- Expanded `src/scenes/NameInputScene.ts` with an extra replay panel that appears only after the unlock:
  - lists all levels 1-10 for replay
  - includes a reset button for normal campaign start
  - keeps difficulty selection below the extra panel
  - updates the start button label based on selected replay level
- Updated start flow in `NameInputScene`:
  - selected replay level now starts directly from that level
  - normal campaign start still uses the existing tutorial/intro bridge flow
  - cheat-name direct boss access still overrides manual replay selection
- Validation:
  - `esbuild` bundle check passed for `src/scenes/NameInputScene.ts`, `src/scenes/GameCompleteUIScene.ts`, and `src/utils.ts`
  - Full `npm run build`, `npm run dev`, and broad `tsc` checks stalled in this environment without emitting an actual error, so no end-to-end browser pass was completed in this turn

TODO (next)
- Run a full visual smoke test of the extra menu once local Vite startup/build is responsive again.
- Verify mobile wrapping/scroll feel of the new level grid on a small viewport.

Update 2026-03-18
- Name input screen safe-area polish for iPhone Dynamic Island:
  - Moved the newspaper headline rails and main name-entry content lower on mobile in `src/scenes/NameInputScene.ts`.
  - Increased top padding for the container/content stack on narrow screens and lowered headline rail `top` offsets so nothing important hugs the notch/island area.
  - Pending validation: build + visual check of the "ANNA NIMESI" screen on a mobile-sized viewport.
    - normal: attack/kick variants
    - combo: combo/kick variants
    - barrage: barrage/special variants
- UI/text consistency updates:
  - `src/LevelManager.ts`: Level 4 boss card now shows `CHIKI`.
  - `src/scenes/StoryScene.ts`: level 4 story text updated to CHIKI wording.
  - `src/scenes/GameScene.ts`: Level 4 boss defeat lines updated.
  - `src/utils.ts`: `boss_jari_litmanen` death quotes re-themed for CHIKI.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - Sanity check: all `litmanen_boss_*` animation frames resolve in both pack files and files exist on disk (0 missing).

Update 2026-02-17 (Boss special-attack reliability + aggression pass)
- Problem targeted:
  - Special-attack warning could appear while bosses still felt too normal-attack heavy.
  - Players reported bosses not consistently executing specials when expected.
- `src/entities/Boss.ts`:
  - Reworked special usage from one-time enrage-only to repeatable cooldown model:
    - added special readiness window (`nextSpecialAttackAt`)
    - added cooldown scheduler with jitter to avoid robotic timing
    - `performSpecialAttack(source)` now returns boolean and only emits telegraph when special actually commits.
  - Added fallback enrage retry (short delayed retry) so enrage special is less likely to be skipped.
  - Added reduced damage multiplier for non-enrage repeated specials (`specialDamageScaleMultiplier`) to keep fights fair despite higher special frequency.
  - Updated phase openers and patterns to be more aggressive and varied:
    - phase 3 opener now includes `special`
    - phase 2/3 patterns heavily favor combo/charge/barrage/leap/special and remove normal spam.
  - Added logic in `getNextAttackType()` to:
    - convert lingering `normal` picks in later phases into aggressive alternatives
    - replace `special` with aggressive fallback if special is on cooldown.
  - Adjusted per-boss special cooldown tuning:
    - baseline bosses: 3600ms (final 4200ms)
    - Månika 2800ms, CHIKI 2700ms, Tero 2600ms, PASI 2400ms.
- `src/entities/BossFSM.ts`:
  - Added explicit `specialAttacking` state.
  - Added `special` branch in `executeAttack()`.
  - If special is temporarily unavailable, falls back immediately to combo/barrage instead of idling.
- `src/scenes/UIScene.ts`:
  - Added explicit handling for `bossAttackTelegraph.kind === "phase"` to show phase-change warning text,
    reducing confusion with true super/special telegraphs.
- `src/entities/PeterSync.ts`:
  - Increased boss pressure/variety:
    - reduced base attack cooldown (1800 -> 1500)
    - phase patterns now emphasize spin/dash/jump chaining over passive glide/taunt downtime
    - phase opener now includes spin in addition to dash/jump.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - Playwright smoke run attempted via `develop-web-game` skill client but blocked by network (`ENOTFOUND registry.npmjs.org`) in this sandbox session.

Update 2026-02-17 (Full drama/aggression pass for boss fights, excluding music-layer change)
- Implemented broad boss combat upgrade set aligned with the 30-point direction (all except music layering #9):
  - Added new boss attack types into core boss loop:
    - `fakeout` (interruptable feint punish)
    - `hazard` (area-denial zones for anti-camp pressure)
    - `special` integrated as repeatable cooldown action (not only one-time enrage trigger)
  - Added `specialAttacking`, `fakeoutAttacking`, and `hazardAttacking` states in `src/entities/BossFSM.ts`.
  - Added attack cooldown jitter + per-state fail-safe recovery + anti-camp trigger in `BossFSM`.
  - Added contextual attack taunts and impact warning cues (~200ms pre-hit) in `Boss.ts`/`BossFSM.ts`.
- Boss progression and readability:
  - Added segmented boss HP markers (phase thresholds + finisher marker) in health bar.
  - Added phase shield objective at phase 2 (`SUOJA` requiring hit-count to break).
  - Added explicit finisher mode at <=10% HP (phase 4 event + aggression boost + last-attempt opener queue).
  - Added low-HP heartbeat pulse event from boss to UI warning channel.
- Rage/super systems:
  - Added rage meter behavior for bosses from incoming damage:
    - when full, queues a special attack opportunity.
  - Added repeatable special cooldown scheduling with jitter and gating.
  - Added reduced damage scaling for repeated pattern specials to keep fairness.
  - Kept enrage special as strongest version.
- UI/telegraph improvements:
  - Added explicit `phase` warning handling in UI.
  - Standardized AOE/hazard warnings to blue channel.
  - Added dynamic warning duration assist based on consecutive deaths.
- Arena risk/reward pickup (boss fights):
  - Added a boss-fight-only orb that gives immediate heal/chip damage reward and temporary increased incoming damage risk.
  - Implemented in `src/scenes/GameScene.ts` + player damage multiplier hook in `src/entities/Player.ts`.
- PeterSync parity pass:
  - Increased aggression (cooldown + pattern pressure) and added pattern-usable signature `DISCO INFERNO` special with cooldown gating.
  - Added `discoSpecial` state in `src/entities/PeterSyncFSM.ts`.
- Telemetry:
  - Added lightweight boss combat telemetry capture in `GameScene` for:
    - player death in boss fight
    - boss defeat
    - includes level/boss/phase/last telegraphed attack and timestamp
  - Stores rolling entries to `localStorage` key `laturaivo_boss_telemetry`.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - `npx tsc --noEmit` still reports an existing unrelated type error at `src/scenes/GameScene.ts:2589` (`add` property in options type).
Update 2026-02-17 (2s super attacks energy balance)
- Balance fix for overpowered 2s supers in `src/entities/PlayerFSM.ts`:
  - `tornadoSpinning` now consumes full energy on start (`energy = 0`) and keeps energy at 0 during the full 2s state.
  - `superPoleFrenzy` now consumes full energy on start (`energy = 0`) and keeps energy at 0 during the full 2s state.
- Purpose:
  - prevent energy-regen abuse during sustained supers
  - enforce high-commitment risk/reward for 2s super abilities
- Validation:
  - `npm run build` OK after cleaning stale `dist` (`ENOTEMPTY` occurred once from Vite outDir cleanup).
- develop-web-game skill automation attempt:
  - Playwright client run is still blocked in this environment: `playwright` package not installed and network is restricted (`ENOTFOUND registry.npmjs.org` for `npx -y node@22 ...`).
Update 2026-02-17 (non-boss gameplay overhaul: FPS-safe feature batch)
- Implemented selected normal gameplay systems in `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, and `src/scenes/VictoryUIScene.ts`:
  - Combo meter HUD (visible burst window + decay fill) in UI.
  - Micro-objective system (one active objective per run start, timed progress + reward/fail state).
  - Cursed powerup behavior (marked pickups, on-collect curse state with energy drain + increased incoming damage for 9s).
  - Weapon mastery loop (pole/axe/voltti XP from attacks, temporary mastery damage buffs, telegraphed rank-ups).
  - Style rank system (D/C/B/A/S score with decay, gain/loss hooks from kills/tricks/hits, HUD rank chip).
  - Static route choices at run start (Turvalinja/Kaaoslinja/Tarkkuuslinja) affecting enemy/hazard/powerup pressure and score multiplier.
  - Clear non-boss gameplay telegraphs (vehicle/hazard/chihuahua/cursed/micro-objective/mutator notices).
  - Daily mutator (deterministic by date+level, rule-only multipliers: pressure/score/regen/speed).
  - Level grade + bonus score at victory and detailed display in victory UI.
  - Before-level passive selection (interactive pre-run loadout overlay in UIScene) with auto-pick fallback.
- Data flow:
  - GameScene emits `preRunLoadoutPrompt`, `preRunLoadoutResolved`, and `gameplayTelegraph`.
  - UIScene renders loadout overlay and sends `preRunLoadoutSelected` back to GameScene.
  - VictoryUIScene now receives and displays `levelGrade`, `levelGradeScore`, `levelBonusScore`, `stylePeak`, objective result, and selected route/passive/mutator labels.
- Build validation:
  - `npm run build` OK (vite build successful).
- develop-web-game visual automation remains blocked in this environment (Playwright package/network limitation from earlier notes).
Update 2026-02-17 (fine-tuning pass for non-boss systems)
- Applied balancing adjustments in `src/scenes/GameScene.ts` for the selected normal gameplay systems:
  - Style rank: smoother decay (`900ms` / `-2`) and adjusted thresholds (`C24/B52/A90/S132`).
  - Route choices: reduced spread between safe/chaos/precision so all remain viable without extreme spawn pressure swings.
  - Passive choices: toned down strongest passives (`battery_saver`, `combo_rush`, `stomp_engine`, `lucky_star`) and slightly normalized `thick_skin`.
  - Daily mutators: softened extreme pressure/regen deltas (`Kirpeä Keli`, `Kisapäivä`, `Huoltopäivä`).
  - Micro-objectives: tuned targets/timers/rewards to be more consistent; adjusted style gain on success and penalty on fail.
  - Cursed powerup: shifted to cleaner risk/reward (`8.5s`, lower drain/damage multiplier, higher score reward), fixed typo `KIRTOUS` -> `KIROUS`.
  - Weapon mastery: slower level ramp, slightly lower damage multiplier per level, better super attack XP reward.
  - Telegraph readability: increased default telegraph duration + key hazard/vehicle warning durations.
  - Level grade/bonus: tightened grade thresholds and increased high-grade bonus payout to reward cleaner runs.
  - Score multiplier: style bonus now starts at 0% on rank D and scales upward by rank.
- Validation:
  - `npm run build` OK.
- develop-web-game Playwright loop:
  - Tried to run `$WEB_GAME_CLIENT` against local dev server (`http://127.0.0.1:4173`).
  - Blocked by sandbox network/package constraints:
    - `npx -y node@22 ...` failed with `ENOTFOUND registry.npmjs.org`.
    - local Node fallback failed because `playwright` package is not installed in the environment.
Update 2026-02-17 (boss-fight accidental menu-return guard + ring UX)
- Fixed likely accidental return-to-main-menu flow in pause overlay (`src/scenes/UIScene.ts`):
  - `pause-main-menu-btn` now requires a second confirmation tap within ~1.4s.
  - Added prompt text state toggle (`PÄÄVALIKKO` -> `NAPAUTA UUDESTA (VARMISTA)`).
  - Added confirmation reset on resume/unpause, fake-reply action, shutdown, and actual menu transition.
  - Added pause-overlay background click-to-resume behavior (tap outside buttons resumes if paused).
- Improved boss risk orb clarity/placement (`src/scenes/GameScene.ts`):
  - Orb no longer spawns in center HUD zone (avoids overlap/confusion with touch controls).
  - Orb spawn moved higher (`groundY - 120` instead of `groundY - 70`).
  - Pickup announcement changed to explicit instruction: `RISKIPICKUP: AJA RENGAS LÄPI!`.
- Validation:
  - `npm run build` OK.
Update 2026-02-17 (requested gameplay fixes: Lahti spawn stall, boss camera drift, unlock pacing, level 9 stability, name-input keyboard)
- `src/scenes/GameScene.ts`
  - Fixed boss-fight spawn freeze risk by changing boss spawn flow:
    - boss/world spawners are now stopped only after a boss is successfully created.
    - added `stopSpawnersForBossFight()` helper.
    - added `recoverFromBossSpawnFailure()` fallback to avoid dead-air states when boss spawn fails.
  - Added boss runtime crash fallback in update loop:
    - if boss update throws, level completes cleanly on boss levels instead of getting stuck.
  - Camera cinematic stability:
    - locked dramatic camera vertical scroll during focus/finisher/death sequences to prevent ground/background vertical drift artifacts.
  - Level 7 art tweak:
    - doubled Turku funicular decoration size (`maxHeight 120 -> 240`).
  - Level 9 robustness:
    - wrapped PeterSync disco FX init in try/catch and disabled heavy disco lighting on mobile/emergency FPS to reduce crash risk.
- `src/entities/Player.ts`
  - 2s super unlocks moved earlier:
    - `tornadoVolttiUnlockLevel = 5`
    - `superPoleUnlockLevel = 5`
- `src/scenes/GameScene.ts`
  - Ability unlock notifier synced to new unlock levels (`tornado/superPole` at level 5).
- `src/entities/PlayerFSM.ts`
  - Verified 2s supers already force full energy drain (`tornadoSpinning` + `superPoleFrenzy` set energy to 0 on enter and throughout state).
- `src/scenes/NameInputScene.ts`
  - Removed automatic input focus on scene open (keyboard no longer pops by default).
  - Added helper text under input: "Napauta kenttää kirjoittaaksesi...".
- Validation:
  - `npm run build` OK.
Update 2026-02-17 (perusvihut less static without new sprites)
- Implemented regular-enemy combat variety without adding any sprite assets:
  - `src/entities/Enemy.ts`
    - added dynamic melee trigger profile support:
      - `attackTriggerRange` / `attackTriggerWidth`
      - `setAttackTriggerProfile(...)` + `resetAttackTriggerProfile()`
    - enemy update now uses per-state trigger dimensions instead of fixed `80x60`.
  - `src/entities/EnemyFSM.ts`
    - added weighted close-range attack selection with lower normal-attack share.
    - added new movement/attack states using existing animations:
      - `lunge_attacking` (forward burst attack)
      - `jump_attacking` (aerial-style attack using y-tween + forward burst)
      - `feint_attacking` (fake step + delayed commit)
      - `hop_moving` (short evasive hop/reposition between engages)
    - added slight chase-speed modulation to reduce robotic linear movement.
    - added state-timer tracking/cleanup + attack-cooldown scheduler to avoid stale callbacks.
    - kept everything sprite-compatible by reusing `enemy_ski_walk_anim` and `enemy_attack_anim`.
- Validation:
  - `npm run build` OK.
- develop-web-game Playwright loop:
  - attempted run against `http://127.0.0.1:4173`.
  - blocked by network/package constraints in sandbox:
    - `npx -y node@22 ...` failed with `ENOTFOUND registry.npmjs.org`.
Update 2026-02-17 (UI cleanup + boss aggression + spawn/energy tuning)
- Implemented requested gameplay/UI refinements:
  - Removed touch-control advice section from home/name screen (`NameInputScene`) and changed title start prompt text to neutral (`TitleScreen`: `▶ ALOITA PELI ◀`).
  - Bonus objective HUD now auto-hides after objective resolves:
    - `GameScene.refreshMicroObjectiveHud()` clears text/progress when objective is completed/failed.
    - `UIScene` now hides `micro-objective-hud` when objective text is empty.
  - Removed style evaluation from active gameplay presentation and scoring impact:
    - `UIScene`: removed style HUD chip and update logic.
    - `VictoryUIScene`: removed “Paras style” row.
    - `GameScene`: style points/decay made inert, run score multiplier no longer includes style multiplier, level-grade computation no longer includes style component.
  - Removed pre-level passive selection flow from gameplay start:
    - `GameScene.requestPreRunLoadoutSelection()` now routes to `applyDefaultRunSetup()` (neutral defaults, no selection UI).
    - Daily mutator still applies automatically and telegraph is shown.
    - `UIScene` no longer binds pre-run loadout prompt/resolved event handlers.
  - Boss behavior/aggression improvements:
    - Fixed boss vertical lock bug in `Boss.update()` so non-jeti bosses can execute leap/special tween motion.
    - Increased Månika aggression and special cadence (higher speed, lower cooldowns, stronger phase patterns).
    - Reduced normal-attack spam globally by converting many phase-1 normals into aggressive/special actions.
  - Level 4 enemy density tuning:
    - `LevelManager` level 4 `spawnInterval` changed `1100 -> 900`.
    - `GameScene.spawnRandomEnemy()` now applies level-4 spawn pressure boost, lower dynamic-difficulty skip chance, and lighter quality throttling on level 4.
  - Player energy loop tuning for boss fights:
    - Added `grantPoleHitEnergy(...)` in `GameScene`.
    - Successful basic pole hits now restore energy (extra gain when hitting boss targets) to bring axe/voltti online faster.

Validation
- `npm run build` passed.

develop-web-game skill validation note
- Attempted to run the Playwright client script.
- `node` (v20) failed due ESM module mode mismatch for the skill script.
- Retried via `npx -y node@22 ...`; command did not produce usable output in this restricted environment, so visual Playwright run could not be completed in this turn.

TODO (next)
- In-device playtest focus:
  - Verify Månika now visibly performs leap/special patterns across phase changes.
  - Confirm level 4 spawn pacing feels denser but stable.
  - Fine-tune `grantPoleHitEnergy` amount if axe/voltti uptime is still too low/high in boss fights.
- If Playwright/runtime env is available, run the develop-web-game scripted visual loop and capture screenshots/text-state artifacts.
- Follow-up tweak:
  - `UIScene` objective HUD default state is now hidden in template (`display: none`) with empty initial text/progress to prevent a startup flash.
- Re-validation:
  - `npm run build` passed after this tweak.
Update 2026-02-17 (warning size + all boss intro portraits)
- Requested polish implemented:
  - Boss danger/telegraph warning popups are now ~50% smaller via centralized UI scale constants in `UIScene`:
    - `dangerWarningScale=0.5`, `dangerWarningPopScale=0.62`, `dangerWarningHideScale=0.38`.
    - Applied to `showBossSpecialAttackWarning`, `showGameplayTelegraph`, and `showRageBlockedWarning` transitions.
  - Boss intro portrait (idle_frame1) now shown for all boss types, not only Månika:
    - Added boss-type/level -> frame-key resolver in `UIScene`.
    - Added frame-key -> URL resolver using `utils.resolveAssetUrl(...)` (+ custom fallbacks for custom bosses).
    - `showBossIntroCard` now loads portrait dynamically per boss (`marja_liisa`, `jari_litmanen`, `jari_isometsa`, `tero_afterwork`, `jeti`, `matti_nykanen`, `peter_sync`, `timo_soini`).
  - `GameScene` now includes `bossType` in `bossSpawned` event payload so UI can map exact portrait reliably.
- Validation:
  - `npm run build` passed.

Update 2026-02-18 (ability cooldowns + boss growth scaling)
- Player ability cooldown gate added:
  - Axe abilities now require cooldown ready (`5s`) between uses.
  - Voltti abilities now require cooldown ready (`10s`) between uses.
- Implemented in `src/entities/Player.ts`:
  - Added cooldown timers/state + public helpers:
    - `isAxeAbilityReady`, `isVolttiAbilityReady`
    - `getAxeCooldownRemainingMs`, `getVolttiCooldownRemainingMs`
    - `triggerAxeCooldown`, `triggerVolttiCooldown`
  - Charged input tracking now ignores `axe/voltti` holds while cooldown is active (prevents hold-to-bypass cooldown behavior).
  - Airborne trick start now checks voltti cooldown and starts voltti cooldown on successful trick start.
- Integrated cooldown usage in `src/entities/PlayerFSM.ts`:
  - Gated axe attack transitions behind `isAxeAbilityReady()`.
  - Gated ground voltti/tornado transitions behind `isVolttiAbilityReady()`.
  - Triggered cooldown on attack start for:
    - axe/dash-axe/super-dash-axe
    - spin-kick/tornado.
- Touch HUD readiness update in `src/scenes/UIScene.ts`:
  - Axe and voltti button readiness now includes cooldown readiness checks.
- Boss growth scaling during fights:
  - Added monotonic combat growth scaling to `src/entities/Boss.ts` for all non-Peter bosses.
  - Growth is health+phase driven and never shrinks during fight.
  - Caps:
    - `timo_soini`: max scale multiplier `2.4` (matches Peter Sync target).
    - all other `Boss` bosses: max scale multiplier `2.0`.
  - Added phase-floor and finisher growth pushes for clearer escalation moments.
- Peter Sync growth alignment in `src/entities/PeterSync.ts`:
  - Added same monotonic combat scaling model with max multiplier `2.4`.
  - Added phase-2 scale jump tween and per-frame growth interpolation.
- Validation:
  - `npm run build` OK.
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` OK.

Update 2026-02-18 (chronological text export for user editing)
- Created consolidated chronological text export from current codebase string dump:
  - Primary editable file: `docs/GAME_TEXTS_CHRONOLOGICAL_EDITABLE.tsv`
  - Rows: 1153 (filtered to likely player-facing text content)
  - Includes explicit status flags for currently hidden/conditional/test-only text.
- Also created a full unfiltered backup export:
  - `docs/GAME_TEXTS_CHRONOLOGICAL_MASTER.tsv` (1362 rows)
- Status mapping in editable file:
  - `USED_NOW_OR_CONTEXTUAL`
  - `CONDITIONAL_MAY_BE_HIDDEN`
  - `NOT_USED_NOW_HIDDEN_BY_DEFAULT`
  - `NOT_USED_NOW_TEST_ONLY`
- Source-of-truth note embedded in file header:
  - `FLAVOR_TEXT_ENABLED=false` currently hides many flavor lines by default.

Update 2026-02-19 (user-edited TSV import + build)
- Imported user-edited text file:
  - `/Users/mikkoantikainen/Downloads/GAME_TEXTS_CHRONOLOGICAL_EDITABLE_MAC(2) - GAME_TEXTS_CHRONOLOGICAL_EDITABLE_MAC(2).csv(4).tsv`
- Import summary (`docs/TEXT_IMPORT_REPORT.md`):
  - Changed IDs detected: 120
  - Replacements applied now: 7
  - Already updated in source: 89
  - Misses: 25 (same IDs as previous import cycle, mostly `old_text_not_found`)
- Synced editable master TSV text column with uploaded TSV:
  - `docs/GAME_TEXTS_CHRONOLOGICAL_EDITABLE.tsv`
- Build + iOS sync:
  - `npm run build` ✅
  - `NPM_CONFIG_CACHE="/tmp/laturaivo-npm-cache" npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` ✅

Update 2026-02-19 (iOS resume ghost overlay hardening)
- Investigated report: after backgrounding app to iPhone home and returning, gameplay resumed with a green partial overlay showing level-summary text (looked like stale Victory UI DOM).
- Root cause direction: stale/orphaned Phaser DOM overlay nodes could survive scene/lifecycle edges, and DOM roots were fixed-size until scene recreation.
- Fixes applied:
  - `src/utils.ts`
    - Hardened `initUIDom(...)`:
      - Removes stale scene DOM wrappers before creating a new one.
      - Tags each DOM root with `data-laturaivo-ui-scene`.
      - Syncs DOM root size/position on Phaser scale resize events.
      - Registers SHUTDOWN/DESTROY cleanup to remove listeners + DOM wrapper safely.
  - `src/main.ts`
    - Added `cleanupOrphanedSceneDomNodes()` to purge DOM overlays not tied to active/paused/sleeping scenes.
    - Runs cleanup on `visibilitychange` resume, `pageshow`, `focus`, and once on game READY.
    - Keeps newest DOM node when duplicates exist for an active scene.
  - `src/scenes/VictoryUIScene.ts`
    - Added explicit shutdown lifecycle cleanup (timers, pointer handlers, button listeners, uiContainer destroy).
    - Guarded delayed UI creation timer so it does nothing when scene is no longer active.
    - Removed stale `#victory-container` before creation and on shutdown.
    - Changed victory overlay root from `fixed inset-0` to `absolute top-0 left-0 w-full h-full` inside scene DOM root (more stable in iOS transformed DOM contexts).
- Validation:
  - `npm run build` ✅
  - `npm run test` ❌ (pre-existing headless Phaser canvas issue in `src/test/scenes/GameScene.test.ts`: `Cannot read properties of null (reading 'blendModes')` while generating runtime texture)
  - Playwright smoke script could not run in this sandbox due missing network/module deps for the skill runner environment.

Update 2026-02-20 (remove daily mutator)
- Removed "daily mutator" from active gameplay systems and UI.
- `GameScene`:
  - Removed mutator model/fields and all mutator multipliers from spawn pressure, hazard chance, score calculations, and player stat modifiers.
  - Removed daily mutator telegraph announcements.
  - Victory launch payload no longer sends `dailyMutatorLabel`.
- `VictoryUIScene`:
  - Removed mutator label data and mutator row from level-complete card.
- `UIScene`:
  - Removed daily mutator text line from pre-run overlay and related prompt typing.
- Validation:
  - `npm run build` ✅
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` ✅

- 2026-02-20 14:31 Updated male main-character sprites to assets/custom/main_character_v2 and wired player_* keys in asset-pack + asset-pack-core (old offline sprites kept).

- 2026-02-20 14:50 Updated player_ski_walk_R_frame2.png from Dropbox source and synced iOS build assets.

- 2026-02-20 15:06 Simplified ability unlock signs to single-line format: 'Uusi kyky: <kyvyn nimi>' (AbilityUnlockUIScene + UIScene fallback texts). Build OK.

- 2026-02-20 15:11 iPhone orientation locked to landscape-only (Info.plist UISupportedInterfaceOrientations now LandscapeLeft/Right only). iPad orientations kept all four. Xcode simulator build: BUILD SUCCEEDED.

- 2026-02-20 17:01 Fix pass: voltti now cooldown-gated (10s) without per-level trick cap lockout; ability unlock popup auto-hide reduced to 2.5s; added Level 3 boss Elsa-Mummo with full sprite integration (asset-pack/core + animations + Boss/BossFSM + LevelManager + boss portrait + defeat lines). Build OK, cap sync ios OK.
- 2026-02-20: Boss AI aggression + smart movement pass
  - `BossFSM.update_chasing` rewritten to be more aggressive and less naive:
    - predictive X tracking (uses player velocity lead),
    - anti-head-stomp evasive side-burst when player is above boss,
    - personal-space/retreat pocket to avoid body-stacking under player,
    - deterministic gap-closer attacks when player is far (charge/leap/barrage by phase).
  - Added committed-attack reaction lock (`Boss.setDamageReactionLock`) and wired it into `hazard`, `special`, `charge`, `combo`, `leap`, and `barrage` states so telegraphed attacks do not get instantly canceled by hitstun.
  - Fixed special-warning mismatch:
    - removed pre-trigger special taunt in `enter_specialAttacking`; special callouts now occur only when special actually triggers.
  - Boss anti-juggle/stomp improvements in `GameScene`:
    - max same-target stomps per jump is now stricter for bosses (`1`),
    - boss stomp now applies immediate short separation lock + knock + brief chase pause.

- Validation 2026-02-20
  - `npm run build` OK.
  - Attempted develop-web-game Playwright loop, blocked in this environment:
    - `playwright` package missing locally,
    - network-restricted env prevented `npx` path from fetching required runtime.
- 2026-02-20: Boss intro hitch + boss animation variety pass
  - Reduced mobile boss-intro hitch risk:
    - UIScene boss intro no longer pauses GameScene on touch devices.
    - Added auto-continue timeout for boss intro card (touch 2.1s, desktop 3.0s).
    - Added explicit cleanup for intro auto-hide timers.
    - Disabled costly backdrop blur on touch devices for boss intro overlay.
  - Reduced perceived boss-start stall window on mobile by shortening boss intro reveal delay (1300ms mobile, 2000ms desktop).
  - Increased boss combat variety + anti-repeat:
    - Added recent attack history + phase-aware anti-repeat selection in `Boss.getNextAttackType()`.
    - Expanded phase 2/3 openers to include more move types sooner.
  - Reduced boss “stuck between few sprites/hurt loops” behavior:
    - Added flinch reaction cooldown per phase in `Boss.takeDamage`.
    - Added animation variant rotation helper in BossFSM to avoid repeating same anim key in normal/combo/barrage buckets.
    - Added movement-state animation reassertion in chase state to prevent incorrect lingering anims.
- 2026-02-20: Special-attack aggression pass (all bosses)
  - Increased special presence in phase attack decks (especially phase 2/3) across default and boss-specific patterns.
  - Added phase-aware special pressure logic in `Boss.getNextAttackType()`:
    - stronger phase 2/3 special probabilities,
    - opportunistic special conversions even when selected move is not special,
    - force-special threshold after consecutive non-special windows while special is ready.
  - Added weighted aggressive fallback pools to keep specials and high-pressure moves dominant.
  - Added adaptive special cadence scaling (`getSpecialCadenceMultiplier`) so special cooldown shortens as phases escalate/enrage/finisher.
  - Reduced initial first-special lead-in so bosses show special identity earlier.

- Validation 2026-02-20
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-23 (boss direction + Elon aggression + pause/music + unlock freeze)
- Boss directional sprite handling (`src/entities/Boss.ts`):
  - Added centralized `syncFacingVisual()` and routed all boss-state facing updates through it.
  - Added auto-detection for optional left-frame sets: if an animation has matching `_L_` textures for all `_R_` frames, runtime creates/uses a left animation variant (`__left`) automatically.
  - If `_L_` frames are missing, fallback remains standard `flipX` mirroring (no asset breakage).
- Boss FSM updates (`src/entities/BossFSM.ts`):
  - Replaced direct `setFlipX(...)` calls with `boss.syncFacingVisual()` for consistent mirroring.
  - Increased Tesla/Elon (`jari_isometsa`) aggression:
    - faster chase pressure,
    - rapid burst movement windows in chasing,
    - boundary-side forced attacks so he doesn't get stuck only walking when player is on blocked side,
    - faster charge prep, higher charge speed, shorter charge duration,
    - shorter post-charge/combo downtime,
    - denser barrage cadence.
- Tesla special attack (`src/entities/Boss.ts`):
  - Reworked to multi-burst dash sequence + powder cloud finisher for more activity and threat.
- Pause/music consistency (`src/scenes/UIScene.ts`):
  - Pause button now delegates to `GameScene.togglePause()` when available, ensuring BGM and native fallback pause/resume in sync when opening/closing pause menu.
- Ability unlock freeze-frame (`src/scenes/AbilityUnlockUIScene.ts`):
  - Added short gameplay freeze on unlock presentation.
  - Super ability unlocks (`superDashAxe`, `tornadoVoltti`, `superPole`) get a slightly longer freeze.
  - Freeze resumes safely via same pause pathway to avoid audio desync.
- Validation:
  - `npm run build` OK.

Notes
- Current sprite packs in active project/source folders are still predominantly `*_R_frame*` for bosses; no full L-pack detected for Elsa/others yet. New runtime logic will automatically switch to true L animations immediately if/when matching `*_L_frame*` files are added.

Update 2026-02-23 (level 5 Lapland background + moose spawn gate)
- Level 5 background switched to Lapland image:
  - Source imported from `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/level5bg_lapland.png`
  - Copied to `/public/assets/custom/level5/level_5_background_lapland.png`
  - Updated pack URLs for key `level_5_background_westend` in:
    - `public/assets/asset-pack.json`
    - `public/assets/asset-pack-core.json`
- Moose hazard first appearance changed to level 5:
  - `spawnHazard()` now spawns `MooseCrossing` only when `currentLevel >= 5`.
  - For levels 1-4, high-roll hazard branch now falls back to IcePatch/FallenTree to keep hazard density stable.
  - File: `src/scenes/GameScene.ts`
- Level 5 headline updated to Lapland theme:
  - `LevelManager.getLevelName(5)` -> `LAPPI: Revontulet Ja Hirvivaara`
  - File: `src/LevelManager.ts`
- Validation: `npm run build` OK.
- 2026-02-23: Level 2 boss-intro pause/music flow update
  - Added new music asset: `public/assets/music/laturaivo_level2bosstheme.mp3` (copied from user-provided path).
  - Added asset-pack key `level_2_boss_theme` -> `assets/music/laturaivo_level2bosstheme.mp3` in `public/assets/asset-pack.json`.
  - Boss intro card (`UIScene`) now always forces gameplay pause (also on touch devices) and only continues on tap; removed boss-intro auto-continue timeout.
  - Boss intro dismiss now emits `bossIntroDismissed` event; `GameScene` listens and for level 2 switches BGM to `level_2_boss_theme` after the intro card closes.
  - Added robust in-scene BGM switch helper (`switchBackgroundMusic`) so track swap stops previous Phaser/native fallback audio cleanly.
  - Added iOS background-music allowlist key `level_2_boss_theme` in `src/main.ts`.
  - Build validation: `npm run build` OK.
  - Smoke check (develop-web-game): local dev server + Playwright client run completed; only console artifact in capture was one `net::ERR_NAME_NOT_RESOLVED` resource error from browser runtime, no startup crash.
- 2026-02-23 (follow-up): Re-ran `npm run build` after final pause/music wiring adjustments and repeated Playwright smoke run against local dev server (`.tmp_web_game_playwright_client.mjs`), run completed without startup crash.

Update 2026-02-23 (lightweight combat SFX package + manager)
- Generated a new procedural lightweight combat SFX bundle (10 mono WAV files, 22.05 kHz):
  - `public/assets/audio_local/combat_generated/combat_{pole,axe,combo,enemy_hit,whoosh}_0{1,2}.wav`
- Added all new combat SFX keys to both pack files:
  - `public/assets/asset-pack-core.json`
  - `public/assets/asset-pack.json`
- Added `src/managers/CombatSfxManager.ts`:
  - pooled one-shot voices per key (re-use instead of per-hit allocation),
  - global active voice cap,
  - per-event cooldowns,
  - small pitch/detune/volume variation,
  - legacy key mapping (`pole_strike`, `axe_swing`, `combo_hit`, `enemy_hit`, `axe_explosion`, `boss_attack`).
- Integrated manager into `GameScene` lifecycle:
  - initialize + warmup in `create()` and attach as `scene.data` key `combatSfxManager`,
  - destroy + remove on `shutdown()`.
- Added `utils.playManagedSound(...)` and upgraded `utils.playSoundWithVariation(...)` to route through manager when available.
- Rewired key combat sound callsites to manager-aware path:
  - `src/entities/PlayerFSM.ts` attack SFX,
  - `src/entities/Player.ts` combo SFX,
  - `src/scenes/GameScene.ts` impact/stomp/landing combat SFX.

TODO (next)
- Run `npm run build` and verify type/build integrity after audio + manager integration.
- Run develop-web-game Playwright loop and verify no console errors and expected audio-triggered gameplay behavior.

Update 2026-02-23 (boss damage tuning + level 9/10 final order + Kantsu pre-boss background)
- Reduced global outgoing boss damage by 20% while preserving progressive scaling:
  - `src/entities/Boss.ts`: added `BOSS_GLOBAL_DAMAGE_TUNING = 0.8` and applied to base strike damage + `scaleSpecialAttackDamage(...)`.
  - `src/entities/PeterSync.ts`: added `PETER_GLOBAL_DAMAGE_TUNING = 0.8` and applied to base damage fields + `scaleSpecialAttackDamage(...)`.
- Swapped final campaign order so Peter Kantele is the final boss:
  - `src/LevelManager.ts`: level 9 -> `timo_soini` (`isFinalBoss: false`), level 10 -> `peter_sync` (`isFinalBoss: true`).
  - Updated level names accordingly (`Iso Timo Astuu Esiin`, `ICE CLUB ARENA: PETER KANTELE!`).
  - `isIceClubArenaLevel(...)` and `isPeterSyncLevel(...)` now target level 10.
  - `src/scenes/UIScene.ts`: boss portrait map switched so level 9 shows Timo, level 10 shows Peter.
  - `src/entities/PeterSyncFSM.ts`: death flow now derives final-boss state from `LevelManager.isLastLevel(currentLevel)`.
- Added Kantsu background for level 10 pre-boss run and kept club background for boss fight:
  - Added asset file: `public/assets/custom/kantsu/level_10_background_kantsu.jpeg`.
  - Added key `level_10_background_kantsu` to both `public/assets/asset-pack.json` and `public/assets/asset-pack-core.json`.
  - `src/scenes/GameScene.ts`:
    - Level background map: level 10 -> `level_10_background_kantsu`, level 9 -> `level_10_background_keilaniemi`.
    - `spawnPeterSync(...)` now forces runtime switch to `ice_club_arena_background` at boss start.
    - Music mapping aligned with reordered levels: level 9 -> `level_10_theme`, level 10 -> `ice_club_arena_theme`.
- Validation:
  - `npm run build` OK.
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` OK.
  - Verified new Kantsu key exists in `dist/assets/asset-pack-core.json` and `ios/App/App/public/assets/asset-pack-core.json`.

Update 2026-02-23 (level 2->3 story/video + combo pacing + title music leak fix)
- Added level 2 post-clear intro video stage in `src/scenes/StoryScene.ts`:
  - `StoryData` now supports optional `introVideoUrl`.
  - `level_2` now starts with fullscreen video `assets/custom/story/monikadefeat.mov`.
  - Added tap-to-continue video overlay (`NAPAUTA JATKAAKSESI`) before normal story image/text typewriter starts.
  - Added intro-video lifecycle cleanup on scene shutdown/advance to avoid lingering DOM media playback.
- Replaced level 2 story background image source in asset packs:
  - `public/assets/asset-pack.json` and `public/assets/asset-pack-core.json`
  - `story_level_2` now points to `assets/custom/story/story_level_2_monika_defeat.png`.
- Imported new media assets:
  - `public/assets/custom/story/monikadefeat.mov` (copied from user path)
  - `public/assets/custom/story/story_level_2_monika_defeat.png` (still frame extracted from the same video).
- Slowed combo countdown/decay pacing to ~50% speed (longer combo chaining window):
  - `src/entities/Player.ts`: base `comboTimeWindow` 2000 -> 4000; per-hit extension 100ms -> 200ms.
  - `src/scenes/GameScene.ts`: baseline combo window resets 2000 -> 4000; `combo_rush` bonus +320 -> +640.
  - `src/scenes/UIScene.ts`: combo meter depletion window now uses 4000 baseline and +200ms per combo step.
- Fixed intermittent title/home music leaking into gameplay (`src/scenes/TitleScreen.ts`):
  - Added native fallback request token gating to cancel stale async fallback starts when transitioning scenes.
  - Prevented late async fallback completion from starting/continuing title music after `startGame()`.
  - Split teardown into internal `teardownNativeFallbackMusic()` and token-invalidation in `stopNativeBackgroundMusicFallback()`.

Validation
- `npm run build` passes.
- develop-web-game Playwright validation attempts were made, but environment remains flaky for browser networking:
  - Browser client repeatedly reports `page.goto: net::ERR_CONNECTION_REFUSED` for local Vite URL even when in-shell `curl` to the same URL returns HTTP 200.
  - Latest generated screenshot artifact was black (`output/web-game/shot-0.png`), so this turn could not reliably verify visual flow by automation.

TODO (next)
- Re-run an end-to-end visual playthrough (level 2 clear -> video -> story image/text -> level 3 start) in an environment where Playwright can consistently connect to the local dev server.
- If user provides an explicit still-image file path for the chat-provided image, replace `story_level_2_monika_defeat.png` with that exact file.
- Validation 2026-02-23:
  - `npm run build` passed after Combat SFX integration.
  - develop-web-game Playwright client run executed with local wrapper `.tmp_web_game_playwright_client.mjs`.
  - Latest automation artifacts:
    - `output/web-game/shot-0.png` produced
    - no `errors-*.json` generated in the clean run
  - Note: screenshot capture remains fully black in this environment (also in headed mode), so visual gameplay verification is still limited by capture behavior, not by build errors.
- Re-validated after final integration pass:
  - `npm run build` passed again.
  - Clean Playwright smoke run (`.tmp_web_game_playwright_client.mjs`) completed without generating `errors-*.json`.
  - Screenshot artifact (`output/web-game/shot-0.png`) remains black in this environment; treat as capture limitation for visual validation.

Update 2026-02-24 (combat routing completion + OGG packaging)
- Completed remaining combat-key routing away from direct `this.sound.play(...)` calls to manager-aware path (`utils.playManagedSound` / `utils.playSoundWithVariation`) in:
  - `src/entities/BossFSM.ts`
  - `src/entities/Boss.ts`
  - `src/entities/ProSkier.ts`
  - `src/entities/PeterSyncFSM.ts`
  - `src/entities/Player.ts`
  - `src/entities/PowerUp.ts`
  - `src/scenes/UIScene.ts`
  - `src/scenes/GameScene.ts`
- Verified no direct `sound.play`/`sound?.play` remains for combat keys:
  - `pole_strike`, `axe_swing`, `combo_hit`, `punch_hit`, `enemy_hit`, `axe_explosion`, `boss_attack`, `player_hurt`.
- Added OGG variants for all generated combat files using Opus-in-OGG (`ffmpeg`, mono, 24kHz, 40kbps):
  - files in `public/assets/audio_local/combat_generated/*.ogg`
- Updated both pack files to prefer OGG with WAV fallback arrays for all `combat_*` keys:
  - `public/assets/asset-pack-core.json`
  - `public/assets/asset-pack.json`
- Updated generator script `scripts/generate_combat_sfx.py` to emit both WAV and OGG on each run.
- Size check (generated combat set):
  - WAV total: 61,294 bytes
  - OGG total: 8,916 bytes (~85.5% smaller)
- Validation:
  - `npm run build` OK.
  - Playwright smoke run completed; one residual existing browser console error (`ERR_NAME_NOT_RESOLVED`) still appears in longer run and screenshot capture can still go black intermittently after loading in this environment.

Update 2026-02-24 (asset/runtime optimization sweep)
- Asset cleanup:
  - Removed obsolete backup assets from `public`:
    - `public/assets/music/laturaivo_level3.prev.mp3`
    - `public/assets/music/laturaivo_level8.prev.mp3`
    - `public/assets/custom/fuengirola/backgrounds/level_8_background_fuengirola.prev.png`
- Music/audio packaging:
  - Generated OGG (Opus) variants for all `public/assets/music/*.mp3` tracks.
  - Generated OGG variants for heavy `audio_local` BGM tracks:
    - `miniboss_theme`, `final_boss_theme`, `victory_fanfare`, `game_over_music`, `ice_club_arena_theme`.
  - Updated `public/assets/asset-pack.json` audio URLs to OGG-first fallback arrays (`["*.ogg", "*.mp3"]`) where OGG exists.
  - Slimmed startup core pack by removing heavy boss BGMs from `public/assets/asset-pack-core.json`:
    - `level_2_boss_theme`
    - `ice_club_arena_theme`
- Large background image optimization:
  - Converted key heavy PNG backgrounds to WebP and switched both pack files to `.webp` URLs:
    - `story_level_2_monika_defeat`
    - `level_5_background_lapland`
    - `level_7_background_turku_v2`
    - `level_8_background_fuengirola`
    - `ice_club_arena_background` (`bglevel11`)
- Runtime/GC optimizations:
  - `GameScene.showStompEffect(...)` now reuses pooled stomp text objects (no per-stomp text create/destroy).
  - Replaced per-stomp transient particle object allocation with pooled `effectCirclePool` burst circles.
  - Added audio pack URL-array support (`string | string[]`) in `GameScene.resolveAudioUrlFromPack(...)`.
  - Added matching URL-array support in `TitleScreen.resolveAudioUrlFromPack(...)` and iOS audio cache rebuild in `src/main.ts`.
- JS startup bundle/code-split pass:
  - Added `src/scenes/registerRuntimeScenes.ts` to lazy-register non-preloader scenes via dynamic imports.
  - `main.ts` now eagerly registers only `Preloader`; Preloader registers the rest at runtime before starting `UberIntroScene`.
  - Build now emits separate scene chunks (e.g. `GameScene-*.js`, `UIScene-*.js`, etc.) instead of a single eager scene graph import path.

Validation
- `npm run build` passed after all changes.
- Playwright smoke attempt via `.tmp_web_game_playwright_client.mjs` failed in this environment due Chromium sandbox/process launch restriction (`bootstrap_check_in ... Permission denied (1100)`), so no reliable browser-run artifact for this pass.

Update 2026-02-24 (follow-up: iOS sync + full audio_local OGG pass)
- Ran iOS sync on current optimized build:
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` (success).
- Completed full `audio_local` OGG coverage:
  - Converted all remaining `public/assets/audio_local/*.mp3` files to `.ogg` (Opus, 24kHz mono, 40 kbps).
  - Result: `audio_local` now has OGG counterparts for all 58 MP3 files.
- Updated audio URL fallbacks in both pack files:
  - `public/assets/asset-pack-core.json`
  - `public/assets/asset-pack.json`
  - Converted remaining string MP3 URLs in `audio_local` entries to OGG-first arrays: `[
    "...ogg",
    "...mp3"
  ]`.
- Validation:
  - `npm run build` OK.
  - Re-ran `cap sync ios` after final audio changes: OK.
  - Sanity checks:
    - no plain `"assets/audio_local/*.mp3"` string URLs remain in pack files,
    - in core pack all audio entries now use array URLs (`63/63`).
- Size note:
  - `audio_local` MP3 total: 6,524,963 bytes
  - `audio_local` OGG total: 3,991,952 bytes
  - potential reduction if MP3 fallback dropped later: 2,533,011 bytes (~38.8%).

Update 2026-02-24 (tutorial completion persistence -> start from level 2)
- Added persistent tutorial completion flag in localStorage:
  - key: `laturaivo_tutorial_completed_v1`
  - helpers in `src/utils.ts`:
    - `hasCompletedTutorial()`
    - `markTutorialCompleted()`
- Tutorial completion is now saved automatically when level 1 is completed:
  - `src/scenes/GameScene.ts` in `triggerVictory()` marks tutorial complete when `currentLevel === 1`.
- New-game start level now depends on completion flag:
  - `src/scenes/NameInputScene.ts`:
    - default start level is `2` if tutorial has been completed before, otherwise `1`.
    - direct cheat start codes (`HEMOHES1...10`) still override as before.
- Game over "retry" now follows the same logic:
  - `src/scenes/GameOverUIScene.ts` restart starts from level `2` for returning players, otherwise level `1`.

Validation
- `npm run build` OK.

Update 2026-02-23 (StoryScene tap-to-continue fix, iOS)
- Fixed issue where tapping story screen (`NAPAUTA JATKAAKSESI`) sometimes did nothing.
- Root cause: DOM touch/click listeners were initialized before story/video DOM containers existed, so iOS overlay consumed touches and Phaser pointer handler did not reliably advance.
- File updated: `src/scenes/StoryScene.ts`.
  - Added dynamic DOM target tracking: `domAdvanceTargets: Set<HTMLElement>`.
  - Added `attachDomAdvanceHandlers()` to bind handlers to active `uiContainer` and `introVideoContainer` when they are created.
  - Call sites added after `showIntroVideo(...)`, `startStoryPresentation(...)`, and `finishIntroVideoStage(...)`.
  - Cleanup now removes handlers from all tracked DOM targets.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-24 (iOS home/resume crash hardening)
- Investigated Xcode runtime logs after app background/foreground cycle:
  - Repeated WebKit decode errors: `makeImagePlus ... 'WEBP' ... err=-50`
  - Follow-up rendering context errors in WebContent process.
  - Intermittent `JS Eval error A JavaScript exception occurred` during bridge eval timing.
- Applied iOS asset fallback fix for problematic WEBP backgrounds:
  - Replaced all `.webp` background URLs with `.png` alternatives in pack files:
    - `public/assets/asset-pack.json`
    - `public/assets/asset-pack-core.json`
    - `ios/App/App/public/assets/asset-pack.json`
    - `ios/App/App/public/assets/asset-pack-core.json`
  - Verified all 5 PNG targets exist in both web public and iOS public folders.
- Added native bridge eval hardening in `ios/App/App/CapacitorBridgeEvalGuard.swift`:
  - Skip JS eval while app state is `.inactive` / `.background`.
  - Require `webView.window != nil` before eval.
  - Goal: avoid resume/pause lifecycle race-triggered eval exceptions.
- Next validation target:
  - Rebuild web bundle and run `cap sync ios`, then confirm no WEBP decode errors appear in Xcode logs on home->return cycle.

Update 2026-02-23 (progressive perusvihujen aggressio)
- Added level-scaling aggressive chase behavior to three non-boss enemy types:
  - `PowerWalker` (`src/entities/PowerWalker.ts`): starts scaling from level 5+ (`aggressionTier = level - 4`), tracks player X, adapts chase speed by distance, and gets short burst sprints.
  - `PadelPlayer` (`src/entities/PadelPlayer.ts`): starts scaling from level 6+ (`aggressionTier = level - 5`) with similar chase + burst pattern and moderate speed scaling.
  - `TennisPlayer` (`src/entities/TennisPlayer.ts`): starts scaling from level 7+ (`aggressionTier = level - 6`) with strongest burst scaling among these three.
- Behavior intent: keep early levels readable, then make these enemies feel more like "aggressive chasers" on higher levels without touching boss logic.

Validation
- `npm run build` OK.
- Ran Playwright smoke via local wrapper (`node .tmp_web_game_playwright_client.mjs ...`) against `http://127.0.0.1:4173`.
- Artifacts were produced in `output/web-game/`, but screenshots were fully black in this environment (canvas/WebGL capture issue), so visual verification of in-run aggression could not be completed from those artifacts.
- Console log artifact still shows one existing resource error: `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`.

TODO (next)
- Add a deterministic debug scenario (or action burst) that jumps directly to a higher level and spawns `PowerWalker`/`PadelPlayer`/`TennisPlayer` on demand for repeatable visual AI checks.
- Validation 2026-02-24 follow-up:
  - `npm run build` OK.
  - Re-ran `cap sync ios` sequentially after build (previous parallel run copied stale dist once).
  - Verified iOS copied packs now also point to PNG for the 5 former WEBP entries (`ios/App/App/public/assets/asset-pack*.json`).
  - `xcodebuild` (Laturaivo scheme, iphonesimulator, no-sign) `BUILD SUCCEEDED`, including compile of `CapacitorBridgeEvalGuard.swift`.
- develop-web-game skill loop attempt:
  - Tried Playwright client command via `npx -y node@22 ... web_game_playwright_client.js`.
  - Blocked by network restriction in this environment (`ENOTFOUND registry.npmjs.org`) so browser automation could not run this turn.
- Additional local Playwright wrapper check (2026-02-24):
  - Ran `node .tmp_web_game_playwright_client.mjs --url http://127.0.0.1:4173 --click 200,200 --iterations 1 --pause-ms 300` with dev server running.
  - Run completed, produced `output/web-game/shot-0.png`, but capture is fully black in this environment.
  - Existing console artifact still shows one external DNS error (`net::ERR_NAME_NOT_RESOLVED`), no new game-specific runtime stacktrace from this run.

Update 2026-02-24 (tutorial skip button in HUD)
- Added a level-1-only HUD button under score in `UIScene`:
  - ID: `skip-tutorial-btn`
  - Label: `SKIP TUTORIAL`
  - Visible only when `currentLevel === 1`.
- Wired button handler in `UIScene.setupTutorialSkipButton()`:
  - emits `skipTutorialRequested` to active `GameScene`
  - supports both touchstart and click (prevents duplicate synthetic click after touch).
- Added `GameScene` listener in `setupTouchInputListener()` for `skipTutorialRequested`:
  - validates `currentLevel === 1`, not already completed, player alive
  - marks level complete and clears touch input state
  - shows floating announcement `TUTORIAALI OHITETTU`
  - calls normal `triggerVictory()` flow after short delay, so progression to level 2 uses existing victory/story pipeline.

Validation
- `npm run build` OK.
- Playwright smoke command executed (`node .tmp_web_game_playwright_client.mjs ...`) and completed.
- Known limitation remains in this environment: captured screenshots are fully black (canvas/WebGL capture issue), so visual assertion from artifacts is unavailable.

Update 2026-02-24 (audio regression fix: story video + missing SFX)
- Investigated user-reported issue: level 2 story intro video had no sound and most SFX were missing.
- Root causes found:
  1) `StoryScene` explicitly forced intro video to mute (`muted` attribute + `videoElement.muted = true`).
  2) Recent pack optimization reordered many audio arrays to OGG-first; on iOS this caused unreliable playback/missing SFX in several paths.
- Fixes applied:
  - `src/scenes/StoryScene.ts`:
    - removed `muted` from intro video element,
    - set `videoElement.muted = false` and `videoElement.volume = 1`.
  - Added preferred audio URL helper in `src/utils.ts`:
    - `pickPreferredAudioUrl(...)` with iOS-safe preference order (mp3/m4a/aac/wav before ogg).
  - Updated iOS/native and fallback URL resolution paths to use preferred format selection:
    - `src/main.ts` (`rebuildIOSAudioUrlCache`)
    - `src/scenes/GameScene.ts` (`resolveAudioUrlFromPack`)
    - `src/scenes/TitleScreen.ts` (`resolveAudioUrlFromPack`)
  - Reordered audio URL arrays in both packs to compatibility-first order:
    - `public/assets/asset-pack-core.json`
    - `public/assets/asset-pack.json`
    - Example outcomes:
      - music/audio_local pairs now `mp3 -> ogg`
      - generated combat SFX now `wav -> ogg`
- Verification:
  - `ffprobe` confirms `public/assets/custom/story/monikadefeat.mov` includes AAC stereo audio track.
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-24 (Elsa facing-direction fix)
- Root cause identified: Elsa boss sprite sources (`elsa_boss_*_R_frame*`) are authored left-facing, unlike most boss art.
- Boss facing logic in `src/entities/Boss.ts` assumed right-facing source art for all bosses, which caused Elsa to visually face away from player.
- Fix: added Elsa-specific flip polarity in `syncFacingVisual()`:
  - normal bosses: flip when `facingDirection === left`
  - Elsa: flip when `facingDirection === right`
- Validation: `npm run build` OK.

Update 2026-02-24 (boss orientation sweep + Elon sheet/prompt prep)
- Ran boss idle orientation sweep across all `_boss_idle_R_frame1` assets + `peter_sync_idle_R_frame1`.
- Visual contact sheet generated: `output/sprites/boss_orientation/all_boss_idle_r_frame1_contact.png`.
- Result: Elsa remains the only clearly left-authored "_R_" boss sprite; other bosses in the sweep are right-facing by source art.
- Generated Elon/Tesla boss sprite sheets from existing assets:
  - `output/sprites/elon_boss/elon_boss_spritesheet_fixed_2x3.png` (2 cols x 3 rows, fixed 752x590 cells)
  - `output/sprites/elon_boss/elon_boss_spritesheet_strip.png` (single-row strip)
- No gameplay code changes in this step.

Update 2026-02-24 (Final boss phase-2: KANNI rescue implementation)
- Integrated user-provided Pro Skier sprite set from:
  - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/anniskier/keyd`
- Copied sprites into project at:
  - `public/assets/custom/final_boss/kanni/pro_skier_*.png`
- Updated asset packs (`public/assets/asset-pack.json` and `public/assets/asset-pack-core.json`):
  - Repointed existing `pro_skier_ski_*` and `pro_skier_attack_*` keys to new custom files.
  - Added new keys: `pro_skier_hurt_*`, `pro_skier_die_*`, `pro_skier_taunt_*`.
- Extended `public/assets/animations.json` with:
  - `pro_skier_hurt_anim`
  - `pro_skier_die_anim`
  - `pro_skier_taunt_anim`
- Added new entity `src/entities/KanniBoss.ts`:
  - Boss-support style AI using pro skier sprite set.
  - Own HP pool, melee trigger, attack/hurt/die/taunt behaviors.
  - Emits `kanniSupportDefeated` event on death.
- Final boss fight logic updates in `src/scenes/GameScene.ts`:
  - Added Peter phase-2 rescue branch inside `playBossDeathFinale(...)` for level 10:
    - First Peter death triggers KANNI spawn + Peter revive.
    - Peter revived to 50% HP.
    - KANNI spawned with 50% of Peter max HP.
    - Both continue fighting player.
  - Added cleanup/reset paths for KANNI + rescue state in init/recovery/shutdown.
  - Added `kanniSupportDefeated` event handling.
  - Marked KANNI as boss target in collision logic (reduced boss-type damage rules).
- Peter HP bar aggregation changes in `src/entities/PeterSync.ts`:
  - Added support-linked combined health percentage calculation so HUD bar is one combined bar.
  - Added rescue activation method to re-enable Peter after cinematic.
  - Peter cannot fully die while linked support boss (KANNI) is still alive.
- HUD name tweak in `src/scenes/UIScene.ts`:
  - During duo phase on final level, boss label shows `PETER KANTELE + KANNI`.

Validation
- `npm run build` OK.
- Asset sanity check script verified all new pro skier frame keys resolve to existing local files.
- Playwright smoke attempt blocked in this environment due sandbox/runtime permissions:
  - `vite` bind error `listen EPERM 127.0.0.1:4173`
  - headless Chromium launch permission issue (`bootstrap_check_in ... Permission denied (1100)`).

TODO (next)
- Run an actual in-engine visual test on a non-sandboxed runtime to validate:
  - Peter death -> KANNI spawn cinematic timing,
  - combined boss HP bar behavior through full duo phase,
  - final victory only after duo phase concludes.
- Sync to iOS (`cap sync ios`) and run device/simulator pass for level 10 final fight.

Update 2026-02-24 (background boss cameos on levels 2/3)
- Added lightweight background cameo system for level 2 (Månika) and level 3 (Elsa):
  - New spawner in `GameScene` (`startBossBackgroundCameoSpawner`) starts with normal world spawners.
  - Spawns scaled-down boss sprites as non-interactive background decorations only during main gameplay (disabled once boss fight is active).
  - Cameos perform random micro-behaviors (`idle`, `shuffle`, `showoff`) with frame swaps and slight bob/angle drift.
- Added cleanup + timer lifecycle wiring:
  - quality retuning includes cameo timer delay
  - stopSpawners/triggerVictory/shutdown all destroy `bossCameoSpawnTimer`
- Kept scope intentionally to levels 2 and 3 only to avoid visual clutter/perf impact across all levels at once.

Validation
- `npm run build` OK.
- Verified required Monika/Elsa frame keys exist in asset-pack (pool runtime also filters by texture existence).

Update 2026-02-24 (boss one-shot safeguard pass)
- Investigated reported issue: one of Månika attacks could occasionally feel like a one-shot, and user requested a full boss sweep.
- Implemented boss-hit safety cap in player damage pipeline:
  - `src/entities/Player.ts` `takeDamage(...)` now accepts optional source metadata (`generic|boss`).
  - For boss-source hits, per-hit post-multiplier damage is capped to 45% of player max HP.
  - This prevents full-health one-shot spikes from any single boss hit (including risk/cursed multipliers).
- Tagged boss damage sources across all boss systems:
  - `src/entities/Boss.ts` (all boss special hits + legacy football hit)
  - `src/entities/BossFSM.ts` (hazard/charge/leap/barrage state hits)
  - `src/entities/PeterSync.ts` (disco special hit)
  - `src/entities/PeterSyncFSM.ts` (jump/spin/dash hits)
  - `src/scenes/GameScene.ts` enemy melee overlap now marks damage as boss-source when trigger owner is `Boss|PeterSync|KanniBoss`.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-24 (boss balance + retry HP + anti-idle)
- Implemented requested boss difficulty adjustments:
  - Global boss HP reduction for all boss fights: `-25%` baseline at spawn.
  - Boss retry assist: when player dies during active boss fight and restarts at boss checkpoint, next boss attempt starts with additional `-20%` HP (multiplicative per retry stack).
  - Anti-idle hardening: both standard boss FSM and PeterSync FSM now enforce short idle fail-safe windows so bosses cannot remain idle for long if delayed callbacks are missed.
- Files updated:
  - `src/scenes/GameScene.ts`
    - Added boss health scaling constants and boss retry death counter passed through `scene.restart(...)` init data.
    - Applied health scaling to spawned boss instances (affects both `Boss` and `PeterSync`).
    - Reset retry counter on victory.
  - `src/entities/BossFSM.ts`
    - Reduced idle delay and added idle max-duration fail-safe to force return to chase.
  - `src/entities/PeterSyncFSM.ts`
    - Reduced idle delay and added idle max-duration fail-safe to force next action.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (Level 3 music routing + boss anti-pogo restore)
- Gameplay fix (`src/scenes/GameScene.ts`): restored boss stomp same-target cap to shared value `maxStompsPerSameTargetPerAir` (3) instead of boss-only `1`.
  - Result: boss head-juggle is still prevented by existing far rebound logic, but forced far bounce now triggers after 3 same-target stomps in one airtime window (old behavior).
- Level 3 music flow:
  - Normal level 3 music remains `level_3_theme`.
  - Added level-3 boss intro switch handling to `onBossIntroDismissed(...)`.
  - Added level-3 boss retry/start-at-boss boot path so direct boss retries can start with boss track if available.
  - Added safe music-key resolution helper:
    - prefers `elsa_mixdown_1`
    - falls back to `level_3_theme` if key missing.
- Audio key wiring:
  - Added `elsa_mixdown_1` to `public/assets/asset-pack.json`.
  - Current mapping points to existing files:
    - `assets/audio_local/ice_club_arena_theme.mp3`
    - `assets/audio_local/ice_club_arena_theme.ogg`
  - Added `elsa_mixdown_1` to iOS background-music key set in `src/main.ts`.
  - Added `stopByKey("elsa_mixdown_1")` to music stop-lists in:
    - `VictoryCutsceneScene.ts`
    - `VictoryUIScene.ts`
    - `GameCompleteUIScene.ts`
    - `GameOverUIScene.ts` (both restart paths)
- Validation:
  - `npm run build` OK.
  - develop-web-game Playwright client run executed (headless + headed), but captured screenshots remain fully black in this environment, so visual gameplay verification was not possible from the captured images this turn.
- Post-fix iOS update: `cap sync ios` OK.
- Correction: active music stop flow is centralized via `utils.stopGameplayMusic()`/`KNOWN_MUSIC_KEYS` in `src/utils.ts`; no direct per-scene `stopByKey(...)` edits are required in current code layout.

Update 2026-02-25 (pole stamina consistency + hard music stop reliability)
- Fixed inconsistent pole stamina behavior in `src/scenes/GameScene.ts`:
  - Pole hit energy refund now triggers only once per attack swing (`isFirstMeleeTargetInAttack`) instead of once per enemy hit.
  - Reduced pole hit refund to a small partial amount (`~1.6` normal / `~2.2` boss + small mastery bonus), so pole attack always has net stamina cost.
- Added centralized music stop helpers in `src/utils.ts`:
  - `stopKnownMusicByKey(scene)` with shared known track key list (including `level_2_boss_theme` and `elsa_mixdown_1`).
  - `stopGameplayMusic(scene, gameplayScene?)` to stop keyed tracks + active gameplay scene music/fallback safely.
- Added `GameScene.stopAllMusicPlayback(...)` in `src/scenes/GameScene.ts`:
  - Stops bootstrap retry loop + retry handlers + keyed tracks + Phaser BGM + native HTMLAudio fallback.
  - Used this in critical transitions (`triggerVictory`, `handlePlayerDeath`, `shutdown`, and shutdown cleanup hook from iOS background handler).
- Replaced duplicated per-scene stopByKey blocks with centralized helper calls:
  - `src/scenes/GameOverUIScene.ts`
  - `src/scenes/VictoryUIScene.ts`
  - `src/scenes/VictoryCutsceneScene.ts`
  - `src/scenes/GameCompleteUIScene.ts`

Validation
- `npm run build` passed.
- Attempted develop-web-game Playwright loop via `.tmp_web_game_playwright_client.mjs`, but browser launch is blocked in this sandbox (`mach_port_rendezvous` permission denied / `SandboxDenied`).

Update 2026-02-25 (requested Level 3 + Elsa boss music swap)
- Applied user-requested source tracks:
  - Level 3 theme source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/laturaivo_level3.mp3`
  - Elsa boss theme source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/elsa Mixdown 1.mp3`
- File updates:
  - Replaced `public/assets/music/laturaivo_level3.mp3` with requested level 3 file.
  - Added `public/assets/audio_local/elsa_mixdown_1.mp3` from requested Elsa file.
- Asset pack mapping updates (`public/assets/asset-pack.json`):
  - `elsa_mixdown_1` now points to `assets/audio_local/elsa_mixdown_1.mp3`.
  - Removed stale `laturaivo_level3.ogg` references from `level_3_4_theme` and `level_3_theme` (mp3-only), because `.ogg` file is not present and was breaking iOS sync.
- Build/sync validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - Confirmed synced iOS bundle contains:
    - `ios/App/App/public/assets/music/laturaivo_level3.mp3`
    - `ios/App/App/public/assets/audio_local/elsa_mixdown_1.mp3`
    - updated `ios/App/App/public/assets/asset-pack.json` mappings.
- 2026-02-25 follow-up: created real OGG conversions per request and wired them as primary URLs:
  - `public/assets/music/laturaivo_level3.ogg` (from level 3 mp3)
  - `public/assets/audio_local/elsa_mixdown_1.ogg` (from Elsa mp3)
  - `asset-pack.json` now uses OGG first + MP3 fallback for:
    - `level_3_4_theme`
    - `level_3_theme`
    - `elsa_mixdown_1`
- Re-validated: `npm run build` OK, `cap sync ios` OK.

Update 2026-02-25 (music containment / overlap fix)
- Root cause addressed: `GameScene` native HTMLAudio fallback lacked request-token cancellation, so async fallback fetch/play could complete after scene transitions and start stale music over new scenes.
- Implemented request-scoped fallback lifecycle in `src/scenes/GameScene.ts` (parity with TitleScreen):
  - Added `nativeFallbackRequestToken` and `isNativeFallbackRequestValid(...)` gating.
  - `startNativeBackgroundMusicWithUrl(...)` now validates token before/after play and tears down stale starts.
  - `startNativeBackgroundMusicFallback(...)` now captures request token and ignores stale async fetch completions.
  - `stopNativeBackgroundMusicFallback()` now invalidates in-flight requests by incrementing token.
  - Added `teardownNativeFallbackMusic()` to stop without mutating token for internal same-request source switches.
  - `resumeNativeBackgroundMusicFallback()` now respects request validity (prevents resume in paused/completed/dead/inactive scene).
  - `init(...)` resets fallback in-flight state and increments request token to invalidate prior run callbacks.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK (retry once; first run had transient copy timeout).

Update 2026-02-25 (boss sustain + super guide pause)
- Boss-fight sustain tweak implemented:
  - Added boss-only heal on successful player actions:
    - Pole hit on boss (first basic pole target per swing): +1% max HP.
    - Stomp hit on boss: +2% max HP.
  - Wired into melee overlap + stomp overlap and implemented `restoreHealthFromBossCombatAction("pole" | "stomp")` in `GameScene`.
- Added 2s super ability instruction overlay in `UIScene`:
  - Triggered on `attackPerformed` for:
    - `tornadoVoltti` (Myrskyvoltti)
    - `superPole` (Supersauva)
  - Pauses gameplay while guide is visible, resumes on tap.
  - Includes safe cleanup in `shutdown()` and timeout/listener cleanup.
- Added DOM/UI elements for new overlay (`super-guide-overlay`, card, title, description, continue prompt).

Validation 2026-02-25
- `npm run build` ✅
- develop-web-game smoke run:
  - Started dev server on `http://127.0.0.1:4173`.
  - Ran local client: `node .tmp_web_game_playwright_client.mjs --url http://127.0.0.1:4173 --click 200,200 --iterations 1 --pause-ms 250` ✅ (exit 0)
  - Screenshot artifact updated: `output/web-game/shot-0.png` (still black in this environment).
- Network-restricted attempt with skill default npx client failed as expected (`ENOTFOUND registry.npmjs.org`).

TODO / next
- Verify on iOS runtime that super-guide overlay appears exactly on activation and resumes reliably under rapid repeats.
- Investigate black screenshot capture path in current headless environment (likely pre-existing rendering/capture issue, not introduced by this change).

Update 2026-02-25 (vehicle collision damage tuning)
- Reduced player damage from Tesla/car/funi vehicle collisions from 50% max HP to 25% max HP.
- This uses the shared vehicle overlap path (`this.teslas` group), so the reduction applies consistently to Tesla + tuned car + level 7 funi replacement vehicles.
- Validation: `npm run build` ✅.

Update 2026-02-25 (Level 7 vehicle + spawn scaling + boss damage rebalance)
- Implemented Level 7 funicular (old Tesla replacement) as 2x larger:
  - `src/entities/Tesla.ts`: when texture key is `level_7_funi_vehicle_v2`, vehicle render height is now `160` (was `80`).
  - `src/scenes/GameScene.ts`: parked level-7 funicular near clubhouse also uses height `160`.
- Removed Turku kiosk from gameplay decoration rotation:
  - `src/scenes/GameScene.ts`: removed `turku_burger_kiosk` from `turkuFeatureDecorationKeys` and removed its max-height branch from `spawnDecoration()` sizing.
- Made base enemy capacity progression explicit and linear from level 1 to level 10:
  - Added `getProgressiveBaseEnemyMultiplier()` in `src/scenes/GameScene.ts`.
  - `spawnRandomEnemy()` now derives base active-enemy budget from this multiplier:
    - level 1 baseline = 1.0x
    - level 10 baseline = 2.0x (100% more than level 1)
  - Existing dynamic-difficulty/quality-pressure logic remains applied on top.
- Reduced boss attack output by 50% while preserving per-boss progressive scaling:
  - `src/entities/Boss.ts`: `BOSS_GLOBAL_DAMAGE_TUNING` changed `0.8 -> 0.4`.
  - `src/entities/PeterSync.ts`: `PETER_GLOBAL_DAMAGE_TUNING` changed `0.8 -> 0.4`.
  - Boss-specific relative multipliers by boss type/phase were not flattened, so progression from early to late bosses is preserved.
- Validation:
  - `npm run build` passes.
- Additional validation note:
  - Attempted local Playwright smoke run (`node .tmp_web_game_playwright_client.mjs`) but browser launch is currently blocked in this execution environment (`mach_port_rendezvous ... Permission denied`).

Update 2026-02-25 (Iso Timo attack-lock fix + Level 10 music key + KIIA40 cheat)
- Boss attack lock robustness (addresses late-fight passive boss issue seen with Timo level 8):
  - `src/entities/BossFSM.ts`:
    - `enter_hurting()` now explicitly clears in-flight attack state (`isAttacking=false`, clears melee targets).
    - hurt recovery now re-enables `canAttack=true` when stun ends.
  - `src/entities/Boss.ts`:
    - Added stale attack-lock safety (`attackLockStartedAt`) in `update(...)`.
    - If boss is not attacking/hurting but `canAttack` remains false past threshold, lock is force-recovered.
- Level 10 music corrected:
  - `src/scenes/GameScene.ts` `getMusicKeyForLevel(10)` now returns `level_11_theme` (uses level11 ogg/mp3 asset key).
- Name cheat update:
  - `src/scenes/NameInputScene.ts` added `KIIA40` code.
  - `KIIA40` now starts directly at level 10 with `startAtBossFight: true` and enables god mode.
  - Existing `HEMOHES` and `HEMOHES1..10` behavior retained.
- Validation:
  - `npm run build` OK.

Update 2026-02-25 (level start location texts)
- Added explicit level-start location title text for every level in `GameScene` level intro card:
  - Level 1: Oittaa
  - Level 2: Leppävaara
  - Level 3: Tapiola
  - Level 4: Lahti
  - Level 5: Lappi
  - Level 6: Oulu
  - Level 7: Turku
  - Level 8: Fuge
  - Level 9: Espoonlahti
  - Level 10: Chanelmäki
- `showLevelMusicTitleCard()` now always shows `TASO X - [Location]`.
- If a music display name exists for a level (currently level 9), it is shown on the second line under the location.
- Validation:
  - `npm run build` OK.

Update 2026-02-25 (extra track info labels)
- Added requested track info text labels:
  - Level 3 boss fight track label: `Elsa-mummo - Uzittaa` (shown when level 3 boss theme starts, including boss-intro dismissal switch).
  - Level 4 track label: `LATUKEISARI - TÄÄ ON MUN LATU` (shown on level start card).
- `onBossIntroDismissed()` now re-shows level title card after switching to level 3 boss music so the boss-track label appears at the actual fight start.
- Validation:
  - `npm run build` OK.

Update 2026-02-25 (iOS black-screen follow-up)
- Re-validated iOS black-screen symptom path from user logs (`JS Eval error A JavaScript exception occurred` + WebView loaded + black screen).
- Confirmed iOS bundle now has consistent hashed asset references:
  - `ios/App/App/public/index.html` -> `./build_assets/index-CAOuvi-G.js`
  - file exists under `ios/App/App/public/build_assets/`.
- Rebuilt and re-synced web bundle to iOS:
  - `npm run build` OK
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` OK
- Ran unrestricted iOS simulator compile sanity check:
  - `xcodebuild -project ios/App/Laturaivo.xcodeproj -scheme Laturaivo ... build`
  - result: `BUILD SUCCEEDED`.
- Practical conclusion:
  - Current workspace is consistent and compiles; black screen was most likely stale iOS app bundle / mismatched hashed JS after earlier edits.
  - Next runtime repro should start from deleted app + clean rebuild on simulator/device.

Update 2026-02-25 (black-screen guard hardening)
- Added bootstrap startup watchdog in `index.html` to prevent silent black screen:
  - shows explicit fatal overlay if game boot does not produce canvas within timeout.
  - catches module script load failures (`<script>` resource error) and shows source URL.
  - keeps existing early `[BootstrapError]` / `[BootstrapRejection]` console diagnostics.
- Added explicit boot flag wiring in `src/main.ts`:
  - `window.__laturaivoBooted = false` at startup.
  - `window.__laturaivoBooted = true` on `Phaser.Core.Events.READY`.
- Rebuilt and synced iOS assets after guard changes:
  - `npm run build` OK.
  - `cap sync ios` OK.
  - iOS bundle now points to existing `./build_assets/index-DeiIuTX9.js`.

Update 2026-02-25 (2s super guide frequency fix)
- Fixed repeated super guide popups on every Supersauva/Myrskyvoltti activation.
- `UIScene` no longer opens super-guide overlay from `attackPerformed` events.
- Added one-shot level-start super guide flow for the 2s super unlock level (level 5):
  - scheduled after level UI initialization,
  - retries briefly if blocked by pause/boss-intro state,
  - shows one combined guide card (`2S SUPERIT AVATTU`) for Myrskyvoltti + Supersauva,
  - guaranteed once per level start via `levelStartTwoSecondSuperGuideShown` flag.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (remove Elsa/Månika from level background)
- Removed boss background cameo spawning during normal gameplay so Elsa mummo and Månika no longer appear in the background while playing levels.
- Boss fights themselves are unaffected (only background cameo system disabled).
- Change: `GameScene.isBossCameoLevel()` now returns false.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (boss/level music pause-resume reliability)
- Fixed music dropouts after pause/resume (reported on Elsa boss fight).
- `GameScene` audio resume flow hardened:
  - added `currentMusicVolume` state so resume/retry uses the active track volume consistently,
  - added `recoverBackgroundMusicAfterResume(...)` to re-wake Phaser audio + native fallback with delayed retries,
  - manual pause toggle now calls recovery path on unpause,
  - iOS foreground resume now resumes scene first, then runs recovery path (avoids paused-state race in fallback validity checks).
- Updated bootstrap/retry fallback starts to use `currentMusicVolume` (not hardcoded 0.6).
- Removed forced unmute on boss-intro dismiss (`applyGlobalMuteState(false)`), preserving user mute state and preventing unintended audio state jumps.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (difficulty default + stronger selection highlight)
- Changed default player difficulty to `espoo` (easy):
  - `NameInputScene.selectedDifficulty` now defaults to `espoo`.
  - Registry fallback difficulty defaults switched from `vantaa` -> `espoo` in:
    - `GameScene`
    - `VictoryUIScene`
    - `GameCompleteUIScene`
    - `VictoryCutsceneScene`
- Improved difficulty selector visibility in `NameInputScene`:
  - Added explicit selected-state styling (`.difficulty-btn.is-selected`) with cyan border, glow and slight scale-up.
  - Added animated `VALITTU` badge on selected difficulty button.
  - Added live status text line (`Valittu: ...`) under the difficulty title.
  - Selection initialization now always runs on create to sync visuals with default value.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (player movement speed +20%)
- Increased main character skiing/movement speed by 20% via player config:
  - `playerConfig.baseSpeed`: 200 -> 240
  - `playerConfig.maxSpeed`: 400 -> 480
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-02-25 (main menu game guide button)
- Added a new main menu button: `📘 LUE PELIN OHJEET` in `TitleScreen`.
- Added new overlay scene `GameGuideScene` with detailed gameplay instructions:
  - controls, combat, energy/rage, supers, boss fights, power-ups, quick tips.
  - includes `TAKAISIN` button that resumes the previous paused scene.
- Wired new scene into runtime registration in `registerRuntimeScenes`.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.
- UI automation note:
  - attempted Playwright smoke from this environment; selector-based run was timing-sensitive due intro chain and one run produced black screenshot in headless capture.
  - code-level integration and build checks passed.

Update 2026-02-25 (combat variety package: roles/elites/waves/weather/events/ambush/AI systems)
- Implemented requested variety systems in `src/scenes/GameScene.ts` + `src/entities/EnemyFSM.ts`:
  - `2` Roolipohjaiset vihuryhmät:
    - Added two role-wave groups: `rush_pack` and `shield_wall`.
    - Group waves now force role-biased spawns (`flanker/disruptor` vs `vanguard/support`).
  - `3` Eliittivihut + affixit:
    - Added per-enemy combat profile assignment at spawn.
    - Added elite roll scaling by level + run-modifier bonus.
    - Added affixes: `iron_skin`, `berserker`, `nimble`, `vampiric`, `bulwark` with stat/behavior effects.
  - `4` Rytmispawnit/aallot:
    - Added rhythm wave timer and event-triggerable wave bursts.
    - Waves spawn multiple enemies in paced cadence with telegraph text.
  - `7` Dynaaminen sää + vaikutukset:
    - Added dynamic weather pulse system (`vastatuuli/myötätuuli/räntäpuuska`) on top of existing weather.
    - Pulses now affect speed, enemy aggression multiplier and extra energy drain.
  - `9` Event-hetket tason sisään:
    - Added level progress event moments (24%, 50%, 68%+, 82%+) with one-shot triggers.
    - Event types: wave surge, weather spike, elite patrol, miniboss ambush.
  - `10` Miniboss-ambushit:
    - Added ambush spawns with forced elite/miniboss profile and telegraph.
    - Ambush count scales (1 normally, 2 on higher levels).
  - `11` Vihujen väistöt/feintit:
    - Added runtime enemy dodge/feint logic before player-hit resolution.
    - Added role/affix-aware bias in `EnemyFSM` attack selection and evasive hop chance.
  - `12` Poise/stagger-järjestelmä:
    - Added per-enemy poise pools and stagger windows.
    - Hits now apply poise damage; poise breaks trigger stagger state and temporary attack lock.
  - `16` Moraali/pako/raivo-logiikka:
    - Added morale values per enemy, casualty pressure tracking, flee states and enrage windows.
    - Enemies can flee when morale collapses and enrage when pressured/low HP.
  - `17` Leader-vihut buffeilla:
    - Added leader flag and nearby aura effects for speed/damage/morale support.
  - `20` Run-modifierit:
    - Added deterministic per-level run modifiers (`Tungoslatu`, `Lasitykki`, `Toinen hengitys`, `Adrenaliinijuoksu`).
    - Modifiers affect spawn pressure, damage in/out, score multiplier, speed and elite chance.

- Combat hit pipeline integration:
  - Player->enemy damage paths now pass through poise/damage modifier resolver.
  - Enemy->player damage now includes run-modifier multiplier.
  - Lifesteal on successful enemy hits now works for vampiric affix.

Validation 2026-02-25
- `npm run build` ✅
- `cap sync ios` ✅
- Playwright smoke attempt blocked by environment/browser sandbox (`mach_port_rendezvous ... Permission denied`), same class of issue as earlier headless runs in this environment.

TODO / follow-up tuning
- Fine-tune spawn burst counts and ambush cadence if levels feel too busy on lower-end devices.
- Balance elite affix stacking and miniboss durability after on-device playtesting.
- If needed, add explicit UI badges for active run modifiers and leader aura indicators.
- 2026-02-25 follow-up tweak:
  - excluded bosses (`Boss`, `PeterSync`, `KanniBoss`) from the new generic enemy combat-profile dynamics so boss tuning/FSM paths are not overridden by regular-enemy morale/aura systems.
  - Re-validated after exclusion: `npm run build` OK, `cap sync ios` OK.
Update 2026-02-25 (difficulty badge spacing + player sprite recovery)
- Name input difficulty badge overlap fix:
  - Added dedicated row class `difficulty-buttons-row` and top padding so `VALITTU` badge no longer collides with the status line.
  - Minor badge vertical offset adjustment and responsive small-height padding tweak.
  - File: `src/scenes/NameInputScene.ts`.
- Character preview fallback fix:
  - `NameInputScene` preview fallback changed from stale offline hash to live main-character sprite path:
    - `assets/custom/main_character_v2/player_ski_idle_R_frame1.png`
- Root cause found for broken player sprites on iOS:
  - iOS bundle had incomplete `main_character_v2` contents (only 2 files), causing missing texture placeholders.
  - Rebuilt clean `dist` (`rm -rf dist && npm run build`) and verified `dist/assets/custom/main_character_v2` has 16 files.
  - Synced web assets to iOS public bundle via rsync and verified `ios/App/App/public/assets/custom/main_character_v2` now also has 16 files.

Validation
- `npm run build` ✅
- iOS web asset bundle now contains full player sprite set (16/16) ✅
- Note: `npx cap sync ios` currently blocked in this environment because local Node is v20 and fetching Node 22 via npm is offline; applied equivalent bundle sync by copying built `dist/` to `ios/App/App/public/`.

- 2026-02-25: Removed difficulty selector "Valittu" texts/badges in NameInputScene and re-synced fresh dist into ios/App/App/public after successful npm run build.

- 2026-02-25: Difficulty HP rebalance + boss rebalance: player max HP set by difficulty (Espoo 2.0x, Vantaa 1.5x, Lahti 1.0x), boss attack power reduced by 30% (Boss/Peter/Kanni), and boss spawn HP increased by 20% from previous baseline (0.75 -> 0.90). Built and synced dist to ios/App/App/public.

- 2026-02-26: Renamed user-facing Kanni texts to Spice Boys (boss duo HUD label, rescue announcements, support-boss taunts/defeat text). Build passed and synced dist to ios/App/App/public.

Update 2026-02-26 (Level 1 tutorial overhaul + clear skip)
- Clarification handled: changes target level 1 specifically.
- Rebuilt `src/scenes/TutorialUIScene.ts` into a full step-by-step guided flow for level 1.
- New guided steps now cover all core mechanics in sequence:
  - movement (left + right)
  - jump
  - pole strike
  - axe attack
  - voltti
  - rage activation
  - 2s supers: myrskyvoltti, supersauva
  - superdash (supersyoksy)
- Tutorial step detection now uses live gameplay signals:
  - `touchInput` for movement
  - `attackPerformed` for jump/attacks/supers
  - `trickComplete` + live player trick state for voltti
  - `rageActivated` for rage
- Added per-step player prep so tutorial cannot get stuck on resource gates:
  - refreshes energy/cooldowns each step
  - primes rage to full on rage step
- Fixed skip-button ID collision between UI scene and tutorial overlay:
  - tutorial overlay now uses `tutorial-overlay-skip-btn`
  - HUD button keeps `skip-tutorial-btn`
- Tutorial overlay skip is now explicit and strong-visibility, and triggers the same `skipTutorialRequested` flow (whole level 1 tutorial skip).
- Added robust cleanup for tutorial timers/event listeners on shutdown.

Validation 2026-02-26
- `npm run build` ✅
- `npm run test` ❌ (existing headless Phaser issue unchanged):
  - `Cannot read properties of null (reading 'blendModes')` in `GameScene.ensureJumpRampTextures` during headless test bootstrap.
- 2026-02-26 follow-up:
  - Synced updated web bundle to iOS container with `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` ✅.
  - Tried `develop-web-game` Playwright smoke loop, but browser launch is sandbox-blocked in this runtime (`mach_port_rendezvous ... Permission denied`), so no visual automation capture in this turn.

Update 2026-02-26 (requested story media swap)
- Added requested media assets into story folder:
  - `public/assets/custom/story/1.jpg`
  - `public/assets/custom/story/laturaivocinematic1.mov`
- Story flow changes in `src/scenes/StoryScene.ts`:
  - Tutorial-finish bridge (`intro`) now has intro video:
    - `introVideoUrl: assets/custom/story/laturaivocinematic1.mov`
  - Level 2->3 story text kept unchanged, and old `monikadefeat.mov` intro-video hook removed from `level_2` block.
- Story image swap for level 2->3 interstitial (text unchanged):
  - `story_level_2` now points to `assets/custom/story/1.jpg` in:
    - `public/assets/asset-pack.json`
    - `public/assets/asset-pack-core.json`
- Validation:
  - `npm run build` ✅
  - `cap sync ios` ✅
  - Confirmed iOS public bundle contains new files and story pack references.

Update 2026-02-26 (screenplay template from current script)
- Created screenplay template doc based on current in-game StoryScene content and current transition media setup.
- New file:
  - `docs/KASIKIRJOITUS_POHJA_NYKYINEN.md`
- Includes:
  - logline, tone, character arc
  - scene-by-scene current story backbone (S00-S10)
  - reusable fill-in scene template block
  - concise production/editing notes for pacing and iOS video behavior

Update 2026-02-26 (Monika pre-boss intro video)
- Added requested pre-boss video flow for Monika (level 2):
  - `monikadintro.mov` now plays before the Monika boss intro card when boss appears.
- New asset copied:
  - `public/assets/custom/story/monikadintro.mov`
- UI flow changes in `src/scenes/UIScene.ts`:
  - `showBossWarning(...)` now routes level 2 Monika spawn through `showMonikaPreIntroVideo(...)`.
  - Added dedicated pre-intro video overlay DOM (`boss-preintro-video-overlay` + `boss-preintro-video`).
  - Added tap-to-skip handling and `ended` transition to regular boss intro card.
  - Reused existing boss pause/resume path so gameplay stays paused through video -> boss card, then resumes on card dismiss.
  - Added cleanup hooks for pre-intro video handlers/timeouts during shutdown.
- Validation:
  - `npm run build` ✅
  - `cap sync ios` ✅
  - Confirmed iOS bundle includes `assets/custom/story/monikadintro.mov`.

Update 2026-02-26 (returning player tutorial choice)
- Implemented requested start choice for returning players in `src/scenes/NameInputScene.ts`.
- Previous behavior: if tutorial was completed once, new run always started from level 2.
- New behavior:
  - If tutorial already completed and no direct level cheat code is used, game asks:
    - `Pelaa tutoriaali?`
    - OK => start from level 1 (tutorial)
    - Cancel => start from level 2
  - Cheat/direct-start codes (`KIIA40`, `HEMOHES1..10`) bypass this prompt and keep direct start behavior unchanged.

Validation 2026-02-26
- `npm run build` ✅
- develop-web-game Playwright client execution attempt:
  - dev server start succeeded locally (`npm run dev -- --host 127.0.0.1 --port 4173`)
  - visual automation blocked in this runtime because `playwright` package is missing and network is restricted (cannot install/fetch)

Update 2026-02-26 (new story text pass)
- Updated in-game inter-level story content in `src/scenes/StoryScene.ts` to match the new supplied storyline (S00-S10).
  - Updated `intro`, `level_2` ... `level_10`, and `ending` text blocks.
  - Kept existing media wiring (intro video + still keys) intact.
- Synced screenplay markdown doc with the same new storyline:
  - `docs/KASIKIRJOITUS_POHJA_NYKYINEN.md`

Validation 2026-02-26
- `npm run build` ✅

Update 2026-02-26 (S00 intro image swap)
- Updated `story_intro` asset mapping to use the new intro image at `assets/custom/story/1.jpg`.
- Files changed:
  - `public/assets/asset-pack.json`
  - `public/assets/asset-pack-core.json`
- Synced screenplay doc media row for S00:
  - `docs/KASIKIRJOITUS_POHJA_NYKYINEN.md`

Validation 2026-02-26
- `npm run build` ✅
- iOS sync attempt:
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` ❌ (network blocked: ENOTFOUND registry.npmjs.org)

Update 2026-03-05 (event-chain fix: "SÄÄ KÄÄNTYY" now has real gameplay effect)
- Fixed level event moment handling in `src/scenes/GameScene.ts`:
  - `weather_spike` no longer only fires a subtle dynamic pulse.
  - Added `triggerLevelWeatherSpike()` with deterministic weather activation by level:
    - Level 4 -> forced `acidrain`
    - Level 5+ -> forced `snowstorm`
    - Lower levels -> visible wind-gust fallback + pulse (`TUULI KÄÄNTYY`) instead of misleading weather text.
  - If weather is already active, event now telegraphs `SÄÄ VOIMISTUU` and still applies a pulse.
- Added explicit UI event binding for weather changes in `src/scenes/UIScene.ts`:
  - `weatherChanged` now has a listener.
  - Extracted weather warning rendering into `applyWeatherWarningState(...)` and reused it from both event listener and per-frame update.
  - Result: weather warning HUD reacts immediately to event emission, not only via polling.

Validation 2026-03-05
- `npm run build` ✅
- develop-web-game runtime check:
  - `npm run dev -- --host 127.0.0.1 --port 4173` starts successfully.
  - Playwright automation run is still blocked in this environment:
    - `npx -y node@22 ...web_game_playwright_client.js` fails due network (`ENOTFOUND registry.npmjs.org`).
    - local fallback `node .tmp_web_game_playwright_client.mjs ...` fails because local `node_modules/playwright/package.json` is invalid/corrupted (`ERR_INVALID_PACKAGE_CONFIG`).

Update 2026-03-05 (Monika defeat media chain)
- Copied requested source media into project story assets:
  - `public/assets/custom/story/monikadefeat.mov`
  - `public/assets/custom/story/monikadefeatstill.jpg`
- Updated story flow in `src/scenes/StoryScene.ts`:
  - `intro` remains unchanged and still uses `assets/custom/story/laturaivocinematic1.mov`.
  - `level_2` (shown after beating Månika, before level 3) now uses:
    - `introVideoUrl: assets/custom/story/monikadefeat.mov`
    - `imageKey: story_level_2` (video first, then still image + text as normal StoryScene flow).
- Updated level 2->3 still image mapping in both pack files:
  - `public/assets/asset-pack.json`: `story_level_2 -> assets/custom/story/monikadefeatstill.jpg`
  - `public/assets/asset-pack-core.json`: `story_level_2 -> assets/custom/story/monikadefeatstill.jpg`

Validation 2026-03-05
- `npm run build` ✅
- develop-web-game Playwright client check attempted:
  - blocked by invalid local Playwright package config (`ERR_INVALID_PACKAGE_CONFIG` for `playwright-core/package.json`)

Update 2026-03-05 (HEMOHES direct-start boss behavior)
- Changed `src/scenes/NameInputScene.ts` so direct level cheat names `HEMOHES1...10` now always request boss-fight start for that level:
  - `startAtBossFight` now derives from `directStartLevel !== null` (was only `KIIA40`).
  - Comment updated accordingly.
- Runtime safety:
  - Level 1 is still safe because `GameScene` applies `startAtBossFight` only when `LevelManager.isBossLevel(level)` is true.

Validation 2026-03-05
- `npm run build` ✅

Update 2026-03-05 (airborne melee buff + bouncing enemy)
- Requested combat tweak implemented in `src/scenes/GameScene.ts`:
  - Airborne pole/axe strikes now deal 2x damage.
  - Applies when player is not on ground and attack family is pole or axe (voltti/tornado unchanged).
- Bouncing enemy implementation:
  - Added periodic hop behavior to `DrunkPerson` in `src/entities/DrunkPerson.ts`.
  - Drunk enemy now performs small unpredictable jumps while staggering, using randomized hop intervals and jump strength.

Validation 2026-03-05
- `npm run build` ✅
- develop-web-game Playwright check attempted:
  - blocked by broken local Playwright dependency (`MODULE_NOT_FOUND: ./stats` under `playwright-core`)

Update 2026-02-26 (tutorial replay prompt on level 2 start)
- Moved tutorial replay choice away from NameInput start flow to level-2 startup flow for returning players.
- `NameInputScene`:
  - Restored default returning-player start to level 2.
  - Added session flags in registry:
    - `isReturningPlayerSession`
    - `tutorialReplayPromptShown` (reset false at run start)
- `GameScene.init`:
  - When a returning-player session starts level 2 (and prompt not yet shown, no cheat code), show:
    - `Haluatko pelata tutoriaalin läpi uudestaan?`
  - If accepted, route to level 1 tutorial; otherwise remain at level 2.
  - Prompt is shown once per run.
- `GameOverUIScene.restartGame`:
  - Resets the same session flags so restart behaves like a fresh run.

Validation 2026-02-26
- `npm run build` ✅

Update 2026-03-05 (DrunkPerson revert + Chihuahua hop)
- User-requested enemy-behavior swap completed:
  - Reverted `DrunkPerson` hop behavior in `src/entities/DrunkPerson.ts` (removed hop timer/state/method and hop trigger in update loop).
  - Added timed hop behavior to `Chihuahua` in `src/entities/Chihuahua.ts`:
    - new `nextHopAt` timer state
    - `scheduleNextHop(referenceTime)` helper
    - update-loop hop trigger when grounded and not hurting (`velocityY` random hop impulse)
- Existing player airborne strike buff remains intact in `src/scenes/GameScene.ts`:
  - pole/axe airborne strikes continue using 2x damage multiplier.
- Validation:
  - `npm run build` OK.
- develop-web-game skill visual check attempt:
  - Local dev server starts (`vite --host 127.0.0.1 --port 4173`).
  - Skill client via `npx -y node@22 ...web_game_playwright_client.js` blocked by network in this sandbox (`ENOTFOUND registry.npmjs.org`).
  - Local fallback client `.tmp_web_game_playwright_client.mjs` launched but did not produce usable output in this session; process was terminated.

Update 2026-03-06 (Boss card names/descriptions refresh)
- Updated boss card runtime texts in `src/LevelManager.ts` for levels 2-10 to match latest user-provided copy.
  - Level 5 boss renamed from `Elon` to `Vesa` (`bossName` + `bossNameFi`).
  - Levels 2-10 `bossDescription` fields replaced with the new versions.
- Synced `BOSS_INTRO_TEXTS.txt` with the same names/descriptions and corrected level ordering for 9/10:
  - Level 9 = Iso Timo
  - Level 10 = Peter Kantele
- Validation:
  - `npm run build` OK.
- Follow-up consistency fix in `src/scenes/UIScene.ts`:
  - Replaced hardcoded final boss HUD label `PÄÄBOSSI: TIMO SOINI` with dynamic final boss name from `LevelManager.getBossConfig(currentLevel)`.
  - Ensures level 10 HUD name matches configured final boss (`Peter Kantele`).
- Validation rerun:
  - `npm run build` OK after HUD-name fix.

Update 2026-03-06 (DrunkPerson HP -50%)
- Reduced `DrunkPerson` max HP by 50% in `src/entities/DrunkPerson.ts`:
  - `Math.round(60 * difficultyMultiplier)` -> `Math.round(30 * difficultyMultiplier)`
- Validation:
  - `npm run build` OK.

Update 2026-03-06 (Level 2 intro flow enforcement)
- Requirement implemented: before Level 2 starts, show intro cinematic (`laturaivocinematic1.mov`) + intro story still (`story_intro`) first.
- Updated direct Level 2 start paths to route via `StoryScene` (`storyKey: "intro"`) before `GameScene`:
  - `src/scenes/NameInputScene.ts`
    - Returning-player new game path (`hasCompletedTutorial => defaultStartLevel 2`) now starts `StoryScene` first.
  - `src/scenes/GameOverUIScene.ts`
    - Restart path for returning players (`startLevel === 2`) now starts `StoryScene` first.
- Tutorial skip path in level 1 already used victory -> `StoryScene` intro flow; no extra rewrite required there.
- Validation:
  - `npm run build` OK.
  - Playwright smoke command ran and produced fresh `output/web-game/shot-0.png` + `errors-0.json`; environment currently reports existing dev bootstrap module error (`phaser __commonJS export`) in local dev run.

Update 2026-03-06 (Elsa boss intro + defeat videos)
- Added Elsa media files into project story assets:
  - `public/assets/custom/story/elsaintro.mov`
  - `public/assets/custom/story/elsadefeat.mov`
- Boss pre-intro video flow in `src/scenes/UIScene.ts` extended from Monika-only to config-based mapping:
  - Level 2 / `marja_liisa` -> `monikadintro.mov`
  - Level 3 / `elsa_mummo` -> `elsaintro.mov`
  - Hint text now updates per boss video.
- Story transition in `src/scenes/StoryScene.ts`:
  - `level_3` now plays `assets/custom/story/elsadefeat.mov` before the still/text (same staged flow as other story videos).
- Validation:
  - `npm run build` OK.
  - Playwright smoke attempt via `.tmp_web_game_playwright_client.mjs` failed with timeout on `page.goto` (`domcontentloaded` not reached within 30000ms) in this environment.

Update 2026-03-06 (Boss intro pause/resume hardening for all bosses)
- Hardened boss intro pause flow in `src/scenes/UIScene.ts`:
  - `pauseGameForBossIntro()` now enforces a fallback pause if `togglePause()` fails/gets blocked.
  - `resumeGameAfterBossIntro()` now enforces a fallback resume if toggle path does not wake gameplay.
  - Goal: when boss card is visible, gameplay is reliably paused in background; when card closes, gameplay resumes.
- Updated `src/scenes/GameScene.ts` boss-intro dismissed handler scope:
  - Removed old early-return that ignored levels other than 2/3.
  - Handler now runs for all boss levels; level-specific boss-theme switching still applies only to level 2/3.
- Validation:
  - `npm run build` OK.
  - Playwright smoke command exited 0 and produced fresh `output/web-game/shot-0.png` + `errors-0.json`.
  - Existing local dev bootstrap error (`phaser __commonJS` export) still appears in this environment and is unrelated to these logic changes.

Update 2026-03-06 (Level 2 wording tweak: vattuilla)
- Updated Level 2 boss description wording from `vittuilla` -> `vattuilla`:
  - `src/LevelManager.ts` (runtime boss card description)
  - `BOSS_INTRO_TEXTS.txt` (text reference list)
- Validation note:
  - `npm run build` currently fails due existing local Vite dependency issue:
    - missing `node_modules/vite/dist/client/client.mjs`
    - error: `cannot test case insensitive FS, CLIENT_ENTRY does not point to an existing file`

Update 2026-03-09 (HEMOHES -> direct boss starts)
- Updated `src/scenes/NameInputScene.ts` so HEMOHES name codes start directly at boss fights:
  - `HEMOHES` (without number) now defaults to level 2 boss fight.
  - `HEMOHES1` now maps to level 2 boss fight (level 1 has no boss).
  - `HEMOHES2...10` start at their corresponding boss levels.
  - Existing `KIIA40` direct final boss behavior remains.
- Implementation details:
  - Added `LevelManager` import and boss-level normalization via `LevelManager.isBossLevel(...)`.
  - `startAtBossFight` is now explicitly tied to HEMOHES-style code usage.
  - `cheatCodeUsed` now follows the consolidated HEMOHES/KIIA40 boss-code flag.
- Validation:
  - `npm run build` OK.
  - Smoke run (`node .tmp_web_game_playwright_client.mjs ...`) exited 0 and wrote fresh `output/web-game/shot-0.png`.
  - Existing local dev bootstrap error in `output/web-game/errors-0.json` (`phaser __commonJS export`) persists in this environment and is unrelated to this name-code routing change.

Update 2026-03-09 (Boss intro video routing hardening for all bosses)
- Problem targeted:
  - Elsa boss intro video occasionally skipped and boss card opened directly.
  - Existing intro-video selection in `UIScene` depended on `currentLevel` match + strict `bossType` equality, which can fail if scene-level state lags while event payload already has the correct boss type.
- Fix in `src/scenes/UIScene.ts`:
  - Updated `getBossPreIntroVideoConfig(...)` to resolve intro media in this order:
    1) current level boss config (if intro video exists and types align),
    2) fallback lookup by incoming `bossType` across `LevelManager.BOSS_LEVELS`.
  - Keeps intro video mapping config-driven (`bossIntroVideoUrl`) and resilient for all bosses as videos are added.
- Result:
  - Boss pre-intro videos now use boss identity from event payload when needed, so Elsa and future bosses no longer depend solely on `currentLevel` state alignment.
- Validation:
  - `npm run build` PASS.
  - Playwright smoke client run completed once against local dev server (`.tmp_web_game_playwright_client.mjs --url http://127.0.0.1:4173 --click 200,200 --iterations 1 --pause-ms 250`).
  - Additional rerun attempts hit sandbox Chromium launch restriction (`mach_port rendezvous permission denied`), so visual automation verification is partially constrained by environment.

Update 2026-03-09 (Level 4 boss arena background override)
- User request: show Ravintola Torvi image during LATU KEISARI boss fight background.
- Implemented in `src/scenes/GameScene.ts` (`spawnBoss`):
  - When `bossConfig.bossType === "jari_litmanen"`, switch arena background to `ravintola_torvi` via `createBackground("ravintola_torvi", false)`.
- Notes:
  - `ravintola_torvi` texture key already exists in asset packs and points to `assets/offline/e877507adfb5ab230e4f951908528311b0c2f031.png`.
  - Change affects boss fight stage specifically (not the full level run).

Update 2026-03-09 (Level 4 Torvi background layering tweak)
- Follow-up clarification implemented:
  - Do NOT replace the existing level 4 background in LATU KEISARI fight.
  - Instead, keep current background and add `ravintola_torvi` as an extra backdrop layer.
- Changes in `src/scenes/GameScene.ts`:
  - Added `addLevel4BossTorviBackdrop()` helper.
  - `spawnBoss()` now calls this helper for `jari_litmanen` instead of `createBackground("ravintola_torvi", false)`.
  - Added `level4BossTorviBackdrop` scene field + cleanup in init reset and shutdown.
- Visual behavior:
  - Base level 4 background remains unchanged.
  - Torvi image is rendered as a blended background layer (`alpha 0.9`) behind gameplay.

Update 2026-03-10 (Safe cinematic presets + fake lighting + 2.5D atmosphere pass)
- Implemented a lightweight cinematic system in `src/scenes/GameScene.ts` focused on mobile-safe effects.

Camera safe presets
- Added centralized safe camera preset system:
  - `light_hit`
  - `heavy_hit`
  - `boss_super`
- New helper methods:
  - `triggerSafeCameraPreset(...)`
  - `triggerSafeLightingStrobe(...)`
- Presets include bounded shake/flash + optional micro zoom/tilt (disabled on low-perf paths) + strobe overlay.
- Wired presets into existing gameplay/cinematic hooks:
  - boss finisher impact
  - boss death cinematic
  - boss spawn cinematic
  - boss telegraph events (`normal/charge/combo/leap/barrage/super/aoe/hazard/phase`)
  - dynamic weather spike pulses

Fake dynamic lighting (cheap)
- Added always-on cinematic visual layer objects:
  - base color filter overlay (`cinematicColorOverlay`)
  - strobe overlay (`cinematicStrobeOverlay`)
  - top + bottom gradient darkening strips
  - boss glow ellipse (`ADD` blend)
  - boss spotlight cone graphics (`ADD` blend)
- Added `createCinematicVisualLayers()` and `updateCinematicVisualLayers(...)`.
- Boss spotlight tracks live boss position on screen during active boss fights.
- Filter color/intensity shifts by state (boss active, acid rain, snowstorm/blizzard, sunglare).

2.5D / depth feel
- Added lightweight parallax “bands” as translucent moving layers (`cinematicParallaxBands`).
- Added subtle depth illusion scaling for decorations (`applyDecorationDepthIllusion()`), throttled and disabled in low-perf modes.
- Safe micro-tilt support included in camera presets for impact moments.

Atmosphere (lightweight)
- Added drifting dust motes layer (`cinematicDustMotes`) with soft wobble and wrapping.
- Existing snowfall/weather systems remain in use; new cinematic layer complements them with gentle fog-like motion and color grading.

Performance safeguards
- Low-end / low-quality / hard-FPS-emergency paths reduce or skip expensive parts:
  - lower alpha/intensity
  - fewer parallax/mote elements
  - disable tilt+zoom portions of camera presets
  - throttled depth scaling

Lifecycle / cleanup
- Added full init/reset/shutdown handling for all new cinematic objects/tweens/timers to avoid leaks or stale references.

Validation
- `npm run build` PASS.
- Playwright smoke:
  - One run completed successfully earlier in this session (updated screenshot timestamp).
  - Re-run attempts hit sandbox Chromium launch restriction (`mach_port rendezvous permission denied`).
- Visual artifact note:
  - latest inspected screenshot was black in this sandbox flow due existing local bootstrap/runtime issue, so final visual tuning should be confirmed on device or unrestricted local run.

Update 2026-03-10 (Boss videos from external skits + Elsa interlude chain)
- Source media folders used:
  - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/skits`
  - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/skits/final`
- Copied all `final/*.mov` boss/interlude files into project:
  - `public/assets/custom/story/final/*.mov`
- Updated boss video config in `src/LevelManager.ts`:
  - Intro/defeat URLs now mapped to `assets/custom/story/final/<bossType>_intro/defeat.mov` for levels 2,3,4,5,7,8,9,10.
  - Level 6 (`tero_afterwork`) intro set to `assets/custom/story/final/tero_afterwork_intro.mov`.
  - Added `bossDefeatFollowupVideoUrls` field to `BossConfig`.
  - Added level 3 follow-up chain:
    - `assets/custom/story/final/interlude_taso3after-elsa-defeat.mov`
- Story scene sequencing update in `src/scenes/StoryScene.ts`:
  - Added support for video arrays (`introVideoUrls`) in addition to single `introVideoUrl`.
  - Implemented queued playback flow (`showNextIntroVideo`) so multiple videos run in order before still/text.
  - Added video `ended` and `error` handlers to continue automatically to next stage.
  - For level_3, resolved sequence now becomes:
    1) Elsa defeat video
    2) interlude_taso3after-elsa-defeat.mov
    3) level 4 transition still/text screen
- Additional text alignment:
  - Level 2 description corrected back to user-specified wording `vittuilla` in `LevelManager`.
- Validation:
  - `npm run build` PASS.
  - Playwright smoke command exited 0 once, but captured output currently shows local dev bootstrap/reload race errors in this sandbox (`ERR_EMPTY_RESPONSE`, `ERR_CONNECTION_*`, BootstrapError); visual end-to-end verification should be confirmed on device/local non-sandbox run.
- Note:
  - In provided `final` folder, `tero_afterwork_defeat.mov` was not found (only `tero_afterwork_intro.mov` present).

Update 2026-03-10 (Level 6 defeat video now available and wired)
- New source media appeared in skits final folder:
  - `tero_afterwork_defeat.mov`
- Copied file into project media folder:
  - `public/assets/custom/story/final/tero_afterwork_defeat.mov`
- Updated `src/LevelManager.ts` level 6 boss config:
  - added `bossDefeatVideoUrl: "assets/custom/story/final/tero_afterwork_defeat.mov"`
- Result:
  - Level 6 story transition now uses Tero defeat video via the same config-driven StoryScene flow as other bosses.

Update 2026-03-10 (Title social buttons: app-deeplink first, web fallback)
- `src/scenes/TitleScreen.ts`
  - Added social buttons for Instagram, YouTube, and TikTok in title DOM UI.
  - Added app deep-link constants + web fallback URLs:
    - Instagram: `instagram://user?username=laturaivo`
    - YouTube: `vnd.youtube://channel/UCKRZqZMA55IcmZnqvFcazrQ`
    - TikTok: `snssdk1233://`
  - Added `openExternalAppLink(appUrl, fallbackUrl)`:
    - tries opening app scheme first
    - listens for `blur`/`visibilitychange` to detect successful app switch
    - falls back to web URL after timeout if app is unavailable
  - Bound social button click/touch/pointer events to prevent title start propagation and trigger deep-link flow.
- Added local placeholder social icons:
  - `public/assets/custom/ui/social/instagram-placeholder.svg`
  - `public/assets/custom/ui/social/youtube-placeholder.svg`
  - `public/assets/custom/ui/social/tiktok-placeholder.svg`
- Validation:
  - `npm run build` PASS.
  - Local Playwright smoke command exited 0 once after running dev server in PTY session.
  - Headless screenshot in this sandbox still appears black intermittently; verify visual behavior on device/local unrestricted run.

Update 2026-03-10 (Boss intro/defeat video flow hardening for all bosses)
- Goal: make boss video flow consistent and resilient:
  - Boss spawn -> intro video -> boss card
  - Boss defeat -> defeat video(s) -> story still+text -> next level
- `src/scenes/UIScene.ts` (boss pre-intro video before boss card)
  - Added robust pre-intro video listeners:
    - `playing/timeupdate` marks playback started
    - `ended` advances to boss card
    - `error` advances to boss card (fails safe, no stuck overlay)
  - Added startup guard timeout (`~3.2s`):
    - if video does not begin (no time progress), flow auto-continues to boss card.
  - Increased accidental-skip protection:
    - pre-intro tap-to-skip enable delay `240ms -> 900ms` to prevent instant accidental skips while mashing controls.
  - Added cleanup for all new handlers/timeouts on hide/init.
- `src/scenes/StoryScene.ts` (defeat/interlude video stage before still image text)
  - Added robust playback start handling:
    - tries normal play, then muted play fallback.
  - Added listeners:
    - `playing/timeupdate` marks playback started
    - `ended` moves to next queued video/still stage
    - `error` fails safe to next stage
  - Added startup guard timeout (`~3.2s`):
    - if video never starts, continue automatically (prevents stall).
  - Added cleanup for timers/listeners during video teardown and scene init.
- Validation:
  - `npm run build` PASS.
  - `.tmp_web_game_playwright_client.mjs` smoke command exited `0`.
  - Verified all boss video URLs in `LevelManager` exist on disk under `public/assets/custom/story/final` (0 missing).
  - Visual Playwright capture remains intermittently black in this sandbox environment; end-to-end video behavior should be verified on device/local unrestricted run.
  - iOS sync note:
    - `npm run cap:sync` failed because local Node is `<22`.
    - Node 22 direct CLI invocation also failed (`isInteractive is not a function` in Capacitor CLI runtime).

Update 2026-03-10 (Start intro logo switched to Uber Games logo)
- Updated intro scene logo key in `src/scenes/UberIntroScene.ts`:
  - `uber_logo` -> `uber_games_logo`
- Adjusted intro logo placement/scale to preserve proportions and avoid text overlap:
  - y-position `centerY - 60` -> `centerY - 70`
  - scale bounds `400x150` -> `230x230`
- Validation:
  - `npm run build` PASS.
  - Playwright smoke command exited `0` (known sandbox capture remains intermittently black in this environment).

Update 2026-03-10 (Imported new level interlude stills from external folder)
- Source folder provided by user:
  - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/välikuvat`
- Imported files (renamed to ASCII):
  - `public/assets/custom/story/interludes/level2_3.jpg`
  - `public/assets/custom/story/interludes/level3_4.jpg`
  - `public/assets/custom/story/interludes/level4_5.jpg`
  - `public/assets/custom/story/interludes/level7_8.jpg`
  - `public/assets/custom/story/interludes/level8_9.jpg`
  - `public/assets/custom/story/interludes/level9_10.jpg`
- Updated story image mappings in web packs:
  - `public/assets/asset-pack.json`
  - `public/assets/asset-pack-core.json`
  - Changed keys:
    - `story_level_2` -> `assets/custom/story/interludes/level2_3.jpg`
    - `story_level_3` -> `assets/custom/story/interludes/level3_4.jpg`
    - `story_level_4` -> `assets/custom/story/interludes/level4_5.jpg`
    - `story_level_7` -> `assets/custom/story/interludes/level7_8.jpg`
    - `story_level_8` -> `assets/custom/story/interludes/level8_9.jpg`
    - `story_level_9` -> `assets/custom/story/interludes/level9_10.jpg`
- Mirrored same file copies + mapping updates to iOS embedded web bundle:
  - `ios/App/App/public/assets/custom/story/interludes/*.jpg`
  - `ios/App/App/public/assets/asset-pack.json`
  - `ios/App/App/public/assets/asset-pack-core.json`
- Left unchanged (not present in source folder):
  - `story_level_5` (level 5 -> 6 interlude still)
  - `story_level_6` (level 6 -> 7 interlude still)
- Validation:
  - `npm run build` PASS.
  - Playwright smoke command exited `0`; latest screenshot captured loading screen successfully.

Update 2026-03-10 (boss defeat video ordering fix)
- Fixed StoryScene intro-video skip race that could skip boss defeat videos instantly when transitioning from previous scene tap/click.
- Root cause: intro video could be skipped immediately by carry-over pointer/click event from previous scene transition.
- Change in `src/scenes/StoryScene.ts`:
  - Added `introVideoSkippableAt` guard timestamp.
  - On each intro video start, skip is blocked for ~650ms.
  - Input handler now ignores intro-video advance attempts before `introVideoSkippableAt`.
- Expected behavior restored:
  - boss defeat video -> interlude story card/text -> next level.
- Validation:
  - `npm run build` OK.
  - Quick dev + Playwright smoke run completed (basic launch/click path).

Update 2026-03-10 (tutorial prompt timing + intro bridge fix)
- Moved returning-player tutorial prompt to immediate start-button flow in `NameInputScene.startGame()`.
  - Prompt shown right after pressing Start: `Haluatko pelata tutoriaalitason ensin?`
  - Yes -> start level 1 tutorial.
  - No -> route through `StoryScene` intro bridge before level 2.
- Removed delayed/secondary tutorial prompt from `GameScene.init` to avoid missing/late prompt behavior.
- Confirmed level-2 route from start now uses story intro (`storyKey: "intro"`) which includes `laturaivocinematic1.mov` before gameplay.

Validation 2026-03-10
- `npm run build` ✅

Update 2026-03-10 (Padel/Tennis bouncing enemies)
- Implemented bouncing movement for `PadelPlayer` and `TennisPlayer`.
- Files:
  - `src/entities/PadelPlayer.ts`
  - `src/entities/TennisPlayer.ts`
- Behavior:
  - Added periodic hop tween while moving (cadence scales by aggression tier).
  - Hop is suppressed during hurt/death states.
  - Added cleanup to stop active hop tweens in damage/death/destroy paths.
- Validation:
  - `npm run build` OK.
  - Quick `dev` + Playwright smoke run completed (known existing bootstrap console noise remains in local capture logs).

Update 2026-03-10
- Level-complete music continuity fix:
  - Removed immediate `stopAllMusicPlayback()` call from `GameScene.triggerVictory()` so background music no longer cuts out right when a boss dies / level completes.
  - Behavior now: current level music continues through the level-passed UI, and is stopped on explicit player transition actions (already handled in `VictoryUIScene.goToNextLevel()` / `GameCompleteUIScene.returnToMenu()` via `utils.stopGameplayMusic(...)`).
- Validation:
  - `npm run build` OK.
- iOS sync attempts after this change:
  - `./node_modules/@capacitor/cli/bin/capacitor sync ios` ❌ (`TypeError: LRU is not a constructor` from local semver stack)
  - `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` ❌ (`TypeError: cli.run is not a function`)
- 2026-03-10: Added short music fade-out on level-complete transitions.
  - `VictoryUIScene.goToNextLevel()` now fades gameplay BGM/native fallback (~280ms) before stopping and changing scene.
  - `GameCompleteUIScene.returnToMenu()` now does the same fade-out before stopping scenes.
  - Keeps behavior smooth while still fully stopping music on transition.
  - Validation: `npm run build` OK.
- 2026-03-10: Startup logo switched to SHART EARTH image.
  - Source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/sahrtearth.png`
  - Replaced asset file used by `uber_games_logo`/`uber_logo` in core asset pack:
    - `public/assets/offline/641d4966bf9e31c5d211fa270b90e73dda15518f.png`
  - SHA1 check confirms copied file matches source.
- 2026-03-10: Verified SHART EARTH startup logo in runtime.
  - Playwright check output: `output/logo-switch-check/shot-1.png` (intro scene shows new logo).
  - `npm run build` succeeded.
  - `cap sync ios` succeeded and propagated updated logo to `ios/App/App/public/assets/offline/641d4966bf9e31c5d211fa270b90e73dda15518f.png`.
- 2026-03-10: Tutorial joystick touch pass-through fix.
  - Root cause: tutorial card (`TutorialUIScene`) used `pointer-events-auto` on the whole card, which can overlap the joystick zone on shorter/mobile viewports and block touchstart.
  - Fix: set `#tutorial-card` to `pointer-events-none` and keep only `#tutorial-overlay-skip-btn` interactive via `pointer-events-auto`.
  - File: `src/scenes/TutorialUIScene.ts`.
  - Validation: `npm run build` OK, `npm test` OK (1/1).
- 2026-03-10: Level event visibility/gameplay pass (AALTO + sää eventit).
  - `AALTO` waves now have distinct in-game behavior:
    - `shield_wall`: tankier + steadier wave profile (health/poise up, damage intake down, slower cadence).
    - `rush_pack`: faster + more aggressive wave profile (speed/damage up, cooldown down, lighter HP).
    - Added explicit wave telegraph emphasis (icon/color), short spawn pulse VFX, and MUURI/RUSH tags.
  - `SÄÄPULSSI` now causes clearly noticeable gameplay change:
    - stronger speed/aggro/drain multipliers on forced event pulses,
    - longer forced pulse duration,
    - pulse now always emits visible gameplay telegraph (not just floating text).
    - optional camera preset applied on forced pulses.
  - File: `src/scenes/GameScene.ts`
  - Validation: `npm run build` OK, `npm test` OK (1/1), `cap sync ios` OK.
- 2026-03-10: Added touch dodge/backstep button (`VÄISTÄ`) next to virtual joystick.
  - UI: new `#touch-dodge-btn` in movement controls, wired via existing touch-button pipeline (`UIScene`).
  - Input pipeline: added `dodge` touch input type (`UIScene` -> `GameScene` -> `Player.touchInputState`).
  - Player mechanics: added dodge cooldown and helper methods in `Player`.
  - FSM: new `dodging` state in `PlayerFSM` with quick backstep opposite facing direction, short invulnerability window, and brief momentum lock.
  - Validation: `npm run build` OK, `npm test` OK (1/1), `cap sync ios` OK.
- 2026-03-10: Text/content corrections requested by user.
  - Level title location updated: level 6 now shows `Espoo, Haukilahti` (was `Oulu`).
    - File: `src/scenes/GameScene.ts`
  - Månika boss card description typo adjusted: `vittuilla` -> `vattuilla`.
    - File: `src/LevelManager.ts`
  - PASI boss card description adjusted: `letkutustormi` -> `letku`.
    - File: `src/LevelManager.ts`
  - Added requested line into level 5->6 interlude text:
    - `Lapissa on liian rauhallista, liian vähän raivottavaa. Mies lähtee takaisin Espooseen`.
    - File: `src/scenes/StoryScene.ts`
  - Validation: `npm run build` OK.
- 2026-03-10: Removed boss spotlight beams from boss fight visuals.
  - Deleted spotlight beam trigger + implementation from Peter Kantele disco lighting flow.
  - File: `src/scenes/GameScene.ts`
  - Result: disco color overlay remains, but sweeping spotlight cones are no longer rendered.
  - Validation: `npm run build` OK, `cap sync ios` OK.
- 2026-03-10: Added in-game SFX test screen + initial mix rebalance.
  - New scene `SfxTestScene` (launch from title screen) with:
    - single-key playback buttons for all loaded non-music audio keys,
    - `PLAY ALL` sequential preview,
    - `STOP` and `TAKAISIN` controls,
    - temporary ducking of title music while testing for audibility.
  - Registered runtime scene in `registerRuntimeScenes.ts` and added `TESTAA SFX` button to `TitleScreen`.
  - Global runtime mix tweak in `main.ts` manager play bridge:
    - SFX gain multiplier `1.35x`
    - music-key gain multiplier `0.8x` for direct `sound.play` paths.
  - Lowered gameplay/title music bed:
    - GameScene default background music from `0.6` -> `0.48`
    - level 2/3 boss theme switch calls from `0.62` -> `0.5`
    - TitleScreen BGM/fallback from `0.4` -> `0.32`
  - Raised very quiet airtime cue from `0.0625` -> `0.18`.
  - Validation: `npm run build` OK.
- 2026-03-10: Level 8 crash investigation + hardening pass.
  - Reproduction attempts:
    - Full campaign Playwright run (`.tmp_full_campaign_playthrough.mjs`) did not emit fatal runtime errors; run timed out before late campaign completion.
    - Targeted level-8 probe (start code `HEMOHES8`) completed multiple long runs with no fatal `pageerror`/`console.error` from game code.
  - Defensive fix applied in boss special path to prevent hard crashes from uncaught special-attack exceptions:
    - Wrapped `Boss.performSpecialAttack(...)` per-boss dispatch in `try/catch` and logs `[BossSpecialError]` instead of crashing runtime.
    - Hardened `performGolfSpecialAttack(...)` (used by level 8 `matti_nykanen` and PASI mapping) with additional liveness guards before delayed/tween-complete damage logic.
    - Added safe fallback for damage computation if `player.maxHealth` is invalid, and guarded `takeDamage` call.
  - File:
    - `src/entities/Boss.ts`
  - Validation:
    - `npm run build` OK
    - `npm test` OK (1/1)
    - Level 8 targeted probe rerun (`HEMOHES8`) OK (no fatal errors)
    - `cap sync ios` OK

Update 2026-03-10 (tutorial joystick left/right desync fix)
- Fixed tutorial/mobile joystick movement reliability in `src/scenes/UIScene.ts`:
  - Reset touch/joystick transient state in `init(...)` (left/right touch state, button pressed flags, joystick active/touch id, swipe tracking), so scene restarts cannot inherit stale directional state.
  - Changed joystick horizontal emit behavior to always emit current direction state on move (`left=true/right=false` or `right=true/left=false`), while keeping haptics only on edge transitions.
  - Rationale: prevents GameScene input desync where level could miss the first left/right `pressed=true` signal after scene/state transitions.
- Validation:
  - `npm run build` passed.
  - Ran Playwright touch scenario against local dev server (mobile/touch context): tutorial movement step advanced from `LIIKKUMINEN` to `HYPPY` after simulated joystick left+right drag.

Update 2026-03-10 (dodge button + tutorial step)
- Touch `VÄISTÄ` button visibility/size pass:
  - Increased dodge button size by 50% (`96x96` -> `144x144`).
  - Increased base dodge button opacity to `1`.
  - File: `src/scenes/UIScene.ts`
- Added dedicated dodge phase to tutorial flow:
  - New step id `dodge` with instructions between movement and jump.
  - Added `dodge` flag tracking in tutorial state and completion checks.
  - Wired dodge completion to gameplay event stream by emitting `attackPerformed: { attackType: "dodge" }` when dodge state starts.
  - Files: `src/scenes/TutorialUIScene.ts`, `src/entities/PlayerFSM.ts`
- Validation:
  - `npm run build` passed.

Update 2026-03-10 (boss spotlight removed)
- Removed cinematic boss spotlight cone effect from gameplay visuals.
- Deleted spotlight object lifecycle from `GameScene`:
  - removed `cinematicBossSpotlight` field,
  - removed spotlight graphics creation,
  - removed spotlight cone draw/update path,
  - removed spotlight cleanup/destroy references.
- Left other cinematic layers intact.
- Validation: `npm run build` passed.
- Follow-up: removed remaining boss glow halo (`cinematicBossGlow`) so no spotlight-like boss lighting remains.

Update 2026-03-10 (SFX audibility recovery on iOS)
- Problem targeted:
  - User reported gameplay SFX still effectively silent while music remained audible.
- Root-cause findings:
  - iOS native SFX bridge routed one-shot effects, but native `audio.play()` async rejection path still returned success immediately.
  - When native play rejected, Phaser fallback was not triggered, so effects could remain silent.
  - Combat SFX helper path (`playManagedSound` / `playSoundWithVariation`) preferred `CombatSfxManager` pools (`sound.add(...).play()`), which bypasses manager-level native bridge routing.
- Fixes applied:
  - `src/main.ts`
    - Extended `playIOSNativeSfx(...)` with rejection callback.
    - On native `play()` promise rejection, now triggers async fallback to original Phaser `manager.play(...)` for same key/config.
    - Kept native pool/throttle protections intact (active-voice cap, per-key retrigger guard).
  - `src/utils.ts`
    - `playManagedSound(...)`: on iOS, bypasses legacy `CombatSfxManager` path and uses direct `scene.sound.play(...)` so one-shots consistently go through runtime iOS bridge logic.
    - `playSoundWithVariation(...)`: same iOS bypass strategy for varied one-shot effects.
- Performance and asset weight notes:
  - Existing SFX assets are already lightweight; no conversion/compression pass was necessary in this fix.
  - FPS-risk controls remain in place via native bridge caps and retrigger guard.
- Validation:
  - `npm run build` OK.
  - Full campaign Playwright smoke (`.tmp_full_campaign_playthrough.mjs`) executed with elevated permissions:
    - no fatal runtime/page errors
    - non-fatal expected CDN/DNS errors only
    - gameplay screenshots generated through level 3/boss loops.

Update 2026-03-10 (Turku level funicular removal)
- User request: remove trackside funicular decoration from Turku level.
- Change applied:
  - `src/scenes/GameScene.ts`
    - removed `"turku_funicular"` from `turkuFeatureDecorationKeys` rotation.
- Effect:
  - Level 7 decoration rotation now spawns only `turku_aurajoki_bridge` as the fixed Turku feature.
  - General Turku decoration set remains unchanged.
  - Level 7 moving vehicle replacement (`level_7_funi_vehicle_v2`) was not changed in this task.
- Validation:
  - `npm run build` OK.

Update 2026-03-10 (SFX test UI removal + SFX file audit)
- Removed in-game SFX test entry points:
  - `src/scenes/TitleScreen.ts`
    - removed `TESTAA SFX` button from title menu markup.
    - removed event binding for `#sfx-test-button`.
    - removed `openSfxTest()` launcher method.
  - `src/scenes/registerRuntimeScenes.ts`
    - removed runtime import/registration for `SfxTestScene`.
- Validation:
  - `npm run build` OK.
- SFX asset audit (core pack) generated:
  - report: `output/audio/sfx_audit_core.json`
  - 63/63 SFX keys have existing files and successful ffprobe decode (`brokenCount=0`).
  - 10 keys are non-mp3 (wav/ogg only):
    `combat_pole_01`, `combat_pole_02`, `combat_axe_01`, `combat_axe_02`,
    `combat_combo_01`, `combat_combo_02`, `combat_enemy_hit_01`, `combat_enemy_hit_02`,
    `combat_whoosh_01`, `combat_whoosh_02`.
  - Main audio directories confirmed:
    - `public/assets/audio_local/`
    - `public/assets/audio_local/combat_generated/`
    - `public/assets/music/`
Update 2026-03-10 (remove fog-box artifacts + residual boss spotlight)
- User-reported issue: low-opacity square "fog" boxes visible in gameplay and spotlight-like boss lighting still present.
- Applied hard disable for cinematic overlay system in `src/scenes/GameScene.ts`:
  - `createCinematicVisualLayers()` now destroys/clears cinematic objects and does not create parallax fog bands, dust motes, tint overlays, or gradients.
  - This removes the translucent square/box artifacts originating from cinematic layer rectangles.
  - `updateCinematicVisualLayers(...)` now early-returns when cinematic layers are absent.
- Removed residual boss spotlight-style overlay in final boss arena:
  - `startDiscoLightingEffects()` now no-ops (and clears timer), so no pulsing full-screen disco spotlight overlay is rendered.
- Validation:
  - `npm run build` PASS.
- Visual automation note:
  - `develop-web-game` Playwright client could not be run in this environment because `playwright` package is not installed and network-restricted install is unavailable.
Update 2026-03-10 (stamina depletion punishment restored/tightened)
- User feedback: easy mode felt too forgiving; requested return of stronger punishment when stamina/energy is depleted.
- Updated `src/entities/Player.ts` in `takeDamage(...)`:
  - Kept low-energy damage penalty path and strengthened "fully exhausted" case.
  - Added direct energy drain on every hit (`energyLossFromHit`) so hits also pressure stamina.
  - Added extra energy-drain multiplier when already low/exhausted, making depleted stamina states riskier.
  - `playerHit` event now reports post-hit `energyPercent` after applying hit-related energy drain.
- Validation:
  - `npm run build` PASS.
Update 2026-03-10 (low-stamina punishment scoped to Espoo only)
- Follow-up to previous stamina-pressure change.
- Adjusted `src/entities/Player.ts` `takeDamage(...)` so low-stamina punishments are now active only on difficulty `espoo`:
  - low-energy damage multiplier path gated behind `selectedDifficulty === "espoo"`.
  - per-hit energy drain on damage also gated behind `selectedDifficulty === "espoo"`.
- Result:
  - Espoo: extra punishment when stamina low/exhausted remains active.
  - Vantaa/Lahti: no new stamina-hit penalty from this feature.
- Validation:
  - `npm run build` PASS
  - `npm test` PASS
Update 2026-03-11 (combat SFX MP3 conversion + MP3-first pack ordering)
- Completed the 3 requested audio tasks:
  1) Converted 10 combat-generated SFX to MP3 with ffmpeg:
     - `combat_pole_01/02`, `combat_axe_01/02`, `combat_combo_01/02`, `combat_enemy_hit_01/02`, `combat_whoosh_01/02`
     - Output folder: `public/assets/audio_local/combat_generated/*.mp3`
  2) Updated pack entries so combat keys include MP3 and prefer it first:
     - `public/assets/asset-pack.json`
     - `public/assets/asset-pack-core.json`
     - `ios/App/App/public/assets/asset-pack.json`
     - `ios/App/App/public/assets/asset-pack-core.json`
     - New order for combat keys: `mp3 -> wav -> ogg`
  3) Synced iOS embedded audio assets by copying the new MP3 files to:
     - `ios/App/App/public/assets/audio_local/combat_generated/*.mp3`
- Additional hardening:
  - Normalized *all* audio URL arrays in the same 4 pack files to MP3-first ordering when MP3 exists.
  - Verification summary (`asset-pack-core`): `total=63`, `mp3first=63` (both web and iOS copies).
- Validation:
  - `npm run build` PASS.

Update 2026-03-11 (UGAMES SFX remap + iOS-friendly compression)
- User-provided source SFX folder integrated:
  - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/sfx`
- Added semantic filename-based remap for 33 in-game SFX keys (combat/player/boss-focused), with explicit priority for `Epic Stock Media - Game Character Knight` voice lines on player-related keys (`player_hurt`, `player_jump`, `rage_*`, etc.).
- Generated lightweight converted outputs for mapped keys:
  - Web: `public/assets/audio_local/ugames_sfx/*.mp3|*.ogg`
  - iOS bundle: `ios/App/App/public/assets/audio_local/ugames_sfx/*.mp3|*.ogg`
- Conversion settings:
  - MP3 (iOS-first): mono, 32kHz, 80 kbps (`libmp3lame`)
  - OGG fallback: Opus in OGG container, mono, 48kHz, 48 kbps (`libopus`)
- Updated all 4 asset packs so mapped keys resolve to new files first:
  - `public/assets/asset-pack-core.json`
  - `public/assets/asset-pack.json`
  - `ios/App/App/public/assets/asset-pack-core.json`
  - `ios/App/App/public/assets/asset-pack.json`
- Validation:
  - Mapped-first keys in core pack: 33
  - Missing mapped files: 0
  - `npm run build` passes.
- Notes:
  - Not every legacy SFX key was remapped (33 selected by clear filename semantic fit); unmatched keys still use previous files as fallback.
- Follow-up iOS packaging note:
  - After `vite build` + `cap sync ios`, `dist/assets/audio_local/ugames_sfx` contained only a subset (39/66) while `public` had all 66.
  - To guarantee all mapped new SFX are present in native bundle, copied full folder directly:
    - `rsync -a public/assets/audio_local/ugames_sfx/ ios/App/App/public/assets/audio_local/ugames_sfx/`
  - Post-copy validation in iOS pack: all first two mapped URLs exist (`missingFirstTwoUrls = 0`).
- Added explicit mapping manifest for traceability:
  - `public/assets/audio_local/ugames_sfx/mapping.json`
  - mirrored to `ios/App/App/public/assets/audio_local/ugames_sfx/mapping.json`
- Added script guard so future native sync keeps full UGAMES SFX set in iOS bundle:
  - `package.json`:
    - `sync:ugames-sfx` (rsync full folder)
    - `cap:sync` now runs `npx cap sync ios && npm run sync:ugames-sfx`
- Verification rerun:
  - `npm run build` OK.
  - Manual Node22 Capacitor sync OK (`npx -y node@22 ... capacitor sync ios`) and then `npm run sync:ugames-sfx`.
  - iOS `ugames_sfx` file count now 67 (66 audio + mapping.json).

Update 2026-03-11 (tutorial joystick touch fix)
- Fixed tutorial joystick non-responsive touch behavior in `src/scenes/UIScene.ts` by hardening virtual joystick input routing:
  - Added capture-phase window touch fallback handlers for joystick start/move/end so joystick still tracks even if initial touch target is intercepted by an overlapping DOM layer.
  - Kept joystick touch start on the joystick element itself, but moves/ends are now also handled via window capture to avoid losing tracking when touch leaves joystick bounds.
  - Added helper utilities for touch hit-testing and active touch-id lookup.
  - Added explicit joystick runtime styles for reliability:
    - `joystick.style.touchAction = "none"`
    - `joystick.style.pointerEvents = "auto"`
    - `knob.style.pointerEvents = "none"`
  - Added listener cleanup via new `removeVirtualJoystickListeners()` and called it:
    - before re-binding in `setupVirtualJoystick()`
    - during `shutdown()` to prevent listener stacking across scene restarts.
- Validation:
  - `npm run build` OK.
  - iOS assets synced: `npx -y node@22 ... capacitor sync ios` + `npm run sync:ugames-sfx` OK.
  - develop-web-game Playwright wrapper run completed; screenshots were black in headless capture (known rendering limitation in this environment), so final functional confirmation should be done on device.

Update 2026-03-11 (audio overload/perf stabilization: minimal SFX profile)
- Implemented a global minimal-SFX runtime profile to reduce iOS/audio overload and frame hitches.
- New allowlist (critical-only):
  - `level_complete`
  - `rage_activate`
  - `rage_scream_1..9`
  - `player_hurt`, `player_jump`, `player_land`
  - `combo_hit`, `axe_explosion`
- Centralized gating added in `src/utils.ts`:
  - `isMinimalSfxMode()` + `isSfxAllowed()`
  - `playManagedSound`, `playSoundWithVariation`, `playRandomSoundVariant`, `safePlaySound`, `safeAddSound` now short-circuit for disallowed keys.
- Global sound manager guard added in `src/main.ts`:
  - wrapped `manager.play` now blocks disallowed non-music keys before playback.
- Performance reduction:
  - In minimal mode, `GameScene` no longer initializes `CombatSfxManager` (preload/warmup + voice pool removed).
- Super attack compatibility tweak:
  - `superPoleFrenzy` sound changed from `pole_strike` to allowed `combo_hit`.
- Validation:
  - `npm run build` OK.
  - iOS sync OK (`node@22 capacitor sync ios` + `npm run sync:ugames-sfx`).
- Runtime override options kept:
  - localStorage `laturaivo_sfx_profile = "full"` disables minimal profile.
  - localStorage `laturaivo_sfx_profile = "minimal"` forces minimal profile.

Update 2026-03-11 (silent game + green missing-texture placeholders on iOS)
- Symptom:
  - Game became fully silent and graphics showed Phaser missing-texture pattern (green/black diagonal placeholders).
- Root cause found:
  - iOS web bundle under `ios/App/App/public/assets` was missing both:
    - `asset-pack-core.json`
    - `asset-pack.json`
  - Without these pack files, Preloader cannot load textures/audio keys, causing missing sprites and no SFX/music.
- Additional deployment note:
  - `cap sync ios` must run AFTER a completed `npm run build` (sequentially).
  - Running sync while build artifacts are incomplete can fail copy and leave iOS bundle partially updated.
- Fix applied now:
  1. Rebuilt web assets: `npm run build`
  2. Synced to iOS: `npx cap sync ios` (via node22 wrapper)
  3. Verified pack files exist in iOS bundle:
     - `ios/App/App/public/assets/asset-pack-core.json`
     - `ios/App/App/public/assets/asset-pack.json`
  4. Verified `ios/App/App/public/assets` now also includes `animations.json`, `offline/`, `audio_local/`, etc.
- Expected result:
  - Missing-texture green placeholders should be gone and audio should return (subject to mute toggle state).
- Script hardening:
  - Updated `package.json` scripts to make sync flow safer:
    - `cap:sync` now runs `build` before Capacitor sync.
    - `ios:build` now delegates to `cap:sync`.
  - Note: local `npx cap sync ios` still requires Node >=22 per Capacitor CLI.
Update 2026-03-11 (build ENOTEMPTY dist/assets)
- Symptom:
  - `vite build` failed with `ENOTEMPTY ... rmdir dist/assets`.
- Root cause observed:
  - `dist/assets` had duplicate/extra entries like `animations 2.json`, `asset-pack 2.json`, and a large `custom 2` directory that interfered with Vite outDir cleanup.
- Fix:
  - Cleaned `dist` manually once (`rm -rf dist`).
  - Hardened build script in `package.json`:
    - `build` now runs `rm -rf dist && vite build`.
- Validation:
  - `npm run build` passes.
  - Capacitor sync passes via Node 22 wrapper.
  - `npm run sync:ugames-sfx` passes.
- 2026-03-11: Exported Vesa (level 5 / jari_isometsa) boss sprites into a clean folder for direct access.
  - Created: `public/assets/custom/level5/vesa_sprites/`
  - Copied frames:
    - `tesla_ceo_boss_idle_R_frame1.png`
    - `tesla_ceo_boss_idle_R_frame2.png`
    - `tesla_ceo_boss_walk_R_frame1.png`
    - `tesla_ceo_boss_walk_R_frame2.png`
    - `tesla_ceo_boss_attack_R_frame1.png`
    - `tesla_ceo_boss_attack_R_frame2.png`
- 2026-03-11: Replaced level 5 (Vesa / `jari_isometsa`) boss visuals with user-provided SLIIZU sprites.
  - Source folder used:
    - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/sliizu/keyd`
  - Copied to project:
    - `public/assets/custom/level5/sliizu/sliizu_boss_idle_R_frame1.png`
    - `public/assets/custom/level5/sliizu/sliizu_boss_idle_R_frame2.png`
    - `public/assets/custom/level5/sliizu/sliizu_boss_walk_R_frame1.png`
    - `public/assets/custom/level5/sliizu/sliizu_boss_walk_R_frame2.png`
    - `public/assets/custom/level5/sliizu/sliizu_boss_attack_R_frame1.png`
    - `public/assets/custom/level5/sliizu/sliizu_boss_attack_R_frame2.png`
  - Updated asset keys (`tesla_ceo_boss_*`) to load Sliizu files:
    - `public/assets/asset-pack.json`
    - `public/assets/asset-pack-core.json`
  - Updated level 5 boss card text:
    - Name: `SLIIZU`
    - Description: `Pinkki tukka, punainen kamera, nolla armoa. Yksi salama naamalle ja maine on mennyttä.`
    - File: `src/LevelManager.ts`
  - Validation:
    - `node_modules/.bin/vite build` OK
    - `cap sync ios` OK
- Follow-up: copied full available Sliizu sprite set from source folder into `public/assets/custom/level5/sliizu/` for future animation expansion.
  - Source set contained 15 files (missing `sliizu_boss_spin_attack_R_frame2.png` in provided folder).
- 2026-03-11: Replaced level 10 music with user-provided track.
  - Source file:
    - `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/level10songnew.mp3`
  - Replaced target file used by `level_10_theme`:
    - `public/assets/music/level10_jytky_remix.mp3`
  - Verification:
    - SHA1 match between source and target (`fd03b382e4a08d050f85cedc796cd1b45814ba0a`).
    - `node_modules/.bin/vite build` OK
    - `cap sync ios` OK
- 2026-03-11: Updated two-stage startup splash branding + credits.
  - First splash (`UberIntroScene`):
    - Logo key switched to `uber_intro_logo`.
    - Subtitle text updated to: `www.uber.fi esittää`.
  - Second splash (`SplashScene`):
    - Logo key switched to `shart_earth_logo`.
    - Credits text updated to:
      - `Shart Earth tuotanto,`
      - `Konsepti - Kenneth Sipilä,`
      - `Pelin tuotanto - Mikko Antikainen`
  - Added dedicated logo files:
    - `public/assets/custom/logos/uber_intro_logo.png` (source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/VALMIIT/uber2025/games/ubergames.png`)
    - `public/assets/custom/logos/shart_earth_logo.png` (source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/sahrtearth.png`)
  - Updated pack keys in both packs:
    - `public/assets/asset-pack-core.json`
    - `public/assets/asset-pack.json`
    - `uber_logo` -> `assets/custom/logos/uber_intro_logo.png`
    - `uber_games_logo` -> `assets/custom/logos/shart_earth_logo.png`
    - Added keys `uber_intro_logo` and `shart_earth_logo`.
  - Validation:
    - `node_modules/.bin/vite build` OK
    - `cap sync ios` OK

Update 2026-03-11 (Sliizu attack VFX + impact SFX mute + level/interlude text)
- Added Sliizu camera attack presentation in `src/entities/Boss.ts`:
  - New helper: `triggerSliizuFlashPhoto(targetX?, targetY?)` to render quick flash + temporary polaroid-style "KLIK!" card.
  - Wired into Sliizu special attack sequence (`performTeslaSpecialAttack`) for pre-cast, burst hits, and finisher beat.
  - Rethemed `jari_isometsa` taunts, enrage/hurt lines, and attack names to photographer flavor.
- Added Sliizu photo flashes during regular attack flow in `src/entities/BossFSM.ts`:
  - Trigger on normal attack impact.
  - Trigger on barrage shots (paced every other shot + last shot).
- Disabled impact-heavy SFX globally in `src/utils.ts`:
  - New `DISABLED_IMPACT_SFX_KEYS` guard in `isSfxAllowed(...)`.
  - Blocked keys include `axe_explosion`, `combo_hit`, `punch_hit` and related combat impact variants.
- Updated level/interlude text:
  - `src/LevelManager.ts`: level 5 display name -> `Taso 5 - Lappi`.
  - `src/scenes/StoryScene.ts`: level_4 interlude text replaced with requested 4->5 narrative.
- Validation:
  - `npm run build` passed.

Update 2026-03-11 (Title social: TikTok profile link)
- Updated Title screen TikTok social link constants in `src/scenes/TitleScreen.ts`:
  - `TIKTOK_APP_URL` -> `snssdk1233://user/profile/laturaivogame`
  - `TIKTOK_URL` -> `https://www.tiktok.com/@laturaivogame`
- Validation:
  - `npm run build` passed.

Update 2026-03-11 (Tutorial pause menu + tutorial distance guard)
- Fixed tutorial overlay interfering with pause menu buttons:
  - `src/scenes/TutorialUIScene.ts`
    - Added `syncPausePresentation()` and wired it into poll loop.
    - Tutorial overlay now hides while gameplay is paused (`display: none`) and returns on resume.
    - Tutorial delayed timers (`autoAdvanceTimer`, `completionTimer`) now pause/resume with game pause state.
    - Forced tutorial DOM root wrapper to `pointer-events: none` to prevent full-screen DOM wrapper from blocking pause overlay interactions.
- Added hard safety guard for tutorial distance:
  - `src/scenes/GameScene.ts`
    - In level init, tutorial (`isTutorial`) now uses `Math.max(1200, configuredDistance)`.
    - Prevents regressions where tutorial might accidentally run at old 400m config.
- Validation:
  - `npm run build` passed.
  - `cap sync ios` passed (web assets copied to `ios/App/App/public`).
- iOS verify:
  - `xcodebuild -project ios/App/Laturaivo.xcodeproj -scheme Laturaivo -configuration Debug -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO build` -> BUILD SUCCEEDED.

Update 2026-03-11 (Title background swap only)
- Copied requested image into project:
  - `public/assets/custom/ui/title_menu_background.jpg`
  - source: `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/menu2.jpg`
- Added new asset key `title_menu_background` to:
  - `public/assets/asset-pack-core.json`
  - `public/assets/asset-pack.json`
- Updated `TitleScreen.createBackground()` to use `title_menu_background` with fallback to `snowy_forest_background`.
- No other UI/layout/logic changes.
- Validation:
  - `npm run build` passed.
  - `cap sync ios` passed.

Update 2026-03-11 (Name required + level 5->6 interlude refresh)
- Name entry is now mandatory before game start in `src/scenes/NameInputScene.ts`:
  - Removed fallback default name assignment (`HIIHTÄJÄ`) from `startGame()`.
  - Added input validation state with disabled start button until trimmed name is non-empty.
  - Enter key no longer starts game when name is empty/whitespace.
  - Added inline validation label `Nimi on pakollinen` and focus guard on invalid start attempts.
- Updated level 5 -> 6 story interlude image and text:
  - Added new interlude image file:
    - `public/assets/custom/story/interludes/level5_6.jpg` (copied from `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/sliizudefeat.jpeg`).
  - Rewired `story_level_5` in both pack files:
    - `public/assets/asset-pack.json`
    - `public/assets/asset-pack-core.json`
    - URL now: `assets/custom/story/interludes/level5_6.jpg`
  - Replaced `level_5` story text in `src/scenes/StoryScene.ts` with:
    - `SLIIZU VOITETTU ... Hän lähtee takaisin etelään.`
- Validation:
  - `npm run build` passes.
- Notes:
  - Tried Playwright flow checks; sandbox/network/browser constraints prevented reliable end-to-end scene automation in this turn.

Update 2026-03-11 (Swap levels 9/10 + final boss order + size-growth swap)
- Swapped campaign end boss order so level 10 is now the final Iso Timo fight:
  - `src/LevelManager.ts` boss configs updated:
    - Level 9 -> `peter_sync` (non-final)
    - Level 10 -> `timo_soini` (final)
  - Updated level names + helper flags:
    - `isIceClubArenaLevel(level)` now returns true for level 9
    - `isPeterSyncLevel(level)` now returns true for level 9
- Swapped level 9/10 environment routing to match new order:
  - `src/scenes/GameScene.ts`
    - Background mapping swapped:
      - level 9 -> `level_10_background_kantsu`
      - level 10 -> `level_10_background_keilaniemi`
    - Music mapping swapped:
      - level 9 -> `level_11_theme`
      - level 10 -> `level_10_theme`
    - Location labels swapped:
      - level 9 -> `Chanelmäki`
      - level 10 -> `Espoonlahti`
    - Fallback background candidates adjusted for both levels.
- Peter rescue fallback correctness:
  - In `GameScene.triggerPeterKanniRescuePhase(...)` catch path, `bossDefeated.isFinalBoss` now uses `LevelManager.isLastLevel(currentLevel)` instead of hardcoded `true`.
- Swapped boss combat size growth caps per request:
  - `src/entities/Boss.ts` (Iso Timo cap) -> `2.4`
  - `src/entities/PeterSync.ts` (Peter Sync cap) -> `3.6`
- Updated boss intro portrait fallback by level:
  - `src/scenes/UIScene.ts` level->boss fallback now maps 9 to Peter, 10 to Timo.
- Updated interlude text after level 9 to match new order:
  - `src/scenes/StoryScene.ts` `level_9` now references Peter defeat and setup for final Iso Timo.
- Validation:
  - `npm run build` passes.

Update 2026-03-11 (Main menu social/link text pass + leaderboard scroll fix)
- Updated main menu text in `src/scenes/TitleScreen.ts`:
  - Tagline now fixed to: `Latu on raivo.`
  - Social section heading now: `Laturaivo tarina jatkuu...`
  - Leaderboard button label now: `🏆 TOP RAIVOOJAT`
- Added Discord app/fallback link button to main menu social row:
  - App URL: `discord://invite/ssHFejRejq`
  - Fallback URL: `https://discord.gg/ssHFejRejq`
  - Reused existing external-link open flow (deep-link first, web fallback).
- Updated leaderboard title text in `src/scenes/LeaderboardUIScene.ts`:
  - `🏆 TOP 1000 🏆` -> `🏆 TOP RAIVOOJAT 🏆`
- Leaderboard scrollability hardening in `src/scenes/LeaderboardUIScene.ts`:
  - Forced list container to `overflow-y-scroll` with iOS momentum + pan-y touch action.
  - Added touch/wheel event isolation on `#leaderboard-list` to prevent gesture bleed to underlying scenes.
  - Marked leaderboard rows as `flex-shrink-0` to preserve row height and ensure real overflow.
  - Added click/touchstart propagation stop for search input.
- Validation:
  - `npm run build` passes.

Update 2026-03-11 (Tutorial super-step reliability fix)
- Fixed intermittent tutorial progression misses for supers in `src/scenes/TutorialUIScene.ts`.
- Root issue:
  - Step flags were reset on each step transition, so `attackPerformed` events occurring near transition boundaries could be lost.
- Implemented robust detection for all 2s supers:
  - Added persistent `latchedSuperFlags` for:
    - `tornado` (Myrskyvoltti)
    - `superPole` (Supersauva)
    - `superDash` (Supersyöksy)
  - Latch set from `attackPerformed` event payloads.
  - Added FSM-state fallback in `refreshStepLiveState()`:
    - `tornadoSpinning` -> tornado step complete
    - `superPoleFrenzy` -> superPole step complete
    - `superDashAxeAttacking` -> superDash step complete
  - On entering each step, now prime current step flags from latched values via `primeStepFromLatchedSupers(stepId)`.
  - Added immediate re-evaluation on step enter (`refreshStepLiveState(); evaluateCurrentStep();`) to catch transition-window actions instantly.
- Validation:
  - `npm run build` passes.

Update 2026-03-11 (tutorial pause menu freeze fix)
- Fixed tutorial pause overlay interaction deadlock by hardening pause-menu input handling:
  - `src/scenes/UIScene.ts`
    - In `setupAudioToggle()`, replaced click-only handlers for pause overlay controls with unified `touchend` + `pointerup` + `click` handlers (deduped) for:
      - `#pause-main-menu-btn`
      - `#pause-fake-reply-btn`
      - `#pause-overlay` backdrop (backdrop-only target check)
    - Goal: ensure pause buttons work reliably on iOS/touch where synthetic click timing is inconsistent.
  - `src/scenes/TutorialUIScene.ts`
    - In `syncPausePresentation()`, hide the tutorial DOM root during pause (`root.style.display = "none"`) in addition to hiding `#tutorial-overlay`.
    - Goal: prevent tutorial overlay layer from appearing/interfering while pause menu is open.
- Validation:
  - `npm run build` -> PASS.
  - Playwright smoke (escalated due sandbox browser restrictions):
    - `node .tmp_tutorial_pause_menu_check.mjs` -> PASS (`PASS tutorial pause menu buttons respond to touch/pointer input.`)
    - Flow covered: tutorial start -> pause open -> fake-reply button closes pause -> reopen pause -> main-menu button double tap returns to title screen.

Update 2026-03-11 (tutorial voltti + stamina always-on)
- Added tutorial runtime training overrides in `src/scenes/GameScene.ts`:
  - New helper: `applyTutorialTrainingOverrides()`
  - Called in main update loop:
    - immediately after `player.update(...)`
    - and again right after `updateWeather(...)`
- Behavior in tutorial level (level 1):
  - Stamina/energy is forced to 100% continuously (`player.energy = player.maxEnergy`).
  - Voltti cooldown is continuously reset (`player.volttiCooldownEndsAt = 0`).
- Rationale:
  - Prevent tutorial progression from getting stuck if long-press super attempt fails and normal voltti consumes cooldown.
  - Keep tutorial forgiving and always retryable for voltti/supervoltti practice.
- Validation:
  - `npm run build` passes.

Update 2026-03-12 (Level 6 location/background swap to Oulu)
- Imported new level 6 background image from user-provided path:
  - `public/assets/custom/oulu/backgrounds/level_6_background_oulu.jpeg`
- Rewired level 6 background asset key in both pack files:
  - `public/assets/asset-pack.json`
  - `public/assets/asset-pack-core.json`
  - key changed: `level_6_background_haukilahti` -> `level_6_background_oulu`
- Updated level 6 runtime background mapping in `src/scenes/GameScene.ts`:
  - `getBackgroundKeyForLevel(6)` now returns `level_6_background_oulu`.
- Updated level 6 location label in `src/scenes/GameScene.ts`:
  - `Espoo, Haukilahti` -> `Oulu`.
- Updated level 6 story text in `src/scenes/StoryScene.ts`:
  - `Haukilahti on jäässä.` -> `Oulu on jäässä.`
- Removed remaining Haukilahti mention in level quote pool in `src/scenes/GameScene.ts` to keep naming consistent.
- Validation:
  - `npm run build` passes.

Update 2026-03-12 (asset disappearance + green placeholder boxes + no audio)
- Incident observed by user: assets appeared missing again, green placeholder boxes visible, and audio seemed muted.
- Root cause found in iOS bundle staging:
  - `ios/App/App/public/assets` was effectively empty/partial, while source `public/assets` was intact.
  - Validation showed `public` pack references had 0 missing files, but `ios/App/App/public` had 429 missing pack targets.
- Fix applied (deployment sync, no gameplay code changes):
  - Ran `npm run build`
  - Ran Capacitor sync: `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios`
- Verification after fix:
  - `ios/App/App/public/assets` now contains 874 files.
  - Missing check against both `asset-pack-core.json` and `asset-pack.json` now returns 0 for iOS bundle.
- Notes:
  - This symptom can look like global mute, but here primary cause was missing/copied-out assets in iOS public bundle.
  - If symptom recurs, first action is rebuild + `cap sync ios` and verify iOS public asset count > 0.

TODO
- If user still reports muted audio after this sync, inspect runtime mute toggle state on `UIScene` (speaker button) and iOS audio-context unlock path during first interaction.

Update 2026-03-12 (tutorial jump button UI parity)
- User report: tutorial says "sininen HYPPY-painike" but no dedicated jump button existed on touch UI.
- Implemented dedicated blue jump button in right-bottom attack cluster, placed left of SAUVA button:
  - Added `#touch-jump-btn` to bottom attack row in `src/scenes/UIScene.ts`.
  - Wired button via `setupTouchButton` to emit `touchInput` type `jump` on press/release.
  - Added haptic classification (`medium`) for the jump button.
  - Added readiness opacity logic in `updateTouchAbilityButtonStates` (bright when jump is available on ground).
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK (assets copied to `ios/App/App/public`).

Update 2026-03-12 (tutorial pause-menu freeze hardening)
- User reported tutorial pause menu buttons still freezing.
- Implemented layered fix in `src/scenes/UIScene.ts`:
  - Added `syncTutorialScenePauseState(paused)` and called it from `togglePause()`.
    - On pause: explicitly pauses `TutorialUIScene` when level 1.
    - On resume: resumes `TutorialUIScene`.
  - Raised pause overlay stacking order to stay above tutorial overlays:
    - `#pause-overlay` z-index class changed from `z-[2000]` -> `z-[2600]`.
  - Added guard in `goToMainMenu()` to stop `TutorialUIScene` so it cannot linger over title.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-03-12 (boss damage +30%)
- User request: bosses feel too weak; increase attack damage by 30%.
- Applied global +30% outgoing damage buff for boss classes:
  - `src/entities/Boss.ts`
    - Added `BOSS_DAMAGE_BUFF_MULTIPLIER = 1.3`
    - Updated `BOSS_GLOBAL_DAMAGE_TUNING = 0.28 * BOSS_DAMAGE_BUFF_MULTIPLIER`
    - This scales both regular boss damage baseline and special-attack damage scaling.
  - `src/entities/PeterSync.ts`
    - Added `PETER_DAMAGE_BUFF_MULTIPLIER = 1.3`
    - Updated `PETER_GLOBAL_DAMAGE_TUNING = 0.28 * PETER_DAMAGE_BUFF_MULTIPLIER`
    - This scales Peter's melee/special damage values consistently.
  - `src/entities/KanniBoss.ts`
    - Added `KANNI_DAMAGE_BUFF_MULTIPLIER = 1.3`
    - Applied multiplier to support-boss base `damage` initialization.
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-03-12 (Level 3 music unified to Elsa boss theme)
- User request: Elsa boss-fight track should play from the start of level 3, replacing the normal level 3 track for the entire level.
- Changes in `src/scenes/GameScene.ts`:
  - `getMusicKeyForLevel(3)` now returns `resolveLevel3BossThemeKey()` instead of `level_3_theme`.
  - On create, `level3BossThemeStarted` now auto-detects if current level 3 music key is already Elsa track.
  - In `onBossIntroDismissed(level=3)`, added guard to skip re-switching if Elsa track is already active (prevents restart/stutter).
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-03-12 (super stamina cost retune)
- User request: change super stamina behavior from full drain (100% -> 0%) to leaving ~70% after super (consume ~30%).
- Implemented in `src/entities/PlayerFSM.ts`:
  - Added super energy helpers:
    - `consumeSuperEnergyThirtyPercent()`
    - `enforceSuperEnergyLock()`
    - `clearSuperEnergyLock()`
  - Updated all three super states to use 30% max-energy cost:
    - `enter_superDashAxeAttacking()`
    - `enter_tornadoSpinning()`
    - `enter_superPoleFrenzy()`
  - Removed old forced zero-energy behavior during tornado/superpole updates.
  - Added lock enforcement during super updates so regen does not raise stamina above post-super value mid-attack.
  - Cleared lock on state exits and safety transitions (`skiing`, `jumping`, `hurting`, `dying`).
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-03-12 (super activation hold unified to 1.0s)
- User request: change super activation timing to 1s.
- Updated hold thresholds in `src/entities/Player.ts`:
  - `superDashAxeHoldMs`: 1500 -> 1000
  - `tornadoVolttiHoldMs`: 1200 -> 1000
  - `superPoleHoldMs`: remains 1000
- Updated tutorial copy in `src/scenes/TutorialUIScene.ts` to match:
  - Tornado step text now says `1.0 s`
  - SuperDash step text now says `1.0 s`
- Validation:
  - `npm run build` OK.
  - `cap sync ios` OK.

Update 2026-03-12 (weather notifications silenced, visuals kept)
- Implemented visual-only weather behavior:
  - Removed weather-related floating text/telegraph announcements in `src/scenes/GameScene.ts` (acid rain, snowstorm, legacy weather types, weather spike event labels).
  - Kept weather visuals/mechanics intact (overlays, particles, camera effects, wind audio, stat effects).
- Disabled weather warning HUD in `src/scenes/UIScene.ts`:
  - `applyWeatherWarningState(...)` now force-hides the weather warning element (`display:none`, opacity 0, no pointer events).
  - Weather warning DOM default now includes `display: none` + `pointer-events-none`.
- Validation:
  - `npm run build` passes.

Update 2026-03-12 (Oulu track landmark + level name consistency)
- Removed Oulu-level roadside landmark spawning behavior:
  - Added `shouldSkipTrackLandmarkForLevel(level)` in `GameScene` and skip `spawnLevelLandmark()` when location is `Oulu`.
- Unified level naming text to explicit `Taso X - <paikka>` labels in `LevelManager.getLevelName(...)`.
- Updated level location mapping in `GameScene.getLevelLocationNameForLevel(...)` so level 7 resolves to `Oulu`.
- Updated level 7 background key to `level_6_background_oulu` in `GameScene.getBackgroundKeyForLevel(...)` for consistency with level naming.
- Made `isTurkuLevel()` location-based instead of hardcoded level check.
- UI robustness:
  - Added `level-badge-value` and `level-badge-name` ids in `UIScene`.
  - `UIScene.update(...)` now refreshes level badge text from active `gameScene.currentLevel` every UI tick, preventing missing/stale level name text on level transitions.
- Validation:
  - `npm run build` passes.

Update 2026-03-12 (boss intro video retry behavior)
- Implemented boss intro-video skip on boss retries after player death:
  - `GameScene` now includes `bossRetryDeaths` in `bossSpawned` event payload.
  - `UIScene.showBossWarning(...)` now checks `bossRetryDeaths`; when `> 0`, it skips pre-intro video and shows boss card directly.
- Result: on first boss encounter intro video still plays; on retry after dying to boss, intro video is not shown again.
- Validation:
  - `npm run build` passes.

Update 2026-03-12 (perfect dodge -> one-time boss rage burst)
- Added perfect-dodge trigger path:
  - `Player.takeDamage(...)` now emits `bossPerfectDodge` when a boss hit lands during active dodge i-frames (`fsm.state === "dodging"` + invulnerable).
- Added boss-fight one-time effect in `GameScene`:
  - New per-fight guard `bossPerfectDodgeRageUsed`.
  - New handler `triggerPerfectDodgeBossRage(...)`:
    - announces: "TÄYDELLINEN VÄISTÖ, LATURAIVO AKTIVOITU!"
    - deals 30% of boss max HP as immediate damage
    - applies camera impact + damage number
  - Effect is capped to once per boss fight and reset on new fight/init.
- Wired event flow:
  - `bossSpawned` flow unchanged.
  - `setupBossEvents()` now listens to `bossPerfectDodge`.
  - Shutdown now `off("bossPerfectDodge")`.
- Validation:
  - `npm run build` passes.
- Tweaked perfect-dodge announcement copy to exact requested text: "Täydellinen väistö, laturaivo aktivoitu!".

Update 2026-03-12 (Peter rescue phase + text updates)
- Fixed Peter Kantele second phase trigger (Spice Boys rescue):
  - Removed incorrect final-level gate from `playBossDeathFinale(...)` rescue condition.
  - Rescue now triggers whenever `bossType === "peter_sync"` and it has not triggered already.
- Updated Peter arrival/rescue announcement text when Spice Boys re-enter:
  - "SPICE BOYS IS BACK, VAARALLISEMPANA KUIN KOSKAAN! KAIKKI KUOLEE AIKANANSA!"
- Updated Peter boss card description in `LevelManager` to:
  - "Peter Kantele ei ole ollut synkassa, sitten poikabändi Spice Boysin hajottua. Siksi hän on vaarallinen kuin mikä vatsalihaksineen ja luistimineen."
- Validation:
  - `npm run build` passes.

Update 2026-03-12
- User request: change level 9 -> 10 interlude image.
- Replaced `/public/assets/custom/story/interludes/level9_10.jpg` with source image:
  `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/taso6_oulubg.jpeg`
- No code/path key changes required because `story_level_9` already points to `assets/custom/story/interludes/level9_10.jpg` in both asset packs.
- Validation: `npm run build` passed.

Update 2026-03-12
- User request: Level 2 should use Månika boss song from the very start of the level.
- Changed `GameScene.getMusicKeyForLevel(2)` to return `level_2_boss_theme` (was `level_2_theme`).
- Hardened boss-theme state init so level 2 is marked as already using boss music when that track is active at level boot (`level2BossThemeStarted = currentLevel===2 && musicKey==='level_2_boss_theme'`).
- Validation: `npm run build` passed.

Update 2026-03-12
- Reverted previous level-2 music override per user correction.
- Restored `getMusicKeyForLevel(2)` to `level_2_theme`.
- Restored level 2 boss-theme init flag to `shouldBootWithLevel2BossTheme`.
- Validation: `npm run build` passed.

Update 2026-03-12
- Fixed level transition music carry-over bug in iOS/native audio fallback path.
- Root cause: existing native fallback audio element was resumed even when requested music key changed (e.g. level 9 -> level 10).
- Added `nativeFallbackMusicKey` tracking in `GameScene` and forced fallback track restart when key differs.
- Wired fallback URL starter to receive explicit `key` and log/use that key.
- Teardown now clears both audio element and `nativeFallbackMusicKey`.
- Validation: `npm run build` passed.

Update 2026-03-12
- User request: level 9 music should be `level10songnew`.
- Copied source audio into project music assets:
  - `public/assets/music/level10songnew.mp3`
- Updated `public/assets/asset-pack.json` so `level_11_theme` (used by level 9 in current mapping) points to:
  - `assets/music/level10songnew.mp3`
- Kept level 10 mapping unchanged (`level_10_theme` -> `level10_jytky_remix`).
- Validation: `npm run build` passed.
- Synced iOS bundle: `npx -y node@22 node_modules/@capacitor/cli/bin/capacitor sync ios` (success).

Update 2026-03-12
- User request: level10songnew should play on level 10 baseline; when Iso Timo arrives, switch to DJ Lussu - Jytky as boss fight music.
- Audio routing changes in `src/scenes/GameScene.ts`:
  - Level map updated: level 9 -> `level_9_theme`, level 10 -> `level_11_theme`.
  - Added level-10 boss music handoff in `onBossIntroDismissed`: switches to `level_10_theme` when level 10 boss intro is dismissed.
  - Added `level10BossThemeStarted` guard and startup handling for direct boss-start mode on level 10.
  - Updated level 10 music display title logic:
    - `level_11_theme` => `level10songnew`
    - `level_10_theme` => `Dj Lussu - Jytky (Bass Ventura Tilipaiva REMIX)`
- Asset state:
  - `public/assets/asset-pack.json` keeps `level_11_theme` -> `assets/music/level10songnew.mp3`.
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.

Update 2026-03-12
- User request: remove jump touch button and move dodge button into that slot.
- Updated `src/scenes/UIScene.ts` touch UI:
  - Removed dedicated jump button setup (`touch-jump-btn`) from touch button bindings.
  - Removed jump button readiness opacity handling.
  - Removed jump button haptic mapping branch.
  - Removed left-cluster dodge button from movement controls.
  - Added `touch-dodge-btn` to right attack bottom row in the old jump slot (same size/position style as old jump button).
- Jump action remains available via joystick upward movement / swipe gesture.
- Validation: `npm run build` passed.

Update 2026-03-12
- User report: axe charge did not feel consistent with voltti charge.
- Adjusted super activation energy thresholds in `src/entities/Player.ts` to a single shared 30% stamina threshold for all supers.
  - `superDashAxeEnergyCost`, `tornadoVolttiEnergyCost`, `superPoleEnergyCost` now all use `ceil(maxEnergy * 0.3)`.
- This aligns gating with the existing super stamina model (super keeps 70% stamina after activation) and makes axe charge behavior consistent with voltti gating.
- Validation: `npm run build` passed.

Update 2026-03-12
- User request: set level 9 -> 10 interlude image (under "Peterin disko sammui..." story text) to:
  `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/taso9defeatkvalikuva.jpeg`
- Replaced interlude asset file in project:
  - `public/assets/custom/story/interludes/level9_10.jpg`
- No story key/path changes needed because `story_level_9` already points to `assets/custom/story/interludes/level9_10.jpg`.
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.

Update 2026-03-12
- User request: final level name should be Keilaniemi (not Espoonlahti).
- Updated user-facing level names:
  - `src/LevelManager.ts`: `Taso 10 - Keilaniemi`
  - `src/scenes/GameScene.ts` location mapping: level 10 -> `Keilaniemi`
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.

Update 2026-03-12
- User request: update level 10 non-boss music to:
  `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/taso10_viimeinenlatu.mp3`
- Copied new track into project assets:
  - `public/assets/music/taso10_viimeinenlatu.mp3`
- Updated asset routing in `public/assets/asset-pack.json`:
  - `level_11_theme` -> `assets/music/taso10_viimeinenlatu.mp3`
- Boss music remains unchanged:
  - `level_10_theme` -> `assets/music/level10_jytky_remix.mp3`
  - level 10 boss arrival still switches to `level_10_theme`.
- Updated level 10 baseline music title label in `src/scenes/GameScene.ts` for `level_11_theme` to `taso10_viimeinenlatu`.
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.

Update 2026-03-12
- User request: set a new song for level 9 from:
  `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/UGAMES/level9song.mp3`
- Copied file into project assets:
  - `public/assets/music/level9song.mp3`
- Updated `public/assets/asset-pack.json`:
  - `level_9_theme` -> `assets/music/level9song.mp3`
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.
  - iOS public pack and file verified (`ios/App/App/public/assets/...`).

Update 2026-03-12
- User request: set song metadata labels for all levels.
- Updated `src/scenes/GameScene.ts` -> `getMusicDisplayNameForLevel(...)` to include full mapping:
  - Taso 1: Laturaivo tutorial song (chiptune rmx)
  - Taso 2: RAIVOO OITTAA ANTHEM
  - Taso 2 boss: Månika - Månika! Månika
  - Taso 3: Elsa-Mummo - Elsa-Mummo uzittaa
  - Taso 4: Latukeisari - Latulegenda
  - Taso 5: LappiRAGE ANTHEM
  - Taso 6: OuluRAGE ANTHEM
  - Taso 7: TurkuRAGE ANTHEM
  - Taso 8: FUGERAGE - Spanish guitar RMX
  - Taso 9: HYSTK laturaivo RMX - Kaikki kuolee aikanansa
  - Taso 10: Espoolainen keski-ikäinen mies - Viimeinen laturaivo
  - Taso 10 boss: Dj Lussu - Jytky (Bass Ventura Tilipaiva REMIX)
- Added level 2 boss music title popup when boss intro dismissal switches to `level_2_boss_theme`.
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.

Update 2026-03-12
- User provided updated level 9 song source (`.../UGAMES/level9song.mp3`).
- Replaced project file:
  - `public/assets/music/level9song.mp3` (updated binary, new size/hash)
- Existing routing kept (already correct):
  - `level_9_theme` -> `assets/music/level9song.mp3`
- Validation:
  - `npm run build` passed.
  - `capacitor sync ios` passed.
  - Verified iOS copy matches web asset (same size + SHA1).

Update 2026-03-13
- Loosened boss perfect-dodge trigger window in `src/entities/Player.ts` by extending dodge-perfect timing with a short grace window and debounce against multi-hit spam.
- Boss hits during this short post-dodge grace window now still count as a perfect dodge and will not punish the player immediately.
- Validation 2026-03-13: `npm run build` passed after perfect-dodge easing.
- Validation 2026-03-13: Playwright client loaded the game and captured `output/web-game/shot-0.png`; screenshot remained in early dark title/splash fade, so no full boss-flow verification yet.
- Note 2026-03-13: Console showed existing network/audio bootstrap errors during client run (`ERR_NAME_NOT_RESOLVED`, `TitleScreenAudio bootstrap-timeout`).
Update 2026-03-13
- Updated visible super-ability copy to match current timing: 1s hold to activate, ~2s effect duration.
- Files updated: `src/scenes/UIScene.ts`, `src/scenes/TutorialUIScene.ts`, `src/scenes/GameGuideScene.ts`.
Update 2026-03-13
- Replaced level 9 music asset `public/assets/music/level9song.mp3` with `level9song_cinematic.mp3` from the UGAMES source folder.
Update 2026-03-13
- Added main-menu Game Center auth flow in `src/scenes/TitleScreen.ts` with visible debug badge + toast for auth success/failure.
- Expanded `src/managers/GameCenterManager.ts` to expose detailed auth status, cached session state, and a main-menu-first authentication path.
- Added iOS Game Center entitlement file `ios/App/App/App.entitlements` and wired `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` into both `ios/App/App.xcodeproj` and `ios/App/Laturaivo.xcodeproj`.
- Rebuilt web bundle (`npm run build`) and synced iOS assets (`cap sync ios`).
- Verified with `xcodebuild -showBuildSettings` that `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` is present on the active App target.
- Verified unsandboxed simulator build succeeds for `ios/App/App.xcodeproj` with `CODE_SIGNING_ALLOWED=NO`.
- Playwright title-screen smoke check completed after the TitleScreen change; captured `output/web-game/shot-0.png`. Existing title-screen console errors remain (`ERR_NAME_NOT_RESOLVED`, `TitleScreenAudio bootstrap-timeout`).
Update 2026-03-13
- TitleScreen now re-checks Game Center status after failed/pending auth, so delayed iOS "Welcome back" sign-ins update the in-game badge instead of staying stuck on failure.
- Added friendlier mapping for the Game Center backend error `application is not recognised by Game Center`.

Update 2026-03-13
- Name input now remembers the last non-cheat player name across returns/reloads.
- Changes in `/src/scenes/NameInputScene.ts`:
  - load remembered name from registry first, then `localStorage` key `laturaivo_last_player_name`,
  - prefill `#player-name-input` with that value,
  - persist successful normal names on game start,
  - do not persist boss/god-mode cheat names (`HEMOHES*`, `KIIA40`) as sticky defaults.
- Validation:
  - `npm run build` OK.
  - Playwright regression passed via `/.tmp_name_prefill_check.mjs` against local dev server.
  - Verified screenshot `output/name-prefill-check/name-prefill.png` shows remembered value visible in the input.
- develop-web-game skill client note:
  - direct run of `$WEB_GAME_CLIENT` from the skill folder failed here because that external script could not resolve the project's local `playwright` package when executed outside the workspace module tree.
- 2026-03-13: Created current story DOCX export at `output/doc/Laturaivo_tarina.docx` from `src/scenes/StoryScene.ts`.
- Verification: reopened the DOCX with `python-docx` and confirmed expected paragraphs were present.
- Visual DOCX render check not run in this environment because `soffice` and `pdftoppm` are not installed.
- 2026-03-15: Tutorial abilities + dodge button visibility pass.
- Changes:
  - `Player.ts`: tutorial now bypasses ability unlock checks for axe, rage, dash axe, super dash axe, tornado voltti, super pole, and treats axe/voltti/dodge cooldowns as always ready in tutorial.
  - `GameScene.ts`: tutorial training override now keeps energy full, rage full, and clears axe/voltti/dodge cooldown end times continuously.
  - `UIScene.ts`: tutorial forces all touch ability buttons to full opacity; `touch-dodge-btn` default opacity changed to `1` globally.
- Validation:
  - `npm run build` OK.
  - Local Playwright client run completed; only observed console error was external `ERR_NAME_NOT_RESOLVED`, not tied to this gameplay change.
  - Targeted tutorial regression passed via `/.tmp_tutorial_abilities_check.mjs`; result JSON confirms all five tutorial buttons had opacity `1`, and screenshot `output/tutorial-abilities-check/tutorial-abilities.png` visually matches that.

Update 2026-03-15
- Added difficulty-based media presentation and hard-mode music routing.
- New helper: `/src/content/DifficultyPresentation.ts`
  - `espoo` => story/boss videos disabled
  - `vantaa` => full video presentation enabled
  - `lahti` => full video presentation + hard-mode level music keys
- StoryScene changes:
  - `intro` and level interludes now suppress videos on Espoo.
  - `ending` now uses `story_ending` image.
  - `ending` now prepends Timo defeat video on Vantaa/Lahti.
  - `ending` on Lahti now starts `lahti_story_ending_theme` after the video when the still image/text stage begins.
- UIScene changes:
  - boss pre-intro videos are skipped entirely on Espoo; boss card still shows.
- GameScene changes:
  - level music selection is difficulty-aware.
  - verified level 2 mapping:
    - Espoo -> `level_2_theme`
    - Lahti -> `lahti_level_2_theme`
- Added new assets:
  - hard-mode tracks copied to `public/assets/music/lahti_hard/`
    - `taso2_hard_track.mp3` ... `taso10_hard_track.mp3`
    - `taso11_loppu_timodefeat.mp3`
  - new ending still copied to `public/assets/custom/story/interludes/taso11_valikuva.jpg`
- Asset pack updates:
  - `public/assets/asset-pack.json`
    - added `lahti_level_2_theme` ... `lahti_level_10_theme`
    - added `lahti_story_ending_theme`
    - updated `story_ending` image URL to new still
  - `public/assets/asset-pack-core.json`
    - updated `story_ending` image URL to new still
- Added lightweight debug hook for runtime verification:
  - `window.__laturaivoGame = game` in `src/main.ts`
- Validation:
  - `npm run build` OK
  - Capacitor iOS sync OK
  - Runtime Playwright check via `.tmp_difficulty_media_check.mjs` confirmed:
    - Espoo intro: no video container, story still shown
    - Vantaa intro: video container active for `laturaivocinematic1.mov`
    - Lahti ending: still image `story_ending`, `timo_soini_defeat.mov` configured, music key `lahti_story_ending_theme`
    - level 2 music keys differ correctly by difficulty
- Test artifacts:
  - `/output/difficulty-media-check/result.json`
  - `/output/media-difficulty-client/shot-0.png`
- Known test caveat:
  - Headless screenshots remained black even though runtime scene assertions and DOM checks passed; likely the existing headless canvas-capture issue rather than a new gameplay regression.

Update 2026-03-15
- Replaced NameInputScene returning-player tutorial browser confirm with an in-game modal overlay using explicit Finnish buttons `EI` / `KYLLÄ`.
- Added DOM prompt elements and prompt state handling in `src/scenes/NameInputScene.ts`, removing dependence on system `Cancel / OK` labels.
- Validation:
  - `npm run build` OK.
  - Browser check via `.tmp_tutorial_replay_prompt_check.mjs` confirmed overlay is visible and button texts are `KYLLÄ` and `EI`.
  - Screenshot saved to `output/tutorial-replay-prompt-check/tutorial-replay-prompt.png`.

Update 2026-03-15
- Locked the default regular enemy (`enemy_ski_*`, asset `0fb62f71b3d5ab6dff23859d6de4cdfe845eed7a.png`) to a fixed 30 HP.
- Removed difficulty-based HP scaling from `src/entities/Enemy.ts` for the base regular enemy and preserved 30 HP through combat-profile recalculations in `src/scenes/GameScene.ts`.

Update 2026-03-15
- Diagnosed iOS asset regression after sync: `ios/App/App/public/assets` was left almost empty while `dist/assets` contained the full pack, causing missing-texture green boxes and silent audio.
- Added `sync:ios-assets` script in `package.json` to mirror `dist/assets/` into `ios/App/App/public/assets/`.
- Repaired the current iOS bundle with manual rsync of `dist/assets` and `dist/build_assets`, plus fresh `index.html`, `manifest.json`, and `favicon.ico`.
- Verification after repair: `dist` and iOS bundle both contain 214 offline assets and 216 audio_local files.

Update 2026-03-15
- Added tabloid-style side headline cards to `NameInputScene` instead of centering the new copy.
- Left rail: `Mikä on hänen nimensä?` and `Mistä raivo kumpuaa?!`
- Right rail: `Koko tarina aukeaa pelaamalla kaikki vaikeustasot läpi!`
- Validation:
  - `npm run build` OK.
  - Browser check via `.tmp_name_screen_headline_check.mjs` confirmed the left rail center is at x≈109, right rail center at x≈1175, while the main content stays centered at x≈642.
  - Screenshot saved to `output/name-screen-headline-check/name-screen-headlines.png`.

Update 2026-03-15
- Fixed boss perfect dodge trigger path by routing boss-hit attempt checks through `Player.canProcessBossAttack()` instead of bailing early on `isInvulnerable`.
- This allows dodge invulnerability to still count as a perfect dodge window and emit the boss rage trigger event.
- Applied the fix across boss special/projectile/melee paths in `Boss.ts`, `BossFSM.ts`, `PeterSyncFSM.ts`, and boss-owned melee overlap handling in `GameScene.ts`.
- Reduced boss outgoing damage by 10 entrally in `Boss.ts` and `PeterSync.ts` via global damage tuning multipliers, affecting both normal hits and special attacks.
- Validation:
  - `npm run build` OK.
  - Source audit confirms boss hit paths now call through `canProcessBossAttack()` before damage resolution.

Update 2026-03-15
- Fixed same-session re-entry bug in `NameInputScene`: `isStartingGame` and transient DOM/prompt references now reset in `init()`, so `ALOITA PELI` works again when the name screen is opened again without a full reload.
- Validation:
  - `npm run build` OK.
  - Browser regression via `.tmp_name_reentry_check.mjs` passed: first entry starts normally, second entry in the same session shows `isStartingGame: false`, remembered name `MIKKO`, and `ALOITA PELI` reaches `GameScene` again.

Update 2026-03-17 (splash branding + Ilta-Raivo headlines)
- Restored second splash branding in `/src/scenes/SplashScene.ts`:
  - removed Shart Earth branding from splash 2
  - second splash now uses `uber_intro_logo`
  - credits text now reads:
    - `Über Games tuotanto,`
    - `Konsepti - Kenneth Sipilä,`
    - `Pelin tuotanto - Mikko Antikainen`
- Updated logo aliasing in `/public/assets/asset-pack.json` and `/public/assets/asset-pack-core.json` so `uber_games_logo` resolves to `assets/custom/logos/uber_intro_logo.png`.
- Reworked `/src/scenes/NameInputScene.ts` headline rails from random pool rendering to fixed tabloid-style side rails.
- Added all requested Ilta-Raivo headlines visibly at once on the name-entry screen:
  - `Spice boys?`
  - `Elsa-Mummo terrorisoi Tapiolaa pieruillaan!`
  - `Latukeisari droppasi uuden sinkun`
  - `Månika Stensvik paljastaa parhaat ladut lapsille`
  - `Afterworkillä törppöillyt Timo kertoo kaiken!`
  - `Huippu paparazzi Sliizu häiriköi ihmisiä lapissa!`
  - `JYTKY`
  - `Veropakolainen Fuengirolassa`
- Validation:
  - `npm run build` OK.
  - Visual Playwright check run outside sandbox via `.tmp_splash_name_check.mjs`.
  - Verified second splash shows Uber logo + updated credits.
  - Verified name-entry screen shows 4 left + 4 right headline cards simultaneously.
  - Artifacts:
    - `output/splash-name-check/splash-scene.png`
    - `output/splash-name-check/name-input-scene.png`
    - `output/splash-name-check/result.json`

Update 2026-03-17 (Lahti difficulty level lengths +200m)
- Added centralized Lahti-only distance bonus in `/src/LevelManager.ts`:
  - `LevelManager.LAHTI_DISTANCE_BONUS = 200`
  - `getLevelConfig(level, difficulty)` now returns `distance + 200` when difficulty is `lahti`
- Updated `/src/scenes/GameScene.ts` to always request difficulty-aware level configs so runtime uses the adjusted distances consistently for:
  - initial `levelDistance`
  - timer retuning
  - enemy spawner setup
  - spawn budget calculations
- Added `getSelectedDifficultyTier()` helper in `GameScene` to normalize registry difficulty reads.
- Validation:
  - `npm run build` OK.
  - Runtime Playwright check via `.tmp_lahti_distance_check.mjs` confirmed:
    - level 1: `1200m -> 1400m`
    - level 2: `600m -> 800m`
    - level 10: `1300m -> 1500m`
  - Artifacts:
    - `output/lahti-distance-check/result.json`
    - `output/lahti-distance-check/lahti-level2.png`

Update 2026-03-17 (red-jacket enemy durability fix)
- Investigated the red-jacket level 2 enemy complaint and confirmed via runtime screenshot that the pictured target is the base `regularEnemy` spawn, not a boss/special enemy.
- Root cause was not raw HP alone: `regularEnemy` and `drunk` could still receive combat-profile pressure from role modifiers / wave modifiers / elite/leader logic, making them feel tankier or harsher despite the intended 30 HP cap.
- Updated `/src/scenes/GameScene.ts` combat-profile handling:
  - added `isLightweightEnemy` guard for `regularEnemy` and `drunk`
  - disables wave shield-wall/rush-pack bonuses for those types
  - prevents elite/leader rolls and affixes for those types
  - forces `damageTakenMultiplier = 1`
  - keeps `maxHealth = 30`
  - caps damage to `12`
  - slows attack cadence (`regularEnemy >= 2200ms`, `drunk >= 2600ms`)
  - caps speed (`regularEnemy <= 260`, `drunk <= 60`)
- Validation:
  - `npm run build` OK.
  - Playwright runtime check via `.tmp_lightweight_enemy_check.mjs` on Lahti difficulty confirmed:
    - `regularEnemy`: `30 HP`, `12 dmg`, `2280 ms cooldown`, `260 speed`, `isElite=false`, `isLeader=false`, `damageTakenMultiplier=1`, `affixes=[]`
    - `drunk`: `30 HP`, `12 dmg`, `3078 ms cooldown`, `50 speed`, `isElite=false`, `isLeader=false`, `damageTakenMultiplier=1`, `affixes=[]`
  - Artifacts:
    - `output/lightweight-enemy-check/result.json`
    - `output/lightweight-enemy-check/lightweight-enemies.png`

Update 2026-03-17 (Lahti difficulty aligned with Vantaa)
- Reduced Lahti combat difficulty to match Vantaa while preserving the Lahti-only +200m track extension.
- Updated `/src/scenes/GameScene.ts`:
  - `getDifficultyMultiplier('lahti')` now returns `1.0` (same as Vantaa)
  - `getPlayerHealthMultiplier('lahti')` now returns `1.5` (same as Vantaa)
  - updated inline difficulty comment to reflect “longer tracks only”
- Updated `/src/gameConfig.json` difficulty metadata:
  - `difficultyConfig.lahti.value = 1.0`
  - description now explains Lahti uses Vantaa combat difficulty with longer tracks
- Updated `/src/scenes/NameInputScene.ts` difficulty button copy:
  - Lahti label changed from `Vaikea` to `Pitkä rata`
- Validation:
  - `npm run build` OK.
  - Runtime Playwright check via `.tmp_lahti_vantaa_difficulty_check.mjs` confirmed for level 2:
    - `vantaa`: `difficultyMultiplier=1`, `playerMaxHealth=150`, `levelDistance=600`
    - `lahti`: `difficultyMultiplier=1`, `playerMaxHealth=150`, `levelDistance=800`
  - Visual artifacts:
    - `output/lahti-vantaa-difficulty-check/name-input-difficulty.png`
    - `output/lahti-vantaa-difficulty-check/lahti-level2.png`
    - `output/lahti-vantaa-difficulty-check/result.json`

Update 2026-03-17 (Lahti level 2 track fix + extra +200m)
- Replaced Lahti level 2 hard track source file by overwriting:
  - `/public/assets/music/lahti_hard/taso2_hard_track.mp3`
  - source: `.../UGAMES/latulevelhard/finals/taso2_hard_trackfix.mp3`
- Verified the replacement with SHA-256 checksum match:
  - source hash == destination hash (`d05a39118f1ad0c6f9ac324f99751552d7affbc337aa2e6b4e9bc17e19ea5b19`)
- Increased `LevelManager.LAHTI_DISTANCE_BONUS` from `200` to `400`, so Lahti tracks are now +400m vs base level distances.
- Validation:
  - `npm run build` OK.
  - Runtime Playwright check via `.tmp_lahti_distance_recheck.mjs` confirmed:
    - level 2: `vantaa=600m`, `lahti=1000m`
    - level 10: `vantaa=1300m`, `lahti=1700m`
    - combat parity preserved: `difficultyMultiplier=1`, `playerMaxHealth=150` for both Vantaa and Lahti
  - Artifacts:
    - `output/lahti-distance-recheck/result.json`
    - `output/lahti-distance-recheck/lahti-level2.png`

Update 2026-03-17 (iOS missing assets / green boxes / missing SFX)
- Investigated Xcode runtime logs showing widespread `[AssetLoadError]` entries for `assets/custom/*`, `assets/offline/*`, and some `assets/audio_local/*` files.
- Root cause:
  - iOS bundle at `/ios/App/App/public/` contained stale/incomplete web assets.
  - `asset-pack-core.json` existed in iOS public assets, but many referenced files were missing from the same bundle, which caused missing textures (green Phaser boxes) and missing sounds.
  - Fresh `npm run build` regenerated a correct `dist/assets/` tree including `custom`, `offline`, and full `audio_local`.
- Fix applied:
  - synced the full web bundle with `rsync -a dist/ ios/App/App/public/`, restoring missing iOS asset files and current hashed `build_assets` files.
  - updated `/package.json` so `sync:ios-assets` now copies the full `dist/` bundle into `/ios/App/App/public/` instead of syncing only `dist/assets/`.
- Verification:
  - confirmed these files now exist in iOS bundle:
    - `/ios/App/App/public/assets/custom/main_character_v2/player_ski_idle_R_frame1.png`
    - `/ios/App/App/public/assets/offline/f92e5e4533d0ad7b1f8e084551e2ca96e7d151d4.png`
    - `/ios/App/App/public/assets/audio_local/ui_click_sound.mp3`
    - `/ios/App/App/public/build_assets/index-DmihteP7.js`
  - note: `npm run cap:sync` hit a local tool-environment failure at `npx cap sync ios` in this Codex session after build, so final asset refresh was completed via direct `rsync` into the iOS public bundle.

Update 2026-03-17 (default difficulty changed to Vantaa)
- Changed default difficulty selection from Espoo to Vantaa in `/src/scenes/NameInputScene.ts`.
  - Vantaa button now renders as the initial selected option.
  - `selectedDifficulty` now defaults to `vantaa`.
- Aligned difficulty fallbacks across runtime scenes and helpers so missing registry state now resolves to Vantaa instead of Espoo:
  - `/src/content/DifficultyPresentation.ts`
  - `/src/LevelManager.ts`
  - `/src/scenes/GameScene.ts`
  - `/src/scenes/UIScene.ts`
  - `/src/scenes/StoryScene.ts`
  - `/src/scenes/VictoryUIScene.ts`
  - `/src/scenes/VictoryCutsceneScene.ts`
  - `/src/scenes/GameCompleteUIScene.ts`
- Validation:
  - `npm run build` OK.

Update 2026-03-17 (Lahti boss balance + boss music remap + level 2 power-ups)
- Gameplay / balance:
  - Increased boss health on Lahti difficulty by +20% at boss-spawn adjustment time in `/src/scenes/GameScene.ts`.
  - Moved power-up unlock threshold from level 4 to level 2 in `/src/gameConfig.json`.
- Boss music changes:
  - Added new custom boss tracks:
    - `/public/assets/music/lahti_level_4_boss_theme.mp3`
    - `/public/assets/music/lahti_level_5_boss_theme.mp3`
  - Registered both tracks in:
    - `/public/assets/asset-pack.json`
    - `/src/utils.ts`
    - `/src/main.ts`
    - `/src/scenes/SfxTestScene.ts`
  - Updated `/src/scenes/GameScene.ts` boss music routing:
    - level 4 boss -> `lahti_level_4_boss_theme`
    - level 5 boss -> `lahti_level_5_boss_theme`
    - levels 6-10 boss fights -> use normal non-Lahti level themes (`level_6_theme`, `level_7_theme`, `level_8_theme`, `level_9_theme`, `level_11_theme`)
- Validation:
  - `npm run build` OK.
  - `npm run sync:ios-assets` OK.
  - Playwright runtime check via `.tmp_lahti_balance_check.mjs` confirmed:
    - level 2 power-ups now spawn (`spawned=true`, sample type `euro50`)
    - Lahti boss music keys resolve as intended for levels 4-10
    - Lahti level 4 boss health path captured `rawMaxHealth=3240 -> adjustedMaxHealth=3499`, which matches the new +20% Lahti bonus on top of the existing `0.9` boss baseline adjustment
  - Screenshot artifact:
    - `/output/lahti-balance-check/boss-scene.png`

Update 2026-03-17 (passive health regeneration)
- Added passive player health regen config in `/src/gameConfig.json`:
  - `healthRegenPerTick = 1`
  - `healthRegenIntervalMs = 2000`
- Wired passive health regen into `/src/entities/Player.ts`:
  - player now tracks regen accumulator/tick values
  - regen is processed in `update(...)`
  - accumulator resets on damage so heal cadence restarts cleanly after being hit
- Validation:
  - `npm run build` OK.
  - `npm run sync:ios-assets` OK.
  - Attempted the official `$WEB_GAME_CLIENT` smoke test from the develop-web-game skill, but in this local environment it failed before browser launch because the skill script resolves `playwright` from the skill folder instead of project `node_modules`.
  - Focused Playwright runtime check via `.tmp_health_regen_check.mjs` confirmed:
    - deterministic tick logic: `+1 HP` after first `2000ms` tick, another `+1 HP` after second tick
    - health caps correctly at max health
  - Artifact:
    - `/output/health-regen-check/health-regen-scene.png`

Update 2026-03-17 (Lahti ending screen HEMOHES hint)
- Added a Lahti-only bonus tip block to `/src/scenes/GameCompleteUIScene.ts`.
  - Shown only when the completed difficulty resolves to `lahti`.
  - Explains:
    - `HEMOHES` -> direct first boss fight + god mode
    - `HEMOHES1...HEMOHES10` -> direct boss-fight access
    - `HEMOHES1` means the first boss, i.e. level 2
- Validation:
  - `npm run build` OK.
  - `npm run sync:ios-assets` OK.
  - Focused Playwright UI check via `.tmp_lahti_game_complete_hint_check.mjs` confirmed:
    - hint title visible
    - `HEMOHES` text visible
    - `HEMOHES1...HEMOHES10` text visible
    - level 2 clarification visible
  - Artifact:
    - `/output/lahti-game-complete-hint-check/game-complete-lahti.png`

Update 2026-03-17 (Game Center achievement proposal)
- Added `/docs/GAME_CENTER_ACHIEVEMENTS.md` with a ready-to-use proposal for Game Center achievements.
  - Includes:
    - recommended launch set
    - expansion set
    - stable achievement IDs
    - hidden/non-hidden flag
    - one-shot vs incremental type
    - mapping to existing gameplay stats and events
    - suggested implementation order
- Added cross-reference from `/docs/GAME_CENTER_SETUP.md`.
- No gameplay code changes in this step; docs/spec only.

Update 2026-03-18 (Name input headlines moved inward for iPhone Dynamic Island)
- Adjusted `/src/scenes/NameInputScene.ts` so the side headline rails sit further toward the center on short landscape phone screens.
  - Added a dedicated `@media (max-height: 460px) and (orientation: landscape)` rule.
  - Increased left/right safe spacing with `env(safe-area-inset-left/right)` so iPhone landscape cutouts do not cover the headline cards.
  - Kept the previously added vertical spacing so the screen still breathes well on smaller devices.
- Validation:
  - `npm run build` OK after the layout update.
  - Focused Playwright screenshot check on a narrow landscape viewport confirmed the headline rails moved inward:
    - before: left rail started at about `6.8px` from the left edge
    - after: left rail starts at about `37.4px` in browser viewport, and real iPhone safe-area insets will push it further inward
  - Artifact:
    - `/output/name-input-dynamic-island-check/iphone15-name-input-landscape.png`

Update 2026-03-18 (Name input headline text overflow fix)
- Refined `/src/scenes/NameInputScene.ts` so the newspaper headline cards no longer overflow on short landscape phone layouts.
  - Added `box-sizing: border-box` and `overflow: hidden` to headline cards.
  - Added safe word wrapping with `overflow-wrap`, `word-break`, and `hyphens` for headline text.
  - In the short-landscape media rule, widened the headline rails a bit and reduced card padding/text sizing so long Finnish words fit cleanly.
- Validation:
  - Focused Playwright overflow check reported `overflowingCards: []`.
  - Artifact:
    - `/output/name-input-headline-overflow-check/name-input-headlines-landscape.png`

Update 2026-03-22 (Strix intro + splash branding)
- Replaced the opening splash branding with the provided Strix logo asset.
  - Copied source logo from `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/suber/strix.png` to `/public/assets/custom/logos/strix.png`.
  - Added `strix_logo` to `/public/assets/asset-pack-core.json` and `/public/assets/asset-pack.json`.
- Updated `/src/scenes/UberIntroScene.ts`:
  - intro page 1 now shows the Strix logo
  - text below it is now:
    - `STRIX`
    - `by Über Creative`
    - `uber.fi`
- Updated `/src/scenes/SplashScene.ts`:
  - splash page 2 now uses the Strix logo
  - main text changed to `strix esittää...`
  - removed the old Über Games production-credit block from this page
- Validation:
  - Attempted the official develop-web-game skill client, but in this environment it failed before browser launch because the skill script was executed as CommonJS and could not load its ESM imports.
  - Fallback Playwright scene-check via a local temp script verified both splash pages visually.
  - Artifacts:
    - `/output/strix-intro-check/strix-intro-1.png`
    - `/output/strix-intro-check/strix-intro-2.png`

Update 2026-03-22 (Strix text-only intro refinement)
- Updated `/src/scenes/UberIntroScene.ts` so splash page 1 now reads:
  - `STRIX`
  - `Built for play`
- Removed the remaining `Über Creative` affiliation from splash page 1.
- Updated `/src/scenes/SplashScene.ts` so splash page 2 now reads:
  - `Konsepti - Kenneth Sipilä`
  - `Pelituotanto - Mikko Antikainen`
- Validation:
  - Attempted the official develop-web-game skill client again with `node --experimental-default-type=module`, but it still failed before browser launch because the skill script resolves `playwright` from the skill directory instead of project `node_modules`.
  - Fallback Playwright intro check confirmed the live text content:
    - splash 1: `STRIX`, `Built for play`
    - splash 2: `Konsepti - Kenneth Sipilä`, `Pelituotanto - Mikko Antikainen`
  - Artifacts:
    - `/output/strix-intro-text-check/intro-1.png`
    - `/output/strix-intro-text-check/intro-2.png`

Update 2026-03-23 (Owlfox publisher splash)
- Replaced the startup publisher branding with Owlfox.
  - Copied `/Users/mikkoantikainen/über creative Dropbox/Über Creative/New folder/suber/owlfox.png` to `/public/assets/custom/logos/owlfox.png`.
  - Added `owlfox_logo` to `/public/assets/asset-pack-core.json` and `/public/assets/asset-pack.json`.
- Updated `/src/scenes/UberIntroScene.ts`:
  - page 1 now uses the Owlfox logo
  - version block now reads:
    - `OWLFOX GAMES`
    - `Version 1.0`
    - `© 2026 Über Creative Oy`
- Updated `/src/scenes/SplashScene.ts`:
  - switched the page 2 logo to Owlfox as well, keeping the existing concept/production credit text
- Validation:
  - Attempted the official develop-web-game skill client again; it still failed before browser launch because the skill script cannot resolve `playwright` from the skill directory in this environment.
  - Fallback Playwright intro check confirmed the live text content:
    - splash 1: `OWLFOX GAMES`, `Version 1.0`, `© 2026 Über Creative Oy`
    - splash 2: `Konsepti - Kenneth Sipilä`, `Pelituotanto - Mikko Antikainen`
  - Artifacts:
    - `/output/owlfox-intro-check/intro-1.png`
    - `/output/owlfox-intro-check/intro-2.png`

Update 2026-03-29 (Full script document)
- Compiled the game's narrative script into `/docs/LATURAIVO_KASIKIRJOITUS.md`.
- Included:
  - startup splash texts
  - all `StoryScene` interstitial texts (`intro`, `level_2` ... `level_10`, `ending`)
  - ending screen headline text
  - Lahti bonus hint text
  - repeated level-complete prompt lines
- No gameplay/code changes in this step; documentation only.

Update 2026-04-11 (Player quality-of-life save helpers)
- Added main-menu continue support for campaign saves and boss checkpoints.
- Extended campaign save data with a boss checkpoint level that is recorded when a boss fight starts and cleared when that level is completed.
- Updated Game Over UI with a direct boss retry button when a boss checkpoint exists, plus clearer save continuation wording.
- Added save-complete announcements after level completion.
- Updated saved-game continuation so the player can change difficulty before continuing from the Name Input screen.
- Added a save reset button to the Name Input save panel.
- Added a delayed rage-ready hint when Laturaivo is full but unused.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - `npm test` and a Playwright smoke attempt both hung in this local environment before producing results, so they were stopped.

Update 2026-04-11 (Boss combat variety and anti-pole-ramp)
- Added a shared boss combat director in `/src/scenes/GameScene.ts`.
  - Boss melee damage now passes through a boss-only modifier layer before `takeDamage`.
  - Repeating the same attack family against a boss now gets diminishing returns, with pole hits punished hardest.
  - Basic pole and super pole now act as safer chip options instead of best boss DPS.
  - Boss pole energy/health reward has cooldowns so pole spam cannot sustain indefinitely.
  - Boss telegraphs now open short counter windows with suggested attack types:
    - axe for normal/combo/barrage/super/phase openings
    - voltti for charge/leap/aoe/hazard openings
  - Perfect dodge now opens a boss counter window every time, while the forced Laturaivo activation and 30% boss chunk remain once per boss.
  - Added throttled Finnish feedback texts like `SAUVA EI PURE - VAIHDA!`, `KIRVES NYT!`, `VOLTTI NYT!`, and `AVOIN!`.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - Official `develop-web-game` Playwright client was attempted; direct Node execution fails because the skill script is ESM, and `--experimental-default-type=module` then fails to resolve `playwright` from the skill directory.

Update 2026-04-12 (Menu save panel layout fix)
- Fixed Name Input menu scaling after the campaign save panel addition.
  - Moved difficulty selection above the save continue panel and extra level select panel so difficulty buttons remain reachable.
  - Compacted the save continue panel text/buttons to reduce vertical pressure.
  - Added short-screen CSS for smaller character preview/card and more reliable scroll room around the difficulty section.
- Compacted the Title Screen save continue panel so it does not push the main menu controls down as aggressively.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - Official `develop-web-game` Playwright client still cannot run in this environment: direct Node sees the skill script as CommonJS, and module mode cannot resolve `playwright` from the skill directory.

Update 2026-04-12 (Global game volume reduction)
- Added a shared game master volume multiplier of `0.7` in `/src/utils.ts`.
- Applied the master volume to the Phaser sound manager in `/src/main.ts` during boot and audio wake paths.
- Routed native/HTMLAudio fallback music and video audio through the same master volume helper so cutscenes and iOS fallback audio match the lowered game mix.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - Official `develop-web-game` Playwright client was attempted in module mode and still fails to resolve `playwright` from the skill directory.

Update 2026-04-12 (Pre-launch hardening pass)
- Release hygiene fixes:
  - Made iOS web asset sync destructive for stale files with `rsync --delete --delete-excluded --exclude='.DS_Store'`.
  - Rebuilt and resynced iOS assets; verified `ios/App/App/public` no longer contains stale `assets 2`, `build_assets 2`, Cordova zero-files, or `.DS_Store`.
  - Removed 37 stale `ios/App/App/config N.xml` copies; only `config.xml` remains and project files only reference that file.
- Production-facing polish:
  - Gated HEMOHES/KIIA40 name cheats behind DEV builds or explicit `localStorage.laturaivo_enable_name_cheats=1`.
  - Replaced the production Lahti completion cheat-code copy with an Extra-valikko hint.
  - Updated title footer to `Julkaisija Owlfox · © Über Creative Oy 2026`.
  - Removed remote font CDN fallback from `index.html` so the offline iOS bundle remains self-contained.
  - Updated startup splash consistency: `Version 1.1` and `Konsepti - Kenneth Mikael`.
  - Reworded leaderboard rate-limit comment to remove active-playtest wording.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets && npm run sync:ugames-sfx` passed.
  - Asset audit passed: both asset packs have 0 missing local files; 20 boss/cutscene video refs exist.
  - `npm run ios:xcode:build:sim` passed after the final sync.
  - iOS simulator smoke passed: app launched, main menu rendered, and Name Input screen showed the difficulty buttons within view.
  - `npm test` still hangs before output in the local headless Phaser/Vitest path; stopped manually.
  - Official develop-web-game Playwright client could not complete in this environment: direct execution fails on ESM script loading; stdin/module execution and local Playwright CLI hang before output.
- Remaining release notes:
  - Manual device QA is still required for a full campaign run, cutscene playback, final credits, Game Center, and signed TestFlight archive.

Update 2026-04-14 (Boss axe charge and Level 10 rain background)
- Fixed charged input tracking so the axe hold starts immediately instead of waiting for the axe cooldown.
  - This lets the super axe queue naturally through boss-fight cooldowns and fire once ready, matching the feel of charged voltti.
- Updated the Level 10 `level_10_background_keilaniemi` asset to the new `keilaniemi.png` background.
  - Copied the image into `public/assets/custom/keilaniemi/keilaniemi.png`.
  - Updated both web and core asset packs, then synced the built iOS public bundle.
- Added a Level 10 ambient Keilaniemi rain effect.
  - Uses pooled lightweight rain particles with a subtle storm tint.
  - Does not deal damage or drain energy.
  - Pauses/cleans up with the existing weather timers and low-FPS safety path.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - Asset audit passed: both source and iOS asset packs have 0 missing local files and Level 10 points to `assets/custom/keilaniemi/keilaniemi.png`.
  - `npm run ios:xcode:build:sim` passed.

Update 2026-04-14 (Level 10 background revision)
- Replaced the Level 10 Keilaniemi background asset with `keilaniemi2.png`.
  - Copied the image into `public/assets/custom/keilaniemi/keilaniemi2.png`.
  - Updated both source asset packs so `level_10_background_keilaniemi` points to `assets/custom/keilaniemi/keilaniemi2.png`.
  - Rebuilt and synced the iOS public bundle.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - Asset audit passed: source, dist, and iOS public bundles all contain `keilaniemi2.png`, and both iOS asset packs point to it.

Update 2026-04-14 (Unlimited axe use)
- Removed the axe's hidden 5 second cooldown behavior.
  - `isAxeAbilityReady()` now always returns true.
  - `triggerAxeCooldown()` no longer starts a cooldown.
  - UI readiness no longer waits for an axe cooldown.
- Changed axe energy cost to 0 so the axe behaves as an unlimited weapon instead of a recharging/ammo-like ability.
- Changed charged super axe to require 0 stamina and no longer consume 30% energy on activation.
  - Hold timing and attack animation still gate how often it can be used.
  - Voltti and pole super stamina behavior remains unchanged.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - `npm run ios:xcode:build:sim` passed.

Update 2026-04-16 (Steam desktop first pass)
- Started a Steam desktop packaging path without changing the iOS/Capacitor build.
- Added Electron desktop shell files under `desktop/`.
- Added `VITE_LATURAIVO_STEAM` platform capability flags.
- Added Steam build/package scripts and `STEAM_RELEASE.md`.
- Validation:
  - `npm run build:steam` passed.
  - `npm run steam:smoke` passed.
  - `npm run steam:package:mac` produced `release/steam/Laturaivo-darwin-arm64`.
  - Packaged macOS app smoke-test loaded `dist-steam/index.html`.
  - `npm run build` passed for the iOS/Capacitor web build path.
  - `npm run build:web` passed.
- Notes:
  - Steam stage is about 784 MB because it preserves MOV cutscenes; convert all shipped MOV files to MP4 before Windows/Steam release QA.
  - Steamworks account/app setup, app ID, SteamPipe upload, achievements, Steam Cloud save file path, and controller QA are still pending.

Update 2026-04-14 (Axe 3 second rhythm limit)
- Added a 3 second axe cooldown to prevent continuous axe spamming.
  - Axe still costs 0 energy, so it remains unlimited rather than ammo/stamina based.
  - Normal axe, dash axe, and charged super axe all start the same 3 second rhythm lock.
  - Existing hold-to-charge tracking remains independent from cooldown, so holding through cooldown can still queue a charged axe cleanly.
- Validation:
  - `npm run build` passed.
  - `npm run sync:ios-assets` passed.
  - `npm run ios:xcode:build:sim` passed.

Update 2026-04-16 (Web menu music startup)
- Fixed delayed title/menu music startup in the public web build.
  - The web release can keep title music outside the eager Phaser core pack, so the retry path now restarts the direct HTMLAudio fallback instead of waiting on a missing cached Phaser sound.
  - Added keyboard-triggered audio wake handling for browser players who skip the splash or start the menu with Enter/Space.
  - Kept iOS/Capacitor behavior on the existing native-safe fallback path.
- Validation:
  - Browser smoke in Chromium with autoplay restrictions showed the title theme fallback starting immediately after the first menu interaction.
  - `npm run build` passed for the iOS/Capacitor web bundle path.
  - `npm run build:web` passed for the public Netlify web bundle.
  - `npm run build:steam` passed for the desktop bundle path.
