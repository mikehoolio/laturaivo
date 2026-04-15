# LATURAIVO Web Deploy

LATURAIVO has two intentionally separate build paths:

- Public web release: `npm run build:web` -> `dist-web`
- iOS/Capacitor release: `npm run build` -> `dist`

Do not deploy the iOS `dist` folder as the public web build. It keeps the original MOV story video payload for the native iOS pipeline.

## Build

```bash
npm install
npm run build:web
```

Output folder:

```text
dist-web
```

Local preview:

```bash
npx vite preview --outDir dist-web
```

## What The Web Build Does

- Enables `VITE_LATURAIVO_WEB_RELEASE=1`.
- Rewrites story video references from `.mov` to `.mp4` at runtime for web.
- Copies web-only MP4 overlays from `public_web` into `dist-web`.
- Removes MOV story videos and `.DS_Store` files from the public web output.
- Leaves the normal iOS build path unchanged.

## Recommended Host

Netlify is the easiest launch target for this project.

Reasons:

- Static Vite output is a direct fit.
- `build:web` / `dist-web` maps cleanly to Netlify build settings.
- The deploy is large but made of sub-25 MB files, which is friendlier to CDN/static hosting than a few huge blobs.
- Rollbacks and preview deploys are simple.

## Netlify

Works well.

Build settings:

```text
Build command: npm run build:web
Publish directory: dist-web
```

Routing:

- No SPA rewrite is required for normal root deployment.
- If you add deep links later, add a fallback from `/*` to `/index.html`.

Caveats:

- The output is still about 565 MB, so first deploys may take time.
- Keep the project on a root domain or subdomain for the least path friction.

## Cloudflare Pages

Works well as a static host.

Build settings:

```text
Build command: npm run build:web
Build output directory: dist-web
```

Routing:

- Root/subdomain deployment is recommended.
- If deploying under a path, retest asset URLs carefully.

Caveats:

- Confirm platform file-size limits before launch. Current `dist-web` has no file over 25 MB.
- Large total asset size may make deploy uploads slower.

## Vercel

Works for static Vite output, but is not the first choice for this build size.

Build settings:

```text
Build command: npm run build:web
Output directory: dist-web
```

Routing:

- Root deployment is recommended.
- No server functions are needed.

Caveats:

- Vercel plans can have static upload limits that make a 565 MB game release awkward.
- Use Vercel if the plan and project limits are confirmed for this payload.

## GitHub Pages

Possible, but not recommended as the primary launch host.

Build:

```bash
npm run build:web
```

Deploy:

- Publish the contents of `dist-web`.
- Prefer a custom domain or root-style Pages setup.

Caveats:

- The deploy is large for a GitHub Pages workflow.
- GitHub Pages subpath deployment must be tested carefully because games often expose hard-to-spot asset path assumptions.
- Do not commit the iOS `dist` payload to a Pages branch.

## Post-Deploy Verification

- Open the deployed URL in a private/incognito window.
- Confirm `manifest.json`, `icons/icon-192.png`, `og-laturaivo.jpg`, and `assets/asset-pack-core.json` return HTTP 200.
- Confirm a story video URL ending in `.mp4` returns `Content-Type: video/mp4`.
- Start the game with mouse/touch and with Enter/Space.
- Complete a short gameplay smoke using keyboard and touch.
- Check browser console for boot, audio, CORS, or missing asset errors.
- Confirm Game Center UI is hidden or inert on web.
- Confirm the iOS pipeline still uses `npm run build` before syncing Capacitor.
