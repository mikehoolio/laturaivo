# latu2 iOS ready

This folder has been validated for iOS:
- Capacitor iOS project exists in `ios/`
- web assets sync into `ios/App/App/public`
- Xcode simulator build has passed (`BUILD SUCCEEDED`)

## Canonical iOS project

Use only:
- `ios/App/Laturaivo.xcodeproj`
- scheme `Laturaivo`
- bundle ID `fi.ubercreative.laturaivo`

Legacy wrapper:
- `ios/App/App.xcodeproj`
- compatibility alias that now points to `ios/App/Laturaivo.xcodeproj`
- old standalone wrapper archived at `ios/App/_legacy/App.xcodeproj.backup`
- still use `Laturaivo.xcodeproj` for release, Game Center, and App Store builds

## Open in Xcode

```bash
cd "/Users/mikkoantikainen/Documents/New project/latu2_ios_ready"
npm run ios:open
```

Or open directly:
- `ios/App/Laturaivo.xcodeproj`

## Useful iOS commands

```bash
cd "/Users/mikkoantikainen/Documents/New project/latu2_ios_ready"
npm run ios:xcode:show-settings
npm run ios:xcode:build:sim
npm run ios:xcode:archive
```

## Important before release

1. Build and archive from `Laturaivo.xcodeproj` with scheme `Laturaivo`.
2. Select the correct Apple Developer Team in Signing & Capabilities.
3. Keep bundle ID as `fi.ubercreative.laturaivo` unless you are intentionally changing the production app identity.
4. Increment version/build number before each upload.
