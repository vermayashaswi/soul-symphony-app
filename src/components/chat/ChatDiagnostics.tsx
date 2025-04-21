
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// This file has been updated to include token usage diagnostics

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
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    contextUtilization?: number;
    modelMaxTokens?: number;
  };
  functionExecutions?: FunctionExecution[];
}

export default function ChatDiagnostics({
  queryText,
  isVisible,
  ragSteps,
  queryAnalysis,
  tokenUsage
}: ChatDiagnosticsProps) {
  if (!isVisible) return null;
  
  return (
    <div className="p-4 bg-muted/30 rounded-lg text-xs mt-2 border border-border">
      <h3 className="font-medium mb-2">Query Diagnostics</h3>
      
      {tokenUsage && (
        <div className="mb-4">
          <h4 className="text-xs font-medium mb-1">Token Usage</h4>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-muted-foreground">Prompt: </span>
              <span>{tokenUsage.promptTokens || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Completion: </span>
              <span>{tokenUsage.completionTokens || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span>{tokenUsage.totalTokens || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model Limit: </span>
              <span>{tokenUsage.modelMaxTokens || 16385}</span>
            </div>
          </div>
          
          {tokenUsage.contextUtilization !== undefined && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Context Utilization</span>
                <span className="text-xs">{Math.round(tokenUsage.contextUtilization * 100)}%</span>
              </div>
              <Progress 
                value={tokenUsage.contextUtilization * 100} 
                className={cn("h-1.5", tokenUsage.contextUtilization > 0.8 ? "bg-destructive" : "")}
              />
              {tokenUsage.contextUtilization > 0.8 && (
                <p className="text-xs text-destructive mt-1">
                  High context utilization - consider optimizing your query
                </p>
              )}
            </div>
          )}
        </div>
      )}
      
      {queryText && (
        <div className="mb-3">
          <h4 className="text-xs font-medium mb-1">Query</h4>
          <p className="text-xs whitespace-pre-wrap break-words">{queryText}</p>
        </div>
      )}
      
      {ragSteps && ragSteps.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium mb-1">Processing Steps</h4>
          <div className="space-y-1">
            {ragSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <Badge variant={
                  step.status === 'success' ? 'default' :
                  step.status === 'error' ? 'destructive' :
                  step.status === 'warning' ? 'secondary' :
                  step.status === 'loading' ? 'outline' : 'secondary'
                } className="h-5 text-[10px]">
                  {step.status}
                </Badge>
                <span>{step.step}</span>
                {step.details && <span className="text-[10px] text-muted-foreground">{step.details}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {queryAnalysis && (
        <div>
          <h4 className="text-xs font-medium mb-1">Query Analysis</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-muted-foreground">Type: </span>
              <span>{queryAnalysis.queryType}</span>
            </div>
            {queryAnalysis.emotion && (
              <div>
                <span className="text-muted-foreground">Emotion: </span>
                <span>{queryAnalysis.emotion}</span>
              </div>
            )}
            {queryAnalysis.theme && (
              <div>
                <span className="text-muted-foreground">Theme: </span>
                <span>{queryAnalysis.theme}</span>
              </div>
            )}
            {queryAnalysis.timeframe && queryAnalysis.timeframe.startDate && (
              <div>
                <span className="text-muted-foreground">Timeframe: </span>
                <span>
                  {queryAnalysis.timeframe.startDate} 
                  {queryAnalysis.timeframe.endDate ? ` to ${queryAnalysis.timeframe.endDate}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
