
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { JournalSearch } from './JournalSearch';

export interface JournalHeaderProps {
  onRecordClick?: () => void;
  onSearch?: (query: string) => void;
  onCreateJournal?: () => void;
  onViewInsights?: () => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const JournalHeader: React.FC<JournalHeaderProps> = ({ 
  onRecordClick,
  onSearch,
  onCreateJournal,
  onViewInsights,
  onRefresh,
  isRefreshing
}) => {
  // Use the appropriate handler based on what's provided
  const handleNewEntry = onRecordClick || onCreateJournal;
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-1">
          Record and view your journal entries
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {onSearch && <JournalSearch onSearch={onSearch} />}
        
        {handleNewEntry && (
          <Button onClick={handleNewEntry} className="sm:w-auto w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Entry
          </Button>
        )}
        
        {onRefresh && (
          <Button 
            onClick={onRefresh} 
            variant="outline" 
            size="icon" 
            disabled={isRefreshing}
            className={isRefreshing ? "animate-spin" : ""}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        
        {onViewInsights && (
          <Button 
            onClick={onViewInsights} 
            variant="outline"
          >
            Insights
          </Button>
        )}
      </div>
    </div>
  );
};

export default JournalHeader;
