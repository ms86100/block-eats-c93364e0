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
 *   - WebView debugging disabled
 *   - Splash auto-hides as safety net
 */

const isProduction = process.env.CAPACITOR_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'app.sociva.community',
  appName: 'Sociva',
  webDir: 'dist',

  // Dev server only when NOT in production
  ...(!isProduction && {
    server: {
      url: 'https://b3f6efce-9b8e-4071-b39d-b038b9b1adf4.lovableproject.com?forceHideBadge=true',
      cleartext: true,
      hostname: 'sociva.app',
      androidScheme: 'https',
    },
  }),

  // Production: minimal server config with allowNavigation for Supabase/app domains
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
    contentInset: 'never',
    // Force CocoaPods so Firebase pod injection scripts work
    packageManager: 'cocoapods' as any,
    preferredContentMode: 'mobile',
    plistOverrides: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: 'Sociva uses your location to verify your residential society membership and show nearby sellers.',
      NSCameraUsageDescription: 'Sociva needs camera access to let you photograph products for listing and upload profile pictures.',
      NSPhotoLibraryUsageDescription: 'Sociva needs photo library access to let you select images for product listings and your profile.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'Sociva uses your location to verify your residential society membership and show nearby sellers, even in the background.',
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
