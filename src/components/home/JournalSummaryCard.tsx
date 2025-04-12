
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import PhysicsEntityBubbles from './PhysicsEntityBubbles';
import { supabase } from '@/integrations/supabase/client';

interface SummaryResponse {
  summary: string | null;
  topEntities: Array<{ name: string; count: number; type?: string }>;
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-28 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm p-2">{error}</div>
        ) : !summaryData?.hasEntries ? (
          <motion.div 
            className="text-center py-4 text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-medium">You haven't journaled anything yet</p>
            <p className="text-sm">Start today and see insights appear here!</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {summaryData.summary && (
              <motion.div 
                className="mb-3 rounded-md bg-primary/5 px-2 py-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-foreground text-2xs leading-tight">{summaryData.summary}</p>
              </motion.div>
            )}
            
            {summaryData.topEntities.length > 0 && (
              <PhysicsEntityBubbles 
                entities={summaryData.topEntities} 
                className="h-28 w-full" 
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalSummaryCard;
