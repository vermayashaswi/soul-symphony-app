
import React from "react";
import { X, Bug } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LogLevel } from "@/utils/debug/debugLogTypes";

export interface ChatDiagnosticStep {
  name: string;
  status: "pending" | "success" | "error" | "loading" | "warning" | "info";
  details?: string;
  timestamp?: string;
  // Optionally, include raw data for GPT, API/fn calls, etc.
}

export interface ChatDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics?: {
    steps?: ChatDiagnosticStep[];
    gptResponses?: any[]; // string[] or any[] depending on backend
    functionResponses?: any[]; // string[] or any[] depending on backend
    [key: string]: any;
  };
}

const statusColorMap: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  loading: "bg-yellow-100 text-yellow-800",
  warning: "bg-orange-100 text-orange-900",
  pending: "bg-gray-100 text-gray-800",
};

export const ChatDiagnosticsModal: React.FC<ChatDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
}) => {
  if (!diagnostics) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Chat Diagnostics
          </DialogTitle>
          <button onClick={onClose} className="ml-auto">
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-4">
          {/* Step-by-step high-level & granular diagnostics */}
          {diagnostics.steps && diagnostics.steps.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-2">Processing Steps</h3>
              <ul className="space-y-2">
                {diagnostics.steps.map((step, i) => (
                  <li
                    className="rounded border p-2 bg-muted/20"
                    key={step.timestamp || i}
                  >
                    <div className="flex gap-2 items-center">
                      <Badge className={statusColorMap[step.status] || "bg-gray-200"}>
                        {step.status}
                      </Badge>
                      <span className="font-medium">{step.name}</span>
                      {step.timestamp && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {step.details && (
                      <div className="text-sm mt-1 text-muted-foreground whitespace-pre-line">
                        {typeof step.details === "string"
                          ? step.details
                          : JSON.stringify(step.details, null, 2)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* GPT and Function/API raw responses if available */}
          {(diagnostics.gptResponses?.length || diagnostics.functionResponses?.length) && (
            <div className="space-y-3">
              {diagnostics.gptResponses?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-1">GPT Responses</h3>
                  <ul className="space-y-1">
                    {diagnostics.gptResponses.map((gpt, i) => (
                      <li
                        className="text-xs bg-gray-100 rounded p-1 font-mono break-words"
                        key={`gpt-${i}`}
                      >
                        {typeof gpt === "string"
                          ? gpt
                          : JSON.stringify(gpt, null, 2)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {diagnostics.functionResponses?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-1">Function/Edge Function Responses</h3>
                  <ul className="space-y-1">
                    {diagnostics.functionResponses.map((fn, i) => (
                      <li
                        className="text-xs bg-gray-100 rounded p-1 font-mono break-words"
                        key={`fn-${i}`}
                      >
                        {typeof fn === "string"
                          ? fn
                          : JSON.stringify(fn, null, 2)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {/* Fallback if there are no diagnostics */}
          {!diagnostics.steps?.length &&
            !diagnostics.gptResponses?.length &&
            !diagnostics.functionResponses?.length && (
              <div className="text-center text-muted-foreground">
                No diagnostics available for this message.
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatDiagnosticsModal;
