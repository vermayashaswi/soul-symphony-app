
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { useDebugLog } from '@/utils/debug/DebugContext';
import ChatDiagnosticsModal, { ChatDiagnosticStep } from '@/components/chat/ChatDiagnosticsModal';
import { DebugProvider } from '@/utils/debug/DebugContext';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const debugLog = useDebugLog();
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [currentDiagnostics, setCurrentDiagnostics] = useState<any | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Check connection to Supabase
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('chat_threads').select('id').limit(1);
        
        if (error) {
          console.error("Database connection error:", error);
          toast({
            title: "Connection Error",
            description: "Having trouble connecting to the server. Some data might not load properly.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Supabase connection error:", err);
      }
    };
    
    if (user) {
      checkConnection();
    }
  }, [user, toast]);

  // Add CSS override to hide duplicate close button in chat sidebar
  useEffect(() => {
    // Create a style element to inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
      .chat-sidebar-close-duplicate {
        display: none !important;
      }
      
      /* Ensure chat input is always visible */
      .mobile-chat-input-container {
        padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 5px);
        z-index: 9999;
      }
      
      /* Add extra padding to chat area to prevent content from being hidden */
      .chat-messages-container {
        padding-bottom: 90px;
      }
      
      /* Ensure keyboard doesn't obscure input */
      .input-keyboard-active {
        position: sticky !important; 
        bottom: 0 !important;
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleOpenDiagnostics = () => {
    const diagnosticSteps: ChatDiagnosticStep[] = debugLog.getLogs().map(log => ({
      name: log.event,
      status: log.level === 'error' ? 'error' : 
             log.level === 'warning' ? 'warning' : 
             log.level === 'success' ? 'success' : 'info',
      details: log.message,
      timestamp: log.timestamp
    }));
    
    setCurrentDiagnostics({
      steps: diagnosticSteps,
      gptResponses: [],
      functionResponses: []
    });
    
    setDiagnosticsModalOpen(true);
  };

  return (
    <DebugProvider>
      <div className="w-full h-full flex flex-col relative">
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-50 flex items-center gap-1 bg-purple-100 text-purple-800 hover:bg-purple-200 hover:text-purple-900 shadow-md"
          onClick={handleOpenDiagnostics}
        >
          <Bug className="h-4 w-4" />
          <span className="hidden sm:inline">Diagnostics</span>
        </Button>
        
        <SmartChatInterface />
        
        <ChatDiagnosticsModal
          isOpen={diagnosticsModalOpen}
          onClose={() => setDiagnosticsModalOpen(false)}
          diagnostics={currentDiagnostics}
        />
      </div>
    </DebugProvider>
  );
};

export default Chat;
