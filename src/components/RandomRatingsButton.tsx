
import { useState } from 'react';
import { Button } from "./ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dice } from 'lucide-react';

export function RandomRatingsButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const assignRandomRatings = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('assign-random-ratings', {
        body: { 
          limit: 100,
          processAll: true
        }
      });
      
      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(`Function error: ${error.message || 'Unknown function error'}`);
      }
      
      console.log('Random ratings result:', data);
      
      if (!data) {
        throw new Error('No data returned from function');
      }
      
      if (data.success) {
        toast.success(data.message || 'Random ratings assigned successfully');
      } else {
        const errorMsg = data.error || 'Assignment failed with no specific error';
        console.error('Assignment failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error assigning random ratings:', error);
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      toast.error('Error assigning random ratings: ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button 
      onClick={assignRandomRatings}
      disabled={isProcessing}
      className="gap-2"
    >
      <Dice className="h-4 w-4" />
      {isProcessing ? 'Assigning Random Ratings...' : 'Assign Random Ratings'}
    </Button>
  );
}
