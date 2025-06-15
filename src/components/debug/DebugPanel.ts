
// Production-safe debug panel - only active in development
import { logger } from '@/utils/logger';

// All debug utilities disabled for production build
export const debugLogger = {
  log: (...args: any[]) => logger.debug(args.join(' '), undefined, 'Debug'),
  logInfo: (...args: any[]) => logger.info(args.join(' '), undefined, 'Debug'),
  logError: (...args: any[]) => logger.error(args.join(' '), undefined, 'Debug'),
  logWarning: (...args: any[]) => logger.warn(args.join(' '), undefined, 'Debug'),
  setLastProfileError: (...args: any[]) => logger.error('Profile error', args, 'Debug')
};

export const logInfo = (...args: any[]) => logger.info(args.join(' '), undefined, 'Debug');
export const logError = (...args: any[]) => logger.error(args.join(' '), undefined, 'Debug');
export const logAuthError = (...args: any[]) => logger.error('Auth error', args, 'Auth');
export const logProfile = (...args: any[]) => logger.debug('Profile', args, 'Profile');
export const logAuth = (...args: any[]) => logger.debug('Auth', args, 'Auth');

const DebugPanel = () => null;
export default DebugPanel;
