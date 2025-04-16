
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

// Create the required database functions for adding columns if they don't exist
async function createHelperFunctions() {
  try {
    console.log('Creating helper functions...');
    
    // Create a function to check if a column exists
    await supabase.rpc('create_table_column_exists_function', {}).catch(e => {
      console.log('Function might already exist or failed to create:', e);
    });
    
    // Create a function to add a column if it doesn't exist
    await supabase.rpc('create_add_column_function', {}).catch(e => {
      console.log('Function might already exist or failed to create:', e);
    });
    
    console.log('Helper functions created or already exist');
    return true;
  } catch (e) {
    console.error('Error creating helper functions:', e);
    return false;
  }
}

// Create RPC function to check if a column exists
async function createColumnExistsFunction() {
  try {
    // Using raw SQL query through RPC to create the function
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.table_column_exists(table_name text, column_name text)
        RETURNS boolean AS $$
        DECLARE
          column_exists boolean;
        BEGIN
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
          ) INTO column_exists;
          
          RETURN column_exists;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    
    if (error) {
      console.error('Error creating table_column_exists function:', error);
      return false;
    }
    
    console.log('Created table_column_exists function');
    return true;
  } catch (e) {
    console.error('Error in createColumnExistsFunction:', e);
    return false;
  }
}

// Create RPC function to add a column if it doesn't exist
async function createAddColumnFunction() {
  try {
    // Using raw SQL query through RPC to create the function
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.add_column_if_not_exists(
          table_name text, 
          column_name text, 
          column_type text
        )
        RETURNS boolean AS $$
        DECLARE
          column_exists boolean;
        BEGIN
          -- Check if the column already exists
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
          ) INTO column_exists;
          
          -- If column doesn't exist, add it
          IF NOT column_exists THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', 
                          $1, $2, $3);
            RETURN true;
          END IF;
          
          RETURN false;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    
    if (error) {
      console.error('Error creating add_column_if_not_exists function:', error);
      return false;
    }
    
    console.log('Created add_column_if_not_exists function');
    return true;
  } catch (e) {
    console.error('Error in createAddColumnFunction:', e);
    return false;
  }
}

// Create a function to get table columns
async function createGetTableColumnsFunction() {
  try {
    // Using raw SQL query through RPC to create the function
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
        RETURNS TABLE(column_name text, data_type text) AS $$
        BEGIN
          RETURN QUERY
          SELECT c.column_name::text, c.data_type::text
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
          AND c.table_name = $1
          ORDER BY c.ordinal_position;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    
    if (error) {
      console.error('Error creating get_table_columns function:', error);
      return false;
    }
    
    console.log('Created get_table_columns function');
    return true;
  } catch (e) {
    console.error('Error in createGetTableColumnsFunction:', e);
    return false;
  }
}

// Create a function to execute SQL directly
async function createExecSqlFunction() {
  try {
    // Using raw SQL query through RPC to create the function
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
        RETURNS void AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    }).catch(e => {
      // Function might already exist
      console.log('Function might already exist:', e);
      return { error: null };
    });
    
    if (error) {
      console.error('Error creating exec_sql function:', error);
      return false;
    }
    
    console.log('Created or verified exec_sql function');
    return true;
  } catch (e) {
    console.error('Error in createExecSqlFunction:', e);
    return false;
  }
}

