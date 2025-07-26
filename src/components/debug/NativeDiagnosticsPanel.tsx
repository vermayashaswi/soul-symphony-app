import React, { useState } from 'react';
import { useNativeInitializationDiagnostics } from '@/hooks/useNativeInitializationDiagnostics';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Bug, AlertTriangle, Info, XCircle } from 'lucide-react';

export const NativeDiagnosticsPanel: React.FC = () => {
  const { diagnostics, isNative, clearLogs } = useNativeInitializationDiagnostics();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Only show in native environments and development
  if (!isNative || process.env.NODE_ENV !== 'development') {
    return null;
  }

  const issueCount = Object.values(diagnostics.issues).filter(Boolean).length;
  const recentErrors = diagnostics.logs.filter(log => log.level === 'error').slice(-3);
  const recentWarnings = diagnostics.logs.filter(log => log.level === 'warning').slice(-5);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-orange-500" />;
      case 'info': return <Info className="w-3 h-3 text-blue-500" />;
      default: return <Bug className="w-3 h-3 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'auth': return '🔐';
      case 'onboarding': return '👋';
      case 'journal': return '📝';
      case 'navigation': return '🧭';
      case 'system': return '⚙️';
      default: return '📊';
    }
  };

  const categories = Array.from(new Set(diagnostics.logs.map(log => log.category)));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-4 left-4 z-50 bg-background/95 backdrop-blur border rounded-lg shadow-lg max-w-md"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm">Native Diagnostics</span>
          {issueCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {issueCount}
            </span>
          )}
        </div>
        {isExpanded ? 
          <ChevronDown className="w-4 h-4" /> : 
          <ChevronRight className="w-4 h-4" />
        }
      </div>

      {/* Compact Stats */}
      {!isExpanded && (
        <div className="p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Init Time:</span>
            <span>{diagnostics.stats.initializationTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Journal Load:</span>
            <span>{diagnostics.stats.journalLoadTime}ms</span>
          </div>
          {recentErrors.length > 0 && (
            <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {recentErrors.length} recent error(s)
            </div>
          )}
        </div>
      )}

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Stats */}
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm mb-2">Performance Stats</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  <div className="font-medium">Total Init</div>
                  <div>{diagnostics.stats.initializationTime}ms</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  <div className="font-medium">Journal Load</div>
                  <div>{diagnostics.stats.journalLoadTime}ms</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                  <div className="font-medium">Onboarding</div>
                  <div>{diagnostics.stats.onboardingCheckTime}ms</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                  <div className="font-medium">Log Entries</div>
                  <div>{diagnostics.logs.length}</div>
                </div>
              </div>
            </div>

            {/* Active Issues */}
            {issueCount > 0 && (
              <div className="p-3 border-b">
                <h3 className="font-medium text-sm mb-2 text-red-600">Active Issues</h3>
                <div className="space-y-1 text-xs">
                  {diagnostics.issues.emptyJournal && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600">
                      📝 Empty journal for authenticated user
                    </div>
                  )}
                  {diagnostics.issues.authIncomplete && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600">
                      🔐 Authentication incomplete
                    </div>
                  )}
                  {diagnostics.issues.onboardingStuck && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600">
                      👋 Onboarding check stuck
                    </div>
                  )}
                  {diagnostics.issues.missingNavigation && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-600">
                      🧭 Navigation bar missing
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Log Categories */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Recent Logs</h3>
                <button
                  onClick={clearLogs}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
              
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`text-xs px-2 py-1 rounded ${
                    selectedCategory === null ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  All
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`text-xs px-2 py-1 rounded ${
                      selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {getCategoryIcon(category)} {category}
                  </button>
                ))}
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1">
                {diagnostics.logs
                  .filter(log => !selectedCategory || log.category === selectedCategory)
                  .slice(-10)
                  .map((log, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(log.level)}
                        <span className="font-medium">{getCategoryIcon(log.category)} {log.category}</span>
                        <span className="text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1">{log.message}</div>
                      {log.data && (
                        <div className="mt-1 text-gray-600 font-mono text-xs">
                          {JSON.stringify(log.data, null, 2).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};