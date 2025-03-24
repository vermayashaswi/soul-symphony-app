
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/utils/audio/auth-utils';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';

export function JournalEntriesDebug() {
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    async function fetchUserAndEntries() {
      try {
        const uid = await getCurrentUserId();
        setUserId(uid);
        
        if (uid) {
          const { data, error, count } = await supabase
            .from('Journal Entries')
            .select('id, "refined text", created_at, user_id', { count: 'exact' })
            .eq('user_id', uid)
            .limit(5);
            
          if (error) {
            console.error('Error fetching journal entries:', error);
          } else {
            console.log(`Found ${count} journal entries for user ${uid}`);
            setEntries(data || []);
          }
        }
      } catch (error) {
        console.error('Error in debug component:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserAndEntries();
  }, []);

  if (loading) {
    return <div>Loading diagnostic information...</div>;
  }
  
  if (!showDebug) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowDebug(true)}
        className="mt-2"
      >
        Show Diagnostic Info
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Journal Entries Diagnostic</CardTitle>
        <CardDescription>
          This information helps troubleshoot why the chatbot can't find your journal entries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div><strong>User ID:</strong> {userId || 'Not signed in'}</div>
          <div><strong>Entry Count:</strong> {entries.length}</div>
          
          {entries.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium mt-2">First few entries:</h3>
              <ul className="space-y-2 mt-1">
                {entries.map(entry => (
                  <li key={entry.id} className="text-xs">
                    <div>ID: {entry.id}</div>
                    <div>User ID: {entry.user_id}</div>
                    <div>Date: {new Date(entry.created_at).toLocaleString()}</div>
                    <div>Text: {entry["refined text"]?.substring(0, 50)}...</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-red-500">No journal entries found in database for this user ID</div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowDebug(false)}
        >
          Hide Diagnostic Info
        </Button>
      </CardFooter>
    </Card>
  );
}
