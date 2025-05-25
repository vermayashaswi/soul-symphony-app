
import { CacheManager } from './cacheManager.ts';

// Optimized OpenAI API client with batching and caching
export class OptimizedApiClient {
  private static pendingEmbeddings = new Map<string, Promise<number[]>>();
  
  static async getEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for embedding generation');
    }
    
    // Check cache first
    const cached = CacheManager.getCachedEmbedding(text);
    if (cached) {
      console.log('[OptimizedApiClient] Using cached embedding');
      return cached;
    }

    // Check if request is already pending
    const normalizedText = text.toLowerCase().trim();
    if (this.pendingEmbeddings.has(normalizedText)) {
      console.log('[OptimizedApiClient] Reusing pending embedding request');
      return await this.pendingEmbeddings.get(normalizedText)!;
    }

    // Create new request
    const embeddingPromise = this.fetchEmbedding(text, openaiApiKey);
    this.pendingEmbeddings.set(normalizedText, embeddingPromise);

    try {
      const embedding = await embeddingPromise;
      CacheManager.setCachedEmbedding(text, embedding);
      return embedding;
    } finally {
      this.pendingEmbeddings.delete(normalizedText);
    }
  }

  private static async fetchEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.substring(0, 8000), // Limit input length
        model: 'text-embedding-ada-002',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  static optimizeSystemPrompt(originalPrompt: string): string {
    // Remove redundant whitespace and optimize token usage
    return originalPrompt
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  static async generateResponseOptimized(
    systemPrompt: string,
    userPrompt: string,
    conversationContext: any[],
    openaiApiKey: string
  ): Promise<string> {
    // Input validation
    if (!systemPrompt || !userPrompt) {
      throw new Error('Invalid prompt inputs for response generation');
    }
    
    const optimizedSystemPrompt = this.optimizeSystemPrompt(systemPrompt);
    
    // Limit conversation context to prevent token overflow
    const limitedContext = conversationContext.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content ? msg.content.substring(0, 1000) : '' // Limit message length and handle null content
    }));

    const messages = [
      { role: 'system', content: optimizedSystemPrompt },
      ...limitedContext,
      { role: 'user', content: userPrompt.substring(0, 4000) } // Limit user prompt
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Unable to generate response.';
    } catch (error) {
      console.error('[OptimizedApiClient] Error generating response:', error);
      throw error;
    }
  }
}
