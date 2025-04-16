
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

async function generateReviewAndRating(label: any, entities: any, themes: any): Promise<{review: string, rating: number}> {
  try {
    console.log('Generating review and rating for data:', { label, entities, themes });
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not found in environment');
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `
      I want you to create a feedback text and rating basis these parameters like label, entities and themes. 
      Labels are essentially tags against a QR code that has been used by a user to drop feedbacks. 
      Entities and Themes are what the feedback text should have. 
      Please at random select a rating first (1-5) and then basis that sentiment, devise the feedback text using the labels, entities and themes jsons as well.

      Here is the data:
      Labels: ${JSON.stringify(label)}
      Entities: ${JSON.stringify(entities || {})}
      Themes: ${JSON.stringify(themes || {})}

      Please respond with a JSON object containing:
      1. A "rating" field with a number between 1 and 5
      2. A "review" field with the feedback text
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
          { role: 'system', content: 'You are a helpful assistant that generates realistic restaurant reviews.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from OpenAI API:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    try {
      // Try to parse the result as JSON
      const parsedContent = JSON.parse(content);
      return {
        review: parsedContent.review || "No review generated",
        rating: parsedContent.rating || 3
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      
      // Fallback: Try to extract rating and review from text
      const ratingMatch = content.match(/rating"?\s*:?\s*(\d+)/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;
      
      // Extract text that looks like a review
      const reviewMatch = content.match(/review"?\s*:?\s*"([^"]+)"/i);
      const review = reviewMatch ? reviewMatch[1] : content;
      
      return { review, rating };
    }
  } catch (error) {
    console.error('Error in generateReviewAndRating:', error);
    return { 
      review: "Error generating review.",
      rating: 3 // Default neutral rating
    };
  }
}

async function processReviews(limit = 10): Promise<any> {
  try {
    // Fetch reviews that don't have Reviews filled in yet
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id, Label, entities, Themes, "Restaurant Name"')
      .is('Reviews', null)
      .order('id', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }
    
    console.log(`Processing ${reviews?.length || 0} reviews`);
    
    if (!reviews || reviews.length === 0) {
      return { processed: 0, total: 0, message: 'No reviews to process' };
    }
    
    let processedCount = 0;
    
    // Process each review
    for (const review of reviews) {
      try {
        console.log(`Processing review ID: ${review.id}`);
        
        // Generate review text and rating
        const { review: reviewText, rating } = await generateReviewAndRating(
          review.Label, 
          review.entities, 
          review.Themes
        );
        
        // Update the review with the generated data
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            Reviews: reviewText,
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
    const { limit = 10, processAll = false } = await req.json();
    
    console.log(`Request received with limit: ${limit}, processAll: ${processAll}`);
    
    if (processAll) {
      // Get total count of unprocessed reviews
      const { count, error: countError } = await supabase
        .from('PoPs_Reviews')
        .select('id', { count: 'exact', head: true })
        .is('Reviews', null);
      
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
