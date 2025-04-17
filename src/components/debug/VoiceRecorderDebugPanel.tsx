
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress';
  timestamp?: number;
  details?: string;
  duration?: number;
};

interface VoiceRecorderDebugPanelProps {
  steps: DebugStep[];
  isVisible: boolean;
  toggleVisibility: () => void;
  className?: string;
}

export function VoiceRecorderDebugPanel({
  steps,
  isVisible,
  toggleVisibility,
  className
}: VoiceRecorderDebugPanelProps) {
  const [open, setOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Card className={cn("fixed bottom-4 right-4 z-50 w-[400px] max-w-[95vw] shadow-lg", className)}>
      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-t-lg flex justify-between items-center">
        <h3 className="font-medium text-sm flex items-center">
          <span className="relative flex h-3 w-3 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          Voice Recorder Debug Panel
        </h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0" 
            onClick={toggleVisibility}
          >
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </Button>
        </div>
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className="flex items-start py-2 border-b border-slate-200 dark:border-slate-700 last:border-0"
              >
                <div className="mr-3 mt-0.5">
                  {step.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {step.status === 'in-progress' && (
                    <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                  )}
                  {step.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-5 w-5 border-2 border-slate-300 dark:border-slate-600 rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{step.name}</p>
                    {step.timestamp && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(step.timestamp).toLocaleTimeString()} 
                        {step.duration !== undefined && (
                          <span className="ml-1">({step.duration.toFixed(2)}s)</span>
                        )}
                      </span>
                    )}
                  </div>
                  {step.details && (
                    <p className="text-xs mt-1 text-slate-600 dark:text-slate-300 break-words">
                      {step.details}
                    </p>
                  )}
                  {step.status === 'in-progress' && step.timestamp && (
                    <div className="mt-1">
                      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, (currentTime - step.timestamp) / 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1 text-slate-500">
                        {((currentTime - step.timestamp) / 1000).toFixed(1)}s elapsed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {steps.length === 0 && (
              <div className="py-4 text-center text-slate-500 dark:text-slate-400">
                <p className="text-sm">No events recorded yet</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default VoiceRecorderDebugPanel;
