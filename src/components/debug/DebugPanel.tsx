
import { useState } from 'react';

// Create a simple logger object that can be imported throughout the app
export const debugLogger = {
  log: (level: string, message: string, details?: any) => {
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
  },
  setLastProfileError: (error: any) => {
    // Placeholder function for backward compatibility
    console.log('Profile error:', error);
  }
};

// Export functions for backward compatibility
export const logInfo = (message: string, context?: string, details?: any) => {
  debugLogger.log('info', `[Stub Debug Info]: ${message}`, details);
};

export const logError = (message: string, context?: string, details?: any) => {
  debugLogger.log('error', `[Stub Debug Error]: ${message}`, details);
};

export const logAuthError = (message: string, context?: string, details?: any) => {
  debugLogger.log('error', `[Stub Auth Error]: ${message}`, details);
};

export const logProfile = (message: string, context?: string, details?: any) => {
  debugLogger.log('info', `[Stub Profile Info]: ${message}`, details);
};

export const logAuth = (message: string, context?: string, details?: any) => {
  debugLogger.log('info', `[Stub Auth Info]: ${message}`, details);
};

// Export the panel component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
