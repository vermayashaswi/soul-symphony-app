
// Diagnostics facility is removed, always returns null

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

export default function ChatDiagnostics(_: ChatDiagnosticsProps) {
  return null;
}
