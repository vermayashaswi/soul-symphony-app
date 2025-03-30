
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, RefreshCw, Database, Bug, AlertCircle, CheckCircle, Server, FileCode, Code } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/integrations/supabase/client';

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processAll, setProcessAll] = useState(false);
  const { batchProcessEntities, debugEnvironment } = useJournalEntries(user?.id, 0, true);
  
  // Diagnostics states
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [functionLogs, setFunctionLogs] = useState<string[]>([]);
  const [entryCheckResult, setEntryCheckResult] = useState<any>(null);
  const [testExtraction, setTestExtraction] = useState(false);
  const [testExtractionResult, setTestExtractionResult] = useState<any>(null);
  const [testExtractionLoading, setTestExtractionLoading] = useState(false);
  const [envCheckResult, setEnvCheckResult] = useState<any>(null);
  const [envCheckLoading, setEnvCheckLoading] = useState(false);
  const [testText, setTestText] = useState(
    "Today was a good day. At the workplace, I had a conflict with my colleague, but afterwards, my boss managed to reconcile things. The highlight of the week was that I gave a presentation which many people appreciated. However, when I got home, I ended up having an argument with my wife."
  );
  
  const handleProcessEntities = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to be signed in to process entities.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    try {
      const success = await batchProcessEntities(processAll);
      if (success) {
        toast({
          title: "Entity processing complete",
          description: "Journal entries have been successfully processed.",
        });
      }
    } catch (error) {
      console.error("Error processing entities:", error);
      toast({
        title: "Processing failed",
        description: "An error occurred while processing entities.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Check environment variables and configuration
  const checkEnvironment = async () => {
    setEnvCheckLoading(true);
    try {
      const result = await debugEnvironment();
      setEnvCheckResult(result);
      
      if (result?.success) {
        toast({
          title: "Environment check complete",
          description: "Environment diagnostics retrieved successfully.",
        });
      } else {
        toast({
          title: "Environment check failed",
          description: result?.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking environment:", error);
      setEnvCheckResult({ success: false, error: error.message });
      toast({
        title: "Environment check failed",
        description: "An error occurred while checking the environment.",
        variant: "destructive"
      });
    } finally {
      setEnvCheckLoading(false);
    }
  };
  
  // Test entity extraction directly
  const testEntityExtraction = async () => {
    if (!testText.trim()) {
      toast({
        title: "Empty text",
        description: "Please enter some text to extract entities from.",
        variant: "destructive"
      });
      return;
    }
    
    setTestExtractionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          testText: testText,
          testExtraction: true 
        }
      });
      
      if (error) throw error;
      
      setTestExtractionResult(data);
      
      if (data?.entities?.length > 0) {
        toast({
          title: "Test extraction complete",
          description: `Successfully extracted ${data.entities.length} entities`,
        });
      } else {
        toast({
          title: "No entities found",
          description: "The extraction completed but no entities were found.",
          // Changed from "warning" to "default" as "warning" is not an allowed variant
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error in test extraction:", error);
      setTestExtractionResult({ error: error.message });
      
      toast({
        title: "Test extraction failed",
        description: "An error occurred during test extraction.",
        variant: "destructive"
      });
    } finally {
      setTestExtractionLoading(false);
    }
  };
  
  // Fetch diagnostic information
  const runDiagnostics = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to be signed in to run diagnostics.",
        variant: "destructive"
      });
      return;
    }
    
    setDiagnosticsLoading(true);
    try {
      // Call the edge function in diagnostic mode
      const { data: functionData, error: functionError } = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          diagnosticMode: true,
          userId: user.id 
        }
      });
      
      setDiagnosticsResult(functionData || { error: functionError?.message || "Unknown error" });
      
      // Check journal entries
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", entities')
        .eq('user_id', user.id)
        .limit(5);
        
      if (entriesError) {
        console.error("Error fetching entries:", entriesError);
      }
      
      setEntryCheckResult({
        entriesCount: entries?.length || 0,
        sampleEntries: entries || [],
        error: entriesError?.message
      });
      
    } catch (error) {
      console.error("Error running diagnostics:", error);
      toast({
        title: "Diagnostics failed",
        description: "An error occurred while running diagnostics.",
        variant: "destructive"
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="container mx-auto px-4 py-8 max-w-5xl"
      >
        <h1 className="text-3xl font-bold text-center mb-8">Utilities</h1>
        
        <Card className="w-full mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" /> 
              Utilities
            </CardTitle>
            <CardDescription>
              This page contains various utilities for managing your journal entries.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {!user && (
              <Alert variant="default" className="mb-4">
                <AlertTitle>Not signed in</AlertTitle>
                <AlertDescription>
                  You need to be signed in to use utilities.
                </AlertDescription>
              </Alert>
            )}
            
            {user && (
              <div className="space-y-6">
                {/* Environment Check Section */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Environment Configuration Check
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check if the edge function environment is properly configured with required API keys and services.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={checkEnvironment} 
                    disabled={envCheckLoading}
                    variant="secondary"
                    className="w-full mb-4"
                  >
                    {envCheckLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Checking Environment...
                      </>
                    ) : (
                      "Check Environment Configuration"
                    )}
                  </Button>
                  
                  {envCheckResult && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="env-check">
                        <AccordionTrigger>
                          <span className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" /> 
                            Environment Configuration Details
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {envCheckResult.success ? (
                              <div className="bg-background p-3 rounded-md text-sm">
                                <h4 className="font-medium mb-2">Environment Variables:</h4>
                                <ul className="space-y-1">
                                  <li>
                                    <span className="font-medium">OpenAI API Key:</span> 
                                    {envCheckResult.diagnostics?.environment?.openAIKeyConfigured ? (
                                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Configured</Badge>
                                    ) : (
                                      <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Missing</Badge>
                                    )}
                                  </li>
                                  <li>
                                    <span className="font-medium">Supabase URL:</span> 
                                    {envCheckResult.diagnostics?.environment?.supabaseUrlConfigured ? (
                                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Configured</Badge>
                                    ) : (
                                      <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Missing</Badge>
                                    )}
                                  </li>
                                  <li>
                                    <span className="font-medium">Supabase Service Key:</span> 
                                    {envCheckResult.diagnostics?.environment?.supabaseServiceKeyConfigured ? (
                                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Configured</Badge>
                                    ) : (
                                      <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Missing</Badge>
                                    )}
                                  </li>
                                  <li>
                                    <span className="font-medium">Supabase Client:</span> 
                                    {envCheckResult.diagnostics?.environment?.supabaseClientInitialized ? (
                                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Initialized</Badge>
                                    ) : (
                                      <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Failed</Badge>
                                    )}
                                  </li>
                                </ul>
                              </div>
                            ) : (
                              <div className="bg-red-50 p-3 rounded-md text-sm text-red-800">
                                <p className="font-medium">Error retrieving environment configuration:</p>
                                <p>{envCheckResult.error}</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
                
                {/* Test Entity Extraction */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Test Entity Extraction
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Test the entity extraction on sample text to verify it's working correctly. We recommend using the working example from the successful journal entry.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Textarea 
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder="Enter text to extract entities from..."
                      className="min-h-[100px]"
                    />
                    
                    <Button 
                      onClick={testEntityExtraction} 
                      disabled={testExtractionLoading || !testText.trim()}
                      className="w-full"
                    >
                      {testExtractionLoading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Entity Extraction"
                      )}
                    </Button>
                    
                    {testExtractionResult && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="test-results">
                          <AccordionTrigger>
                            <span className="flex items-center gap-2">
                              <Code className="h-4 w-4" /> 
                              Test Results 
                              {testExtractionResult.entities ? (
                                <Badge variant="outline" className="ml-2">
                                  {testExtractionResult.entities.length} entities found
                                </Badge>
                              ) : null}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="mt-4 space-y-2">
                              {testExtractionResult.error ? (
                                <div className="text-destructive bg-red-50 p-3 rounded-md">
                                  <p className="font-medium">Error:</p>
                                  <p>{testExtractionResult.error}</p>
                                </div>
                              ) : (
                                <>
                                  <div className="bg-background p-3 rounded-md text-sm">
                                    <h4 className="font-medium mb-2">Function Summary:</h4>
                                    <ul className="space-y-1">
                                      <li>
                                        <span className="font-medium">OpenAI API Key:</span> 
                                        {testExtractionResult.diagnosticInfo?.openAiKeyAvailable ? (
                                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Available</Badge>
                                        ) : (
                                          <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Missing</Badge>
                                        )}
                                      </li>
                                      <li>
                                        <span className="font-medium">Entities Extraction:</span> 
                                        {testExtractionResult.entities && testExtractionResult.entities.length > 0 ? (
                                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">
                                            Found {testExtractionResult.entities.length} entities
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800">No entities found</Badge>
                                        )}
                                      </li>
                                    </ul>
                                  </div>
                                  
                                  <div className="bg-background p-3 rounded-md text-sm">
                                    <h4 className="font-medium mb-2">Text Sample:</h4>
                                    <p className="text-sm text-muted-foreground">{testExtractionResult.diagnosticInfo?.testText}</p>
                                  </div>
                                  
                                  {testExtractionResult.entities && testExtractionResult.entities.length > 0 ? (
                                    <div className="bg-background p-3 rounded-md">
                                      <h4 className="font-medium mb-2">Extracted Entities:</h4>
                                      {testExtractionResult.entities.map((entity: any, index: number) => (
                                        <div key={index} className="mt-1 p-2 bg-muted/50 rounded flex items-center">
                                          <Badge className={
                                            entity.type === 'person' ? 'bg-blue-100 text-blue-800' :
                                            entity.type === 'organization' ? 'bg-purple-100 text-purple-800' :
                                            entity.type === 'place' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                          }>
                                            {entity.type}
                                          </Badge>
                                          <span className="ml-2 font-medium">{entity.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <Alert className="bg-yellow-50 border-yellow-200">
                                      <AlertCircle className="h-4 w-4 text-yellow-700" />
                                      <AlertTitle className="text-yellow-700">No entities found</AlertTitle>
                                      <AlertDescription className="text-yellow-700">
                                        The extraction process completed but no entities were found in the text.
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Entity Extraction
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Process journal entries to extract entities like people, places, and organizations mentioned in your journals.
                      </p>
                    </div>
                    <Badge variant={processAll ? "destructive" : "secondary"}>
                      {processAll ? "Process All Entries" : "Missing Entries Only"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch 
                      id="process-all" 
                      checked={processAll} 
                      onCheckedChange={setProcessAll}
                    />
                    <Label htmlFor="process-all">Process all entries (including already processed ones)</Label>
                  </div>
                  
                  <Alert variant="default" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recommended Workflow</AlertTitle>
                    <AlertDescription>
                      1. First check the environment with "Check Environment Configuration"<br />
                      2. Then test extraction using the example text above<br />
                      3. Only after confirming test extraction works, proceed with batch processing
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleProcessEntities} 
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Extract Entities from Journal Entries"
                    )}
                  </Button>
                </div>
                
                {/* Diagnostics Section */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Bug className="h-4 w-4" />
                        Entity Extraction Diagnostics
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Run diagnostics to identify issues with entity extraction process.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={runDiagnostics} 
                    disabled={diagnosticsLoading}
                    className="w-full mb-4"
                    variant="outline"
                  >
                    {diagnosticsLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Running Diagnostics...
                      </>
                    ) : (
                      "Run Diagnostics"
                    )}
                  </Button>
                  
                  {diagnosticsResult && (
                    <Accordion type="single" collapsible className="w-full mb-4">
                      <AccordionItem value="function-diagnostics">
                        <AccordionTrigger>
                          <span className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" /> 
                            Function Diagnostic Results
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="mt-4 space-y-2">
                            <div className="bg-background p-3 rounded-md text-sm">
                              <h4 className="font-medium mb-2">Function Diagnostics Summary:</h4>
                              <ul className="space-y-1">
                                <li>
                                  <span className="font-medium">Status:</span> 
                                  {diagnosticsResult.success ? (
                                    <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Success</Badge>
                                  ) : (
                                    <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Failed</Badge>
                                  )}
                                </li>
                                <li>
                                  <span className="font-medium">OpenAI API Key:</span> 
                                  {diagnosticsResult.diagnosticInfo?.openAIKeyConfigured ? (
                                    <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Configured</Badge>
                                  ) : (
                                    <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Missing</Badge>
                                  )}
                                </li>
                                <li>
                                  <span className="font-medium">Entries Found:</span> 
                                  <Badge variant="outline" className="ml-2">
                                    {diagnosticsResult.diagnosticInfo?.entriesFound || 0}
                                  </Badge>
                                </li>
                                <li>
                                  <span className="font-medium">Processing Time:</span> 
                                  <span className="ml-2">{diagnosticsResult.processingTime}</span>
                                </li>
                                <li>
                                  <span className="font-medium">Query Success:</span> 
                                  {diagnosticsResult.diagnosticInfo?.querySuccess ? (
                                    <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Success</Badge>
                                  ) : (
                                    <Badge variant="outline" className="ml-2 bg-red-100 text-red-800">Failed</Badge>
                                  )}
                                </li>
                              </ul>
                            </div>
                          </div>
                          
                          {diagnosticsResult.diagnosticInfo?.processingDetails && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2">Processing Details:</h4>
                              {diagnosticsResult.diagnosticInfo.processingDetails.map((detail: any, index: number) => (
                                <div key={index} className="mt-2 p-2 bg-background rounded-md text-sm">
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium">Entry ID: {detail.entryId}</span>
                                    {detail.skipped ? (
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Skipped</Badge>
                                    ) : detail.error ? (
                                      <Badge variant="outline" className="bg-red-100 text-red-800">Error</Badge>
                                    ) : detail.entitiesExtracted > 0 ? (
                                      <Badge variant="outline" className="bg-green-100 text-green-800">{detail.entitiesExtracted} Entities</Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-blue-100 text-blue-800">No Entities</Badge>
                                    )}
                                  </div>
                                  
                                  {detail.skipped ? (
                                    <p className="text-yellow-600 mt-1">Reason: {detail.reason}</p>
                                  ) : detail.error ? (
                                    <p className="text-red-600 mt-1">Error: {detail.error}</p>
                                  ) : (
                                    <>
                                      <p className="text-muted-foreground mt-1 text-xs">Text: {detail.textSample}</p>
                                      {detail.entities && detail.entities.length > 0 ? (
                                        <div className="mt-2">
                                          <p className="text-xs font-medium">Entities:</p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {detail.entities.map((entity: any, idx: number) => (
                                              <Badge 
                                                key={idx} 
                                                variant="outline"
                                                className={
                                                  entity.type === 'person' ? 'bg-blue-50 text-blue-700' :
                                                  entity.type === 'organization' ? 'bg-purple-50 text-purple-700' :
                                                  entity.type === 'place' ? 'bg-green-50 text-green-700' :
                                                  'bg-gray-50 text-gray-700'
                                                }
                                              >
                                                {entity.type}: {entity.name}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-muted-foreground mt-1 text-xs">No entities found</p>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                  
                  {entryCheckResult && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="entries-check">
                        <AccordionTrigger>
                          <span className="flex items-center gap-2">
                            <Database className="h-4 w-4" /> 
                            Journal Entries Check
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="mt-4 space-y-2">
                            <div className="bg-background p-3 rounded-md text-sm">
                              <p>Total entries retrieved: {entryCheckResult.entriesCount}</p>
                              {entryCheckResult.error && (
                                <p className="text-destructive">Error: {entryCheckResult.error}</p>
                              )}
                            </div>
                            
                            {entryCheckResult.sampleEntries && entryCheckResult.sampleEntries.length > 0 && (
                              <div className="space-y-4 mt-4">
                                <h5 className="font-medium">Sample Entries:</h5>
                                {entryCheckResult.sampleEntries.map((entry: any) => (
                                  <div key={entry.id} className="bg-background p-3 rounded-md text-sm">
                                    <div className="flex items-center justify-between">
                                      <p><strong>Entry ID:</strong> {entry.id}</p>
                                      <Badge variant="outline" className={entry.entities ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                        {entry.entities ? 'Has Entities' : 'No Entities'}
                                      </Badge>
                                    </div>
                                    <p className="mt-2"><strong>Has refined text:</strong> {entry['refined text'] ? 'Yes' : 'No'}</p>
                                    {entry['refined text'] && (
                                      <div className="mt-1">
                                        <p><strong>Text sample:</strong></p>
                                        <p className="text-xs bg-muted/50 p-2 rounded mt-1 text-muted-foreground">
                                          {entry['refined text']?.substring(0, 150)}...
                                        </p>
                                      </div>
                                    )}
                                    
                                    {entry.entities && (
                                      <div className="mt-2">
                                        <p><strong>Entities:</strong></p>
                                        {Array.isArray(entry.entities) && entry.entities.length > 0 ? (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {entry.entities.map((entity: any, idx: number) => (
                                              <Badge 
                                                key={idx} 
                                                variant="outline"
                                                className={
                                                  entity.type === 'person' ? 'bg-blue-50 text-blue-700' :
                                                  entity.type === 'organization' ? 'bg-purple-50 text-purple-700' :
                                                  entity.type === 'place' ? 'bg-green-50 text-green-700' :
                                                  'bg-gray-50 text-gray-700'
                                                }
                                              >
                                                {entity.type}: {entity.name}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-yellow-500 italic mt-1">Empty or invalid entities array</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Separator className="my-8" />
      </motion.div>
    </div>
  );
}
