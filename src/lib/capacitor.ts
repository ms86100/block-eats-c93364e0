import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { preloadHaptics } from '@/lib/haptics';
import { capacitorStorage, migrateLocalStorageToPreferences } from '@/lib/capacitor-storage';
import { restoreAppPreferences } from '@/lib/persistent-kv';

export async function initializeCapacitorPlugins() {
  // On native platforms, migrate existing localStorage tokens and restore preferences.
  // NOTE: Auth storage is now configured at client creation time in supabase/client.ts
  // via capacitorStorage — no runtime patching needed.
  if (Capacitor.isNativePlatform()) {
    try {
      await migrateLocalStorageToPreferences();
      await restoreAppPreferences();
    } catch (e) {
      console.warn('[Capacitor] Failed to initialize native storage:', e);
    }

    // Session restore is handled automatically by the Supabase client
    // via capacitorStorage (configured at client creation time).
    // No manual setSession() needed — it caused a race condition where
    // onAuthStateChange fired before React mounted.
  }

  // Pre-load haptics module (no-op on web, instant on native after this)
  preloadHaptics();

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Ensure WebView renders edge-to-edge; CSS safe-area handles content padding
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F97316' });
  } catch (error) {
    console.error('Error configuring status bar:', error);
  }

  try {
    // Configure keyboard behavior (Android)
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: 'body' as any });
    await Keyboard.setScroll({ isDisabled: false });
  } catch (error) {
    console.error('Error configuring keyboard:', error);
  }

  try {
    // Hide splash screen after a brief delay to ensure app is ready
    await SplashScreen.hide();
  } catch (error) {
    console.error('Error hiding splash screen:', error);
  }
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
