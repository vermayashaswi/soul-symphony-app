
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, PlusCircle, BarChart2, MessageSquare, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface JournalHeaderProps {
  onCreateJournal: () => void;
  onViewInsights: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const JournalHeader: React.FC<JournalHeaderProps> = ({
  onCreateJournal,
  onViewInsights,
  onRefresh,
  isRefreshing,
}) => {
  const navigate = useNavigate();
  const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
  
  const handleChatNavigation = () => {
    navigate('/chat');
  };
  
  const handleProcessEmbeddings = async () => {
    try {
      setIsProcessingEmbeddings(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You need to be logged in to process embeddings");
        return;
      }
      
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/embed-all-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          processAll: false // Only process entries without embeddings
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Successfully processed ${result.processedCount} entries`);
      } else {
        toast.error("Error processing embeddings: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error processing embeddings:", error);
      toast.error("Failed to process embeddings. Please try again.");
    } finally {
      setIsProcessingEmbeddings(false);
    }
  };
  
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold">Your Journal</h1>
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleProcessEmbeddings}
          disabled={isProcessingEmbeddings}
        >
          {isProcessingEmbeddings ? (
            <>
              <Zap className="h-4 w-4 mr-2 animate-pulse" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Process Embeddings
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleChatNavigation}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onViewInsights}
        >
          <BarChart2 className="h-4 w-4 mr-2" />
          Insights
        </Button>
        
        <Button onClick={onCreateJournal}>
          <PlusCircle className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>
    </div>
  );
};
