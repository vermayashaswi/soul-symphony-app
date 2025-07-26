import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface DiagnosticEntry {
  timestamp: Date;
  category: 'auth' | 'onboarding' | 'journal' | 'navigation' | 'system';
  level: 'info' | 'warning' | 'error';
  message: string;
  data?: any;
}

interface InitializationDiagnostics {
  logs: DiagnosticEntry[];
  issues: {
    missingNavigation: boolean;
    emptyJournal: boolean;
    authIncomplete: boolean;
    onboardingStuck: boolean;
  };
  stats: {
    initializationTime: number;
    journalLoadTime: number;
    onboardingCheckTime: number;
  };
}

export const useNativeInitializationDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<InitializationDiagnostics>({
    logs: [],
    issues: {
      missingNavigation: false,
      emptyJournal: false,
      authIncomplete: false,
      onboardingStuck: false
    },
    stats: {
      initializationTime: 0,
      journalLoadTime: 0,
      onboardingCheckTime: 0
    }
  });

  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const { entries, loading: journalLoading, error: journalError } = useJournalEntries(user?.id, 0, !!user);

  const startTimeRef = useRef(Date.now());
  const journalStartTimeRef = useRef<number | null>(null);
  const onboardingStartTimeRef = useRef<number | null>(null);
  const isNative = nativeIntegrationService.isRunningNatively();

  const addLog = (category: DiagnosticEntry['category'], level: DiagnosticEntry['level'], message: string, data?: any) => {
    const entry: DiagnosticEntry = {
      timestamp: new Date(),
      category,
      level,
      message,
      data
    };

    setDiagnostics(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-49), entry] // Keep last 50 logs
    }));

    // Also log to console with specific prefixes for easier filtering
    const prefix = `[NativeDiag:${category.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, data);
    } else if (level === 'warning') {
      console.warn(prefix, message, data);
    } else {
      console.log(prefix, message, data);
    }
  };

  // Monitor authentication changes
  useEffect(() => {
    if (isNative) {
      addLog('auth', 'info', 'Auth state changed', {
        hasUser: !!user,
        isLoading: authLoading,
        userEmail: user?.email
      });

      if (user && !authLoading) {
        addLog('auth', 'info', 'User authenticated successfully');
      } else if (!user && !authLoading) {
        addLog('auth', 'warning', 'No authenticated user');
      }
    }
  }, [user, authLoading, isNative]);

  // Monitor onboarding changes
  useEffect(() => {
    if (isNative) {
      if (onboardingLoading && !onboardingStartTimeRef.current) {
        onboardingStartTimeRef.current = Date.now();
        addLog('onboarding', 'info', 'Onboarding check started');
      }

      if (!onboardingLoading && onboardingStartTimeRef.current) {
        const duration = Date.now() - onboardingStartTimeRef.current;
        setDiagnostics(prev => ({
          ...prev,
          stats: { ...prev.stats, onboardingCheckTime: duration }
        }));
        
        addLog('onboarding', 'info', 'Onboarding check completed', {
          duration,
          isComplete: onboardingComplete
        });
        
        onboardingStartTimeRef.current = null;
      }

      // Check for stuck onboarding
      if (onboardingLoading && onboardingStartTimeRef.current) {
        const elapsed = Date.now() - onboardingStartTimeRef.current;
        if (elapsed > 10000) { // 10 seconds
          addLog('onboarding', 'warning', 'Onboarding check taking too long', { elapsed });
        }
      }
    }
  }, [onboardingLoading, onboardingComplete, isNative]);

  // Monitor journal data loading
  useEffect(() => {
    if (isNative && user) {
      if (journalLoading && !journalStartTimeRef.current) {
        journalStartTimeRef.current = Date.now();
        addLog('journal', 'info', 'Journal data loading started');
      }

      if (!journalLoading && journalStartTimeRef.current) {
        const duration = Date.now() - journalStartTimeRef.current;
        setDiagnostics(prev => ({
          ...prev,
          stats: { ...prev.stats, journalLoadTime: duration }
        }));

        addLog('journal', 'info', 'Journal data loading completed', {
          duration,
          entriesCount: entries.length,
          hasError: !!journalError
        });

        journalStartTimeRef.current = null;
      }

      if (journalError) {
        addLog('journal', 'error', 'Journal loading error', journalError);
      }

      // Check for empty journal issue
      if (!journalLoading && !journalError && entries.length === 0) {
        addLog('journal', 'warning', 'No journal entries found for authenticated user');
      }
    }
  }, [user, journalLoading, entries.length, journalError, isNative]);

  // Track overall initialization time
  useEffect(() => {
    if (isNative && user && onboardingComplete !== null && !journalLoading) {
      const totalTime = Date.now() - startTimeRef.current;
      setDiagnostics(prev => ({
        ...prev,
        stats: { ...prev.stats, initializationTime: totalTime }
      }));

      addLog('system', 'info', 'App initialization complete', {
        totalTime,
        hasUser: !!user,
        onboardingComplete,
        journalEntries: entries.length
      });
    }
  }, [user, onboardingComplete, journalLoading, entries.length, isNative]);

  // Detect issues periodically
  useEffect(() => {
    if (!isNative) return;

    const checkIssues = () => {
      const newIssues = {
        missingNavigation: false, // This would need to be detected separately
        emptyJournal: user && !journalLoading && !journalError && entries.length === 0,
        authIncomplete: !user && !authLoading,
        onboardingStuck: onboardingLoading && onboardingStartTimeRef.current && 
                        (Date.now() - onboardingStartTimeRef.current) > 15000
      };

      setDiagnostics(prev => ({
        ...prev,
        issues: newIssues
      }));

      // Log critical issues
      if (newIssues.emptyJournal) {
        addLog('journal', 'warning', 'ISSUE: Authenticated user has no journal entries');
      }
      if (newIssues.onboardingStuck) {
        addLog('onboarding', 'error', 'ISSUE: Onboarding check stuck for >15s');
      }
    };

    checkIssues();
    const interval = setInterval(checkIssues, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user, authLoading, onboardingLoading, journalLoading, journalError, entries.length, isNative]);

  return {
    diagnostics,
    isNative,
    addLog,
    clearLogs: () => setDiagnostics(prev => ({ ...prev, logs: [] }))
  };
};