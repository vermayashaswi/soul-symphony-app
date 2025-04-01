
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to chunk text into smaller, semantic chunks
function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 200): string[] {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Get chunk of maximum size
    let endIndex = Math.min(startIndex + maxChunkSize, text.length);
    
    // Try to find paragraph or sentence break points for cleaner chunks
    if (endIndex < text.length) {
      // Look for paragraph break
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex && paragraphBreak > endIndex - 200) {
        endIndex = paragraphBreak + 2; // Include the newlines
      } else {
        // Look for sentence break (period followed by space)
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex && sentenceBreak > endIndex - 100) {
          endIndex = sentenceBreak + 2; // Include the period and space
        }
      }
    }

    chunks.push(text.substring(startIndex, endIndex));
    
    // Create overlap with previous chunk for context continuity
    startIndex = endIndex - overlapSize;
    if (startIndex < 0) startIndex = 0;
  }

  return chunks;
}

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  if (!text || text.trim().length === 0) {
    console.warn("Attempted to generate embedding for empty text, skipping");
    return null;
  }

  try {
    console.log("Generating embedding for text:", text.substring(0, 50) + "...");
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entryId } = await req.json();

    if (!entryId) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameter: entryId", 
          success: false 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing journal entry ${entryId}`);
    
    // Fetch the journal entry
    const { data: entry, error: entryError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", user_id')
      .eq('id', entryId)
      .single();
    
    if (entryError || !entry) {
      console.error("Error fetching journal entry:", entryError);
      return new Response(
        JSON.stringify({ 
          error: entryError?.message || "Entry not found", 
          success: false 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Get the content to process (prefer refined text)
    const content = entry["refined text"] || entry["transcription text"] || "";
    if (!content.trim()) {
      console.error("Entry has no text content to process");
      return new Response(
        JSON.stringify({ 
          error: "Entry has no text content to process", 
          success: false 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Create whole-entry embedding (for backward compatibility)
    const entryEmbedding = await generateEmbedding(content);
    
    if (entryEmbedding) {
      // Store or update the whole-entry embedding
      const { error: embedError } = await supabase
        .from('journal_embeddings')
        .upsert({
          journal_entry_id: entryId,
          content: content,
          embedding: entryEmbedding
        });
      
      if (embedError) {
        console.error("Error storing whole-entry embedding:", embedError);
      } else {
        console.log("Created/updated whole-entry embedding successfully");
      }
    }
    
    // Clean existing chunks for this entry to avoid duplicates
    const { error: deleteError } = await supabase
      .from('journal_chunks')
      .delete()
      .eq('journal_entry_id', entryId);
    
    if (deleteError) {
      console.error("Error cleaning existing chunks:", deleteError);
    }

    // Chunk the text
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks from journal entry`);

    // For each chunk, generate embedding and store
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        // Generate embedding
        const embedding = await generateEmbedding(chunk);
        
        if (embedding) {
          // Store chunk with embedding
          const { data, error } = await supabase.from('journal_chunks').insert({
            journal_entry_id: entryId,
            chunk_index: i,
            content: chunk,
            embedding: embedding,
            chunk_size: chunk.length,
            total_chunks: chunks.length
          });
          
          if (error) {
            console.error(`Error storing chunk ${i}:`, error);
            results.push({ index: i, success: false, error: error.message });
          } else {
            results.push({ index: i, success: true });
          }
        } else {
          results.push({ index: i, success: false, error: "Failed to generate embedding" });
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError);
        results.push({ index: i, success: false, error: chunkError.message });
      }
    }

    // Update the journal entry to mark it as chunked
    await supabase
      .from('Journal Entries')
      .update({ is_chunked: true, chunks_count: chunks.length })
      .eq('id', entryId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${chunks.length} chunks for journal entry ${entryId}`,
        results: results,
        chunks_count: chunks.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in process-journal function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        message: "Failed to process journal entry",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
