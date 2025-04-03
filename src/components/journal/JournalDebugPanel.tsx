
import React, { useState, useEffect, useRef } from 'react';
import { X, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Operation {
  id: string;
  type: string;
  message: string;
  status: 'pending' | 'success' | 'error';
  details?: string;
  timestamp: Date;
}

const JournalDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const operationsRef = useRef<Operation[]>([]);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };
  
  useEffect(() => {
    const handleOperationStart = (event: CustomEvent) => {
      const detail = event.detail || {};
      const id = detail.id || generateId();
      
      // If id is already set, use it; otherwise, add a generated one
      if (!detail.id) {
        event.detail = { ...detail, id };
      }
      
      const newOperation: Operation = {
        id,
        type: detail.type || 'unknown',
        message: detail.message || 'Operation started',
        status: detail.status || 'pending',
        details: detail.details,
        timestamp: new Date()
      };
      
      setLastOperationId(id);
      operationsRef.current = [newOperation, ...operationsRef.current.slice(0, 99)];
      setOperations(operationsRef.current);
      
      return id;
    };
    
    const handleOperationUpdate = (event: CustomEvent) => {
      const detail = event.detail || {};
      const id = detail.id;
      
      if (!id) return;
      
      const updatedOperations = operationsRef.current.map(op => {
        if (op.id === id) {
          return {
            ...op,
            status: detail.status || op.status,
            message: detail.message || op.message,
            details: detail.details || op.details,
            timestamp: new Date()
          };
        }
        return op;
      });
      
      operationsRef.current = updatedOperations;
      setOperations(updatedOperations);
    };
    
    const startHandler = (e: Event) => handleOperationStart(e as CustomEvent);
    const updateHandler = (e: Event) => handleOperationUpdate(e as CustomEvent);
    
    window.addEventListener('journalOperationStart', startHandler);
    window.addEventListener('journalOperationUpdate', updateHandler);
    
    return () => {
      window.removeEventListener('journalOperationStart', startHandler);
      window.removeEventListener('journalOperationUpdate', updateHandler);
    };
  }, []);
  
  // Auto-open on error
  useEffect(() => {
    const hasErrors = operations.some(op => op.status === 'error');
    if (hasErrors && !isOpen) {
      setIsOpen(true);
    }
  }, [operations, isOpen]);
  
  // Test functions for debugging
  const testFetchEntities = async () => {
    const testId = generateId();
    window.dispatchEvent(new CustomEvent('journalOperationStart', {
      detail: {
        id: testId,
        type: 'test',
        message: 'Testing batch-extract-entities function'
      }
    }));
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          diagnosticMode: true
        }
      });
      
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'success',
          message: 'Entity extraction test completed',
          details: JSON.stringify(result, null, 2)
        }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'error',
          message: 'Entity extraction test failed',
          details: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };
  
  const testGenerateThemes = async () => {
    const testId = generateId();
    window.dispatchEvent(new CustomEvent('journalOperationStart', {
      detail: {
        id: testId,
        type: 'test',
        message: 'Testing generate-themes function'
      }
    }));
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-themes', {
        body: { 
          text: "This is a test journal entry to check if theme generation is working properly. I had a great day today talking with friends and working on my project."
        }
      });
      
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'success',
          message: 'Theme generation test completed',
          details: JSON.stringify(result, null, 2)
        }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'error',
          message: 'Theme generation test failed',
          details: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };
  
  const testCheckApiKeys = async () => {
    const testId = generateId();
    window.dispatchEvent(new CustomEvent('journalOperationStart', {
      detail: {
        id: testId,
        type: 'test',
        message: 'Checking API keys configuration'
      }
    }));
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Check if OpenAI API key is configured
      const openaiResult = await supabase.functions.invoke('generate-themes', {
        body: { 
          text: "Test",
          checkApiKeyOnly: true
        }
      });
      
      // Check if Google API key is configured
      const googleResult = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          diagnosticMode: true,
          checkApiKeyOnly: true
        }
      });
      
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'success',
          message: 'API keys check completed',
          details: JSON.stringify({
            openai: openaiResult,
            google: googleResult
          }, null, 2)
        }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: testId,
          status: 'error',
          message: 'API keys check failed',
          details: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };
  
  if (!isOpen) {
    return (
      <Button 
        className="fixed bottom-4 right-4 rounded-full p-2 shadow-md bg-secondary"
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="icon"
      >
        <Bug className="h-5 w-5" />
      </Button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 w-[32rem] max-w-[calc(100vw-2rem)] bg-background border rounded-lg shadow-lg flex flex-col h-[32rem] z-50">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-2">
          <Bug className="h-5 w-5" />
          <h3 className="font-medium">Journal Debug Panel</h3>
        </div>
        <div className="flex items-center space-x-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setIsOpen(false)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="border-b p-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={testFetchEntities}>Test Entity Extraction</Button>
        <Button size="sm" variant="outline" onClick={testGenerateThemes}>Test Theme Generation</Button>
        <Button size="sm" variant="outline" onClick={testCheckApiKeys}>Check API Keys</Button>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        {operations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No operations logged yet
          </div>
        ) : (
          <div className="space-y-3">
            {operations.map((op) => (
              <div key={op.id} className="border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      op.status === 'success' 
                        ? 'default' 
                        : op.status === 'error' 
                          ? 'destructive' 
                          : 'secondary'
                    }>
                      {op.type}
                    </Badge>
                    <span className="font-medium">{op.message}</span>
                  </div>
                  <Badge variant={
                    op.status === 'success' 
                      ? 'outline' 
                      : op.status === 'error' 
                        ? 'destructive' 
                        : 'secondary'
                  }>
                    {op.status}
                  </Badge>
                </div>
                
                {op.details && (
                  <>
                    <Separator className="my-2" />
                    <div className="text-xs font-mono whitespace-pre-wrap bg-muted/50 p-2 rounded-sm overflow-x-auto">
                      {op.details}
                    </div>
                  </>
                )}
                
                <div className="text-xs text-muted-foreground mt-1">
                  {op.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default JournalDebugPanel;
