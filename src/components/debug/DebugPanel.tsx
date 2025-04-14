
import { useState } from 'react';

// Create a simple logger object that can be imported throughout the app
export const debugLogger = {
  log: (level: string, message: string, details?: any) => {
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
  },
  setLastProfileError: (_: any) => {
    // Placeholder function for backward compatibility
    console.log('Profile error:', _);
  }
};

// Export the panel component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
