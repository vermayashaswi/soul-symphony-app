
import React, { useState, useEffect } from 'react';
import { checkAllSupabaseFunctions } from '@/utils/supabase-function-checker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SupabaseStatusChecker = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [functionStatus, setFunctionStatus] = useState<Record<string, { isWorking: boolean, error?: string }> | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [recordingFlowStatus, setRecordingFlowStatus] = useState<Record<string, { status: 'pending' | 'success' | 'error' | 'checking', message?: string }>>({
    audioSend: { status: 'pending', message: 'Unknown' },
    audioSave: { status: 'pending', message: 'Unknown' },
    entryProcess: { status: 'pending', message: 'Unknown' },
    entryRetrieve: { status: 'pending', message: 'Unknown' }
  });
  const [expandedSection, setExpandedSection] = useState(false);

  const checkFunctions = async () => {
    setIsChecking(true);
    try {
      const results = await checkAllSupabaseFunctions();
      setFunctionStatus(results);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error checking functions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkRecordingFlow = async () => {
    // Step 1: Check if transcribe-audio function is working
    setRecordingFlowStatus(prev => ({
      ...prev,
      audioSend: { status: 'checking', message: 'Checking...' }
    }));

    try {
      // Just a ping to check if the function is accessible
      const { data: transcribeCheck, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
        body: { ping: true }
      });
      
      if (transcribeError) {
        setRecordingFlowStatus(prev => ({
          ...prev,
          audioSend: { 
            status: 'error', 
            message: `Function not accessible: ${transcribeError.message}` 
          }
        }));
      } else {
        setRecordingFlowStatus(prev => ({
          ...prev,
          audioSend: { status: 'success', message: 'Function is accessible' }
        }));
      }
    } catch (error: any) {
      setRecordingFlowStatus(prev => ({
        ...prev,
        audioSend: { status: 'error', message: `Error: ${error.message}` }
      }));
    }

    // Step 2: Check database for Journal Entries table
    setRecordingFlowStatus(prev => ({
      ...prev,
      audioSave: { status: 'checking', message: 'Checking...' }
    }));

    try {
      // Check if Journal Entries table is accessible
      const { data: journalTablesInfo, error: tableError } = await supabase
        .from('Journal Entries')
        .select('count(*)', { count: 'exact', head: true });
      
      if (tableError) {
        setRecordingFlowStatus(prev => ({
          ...prev,
          audioSave: { 
            status: 'error', 
            message: `Table access issue: ${tableError.message}` 
          }
        }));
      } else {
        setRecordingFlowStatus(prev => ({
          ...prev,
          audioSave: { status: 'success', message: 'Table is accessible' }
        }));
      }
    } catch (error: any) {
      setRecordingFlowStatus(prev => ({
        ...prev,
        audioSave: { status: 'error', message: `Error: ${error.message}` }
      }));
    }

    // Step 3: Check processing of entries
    setRecordingFlowStatus(prev => ({
      ...prev,
      entryProcess: { status: 'checking', message: 'Checking...' }
    }));

    try {
      // Check for recently processed entries (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: processedEntries, error: processError } = await supabase
        .from('Journal Entries')
        .select('id, created_at')
        .gt('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (processError) {
        setRecordingFlowStatus(prev => ({
          ...prev,
          entryProcess: { 
            status: 'error', 
            message: `Process check failed: ${processError.message}` 
          }
        }));
      } else if (processedEntries && processedEntries.length > 0) {
        setRecordingFlowStatus(prev => ({
          ...prev,
          entryProcess: { 
            status: 'success', 
            message: `Last entry processed: ${new Date(processedEntries[0].created_at).toLocaleTimeString()}` 
          }
        }));
      } else {
        setRecordingFlowStatus(prev => ({
          ...prev,
          entryProcess: { 
            status: 'pending', 
            message: 'No recent entries found in last 24h' 
          }
        }));
      }
    } catch (error: any) {
      setRecordingFlowStatus(prev => ({
        ...prev,
        entryProcess: { status: 'error', message: `Error: ${error.message}` }
      }));
    }

    // Step 4: Check retrieval of entries
    setRecordingFlowStatus(prev => ({
      ...prev,
      entryRetrieve: { status: 'checking', message: 'Checking...' }
    }));

    try {
      // Check if we can retrieve entry content
      const { data: retrieveTest, error: retrieveError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .limit(1);
      
      if (retrieveError) {
        setRecordingFlowStatus(prev => ({
          ...prev,
          entryRetrieve: { 
            status: 'error', 
            message: `Retrieval failed: ${retrieveError.message}` 
          }
        }));
      } else if (retrieveTest && retrieveTest.length > 0) {
        // Check if content is actually populated
        const hasContent = retrieveTest[0]["refined text"] || retrieveTest[0]["transcription text"];
        
        if (hasContent) {
          setRecordingFlowStatus(prev => ({
            ...prev,
            entryRetrieve: { status: 'success', message: 'Content can be retrieved' }
          }));
        } else {
          setRecordingFlowStatus(prev => ({
            ...prev,
            entryRetrieve: { 
              status: 'error', 
              message: 'Entry exists but content is empty' 
            }
          }));
        }
      } else {
        setRecordingFlowStatus(prev => ({
          ...prev,
          entryRetrieve: { 
            status: 'pending', 
            message: 'No entries found to check' 
          }
        }));
      }
    } catch (error: any) {
      setRecordingFlowStatus(prev => ({
        ...prev,
        entryRetrieve: { status: 'error', message: `Error: ${error.message}` }
      }));
    }
  };

  const toggleExpandSection = () => {
    setExpandedSection(!expandedSection);
    if (!expandedSection) {
      // When expanding, check the recording flow
      checkRecordingFlow();
    }
  };

  useEffect(() => {
    // Check functions on mount
    checkFunctions();
  }, []);

  const allFunctionsWorking = functionStatus && 
    Object.values(functionStatus).every(status => status.isWorking);
  
  const someFunctionsWorking = functionStatus && 
    Object.values(functionStatus).some(status => status.isWorking);

  const getStatusIcon = (status: 'pending' | 'success' | 'error' | 'checking') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Supabase Functions Status</CardTitle>
        {allFunctionsWorking ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : someFunctionsWorking ? (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {functionStatus ? (
          <div className="space-y-3">
            {Object.entries(functionStatus).map(([functionName, status]) => (
              <div key={functionName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status.isWorking ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-mono text-sm">{functionName}</span>
                </div>
                {!status.isWorking && status.error && (
                  <span className="text-xs text-red-500 truncate max-w-[200px]" title={status.error}>
                    {status.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground">
            Checking functions...
          </div>
        )}
        
        <div className="mt-4 border-t pt-4">
          <div 
            className="flex items-center justify-between cursor-pointer" 
            onClick={toggleExpandSection}
          >
            <span className="font-medium">Journal Recording Flow</span>
            {expandedSection ? (
              <ArrowUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ArrowDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
          
          {expandedSection && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(recordingFlowStatus.audioSend.status)}
                  <span className="text-sm">Recording sent to backend</span>
                </div>
                <span className="text-xs text-gray-500">
                  {recordingFlowStatus.audioSend.message}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(recordingFlowStatus.audioSave.status)}
                  <span className="text-sm">Recording saved at backend</span>
                </div>
                <span className="text-xs text-gray-500">
                  {recordingFlowStatus.audioSave.message}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(recordingFlowStatus.entryProcess.status)}
                  <span className="text-sm">Entry processed at backend</span>
                </div>
                <span className="text-xs text-gray-500">
                  {recordingFlowStatus.entryProcess.message}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(recordingFlowStatus.entryRetrieve.status)}
                  <span className="text-sm">Entry retrievable from backend</span>
                </div>
                <span className="text-xs text-gray-500">
                  {recordingFlowStatus.entryRetrieve.message}
                </span>
              </div>
              
              <Button 
                onClick={() => checkRecordingFlow()} 
                disabled={isChecking} 
                variant="outline" 
                size="sm"
                className="w-full mt-2"
              >
                Recheck Recording Flow
              </Button>
            </div>
          )}
        </div>
        
        {lastChecked && (
          <div className="text-xs text-muted-foreground mt-4">
            Last checked: {lastChecked}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2">
        <Button 
          onClick={checkFunctions} 
          disabled={isChecking} 
          variant="outline" 
          size="sm"
          className="w-full"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SupabaseStatusChecker;
