
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info, RefreshCw, Database } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processAll, setProcessAll] = useState(false);
  const { batchProcessEntities } = useJournalEntries(user?.id, 0, true);
  
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
