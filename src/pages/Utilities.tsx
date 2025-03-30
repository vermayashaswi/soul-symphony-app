
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Loader2, Key } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";

export default function Utilities() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessingEntities, setIsProcessingEntities] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [envStatus, setEnvStatus] = useState<any>(null);

  // Check if API key is configured
  const checkApiKeyStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { 
          debugEnv: true
        }
      });
      
      if (error) {
        console.error('Error checking API key status:', error);
        return;
      }
      
      setEnvStatus(data);
      
      if (data && !data.googleNlApiConfigured) {
        toast({
          title: "API Key Not Configured",
          description: "Google Natural Language API key is not set. Please configure it below.",
          variant: "destructive"
        });
      } else if (data && data.googleNlApiConfigured) {
        toast({
          title: "API Key Status",
          description: "Google Natural Language API key is configured.",
        });
      }
    } catch (error: any) {
      console.error('Error checking API key status:', error);
    }
  };

  // Save the Google NL API key
  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid Google Natural Language API key",
        variant: "destructive"
      });
      return;
    }

    setIsSavingKey(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('set-api-key', {
        body: { 
          key: 'GOOGLE_NL_API_KEY',
          value: apiKey.trim()
        }
      });
      
      if (error) {
        console.error('Error saving API key:', error);
        toast({
          title: "Error Saving API Key",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
        return;
      }
      
      console.log('Save API key result:', data);
      
      if (data.success) {
        toast({
          title: "API Key Saved",
          description: "Google Natural Language API key has been configured successfully."
        });
        setApiKey('');
        // Check the status after saving
        await checkApiKeyStatus();
      } else {
        toast({
          title: "Error Saving API Key",
          description: data.error || "Failed to save the API key",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error Saving API Key",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSavingKey(false);
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
      // First, check if the API key is configured
      const { data: statusData } = await supabase.functions.invoke('analyze-sentiment', {
        body: { debugEnv: true }
      });
      
      if (statusData && !statusData.googleNlApiConfigured) {
        toast({
          title: "API Key Not Configured",
          description: "Google Natural Language API key is not set. Please configure it first.",
          variant: "destructive"
        });
        setIsProcessingEntities(false);
        return;
      }
      
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
              <Key className="h-5 w-5" /> 
              API Configuration
            </CardTitle>
            <CardDescription>
              Configure the Google Natural Language API key required for entity extraction.
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
                        <Key className="h-4 w-4" />
                        Google Natural Language API Key
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set your Google Natural Language API key for sentiment analysis and entity extraction.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-4">
                    <Input
                      type="password"
                      placeholder="Enter your Google Natural Language API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <Button 
                      onClick={saveApiKey} 
                      disabled={isSavingKey || !apiKey.trim()}
                      variant="outline"
                    >
                      {isSavingKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Key"
                      )}
                    </Button>
                    <Button 
                      onClick={checkApiKeyStatus} 
                      variant="secondary"
                    >
                      Check Status
                    </Button>
                  </div>
                  
                  {envStatus && (
                    <Alert variant={envStatus.googleNlApiConfigured ? "default" : "destructive"} className="mb-4">
                      <AlertTitle>{envStatus.googleNlApiConfigured ? "API Key Configured" : "API Key Not Configured"}</AlertTitle>
                      <AlertDescription>
                        {envStatus.googleNlApiConfigured 
                          ? "Google Natural Language API key is set up correctly."
                          : "Please set your Google Natural Language API key to use entity extraction features."}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="text-sm text-muted-foreground mt-2">
                    <p>To get a Google Natural Language API key:</p>
                    <ol className="list-decimal list-inside pl-2 mt-1 space-y-1">
                      <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a></li>
                      <li>Create a new project or select an existing one</li>
                      <li>Enable the "Natural Language API"</li>
                      <li>Go to "APIs & Services" → "Credentials"</li>
                      <li>Click "Create credentials" → "API key"</li>
                      <li>Copy and paste the key above</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
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
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Entity Extraction
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Extract entities from all journal entries using Google Natural Language API.
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={processAllEntities} 
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
      </motion.div>
    </div>
  );
}
