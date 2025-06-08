
import { EnhancedSoulNetPreloadService } from './enhancedSoulNetPreloadService';

// Re-export the enhanced service as the main interface
export class SoulNetPreloadService {
  static async preloadSoulNetData(
    userId: string, 
    timeRange: string, 
    language: string
  ) {
    return EnhancedSoulNetPreloadService.preloadSoulNetData(userId, timeRange, language);
  }

  static getCachedDataSync(cacheKey: string) {
    return EnhancedSoulNetPreloadService.getCachedDataSync(cacheKey);
  }

  static clearCache(userId?: string) {
    return EnhancedSoulNetPreloadService.clearCache(userId);
  }
}
