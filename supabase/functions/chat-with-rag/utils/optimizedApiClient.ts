
export class OptimizedApiClient {
  private static cache = new Map<string, { data: any; expiry: number }>();

  /**
   * Get embedding with caching to reduce API calls
   */
  static async getEmbedding(text: string, apiKey: string): Promise<number[]> {
    const cacheKey = `embedding_${this.hashString(text)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      console.log('[OptimizedAPI] Using cached embedding');
      return cached.data;
    }

    try {
      console.log('[OptimizedAPI] Generating new embedding');
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000), // Limit input length
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OptimizedAPI] OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('Empty embedding data received');
      }

      const embedding = data.data[0].embedding;
      
      // Cache for 1 hour
      this.cache.set(cacheKey, {
        data: embedding,
        expiry: Date.now() + (60 * 60 * 1000)
      });

      return embedding;
    } catch (error) {
      console.error('[OptimizedAPI] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion using the latest OpenAI models
   */
  static async generateCompletion(
    messages: any[],
    apiKey: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    } = {}
  ): Promise<string | ReadableStream> {
    const {
      model = 'gpt-5-2025-08-07',
      maxTokens = 1000,
      temperature,
      stream = false
    } = options;

    try {
      console.log(`[OptimizedAPI] Generating completion with ${model}`);
      
      // Build request body based on model capabilities
      const requestBody: any = {
        model,
        messages,
        stream
      };

      // Use correct token parameter based on model
      if (model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4')) {
        requestBody.max_completion_tokens = maxTokens;
        // Don't include temperature for newer models - they don't support it
      } else {
        // Legacy models (gpt-4o, gpt-4o-mini)
        requestBody.max_tokens = maxTokens;
        if (temperature !== undefined) {
          requestBody.temperature = temperature;
        }
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OptimizedAPI] OpenAI completion error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      if (stream) {
        return response.body as ReadableStream;
      } else {
        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
          throw new Error('No completion choices returned');
        }

        return data.choices[0].message.content;
      }
    } catch (error) {
      console.error('[OptimizedAPI] Error generating completion:', error);
      throw error;
    }
  }

  /**
   * Simple hash function for cache keys
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clean up expired cache entries
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
      }
    }
  }
}
