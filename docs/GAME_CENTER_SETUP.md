# Game Center Setup (Supabase + Apple)

## Goal
- Supabase remains the primary cross-platform leaderboard.
- Game Center is a secondary iOS-native leaderboard endpoint.
- Achievement proposal/spec lives in `docs/GAME_CENTER_ACHIEVEMENTS.md`.

## Required App Store Connect steps
1. Enable Game Center for the app identifier.
2. Create a leaderboard in App Store Connect.
3. Use the same leaderboard ID in app code (`src/managers/GameCenterManager.ts`).
4. Add Game Center capability in Xcode target signing/capabilities.
5. Attach the leaderboard to the app version before review.

## Runtime behavior in this project
- App always submits to Supabase leaderboard manager (if eligible).
- On iOS, app also submits to Game Center when authenticated.
- If Game Center is unavailable, gameplay and Supabase flow continue without crash.

## Validation checklist
- [ ] iOS device logs show successful `GameCenter` authentication.
- [ ] Final campaign score appears in Supabase leaderboard.
- [ ] Same run appears in Game Center leaderboard.
- [ ] Cheat-code sessions are rejected from leaderboard submission.
