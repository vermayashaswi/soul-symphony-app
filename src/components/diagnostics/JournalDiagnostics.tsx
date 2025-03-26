
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, InfoIcon, Download, Bug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDebug } from '@/contexts/debug/DebugContext';
import { useAuth } from '@/contexts/AuthContext';

// Diagnostic test types
type TestResult = {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: string;
  timestamp: string;
};

type DiagnosticReport = {
  connectionStatus: 'connected' | 'error' | 'checking';
  tests: TestResult[];
  performanceMetrics: {
    responseTime: number | null;
    loadingTime: number | null;
  };
  clientInfo: {
    userAgent: string;
    timestamp: string;
  };
  errors: Array<{
    message: string;
    timestamp: string;
    context?: string;
  }>;
};

export default function JournalDiagnostics() {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport>({
    connectionStatus: 'checking',
    tests: [],
    performanceMetrics: {
      responseTime: null,
      loadingTime: null,
    },
    clientInfo: {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
    errors: [],
  });
  const { addLog } = useDebug();
  const { user } = useAuth();

  // Run basic connection check on component mount
  useEffect(() => {
    const checkConnection = async () => {
      const start = performance.now();
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .maybeSingle();
          
        const end = performance.now();
        const responseTime = end - start;
        
        setDiagnosticReport(prev => ({
          ...prev,
          connectionStatus: error ? 'error' : 'connected',
          performanceMetrics: {
            ...prev.performanceMetrics,
            responseTime
          },
          errors: error ? [
            ...prev.errors, 
            { 
              message: `Initial connection check failed: ${error.message}`, 
              timestamp: new Date().toISOString(),
              context: 'connection-check'
            }
          ] : prev.errors
        }));
        
        addLog('connection', `Initial database connection check: ${error ? 'Failed' : 'Success'}`, {
          responseTime,
          error: error?.message
        });
      } catch (err: any) {
        const end = performance.now();
        setDiagnosticReport(prev => ({
          ...prev,
          connectionStatus: 'error',
          performanceMetrics: {
            ...prev.performanceMetrics,
            responseTime: end - start
          },
          errors: [
            ...prev.errors, 
            { 
              message: `Connection check exception: ${err.message}`, 
              timestamp: new Date().toISOString(),
              context: 'connection-check-exception'
            }
          ]
        }));
        
        addLog('error', `Database connection check exception`, {
          error: err.message
        });
      }
    };
    
    checkConnection();
  }, [addLog]);

  const runDiagnosticTests = async () => {
    if (isRunningTests) return;
    
    setIsRunningTests(true);
    setIsExpanded(true);
    addLog('action', 'Manual diagnostic tests started');
    
    // Reset tests
    setDiagnosticReport(prev => ({
      ...prev,
      tests: []
    }));
    
    // Run tests in sequence
    await testDatabaseConnection();
    await testAuthConnection();
    await testJournalEntriesTable();
    await testStorageBucket();
    await testEdgeFunctions();
    
    setIsRunningTests(false);
    addLog('info', 'Diagnostic tests completed');
  };

  const testDatabaseConnection = async () => {
    const testName = 'Database Connection';
    
    // Add pending test
    setDiagnosticReport(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: testName,
        status: 'pending',
        message: 'Testing database connection...',
        timestamp: new Date().toISOString()
      }]
    }));
    
    try {
      const start = performance.now();
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
        
      const end = performance.now();
      
      if (error) {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'error',
              message: 'Database connection failed',
              details: `Error: ${error.message}`,
              timestamp: new Date().toISOString()
            } : test
          ),
          errors: [...prev.errors, {
            message: `Database connection test failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            context: 'database-test'
          }]
        }));
        
        addLog('error', 'Database connection test failed', {
          error: error.message,
          responseTime: end - start
        });
      } else {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'success',
              message: 'Database connection successful',
              details: `Response time: ${(end - start).toFixed(2)}ms`,
              timestamp: new Date().toISOString()
            } : test
          )
        }));
        
        addLog('info', 'Database connection test successful', {
          responseTime: end - start
        });
      }
    } catch (err: any) {
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: 'error',
            message: 'Database connection failed with exception',
            details: `Exception: ${err.message}`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: [...prev.errors, {
          message: `Database test exception: ${err.message}`,
          timestamp: new Date().toISOString(),
          context: 'database-test-exception'
        }]
      }));
      
      addLog('error', 'Database connection test exception', {
        error: err.message
      });
    }
  };

  const testAuthConnection = async () => {
    const testName = 'Authentication Service';
    
    // Add pending test
    setDiagnosticReport(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: testName,
        status: 'pending',
        message: 'Testing authentication service...',
        timestamp: new Date().toISOString()
      }]
    }));
    
    try {
      const start = performance.now();
      const { data, error } = await supabase.auth.getSession();
      const end = performance.now();
      
      if (error) {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'error',
              message: 'Authentication service error',
              details: `Error: ${error.message}`,
              timestamp: new Date().toISOString()
            } : test
          ),
          errors: [...prev.errors, {
            message: `Auth test failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            context: 'auth-test'
          }]
        }));
        
        addLog('error', 'Authentication service test failed', {
          error: error.message
        });
      } else {
        const sessionStatus = data.session ? 'Active session found' : 'No active session';
        
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'success',
              message: 'Authentication service working',
              details: `${sessionStatus}. Response time: ${(end - start).toFixed(2)}ms`,
              timestamp: new Date().toISOString()
            } : test
          )
        }));
        
        addLog('info', 'Authentication service test successful', {
          sessionStatus: sessionStatus,
          responseTime: end - start
        });
      }
    } catch (err: any) {
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: 'error',
            message: 'Authentication service exception',
            details: `Exception: ${err.message}`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: [...prev.errors, {
          message: `Auth test exception: ${err.message}`,
          timestamp: new Date().toISOString(),
          context: 'auth-test-exception'
        }]
      }));
      
      addLog('error', 'Authentication service test exception', {
        error: err.message
      });
    }
  };

  const testJournalEntriesTable = async () => {
    const testName = 'Journal Entries Table';
    
    // Add pending test
    setDiagnosticReport(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: testName,
        status: 'pending',
        message: 'Testing Journal Entries table access...',
        timestamp: new Date().toISOString()
      }]
    }));
    
    try {
      // First test - check table structure
      const start = performance.now();
      let testSuccessful = true;
      let errorMessage = '';
      let detailsMessage = '';
      
      // Try to select from the table
      const { data: entriesData, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id')
        .limit(1);
      
      if (entriesError) {
        testSuccessful = false;
        errorMessage = 'Journal Entries table access failed';
        detailsMessage = `Error: ${entriesError.message}`;
        
        addLog('error', 'Journal Entries table test failed', {
          error: entriesError.message
        });
      } else {
        detailsMessage = 'Journal Entries table accessible. ';
        
        // Check if user has entries (if authenticated)
        if (user?.id) {
          const { data: userEntries, error: userEntriesError } = await supabase
            .from('Journal Entries')
            .select('id, created_at')
            .eq('user_id', user.id)
            .limit(3);
            
          if (userEntriesError) {
            testSuccessful = false;
            errorMessage = 'User journal entries query failed';
            detailsMessage += `User entries error: ${userEntriesError.message}`;
            
            addLog('error', 'User journal entries test failed', {
              error: userEntriesError.message,
              userId: user.id
            });
          } else {
            const entriesCount = userEntries?.length || 0;
            detailsMessage += `Found ${entriesCount} entries for current user. `;
            
            addLog('info', 'User journal entries test successful', {
              entriesCount,
              userId: user.id
            });
          }
        } else {
          detailsMessage += 'No authenticated user to test specific entries. ';
        }
      }
      
      // Try to get the embeddings table
      const { data: embeddingsData, error: embeddingsError } = await supabase
        .from('journal_embeddings')
        .select('id')
        .limit(1);
        
      if (embeddingsError) {
        detailsMessage += `Embeddings table error: ${embeddingsError.message}`;
        
        addLog('error', 'Journal embeddings table test failed', {
          error: embeddingsError.message
        });
      } else {
        detailsMessage += 'Embeddings table accessible. ';
        
        addLog('info', 'Journal embeddings table test successful');
      }
      
      const end = performance.now();
      
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: testSuccessful ? 'success' : 'error',
            message: testSuccessful ? 'Journal Entries table accessible' : errorMessage,
            details: `${detailsMessage} Response time: ${(end - start).toFixed(2)}ms`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: !testSuccessful ? [...prev.errors, {
          message: `Journal entries test failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          context: 'journal-entries-test'
        }] : prev.errors
      }));
    } catch (err: any) {
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: 'error',
            message: 'Journal Entries exception',
            details: `Exception: ${err.message}`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: [...prev.errors, {
          message: `Journal entries test exception: ${err.message}`,
          timestamp: new Date().toISOString(),
          context: 'journal-entries-test-exception'
        }]
      }));
      
      addLog('error', 'Journal entries test exception', {
        error: err.message
      });
    }
  };

  const testStorageBucket = async () => {
    const testName = 'Audio Storage Bucket';
    
    // Add pending test
    setDiagnosticReport(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: testName,
        status: 'pending',
        message: 'Testing audio storage bucket...',
        timestamp: new Date().toISOString()
      }]
    }));
    
    try {
      const start = performance.now();
      
      // Check if the audio bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'error',
              message: 'Storage API error',
              details: `Error: ${bucketsError.message}`,
              timestamp: new Date().toISOString()
            } : test
          ),
          errors: [...prev.errors, {
            message: `Storage test failed: ${bucketsError.message}`,
            timestamp: new Date().toISOString(),
            context: 'storage-test'
          }]
        }));
        
        addLog('error', 'Storage bucket test failed', {
          error: bucketsError.message
        });
        return;
      }
      
      const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
      const end = performance.now();
      
      if (!audioBucket) {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'error',
              message: 'Audio bucket not found',
              details: `The 'audio' bucket does not exist in storage. This will cause recording uploads to fail.`,
              timestamp: new Date().toISOString()
            } : test
          ),
          errors: [...prev.errors, {
            message: 'Audio bucket not found in storage',
            timestamp: new Date().toISOString(),
            context: 'storage-test-missing-bucket'
          }]
        }));
        
        addLog('error', 'Audio bucket not found in storage');
      } else {
        // Try to get a file list to test permissions
        const { data: files, error: filesError } = await supabase.storage
          .from('audio')
          .list('journal', {
            limit: 1
          });
          
        let detailsMessage = `Audio bucket exists. Response time: ${(end - start).toFixed(2)}ms. `;
        
        if (filesError) {
          detailsMessage += `List files error: ${filesError.message}`;
          
          addLog('warning', 'Audio bucket exists but listing files failed', {
            error: filesError.message
          });
        } else {
          detailsMessage += `List files successful.`;
          
          addLog('info', 'Audio storage bucket test fully successful');
        }
        
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'success',
              message: 'Audio bucket exists',
              details: detailsMessage,
              timestamp: new Date().toISOString()
            } : test
          )
        }));
      }
    } catch (err: any) {
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: 'error',
            message: 'Storage test exception',
            details: `Exception: ${err.message}`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: [...prev.errors, {
          message: `Storage test exception: ${err.message}`,
          timestamp: new Date().toISOString(),
          context: 'storage-test-exception'
        }]
      }));
      
      addLog('error', 'Storage bucket test exception', {
        error: err.message
      });
    }
  };

  const testEdgeFunctions = async () => {
    const testName = 'Edge Functions';
    
    // Add pending test
    setDiagnosticReport(prev => ({
      ...prev,
      tests: [...prev.tests, {
        name: testName,
        status: 'pending',
        message: 'Testing edge functions...',
        timestamp: new Date().toISOString()
      }]
    }));
    
    try {
      const start = performance.now();
      
      // Test the transcribe-audio function with a test request
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { test: true }
      });
      
      const end = performance.now();
      
      if (error) {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'error',
              message: 'Edge function error',
              details: `Error: ${error.message}`,
              timestamp: new Date().toISOString()
            } : test
          ),
          errors: [...prev.errors, {
            message: `Edge function test failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            context: 'edge-function-test'
          }]
        }));
        
        addLog('error', 'Edge function test failed', {
          error: error.message
        });
      } else {
        setDiagnosticReport(prev => ({
          ...prev,
          tests: prev.tests.map(test => 
            test.name === testName ? {
              ...test,
              status: 'success',
              message: 'Edge function accessible',
              details: `Response time: ${(end - start).toFixed(2)}ms`,
              timestamp: new Date().toISOString()
            } : test
          )
        }));
        
        addLog('info', 'Edge function test successful', {
          responseTime: end - start
        });
      }
    } catch (err: any) {
      setDiagnosticReport(prev => ({
        ...prev,
        tests: prev.tests.map(test => 
          test.name === testName ? {
            ...test,
            status: 'error',
            message: 'Edge function exception',
            details: `Exception: ${err.message}`,
            timestamp: new Date().toISOString()
          } : test
        ),
        errors: [...prev.errors, {
          message: `Edge function test exception: ${err.message}`,
          timestamp: new Date().toISOString(),
          context: 'edge-function-test-exception'
        }]
      }));
      
      addLog('error', 'Edge function test exception', {
        error: err.message
      });
    }
  };

  const downloadReport = () => {
    const reportBlob = new Blob(
      [JSON.stringify(diagnosticReport, null, 2)], 
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(reportBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-diagnostics-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog('action', 'Diagnostic report downloaded');
  };

  const generateSummary = () => {
    const totalTests = diagnosticReport.tests.length;
    const passedTests = diagnosticReport.tests.filter(test => test.status === 'success').length;
    const failedTests = diagnosticReport.tests.filter(test => test.status === 'error').length;
    const pendingTests = diagnosticReport.tests.filter(test => test.status === 'pending').length;
    
    if (totalTests === 0) {
      return 'No diagnostic tests have been run yet';
    }
    
    let summary = `${passedTests} of ${totalTests} tests passed`;
    if (failedTests > 0) {
      summary += `, ${failedTests} failed`;
    }
    if (pendingTests > 0) {
      summary += `, ${pendingTests} pending`;
    }
    
    return summary;
  };

  const getOverallStatus = () => {
    if (diagnosticReport.tests.length === 0) {
      return diagnosticReport.connectionStatus;
    }
    
    const hasFailures = diagnosticReport.tests.some(test => test.status === 'error');
    const allPending = diagnosticReport.tests.every(test => test.status === 'pending');
    
    if (allPending) return 'checking';
    return hasFailures ? 'error' : 'connected';
  };

  const renderStatusBadge = (status: 'success' | 'error' | 'pending') => {
    if (status === 'success') {
      return <Badge variant="outline" className="bg-green-100 text-green-800">Success</Badge>;
    } else if (status === 'error') {
      return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>;
    } else {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const getConnectionStatusAlert = () => {
    const overallStatus = getOverallStatus();
    
    if (overallStatus === 'checking') {
      return (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Checking Connection</AlertTitle>
          <AlertDescription>
            System is checking database connectivity...
          </AlertDescription>
        </Alert>
      );
    } else if (overallStatus === 'error') {
      return (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Connection Issues Detected</AlertTitle>
          <AlertDescription>
            There are connectivity issues with the journal system.
            {diagnosticReport.errors.length > 0 && (
              <div className="mt-2">
                <strong>Latest error:</strong> {diagnosticReport.errors[diagnosticReport.errors.length - 1].message}
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }
    
    return (
      <Alert variant="default" className="mb-4 bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle>Connection Established</AlertTitle>
        <AlertDescription>
          The journal system is connected successfully.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Journal Diagnostics
              {getOverallStatus() === 'connected' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {getOverallStatus() === 'error' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {getOverallStatus() === 'checking' && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
            </CardTitle>
            <CardDescription>{generateSummary()}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={runDiagnosticTests}
              disabled={isRunningTests}
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run Tests
                </>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {getConnectionStatusAlert()}
          
          {diagnosticReport.tests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Test Results</h3>
              <div className="space-y-2">
                {diagnosticReport.tests.map((test, index) => (
                  <div key={index} className="border rounded-md p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium">{test.name}</div>
                      {renderStatusBadge(test.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">{test.message}</div>
                    {test.details && (
                      <div className="mt-1 text-xs text-muted-foreground">{test.details}</div>
                    )}
                  </div>
                ))}
              </div>
              
              {diagnosticReport.errors.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
                      Errors Detected ({diagnosticReport.errors.length})
                    </h3>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {diagnosticReport.errors.map((error, index) => (
                        <div key={index} className="text-xs p-2 bg-red-50 border border-red-100 rounded">
                          <div className="text-red-800">{error.message}</div>
                          <div className="text-muted-foreground mt-1">
                            {new Date(error.timestamp).toLocaleTimeString()} 
                            {error.context && ` - ${error.context}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="mt-4">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={downloadReport}
              className="flex items-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
