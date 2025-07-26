import React from 'react';
import { useDebugInitialization } from '@/hooks/useDebugInitialization';
import { useAuth } from '@/contexts/AuthContext';
import { useAppInitialization } from '@/contexts/AppInitializationContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { motion } from 'framer-motion';

export const InitializationDebugOverlay: React.FC = () => {
  const initState = useDebugInitialization();
  const { user } = useAuth();
  const { onboardingComplete, isOnboardingLoading } = useAppInitialization();
  const { entries, loading: journalLoading, error: journalError } = useJournalEntries(user?.id, 0, !!user);

  // Enhanced detection of issues
  const hasJournalIssues = user && !journalLoading && entries.length === 0 && !journalError;
  const hasNavigationIssues = user && onboardingComplete && initState.isNativeApp;
  const hasOnboardingIssues = user && onboardingComplete === null && !isOnboardingLoading;
  
  // Only show in development or when there are errors/timeouts/specific issues
  const shouldShow = process.env.NODE_ENV === 'development' || 
                    initState.hasErrors || 
                    !initState.isComplete || 
                    hasJournalIssues || 
                    hasNavigationIssues ||
                    hasOnboardingIssues;

  if (!shouldShow && initState.isComplete && !hasJournalIssues && !hasNavigationIssues) {
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
      className="fixed bottom-4 left-4 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-4 z-50 max-w-sm"
    >
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        🚀 Debug Panel {initState.isNativeApp && '📱'}
        {initState.isComplete && <span className="text-green-600">✅</span>}
      </div>
      
      {/* Core Initialization Status */}
      <div className="space-y-1 text-xs mb-3">
        <div className="font-medium text-muted-foreground">Core Systems:</div>
        {Object.entries(initState.phases).map(([name, status]) => (
          <div key={name} className="flex justify-between items-center">
            <span className="capitalize">{name}:</span>
            <span className={`flex items-center gap-1 ${getPhaseColor(status)}`}>
              {getPhaseIcon(status)} {status}
            </span>
          </div>
        ))}
      </div>

      {/* App State Debug */}
      <div className="space-y-1 text-xs mb-3 border-t pt-2">
        <div className="font-medium text-muted-foreground">App State:</div>
        
        <div className="flex justify-between items-center">
          <span>User:</span>
          <span className={user ? 'text-green-600' : 'text-red-600'}>
            {user ? '✅ Authenticated' : '❌ None'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span>Onboarding:</span>
          <span className={
            isOnboardingLoading ? 'text-yellow-600' :
             onboardingComplete ? 'text-green-600' : 'text-orange-600'
          }>
            {isOnboardingLoading ? '⏳ Loading' : 
             onboardingComplete ? '✅ Complete' : '🔄 Pending'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span>Journal:</span>
          <span className={
            journalLoading ? 'text-yellow-600' :
            journalError ? 'text-red-600' :
            entries.length > 0 ? 'text-green-600' : 'text-orange-600'
          }>
            {journalLoading ? '⏳ Loading' :
             journalError ? '❌ Error' :
             entries.length > 0 ? `✅ ${entries.length} entries` : '⚠️ Empty'}
          </span>
        </div>
      </div>

      {/* Issues & Warnings */}
      {(initState.hasErrors || hasJournalIssues || hasNavigationIssues || hasOnboardingIssues) && (
        <div className="border-t pt-2">
          <div className="font-medium text-muted-foreground text-xs mb-1">Issues:</div>
          
          {initState.hasErrors && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded mb-1">
              ⚠️ Init errors ({initState.timeouts} timeouts)
            </div>
          )}

          {hasJournalIssues && (
            <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded mb-1">
              📝 No journal entries for authenticated user
            </div>
          )}

          {hasNavigationIssues && (
            <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded mb-1">
              🧭 Check navigation visibility (native)
            </div>
          )}

          {hasOnboardingIssues && (
            <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded mb-1">
              👋 Onboarding status unclear
            </div>
          )}
        </div>
      )}

      {!initState.isComplete && (
        <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
          🔄 Still initializing...
        </div>
      )}

      <div className="mt-2 text-xs text-muted-foreground border-t pt-1">
        {user?.email || 'No user'} • {new Date().toLocaleTimeString()}
      </div>
    </motion.div>
  );
};