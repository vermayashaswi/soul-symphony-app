
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Plus, ChartBar } from 'lucide-react';
import DiagnosticsButton from '@/components/diagnostics/DiagnosticsButton';

interface JournalHeaderProps {
  onCreateJournal: () => void;
  onViewInsights: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function JournalHeader({ onCreateJournal, onViewInsights, onRefresh, isRefreshing }: JournalHeaderProps) {
  return (
    <Card className="border border-input">
      <CardContent className="p-4 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <Button onClick={onCreateJournal} className="flex items-center gap-1">
            <Plus className="h-4 w-4" />
            <span>New Entry</span>
          </Button>
          
          <Button variant="outline" onClick={onViewInsights} className="flex items-center gap-1">
            <ChartBar className="h-4 w-4" />
            <span>Insights</span>
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <DiagnosticsButton variant="minimal" />
          
          <Button 
            variant="outline" 
            onClick={onRefresh} 
            disabled={isRefreshing} 
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
