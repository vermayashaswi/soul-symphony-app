// Re-export unified notification service for backward compatibility
export * from './unifiedNotificationService';
import { unifiedNotificationService } from './unifiedNotificationService';

// Legacy compatibility exports
export default unifiedNotificationService;
export const enhancedNotificationService = unifiedNotificationService;