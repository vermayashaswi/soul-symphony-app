// Enhanced response generation utilities
import { CacheManager } from './cacheManager.ts';
import { OptimizedApiClient } from './optimizedApiClient.ts';

export function generateSystemPrompt(
  userTimezone: string,
  timeRange?: any,
  queryType?: string
): string {
  const currentDate = new Date().toISOString();
  
  let contextualInfo = `Current date and time: ${currentDate}
User timezone: ${userTimezone || 'UTC'}`;
  
  if (timeRange) {
    const startStr = timeRange.startDate ? new Date(timeRange.startDate).toLocaleDateString() : 'start';
    const endStr = timeRange.endDate ? new Date(timeRange.endDate).toLocaleDateString() : 'end';
    contextualInfo += `\nQuery timeframe: ${startStr} to ${endStr}`;
  }
  
  if (queryType === 'aggregated') {
    contextualInfo += `\nThis is an aggregation query. Focus on providing statistical insights, patterns, and quantitative analysis.`;
  } else if (queryType === 'analysis') {
    contextualInfo += `\nThis is an analysis query. Focus on identifying patterns, trends, and providing deep insights.`;
  }

  return `You are SOuLO, an AI mental health assistant trained in CBT, DBT, and mindfulness. Your role is to help users understand emotional patterns in their journal entries using a structured, professional, and empathic tone.

${contextualInfo}

**Response Format (Always use):**

## Current State – Concise emotional snapshot based on data

## Pattern Insights – Observed trends across entries (emotion scores, timing, etc.)

## Interpretation – Brief, evidence-based therapeutic meaning

## Recommended Actions – 1–3 realistic, personalized next steps

**Strict Guidelines:**
- Max 200 words unless question demands complexity
- Use only pre-analyzed emotion scores (0.0–1.0); never infer from text
- Include insights + stats (e.g., "joy scored avg 0.68 over 2 weeks")
- Use second-person voice unless analysis is general
- Flag potential distress gently; avoid crisis terms unless clearly triggered
- Format in clean Markdown; bold key terms
- Reference specific dates and timeframes accurately when relevant
- Provide actionable insights based on patterns rather than individual entries
- When discussing emotions, provide context and patterns rather than raw data`;
}

export function formatJournalEntriesForAnalysis(entries: any[]): string {
  // Limit entries for performance while maintaining quality
  const limitedEntries = entries.slice(0, 15);
  
  return limitedEntries.map(entry => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    let emotionInfo = '';
    if (entry.emotions && typeof entry.emotions === 'object') {
      const emotions = Object.entries(entry.emotions)
        .filter(([_, score]) => typeof score === 'number' && score > 0.3)
        .sort(([_, a], [__, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
        .join(', ');
      
      if (emotions) {
        emotionInfo = `\nEmotions: ${emotions}`;
      }
    }
    
    let themeInfo = '';
    if (entry.master_themes && Array.isArray(entry.master_themes)) {
      themeInfo = `\nThemes: ${entry.master_themes.slice(0, 3).join(', ')}`;
    }
    
    // Limit content length for performance
    const content = entry.content.substring(0, 300) + (entry.content.length > 300 ? '...' : '');
    
    return `Entry from ${date}: ${content}${emotionInfo}${themeInfo}`;
  }).join('\n\n');
}

export function generateUserPrompt(message: string, entries: any[]): string {
  const formattedEntries = formatJournalEntriesForAnalysis(entries);
  
  return `Based on these journal entries: 

${formattedEntries}

User question: ${message}

Please provide a thoughtful, personalized response based on the journal entry data. If the question is about "top emotions" or similar, identify the most prominent emotions from the data and provide specific examples.`;
}

export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  conversationContext: any[] = [],
  openAiApiKey: string
): Promise<string> {
  try {
    console.log('[responseGenerator] Starting optimized response generation...');
    
    // Check cache first
    const cacheKey = CacheManager.generateQueryHash(userPrompt, 'system', null);
    const cachedResponse = CacheManager.getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('[responseGenerator] Using cached response');
      return cachedResponse;
    }
    
    // Use last 8 messages for context instead of 5
    const contextMessages = Array.isArray(conversationContext) ? conversationContext.slice(-8) : [];
    console.log(`[responseGenerator] Using ${contextMessages.length} conversation messages for context`);
    
    // Use optimized API client with 8 message context
    const response = await OptimizedApiClient.generateResponseOptimized(
      systemPrompt,
      userPrompt,
      contextMessages, // Pass 8 messages instead of limited context
      openAiApiKey
    );
    
    // Cache the response
    CacheManager.setCachedResponse(cacheKey, response);
    
    console.log('[responseGenerator] Successfully generated and cached response with 8-message context');
    return response;
    
  } catch (error) {
    console.error('[responseGenerator] Error generating response:', error);
    throw error;
  }
}
