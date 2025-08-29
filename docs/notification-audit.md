# Push Notification Flow Audit

## Overview
This document audits all notification senders and their click behaviors for status bar push notifications from FCM.

## FCM Notification Click Handling

### Native Platform Click Handler
Located in: `src/services/fcmNotificationService.ts` (lines 98-111)

```typescript
// Listen for notification action performed (when user taps notification)
await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
  console.log('[FCMNotificationService] Native notification action performed:', notification);
  
  // Handle notification tap - navigate to action URL if available
  const actionUrl = notification.notification.data?.action_url || notification.notification.data?.actionUrl;
  if (actionUrl) {
    console.log('[FCMNotificationService] Navigating to action URL:', actionUrl);
    // Use native navigation service for proper app navigation
    import('../services/nativeNavigationService').then(({ nativeNavigationService }) => {
      nativeNavigationService.navigateToPath(actionUrl, { replace: true, force: true });
    });
  }
});
```

**Key Finding**: Push notifications use `action_url` or `actionUrl` from notification data to determine navigation target.

## Edge Functions That Send Notifications

### Core Notification Senders:

#### 1. `send-fcm-notification` ✅
**Purpose**: Core FCM notification sender
**Location**: `supabase/functions/send-fcm-notification/index.ts`
**Action URL**: Uses `actionUrl` parameter, maps to `action_url` for in-app notifications
**Navigation**: Sets both web (`fcm_options.link`) and native (`data.action_url`) targets

#### 2. `send-custom-notification` ✅  
**Purpose**: Sends custom notifications with both in-app and push options
**Location**: `supabase/functions/send-custom-notification/index.ts`
**Action URL**: Uses `actionUrl` parameter, supports multiple notification types
**Navigation**: Maps to both in-app and push notification actions

#### 3. `send-categorized-notification` ✅
**Purpose**: Sends notifications based on predefined categories  
**Location**: `supabase/functions/send-categorized-notification/index.ts`
**Action URL**: Uses `targetUrl` parameter, maps to `action_url`
**Navigation**: Supports category-based notification routing

### Specialized Notification Senders:

#### 4. `schedule-journal-reminders` ✅
**Purpose**: Scheduled journal reminder notifications
**Location**: `supabase/functions/schedule-journal-reminders/index.ts` 
**Action URL**: Hardcoded to `/app/journal` (full URL format)
**Navigation**: Always navigates to journal page

#### 5. `test-notification-flow` ✅
**Purpose**: Testing notification system
**Location**: `supabase/functions/test-notification-flow/index.ts`
**Action URL**: Uses hardcoded test URLs pointing to `/app/journal`
**Navigation**: Test notifications for flow verification

#### 6. `send-goal-achievement` ✅
**Purpose**: Goal achievement notifications
**Action URL**: `/app/insights` - navigates to achievements page
**Navigation**: Celebrates user milestones

#### 7. `send-inactivity-nudge` ✅
**Purpose**: Encourages inactive users to journal
**Action URL**: `/app/journal?tab=record` - specific journal tab
**Navigation**: Direct to recording interface

#### 8. `send-journal-insights` ✅
**Purpose**: Journal analysis insights
**Action URL**: `/app/journal?tab=record` - view entries
**Navigation**: In-app only (no push)

#### 9. `send-milestone-notification` ✅
**Purpose**: User milestone celebrations
**Action URL**: `/app/insights` - progress tracking
**Navigation**: In-app only (no push)

#### 10. `send-mood-tracking-prompt` ✅
**Purpose**: Mood tracking reminders
**Action URL**: `/app/journal?tab=record` - record entry
**Navigation**: Push enabled, direct to journaling

#### 11. `send-sleep-reflection` ✅
**Purpose**: Sleep reflection prompts
**Action URL**: `/app/journal?tab=record` - reflect now
**Navigation**: Push enabled for evening reminders

