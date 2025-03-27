
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { JournalSearch } from './JournalSearch';

interface JournalHeaderProps {
  onRecordClick: () => void;
  onSearch: (query: string) => void;
}

export const JournalHeader: React.FC<JournalHeaderProps> = ({ 
  onRecordClick,
  onSearch
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-1">
          Record and view your journal entries
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <JournalSearch onSearch={onSearch} />
        
        <Button onClick={onRecordClick} className="sm:w-auto w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>
    </div>
  );
};

export default JournalHeader;
