# LATURAIVO Web Release Checklist

Use this checklist against the public web build:

```bash
npm run build:web
npx vite preview --outDir dist-web
```

The iOS/Capacitor build remains the normal build:

```bash
npm run build
npm run cap:sync
```

## Browser QA

- Chrome desktop: boot reaches the title screen, no fatal console errors, canvas renders.
- Safari desktop: boot reaches the title screen, title music unlocks after first click/tap.
- Firefox desktop: boot reaches the title screen, MP4 story videos play or fail gracefully.
- Chrome Android: portrait/landscape transition does not break layout.
- Mobile Safari: first tap unlocks audio, background/resume does not leave the game muted forever.
- Hard refresh after deploy loads `index.html`, `build_assets/*`, `assets/asset-pack-core.json`, and app icons.

## Audio Checks

- First click/tap starts or unlocks title audio.
- Mute button works on title and gameplay UI.
- `M` toggles mute during gameplay on desktop.
- Tab away and return resumes music or leaves it intentionally muted if the player muted it.
- Safari/iOS WebKit does not throw repeated audio unlock errors after resume.

## Controls Checks

- Touch controls still appear and work on mobile/touch devices.
- Desktop does not show the mobile movement/attack pads unless the device is touch-capable.
- Title screen starts with click/tap and Enter/Space.
- Gameplay keyboard controls:
  - Move: ArrowLeft/ArrowRight or A/D.
  - Jump: ArrowUp, W, or Space.
  - Dodge: ArrowDown, S, or Shift.
  - Pole: J or Z.
  - Axe: K or X.
  - Voltti: L or C.
  - Rage: R or V.
  - Pause: Escape or P.
  - Mute: M.
- Keyboard state clears when the browser tab loses focus.
- Mouse/pointer clicks work on title buttons, leaderboard, guide, pause, and mute controls.

## Fullscreen And Resize

- Desktop resize keeps the Phaser canvas visible and centered.
- Mobile orientation changes do not strand DOM controls offscreen.
- Browser fullscreen, if entered manually by the player, does not hide pause/mute controls.
- Safe-area viewports do not cover core actions on notched iPhones.

## Mobile Web

- iPhone Safari: boot, title click, name entry, first gameplay level.
- Android Chrome: boot, title click, name entry, first gameplay level.
- Touch movement and attacks do not double-trigger from pointer/touch event overlap.
- Backgrounding the tab pauses or safely resumes without stuck movement.

## Desktop Web

- Chrome/Firefox/Safari: start game, enter name, move, jump, attack, pause, resume.
- Leaderboard screen scrolls with wheel and does not start the game behind it.
- Guide and social buttons are clickable and do not trigger title start.
- No hover-only interactions are required for core actions.

## Performance Sanity

- `npm run build:web` stays under the current expected output size of about 565 MB.
- Main JS chunk should be watched; current web build is about 1.52 MB minified / 353 kB gzip.
- `dist-web/assets/custom/story` should contain MP4 files and no MOV files.
- `dist-web` should contain no `.DS_Store` files.
- No single deployed asset should exceed 25 MB unless the selected host explicitly allows it.

## Launch Day

- Build with `npm run build:web`.
- Upload only `dist-web` for the public browser release.
- Smoke test the deployed URL in Chrome, Safari, Firefox, iPhone Safari, and Android Chrome.
- Verify story videos use `.mp4` URLs on web.
- Verify the iOS build still uses the normal `npm run build` path before any App Store sync.
- Check social preview metadata with a public URL.
- Keep the previous deployment available for rollback.
