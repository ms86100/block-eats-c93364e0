
# Phase 4: App Store & Play Store Deployment Readiness
## Complete Implementation Plan for BlockEats v1.4

---

## Executive Summary

This plan addresses all gaps identified in the current implementation to make BlockEats fully compliant and ready for submission to the Google Play Store and Apple App Store.

### Current Status Overview

| Category | Status | Details |
|----------|--------|---------|
| Capacitor Core | ✅ Complete | Installed and configured |
| Privacy Policy | ✅ Complete | Full legal page implemented |
| Terms & Conditions | ✅ Complete | Full legal page implemented |
| Community Notice | ✅ Complete | Auth page shows resident-only message |
| App Icons | ✅ Complete | All icons generated (192, 512, apple-touch, favicons, og-image) |
| Splash Screen | ✅ Complete | Plugin installed, initialized, splash-screen.png created |
| Push Notifications | ✅ Complete | Plugin installed, device_tokens table, hooks & provider |
| Offline Handling | ✅ Complete | useNetworkStatus hook + OfflineBanner component |
| Store Metadata | ✅ Complete | STORE_METADATA.md created with all listing content |

---

## Implementation Complete ✅

All Phase 4 items have been implemented:

### Files Created
- `public/android-chrome-192x192.png` - Android app icon
- `public/android-chrome-512x512.png` - Android app icon (large)
- `public/apple-touch-icon.png` - iOS home screen icon
- `public/favicon-16x16.png` - Browser favicon
- `public/favicon-32x32.png` - Browser favicon
- `public/og-image.png` - Social media preview (1200x630)
- `public/splash-screen.png` - Native app splash screen
- `src/hooks/useNetworkStatus.ts` - Network connectivity hook
- `src/hooks/usePushNotifications.ts` - Push notification handler
- `src/components/network/OfflineBanner.tsx` - Offline indicator UI
- `src/components/notifications/PushNotificationProvider.tsx` - Push notification wrapper
- `src/lib/capacitor.ts` - Capacitor plugin initialization
- `STORE_METADATA.md` - App store listing content

### Files Modified
- `src/main.tsx` - Initialize Capacitor plugins
- `src/App.tsx` - Added OfflineBanner and PushNotificationProvider
- `capacitor.config.ts` - Added PushNotifications config

### Database Migration
- `device_tokens` table created with RLS policies

### Dependencies Added
- `@capacitor/splash-screen`
- `@capacitor/status-bar`
- `@capacitor/push-notifications`

---

## Demo Account Setup (Manual Step Required)

To create the demo account for App Store reviewers, you need to:

1. Go to the app's auth page: https://block-eats.lovable.app/auth
2. Sign up with: demo@blockeats.app / DemoReview2026!
3. Complete profile with:
   - Name: Demo User
   - Block: A
   - Flat: 101
   - Phone: 9999999999
4. Use admin panel to approve the demo user

---

## Post-Implementation: Local Build Steps

After pulling the latest code, run these commands locally:

```bash
# 1. Pull the latest code
git pull

# 2. Install dependencies
npm install

# 3. Build the web app
npm run build

# 4. Add native platforms (first time only)
npx cap add android
npx cap add ios

# 5. Sync web assets to native projects
npx cap sync

# 6. Open in native IDE
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode (Mac only)

# 7. Build release versions from the IDE
```

---

## Store Submission Checklist

### Google Play Store
- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Upload signed APK/AAB from Android Studio
- [ ] Fill in store listing from STORE_METADATA.md
- [ ] Upload screenshots (1080x1920 minimum)
- [ ] Set content rating
- [ ] Submit for review

### Apple App Store
- [ ] Create Apple Developer account ($99/year)
- [ ] Create App ID in App Store Connect
- [ ] Upload signed IPA from Xcode
- [ ] Fill in store listing from STORE_METADATA.md
- [ ] Upload screenshots for all required device sizes
- [ ] Add demo account credentials
- [ ] Submit for review

---

## Phase 4 Complete ✅

BlockEats v1.4 is now ready for app store submission!
