
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, Info } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Utilities() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    // Automatically run the entity extraction process when the component mounts
    extractEntities();
  }, []);
  
  const extractEntities = async () => {
    try {
      setIsProcessing(true);
      setResult(null);
      
      toast({
        title: "Processing started",
        description: "Entity extraction process has started. This may take a few minutes.",
      });
      
      console.log("Invoking batch-extract-entities function...");
      console.log("Current user ID:", user?.id);
      
      const { data, error } = await supabase.functions.invoke('batch-extract-entities', {
        body: { userId: user?.id }
      });
      
      if (error) {
        console.error("Error invoking batch-extract-entities:", error);
        throw error;
      }
      
      console.log("Batch extract entities result:", data);
      setResult(data);
      
      // Show appropriate toast based on the number of entries processed
      if (data.processed > 0) {
        toast({
          title: "Processing complete",
          description: `Successfully processed ${data.processed} out of ${data.total} entries in ${data.processingTime}`,
          variant: "default"
        });
      } else if (data.total === 0) {
        toast({
          title: "No entries to process",
          description: "All journal entries already have entities extracted.",
          variant: "default"
        });
      } else {
        toast({
          title: "Processing complete",
          description: `Processed ${data.processed} out of ${data.total} entries in ${data.processingTime}, but no entities were found.`,
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error("Error extracting entities:", error);
      toast({
        title: "Error",
        description: "Failed to process entities. See console for details.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
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
              Batch Entity Extraction
            </CardTitle>
            <CardDescription>
              Extract named entities (people, organizations, locations, etc.) from journal entries that don't have entities yet.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {isProcessing ? 
                "Entity extraction is currently running. This may take several minutes depending on the number of entries..." :
                "This utility processes all journal entries without entities and extracts named entities like people, organizations, locations, etc. using OpenAI."
              }
            </p>
            
            {user ? (
              <p className="text-sm text-muted-foreground mb-4">
                Processing journal entries for user: {user.email || user.id}
              </p>
            ) : (
              <Alert variant="default" className="mb-4">
                <AlertTitle>Not signed in</AlertTitle>
                <AlertDescription>
                  You need to be signed in to process your journal entries.
                </AlertDescription>
              </Alert>
            )}
            
            {result && (
              <Alert className="mt-4">
                <AlertTitle className="flex items-center gap-2">
                  {result.success ? 
                    <Check className="h-4 w-4 text-green-500" /> : 
                    <Info className="h-4 w-4 text-amber-500" />
                  }
                  Processing Result
                </AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <p><strong>Status:</strong> {result.success ? 'Success' : 'Failed'}</p>
                    <p><strong>Entries Processed:</strong> {result.processed} out of {result.total} entries</p>
                    <p><strong>Processing Time:</strong> {result.processingTime}</p>
                    {result.error && <p className="text-red-500"><strong>Error:</strong> {result.error}</p>}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          
          <CardFooter>
            <Button 
              onClick={extractEntities} 
              disabled={isProcessing || !user}
              className="w-full"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Run Entity Extraction'}
            </Button>
          </CardFooter>
        </Card>
        
        <Separator className="my-8" />
        
        {/* Additional utilities can be added here */}
      </motion.div>
    </div>
  );
}
