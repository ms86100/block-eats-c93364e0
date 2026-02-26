import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { preloadHaptics } from '@/lib/haptics';
import { capacitorStorage, migrateLocalStorageToPreferences } from '@/lib/capacitor-storage';
import { supabase } from '@/integrations/supabase/client';

export async function initializeCapacitorPlugins() {
  // Swap Supabase auth storage to persistent native storage before any auth calls.
  // On web this is a no-op (adapter falls back to localStorage).
  // Must happen before React mounts so useAuthState reads from the right storage.
  if (Capacitor.isNativePlatform()) {
    try {
      // Patch the internal auth storage on the existing client instance
      (supabase.auth as any).storage = capacitorStorage;
      // Migrate any existing localStorage tokens so users aren't logged out
      await migrateLocalStorageToPreferences();
    } catch (e) {
      console.warn('[Capacitor] Failed to set persistent auth storage:', e);
    }
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
