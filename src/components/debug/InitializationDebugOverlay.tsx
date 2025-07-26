import React from 'react';
import { useDebugInitialization } from '@/hooks/useDebugInitialization';
import { motion } from 'framer-motion';

export const InitializationDebugOverlay: React.FC = () => {
  const initState = useDebugInitialization();

  // Only show in development or when there are errors/timeouts
  const shouldShow = process.env.NODE_ENV === 'development' || initState.hasErrors || !initState.isComplete;

  if (!shouldShow && initState.isComplete) {
    return null;
  }

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'loading': return '⏳';
      case 'ready': return '✅';
      case 'valid': return '✅';
      case 'complete': return '✅';
      case 'skipped': return '⏭️';
      case 'timeout': return '⚠️';
      case 'invalid': return '❌';
      case 'incomplete': return '🔄';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'loading': return 'text-yellow-600';
      case 'ready':
      case 'valid':
      case 'complete': return 'text-green-600';
      case 'skipped': return 'text-blue-600';
      case 'timeout': return 'text-orange-600';
      case 'invalid':
      case 'incomplete':
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-4 z-50 max-w-xs"
    >
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        🚀 Init Debug {initState.isNativeApp && '📱'}
        {initState.isComplete && <span className="text-green-600">✅</span>}
      </div>
      
      <div className="space-y-1 text-xs">
        {Object.entries(initState.phases).map(([name, status]) => (
          <div key={name} className="flex justify-between items-center">
            <span className="capitalize">{name}:</span>
            <span className={`flex items-center gap-1 ${getPhaseColor(status)}`}>
              {getPhaseIcon(status)} {status}
            </span>
          </div>
        ))}
      </div>

      {initState.hasErrors && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          ⚠️ Issues detected ({initState.timeouts} timeouts)
        </div>
      )}

      {!initState.isComplete && (
        <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
          🔄 Still initializing...
        </div>
      )}
    </motion.div>
  );
};