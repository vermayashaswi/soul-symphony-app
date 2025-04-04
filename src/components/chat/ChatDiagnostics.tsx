
import { useState } from 'react';
import { AlertCircle, Info, ChevronDown, ChevronUp, Clock, Search, Database, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReactNode } from 'react';

// Define types for better TypeScript support
export interface FunctionExecution {
  name: string;
  success: boolean;
  executionTime?: number;
  params?: Record<string, any>;
  result?: Record<string, any>;
}

interface ChatDiagnosticsProps {
  queryText: string;
  isVisible: boolean;
  ragSteps: {
    id: number;
    step: string;
    status: 'pending' | 'success' | 'error' | 'loading' | 'warning';
    details?: string;
    timestamp?: string;
  }[];
  references?: any[];
  similarityScores?: {id: number | string, score: number}[];
  queryAnalysis?: {
    queryType: string;
    emotion: string | null;
    theme: string | null;
    timeframe: {
      timeType: any;
      startDate: string | null;
      endDate: string | null;
    };
    isWhenQuestion: boolean;
  };
  functionExecutions?: FunctionExecution[];
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
  const [showDetails, setShowDetails] = useState(false);
  
  if (!isVisible) return null;
  
  return (
    <Card className="bg-muted/20 border-dashed mt-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span>RAG Processing Debug</span>
            <Badge variant="outline" className="ml-2 text-xs bg-amber-100 text-amber-800">
              DIAGNOSTICS
            </Badge>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
            }
          </Button>
        </div>
      </CardHeader>
      
      {showDetails && (
        <CardContent className="pt-0 text-xs">
          <div className="mb-2 p-2 bg-background rounded border">
            <p className="font-mono break-words">
              <span className="text-muted-foreground mr-1">Query:</span> 
              {queryText}
            </p>
          </div>
          
          <Accordion type="single" collapsible className="w-full" defaultValue="steps">
            <AccordionItem value="steps">
              <AccordionTrigger className="py-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Process Steps
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ragSteps.map((step) => (
                    <div key={step.id} className="flex items-start py-1 border-b border-dashed border-muted last:border-0">
                      <div 
                        className={`h-3.5 w-3.5 rounded-full mt-0.5 mr-2 ${
                          step.status === 'success' ? 'bg-green-500' : 
                          step.status === 'error' ? 'bg-red-500' : 
                          step.status === 'warning' ? 'bg-amber-500' : 
                          'bg-blue-500 animate-pulse'
                        }`}
                      />
                      <div>
                        <p className="font-medium">{step.step}</p>
                        {step.details && <p className="text-muted-foreground text-[10px]">{step.details}</p>}
                        {step.timestamp && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{step.timestamp}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {queryAnalysis && (
              <AccordionItem value="analysis">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    Query Analysis
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-medium">Type:</span> {queryAnalysis.queryType}
                    </div>
                    {queryAnalysis.emotion && (
                      <div>
                        <span className="font-medium">Emotion:</span> {queryAnalysis.emotion}
                      </div>
                    )}
                    {queryAnalysis.theme && (
                      <div>
                        <span className="font-medium">Theme:</span> {queryAnalysis.theme}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Is When Question:</span> {queryAnalysis.isWhenQuestion ? 'Yes' : 'No'}
                    </div>
                    {queryAnalysis.timeframe && (
                      <div>
                        <span className="font-medium">Timeframe:</span> {queryAnalysis.timeframe.timeType?.type || 'Not specified'}
                        {queryAnalysis.timeframe.startDate && (
                          <div className="ml-3 text-[10px]">
                            <span className="font-medium">From:</span> {new Date(queryAnalysis.timeframe.startDate).toLocaleDateString()}
                          </div>
                        )}
                        {queryAnalysis.timeframe.endDate && (
                          <div className="ml-3 text-[10px]">
                            <span className="font-medium">To:</span> {new Date(queryAnalysis.timeframe.endDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            
            {references && references.length > 0 && (
              <AccordionItem value="references">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5" />
                    Retrieved Entries ({references.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {references.map((ref, index) => (
                      <div key={index} className="p-1.5 border rounded bg-background text-[10px]">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">
                            Entry ID: {ref.id.toString().substring(0, 8)}...
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] ${
                              ref.similarity ? 
                                (ref.similarity > 0.8 ? 'bg-green-100 text-green-800' : 
                                ref.similarity > 0.6 ? 'bg-amber-100 text-amber-800' : 
                                'bg-red-100 text-red-800') : 
                                'bg-muted'
                            }`}
                          >
                            {ref.similarity ? `Match: ${(ref.similarity * 100).toFixed(1)}%` : ref.type || 'Entry'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-1">
                          Date: {new Date(ref.date).toLocaleDateString()}
                        </p>
                        <div className="line-clamp-2 mb-1">{ref.snippet}</div>
                        {ref.emotions && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(ref.emotions).slice(0, 3).map(([emotion, value], i) => (
                              <Badge key={i} variant="secondary" className="text-[8px]">
                                {emotion}: {typeof value === 'number' ? (value * 100).toFixed(0) : String(value)}%
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            
            {functionExecutions && functionExecutions.length > 0 && (
              <AccordionItem value="functions">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5" />
                    Function Executions ({functionExecutions.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {functionExecutions.map((func, index) => (
                      <div key={index} className="p-1.5 border rounded bg-background text-[10px]">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{func.name}</span>
                          <Badge variant={func.success ? "success" : "destructive"} className="text-[9px]">
                            {func.success ? 'Success' : 'Failed'}
                          </Badge>
                        </div>
                        {func.executionTime && (
                          <div className="text-muted-foreground">
                            Time: {func.executionTime}ms
                          </div>
                        )}
                        {func.params && Object.keys(func.params).length > 0 && (
                          <div className="mt-1">
                            <span className="font-medium">Params:</span>
                            <pre className="text-[9px] bg-muted p-1 rounded mt-0.5 overflow-x-auto">
                              {JSON.stringify(func.params, null, 1)}
                            </pre>
                          </div>
                        )}
                        {func.result && Object.keys(func.result).length > 0 && (
                          <div className="mt-1">
                            <span className="font-medium">Result:</span>
                            <pre className="text-[9px] bg-muted p-1 rounded mt-0.5 overflow-x-auto">
                              {JSON.stringify(func.result, null, 1)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            
            {similarityScores && similarityScores.length > 0 && (
              <AccordionItem value="scores">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5" />
                    Similarity Scores
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {similarityScores.map((score, index) => (
                      <div key={index} className="flex justify-between items-center py-0.5 border-b last:border-0">
                        <span>Entry ID: {score.id.toString().substring(0, 8)}...</span>
                        <Badge 
                          variant="outline" 
                          className={`${
                            score.score > 0.8 ? 'bg-green-100 text-green-800' : 
                            score.score > 0.6 ? 'bg-amber-100 text-amber-800' : 
                            'bg-red-100 text-red-800'
                          }`}
                        >
                          {(score.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}
