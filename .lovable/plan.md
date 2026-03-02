

## Plan: Add "Enable Notifications" In-App Banner (Like Claude's iOS App)

Inspired by the Claude app screenshot you shared -- a card with a bell icon, title, description, and a "Turn On" button that triggers the iOS system popup when tapped.

### New File: `src/components/notifications/EnableNotificationsBanner.tsx`

A card-style banner component that:
- Only renders on native platforms (iOS/Android) when permission is still `'prompt'`
- Shows a bell icon, heading ("Turn On Notifications"), description ("Stay updated on your orders and community activity"), and a "Turn On" button
- On button tap: calls `requestFullPermission()` from context (singleton -- single OS popup)
- Dismissible via X button (stored in `sessionStorage` so it reappears next app launch)
- Auto-hides once `permissionStatus` becomes `'granted'`
- Styled as a rounded card with border, matching the reference screenshot

### Edit: `src/components/layout/AppLayout.tsx`

- Import and render `<EnableNotificationsBanner />` inside `<main>` before `{children}` (line 39)
- This ensures the banner appears at the top of every authenticated page

### No other files change

The banner consumes `usePushNotifications()` from context -- no new hook instances, no race conditions. The singleton `PushNotificationProvider` handles all registration logic.

