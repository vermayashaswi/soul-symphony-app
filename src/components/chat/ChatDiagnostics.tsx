
import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Clock, ArrowRight, Zap, Database, Brain, FileText } from 'lucide-react';

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
  processingTime?: {
    start: number;
    categorization: number;
    queryPlanning: number;
    execution: number;
    synthesis: number;
    total: number;
  };
  researchPlan?: string[];
}

export default function ChatDiagnostics({
  queryText,
  isVisible,
  ragSteps = [],
  references = [],
  similarityScores = [],
  queryAnalysis,
  functionExecutions = [],
  processingTime,
  researchPlan = []
}: ChatDiagnosticsProps) {
  const [activeTab, setActiveTab] = useState("steps");

  if (!isVisible) {
    return null;
  }

  // Convert the raw steps data to a more structured format for display
  const processedSteps = ragSteps.map((step, index) => {
    let icon;
    switch (step.status) {
      case 'success':
        icon = <CheckCircle className="h-4 w-4 text-green-500" />;
        break;
      case 'error':
        icon = <AlertCircle className="h-4 w-4 text-red-500" />;
        break;
      case 'warning':
        icon = <AlertCircle className="h-4 w-4 text-yellow-500" />;
        break;
      case 'loading':
        icon = <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
        break;
      default:
        icon = <Clock className="h-4 w-4 text-gray-400" />;
    }

    return {
      ...step,
      icon,
      formattedTimestamp: step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : undefined
    };
  });

  // Format the research plan for display
  const formattedResearchPlan = researchPlan.map(step => {
    try {
      const parsedStep = JSON.parse(step);
      if (parsedStep.type === "original_query") {
        return {
          type: "Query Context",
          description: parsedStep.query || "Original query",
          icon: <FileText className="h-4 w-4 text-blue-500" />
        };
      }
      
      let icon;
      switch (parsedStep.type) {
        case "vector_search":
          icon = <Brain className="h-4 w-4 text-purple-500" />;
          break;
        case "sql_query":
          icon = <Database className="h-4 w-4 text-orange-500" />;
          break;
        default:
          icon = <ArrowRight className="h-4 w-4 text-gray-500" />;
      }
      
      return {
        type: parsedStep.type === "vector_search" ? "Vector Search" : "SQL Query",
        description: parsedStep.description || "No description",
        parameters: parsedStep.parameters,
        icon
      };
    } catch (e) {
      return {
        type: "Unknown",
        description: "Unable to parse step",
        icon: <AlertCircle className="h-4 w-4 text-red-500" />
      };
    }
  });

  return (
    <Card className="mt-4 shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-md flex items-center">
          <Zap className="h-4 w-4 mr-2 text-yellow-500" />
          Query Diagnostics
          {processingTime?.total && (
            <Badge variant="secondary" className="ml-2">
              {(processingTime.total / 1000).toFixed(2)}s
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 pb-2">
          <TabsList className="w-full">
            <TabsTrigger value="steps" className="flex-1">Processing Steps</TabsTrigger>
            <TabsTrigger value="plan" className="flex-1">Research Plan</TabsTrigger>
            <TabsTrigger value="refs" className="flex-1">References</TabsTrigger>
            <TabsTrigger value="perf" className="flex-1">Performance</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="pt-2 pb-4">
          <TabsContent value="steps" className="m-0">
            <div className="space-y-2">
              {processedSteps.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {processedSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2">
                      <div className="pt-0.5">{step.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium">{step.step}</div>
                        {step.details && (
                          <div className="text-xs text-gray-500">{step.details}</div>
                        )}
                      </div>
                      {step.formattedTimestamp && (
                        <div className="text-xs text-gray-400">{step.formattedTimestamp}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Alert variant="default">
                  <AlertTitle>No diagnostic steps available</AlertTitle>
                  <AlertDescription>
                    Enable diagnostics to see detailed processing information.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="plan" className="m-0">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {formattedResearchPlan.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {formattedResearchPlan.map((step, i) => (
                    <AccordionItem key={i} value={`step-${i}`}>
                      <AccordionTrigger className="py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {step.icon}
                          <span>{step.type}: {step.description}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {step.parameters ? (
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(step.parameters, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No parameters</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <Alert variant="default">
                  <AlertTitle>No research plan available</AlertTitle>
                  <AlertDescription>
                    Research plan will appear here when a journal-specific query is executed.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="refs" className="m-0">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {references.length > 0 ? (
                references.map((ref, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-2 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium">Entry {ref.id}</span>
                      <Badge variant="outline" className="text-xs">
                        {ref.similarity ? `${(ref.similarity * 100).toFixed(1)}%` : 'N/A'}
                      </Badge>
                    </div>
                    <div className="text-gray-700 text-xs mb-1">
                      {ref.date ? new Date(ref.date).toLocaleString() : 'No date'}
                    </div>
                    <div className="text-xs bg-gray-50 p-2 rounded">
                      {ref.snippet || ref.content?.substring(0, 150) || 'No content'}
                    </div>
                  </div>
                ))
              ) : (
                <Alert variant="default">
                  <AlertTitle>No references found</AlertTitle>
                  <AlertDescription>
                    No journal entries were retrieved for this query.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="perf" className="m-0">
            {processingTime ? (
              <div className="space-y-3">
                <div className="flex flex-col space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span>Question Categorization:</span>
                    <span className="font-mono">{(processingTime.categorization / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (processingTime.categorization / processingTime.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span>Research Planning:</span>
                    <span className="font-mono">{(processingTime.queryPlanning / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-purple-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (processingTime.queryPlanning / processingTime.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span>Research Execution:</span>
                    <span className="font-mono">{(processingTime.execution / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (processingTime.execution / processingTime.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span>Response Synthesis:</span>
                    <span className="font-mono">{(processingTime.synthesis / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-orange-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (processingTime.synthesis / processingTime.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-1.5 pt-2 border-t border-gray-100 mt-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span>Total Processing Time:</span>
                    <span className="font-mono">{(processingTime.total / 1000).toFixed(2)}s</span>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="default">
                <AlertTitle>No performance data available</AlertTitle>
                <AlertDescription>
                  Performance metrics will appear here when diagnostics are enabled.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="pt-0 text-xs text-gray-500">
        Query: {queryText.substring(0, 100)}{queryText.length > 100 ? '...' : ''}
      </CardFooter>
    </Card>
  );
}
