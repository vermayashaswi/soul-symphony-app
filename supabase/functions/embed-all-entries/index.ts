
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function createEmbedding(text: string) {
  try {
    console.log('Creating embedding for text (first 50 chars):', text.substring(0, 50));
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002',
      }),
    });

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const embeddingData = await embeddingResponse.json();
    return embeddingData.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

async function processEntry(entry) {
  try {
    // Skip if no text content
    const textContent = entry["refined text"] || entry["transcription text"];
    if (!textContent) {
      return { id: entry.id, status: 'skipped', reason: 'No text content' };
    }
    
    // Check if entry already has embedding
    const { data: existingEmbedding } = await supabase
      .from('journal_embeddings')
      .select('id')
      .eq('journal_entry_id', entry.id)
      .single();
      
    // Create embedding
    const embedding = await createEmbedding(textContent);
    
    let result;
    if (existingEmbedding) {
      // Update existing
      result = await supabase
        .from('journal_embeddings')
        .update({ 
          content: textContent,
          embedding 
        })
        .eq('journal_entry_id', entry.id);
      
      console.log(`Updated embedding for entry ${entry.id}`);
    } else {
      // Insert new
      result = await supabase
        .from('journal_embeddings')
        .insert([{ 
          journal_entry_id: entry.id,
          content: textContent,
          embedding,
        }]);
      
      console.log(`Created new embedding for entry ${entry.id}`);
    }
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return { id: entry.id, status: 'success' };
  } catch (error) {
    console.error(`Error processing entry ${entry.id}:`, error);
    return { id: entry.id, status: 'error', error: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, entryId, processAll = false } = await req.json();
    
    console.log(`Processing request: userId=${userId}, entryId=${entryId}, processAll=${processAll}`);
    
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .order('created_at', { ascending: false });
      
    // Filter by user if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    // Filter by entry if provided and not processing all
    if (entryId && !processAll) {
      query = query.eq('id', entryId);
    }
    
    const { data: entries, error: entriesError } = await query;
    
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      throw new Error(`Database error: ${entriesError.message}`);
    }
    
    console.log(`Found ${entries.length} entries to process`);
    
    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No entries found to process",
          totalProcessed: 0,
          successCount: 0,
          errorCount: 0,
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Process entries
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(entries.length/batchSize)}`);
      
      // Process this batch concurrently
      const batchPromises = batch.map(entry => processEntry(entry));
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Count successes and errors
      for (const result of batchResults) {
        if (result.status === 'success') {
          successCount++;
        } else if (result.status === 'error') {
          errorCount++;
        }
      }
      
      // Add a short delay between batches to avoid rate limits
      if (i + batchSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Batch embedding complete. Success: ${successCount}, Errors: ${errorCount}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        totalProcessed: entries.length,
        successCount,
        errorCount,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error("Error in batch embedding function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false,
        message: "Error occurred during batch embedding process"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
