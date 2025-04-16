
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const googleNLApiKey = Deno.env.get('GOOGLE_API') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Analyze sentiment and normalize to 1-5 scale
async function analyzeSentiment(text: string): Promise<number> {
  try {
    console.log('Analyzing sentiment for review:', text.slice(0, 100) + '...');
    
    if (!googleNLApiKey) {
      console.error('Google API key not found in environment');
      return 3; // Default to neutral rating
    }
    
    // Call the Google Natural Language API - specifying analyzeSentiment endpoint
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleNLApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error analyzing sentiment:', error);
      return 3; // Default to neutral rating
    }

    const result = await response.json();
    const sentimentScore = result.documentSentiment?.score || 0;
    console.log('Sentiment score:', sentimentScore);
    
    // Normalize the sentiment score to a 1-5 scale
    let rating = 3; // Default neutral rating
    
    if (sentimentScore < -0.6) {
      rating = 1;
    } else if (sentimentScore < -0.2) {
      rating = 2;
    } else if (sentimentScore < 0.2) {
      rating = 3;
    } else if (sentimentScore < 0.6) {
      rating = 4;
    } else {
      rating = 5;
    }
    
    return rating;
  } catch (error) {
    console.error('Error in analyzeSentiment:', error);
    return 3; // Return a neutral rating on error
  }
}

// Process a batch of reviews
async function processReviews(limit = 10, offset = 0): Promise<any> {
  try {
    // Fetch reviews that haven't been processed
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id, Reviews, Restaurant Name')
      .is('Rating', null)
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }
    
    console.log(`Processing ${reviews?.length || 0} reviews starting at offset ${offset}`);
    
    if (!reviews || reviews.length === 0) {
      return { processed: 0, total: 0, message: 'No reviews to process' };
    }
    
    let processedCount = 0;
    
    // Process each review
    for (const review of reviews) {
      try {
        console.log(`Processing review ID: ${review.id}`);
        
        // Skip reviews without text
        if (!review.Reviews) {
          console.log(`Skipping review ${review.id} - no review text`);
          continue;
        }
        
        // Analyze sentiment and get rating
        const rating = await analyzeSentiment(review.Reviews);
        
        // Update the review with the processed data
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            Rating: rating
          })
          .eq('id', review.id);
        
        if (updateError) {
          console.error(`Error updating review ${review.id}:`, updateError);
        } else {
          processedCount++;
          console.log(`Successfully processed review ID: ${review.id}`);
        }
      } catch (reviewError) {
        console.error(`Error processing review ${review.id}:`, reviewError);
      }
    }
    
    return {
      processed: processedCount,
      total: reviews.length,
      message: `Processed ${processedCount} out of ${reviews.length} reviews`
    };
  } catch (error) {
    console.error('Error in processReviews:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10, offset = 0, processAll = false } = await req.json();
    
    console.log(`Request received with limit: ${limit}, offset: ${offset}, processAll: ${processAll}`);
    
    if (processAll) {
      // Get total count of unprocessed reviews
      const { count, error: countError } = await supabase
        .from('PoPs_Reviews')
        .select('id', { count: 'exact', head: true })
        .is('Rating', null);
      
      if (countError) {
        console.error('Error counting unprocessed reviews:', countError);
        throw countError;
      }
      
      console.log(`Total unprocessed reviews: ${count}`);
      
      if (count === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No reviews to process',
            processed: 0,
            remaining: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Process first batch
      const result = await processReviews(limit, offset);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.message,
          processed: result.processed,
          remaining: count - result.processed,
          totalToProcess: count
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Process single batch
      const result = await processReviews(limit, offset);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: result.message,
          processed: result.processed,
          total: result.total
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in process-restaurant-reviews:', error);
    
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

