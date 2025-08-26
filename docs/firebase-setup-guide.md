# Firebase Cloud Messaging (FCM) Setup Guide

## Overview
This project has been migrated from local notifications to Firebase Cloud Messaging (FCM) for both scheduled journal reminders and future event-triggered notifications.

## Firebase Setup Requirements

### 1. Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use your existing project
3. Enable Cloud Messaging

### 2. Web Configuration
1. In Firebase Console, go to Project Settings > General
2. Add a Web app if you haven't already
3. Copy the Firebase config object (you'll need this for the code)

### 3. Android Configuration
1. In Firebase Console, go to Project Settings > General
2. Add an Android app
3. Use package name: `app.lovable.571d731eb54b453e9f48a2c79a572930`
4. Download `google-services.json`
5. Place it in `android/app/` directory

### 4. VAPID Key (for Web Push)
1. In Firebase Console, go to Project Settings > Cloud Messaging
2. Generate a new Web Push certificate
3. Copy the VAPID key

## Code Configuration

### Update Firebase Config
In `src/services/fcmNotificationService.ts`, replace the placeholder config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### Update VAPID Key
In the same file, replace:
```typescript
vapidKey: 'YOUR_ACTUAL_VAPID_KEY'
```

## Database Migration Completed

The following changes have been made to the database:

### New Tables Created:
- **user_devices**: Stores FCM tokens for each user's devices
- **user_notifications**: Stores user notification preferences

### Removed:
- **notification_queue**: Old notification queue table
- **schedule_journal_reminders()**: Old scheduling function

### Data Migration:
- Existing reminder settings from `profiles.reminder_settings` have been migrated to the new `user_notifications` table

## Architecture Overview

### Frontend (Current Implementation)
✅ **Completed:**
- UI for scheduling reminders (Settings page)
- FCM token collection and storage
- Notification permission handling
- Local notification display on web
- Settings persistence in new database structure

### Backend (To Be Implemented)
📋 **Next Steps:**
1. **Supabase Edge Functions** for FCM delivery
2. **Cron jobs** for scheduled notifications
3. **Event triggers** for action-based notifications

### Future Edge Functions Needed:

#### 1. FCM Delivery Function (`fcm-notification-sender`)
```typescript
// Will send notifications via Firebase Admin SDK
// Triggered by cron job or database events
```

#### 2. Notification Scheduler (`notification-cron`)
```typescript
// Cron job that runs every 5 minutes
// Checks user_notifications table for due reminders
// Calls FCM delivery function
```

#### 3. Event-Triggered Notifications
```typescript
// Database triggers for:
// - Journal completion (motivational message in 6 hours)
// - Inactivity detection (re-engagement after 3 days)
// - Streak celebrations (7-day completion)
```

## Migration Summary

### ✅ Completed:
- Removed all local notification backend logic
- Removed notification queue and edge functions
- Created new FCM-based notification service
- Migrated user reminder settings to new database structure
- Maintained all existing UI and user experience
- Preserved all user settings and preferences
- Removed `@capacitor/local-notifications` dependency
- Added Firebase SDK

### 🔄 In Progress:
- Firebase configuration needs actual values
- Native Android FCM integration needs `google-services.json`

### 📋 Next Steps:
1. **You**: Update Firebase config with actual values
2. **You**: Add `google-services.json` to Android app
3. **Future**: Implement FCM delivery edge functions
4. **Future**: Set up cron jobs for scheduled notifications
5. **Future**: Add event-triggered notification system

## Benefits of FCM Migration

1. **Reliability**: Firebase handles notification delivery and retry logic
2. **Scalability**: No more client-side polling for notifications  
3. **Cross-Platform**: Unified notification system for web and mobile
4. **Advanced Features**: Rich notifications, action buttons, analytics
5. **Event-Driven**: Easy to add notifications based on user actions
6. **Backend Efficiency**: No more client polling, server-side scheduling only

## Testing

### Current Testing:
- Settings page notification toggles work
- Notification permissions can be requested
- FCM tokens are stored in database
- Legacy notification methods are safely stubbed

### Production Ready:
Once Firebase config is updated, the system will be ready for:
- Web push notifications (immediate)
- Native Android notifications (with google-services.json)
- Server-side notification scheduling (needs edge functions)

## Notes for Developers

- All legacy notification methods are preserved for compatibility
- No breaking changes to existing UI components
- User data migration was automatic during database changes
- Future notification features can be easily added to the new system
- The architecture supports both scheduled and event-driven notifications