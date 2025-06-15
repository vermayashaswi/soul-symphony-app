
// Production-safe debug utilities
import { logger } from '@/utils/logger';

export const debugLog = (...args: any[]) => logger.debug(args.join(' '));
export const debugInfo = (...args: any[]) => logger.info(args.join(' '));
export const debugError = (...args: any[]) => logger.error(args.join(' '));
export const debugWarn = (...args: any[]) => logger.warn(args.join(' '));
export const debugTrace = (...args: any[]) => logger.debug('Trace: ' + args.join(' '));

export const createDebugger = (component: string) => ({
  log: (...args: any[]) => logger.debug(args.join(' '), undefined, component),
  info: (...args: any[]) => logger.info(args.join(' '), undefined, component),
  error: (...args: any[]) => logger.error(args.join(' '), undefined, component),
  warn: (...args: any[]) => logger.warn(args.join(' '), undefined, component),
  trace: (...args: any[]) => logger.debug('Trace: ' + args.join(' '), undefined, component),
});

export default {
  log: debugLog,
  info: debugInfo,
  error: debugError,
  warn: debugWarn,
  trace: debugTrace,
  create: createDebugger,
};
