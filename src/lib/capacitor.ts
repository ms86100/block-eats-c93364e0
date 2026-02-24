import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initializeCapacitorPlugins() {
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
