
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileWarning, CheckCircle, XCircle, ServerCrash } from 'lucide-react';
import { diagnoseDatabaseIssues, createAudioBucket } from '@/utils/supabase-diagnostics';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function JournalDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [isFixing, setIsFixing] = useState(false);
  const { user } = useAuth();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const results = await diagnoseDatabaseIssues();
      console.log('Diagnostic results:', results);
      setResults(results);
      
      if (!results.success) {
        toast.error('Issues detected with journal system');
      } else {
        toast.success('Journal system is working properly');
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      toast.error('Error running diagnostics');
    } finally {
      setIsRunning(false);
    }
  };

  // Run diagnostics when component mounts
  useEffect(() => {
    if (user) {
      runDiagnostics();
    }
  }, [user]);

  const fixAudioBucket = async () => {
    setIsFixing(true);
    
    try {
      const result = await createAudioBucket();
      
      if (result.success) {
        toast.success('Audio bucket created successfully');
        // Run diagnostics again to update results
        runDiagnostics();
      } else {
        toast.error(`Failed to create audio bucket: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Error fixing audio bucket:', error);
      toast.error(`Error fixing audio bucket: ${error.message}`);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Journal System Diagnostics</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Diagnostics'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isRunning ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Running diagnostics...</span>
          </div>
        ) : !results ? (
          <Alert variant="default">
            <FileWarning className="h-4 w-4" />
            <AlertDescription>
              Run diagnostics to check journal system functionality.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <span>Database Connection:</span>
                {results.results.database ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Authentication:</span>
                {results.results.auth ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Journal Table:</span>
                {results.results.journalTable ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Audio Storage:</span>
                {results.results.audioBucket ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Edge Functions:</span>
                {results.results.edgeFunctions ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Embeddings:</span>
                {results.results.embeddingsTable ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            {results.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <ServerCrash className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">Issues detected:</div>
                  <ul className="list-disc pl-4 text-sm">
                    {results.errorDetails.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!results.results.audioBucket && (
              <Button 
                onClick={fixAudioBucket} 
                disabled={isFixing}
                className="w-full"
              >
                {isFixing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Audio Bucket
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default JournalDiagnostics;
