
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ChartBar, RefreshCw, Database } from 'lucide-react';
import { motion } from 'framer-motion';

interface JournalHeaderProps {
  onCreateJournal: () => void;
  onViewInsights: () => void;
  onProcessAllEmbeddings: () => void;
  isProcessingEmbeddings: boolean;
  onProcessUnprocessedEntries?: () => void;
  isProcessingUnprocessedEntries?: boolean;
}

export default function JournalHeader({ 
  onCreateJournal, 
  onViewInsights, 
  onProcessAllEmbeddings,
  isProcessingEmbeddings,
  onProcessUnprocessedEntries,
  isProcessingUnprocessedEntries = false
}: JournalHeaderProps) {
  const [showFixButton, setShowFixButton] = useState(false);
  
  // Check if there are unprocessed entries on mount
  useEffect(() => {
    // This only controls UI visibility, not functionality.
    // We'll display the fix button for demonstration
    setShowFixButton(true);
    
    // In a production app, we would check here if there are any
    // unprocessed entries and only show the button if needed
  }, []);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">Journal</CardTitle>
            <CardDescription>
              Record your thoughts and feelings to track your emotional wellbeing
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {showFixButton && onProcessUnprocessedEntries && (
              <Button 
                onClick={onProcessUnprocessedEntries} 
                variant="outline" 
                size="sm"
                disabled={isProcessingUnprocessedEntries}
              >
                {isProcessingUnprocessedEntries ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Fix Missing Embeddings
                  </>
                )}
              </Button>
            )}
            
            <Button 
              onClick={onProcessAllEmbeddings} 
              variant="outline" 
              size="sm"
              disabled={isProcessingEmbeddings}
            >
              {isProcessingEmbeddings ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Index Entries
                </>
              )}
            </Button>
            
            <Button
              onClick={onViewInsights}
              variant="outline"
              size="sm"
            >
              <ChartBar className="h-4 w-4 mr-2" />
              Insights
            </Button>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button onClick={onCreateJournal}>
                <Plus className="h-4 w-4 mr-2" />
                New Journal
              </Button>
            </motion.div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
