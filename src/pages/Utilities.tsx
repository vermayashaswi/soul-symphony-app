
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info, Server, Database, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [envCheckResult, setEnvCheckResult] = useState<any>(null);
  const [envCheckLoading, setEnvCheckLoading] = useState(false);
  const [isProcessingEntities, setIsProcessingEntities] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);

  // Check environment variables and configuration
  const checkEnvironment = async () => {
    setEnvCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { 
          debugEnv: true 
        }
      });
      
      if (error) {
        console.error("Supabase function error:", error);
        setEnvCheckResult({ success: false, error: error.message });
        toast({
          title: "Environment check failed",
          description: error.message || "Unknown error occurred",
          variant: "destructive"
        });
        return;
      }
      
      setEnvCheckResult(data || { success: false, error: "No data returned" });
      
      if (data?.success) {
        toast({
          title: "Environment check complete",
          description: "Environment diagnostics retrieved successfully.",
        });
      } else {
        toast({
          title: "Environment check failed",
          description: data?.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error: any) {
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

  // Process all journal entries for entity extraction
  const processAllEntities = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be signed in to process entries.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingEntities(true);
    setProcessingStats(null);
    
    try {
      toast({
        title: "Processing started",
        description: "Extracting entities from all journal entries...",
      });
      
      const { data, error } = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          userId: user.id,
          processAll: true
        }
      });
      
      if (error) {
        console.error('Error processing entities:', error);
        toast({
          title: "Processing failed",
          description: error.message || "An error occurred while processing entries.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('Entity extraction result:', data);
      setProcessingStats(data);
      
      if (data.success) {
        toast({
          title: "Processing complete",
          description: `Processed ${data.processed} of ${data.total} entries in ${data.processingTime}.`
        });
      } else {
        toast({
          title: "Processing failed",
          description: data.error || "An error occurred while processing entries.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error processing entities:', error);
      toast({
        title: "Processing failed",
        description: "An error occurred while processing entries.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingEntities(false);
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
              System Diagnostics
            </CardTitle>
            <CardDescription>
              Check the health and configuration of your journal entry system.
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
                        Check if the environment is properly configured with required API keys and services.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={checkEnvironment} 
                    disabled={envCheckLoading}
                    variant="secondary"
                    className="w-full"
                  >
                    {envCheckLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking Environment...
                      </>
                    ) : (
                      "Check Environment Configuration"
                    )}
                  </Button>

                  {envCheckResult && (
                    <div className="mt-4 p-3 bg-background rounded-md">
                      <h4 className="font-medium mb-2">Environment Check Results:</h4>
                      
                      {envCheckResult.success ? (
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="font-medium mr-2">Google NL API:</span>
                            {envCheckResult.googleNlApiConfigured ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800">Available</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-100 text-red-800">Missing</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <span className="font-medium mr-2">OpenAI API:</span>
                            {envCheckResult.openAiApiConfigured ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800">Available</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-100 text-red-800">Missing</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <span className="font-medium mr-2">Supabase Connection:</span>
                            {envCheckResult.supabaseConnected ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800">Connected</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-100 text-red-800">Not Connected</Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Alert variant="destructive">
                          <AlertTitle>Error checking environment</AlertTitle>
                          <AlertDescription>{envCheckResult.error || "Unknown error"}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </div>

                {/* Entity Processing Section */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Entity Extraction
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Extract entities from all journal entries using Google Natural Language API.
                        This will process all entries, regardless of whether they already have entities.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={processAllEntities} 
                    disabled={isProcessingEntities}
                    variant="secondary"
                    className="w-full"
                  >
                    {isProcessingEntities ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Journal Entries...
                      </>
                    ) : (
                      "Process All Journal Entries"
                    )}
                  </Button>

                  {processingStats && (
                    <div className="mt-4 p-3 bg-background rounded-md">
                      <h4 className="font-medium mb-2">Processing Results:</h4>
                      
                      {processingStats.success ? (
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="font-medium mr-2">Entries Processed:</span>
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              {processingStats.processed} of {processingStats.total}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center">
                            <span className="font-medium mr-2">Processing Time:</span>
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              {processingStats.processingTime}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <Alert variant="destructive">
                          <AlertTitle>Error processing entries</AlertTitle>
                          <AlertDescription>{processingStats.error || "Unknown error"}</AlertDescription>
                        </Alert>
                      )}
                    </div>
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
