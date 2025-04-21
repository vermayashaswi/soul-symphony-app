
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export interface ChatDiagnosticStep {
  name: string;
  status: "pending" | "success" | "error" | "loading" | "warning" | "info" | "in_progress";
  details?: string;
  timestamp?: string;
}

export interface ChatDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics?: {
    steps?: ChatDiagnosticStep[];
    totalTime?: number;
    functionCalls?: any[];
    similarityScores?: any[];
    [key: string]: any;
  };
}

export const ChatDiagnosticsModal: React.FC<ChatDiagnosticsModalProps> = ({ 
  isOpen, 
  onClose,
  diagnostics 
}) => {
  if (!isOpen || !diagnostics) return null;
  
  const { steps = [], totalTime, functionCalls = [], similarityScores = [] } = diagnostics;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Query Processing Diagnostics</DialogTitle>
          <DialogDescription>
            {totalTime ? (
              <span>Total processing time: {(totalTime / 1000).toFixed(2)}s</span>
            ) : (
              <span>View detailed diagnostics about query processing</span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Processing Steps */}
            <div>
              <h3 className="text-lg font-medium mb-2">Processing Steps</h3>
              <div className="space-y-2">
                {steps.length > 0 ? (
                  steps.map((step, idx) => (
                    <div key={idx} className="border rounded-md p-3">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">{step.name}</div>
                        <StatusBadge status={step.status} />
                      </div>
                      {step.details && (
                        <div className="text-sm text-gray-500 mt-1">{step.details}</div>
                      )}
                      {step.timestamp && (
                        <div className="text-xs text-gray-400 mt-2">{new Date(step.timestamp).toLocaleTimeString()}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No processing steps recorded</div>
                )}
              </div>
            </div>
            
            {/* Function Calls */}
            {functionCalls.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Function Executions</h3>
                <div className="space-y-2">
                  {functionCalls.map((func, idx) => (
                    <div key={idx} className="border rounded-md p-3">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">{func.name}</div>
                        <Badge variant={func.success ? "default" : "destructive"}>
                          {func.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                      
                      {func.params && (
                        <div className="mt-2">
                          <div className="text-sm font-medium">Parameters:</div>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(func.params, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {func.result && (
                        <div className="mt-2">
                          <div className="text-sm font-medium">Result:</div>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(func.result, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {func.executionTime && (
                        <div className="text-xs text-gray-400 mt-2">
                          Execution time: {(func.executionTime / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Similarity Scores */}
            {similarityScores.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Similarity Scores</h3>
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entry ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Similarity Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {similarityScores.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(item.score * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// Helper component for status badges
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getVariant = () => {
    switch (status) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'secondary';
      case 'loading':
      case 'in_progress':
        return 'outline';
      default: return 'secondary';
    }
  };
  
  return (
    <Badge variant={getVariant()}>
      {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export default ChatDiagnosticsModal;
