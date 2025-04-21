
import React from "react";

export interface ChatDiagnosticStep {
  name: string;
  status: "pending" | "success" | "error" | "loading" | "warning" | "info";
  details?: string;
  timestamp?: string;
}

export interface ChatDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics?: {
    steps?: ChatDiagnosticStep[];
    gptResponses?: any[];
    functionResponses?: any[];
    [key: string]: any;
  };
}

// Empty component that doesn't render anything
export const ChatDiagnosticsModal: React.FC<ChatDiagnosticsModalProps> = () => {
  return null;
};

export default ChatDiagnosticsModal;
