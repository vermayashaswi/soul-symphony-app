
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const BackendTester = () => {
  const { user } = useAuth();
  const { testJournalRetrieval, isTestingBackend } = useJournalHandler(user?.id);
  const { processAllEmbeddings, isProcessingEmbeddings } = useJournalEntries(user?.id);
  const [testResults, setTestResults] = useState<any>(null);
  const [embeddingResults, setEmbeddingResults] = useState<any>(null);
  const [showEmbeddingSection, setShowEmbeddingSection] = useState(true);

  const runTest = async () => {
    const results = await testJournalRetrieval();
    setTestResults(results);
    
    // If we find entries but no embeddings, show the embedding section
    if (results?.success && results.entriesCount > 0 && (!results.embeddingResults || results.embeddingResults.length === 0)) {
      setShowEmbeddingSection(true);
    }
  };

  const runEmbedding = async () => {
    try {
      setEmbeddingResults({ status: 'processing' });
      const result = await processAllEmbeddings();
      setEmbeddingResults({ 
        status: 'complete', 
        success: true,
        message: `Successfully processed ${result?.successCount || 0} entries. Failed: ${result?.errorCount || 0}`,
        details: result
      });
      
      // After embedding, run the test again to confirm
      setTimeout(runTest, 2000);
    } catch (error) {
      console.error('Error processing embeddings:', error);
      setEmbeddingResults({ 
        status: 'complete', 
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Backend Connection Test</CardTitle>
        <CardDescription>
          Test if the backend can retrieve journal entries and process embeddings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button 
              onClick={runTest} 
              disabled={isTestingBackend || !user}
              variant="outline"
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
                    
                    {testResults.entriesCount > 0 && (!testResults.embeddingResults || testResults.embeddingResults.length === 0) && (
                      <Alert className="mt-4" variant="warning">
                        <AlertTitle>No Embeddings Found</AlertTitle>
                        <AlertDescription>
                          You have journal entries, but they don't appear to have embeddings. Embeddings are required for search functionality.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {testResults.embeddingResults && testResults.embeddingResults.length > 0 && (
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

          {(showEmbeddingSection || (testResults?.entriesCount > 0 && (!testResults.embeddingResults || testResults.embeddingResults.length === 0))) && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-lg font-medium mb-2">Process Embeddings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will generate embeddings for all journal entries, which are required for search functionality.
              </p>
              
              <Button 
                onClick={runEmbedding}
                disabled={isProcessingEmbeddings || !user}
                className="mb-4"
              >
                {isProcessingEmbeddings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Process All Embeddings
                  </>
                )}
              </Button>
              
              {isProcessingEmbeddings && (
                <div className="mt-2">
                  <Progress value={60} className="w-full" />
                  <p className="text-xs text-center mt-1">This may take a few minutes...</p>
                </div>
              )}
              
              {embeddingResults && (
                <div className="mt-2">
                  <Alert variant={embeddingResults.success ? "default" : "destructive"}>
                    <AlertTitle>{embeddingResults.success ? "Processing Complete" : "Error"}</AlertTitle>
                    <AlertDescription>
                      {embeddingResults.message}
                    </AlertDescription>
                  </Alert>
                  
                  {embeddingResults.details && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Details:</h4>
                      <ScrollArea className="h-40 rounded border p-2">
                        <pre className="text-xs">{JSON.stringify(embeddingResults.details, null, 2)}</pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BackendTester;
