
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  timestamp: number;
  step: string;
  details: any;
}

const JournalDebugPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleDebugEvent = (event: CustomEvent) => {
      const { detail } = event;
      setLogs(prevLogs => [...prevLogs, {
        timestamp: Date.now(),
        step: detail.step || 'unknown',
        details: detail
      }]);
    };

    window.addEventListener('debug:audio-processing' as any, handleDebugEvent as EventListener);
    window.addEventListener('debug:transcription' as any, handleDebugEvent as EventListener);
    
    return () => {
      window.removeEventListener('debug:audio-processing' as any, handleDebugEvent as EventListener);
      window.removeEventListener('debug:transcription' as any, handleDebugEvent as EventListener);
    };
  }, []);

  if (logs.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 shadow-lg bg-white/90 backdrop-blur">
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Journal Debug Info ({logs.length} events)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>Clear</Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-3">
          <ScrollArea className="h-80">
            {logs.map((log, index) => (
              <div key={index} className="mb-2 border-b pb-2 text-xs">
                <div className="font-medium">
                  {new Date(log.timestamp).toLocaleTimeString()} - {log.step}
                </div>
                <pre className="whitespace-pre-wrap text-xs mt-1 text-muted-foreground">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default JournalDebugPanel;
