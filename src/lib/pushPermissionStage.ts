import { Capacitor } from '@capacitor/core';

/**
 * Two-stage push notification permission strategy:
 *
 * Stage 'none'     → App just installed, no permission requested yet.
 * Stage 'deferred' → User logged in; listeners active but no OS prompt shown.
 * Stage 'full'     → Full permission requested (after first login or manual tap).
 */
export type PushStage = 'none' | 'deferred' | 'full';

const KEY = 'push_permission_stage';

/** Dynamic import of @capacitor/preferences — avoids top-level import on web. */
async function getPrefs() {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function getPushStage(): Promise<PushStage> {
  if (!Capacitor.isNativePlatform()) return 'none';
  try {
    const prefs = await getPrefs();
    if (!prefs) return 'none';
    const { value } = await prefs.get({ key: KEY });
    if (value === 'deferred' || value === 'full') return value;
    return 'none';
  } catch {
    return 'none';
  }
}

export async function setPushStage(stage: PushStage): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const prefs = await getPrefs();
    if (!prefs) return;
    await prefs.set({ key: KEY, value: stage });
  } catch (e) {
    console.warn('[PushStage] Failed to save stage:', e);
  }
}
