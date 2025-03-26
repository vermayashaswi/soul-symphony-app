
import React, { useState, useEffect } from 'react';
import { useDebug } from '@/contexts/debug/DebugContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, XCircle, Clock, Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { testDatabaseConnection } from '@/utils/supabase-connection';

interface OperationStatus {
  name: string;
  status: 'success' | 'error' | 'pending' | 'waiting';
  timestamp: number;
  duration?: number;
  details?: string;
  error?: any;
}

const JournalDiagnostics = () => {
  const { addLog } = useDebug();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [operations, setOperations] = useState<OperationStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Add a new operation status or update an existing one
  const updateOperation = (operation: OperationStatus) => {
    setOperations(prev => {
      const existing = prev.findIndex(op => op.name === operation.name);
      if (existing >= 0) {
        const newOps = [...prev];
        newOps[existing] = operation;
        return newOps;
      }
      return [...prev, operation];
    });
    
    // Also log to debug context
    if (operation.status === 'error') {
      addLog('error', `Journal diagnostic: ${operation.name} failed`, operation);
    } else {
      addLog('info', `Journal diagnostic: ${operation.name} ${operation.status}`, operation);
    }
  };

  // Test database connection
  const testConnection = async () => {
    setIsRunningTest(true);
    updateOperation({
      name: 'Database Connection Test',
      status: 'pending',
      timestamp: Date.now()
    });
    
    try {
      const startTime = Date.now();
      const result = await testDatabaseConnection();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        setConnectionStatus('connected');
        updateOperation({
          name: 'Database Connection Test',
          status: 'success',
          timestamp: Date.now(),
          duration,
          details: 'Successfully connected to database'
        });
      } else {
        setConnectionStatus('error');
        updateOperation({
          name: 'Database Connection Test',
          status: 'error',
          timestamp: Date.now(),
          duration,
          details: `Failed to connect: ${result.error || 'Unknown error'}`,
          error: result.error
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      updateOperation({
        name: 'Database Connection Test',
        status: 'error',
        timestamp: Date.now(),
        details: 'Exception during connection test',
        error
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  // Test profile access
  const testProfileAccess = async () => {
    updateOperation({
      name: 'Profile Access Test',
      status: 'pending',
      timestamp: Date.now()
    });
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      const duration = Date.now() - startTime;
      
      if (error) {
        updateOperation({
          name: 'Profile Access Test',
          status: 'error',
          timestamp: Date.now(),
          duration,
          details: `Failed to access profiles: ${error.message}`,
          error
        });
      } else {
        updateOperation({
          name: 'Profile Access Test',
          status: 'success',
          timestamp: Date.now(),
          duration,
          details: `Successfully fetched ${data?.length || 0} profiles`
        });
      }
    } catch (error) {
      updateOperation({
        name: 'Profile Access Test',
        status: 'error',
        timestamp: Date.now(),
        details: 'Exception during profile access test',
        error
      });
    }
  };

  // Test journal entries access
  const testJournalEntriesAccess = async () => {
    updateOperation({
      name: 'Journal Entries Access Test',
      status: 'pending',
      timestamp: Date.now()
    });
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('id')
        .limit(1);
      const duration = Date.now() - startTime;
      
      if (error) {
        updateOperation({
          name: 'Journal Entries Access Test',
          status: 'error',
          timestamp: Date.now(),
          duration,
          details: `Failed to access journal entries: ${error.message}`,
          error
        });
      } else {
        updateOperation({
          name: 'Journal Entries Access Test',
          status: 'success',
          timestamp: Date.now(),
          duration,
          details: `Successfully fetched ${data?.length || 0} journal entries`
        });
      }
    } catch (error) {
      updateOperation({
        name: 'Journal Entries Access Test',
        status: 'error',
        timestamp: Date.now(),
        details: 'Exception during journal entries access test',
        error
      });
    }
  };

  // Check auth session
  const checkAuthSession = async () => {
    updateOperation({
      name: 'Auth Session Test',
      status: 'pending',
      timestamp: Date.now()
    });
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.auth.getSession();
      const duration = Date.now() - startTime;
      
      if (error) {
        updateOperation({
          name: 'Auth Session Test',
          status: 'error',
          timestamp: Date.now(),
          duration,
          details: `Failed to get auth session: ${error.message}`,
          error
        });
      } else {
        updateOperation({
          name: 'Auth Session Test',
          status: 'success',
          timestamp: Date.now(),
          duration,
          details: data.session ? 'Active session found' : 'No active session'
        });
      }
    } catch (error) {
      updateOperation({
        name: 'Auth Session Test',
        status: 'error',
        timestamp: Date.now(),
        details: 'Exception during auth session test',
        error
      });
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunningTest(true);
    await testConnection();
    await checkAuthSession();
    await testProfileAccess();
    await testJournalEntriesAccess();
    setIsRunningTest(false);
    toast.success('Diagnostics completed');
  };

  // Run initial connection test
  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="fixed right-4 bottom-4 z-50 transition-all">
      {isMinimized ? (
        <Button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 shadow-lg"
          variant={connectionStatus === 'error' ? 'destructive' : 'default'}
        >
          {connectionStatus === 'checking' && <Clock className="h-4 w-4 animate-spin" />}
          {connectionStatus === 'connected' && <CheckCircle className="h-4 w-4" />}
          {connectionStatus === 'error' && <AlertCircle className="h-4 w-4" />}
          <span>Diagnostics</span>
        </Button>
      ) : (
        <Card className="w-80 shadow-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-md flex items-center gap-2">
              {connectionStatus === 'checking' && <Clock className="h-4 w-4 animate-spin" />}
              {connectionStatus === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {connectionStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
              Journal Diagnostics
            </CardTitle>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setIsOpen(!isOpen)}
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setIsMinimized(true)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <CardContent className="pb-3 pt-2 cursor-pointer">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Badge variant={connectionStatus === 'connected' ? 'outline' : 'destructive'}>
                      {connectionStatus === 'connected' ? 'Connected' : 'Connection Issues'}
                    </Badge>
                    {isRunningTest && <Badge variant="secondary">Running Tests...</Badge>}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      runAllTests();
                    }}
                    disabled={isRunningTest}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRunningTest ? 'animate-spin' : ''}`} />
                    Test All
                  </Button>
                </div>
              </CardContent>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {operations.map((op, index) => (
                    <div key={`${op.name}-${index}`} className="text-sm border rounded-md p-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                          {op.status === 'pending' && <Clock className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                          {op.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                          {op.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                          {op.status === 'waiting' && <Clock className="h-3.5 w-3.5 text-gray-500" />}
                          <span className="font-medium">{op.name}</span>
                        </div>
                        {op.duration && (
                          <span className="text-xs text-muted-foreground">
                            {op.duration}ms
                          </span>
                        )}
                      </div>
                      
                      {op.details && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {op.details}
                        </div>
                      )}
                      
                      {op.error && (
                        <div className="mt-1 text-xs text-red-500 whitespace-pre-wrap break-words font-mono">
                          {typeof op.error === 'object' 
                            ? JSON.stringify(op.error, null, 2) 
                            : String(op.error)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={testConnection}
                    disabled={isRunningTest}
                    className="flex gap-1 items-center"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>Test DB</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={checkAuthSession}
                    disabled={isRunningTest}
                  >
                    Test Auth
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
};

export default JournalDiagnostics;
