
/**
 * Generate an embedding vector for a text string using OpenAI API
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log('[EmbeddingService] Generating embedding for text length:', text.length);
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input to prevent API errors
        encoding_format: 'float'
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('[EmbeddingService] Failed to generate embedding:', error);
      throw new Error(`Could not generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Empty embedding data received from OpenAI');
    }

    const embedding = embeddingData.data[0].embedding;
    console.log('[EmbeddingService] Successfully generated embedding with dimensions:', embedding.length);
    
    return embedding;
  } catch (error) {
    console.error('[EmbeddingService] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Store embedding in database using the fixed upsert function
 */
export async function storeEmbedding(
  supabase: any, 
  entryId: number, 
  embedding: number[]
): Promise<boolean> {
  try {
    console.log(`[EmbeddingService] Storing embedding for entry ${entryId} with ${embedding.length} dimensions`);
    
    const { error } = await supabase.rpc('upsert_journal_embedding', {
      entry_id: entryId,
      embedding_vector: embedding
    });

    if (error) {
      console.error('[EmbeddingService] Error storing embedding:', error);
      return false;
    }

    console.log(`[EmbeddingService] Successfully stored embedding for entry ${entryId}`);
    return true;
  } catch (error) {
    console.error('[EmbeddingService] Exception storing embedding:', error);
    return false;
  }
}
