import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Sociva App
 * 
 * SAFE DEFAULT: Production mode (bundled assets) unless explicitly opted into dev.
 * 
 * DEVELOPMENT (set CAPACITOR_ENV=development before `npx cap sync`):
 *   - Live reload from sandbox URL
 *   - Mixed content allowed for local testing
 * 
 * PRODUCTION (default — no env var needed):
 *   - Loads from bundled local assets (no server block)
 *   - No allowNavigation restrictions (prevents silent iOS blocks)
 *   - WebView debugging disabled
 *   - Splash stays until app explicitly hides it
 */

// Safe default: production unless explicitly development.
// This prevents white-screen on device if env var is missing.
const isDevelopment = process.env.CAPACITOR_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'app.sociva.community',
  appName: 'Sociva',
  webDir: 'dist',

  // Only inject dev server when explicitly in development mode
  ...(isDevelopment && {
    server: {
      url: 'https://b3f6efce-9b8e-4071-b39d-b038b9b1adf4.lovableproject.com?forceHideBadge=true',
      cleartext: true,
      hostname: 'sociva.app',
      androidScheme: 'https',
    },
  }),

  // Production: minimal server config, NO allowNavigation
  // Capacitor loads from bundled dist/ assets by default
  ...(!isDevelopment && {
    server: {
      androidScheme: 'https',
    },
  }),

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false, // App controls hide via capacitor.ts
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
    contentInset: 'never',
    preferredContentMode: 'mobile',
    plistOverrides: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: 'Sociva uses your location to verify your residential society membership and show nearby sellers.',
      NSCameraUsageDescription: 'Sociva needs camera access to let you photograph products for listing and upload profile pictures.',
      NSPhotoLibraryUsageDescription: 'Sociva needs photo library access to let you select images for product listings and your profile.',
    },
  },

  // Android-specific configuration
  android: {
    allowMixedContent: isDevelopment,
    captureInput: true,
    webContentsDebuggingEnabled: isDevelopment,
  },
};

export default config;