// Verify table structure and create/add required columns
async function verifyTableStructure(debug = false) {
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
    
    // Create the exec_sql function if needed (this is needed to create other functions)
    await createExecSqlFunction();
    
    // Attempt to create helper functions
    const { data: columnFnExists } = await supabase.rpc('check_function_exists', { 
      function_name: 'table_column_exists' 
    }).catch(e => {
      console.log('Function check failed, assuming functions need to be created:', e);
      return { data: false };
    });
    
    if (!columnFnExists) {
      await createColumnExistsFunction();
      await createAddColumnFunction();
      await createGetTableColumnsFunction();
    }
    
    // Check if the required columns exist
    let missingColumns = [];
    const requiredColumns = [
      { name: 'Rating', type: 'integer' },
      { name: 'entities', type: 'jsonb' },
      { name: 'Themes', type: 'text[]' }
    ];
    
    // Get all columns in the table
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'PoPs_Reviews' })
      .select();
    
    if (columnsError) {
      console.error('Error getting columns:', columnsError);
      
      // Try a direct approach to check each column
      for (const col of requiredColumns) {
        const { data: exists } = await supabase
          .rpc('table_column_exists', { 
            table_name: 'PoPs_Reviews', 
            column_name: col.name 
          })
          .single();
        
        if (!exists) {
          missingColumns.push(col);
        }
      }
    } else {
      // Convert columns to a map for easier lookup
      const columnMap = new Map();
      columns.forEach(col => columnMap.set(col.column_name, col.data_type));
      
      // Check which required columns are missing
      for (const col of requiredColumns) {
        if (!columnMap.has(col.name)) {
          missingColumns.push(col);
        }
      }
    }
    
    // Add any missing columns
    console.log('Missing columns:', missingColumns);
    
    for (const col of missingColumns) {
      console.log(`Adding missing column: ${col.name}`);
      try {
        const { data, error } = await supabase
          .rpc('add_column_if_not_exists', { 
            table_name: 'PoPs_Reviews', 
            column_name: col.name, 
            column_type: col.type 
          });
        
        if (error) {
          console.error(`Error adding column ${col.name}:`, error);
          
          // Try direct SQL execution as fallback
          await supabase.rpc('exec_sql', { 
            sql: `ALTER TABLE public."PoPs_Reviews" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}` 
          });
        } else {
          console.log(`Successfully added column ${col.name}`);
        }
      } catch (e) {
        console.error(`Error adding column ${col.name}:`, e);
      }
    }
    
    // Verify all required columns exist now
    let stillMissingColumns = [];
    for (const col of requiredColumns) {
      const { data: exists, error: checkError } = await supabase
        .rpc('table_column_exists', { 
          table_name: 'PoPs_Reviews', 
          column_name: col.name 
        })
        .single();
      
      if (checkError || !exists) {
        stillMissingColumns.push(col.name);
      }
    }
    
    if (stillMissingColumns.length > 0) {
      if (debug) {
        console.error(`After adding, still missing columns: ${stillMissingColumns.join(', ')}`);
        return {
          success: false,
          error: `Unable to add columns: ${stillMissingColumns.join(', ')}`,
          missingColumns: stillMissingColumns
        };
      } else {
        throw new Error(`Missing required columns: ${stillMissingColumns.join(', ')}`);
      }
    }
    
    console.log('Table structure verified successfully');
    return { success: true };
  } catch (error) {
    console.error('Table structure verification failed:', error);
    if (debug) {
      return { 
        success: false, 
        error: error.message || 'Unknown error during table verification'
      };
    } else {
      throw error;
    }
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

// Create helper function to check if a function exists
async function createFunctionExistsCheck() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.check_function_exists(function_name text)
        RETURNS boolean AS $$
        DECLARE
          func_exists boolean;
        BEGIN
          SELECT EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE proname = $1
          ) INTO func_exists;
          
          RETURN func_exists;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });
    
    if (error) {
      console.error('Error creating check_function_exists function:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error in createFunctionExistsCheck:', e);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create the function exists check function if needed
    await createFunctionExistsCheck();
    
    const { limit = 10, offset = 0, processAll = false, debug = false } = await req.json();
    
    console.log(`Request received with limit: ${limit}, offset: ${offset}, processAll: ${processAll}, debug: ${debug}`);
    
    // Verify table structure with debug mode if specified
    const structureResult = await verifyTableStructure(debug);
    if (debug && !structureResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: structureResult.error,
          details: structureResult
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
