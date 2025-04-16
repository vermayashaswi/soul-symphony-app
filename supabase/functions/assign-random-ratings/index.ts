
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

async function assignRandomRatings(batchSize = 1000): Promise<any> {
  try {
    // Count the total number of NULL ratings to process
    const { count, error: countError } = await supabase
      .from('PoPs_Reviews')
      .select('id', { count: 'exact', head: true })
      .is('Rating', null);
    
    if (countError) {
      console.error('Error counting NULL ratings:', countError);
      throw countError;
    }
    
    const totalNullRatings = count || 0;
    console.log(`Total NULL ratings to process: ${totalNullRatings}`);
    
    if (totalNullRatings === 0) {
      return { processed: 0, total: 0, message: 'No NULL ratings to process' };
    }
    
    // Fetch reviews with NULL ratings to process in this batch
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id')
      .is('Rating', null)
      .order('id', { ascending: true })
      .limit(batchSize);
    
    if (error) {
      console.error('Error fetching reviews with NULL ratings:', error);
      throw error;
    }
    
    console.log(`Processing ${reviews?.length || 0} reviews with NULL ratings in this batch`);
    
    if (!reviews || reviews.length === 0) {
      return { processed: 0, total: 0, message: 'No reviews to process in this batch' };
    }
    
    let processedCount = 0;
    
    // Process each review
    for (const review of reviews) {
      try {
        console.log(`Processing review ID: ${review.id}`);
        
        // Generate random rating between 1 and 5
        const randomRating = Math.floor(Math.random() * 5) + 1;
        
        // Update the Rating column
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            Rating: randomRating
          })
          .eq('id', review.id);
        
        if (updateError) {
          console.error(`Error updating review ${review.id}:`, updateError);
        } else {
          processedCount++;
          console.log(`Assigned random rating ${randomRating} to review ID: ${review.id}`);
        }
      } catch (reviewError) {
        console.error(`Error processing review ${review.id}:`, reviewError);
      }
    }
    
    return {
      processed: processedCount,
      total: reviews.length,
      remaining: totalNullRatings - processedCount,
      message: `Assigned random ratings to ${processedCount} out of ${reviews.length} reviews in this batch. Total remaining: ${totalNullRatings - processedCount}`
    };
  } catch (error) {
    console.error('Error in assignRandomRatings:', error);
    throw error;
  }
}

async function processAllNullRatings(batchSize = 1000): Promise<any> {
  try {
    // Count total null ratings
    const { count, error: countError } = await supabase
      .from('PoPs_Reviews')
      .select('id', { count: 'exact', head: true })
      .is('Rating', null);
    
    if (countError) {
      console.error('Error counting NULL ratings:', countError);
      throw countError;
    }
    
    const totalNullRatings = count || 0;
    console.log(`Total NULL ratings to process: ${totalNullRatings}`);
    
    if (totalNullRatings === 0) {
      return { processed: 0, message: 'No NULL ratings to process' };
    }
    
    let totalProcessed = 0;
    let remaining = totalNullRatings;
    let batchNumber = 1;
    
    // Process batches until all NULL ratings are handled
    while (remaining > 0) {
      console.log(`Processing batch #${batchNumber}, remaining: ${remaining}`);
      
      const result = await assignRandomRatings(batchSize);
      
      totalProcessed += result.processed;
      remaining = totalNullRatings - totalProcessed;
      
      console.log(`Batch #${batchNumber} completed: processed ${result.processed}, total processed: ${totalProcessed}, remaining: ${remaining}`);
      
      if (result.processed === 0) {
        // No more records processed in this batch, break to avoid infinite loop
        break;
      }
      
      batchNumber++;
    }
    
    return {
      totalProcessed,
      totalNullRatings,
      remaining,
      message: `Processed all available NULL ratings. Assigned random ratings to ${totalProcessed} out of ${totalNullRatings} reviews.`
    };
  } catch (error) {
    console.error('Error in processAllNullRatings:', error);
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
      // Process all NULL ratings in batches
      result = await processAllNullRatings(batchSize);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.message,
          totalProcessed: result.totalProcessed,
          totalNullRatings: result.totalNullRatings,
          remaining: result.remaining
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Process a single batch of NULL ratings
      result = await assignRandomRatings(batchSize);
      
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
    console.error('Error in assign-random-ratings:', error);
    
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
