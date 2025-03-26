
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Download, Database, Wifi, Mic, HardDrive } from 'lucide-react';
import { testRecordingPipeline } from '@/utils/diagnostics-utils';
import { checkSupabaseConnection } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DiagnosticsResult {
  timestamp: string;
  status: 'success' | 'error' | 'warning';
  details: {
    database: {
      success: boolean;
      error?: string;
      latency?: number;
    };
    storage: {
      audioBucketExists: boolean;
      hasPermission: boolean;
      error?: string;
    };
    auth: {
      success: boolean;
      hasSession: boolean;
      error?: string;
    };
    edgeFunctions: {
      transcribeAudio: {
        reachable: boolean;
        error?: string;
      };
    };
    network: {
      online: boolean;
      supabaseLatency?: number;
      error?: string;
    };
    recording: {
      audioContextAvailable: boolean;
      mediaDevicesAvailable: boolean;
      storageAccessible: boolean;
      error?: string;
    };
  };
  recommendedActions: string[];
}

const JournalDiagnostics: React.FC = () => {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [results, setResults] = useState<DiagnosticsResult | null>(null);
  const [isInitialCheck, setIsInitialCheck] = useState(true);

  // Function to test the audio storage bucket
  const testAudioBucket = async () => {
    try {
      // Check if 'audio' bucket exists
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        return {
          audioBucketExists: false,
          hasPermission: false,
          error: `Storage access error: ${error.message}`
        };
      }
      
      const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
      
      if (!audioBucket) {
        return {
          audioBucketExists: false,
          hasPermission: true,
          error: 'Audio bucket not found in storage'
        };
      }
      
      // Test permission to write to bucket
      try {
        // Try to list files (will test read permissions)
        const { error: listError } = await supabase.storage
          .from('audio')
          .list('');
          
        return {
          audioBucketExists: true,
          hasPermission: !listError,
          error: listError ? `Permission error: ${listError.message}` : undefined
        };
      } catch (err) {
        return {
          audioBucketExists: true,
          hasPermission: false,
          error: `Permission test error: ${err instanceof Error ? err.message : String(err)}`
        };
      }
    } catch (error) {
      return {
        audioBucketExists: false,
        hasPermission: false,
        error: `Storage test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Function to test edge functions
  const testEdgeFunctions = async () => {
    try {
      // Test transcribe-audio function with a minimal request
      const { error } = await supabase.functions.invoke('transcribe-audio', {
        body: { test: true }
      });
      
      return {
        transcribeAudio: {
          reachable: !error,
          error: error ? `Edge function error: ${error.message}` : undefined
        }
      };
    } catch (error) {
      return {
        transcribeAudio: {
          reachable: false,
          error: `Edge function test error: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  };

  // Function to test database connection
  const testDatabase = async () => {
    const startTime = performance.now();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
        
      const latency = Math.round(performance.now() - startTime);
      
      if (error) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
          latency
        };
      }
      
      return {
        success: true,
        latency
      };
    } catch (error) {
      const latency = Math.round(performance.now() - startTime);
      return {
        success: false,
        error: `Database test error: ${error instanceof Error ? error.message : String(error)}`,
        latency
      };
    }
  };

  // Function to test auth
  const testAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return {
          success: false,
          hasSession: false,
          error: `Auth error: ${error.message}`
        };
      }
      
      return {
        success: true,
        hasSession: !!data.session
      };
    } catch (error) {
      return {
        success: false,
        hasSession: false,
        error: `Auth test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Function to test network connectivity
  const testNetwork = async () => {
    const online = navigator.onLine;
    
    try {
      // Test Supabase connectivity
      const start = performance.now();
      const result = await checkSupabaseConnection();
      const supabaseLatency = Math.round(performance.now() - start);
      
      if (!result.success) {
        return {
          online,
          supabaseLatency,
          error: 'Failed to connect to Supabase'
        };
      }
      
      return {
        online,
        supabaseLatency
      };
    } catch (error) {
      return {
        online,
        error: `Network test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  const runDiagnostics = async () => {
    setIsRunningTests(true);
    setIsExpanded(true);
    
    try {
      const [
        databaseResult,
        storageResult,
        authResult,
        edgeFunctionsResult,
        networkResult,
        recordingResult
      ] = await Promise.all([
        testDatabase(),
        testAudioBucket(),
        testAuth(),
        testEdgeFunctions(),
        testNetwork(),
        testRecordingPipeline()
      ]);
      
      // Determine overall status
      let overallStatus: 'success' | 'error' | 'warning' = 'success';
      const recommendedActions: string[] = [];
      
      // Check for critical errors
      if (!databaseResult.success) {
        overallStatus = 'error';
        recommendedActions.push('Check Supabase database connection settings and availability.');
      }
      
      if (!authResult.success) {
        overallStatus = 'error';
        recommendedActions.push('Verify authentication configuration and session management.');
      }
      
      if (!networkResult.online) {
        overallStatus = 'error';
        recommendedActions.push('Check internet connection and network status.');
      }
      
      // Check for storage issues
      if (!storageResult.audioBucketExists) {
        overallStatus = 'error';
        recommendedActions.push('Create the "audio" storage bucket in Supabase.');
      } else if (!storageResult.hasPermission) {
        overallStatus = 'warning';
        recommendedActions.push('Verify storage bucket permissions for the audio bucket.');
      }
      
      // Check for edge function issues
      if (!edgeFunctionsResult.transcribeAudio.reachable) {
        overallStatus = 'warning';
        recommendedActions.push('Check the transcribe-audio edge function is deployed and configured correctly.');
      }
      
      // Check for recording issues
      if (!recordingResult.audioContext || !recordingResult.mediaDevices || !recordingResult.mediaRecorder) {
        overallStatus = 'warning';
        recommendedActions.push('Verify browser supports required audio recording APIs.');
      }
      
      // Generate and set the results
      const diagnosticResults: DiagnosticsResult = {
        timestamp: new Date().toISOString(),
        status: overallStatus,
        details: {
          database: databaseResult,
          storage: storageResult,
          auth: authResult,
          edgeFunctions: edgeFunctionsResult,
          network: networkResult,
          recording: {
            audioContextAvailable: !!recordingResult.audioContext,
            mediaDevicesAvailable: !!recordingResult.mediaDevices,
            storageAccessible: !!recordingResult.storageAccess,
            error: recordingResult.errors?.join('; ')
          }
        },
        recommendedActions
      };
      
      setResults(diagnosticResults);

      // If this was an initial check and there are issues, create toast notifications
      if (isInitialCheck && overallStatus !== 'success') {
        const criticalIssues = recommendedActions.filter(action => 
          action.includes('Create the "audio" storage bucket') || 
          action.includes('transcribe-audio edge function')
        );
        
        if (criticalIssues.length > 0) {
          toast.error('Journal functionality issues detected', {
            description: criticalIssues[0],
            duration: 8000,
          });
        }
      }
      
      setIsInitialCheck(false);
    } catch (error) {
      console.error('Diagnostics error:', error);
      toast.error('Error running diagnostics');
    } finally {
      setIsRunningTests(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    
    const fileName = `feelosophy-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    const json = JSON.stringify(results, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    
    toast.success('Diagnostics report downloaded');
  };

  // Run diagnostics on first render
  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isExpanded && !results?.recommendedActions.length) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2 z-10"
        onClick={() => setIsExpanded(true)}
      >
        {isRunningTests ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <span className="flex items-center gap-1">
            {results?.status === 'success' ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : results?.status === 'warning' ? (
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
            Diagnostics
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className="mb-6 relative">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            {results?.status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : results?.status === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : results?.status === 'error' ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : null}
            Journal Diagnostics
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runDiagnostics} 
              disabled={isRunningTests}
            >
              {isRunningTests ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Run Tests
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => setIsExpanded(false)}
            >
              {results?.recommendedActions.length ? 'Minimize' : 'Close'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {results?.recommendedActions.length > 0 && (
          <Alert className="mb-4" variant={results.status === 'error' ? 'destructive' : 'warning'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Issues Detected</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {results.recommendedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Database className="h-5 w-5" />
                <div>
                  <div className="text-sm font-medium">Database</div>
                  <div className="flex items-center gap-1">
                    {results?.details.database.success ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {results?.details.database.success 
                        ? `Connected (${results?.details.database.latency}ms)` 
                        : 'Failed'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <HardDrive className="h-5 w-5" />
                <div>
                  <div className="text-sm font-medium">Storage</div>
                  <div className="flex items-center gap-1">
                    {results?.details.storage.audioBucketExists ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {results?.details.storage.audioBucketExists 
                        ? 'Audio bucket exists' 
                        : 'Audio bucket missing'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Wifi className="h-5 w-5" />
                <div>
                  <div className="text-sm font-medium">Edge Functions</div>
                  <div className="flex items-center gap-1">
                    {results?.details.edgeFunctions.transcribeAudio.reachable ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {results?.details.edgeFunctions.transcribeAudio.reachable 
                        ? 'Transcription API ready' 
                        : 'Transcription API error'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <Mic className="h-5 w-5" />
                <div>
                  <div className="text-sm font-medium">Recording</div>
                  <div className="flex items-center gap-1">
                    {results?.details.recording.mediaDevicesAvailable ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {results?.details.recording.mediaDevicesAvailable 
                        ? 'Media devices ready' 
                        : 'Media devices issue'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="mt-4">
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-1">Database</h3>
                <div className="pl-4 space-y-0.5">
                  <div>Status: {results?.details.database.success ? 'Connected' : 'Failed'}</div>
                  <div>Latency: {results?.details.database.latency || 'N/A'} ms</div>
                  {results?.details.database.error && (
                    <div className="text-red-500">Error: {results.details.database.error}</div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Storage</h3>
                <div className="pl-4 space-y-0.5">
                  <div>Audio Bucket: {results?.details.storage.audioBucketExists ? 'Exists' : 'Missing'}</div>
                  <div>Permissions: {results?.details.storage.hasPermission ? 'Granted' : 'Denied'}</div>
                  {results?.details.storage.error && (
                    <div className="text-red-500">Error: {results.details.storage.error}</div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Edge Functions</h3>
                <div className="pl-4 space-y-0.5">
                  <div>Transcribe Function: {results?.details.edgeFunctions.transcribeAudio.reachable ? 'Available' : 'Unreachable'}</div>
                  {results?.details.edgeFunctions.transcribeAudio.error && (
                    <div className="text-red-500">Error: {results.details.edgeFunctions.transcribeAudio.error}</div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Network</h3>
                <div className="pl-4 space-y-0.5">
                  <div>Online: {results?.details.network.online ? 'Yes' : 'No'}</div>
                  <div>Supabase Latency: {results?.details.network.supabaseLatency || 'N/A'} ms</div>
                  {results?.details.network.error && (
                    <div className="text-red-500">Error: {results.details.network.error}</div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Recording</h3>
                <div className="pl-4 space-y-0.5">
                  <div>Audio Context: {results?.details.recording.audioContextAvailable ? 'Available' : 'Unavailable'}</div>
                  <div>Media Devices: {results?.details.recording.mediaDevicesAvailable ? 'Available' : 'Unavailable'}</div>
                  <div>Storage Access: {results?.details.recording.storageAccessible ? 'Available' : 'Unavailable'}</div>
                  {results?.details.recording.error && (
                    <div className="text-red-500">Error: {results.details.recording.error}</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 flex justify-between">
        <div className="text-xs text-muted-foreground">
          Last checked: {results?.timestamp ? new Date(results.timestamp).toLocaleString() : 'Never'}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={downloadResults} 
          disabled={!results}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </CardFooter>
    </Card>
  );
};

export default JournalDiagnostics;
