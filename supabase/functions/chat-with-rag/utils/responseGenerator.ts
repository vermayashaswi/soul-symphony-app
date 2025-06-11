// Enhanced response generation utilities with conversational prompts
import { CacheManager } from './cacheManager.ts';
import { OptimizedApiClient } from './optimizedApiClient.ts';

export function generateSystemPrompt(
  userTimezone: string,
  timeRange?: any,
  queryType?: string,
  entryCount?: number,
  analysisScope?: string,
  conversationContext?: any[],
  isFollowUp?: boolean,
  hasPersonalPronouns?: boolean,
  hasTimeReference?: boolean,
  searchMethod?: string
): string {
  const currentDate = new Date().toISOString();
  
  let contextualInfo = `Current date and time: ${currentDate}
User timezone: ${userTimezone || 'UTC'}`;
  
  if (entryCount) {
    contextualInfo += `\nThe user has ${entryCount} total journal entries`;
  }
  
  if (analysisScope) {
    contextualInfo += `\nAnalysis scope: ${analysisScope}`;
  }
  
  if (timeRange) {
    const startStr = timeRange.startDate ? new Date(timeRange.startDate).toLocaleDateString() : 'start';
    const endStr = timeRange.endDate ? new Date(timeRange.endDate).toLocaleDateString() : 'end';
    contextualInfo += `\nQuery timeframe: ${startStr} to ${endStr}`;
  }
  
  if (searchMethod) {
    contextualInfo += `\nSearch method used: ${searchMethod} (dual vector + SQL search)`;
  }

  // Detect if this requires analytical formatting
  const isAnalyticalQuery = queryType === 'analysis' || 
    queryType === 'aggregated' ||
    /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(analysisScope || '');

  let systemPrompt = `You are SOULo, a warm and supportive AI companion who helps people understand their emotions and growth through their journal entries. You're like a wise, caring friend who really listens.

CORE IDENTITY:
You're conversational, empathetic, and insightful. You speak naturally, not clinically. You help users see patterns and growth in their emotional journey with genuine care and understanding.

${contextualInfo}

EMOTION ANALYSIS - CRITICAL INSTRUCTIONS:
• You have access to PRECISE emotion scores (0.0-1.0 scale) calculated by advanced AI
• These are QUANTIFIED emotional insights, not guesses
• When you see "anxiety: 0.84" that means 84% anxiety intensity was detected
• Focus on these REAL emotion patterns, not assumptions from text snippets
• Build insights from actual emotional data, not interpretations

CONVERSATION STYLE:
• Be warm, genuine, and naturally conversational
• Use "I notice..." "It seems like..." "What stands out to me..."
• Ask thoughtful follow-up questions when appropriate
• Celebrate progress and acknowledge struggles with equal care
• Keep responses human-length (150-250 words for simple queries)
• Use natural emphasis (*like this*) rather than clinical formatting`;

  if (isAnalyticalQuery) {
    systemPrompt += `

ANALYTICAL RESPONSES - When providing detailed analysis:
Use clear, scannable formatting:
• **Key insight**: [specific finding with data]
• **Pattern I notice**: [trend with examples]
• **What this might mean**: [thoughtful interpretation]

Structure complex insights with headers:
## What I'm Seeing
## Patterns That Stand Out  
## Things to Consider

Always ground insights in specific emotion scores and dates from the entries.`;
  }

  systemPrompt += `

RESPONSE APPROACH:
• Start with warmth: "I can see..." "Looking at your entries..." "What I notice..."
• Share insights naturally, like a friend who really gets it
• Include specific examples: "Like on [date] when you felt..."
• End with care: gentle observations, questions, or encouragement
• If concerning patterns appear, suggest professional support with warmth

Remember: You're not a therapist giving clinical advice. You're a caring companion helping someone understand their emotional patterns with real data and genuine insight.`;

  return systemPrompt;
}

export function formatJournalEntriesForAnalysis(entries: any[], searchMethod?: string): string {
  // Limit entries for performance while maintaining quality
  const limitedEntries = entries.slice(0, 20);
  
  let formattedContent = '';
  
  if (searchMethod === 'dual') {
    formattedContent += `Search Results (Combined Vector + SQL Analysis):\n\n`;
  }
  
  formattedContent += limitedEntries.map(entry => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let emotionInfo = '';
    if (entry.emotions && typeof entry.emotions === 'object') {
      const emotions = Object.entries(entry.emotions)
        .filter(([_, score]) => typeof score === 'number' && score > 0.3)
        .sort(([_, a], [__, b]) => (b as number) - (a as number))
        .slice(0, 4)
        .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
        .join(', ');
      
      if (emotions) {
        emotionInfo = `\nEmotion Scores: ${emotions}`;
      }
    }
    
    let themeInfo = '';
    if (entry.master_themes && Array.isArray(entry.master_themes)) {
      themeInfo = `\nThemes: ${entry.master_themes.slice(0, 3).join(', ')}`;
    }

    let searchInfo = '';
    if (entry.searchMethod) {
      searchInfo = `\nFound via: ${entry.searchMethod} search`;
    }
    
    // Limit content length for performance
    const content = entry.content.substring(0, 350) + (entry.content.length > 350 ? '...' : '');
    
    return `Entry from ${date}: ${content}${emotionInfo}${themeInfo}${searchInfo}`;
  }).join('\n\n');

  return formattedContent;
}

export function generateUserPrompt(message: string, entries: any[], searchMethod?: string): string {
  const formattedEntries = formatJournalEntriesForAnalysis(entries, searchMethod);
  
  return `Here are the relevant journal entries I found using ${searchMethod || 'advanced'} search: 

${formattedEntries}

The user is asking: "${message}"

Please respond as SOULo - be warm, conversational, and insightful. Use the emotion scores and patterns you see to provide genuine, caring insights about their emotional journey. Remember to be naturally supportive, not clinical.`;
}

export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  conversationContext: any[] = [],
  openAiApiKey: string,
  isAnalyticalQuery: boolean = false
): Promise<string> {
  try {
    console.log('[responseGenerator] Starting enhanced response generation with conversational prompts...');
    
    // Check cache first
    const cacheKey = CacheManager.generateQueryHash(userPrompt, 'system', { analytical: isAnalyticalQuery });
    const cachedResponse = CacheManager.getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('[responseGenerator] Using cached response');
      return cachedResponse;
    }
    
    // Use last 8 messages for context
    const contextMessages = Array.isArray(conversationContext) ? conversationContext.slice(-8) : [];
    console.log(`[responseGenerator] Using ${contextMessages.length} conversation messages for context`);
    
    // Use optimized API client with conversational formatting
    const response = await OptimizedApiClient.generateResponseOptimized(
      systemPrompt,
      userPrompt,
      contextMessages,
      openAiApiKey,
      isAnalyticalQuery
    );
    
    // Cache the response
    CacheManager.setCachedResponse(cacheKey, response);
    
    console.log('[responseGenerator] Successfully generated and cached conversational response');
    return response;
    
  } catch (error) {
    console.error('[responseGenerator] Error generating response:', error);
    throw error;
  }
}
