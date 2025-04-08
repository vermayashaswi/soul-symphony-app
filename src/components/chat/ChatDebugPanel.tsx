
import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Download, Bug, Check, Database } from "lucide-react";

export interface DebugEvent {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  status: 'success' | 'error' | 'info' | 'warning';
}

interface ChatDebugPanelProps {
  onClose: () => void;
}

export const useChatDebugEvents = () => {
  const [events, setEvents] = useState<DebugEvent[]>([]);

  const addEvent = (action: string, details: string, status: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const newEvent: DebugEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      status
    };
    
    setEvents(prev => [...prev, newEvent]);
    
    // Log to console as well for additional visibility
    const logMethod = status === 'error' ? console.error : 
                      status === 'warning' ? console.warn : console.log;
    logMethod(`[ChatDebug] ${action}: ${details}`);
    
    return newEvent.id;
  };

  const clearEvents = () => setEvents([]);

  const exportEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportName = `chat-debug-log-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    linkElement.remove();
  };

  return { events, addEvent, clearEvents, exportEvents };
};

// Create a context for debug events
import { createContext, useContext } from 'react';

type ChatDebugContextType = ReturnType<typeof useChatDebugEvents> | null;

export const ChatDebugContext = createContext<ChatDebugContextType>(null);

export const useChatDebug = () => {
  const context = useContext(ChatDebugContext);
  if (!context) {
    throw new Error('useChatDebug must be used within a ChatDebugProvider');
  }
  return context;
};

export const ChatDebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const debugEvents = useChatDebugEvents();
  
  return (
    <ChatDebugContext.Provider value={debugEvents}>
      {children}
    </ChatDebugContext.Provider>
  );
};

const ChatDebugPanel: React.FC<ChatDebugPanelProps> = ({ onClose }) => {
  const { events, clearEvents, exportEvents } = useChatDebug();
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [events, autoScroll]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const getStatusBadge = (status: DebugEvent['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Success</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Error</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Info</Badge>;
    }
  };

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-96 h-96 bg-background/95 backdrop-blur-sm border shadow-lg rounded-t-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center">
          <Bug className="h-5 w-5 mr-2 text-primary" />
          <h3 className="font-medium">Chat Debug Panel</h3>
          <Badge variant="outline" className="ml-2">
            {events.length} events
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={clearEvents}
            title="Clear events"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={exportEvents}
            title="Export events"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={onClose}
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Database className="h-8 w-8 mb-2 opacity-50" />
              <p>No debug events logged yet</p>
              <p className="text-sm">Events will appear here as you use the chat</p>
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.id} 
                className={`p-2 border rounded-md ${
                  event.status === 'error' ? 'border-red-500/20 bg-red-500/5' :
                  event.status === 'success' ? 'border-green-500/20 bg-green-500/5' :
                  event.status === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                  'border-blue-500/20 bg-blue-500/5'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm">{event.action}</div>
                  {getStatusBadge(event.status)}
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {formatTime(event.timestamp)}
                </div>
                <div className="text-sm break-words whitespace-pre-wrap">
                  {event.details}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t flex justify-between items-center">
        <label className="flex items-center text-sm">
          <input 
            type="checkbox" 
            checked={autoScroll} 
            onChange={(e) => setAutoScroll(e.target.checked)} 
            className="mr-2"
          />
          Auto-scroll
        </label>
        <span className="text-xs text-muted-foreground">
          Last update: {events.length > 0 ? formatTime(events[events.length - 1].timestamp) : 'N/A'}
        </span>
      </div>
    </div>
  );
};

export default ChatDebugPanel;
