
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

  const processReviews = async (processAll: boolean = false) => {
    try {
      setIsProcessing(true);
      setProgress(0);
      
      const { data, error } = await supabase.functions.invoke('process-restaurant-reviews', {
        body: { limit: 10, offset: 0, processAll }
      });
      
      if (error) {
        throw error;
      }
      
      console.log('Processing result:', data);
      
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
        toast.error('Processing failed');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing reviews:', error);
      toast.error('Error processing reviews: ' + (error as Error).message);
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
