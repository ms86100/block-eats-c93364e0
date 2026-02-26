import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { preloadHaptics } from '@/lib/haptics';
import { capacitorStorage, migrateLocalStorageToPreferences } from '@/lib/capacitor-storage';
import { supabase } from '@/integrations/supabase/client';
import { restoreAppPreferences } from '@/lib/persistent-kv';

export async function initializeCapacitorPlugins() {
  // Swap Supabase auth storage to persistent native storage before any auth calls.
  if (Capacitor.isNativePlatform()) {
    try {
      (supabase.auth as any).storage = capacitorStorage;
      await migrateLocalStorageToPreferences();
      await restoreAppPreferences();
    } catch (e) {
      console.warn('[Capacitor] Failed to set persistent auth storage:', e);
    }

    // Manual session restore — isolated so a failure here doesn't block the app
    try {
      const storageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
      const raw = await capacitorStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed;
        if (session?.access_token && session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }
    } catch (sessionErr) {
      console.warn('[Capacitor] Manual session restore skipped:', sessionErr);
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
