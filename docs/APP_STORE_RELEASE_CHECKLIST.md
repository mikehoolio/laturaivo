# LATURAIVO App Store Release Checklist

## 1) Content and policy
- [ ] Keep player-facing text neutral and non-discriminatory.
- [ ] Remove or disable non-essential taunt/comment systems in production.
- [ ] Verify no slur/profanity appears in story, UI, leaderboard names, or dynamic popups.
- [ ] Ensure age rating answers match actual gameplay (violence language, user content, online interactions).

## 2) Leaderboard safety
- [ ] Run `docs/SUPABASE_SECURE_LEADERBOARD.sql` in Supabase.
- [ ] Confirm `submit_score_secure` exists and is executable by `anon`.
- [ ] Confirm direct `insert` to `leaderboard` is blocked by RLS for clients.
- [ ] Confirm `leaderboard_reports` receives entries from in-app report button.
- [ ] Review reports regularly and remove abusive names/scores.

## 3) Privacy and legal
- [ ] Publish a privacy policy URL and add it to App Store Connect.
- [ ] Fill App Privacy Details using real data collection behavior.
- [ ] Verify third-party SDK privacy manifests are present and accurate.
- [ ] Verify music/art licenses and attribution rights for all assets.

## 4) Game Center + backend
- [ ] Keep Supabase as canonical cross-platform leaderboard.
- [ ] Configure Game Center leaderboard in App Store Connect with ID matching app code (`laturaivo_global` unless changed).
- [ ] Confirm Game Center capability is enabled for the iOS target.
- [ ] Test iOS submission flow: score saved to Supabase and Game Center in one run.

## 5) Stability and performance
- [ ] Run at least one full playthrough on physical iPhone and iPad.
- [ ] Verify no startup black screen, no unhandled JS exceptions, no hard audio failures.
- [ ] Verify scene transitions do not duplicate music or leave stale timers.
- [ ] Test offline -> online recovery for leaderboard refresh and submit.

## 6) Store metadata and QA
- [ ] Screenshots reflect real current gameplay.
- [ ] Description text and feature list match implemented functionality.
- [ ] Privacy/contact/support URLs are valid.
- [ ] TestFlight pass with external testers before production submit.
