
import React, { useState } from 'react';
import { debugJournalAccess, checkAndFixOrphanedEntries, JournalDebugInfo } from '@/utils/journal-debug';
import { debugEntityStripsData, quickThemeDataCheck, EntityStripsDebugInfo } from '@/utils/insights-debug';
import { useAuth } from '@/contexts/AuthContext';
import { TimeRange } from '@/hooks/use-insights-data';

interface InsightsDebugPanelProps {
  timeRange?: TimeRange;
  currentDate?: Date;
}

const InsightsDebugPanel: React.FC<InsightsDebugPanelProps> = ({
  timeRange = 'week',
  currentDate = new Date()
}) => {
  const [debugInfo, setDebugInfo] = useState<JournalDebugInfo | null>(null);
  const [entityDebugInfo, setEntityDebugInfo] = useState<EntityStripsDebugInfo | null>(null);
  const [quickCheck, setQuickCheck] = useState<any>(null);
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

  const runEntityStripsDebug = async () => {
    if (!user?.id) {
      alert('No user ID available for EntityStrips debug');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const entityInfo = await debugEntityStripsData(user.id, timeRange, currentDate);
      setEntityDebugInfo(entityInfo);
      console.log('[InsightsDebugPanel] EntityStrips debug complete:', entityInfo);
    } catch (err: any) {
      setError(err.message);
      console.error('[InsightsDebugPanel] EntityStrips debug failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const runQuickThemeCheck = async () => {
    if (!user?.id) {
      alert('No user ID available for theme check');
      return;
    }

    try {
      const checkResult = await quickThemeDataCheck(user.id);
      setQuickCheck(checkResult);
      console.log('[InsightsDebugPanel] Quick theme check complete:', checkResult);
    } catch (err: any) {
      alert(`Quick theme check failed: ${err.message}`);
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
        🔧 Insights Debug Panel
      </h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={runDebugAnalysis}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Analyzing...' : 'General Debug'}
          </button>
          
          <button
            onClick={runEntityStripsDebug}
            disabled={loading}
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            EntityStrips Debug
          </button>

          <button
            onClick={runQuickThemeCheck}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            Quick Theme Check
          </button>
          
          <button
            onClick={runOrphanCheck}
            className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
          >
            Check Orphans
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300 font-medium">Error:</p>
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Quick Theme Check Results */}
        {quickCheck && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-medium mb-2 text-green-900 dark:text-green-100">Quick Theme Check:</h4>
            <div className="text-sm space-y-1">
              <p><strong>Has Entries:</strong> {quickCheck.hasAnyEntries ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Has Themes:</strong> {quickCheck.hasEntriesWithThemes ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Theme Count:</strong> {quickCheck.themeCount}</p>
              {quickCheck.recentThemes.length > 0 && (
                <div>
                  <strong>Recent Themes:</strong>
                  <ul className="ml-4 mt-1">
                    {quickCheck.recentThemes.map((theme: string, idx: number) => (
                      <li key={idx} className="text-xs">• {theme}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EntityStrips Debug Results */}
        {entityDebugInfo && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-medium mb-3 text-purple-900 dark:text-purple-100">EntityStrips Debug Results:</h4>
            
            {entityDebugInfo.errors.length > 0 && (
              <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                <strong className="text-red-800 dark:text-red-300">Errors:</strong>
                <ul className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {entityDebugInfo.errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-semibold mb-2">Authentication:</h5>
                <p>Authenticated: {entityDebugInfo.authStatus.isAuthenticated ? '✅' : '❌'}</p>
                <p>User ID: {entityDebugInfo.authStatus.userId || 'None'}</p>
                <p>ID Match: {entityDebugInfo.authStatus.userIdMatch ? '✅' : '❌'}</p>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Data Access:</h5>
                <p>Total Entries: {entityDebugInfo.dataAccess.totalUserEntries}</p>
                <p>Filtered Entries: {entityDebugInfo.dataAccess.filteredEntries}</p>
                <p>With Themes: {entityDebugInfo.dataAccess.entriesWithThemes}</p>
                <p>Valid Themes: {entityDebugInfo.dataAccess.entriesWithValidThemes}</p>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Date Range:</h5>
                <p>Range: {entityDebugInfo.dateRange.timeRange}</p>
                <p>Start: {new Date(entityDebugInfo.dateRange.calculatedStart).toLocaleDateString()}</p>
                <p>End: {new Date(entityDebugInfo.dateRange.calculatedEnd).toLocaleDateString()}</p>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Theme Processing:</h5>
                <p>Unique Themes: {entityDebugInfo.themeProcessing.uniqueThemes}</p>
                <p>Top Themes: {entityDebugInfo.themeProcessing.processedThemes.length}</p>
              </div>
            </div>

            {entityDebugInfo.themeProcessing.processedThemes.length > 0 && (
              <div className="mt-3">
                <h5 className="font-semibold mb-2">Top Processed Themes:</h5>
                <div className="space-y-1 text-xs">
                  {entityDebugInfo.themeProcessing.processedThemes.slice(0, 5).map((theme, idx) => (
                    <div key={idx} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded">
                      <span>{theme.name}</span>
                      <span>Count: {theme.count}, Sentiment: {theme.sentiment.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* General Debug Results */}
        {debugInfo && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-medium mb-3 text-gray-900 dark:text-gray-100">General Debug Results:</h4>
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
