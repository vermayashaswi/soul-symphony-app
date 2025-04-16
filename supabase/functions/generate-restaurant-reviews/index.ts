
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateReviewFromRating(label: any, entities: any, themes: any, rating: number): Promise<string> {
  try {
    console.log('Generating review based on data and existing rating:', { label, entities, themes, rating });
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not found in environment');
      throw new Error('OpenAI API key not configured');
    }
    
    // Updated prompt that explicitly specifies to use the existing rating
    const prompt = `
      Generate a restaurant review for a ${rating}-star rating (on a scale of 1-5) based on the following data:
      
      Restaurant Label: ${JSON.stringify(label || {})}
      Food/Service Entities: ${JSON.stringify(entities || {})}
      Dining Themes: ${JSON.stringify(themes || {})}
      
      Write a realistic, practical, colloquial review as if it was written by a real restaurant customer.
      The tone and content of the review should accurately reflect the ${rating}-star rating.
      
      Please respond with ONLY the review text, no additional formatting or explanation.
    `;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates realistic restaurant reviews. Respond with only the review text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from OpenAI API:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const reviewText = result.choices[0].message.content.trim();
    console.log('Generated review:', reviewText);
    
    return reviewText;
  } catch (error) {
    console.error('Error in generateReviewFromRating:', error);
    return "Error generating review.";
  }
}

async function processReviews(limit = 10): Promise<any> {
  try {
    // Only fetch reviews that have a Rating but no Reviews
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id, Label, entities, Themes, "Restaurant Name", Rating')
      .not('Rating', 'is', null)  // Only get rows that already have a Rating
      .is('Reviews', null)        // Only get rows that don't have Reviews yet
      .order('id', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }
    
    console.log(`Processing ${reviews?.length || 0} reviews with existing ratings`);
    
    if (!reviews || reviews.length === 0) {
      return { processed: 0, total: 0, message: 'No reviews to process (all reviews with ratings already have review text)' };
    }
    
    let processedCount = 0;
    
    // Process each review
    for (const review of reviews) {
      try {
        console.log(`Processing review ID: ${review.id} with Rating: ${review.Rating}`);
        
        if (review.Rating === null) {
          console.log(`Skipping review ID: ${review.id} because it has no rating`);
          continue;
        }
        
        // Generate review text based on existing rating
        const reviewText = await generateReviewFromRating(
          review.Label, 
          review.entities, 
          review.Themes,
          review.Rating
        );
        
        // Update only the Reviews column with the generated text
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            Reviews: reviewText
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
    const { limit = 10, processAll = false } = await req.json();
    
    console.log(`Request received with limit: ${limit}, processAll: ${processAll}`);
    
    if (processAll) {
      // Get total count of reviews to process (with Rating but no Reviews)
      const { count, error: countError } = await supabase
        .from('PoPs_Reviews')
        .select('id', { count: 'exact', head: true })
        .not('Rating', 'is', null)
        .is('Reviews', null);
      
      if (countError) {
        console.error('Error counting reviews:', countError);
        throw countError;
      }
      
      console.log(`Total reviews to process: ${count}`);
      
      if (count === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No reviews to process (all reviews with ratings already have review text)',
            processed: 0,
            remaining: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Process first batch
      const result = await processReviews(limit);
      
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
      const result = await processReviews(limit);
      
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
    console.error('Error in generate-restaurant-reviews:', error);
    
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
