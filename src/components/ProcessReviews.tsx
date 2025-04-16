import { useState, useEffect, useRef } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { Square } from "lucide-react";

export function ProcessReviews() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    processed: number;
    remaining: number;
    totalToProcess: number;
  } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<{
    exists: boolean;
    columns: string[];
    sampleData?: any;
  } | null>(null);
  const shouldContinueRef = useRef(true);

  useEffect(() => {
    checkTableStructure();
    
    // Reset stop flag when component mounts
    shouldContinueRef.current = true;
    
    // Clean up function
    return () => {
      shouldContinueRef.current = false;
    };
  }, []);

  const checkTableStructure = async () => {
    setIsVerifying(true);
    setErrorDetails(null);
    
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('PoPs_Reviews')
        .select('id')
        .limit(1);
      
      if (tableError) {
        setTableInfo({ exists: false, columns: [] });
        setErrorDetails(`Table check failed: ${tableError.message}`);
        toast.error('Table check failed');
        setIsVerifying(false);
        return;
      }
      
      const { data: columnsData, error: columnsError } = await supabase
        .rpc('check_table_columns', { table_name: 'PoPs_Reviews' })
        .select();
      
      if (columnsError) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('PoPs_Reviews')
          .select('*')
          .limit(1);
        
        if (fallbackError) {
          setTableInfo({ exists: true, columns: [] });
          setErrorDetails(`Failed to get columns: ${fallbackError.message}`);
          setIsVerifying(false);
          return;
        }
        
        const columnNames = fallbackData && fallbackData.length > 0 
          ? Object.keys(fallbackData[0]) 
          : [];
        
        setTableInfo({ 
          exists: true, 
          columns: columnNames,
          sampleData: fallbackData
        });
      } else {
        const columnNames = columnsData?.map(col => col.column_name) || [];
        setTableInfo({ 
          exists: true, 
          columns: columnNames,
          sampleData: tableData
        });
      }
    } catch (error) {
      setErrorDetails(`Table structure check failed: ${(error as Error).message}`);
      toast.error('Table structure check failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const stopProcessing = () => {
    shouldContinueRef.current = false;
    toast.info("Stopping the processing after current batch completes...");
  };

  const processReviews = async (processAll: boolean = false) => {
    try {
      shouldContinueRef.current = true;
      
      setIsProcessing(true);
      setProgress(0);
      setErrorDetails(null);
      
      console.log(`Starting to process reviews: processAll=${processAll}`);
      
      // Use the generate-restaurant-reviews function
      const { data, error } = await supabase.functions.invoke('generate-restaurant-reviews', {
        body: { 
          limit: 10, 
          processAll,
          debug: true 
        }
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
        
        const totalToProcess = data.totalToProcess || data.total || 0;
        const processed = data.processed || 0;
        
        if (totalToProcess > 0) {
          setProgress(Math.floor((processed / totalToProcess) * 100));
        }
        
        if (processAll && data.remaining > 0 && shouldContinueRef.current) {
          toast.info(`Processing next batch. Remaining: ${data.remaining}`);
          setTimeout(() => {
            processReviews(true);
          }, 2000);
        } else {
          if (!shouldContinueRef.current) {
            toast.success("Processing stopped by user");
          }
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
          Generate review text and ratings based on labels, entities, and themes data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isVerifying && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Verifying table structure...</p>
            <Progress value={30} className="h-2" />
          </div>
        )}
        
        {isProcessing && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Processing reviews...</p>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {tableInfo && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Table Information</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>Table exists: {tableInfo.exists ? 'Yes' : 'No'}</div>
              
              {tableInfo.exists && (
                <>
                  <div>Columns: {tableInfo.columns.join(', ') || 'None found'}</div>
                  <div className="text-xs text-amber-600">
                    Required columns: id, Label, "Restaurant Name", Reviews, Rating, entities, Themes
                  </div>
                  <div>
                    {tableInfo.columns.includes('Reviews') ? 
                      <span className="text-green-600">✓ Reviews column exists</span> : 
                      <span className="text-red-600">✗ Reviews column missing</span>}
                  </div>
                  <div>
                    {tableInfo.columns.includes('Rating') ? 
                      <span className="text-green-600">✓ Rating column exists</span> : 
                      <span className="text-red-600">✗ Rating column missing</span>}
                  </div>
                  <div>
                    {tableInfo.columns.includes('Label') ? 
                      <span className="text-green-600">✓ Label column exists (JSONB)</span> : 
                      <span className="text-red-600">✗ Label column missing</span>}
                  </div>
                </>
              )}
            </div>
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
      <CardFooter className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={checkTableStructure}
          disabled={isVerifying || isProcessing}
          size="sm"
        >
          Check Table
        </Button>
        <Button 
          variant="outline" 
          onClick={() => processReviews(false)}
          disabled={isVerifying || isProcessing}
          size="sm"
        >
          Process Batch
        </Button>
        <Button 
          onClick={() => processReviews(true)}
          disabled={isVerifying || isProcessing}
          size="sm"
        >
          Process All Reviews
        </Button>
        {isProcessing && (
          <Button 
            variant="destructive"
            onClick={stopProcessing}
            size="sm"
          >
            <Square className="mr-1 h-4 w-4" />
            Stop Processing
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
