
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info, RefreshCw, Database, Bug } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ui/use-toast";
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
  const { batchProcessEntities } = useJournalEntries(user?.id, 0, true);
  
  // Diagnostics states
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [functionLogs, setFunctionLogs] = useState<string[]>([]);
  const [entryCheckResult, setEntryCheckResult] = useState<any>(null);
  
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
      // Check if function exists and is deployed
      const { data: functionData, error: functionError } = await supabase.functions.invoke('batch-extract-entities', {
        method: 'POST',
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
                    <div className="mt-4 space-y-2">
                      <h4 className="font-medium">Function Diagnostic Results:</h4>
                      <div className="bg-background p-3 rounded-md text-sm overflow-auto max-h-40">
                        <pre>{JSON.stringify(diagnosticsResult, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                  
                  {entryCheckResult && (
                    <div className="mt-4 space-y-2">
                      <h4 className="font-medium">Journal Entries Check:</h4>
                      <div className="bg-background p-3 rounded-md text-sm">
                        <p>Total entries retrieved: {entryCheckResult.entriesCount}</p>
                        {entryCheckResult.error && (
                          <p className="text-destructive">Error: {entryCheckResult.error}</p>
                        )}
                      </div>
                      
                      {entryCheckResult.sampleEntries && entryCheckResult.sampleEntries.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium">Sample Entries:</h5>
                          {entryCheckResult.sampleEntries.map((entry: any) => (
                            <div key={entry.id} className="bg-background p-3 rounded-md text-sm overflow-auto">
                              <p><strong>Entry ID:</strong> {entry.id}</p>
                              <p><strong>Has refined text:</strong> {entry['refined text'] ? 'Yes' : 'No'}</p>
                              <p><strong>Text sample:</strong> {entry['refined text']?.substring(0, 100)}...</p>
                              <p><strong>Has entities:</strong> {entry.entities ? 'Yes' : 'No'}</p>
                              {entry.entities && (
                                <p><strong>Entities:</strong> {JSON.stringify(entry.entities)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Separator className="my-8" />
        
        {/* Additional utilities can be added here */}
      </motion.div>
    </div>
  );
}
