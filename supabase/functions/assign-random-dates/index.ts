
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function assignRandomDates(batchSize = 1000): Promise<any> {
  try {
    // Count the total number of rows to process
    const { count, error: countError } = await supabase
      .from('PoPs_Reviews')
      .select('id', { count: 'exact', head: true })
      .is('datetime', null);
    
    if (countError) {
      console.error('Error counting rows with NULL datetime:', countError);
      throw countError;
    }
    
    const totalRowsToProcess = count || 0;
    console.log(`Total rows with NULL datetime to process: ${totalRowsToProcess}`);
    
    if (totalRowsToProcess === 0) {
      return { processed: 0, total: 0, message: 'No rows with NULL datetime to process' };
    }
    
    // Fetch reviews with NULL datetime to process in this batch
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id')
      .is('datetime', null)
      .order('id', { ascending: true })
      .limit(batchSize);
    
    if (error) {
      console.error('Error fetching reviews with NULL datetime:', error);
      throw error;
    }
    
    console.log(`Processing ${reviews?.length || 0} reviews with NULL datetime in this batch`);
    
    if (!reviews || reviews.length === 0) {
      return { processed: 0, total: 0, message: 'No reviews to process in this batch' };
    }
    
    let processedCount = 0;
    
    // End date: April 23, 2025
    const endDate = new Date('2025-04-23T00:00:00Z');
    // Start date: 3 years before end date
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 3);
    
    // Process each review
    for (const review of reviews) {
      try {
        console.log(`Processing review ID: ${review.id}`);
        
        // Generate random date between start and end dates
        const randomDate = new Date(
          startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime())
        );
        
        // Generate random time component
        const hours = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 60);
        const seconds = Math.floor(Math.random() * 60);
        
        randomDate.setHours(hours, minutes, seconds);
        
        // Update the datetime column
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            datetime: randomDate.toISOString()
          })
          .eq('id', review.id);
        
        if (updateError) {
          console.error(`Error updating review ${review.id}:`, updateError);
        } else {
          processedCount++;
          console.log(`Assigned random date ${randomDate.toISOString()} to review ID: ${review.id}`);
        }
      } catch (reviewError) {
        console.error(`Error processing review ${review.id}:`, reviewError);
      }
    }
    
    return {
      processed: processedCount,
      total: reviews.length,
      remaining: totalRowsToProcess - processedCount,
      message: `Assigned random dates to ${processedCount} out of ${reviews.length} reviews in this batch. Total remaining: ${totalRowsToProcess - processedCount}`
    };
  } catch (error) {
    console.error('Error in assignRandomDates:', error);
    throw error;
  }
}

async function processAllNullDates(batchSize = 1000): Promise<any> {
  try {
    // Count total null dates
    const { count, error: countError } = await supabase
      .from('PoPs_Reviews')
      .select('id', { count: 'exact', head: true })
      .is('datetime', null);
    
    if (countError) {
      console.error('Error counting NULL datetime:', countError);
      throw countError;
    }
    
    const totalNullDates = count || 0;
    console.log(`Total NULL datetime to process: ${totalNullDates}`);
    
    if (totalNullDates === 0) {
      return { processed: 0, message: 'No NULL datetime to process' };
    }
    
    let totalProcessed = 0;
    let remaining = totalNullDates;
    let batchNumber = 1;
    
    // Process batches until all NULL dates are handled
    while (remaining > 0) {
      console.log(`Processing batch #${batchNumber}, remaining: ${remaining}`);
      
      const result = await assignRandomDates(batchSize);
      
      totalProcessed += result.processed;
      remaining = totalNullDates - totalProcessed;
      
      console.log(`Batch #${batchNumber} completed: processed ${result.processed}, total processed: ${totalProcessed}, remaining: ${remaining}`);
      
      if (result.processed === 0) {
        // No more records processed in this batch, break to avoid infinite loop
        break;
      }
      
      batchNumber++;
    }
    
    return {
      totalProcessed,
      totalNullDates,
      remaining,
      message: `Processed all available NULL datetime. Assigned random dates to ${totalProcessed} out of ${totalNullDates} reviews.`
    };
  } catch (error) {
    console.error('Error in processAllNullDates:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processAll = true, batchSize = 1000 } = await req.json().catch(() => ({ processAll: true, batchSize: 1000 }));
    
    console.log(`Request received with processAll: ${processAll}, batchSize: ${batchSize}`);
    
    let result;
    if (processAll) {
      // Process all NULL dates in batches
      result = await processAllNullDates(batchSize);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.message,
          totalProcessed: result.totalProcessed,
          totalNullDates: result.totalNullDates,
          remaining: result.remaining
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Process a single batch of NULL dates
      result = await assignRandomDates(batchSize);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.message,
          processed: result.processed,
          total: result.total,
          remaining: result.remaining || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in assign-random-dates:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
