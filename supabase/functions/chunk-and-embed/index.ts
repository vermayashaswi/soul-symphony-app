
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

/**
 * Split text into chunks of approximately the specified token size
 */
function splitTextIntoChunks(text: string, targetChunkSize: number = 300, overlapSize: number = 50): string[] {
  if (!text) return [];
  
  // Simple approximation: 1 token ≈ 4 characters for English text
  const charSizeApprox = targetChunkSize * 4;
  const overlapChars = overlapSize * 4;
  
  // If text is smaller than target size, return as single chunk
  if (text.length <= charSizeApprox) {
    return [text];
  }
  
  const chunks: string[] = [];
  let startPos = 0;
  
  while (startPos < text.length) {
    // Calculate end position for this chunk
    let endPos = startPos + charSizeApprox;
    
    // If we're at the end of the text
    if (endPos >= text.length) {
      chunks.push(text.slice(startPos));
      break;
    }
    
    // Try to find a natural break point (period, question mark, exclamation, or new line)
    const naturalBreakPoint = findNaturalBreakPoint(text, endPos);
    if (naturalBreakPoint > 0) {
      endPos = naturalBreakPoint;
    }
    
    // Add the chunk
    chunks.push(text.slice(startPos, endPos));
    
    // Move start position for next chunk, accounting for overlap
    startPos = endPos - overlapChars;
    
    // Ensure we're not creating an impossibly small chunk at the end
    if (text.length - startPos < overlapChars) {
      chunks.push(text.slice(startPos));
      break;
    }
  }
  
  return chunks;
}

/**
 * Find a natural break point in text (period, question mark, exclamation, new line)
 */
function findNaturalBreakPoint(text: string, position: number): number {
  // Look up to 100 characters back for a good break point
  const lookbackDistance = Math.min(100, position);
  const searchArea = text.substring(position - lookbackDistance, position);
  
  // Try to find sentence endings or paragraph breaks
  for (const breakChar of ['\n\n', '\n', '. ', '! ', '? ']) {
    const lastBreak = searchArea.lastIndexOf(breakChar);
    if (lastBreak !== -1) {
      // Return the absolute position in the original text
      // Add the length of the break character to include it in the chunk
      return (position - lookbackDistance) + lastBreak + breakChar.length;
    }
  }
  
  // If no good break point found, try to break on any punctuation or space
  for (const breakChar of [',', ';', ':', ' ']) {
    const lastBreak = searchArea.lastIndexOf(breakChar);
    if (lastBreak !== -1) {
      return (position - lookbackDistance) + lastBreak + 1;
    }
  }
  
  // If no good break point found at all, just return the original position
  return position;
}

/**
 * Generate embeddings for a single text chunk
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openAIApiKey) {
    console.error("OpenAI API key is missing");
    return null;
  }
  
  try {
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
      const errorText = await response.text();
      console.error('Error generating embedding:', errorText);
      return null;
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Exception in generateEmbedding:', error);
    return null;
  }
}

/**
 * Process a journal entry, splitting it into chunks and generating embeddings
 */
async function processJournalEntry(entryId: number): Promise<boolean> {
  console.log(`Processing journal entry ${entryId} for chunking...`);
  
  try {
    // Fetch the journal entry
    const { data: entry, error: entryError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", is_chunked')
      .eq('id', entryId)
      .single();
    
    if (entryError || !entry) {
      console.error(`Error fetching journal entry ${entryId}:`, entryError);
      return false;
    }
    
    // Skip already chunked entries
    if (entry.is_chunked) {
      console.log(`Journal entry ${entryId} is already chunked.`);
      return true;
    }
    
    // Get the text content
    const content = entry["refined text"] || entry["transcription text"] || "";
    if (!content.trim()) {
      console.error(`Journal entry ${entryId} has no content to chunk.`);
      return false;
    }
    
    // Split the content into chunks
    console.log(`Splitting entry ${entryId} into chunks...`);
    const chunks = splitTextIntoChunks(content);
    console.log(`Generated ${chunks.length} chunks for entry ${entryId}`);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for this chunk
      const embedding = await generateEmbedding(chunk);
      if (!embedding) {
        console.error(`Failed to generate embedding for chunk ${i} of entry ${entryId}`);
        continue;
      }
      
      // Store the chunk and its embedding
      const { error: insertError } = await supabase
        .from('journal_chunks')
        .insert({
          journal_entry_id: entryId,
          chunk_index: i,
          content: chunk,
          embedding: embedding,
          chunk_size: chunk.length,
          total_chunks: chunks.length
        });
      
      if (insertError) {
        console.error(`Error storing chunk ${i} of entry ${entryId}:`, insertError);
        return false;
      }
    }
    
    // Mark the entry as chunked
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update({
        is_chunked: true,
        chunks_count: chunks.length
      })
      .eq('id', entryId);
    
    if (updateError) {
      console.error(`Error marking entry ${entryId} as chunked:`, updateError);
      return false;
    }
    
    console.log(`Successfully chunked entry ${entryId} into ${chunks.length} chunks`);
    return true;
  } catch (error) {
    console.error(`Exception processing entry ${entryId}:`, error);
    return false;
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
        JSON.stringify({ error: 'Missing required parameter: entryId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the journal entry
    const success = await processJournalEntry(entryId);
    
    if (success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Journal entry ${entryId} processed successfully`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Failed to process journal entry ${entryId}`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error processing journal entry:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
