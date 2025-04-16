
import { useState } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "./ui/progress";

export function ProcessReviews() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    processed: number;
    remaining: number;
    totalToProcess: number;
  } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const processReviews = async (processAll: boolean = false) => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setErrorDetails(null);
      
      console.log(`Starting to process reviews: processAll=${processAll}`);
      
      // Check if the required columns exist first by fetching a single row
      try {
        const { error: checkError } = await supabase
          .from('PoPs_Reviews')
          .select('id, Reviews')
          .limit(1);
        
        if (checkError) {
          throw new Error(`Table error: ${checkError.message}`);
        }
      } catch (checkError) {
        console.error('Error checking table:', checkError);
        setErrorDetails(`Table check failed: ${(checkError as Error).message}`);
        setIsProcessing(false);
        toast.error('Table check failed. Please check console for details.');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('process-restaurant-reviews', {
        body: { limit: 10, offset: 0, processAll }
      });
      
      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(`Function error: ${error.message || 'Unknown function error'}`);
      }
      
      console.log('Processing result:', data);
      
      if (!data) {
        throw new Error('No data returned from function');
      }
      
      if (data.success) {
        toast.success(data.message);
        setStats({
          processed: data.processed || 0,
          remaining: data.remaining || 0,
          totalToProcess: data.totalToProcess || data.total || 0
        });
        
        // Calculate progress
        const totalToProcess = data.totalToProcess || data.total || 0;
        const processed = data.processed || 0;
        
        if (totalToProcess > 0) {
          setProgress(Math.floor((processed / totalToProcess) * 100));
        }
        
        // Continue processing if there are more reviews and processAll is true
        if (processAll && data.remaining > 0) {
          toast.info(`Processing next batch. Remaining: ${data.remaining}`);
          setTimeout(() => {
            processReviews(true);
          }, 2000); // Wait 2 seconds before processing the next batch
        } else {
          setIsProcessing(false);
        }
      } else {
        const errorMsg = data.error || 'Processing failed with no specific error';
        console.error('Processing failed:', errorMsg);
        setErrorDetails(errorMsg);
        toast.error(`Processing failed: ${errorMsg}`);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing reviews:', error);
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      setErrorDetails(errorMessage);
      toast.error('Error processing reviews: ' + errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Process Restaurant Reviews</CardTitle>
        <CardDescription>
          Extract sentiment, entities, and themes from restaurant reviews.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isProcessing && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Processing reviews...</p>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {stats && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Processing Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Processed:</div>
              <div>{stats.processed}</div>
              
              <div>Remaining:</div>
              <div>{stats.remaining}</div>
              
              <div>Total:</div>
              <div>{stats.totalToProcess}</div>
            </div>
          </div>
        )}
        
        {errorDetails && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-md">
            <h3 className="font-medium text-red-800 mb-2">Error Details</h3>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{errorDetails}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => processReviews(false)}
          disabled={isProcessing}
        >
          Process Batch
        </Button>
        <Button 
          onClick={() => processReviews(true)}
          disabled={isProcessing}
        >
          Process All Reviews
        </Button>
      </CardFooter>
    </Card>
  );
}
