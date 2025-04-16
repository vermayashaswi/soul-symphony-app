
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
    
    // Updated prompt to emphasize variety in ratings
    const prompt = `
      Generate a restaurant review and rating based on the following data:
      
      Restaurant Label: ${JSON.stringify(label || {})}
      Food/Service Entities: ${JSON.stringify(entities || {})}
      Dining Themes: ${JSON.stringify(themes || {})}
      
      First, assign a rating between 1 and 5 stars (use the full range from 1 to 5) and then write a realistic 
      review that matches the rating. Make the review sound authentic.
      
      Please respond with ONLY a JSON object in this exact format:
      {
        "rating": (number between 1-5),
        "review": "(your review text here)"
      }
      
      DO NOT include any markdown formatting, code blocks, or additional text.
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
          { role: 'system', content: 'You are a helpful assistant that generates realistic restaurant reviews. Respond with ONLY valid JSON, no markdown or code blocks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // Increased temperature for more variety
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from OpenAI API:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    let content = result.choices[0].message.content.trim();
    console.log('Raw OpenAI response:', content);
    
    // Remove any markdown code block formatting if present
    if (content.startsWith('```')) {
      content = content.replace(/```json\n?/, '').replace(/```\n?/, '').trim();
    }
    
    try {
      // Try to parse the result as JSON
      const parsedContent = JSON.parse(content);
      
      // Validate that we have the expected fields
      if (!parsedContent.hasOwnProperty('review') || !parsedContent.hasOwnProperty('rating')) {
        throw new Error('Missing required fields in response');
      }
      
      // Validate and normalize rating
      let rating = parseInt(parsedContent.rating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        // Generate a more random fallback rating
        rating = Math.floor(Math.random() * 5) + 1;
      }
      
      return {
        review: parsedContent.review || "No review generated",
        rating: rating
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      
      // Improved fallback: Extract rating and review from text
      const ratingMatch = content.match(/rating"?\s*:?\s*(\d+)/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : Math.floor(Math.random() * 5) + 1;
      
      // Extract text that looks like a review
      const reviewMatch = content.match(/review"?\s*:?\s*"([^"]+)"/i) || content.match(/review"?\s*:?\s*'([^']+)'/i);
      let review = reviewMatch ? reviewMatch[1] : content;
      
      // If we still don't have a good review, create a generic one based on rating
      if (!review || review.length < 20) {
        const sentiments = [
          "Terrible experience. Would not recommend.",
          "Disappointing visit with several issues.",
          "Average experience, neither great nor terrible.",
          "Very good experience with minor improvements possible.",
          "Excellent experience! Highly recommended!"
        ];
        review = sentiments[rating - 1];
      }
      
      return { review, rating };
    }
  } catch (error) {
    console.error('Error in generateReviewAndRating:', error);
    // Return random rating for variety in case of errors
    return { 
      review: "Error generating review.",
      rating: Math.floor(Math.random() * 5) + 1
    };
  }
}

async function processReviews(limit = 10): Promise<any> {
  try {
    // Fetch reviews to process
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id, Label, entities, Themes, "Restaurant Name"')
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
        
        // Update both Reviews and Rating columns together in a single operation
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
      // Get total count of reviews to process
      const { count, error: countError } = await supabase
        .from('PoPs_Reviews')
        .select('id', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error counting reviews:', countError);
        throw countError;
      }
      
      console.log(`Total reviews to process: ${count}`);
      
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
