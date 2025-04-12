
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import EntityBubbles from './EntityBubbles';
import { supabase } from '@/integrations/supabase/client';

interface SummaryResponse {
  summary: string | null;
  topEntities: Array<{ name: string; count: number }>;
  hasEntries: boolean;
  entryCount?: number;
  error?: string;
}

const JournalSummaryCard: React.FC = () => {
  const { user } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase.functions.invoke('journal-summary', {
          body: { userId: user.id, days: 7 }
        });
        
        if (error) {
          console.error('Error fetching journal summary:', error);
          setError('Failed to load your journal summary');
        } else {
          setSummaryData(data);
        }
      } catch (err) {
        console.error('Exception in journal summary fetch:', err);
        setError('Unexpected error loading your journal summary');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
  }, [user?.id]);

  return (
    <Card className="w-full bg-card shadow-sm border">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Your last 7 days
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          A brief summary of your recent journal entries
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm p-4">{error}</div>
        ) : !summaryData?.hasEntries ? (
          <motion.div 
            className="text-center py-8 text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-2 text-lg font-medium">You haven't journaled anything yet</p>
            <p className="text-sm">Start today and see insights appear here!</p>
          </motion.div>
        ) : (
          <>
            <motion.div 
              className="mb-4 p-4 rounded-lg bg-primary/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-foreground">{summaryData.summary}</p>
              {summaryData.entryCount && (
                <p className="text-xs text-muted-foreground mt-2">
                  Based on {summaryData.entryCount} {summaryData.entryCount === 1 ? 'entry' : 'entries'}
                </p>
              )}
            </motion.div>
            
            {summaryData.topEntities.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Key topics mentioned:</h4>
                <EntityBubbles entities={summaryData.topEntities} className="h-40" />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalSummaryCard;
