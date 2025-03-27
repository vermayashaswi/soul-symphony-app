
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const JournalHeader = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const runSentimentAnalysis = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to analyze journal entries.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      toast({
        title: "Processing Started",
        description: "Analyzing sentiment for your journal entries. This may take a moment...",
      });
      
      const { data, error } = await supabase.functions.invoke('batch-analyze-sentiment', {
        body: { userId: user.id }
      });
      
      if (error) {
        console.error('Error processing sentiment:', error);
        toast({
          title: "Processing Failed",
          description: "There was an error analyzing your journal entries.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Processing Complete",
        description: `Successfully analyzed sentiment for ${data.processed} journal entries.`,
        variant: "default"
      });
      
      // Force a refresh of the journal entries page
      window.location.reload();
      
    } catch (error) {
      console.error('Error calling sentiment analysis function:', error);
      toast({
        title: "Error",
        description: "Failed to process sentiment analysis.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="bg-muted/30 py-8 md:py-12 border-b">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <motion.h1 
              className="text-3xl md:text-4xl font-bold flex items-center gap-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="h-6 w-6 text-amber-500" />
              Your Journal
            </motion.h1>
            <motion.p 
              className="text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Record your thoughts and feelings through voice journaling
            </motion.p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={runSentimentAnalysis}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin h-4 w-4 border-b-2 border-primary rounded-full"></span>
                Processing...
              </>
            ) : (
              <>Analyze Entry Sentiment</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JournalHeader;
