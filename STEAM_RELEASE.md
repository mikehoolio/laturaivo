# Laturaivo Steam Release

This is the first desktop/Steam packaging pass. It keeps the Phaser/Vite game shared with web and iOS, then wraps the Steam build in Electron for a normal desktop executable.

## What Exists Now

- `npm run build:steam` builds `dist-steam` with `VITE_LATURAIVO_STEAM=1`.
- `npm run steam:run` builds and launches the Electron desktop shell locally.
- `npm run steam:smoke` builds and verifies that Electron can load `dist-steam/index.html`.
- `npm run steam:stage` creates a minimal Steam staging app in `release/steam/LaturaivoSteamStage`.
- `npm run steam:package:mac` packages a local macOS app folder in `release/steam`.
- `npm run steam:package:win` and `npm run steam:package:linux` are ready for Windows/Linux packaging, preferably on matching CI or hardware.

## iOS Safety

The iOS/Capacitor path is unchanged:

- iOS still uses `npm run build` -> `dist`.
- Capacitor still syncs `dist` through the existing `cap:sync` flow.
- The Steam path uses `dist-steam` and Electron files under `desktop/`.
- Game Center remains gated to native iOS through `GameCenterManager`.

## Local Commands

```bash
npm run build:steam
npm run steam:smoke
npm run steam:run
npm run steam:package:mac
```

For Windows packaging, run this on Windows for the safest output:

```bash
npm ci
npm run steam:package:win
```

The folder SteamPipe should upload is the packaged app output under `release/steam`, not the raw source repo.

## Steamworks Setup Still Needed

These steps require the Steamworks account owner:

- Pay the Steam Direct app fee.
- Create the Steam app and note the app ID.
- Configure store page, capsule art, screenshots, trailer, pricing, tags, and content survey.
- Configure depots for Windows first, then macOS/Linux if desired.
- Upload the packaged build with SteamPipe.
- Test from the Steam client on a private branch.
- Submit store page and build to Valve review.

## Next Engineering Pass

- Add controller/gamepad support and controller glyph copy.
- Add a proper in-game settings panel for fullscreen/windowed, audio, and controls.
- Convert every shipped `.mov` cutscene to `.mp4` for Windows/Linux desktop compatibility.
- Add Steamworks SDK integration for achievements, leaderboards, and rich presence.
- Move saves from browser `localStorage` to a JSON save file that can be configured for Steam Cloud.
- Test Windows, Steam Deck, and offline launch.

## SteamPipe Notes

Steam does not need a separate installer. Upload the packaged build folder as a depot, then test it through the Steam client before release.

Keep large media files stable between builds when possible. SteamPipe patches binary deltas, but renaming or repacking large assets can make updates unnecessarily large.
