import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface JournalDebugInfo {
  journalEntries: {
    count: number;
    recentEntries: any[];
    queryError: string | null;
  };
  rlsTest: {
    canAccessTable: boolean;
    testQuery: string;
    testResult: any;
  };
}

export const JournalDebugComponent: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<JournalDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const runJournalTest = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    console.log('[JournalDebug] Starting journal debug for user:', user.id);
    
    try {
      // Test basic journal entries query
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, created_at, "transcription text", "refined text", user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('[JournalDebug] Journal query result:', { 
        entries: entries?.length || 0, 
        error: entriesError 
      });

      // Test RLS by trying a different approach
      const { data: rlsTest, error: rlsError } = await supabase
        .rpc('execute_dynamic_query', {
          query_text: `SELECT COUNT(*) as total FROM "Journal Entries" WHERE user_id = auth.uid()`
        });

      console.log('[JournalDebug] RLS test result:', { rlsTest, rlsError });

      const info: JournalDebugInfo = {
        journalEntries: {
          count: entries?.length || 0,
          recentEntries: entries?.slice(0, 3) || [],
          queryError: entriesError?.message || null
        },
        rlsTest: {
          canAccessTable: !entriesError,
          testQuery: 'SELECT COUNT(*) FROM "Journal Entries" WHERE user_id = auth.uid()',
          testResult: rlsTest
        }
      };

      setDebugInfo(info);
    } catch (error) {
      console.error('[JournalDebug] Error running test:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      runJournalTest();
    }
  }, [user?.id]);

  if (!user) {
    return <div className="text-sm text-muted-foreground">No user logged in</div>;
  }

  return (
    <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-blue-800">📔 Journal Debug Info</h3>
        <Button 
          onClick={runJournalTest} 
          disabled={loading}
          size="sm"
          variant="outline"
        >
          {loading ? 'Testing...' : 'Retest'}
        </Button>
      </div>
      
      {debugInfo && (
        <div className="space-y-3 text-xs">
          <div>
            <strong>Journal Entries:</strong>
            <ul className="ml-4 space-y-1">
              <li>Count: {debugInfo.journalEntries.count}</li>
              <li>Query Error: {debugInfo.journalEntries.queryError || 'None'}</li>
              <li>Can Access: {debugInfo.rlsTest.canAccessTable ? '✅' : '❌'}</li>
            </ul>
          </div>

          {debugInfo.journalEntries.recentEntries.length > 0 && (
            <div>
              <strong>Recent Entries:</strong>
              <ul className="ml-4 space-y-1">
                {debugInfo.journalEntries.recentEntries.map((entry, index) => (
                  <li key={entry.id} className="text-xs">
                    Entry {index + 1}: ID {entry.id} - {new Date(entry.created_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <strong>RLS Test:</strong>
            <ul className="ml-4 space-y-1">
              <li>Result: {JSON.stringify(debugInfo.rlsTest.testResult)}</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
};