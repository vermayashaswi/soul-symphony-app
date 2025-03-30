
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ui/use-toast";

export default function Utilities() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  
  const extractEntities = async () => {
    try {
      setIsProcessing(true);
      setResult(null);
      
      const { data, error } = await supabase.functions.invoke('batch-extract-entities');
      
      if (error) {
        throw error;
      }
      
      setResult(data);
      
      toast({
        title: "Processing complete",
        description: `Processed ${data.processed} out of ${data.total} entries in ${data.processingTime}`,
      });
      
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
            <CardTitle>Batch Entity Extraction</CardTitle>
            <CardDescription>
              Extract entities from all journal entries that don't have entities yet.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This utility will process all journal entries without entities and extract named entities like people, organizations, 
              locations, etc. using OpenAI. This is a one-time activity to populate existing entries.
            </p>
            
            {result && (
              <Alert className="mt-4">
                <AlertTitle>Processing Result</AlertTitle>
                <AlertDescription>
                  <p>Success: {result.success ? 'Yes' : 'No'}</p>
                  <p>Processed: {result.processed} out of {result.total} entries</p>
                  <p>Processing Time: {result.processingTime}</p>
                  {result.error && <p>Error: {result.error}</p>}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          
          <CardFooter>
            <Button 
              onClick={extractEntities} 
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Extract Entities'}
            </Button>
          </CardFooter>
        </Card>
        
        <Separator className="my-8" />
        
        {/* Additional utilities can be added here */}
      </motion.div>
    </div>
  );
}
