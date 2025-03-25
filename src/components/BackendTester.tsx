
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { ScrollArea } from '@/components/ui/scroll-area';

const BackendTester = () => {
  const { user } = useAuth();
  const { testJournalRetrieval, isTestingBackend } = useJournalHandler(user?.id);
  const [testResults, setTestResults] = useState<any>(null);

  const runTest = async () => {
    const results = await testJournalRetrieval();
    setTestResults(results);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Backend Connection Test</CardTitle>
        <CardDescription>
          Test if the backend can retrieve journal entries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button 
              onClick={runTest} 
              disabled={isTestingBackend || !user}
            >
              {isTestingBackend ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Journal Retrieval'
              )}
            </Button>
            {!user && (
              <p className="text-sm text-muted-foreground">Please sign in to run tests</p>
            )}
          </div>

          {testResults && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Test Results:</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="font-semibold">
                  Status: <span className={testResults.success ? "text-green-500" : "text-red-500"}>
                    {testResults.success ? "Success" : "Failed"}
                  </span>
                </p>
                
                {!testResults.success && (
                  <p className="text-red-500">{testResults.message}</p>
                )}
                
                {testResults.success && (
                  <>
                    <p className="mt-2">Found {testResults.entriesCount} journal entries</p>
                    
                    {testResults.entriesCount > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Sample Entries:</h4>
                        <ScrollArea className="h-40 rounded border p-2">
                          <pre className="text-xs">{JSON.stringify(testResults.entries?.slice(0, 2), null, 2)}</pre>
                        </ScrollArea>
                      </div>
                    )}
                    
                    {testResults.embeddingResults && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Embedding Search Results:</h4>
                        <ScrollArea className="h-40 rounded border p-2">
                          <pre className="text-xs">{JSON.stringify(testResults.embeddingResults, null, 2)}</pre>
                        </ScrollArea>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BackendTester;
