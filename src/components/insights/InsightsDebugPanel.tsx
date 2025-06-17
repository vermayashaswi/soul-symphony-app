
import React, { useState } from 'react';
import { debugJournalAccess, checkAndFixOrphanedEntries, JournalDebugInfo } from '@/utils/journal-debug';
import { useAuth } from '@/contexts/AuthContext';

const InsightsDebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<JournalDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const runDebugAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const info = await debugJournalAccess();
      setDebugInfo(info);
      console.log('[InsightsDebugPanel] Debug analysis complete:', info);
    } catch (err: any) {
      setError(err.message);
      console.error('[InsightsDebugPanel] Debug analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const runOrphanCheck = async () => {
    try {
      await checkAndFixOrphanedEntries();
      alert('Orphan check complete - see console for details');
    } catch (err: any) {
      alert(`Orphan check failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        🔧 Debug Panel
      </h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={runDebugAnalysis}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Debug Analysis'}
          </button>
          
          <button
            onClick={runOrphanCheck}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
          >
            Check Orphaned Entries
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300 font-medium">Error:</p>
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {debugInfo && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-3 text-gray-900 dark:text-gray-100">Debug Results:</h4>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>Auth User ID:</strong></p>
                  <p className="font-mono text-xs break-all">{debugInfo.authUser || 'None'}</p>
                </div>
                <div>
                  <p><strong>Current User Email:</strong></p>
                  <p className="text-xs">{user?.email || 'None'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div>
                  <p><strong>Total Entries:</strong></p>
                  <p className="text-lg font-bold text-blue-600">{debugInfo.totalEntries}</p>
                </div>
                <div>
                  <p><strong>User Entries:</strong></p>
                  <p className="text-lg font-bold text-green-600">{debugInfo.userEntries}</p>
                </div>
                <div>
                  <p><strong>RLS Enabled:</strong></p>
                  <p className="text-lg font-bold text-purple-600">{debugInfo.rlsEnabled ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {debugInfo.entriesWithDifferentUsers.length > 0 && (
                <div className="pt-2 border-t">
                  <p><strong>⚠️ Entries with different user IDs:</strong></p>
                  <div className="max-h-32 overflow-y-auto">
                    {debugInfo.entriesWithDifferentUsers.map(entry => (
                      <div key={entry.id} className="text-xs font-mono bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded mb-1">
                        ID: {entry.id}, User: {entry.user_id}, Date: {entry.created_at}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t text-xs text-gray-600 dark:text-gray-400">
                <p><strong>Diagnosis:</strong></p>
                {debugInfo.authUser ? (
                  debugInfo.userEntries > 0 ? (
                    <p className="text-green-600">✅ User is authenticated and has {debugInfo.userEntries} entries accessible.</p>
                  ) : (
                    <p className="text-orange-600">⚠️ User is authenticated but has no accessible entries. Check date filters or data ownership.</p>
                  )
                ) : (
                  <p className="text-red-600">❌ User is not authenticated. This is the likely cause of the issue.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsDebugPanel;
