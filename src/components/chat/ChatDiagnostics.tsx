
import { useState } from 'react';
import { AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  queryAnalysis
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
          
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {ragSteps.map((step) => (
              <div key={step.id} className="flex items-start p-2 border-b border-dashed border-muted last:border-0 bg-background rounded-sm mb-1">
                <div 
                  className={`h-3.5 w-3.5 rounded-full mt-0.5 mr-2 ${
                    step.status === 'success' ? 'bg-green-500' : 
                    step.status === 'error' ? 'bg-red-500' : 
                    step.status === 'warning' ? 'bg-amber-500' : 
                    'bg-blue-500 animate-pulse'
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium">{step.step}</p>
                  {step.details && (
                    <div className="text-muted-foreground mt-1 bg-muted/30 p-1 rounded">
                      {step.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
