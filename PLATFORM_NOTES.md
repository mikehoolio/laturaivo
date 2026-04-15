# LATURAIVO Platform Notes

LATURAIVO remains one Phaser/Vite game shared by web and iOS. The web release work is layered around platform capabilities and a separate web build script rather than a native rewrite.

## Build Paths

Public web:

```bash
npm run build:web
```

- Uses `VITE_LATURAIVO_WEB_RELEASE=1`.
- Outputs to `dist-web`.
- Uses MP4 story videos from `public_web`.
- Removes MOV story videos from the public web output.

iOS/Capacitor:

```bash
npm run build
npm run cap:sync
```

- Outputs to `dist`.
- Keeps the existing iOS-compatible asset set.
- Keeps story video URLs on the original MOV path.

## Platform Capability Layer

`src/platform.ts` centralizes runtime decisions:

- `isWeb`
- `isIOS`
- `isCapacitorIOS`
- `isMobile`
- `hasTouch`
- `hasKeyboard`
- `supportsGameCenter`
- `isWebReleaseBuild`

Use this layer for new platform checks instead of adding fresh user-agent checks inside scenes.

## Web Behavior

- Touch, mouse, and keyboard are supported.
- Desktop title screen starts with click/tap or Enter/Space.
- Desktop gameplay maps keyboard events into the existing gameplay input path.
- Touch controls are shown only on touch-capable devices.
- Keyboard input clears on blur/visibility changes to avoid stuck movement.
- Story videos resolve to MP4 in `build:web`.
- Game Center is not supported on web and remains hidden/inert through existing graceful fallback behavior.
- Supabase-backed online managers are loaded asynchronously after boot to keep initial JS smaller.

## iOS Behavior

- iOS still uses the normal `npm run build` path and Capacitor `dist` sync.
- iOS still sees `isMobile=true` and touch controls.
- iOS still uses existing MOV story video references.
- Game Center support remains native-iOS-only.
- Audio unlock and native fallback behavior remain in the existing iOS code paths.

## Native Features Disabled On Web

- Game Center authentication.
- Game Center score submission.
- Game Center achievement submission.
- Native iOS-only haptics and native audio fallbacks when not available.

Web-safe systems that remain available:

- Local storage saves.
- Local leaderboard fallback.
- Supabase leaderboard/auth/challenge/tournament managers where network access and configuration allow.

## Known Web Caveats

- The public web build is still large at about 565 MB.
- `assets/music` is about 164 MB and should be the next optimization target.
- `assets/custom` is about 238 MB in `dist-web`; further pruning needs asset-pack reachability work.
- Main JS is still large at about 1.52 MB minified / 353 kB gzip.
- Browser QA must still be completed manually on real Safari, Firefox, Chrome, iPhone Safari, and Android Chrome before launch.
- Playwright automation was attempted locally but the installed Playwright package hung during import in this workspace, so automated browser screenshots were not completed in this pass.
