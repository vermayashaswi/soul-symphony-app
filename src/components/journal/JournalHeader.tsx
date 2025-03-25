
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, PlusCircle, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  isRefreshing
}) => {
  const navigate = useNavigate();
  
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
