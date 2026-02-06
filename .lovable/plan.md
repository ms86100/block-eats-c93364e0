

# App Store Readiness Implementation Plan

## Executive Summary

This plan addresses all gaps identified for shipping your Capacitor app to App Store (iOS) and Google Play (Android). The app has strong foundations but needs backend push notification delivery, deep linking fixes, branding consistency, and asset creation guidance.

---

## Current State Assessment

| Area | Status | Priority |
|------|--------|----------|
| Push Notification Registration | Done (client-side) | - |
| Push Notification Delivery (backend) | Missing | Critical |
| Deep Linking Files | Placeholders | Critical |
| Deep Linking + HashRouter | Incompatible | Critical |
| App Icon 1024x1024 | Missing | High |
| Feature Graphic (Android) | Missing | High |
| Branding Consistency | Mixed BlockEats/Greenfield | Medium |
| Demo Account Mismatch | Different emails in docs | Medium |
| Native Projects (ios/android folders) | Not initialized | Required externally |

---

## Phase 1: Backend Push Notifications (Critical)

### Problem
Device tokens are stored in `device_tokens` table but there is no backend function to actually send push notifications when order events occur.

### Solution
Create a new Edge Function `send-push-notification` that:
1. Accepts order ID and notification type
2. Fetches recipient's device tokens from database
3. Sends to FCM (Firebase Cloud Messaging) which handles both iOS (APNs) and Android

### Implementation Details

**New Edge Function: `supabase/functions/send-push-notification/index.ts`**

```text
Accepts: { userId, title, body, data }
Steps:
  1. Query device_tokens for user_id
  2. For each token, call FCM HTTP v1 API
  3. Handle token expiration (delete invalid tokens)
  4. Return success/failure status
```

**Required Secret:**
- `FCM_SERVER_KEY` - Firebase Cloud Messaging server key (from Firebase Console)

**Trigger Points (modify existing code):**
- Order placed - notify seller
- Order accepted - notify buyer
- Order ready - notify buyer
- Order cancelled - notify buyer/seller
- New chat message - notify recipient

**Database Trigger Option:**
Create a PostgreSQL trigger on `orders` table that calls the Edge Function when status changes.

---

## Phase 2: Deep Linking Fix (Critical)

### Problem
The app uses `HashRouter` (URLs like `/#/orders/123`) but the deep linking files define paths like `/order/*` which don't include the hash.

### Solution Options

**Option A: Update deep link paths to hash format (Recommended)**
- Simpler, works with current HashRouter
- iOS and Android can handle hash-based deep links with custom URL schemes

**Option B: Switch to BrowserRouter**
- Requires proper server configuration
- More complex deployment setup

### Implementation (Option A)

**1. Update `public/.well-known/apple-app-site-association`:**
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAM_ID.app.lovable.b3f6efce9b8e4071b39db038b9b1adf4",
      "paths": ["/*"]
    }]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.app.lovable.b3f6efce9b8e4071b39db038b9b1adf4"]
  }
}
```

**2. Update `public/.well-known/assetlinks.json`:**
- Keep structure, user must replace `SHA256_FINGERPRINT_PLACEHOLDER`

**3. Add deep link handler in App.tsx:**
```text
Listen for Capacitor App.addListener('appUrlOpen')
Parse incoming URL and extract path after hash
Navigate using React Router
```

**4. Update Capacitor config for custom URL scheme:**
```text
ios.scheme: 'greenfield'
android: Add intent filters in AndroidManifest.xml
```

---

## Phase 3: Branding Consistency (Medium)

### Changes Required

| File | Current | Should Be |
|------|---------|-----------|
| public/manifest.json | "BlockEats" | "Greenfield Community" |
| DEPLOYMENT.md | demo@blockeats.app | demo@greenfield.app |
| STORE_METADATA.md | demo@greenfield.app | Consistent |
| index.html | "BlockEats" | "Greenfield Community" |

### Files to Update

1. **public/manifest.json** - Update name and short_name to "Greenfield Community"
2. **index.html** - Update title and meta tags to "Greenfield Community"
3. **DEPLOYMENT.md** - Align demo account with STORE_METADATA.md

---

## Phase 4: Missing Assets (High - Manual Steps)

These require design work outside of code:

### App Icons
| Platform | Size | Status |
|----------|------|--------|
| iOS App Store | 1024x1024 | Missing - scale up from 512x512 or recreate |
| Android Play Store | 512x512 | Exists |

### Graphics
| Asset | Size | Status |
|-------|------|--------|
| Feature Graphic (Android) | 1024x500 | Missing - needs creation |

### Guidance for User
Add a new file or section listing exact asset requirements with recommended tools (Figma, Canva) for creating them.

---

## Phase 5: Code Updates Summary

### New Files to Create

1. **`supabase/functions/send-push-notification/index.ts`**
   - FCM integration for push delivery
   - Handles iOS and Android via FCM HTTP v1 API
   - Token cleanup for expired tokens

2. **`src/hooks/useDeepLinks.ts`**
   - Capacitor App listener for `appUrlOpen` events
   - Parse URLs and navigate via React Router
   - Support both custom scheme (`greenfield://`) and universal links

### Files to Modify

1. **`public/.well-known/apple-app-site-association`**
   - Simplify paths to `["/*"]` for hash routing compatibility
   - Add comments about TEAM_ID replacement

2. **`public/manifest.json`**
   - Rename to "Greenfield Community"
   - Update description

3. **`index.html`**
   - Update title to "Greenfield Community"
   - Update Open Graph tags

4. **`src/App.tsx`**
   - Import and initialize deep link handler
   - Add Capacitor App URL listener

5. **`capacitor.config.ts`**
   - Add iOS scheme for deep links
   - Update comments for production readiness

6. **`DEPLOYMENT.md`**
   - Add FCM setup instructions
   - Clarify deep linking setup steps
   - Fix demo account reference

7. **`supabase/config.toml`**
   - Add new edge function configuration

---

## Phase 6: Required User Actions (External)

These cannot be done in Lovable and require external accounts:

### Firebase Setup (for FCM)
1. Create Firebase project at console.firebase.google.com
2. Add iOS and Android apps
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
4. Get Server Key from Project Settings > Cloud Messaging
5. Add `FCM_SERVER_KEY` secret in Lovable Cloud

### Apple Developer Portal
1. Get Team ID from Membership page
2. Create APNs Key (Keys section)
3. Upload APNs key to Firebase for iOS push
4. Replace `TEAM_ID` placeholder in AASA file

### Android Signing
1. Create or locate release keystore
2. Get SHA-256 fingerprint using keytool command
3. Replace placeholder in assetlinks.json

### Native Projects
1. Run `npx cap add ios` and `npx cap add android`
2. Configure signing in Xcode/Android Studio
3. Add capabilities (Push, Associated Domains)

---

## Implementation Order

1. Push Notification Backend (most impactful for user experience)
2. Deep Linking Handler (required for notifications to work properly)
3. Branding Updates (quick wins)
4. Documentation Updates (guides user through external setup)

---

## Testing Checklist After Implementation

- [ ] Send test push notification to registered device
- [ ] Open deep link in Safari/Chrome, verify app opens
- [ ] Tap push notification, verify correct page opens
- [ ] Verify branding shows "Greenfield Community" everywhere
- [ ] Test in Median.co simulator (no JSON errors)
- [ ] Test on physical iOS device (if available)
- [ ] Test on physical Android device (if available)

