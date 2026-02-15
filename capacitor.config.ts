import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Sociva App
 * 
 * Environment-aware: automatically switches between dev and production modes.
 * 
 * DEVELOPMENT (default in Lovable / local dev):
 *   - Live reload from sandbox URL
 *   - Mixed content allowed for local testing
 * 
 * PRODUCTION (set CAPACITOR_ENV=production before `npx cap sync`):
 *   - Loads from bundled local assets (no server block)
 *   - Mixed content blocked
 *   - WebView debugging disabled
 * 
 * DEEP LINKING:
 *   - iOS: Replace TEAM_ID in public/.well-known/apple-app-site-association
 *   - Android: Replace SHA256_FINGERPRINT_PLACEHOLDER in public/.well-known/assetlinks.json
 */

const isProduction = process.env.CAPACITOR_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'app.sociva.community',
  appName: 'Sociva',
  webDir: 'dist',

  // Development: live reload from Lovable sandbox
  // Production: omitted — loads from bundled assets
  ...(!isProduction && {
    server: {
      url: 'https://b3f6efce-9b8e-4071-b39d-b038b9b1adf4.lovableproject.com?forceHideBadge=true',
      cleartext: true,
      hostname: 'sociva.app',
      androidScheme: 'https',
    },
  }),

  // Restrict WebView navigation in production
  ...(isProduction && {
    server: {
      androidScheme: 'https',
      allowNavigation: [
        'rvvctaikytfeyzkwoqxg.supabase.co',
        'block-eats.lovable.app',
      ],
    },
  }),

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      iosSplashResourceName: 'LaunchScreen',
      showSpinner: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#F97316',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },

  // iOS-specific configuration
  ios: {
    scheme: 'sociva',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    // Skip App Store encryption compliance prompt — app only uses HTTPS (Apple's built-in TLS)
    // All custom crypto (AES-GCM) runs server-side in edge functions, not in the app binary
    plistOverrides: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  // Android-specific configuration
  android: {
    allowMixedContent: !isProduction,
    captureInput: true,
    webContentsDebuggingEnabled: !isProduction,
  },
};

export default config;
