
/**
 * Generate an embedding vector for a text string using OpenAI API
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding:', error);
      throw new Error('Could not generate embedding for the message');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Empty embedding data received from OpenAI');
    }

    return embeddingData.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
