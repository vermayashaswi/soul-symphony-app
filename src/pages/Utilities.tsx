
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessingEntities, setIsProcessingEntities] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);
  
  // Process all journal entries for entity extraction
  const processAllEntries = async () => {
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
          processAll: true  // Always process all entries
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
          description: `Processed ${data.processed} of ${data.total} entries in ${data.processingTime}.`,
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
              <Database className="h-5 w-5" /> 
              Journal Entry Processing
            </CardTitle>
            <CardDescription>
              Process your journal entries to extract entities using Google Natural Language API.
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
                  <div className="mt-6">
                    <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                      <Database className="h-4 w-4" />
                      Entity Extraction
                    </h3>
                    
                    <Alert variant="default" className="mb-4">
                      <AlertTitle>Google Natural Language API</AlertTitle>
                      <AlertDescription>
                        This utility will extract entities (people, places, organizations) from all your journal entries.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      onClick={processAllEntries} 
                      disabled={isProcessingEntities}
                      variant="default"
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

                            {processingStats.failed > 0 && (
                              <div className="mt-2">
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertTitle>Processing Warnings</AlertTitle>
                                  <AlertDescription>
                                    {processingStats.failed} entries could not be processed correctly.
                                    {processingStats.errors && processingStats.errors.length > 0 && (
                                      <div className="mt-2 text-sm">
                                        <p>First error: {processingStats.errors[0].error}</p>
                                      </div>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              </div>
                            )}
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
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
