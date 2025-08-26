// DEPRECATED: This file contains legacy notification services that are no longer used.
// All notification functionality has been consolidated into unifiedNotificationService.ts
// This file is kept for reference but should not be imported or used.

export const DEPRECATED_MESSAGE = `
This notification service has been deprecated and replaced with unifiedNotificationService.ts.
Please use unifiedNotificationService instead.

The unified service provides:
- Consolidated notification logic
- Client-side polling to replace cron jobs
- Proper Capacitor and web notification support
- Better error handling and reliability
`;

console.warn(DEPRECATED_MESSAGE);