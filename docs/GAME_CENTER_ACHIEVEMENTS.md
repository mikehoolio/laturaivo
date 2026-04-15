# Game Center Achievement Proposal

## Goal
- Define a practical, implementation-ready achievement set for Game Center.
- Keep the first release focused on achievements that already map well to tracked gameplay stats and boss events.
- Use `Bronze / Silver / Gold / Platinum` as internal trophy tiers for naming, icon art, and priority.

Note:
- Game Center itself exposes achievements; the trophy tier labels below are a design aid for us.
- Recommended rule: campaign-clear achievements should require `cheatCodeUsed === false` and `godModeActivated === false`.

## Recommended Launch Set

| ID | Name | Tier | Hidden | Type | Unlock Condition |
| --- | --- | --- | --- | --- | --- |
| `gc_tutorial_complete` | Latu Auki | Bronze | No | One-shot | Finish tutorial / level 1. |
| `gc_boss_marja_liisa` | Månika Nurin | Bronze | No | One-shot | Defeat level 2 boss. |
| `gc_boss_timo_soini` | Jytky Katkaistu | Gold | No | One-shot | Defeat level 10 final boss. |
| `gc_campaign_vantaa_complete` | Vantaan Voittaja | Gold | No | One-shot | Complete full campaign on Vantaa. |
| `gc_campaign_lahti_complete` | Lahti Legend | Platinum | No | One-shot | Complete full campaign on Lahti. |
| `gc_campaign_no_cheat` | Paras Laturaivooja | Platinum | No | One-shot | Complete full campaign without HEMOHES / KIIA40 and without god mode. |
| `gc_stomps_25` | Stomp Kone | Bronze | No | Incremental | Perform 25 stomps total. |
| `gc_stomp_combo_5` | Ilmasaapas | Silver | No | One-shot | Reach a 5x stomp combo in one run. |
| `gc_airtime_3s` | Ilmalennon Mestari | Silver | No | One-shot | Stay airborne for at least 3 seconds once. |
| `gc_perfect_landings_10` | Rautalaskeutuja | Silver | No | Incremental | Perform 10 perfect landings total. |
| `gc_powerups_25` | Power-Hullu | Bronze | No | Incremental | Collect 25 power-ups total. |
| `gc_score_100k` | Pistehirviö | Gold | No | One-shot | Reach 100 000 score in a campaign run. |

## Expansion Set

| ID | Name | Tier | Hidden | Type | Unlock Condition |
| --- | --- | --- | --- | --- | --- |
| `gc_boss_elsa_mummo` | Elsa Hiljenee | Silver | No | One-shot | Defeat level 3 boss. |
| `gc_boss_latu_keisari` | Keisari Kaadettu | Silver | No | One-shot | Defeat level 4 boss. |
| `gc_boss_sliizu` | Sliizu Sammuu | Silver | No | One-shot | Defeat level 5 boss. |
| `gc_boss_tero_afterwork` | Afterwork Peruttu | Silver | No | One-shot | Defeat level 6 boss. |
| `gc_boss_pasi` | Pasi Putosi | Silver | No | One-shot | Defeat level 7 boss. |
| `gc_boss_sun_isisa` | Isoisä Jäihin | Silver | No | One-shot | Defeat level 8 boss. |
| `gc_boss_peter_kantele` | Peter Pois Jäältä | Gold | No | One-shot | Defeat level 9 boss. |
| `gc_enemies_250` | Latupuhdistaja | Gold | Incremental | Incremental | Defeat 250 enemies total. |
| `gc_hidden_instant_rage` | Lyhyt Pinna | Bronze | Yes | One-shot | Activate rage within 1.2 seconds after meter becomes full. |
| `gc_hidden_voltti_fail` | Ei Näin | Bronze | Yes | One-shot | Attempt voltti on the ground 10 times. |
| `gc_hidden_no_swear` | Kiroilematon Hiihtäjä | Gold | Yes | One-shot | Stay alive for 120 seconds without triggering the joke no-swear fail state. |

## Best Implementation Order

### Phase 1: easiest with current telemetry
- `gc_tutorial_complete`
- `gc_boss_marja_liisa`
- `gc_boss_timo_soini`
- `gc_campaign_vantaa_complete`
- `gc_campaign_lahti_complete`
- `gc_campaign_no_cheat`
- `gc_stomps_25`
- `gc_stomp_combo_5`
- `gc_airtime_3s`
- `gc_perfect_landings_10`
- `gc_powerups_25`
- `gc_score_100k`

### Phase 2: boss collection + hidden humor achievements
- all remaining boss-specific achievements
- `gc_enemies_250`
- `gc_hidden_instant_rage`
- `gc_hidden_voltti_fail`
- `gc_hidden_no_swear`

## Data Mapping To Current Code

### Already tracked cleanly
- `levelsCompleted`
- `score`
- `enemiesDefeated`
- `sessionStats.totalStomps`
- `sessionStats.maxStompCombo`
- `sessionStats.longestAirtime`
- `sessionStats.powerUpsCollected`
- `sessionStats.perfectLandings`
- `difficulty`
- `cheatCodeUsed`
- `godModeActivated`

### Existing event hooks that are good achievement triggers
- boss kills:
  - `bossDefeated` event in `GameScene`
- player damage / survival:
  - `playerHit`
- rage timing:
  - `rageGained`
  - `rageActivated`
- joke / hidden achievements already half-present in gameplay:
  - `achievementVolttiFailShown`
  - `achievementInstantRageShown`
  - `achievementNoSwearShown`

## Recommended Trigger Rules

- Boss-specific achievements:
  - unlock on `bossDefeated` with matching `bossType`
- Campaign-complete achievements:
  - unlock only when entering `GameCompleteUIScene`
  - require `levelsCompleted >= 10`
  - require correct `difficulty`
- Clean campaign / prestige achievements:
  - require `cheatCodeUsed === false`
  - require `godModeActivated === false`
- Incremental achievements:
  - either persist cumulative counters locally/account-side, or report progressive percentage to Game Center when the tracked stat changes

## Suggested First Real Integration Pass

1. Add `submitAchievement(id, percentComplete, showsCompletionBanner)` to the Game Center bridge.
2. Create a lightweight `GameCenterAchievementManager` wrapper similar to the current score submission manager.
3. Submit one-shot achievements immediately on event.
4. Submit incremental achievements whenever the source stat increases.
5. Gate prestige/campaign achievements behind the no-cheat rule.
