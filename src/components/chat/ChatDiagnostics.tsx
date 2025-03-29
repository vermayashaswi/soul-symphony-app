
import { useState } from 'react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Check, X, Loader2, ChevronRight, ChevronDown, Code } from 'lucide-react';
import { MessageReference } from './ChatArea';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DiagnosticsStep {
  id: number;
  step: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  details?: string;
  timestamp?: string;
}

interface QueryAnalysis {
  queryType: 'emotional' | 'temporal' | 'thematic' | 'general';
  emotion: string | null;
  theme: string | null;
  timeframe: {
    timeType: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  isWhenQuestion: boolean;
}

export interface FunctionExecution {
  name: string;
  params?: Record<string, any>;
  result?: any;
  executionTime?: number;
  success: boolean;
}

interface ChatDiagnosticsProps {
  queryText: string;
  isVisible: boolean;
  ragSteps: DiagnosticsStep[];
  references: MessageReference[] | null;
  similarityScores: {id: number, score: number}[] | null;
  queryAnalysis?: QueryAnalysis | null;
  functionExecutions?: FunctionExecution[] | null;
}

export default function ChatDiagnostics({ 
  queryText, 
  isVisible, 
  ragSteps, 
  references,
  similarityScores,
  queryAnalysis,
  functionExecutions
}: ChatDiagnosticsProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('process');

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
                  
                  {queryAnalysis.theme && (
                    <>
                      <div>Theme:</div>
                      <div className="font-medium capitalize">{queryAnalysis.theme}</div>
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
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-2">
              <TabsTrigger value="process">Process Steps</TabsTrigger>
              <TabsTrigger value="functions">Supabase Functions</TabsTrigger>
              <TabsTrigger value="entries">Retrieved Entries</TabsTrigger>
            </TabsList>
            
            <TabsContent value="process" className="space-y-2">
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
            </TabsContent>
            
            <TabsContent value="functions">
              <div className="space-y-2 text-xs">
                {functionExecutions && functionExecutions.length > 0 ? (
                  functionExecutions.map((func, idx) => (
                    <div 
                      key={idx} 
                      className={`border rounded p-2 ${func.success ? 'border-green-200' : 'border-red-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium flex items-center">
                          <Code className="h-3 w-3 mr-1" />
                          {func.name}
                        </div>
                        <Badge variant={func.success ? "success" : "destructive"} className="text-[10px] h-5">
                          {func.success ? 'Success' : 'Failed'}
                          {func.executionTime && ` (${func.executionTime}ms)`}
                        </Badge>
                      </div>
                      
                      {func.params && (
                        <div className="mt-2">
                          <div className="text-muted-foreground mb-1">Parameters:</div>
                          <pre className="bg-slate-800 text-white p-1 rounded text-[10px] overflow-x-auto">
                            {JSON.stringify(func.params, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {func.result && (
                        <div className="mt-2">
                          <div className="text-muted-foreground mb-1">Result:</div>
                          <pre className="bg-slate-800 text-white p-1 rounded text-[10px] overflow-x-auto">
                            {typeof func.result === 'object' 
                              ? JSON.stringify(func.result, null, 2) 
                              : func.result}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No function execution data available
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="entries">
              {references && references.length > 0 ? (
                <ScrollArea className="h-52 rounded border">
                  <div className="p-3 space-y-3">
                    {references.map((ref, idx) => (
                      <div key={idx} className="text-xs border-l-2 border-primary pl-2 py-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{format(new Date(ref.date), 'MMM d, yyyy h:mm a')}</div>
                          <div className="flex items-center gap-1">
                            {ref.type && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                {ref.type}
                              </Badge>
                            )}
                            {ref.similarity !== undefined && (
                              <Badge 
                                variant="secondary" 
                                className="text-[10px] h-5"
                              >
                                Score: {(ref.similarity * 100).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-1">{ref.snippet}</div>
                        {ref.emotions && Object.keys(ref.emotions).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(ref.emotions)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3)
                              .map(([emotion, score]) => (
                                <span key={emotion} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">
                                  {emotion}: {Math.round(score * 100)}%
                                </span>
                              ))
                            }
                          </div>
                        )}
                        {ref.themes && ref.themes.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[10px] text-muted-foreground">Themes: </span>
                            {ref.themes.map((theme) => (
                              <span key={theme} className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px]">
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No entries were retrieved for this query
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
