import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fi.ubercreative.laturaivo',
  appName: 'LATURAIVO',
  webDir: 'dist',
  // iOS-specific configuration
  ios: {
    // Disable content inset adjustments
    contentInset: 'never',
    // Disable link previews
    allowsLinkPreview: false,
    // Disable scrolling in WebView
    scrollEnabled: false,
    // Keep default navigation policy; app-bound domains can break external asset loads.
    limitsNavigationsToAppBoundDomains: false,
    // Prefer WKWebView (default and required for App Store)
    preferredContentMode: 'mobile'
  },
  // Disable server configuration - fully offline static app
  server: {
    // No hostname - uses local files only
    iosScheme: 'capacitor'
  },
  // Disable plugins that require permissions we don't need
  plugins: {}
};

export default config;
