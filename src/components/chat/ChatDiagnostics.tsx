
import { useState } from 'react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Check, X, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { MessageReference } from './ChatArea';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DiagnosticsStep {
  id: number;
  step: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  details?: string;
  timestamp?: string;
}

interface QueryAnalysis {
  queryType: 'emotional' | 'temporal' | 'general';
  emotion: string | null;
  timeframe: {
    timeType: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  isWhenQuestion: boolean;
}

interface ChatDiagnosticsProps {
  queryText: string;
  isVisible: boolean;
  ragSteps: DiagnosticsStep[];
  references: MessageReference[] | null;
  similarityScores: {id: number, score: number}[] | null;
  queryAnalysis?: QueryAnalysis | null;
}

export default function ChatDiagnostics({ 
  queryText, 
  isVisible, 
  ragSteps, 
  references,
  similarityScores,
  queryAnalysis
}: ChatDiagnosticsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!isVisible) return null;

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-200"></div>;
    }
  };

  return (
    <div className="px-4 pb-4 border-t bg-gray-50/50 space-y-2">
      <Collapsible 
        open={expanded} 
        onOpenChange={setExpanded}
        className="w-full"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-sm font-medium text-left">
          <div className="flex items-center">
            {expanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
            <span>RAG Process Diagnostics</span>
          </div>
          <div className="text-xs text-gray-500">
            {ragSteps.filter(step => step.status === 'success').length} / {ragSteps.length} steps completed
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 mt-2">
          <div className="rounded border p-3 text-xs">
            <div className="font-medium mb-1">Query:</div>
            <div className="italic">{queryText}</div>
            
            {queryAnalysis && (
              <div className="mt-3 space-y-1">
                <div className="font-medium">Query Analysis:</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>Query Type:</div>
                  <div className="font-medium capitalize">{queryAnalysis.queryType}</div>
                  
                  {queryAnalysis.emotion && (
                    <>
                      <div>Emotion:</div>
                      <div className="font-medium capitalize">{queryAnalysis.emotion}</div>
                    </>
                  )}
                  
                  {queryAnalysis.timeframe.timeType && (
                    <>
                      <div>Time Range:</div>
                      <div className="font-medium capitalize">{queryAnalysis.timeframe.timeType}</div>
                      
                      <div>Start Date:</div>
                      <div>{queryAnalysis.timeframe.startDate ? 
                        format(new Date(queryAnalysis.timeframe.startDate), 'MMM d, yyyy h:mm a') : 
                        'Not specified'}</div>
                      
                      <div>End Date:</div>
                      <div>{queryAnalysis.timeframe.endDate ? 
                        format(new Date(queryAnalysis.timeframe.endDate), 'MMM d, yyyy h:mm a') : 
                        'Not specified'}</div>
                    </>
                  )}
                  
                  <div>Question Type:</div>
                  <div>{queryAnalysis.isWhenQuestion ? 'Temporal (When)' : 'General'}</div>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <div className="text-xs font-medium mb-2">Processing Steps:</div>
            <div className="space-y-2">
              {ragSteps.map((step) => (
                <div 
                  key={step.id}
                  className={`flex items-start p-2 rounded ${
                    step.status === 'error' 
                      ? 'bg-red-50' 
                      : step.status === 'success' 
                        ? 'bg-green-50' 
                        : 'bg-gray-50'
                  }`}
                >
                  <div className="mt-0.5 mr-2">{getStepIcon(step.status)}</div>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{step.step}</div>
                    {step.details && (
                      <div className="text-xs mt-1 text-gray-600">{step.details}</div>
                    )}
                  </div>
                  {step.timestamp && (
                    <div className="text-xs text-gray-500">{step.timestamp}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {references && references.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-2">Referenced Entries:</div>
              <ScrollArea className="h-40 rounded border">
                <div className="p-3 space-y-3">
                  {references.map((ref, idx) => (
                    <div key={idx} className="text-xs border-l-2 border-primary pl-2 py-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{format(new Date(ref.date), 'MMM d, yyyy h:mm a')}</div>
                        {ref.similarity !== undefined && (
                          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {ref.type === 'recent' ? 'Recent' : `Score: ${(ref.similarity * 100).toFixed(1)}%`}
                          </div>
                        )}
                      </div>
                      <div className="mt-1">{ref.snippet}</div>
                      {ref.emotions && Object.keys(ref.emotions).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(ref.emotions)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(([emotion, score]) => (
                              <span key={emotion} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                                {emotion}: {Math.round(score * 100)}%
                              </span>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