#### 12. `send-streak-reward` ✅
**Purpose**: Streak achievement rewards
**Action URL**: `/app/insights` - view progress
**Navigation**: Push enabled, celebrates consistency

#### 13. `trigger-smart-chat-notification` ✅
**Purpose**: Smart chat feature invitations
**Action URL**: `/app/smart-chat` - open chat interface
**Navigation**: Feature introduction notifications

#### 14. `create-test-notification` ✅
**Purpose**: Development testing
**Action URL**: `/app/journal` - test navigation
**Navigation**: Development and debugging use

## In-App Notification Types and Expected Destinations

Based on `src/hooks/use-notifications.ts` and `src/components/notifications/NotificationCenter.tsx`:

### Notification Types:
- `info` - General information
- `success` - Success messages  
- `warning` - Warning messages
- `error` - Error messages
- `reminder` - Journal reminders → Should navigate to `/app/journal`

### Current Click Handling (In-App):
```typescript
const handleNotificationClick = (notification: AppNotification) => {
  if (notification.type === 'reminder') {
    navigate('/app/journal');
  }
  markAsRead(notification.id);
};
```

## Issues Identified:

1. **✅ RESOLVED: Inconsistent URL Format**: Most functions now use `actionUrl` parameter which maps to `action_url`
2. **❌ No Default Action URL**: Push notifications without `action_url` don't navigate anywhere  
3. **❌ Hardcoded Full URLs**: Some functions use full domain URLs instead of relative paths
4. **❌ No Fallback Navigation**: If action_url is missing, user stays on current screen
5. **❌ Mixed URL Formats**: Some use `/app/journal?tab=record`, others use `/app/journal`

## Recommended Action URLs by Notification Type:

| Notification Type | Recommended Action URL | Purpose |
|------------------|----------------------|---------|
| `reminder` | `/app/journal` | Journal reminders |
| `success` | `/app/home` | General success messages |
| `info` | `/app/home` | General information |
| `warning` | `/app/home` | Warnings |
| `error` | `/app/home` | Error notifications |
| `system` | `/app/settings` | System notifications |
| `feature` | `/app/home` | Feature announcements |

## Next Steps:

1. ✅ Fix NotificationBell unread count issue
2. 🔄 Audit all edge functions for action_url implementation
3. 🔄 Add default action_url fallbacks
4. 🔄 Standardize action_url parameter naming
5. 🔄 Test notification flows end-to-end
6. 🔄 Add notification click analytics

## Status:
- **NotificationBell Fix**: ✅ Completed - Now uses `useNotifications` hook for real-time updates
- **Edge Function Audit**: ✅ Completed - All 14 notification senders documented
- **Action URL Implementation**: ✅ Most functions have action URLs, some need standardization
- **Testing**: 🔄 Ready for testing - all notification flows documented

## Summary of Push Notification Click Destinations:

| Edge Function | Destination | Notes |
|---------------|-------------|--------|
| `send-fcm-notification` | Variable | Uses caller's `actionUrl` |
| `send-custom-notification` | Variable | Uses caller's `actionUrl` |
| `send-categorized-notification` | Variable | Uses caller's `targetUrl` |
| `schedule-journal-reminders` | `/app/journal` | Hardcoded journal URL |
| `send-goal-achievement` | `/app/insights` | Achievement tracking |
| `send-inactivity-nudge` | `/app/journal?tab=record` | Direct to recording |
| `send-mood-tracking-prompt` | `/app/journal?tab=record` | Mood entry form |
| `send-sleep-reflection` | `/app/journal?tab=record` | Sleep reflection |
| `send-streak-reward` | `/app/insights` | Progress celebration |
| `trigger-smart-chat-notification` | `/app/smart-chat` | Chat feature intro |

**✅ SOLUTION IMPLEMENTED**: NotificationBell now uses centralized `useNotifications` hook, ensuring unread count updates in real-time when notifications are read/dismissed.