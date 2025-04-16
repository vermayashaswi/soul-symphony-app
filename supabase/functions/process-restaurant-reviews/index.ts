
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
      throw new Error('Google Natural Language API key is not configured');
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
      throw new Error(`Failed to analyze sentiment: ${error}`);
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

// Extract entities from text
async function extractEntities(text: string): Promise<any[]> {
  try {
    console.log('Extracting entities from review:', text.slice(0, 100) + '...');
    
    if (!googleNLApiKey) {
      console.error('Google API key not found in environment');
      return [];
    }
    
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${googleNLApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text
        },
        encodingType: 'UTF8'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google NL API error:", errorData);
      return [];
    }

    const result = await response.json();
    
    // Transform the entities to our preferred format
    const formattedEntities = result.entities?.map((entity: any) => ({
      name: entity.name,
      type: entity.type,
      salience: entity.salience,
      mentions: entity.mentions?.length || 0
    })) || [];
    
    console.log(`Extracted ${formattedEntities.length} entities`);
    return formattedEntities;
  } catch (error) {
    console.error('Error in extractEntities:', error);
    return [];
  }
}

// Extract themes from text
async function extractThemes(text: string): Promise<string[]> {
  try {
    console.log(`Starting theme extraction for review: "${text.substring(0, 100)}..."`);
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return ['Food', 'Service', 'Ambience']; // Fallback themes
    }
    
    const prompt = `
      Analyze the following restaurant review and extract the main themes or topics discussed (maximum 5 themes).
      
      For themes, return simple phrases or keywords that capture the essence of what the review is about.
      
      Return the results as a JSON object with one property:
      - "themes": An array of strings representing the main themes
      
      Example response format:
      {
        "themes": ["food quality", "service", "ambiance"]
      }
      
      Restaurant review:
      ${text}
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
          {
            role: 'system',
            content: 'You are a theme extraction assistant. Extract themes from restaurant reviews following the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      return ['Food', 'Service', 'Ambience']; // Fallback themes
    }

    const result = await response.json();
    
    // Extract themes from the response
    const contentText = result.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const parsedContent = JSON.parse(contentText);
      
      // Extract themes
      const themes = parsedContent.themes || [];
      console.log(`Extracted themes:`, themes);
      
      return themes.length ? themes : ['Food', 'Service', 'Ambience'];
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return ['Food', 'Service', 'Ambience'];
    }
  } catch (error) {
    console.error('Error in extractThemes:', error);
    return ['Food', 'Service', 'Ambience'];
  }
}

// Verify table structure and required columns - FIXED to avoid information_schema issues
async function verifyTableStructure() {
  try {
    console.log('Verifying PoPs_Reviews table structure...');
    
    // First check if the table exists by trying to select from it
    const { data: tableExists, error: tableError } = await supabase
      .from('PoPs_Reviews')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('Error checking if table exists:', tableError);
      throw new Error(`Table PoPs_Reviews does not exist or cannot be accessed: ${tableError.message}`);
    }
    
    // Now check if our required columns exist by querying them
    const { data: columnsExist, error: columnsError } = await supabase
      .from('PoPs_Reviews')
      .select('Rating, entities, Themes')
      .limit(0);
    
    if (columnsError && columnsError.message.includes('column') && columnsError.message.includes('does not exist')) {
      console.error('Error checking columns:', columnsError);
      
      // Figure out which columns are missing from the error message
      const errorMsg = columnsError.message.toLowerCase();
      const missingColumns = [];
      
      if (errorMsg.includes('rating')) missingColumns.push('Rating');
      if (errorMsg.includes('entities')) missingColumns.push('entities');
      if (errorMsg.includes('themes')) missingColumns.push('Themes');
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      } else {
        throw new Error(`Unknown column error: ${columnsError.message}`);
      }
    }
    
    console.log('Table structure verified successfully');
    return true;
  } catch (error) {
    console.error('Table structure verification failed:', error);
    throw error;
  }
}

// Process a batch of reviews
async function processReviews(limit = 10, offset = 0): Promise<any> {
  try {
    // First verify table structure
    await verifyTableStructure();
    
    // Fetch reviews that haven't been processed
    const { data: reviews, error } = await supabase
      .from('PoPs_Reviews')
      .select('id, Reviews')
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
        
        // Extract entities
        const entities = await extractEntities(review.Reviews);
        
        // Analyze sentiment and get rating
        const rating = await analyzeSentiment(review.Reviews);
        
        // Extract themes
        const themes = await extractThemes(review.Reviews);
        
        // Update the review with the processed data
        const { error: updateError } = await supabase
          .from('PoPs_Reviews')
          .update({
            Rating: rating,
            entities: entities,
            Themes: themes
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
    
    // Try to add the missing columns if they don't exist
    try {
      // First check if the table exists
      const { error: tableCheckError } = await supabase
        .from('PoPs_Reviews')
        .select('id')
        .limit(1);
      
      if (!tableCheckError) {
        // Try to add Rating column if it doesn't exist
        try {
          await supabase.rpc('table_column_exists', { table_name: 'PoPs_Reviews', column_name: 'Rating' })
            .then(async ({ data: columnExists }) => {
              if (columnExists === false) {
                // Using RPC is safer than direct SQL when we don't have schema access
                console.log('Adding Rating column');
                await supabase.rpc('add_column', { 
                  table_name: 'PoPs_Reviews', 
                  column_name: 'Rating', 
                  column_type: 'integer' 
                });
              }
            });
        } catch (e) {
          console.log('Error checking/adding Rating column:', e);
          // Continue even if this fails
        }
        
        // Try to add entities column if it doesn't exist
        try {
          await supabase.rpc('table_column_exists', { table_name: 'PoPs_Reviews', column_name: 'entities' })
            .then(async ({ data: columnExists }) => {
              if (columnExists === false) {
                console.log('Adding entities column');
                await supabase.rpc('add_column', { 
                  table_name: 'PoPs_Reviews', 
                  column_name: 'entities', 
                  column_type: 'jsonb' 
                });
              }
            });
        } catch (e) {
          console.log('Error checking/adding entities column:', e);
          // Continue even if this fails
        }
        
        // Try to add Themes column if it doesn't exist
        try {
          await supabase.rpc('table_column_exists', { table_name: 'PoPs_Reviews', column_name: 'Themes' })
            .then(async ({ data: columnExists }) => {
              if (columnExists === false) {
                console.log('Adding Themes column');
                await supabase.rpc('add_column', { 
                  table_name: 'PoPs_Reviews', 
                  column_name: 'Themes', 
                  column_type: 'text[]' 
                });
              }
            });
        } catch (e) {
          console.log('Error checking/adding Themes column:', e);
          // Continue even if this fails
        }
      }
    } catch (e) {
      console.log('Error checking table structure:', e);
      // Continue with normal verification
    }
    
    // First check if the required table structure exists
    try {
      await verifyTableStructure();
    } catch (structureError) {
      console.error('Table structure verification failed:', structureError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Table structure error: ${structureError.message}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
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
