
import { useState } from 'react';
import { Button } from "./ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock } from 'lucide-react';

export function RandomDatesButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const assignRandomDates = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('assign-random-dates', {
        body: { 
          processAll: true,
          batchSize: 1000
        }
      });
      
      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(`Function error: ${error.message || 'Unknown function error'}`);
      }
      
      console.log('Random dates result:', data);
      
      if (!data) {
        throw new Error('No data returned from function');
      }
      
      if (data.success) {
        toast.success(
          `${data.message} Processed: ${data.totalProcessed || 0} rows. ${
            data.remaining > 0 
              ? `Remaining: ${data.remaining}` 
              : 'All NULL dates have been assigned values!'
          }`
        );
      } else {
        const errorMsg = data.error || 'Assignment failed with no specific error';
        console.error('Assignment failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error assigning random dates:', error);
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      toast.error('Error assigning random dates: ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button 
      onClick={assignRandomDates}
      disabled={isProcessing}
      className="gap-2"
    >
      <CalendarClock className="h-4 w-4" />
      {isProcessing ? 'Assigning Random Dates...' : 'Assign Random Dates'}
    </Button>
  );
}
