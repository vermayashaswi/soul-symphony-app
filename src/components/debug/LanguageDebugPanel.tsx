
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Bug } from 'lucide-react';
import { toast } from 'sonner';

type DebugEvent = {
  id: string;
  timestamp: number;
  type: string;
  target: string;
  details?: any;
};

const LanguageDebugPanel = () => {
  const [isVisible, setIsVisible] = useState(true); // Start visible by default
  const [events, setEvents] = useState<DebugEvent[]>([]);
  
  // Create a global debug event handler
  React.useEffect(() => {
    console.log("Debug panel initialized");
    
    if (!window.debugEvents) {
      window.debugEvents = {
        log: (type: string, target: string, details?: any) => {
          const newEvent = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            type,
            target,
            details
          };
          
          console.log('Debug event:', newEvent);
          setEvents(prev => [newEvent, ...prev]);
          return newEvent;
        },
        clear: () => {
          setEvents([]);
        },
        events: () => events
      };
    }
    
    // Log initialization event
    setTimeout(() => {
      if (window.debugEvents) {
        window.debugEvents.log('init', 'LanguageDebugPanel', {
          timestamp: Date.now(),
          visible: isVisible
        });
      }
    }, 500);
    
    // Add global click handler to track all clicks
    const handleGlobalClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      let targetPath = [];
      
      // Build path of elements that were clicked
      while (target && target !== document.body) {
        let identifier = target.id ? `#${target.id}` : 
                        target.className && typeof target.className === 'string' ? 
                        `.${target.className.split(' ')[0]}` : target.tagName;
        targetPath.push(identifier);
        target = target.parentElement as HTMLElement;
      }
      
      window.debugEvents?.log('click', 'document', {
        path: targetPath.join(' > '),
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        defaultPrevented: e.defaultPrevented,
        eventPhase: e.eventPhase,
        timestamp: e.timeStamp
      });
    };
    
    document.addEventListener('click', handleGlobalClick, true);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);
  
  const clearEvents = () => {
    setEvents([]);
    toast.info("Debug events cleared");
  };
  
  const copyEventsToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    toast.success("Debug events copied to clipboard");
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          className="bg-red-600 hover:bg-red-700"
          size="sm" 
          onClick={() => setIsVisible(true)}
          aria-label="Show debug panel"
        >
          <Bug className="mr-1" /> Show Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        className="bg-red-600 hover:bg-red-700 mb-2"
        size="sm" 
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Toggle debug panel"
      >
        <Bug className="mr-1" /> {isVisible ? 'Hide' : 'Show'} Debug Panel
      </Button>
      
      <Card className="w-80 sm:w-96 max-h-[80vh] bg-background/95 backdrop-blur-sm border-red-300 shadow-lg">
        <div className="p-2 border-b flex justify-between items-center">
          <h3 className="text-sm font-medium">Language Selector Debug</h3>
          <div className="space-x-1">
            <Button size="sm" variant="outline" onClick={clearEvents} className="h-7 text-xs">
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={copyEventsToClipboard} className="h-7 text-xs">
              Copy
            </Button>
          </div>
        </div>
        <ScrollArea className="h-80 p-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              Click on the globe icon to see debug events
            </p>
          ) : (
            <div className="space-y-2">
              {events.map(event => (
                <div key={event.id} className="text-xs border p-2 rounded-md">
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span>{event.type}</span>
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="font-medium">{event.target}</div>
                  {event.details && (
                    <div className="mt-1 overflow-auto max-h-32">
                      <pre className="text-xs">{JSON.stringify(event.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
};

export default LanguageDebugPanel;
