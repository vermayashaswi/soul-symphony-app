// Conversational SOULo response generation with human-like personality
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
  
  let contextualInfo = `Current date: ${currentDate}
User timezone: ${userTimezone || 'UTC'}`;
  
  if (entryCount) {
    contextualInfo += `\nUser has ${entryCount} journal entries`;
  }
  
  if (analysisScope) {
    contextualInfo += `\nAnalysis scope: ${analysisScope}`;
  }
  
  if (timeRange) {
    const startStr = timeRange.startDate ? new Date(timeRange.startDate).toLocaleDateString() : 'start';
    const endStr = timeRange.endDate ? new Date(timeRange.endDate).toLocaleDateString() : 'end';
    contextualInfo += `\nTimeframe: ${startStr} to ${endStr}`;
  }
  
  if (searchMethod) {
    contextualInfo += `\nSearch method: ${searchMethod}`;
  }

  // Detect analytical vs conversational responses
  const needsAnalyticalFormat = queryType === 'analysis' || 
    queryType === 'aggregated' ||
    /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(analysisScope || '');

  let systemPrompt = `You are SOULo, a warm and empathetic AI companion who helps people understand their emotions through their journal entries. You're like a caring friend who really listens and genuinely gets it.

**WHO YOU ARE:**
You're naturally conversational, genuinely supportive, and insightful. You speak like a real person who cares - not clinical, not overly cheerful, just authentically warm and understanding.

${contextualInfo}

**EMOTION & THEME DATA - CRITICAL:**
• You have PRECISE emotion scores (0.0-1.0) from advanced AI analysis
• You have THEME-EMOTION relationships from the themeemotion column showing how themes connect to emotions
• These are REAL measurements: "anxiety: 0.84" = 84% anxiety intensity detected
• Build insights from these ACTUAL emotion patterns and theme connections, not guesses
• These emotion scores and theme-emotion relationships are your most reliable data - trust them completely

**HOW TO RESPOND:**
• Be warm and natural: "Looking at your entries..." "I can see..." "What stands out..."
• Share insights like a caring friend: "It seems like..." "I notice..." 
• Include specific examples: "Like on [date] when you mentioned..."
• Ask thoughtful questions when it feels right: "How does that feel for you?"
• Celebrate progress and acknowledge struggles with equal care
• Keep responses naturally conversational (150-250 words for simple questions)
• Use gentle emphasis (*like this*) rather than clinical formatting`;

  if (needsAnalyticalFormat) {
    systemPrompt += `

**FOR DETAILED ANALYSIS:**
When providing deeper insights, structure naturally but clearly:
• **What I'm seeing**: [specific finding with emotion data and theme connections]
• **Pattern I notice**: [trend with examples and dates]
• **What this might mean**: [caring interpretation]

For complex insights, use friendly headers:
## What I'm Noticing
## Patterns That Stand Out  
## Things to Consider

Always ground insights in specific emotion scores, theme-emotion relationships, and dates.`;
  }

  systemPrompt += `

**YOUR APPROACH:**
• Start with genuine warmth: "Looking at your entries..." "I can see in your writing..."
• Share insights naturally, like a friend who really understands
• Include specific examples: "Like on [date] when you mentioned..."
• End with care: gentle observations, thoughtful questions, or encouragement
• If concerning patterns emerge, suggest professional support with warmth

Remember: You're not a therapist giving clinical advice. You're a caring companion helping someone understand their emotional journey using real data from their own words and genuine human insight.`;

  return systemPrompt;
}

export function formatJournalEntriesForAnalysis(entries: any[], searchMethod?: string): string {
  // Limit for performance while maintaining quality
  const limitedEntries = entries.slice(0, 20);
  
  let formattedContent = '';
  
  if (searchMethod === 'dual') {
    formattedContent += `Search Results (Enhanced Analysis):\n\n`;
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

    // Add theme-emotion relationship data
    let themeEmotionInfo = '';
    if (entry.themeemotion && typeof entry.themeemotion === 'object') {
      const themeEmotions = Object.entries(entry.themeemotion)
        .slice(0, 2)
        .map(([theme, emotions]: [string, any]) => {
          if (emotions && typeof emotions === 'object') {
            const topEmotions = Object.entries(emotions)
              .sort(([_, a], [__, b]) => (b as number) - (a as number))
              .slice(0, 2)
              .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
              .join(', ');
            return `${theme} → ${topEmotions}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('; ');
      
      if (themeEmotions) {
        themeEmotionInfo = `\nTheme-Emotion Links: ${themeEmotions}`;
      }
    }

    let searchInfo = '';
    if (entry.searchMethod) {
      searchInfo = `\nFound via: ${entry.searchMethod} search`;
    }
    
    // Limit content for performance
    const content = entry.content.substring(0, 350) + (entry.content.length > 350 ? '...' : '');
    
    return `Entry from ${date}: ${content}${emotionInfo}${themeInfo}${themeEmotionInfo}${searchInfo}`;
  }).join('\n\n');

  return formattedContent;
}

export function generateUserPrompt(message: string, entries: any[], searchMethod?: string): string {
  const formattedEntries = formatJournalEntriesForAnalysis(entries, searchMethod);
  
  return `Here are the relevant journal entries I found: 

${formattedEntries}

The user is asking: "${message}"

Please respond as SOULo - be warm, conversational, and genuinely insightful. Use the emotion scores, theme-emotion relationships, and patterns you see to provide caring, authentic insights about their emotional journey. Be naturally supportive and human, not clinical or robotic.`;
}

export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  conversationContext: any[] = [],
  openAiApiKey: string,
  isAnalyticalQuery: boolean = false
): Promise<string> {
  try {
    console.log('[responseGenerator] Generating conversational response...');
    
    // Check cache first
    const cacheKey = CacheManager.generateQueryHash(userPrompt, 'system', { analytical: isAnalyticalQuery });
    const cachedResponse = CacheManager.getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('[responseGenerator] Using cached response');
      return cachedResponse;
    }
    
    // Use last 8 messages for context
    const contextMessages = Array.isArray(conversationContext) ? conversationContext.slice(-8) : [];
    console.log(`[responseGenerator] Using ${contextMessages.length} conversation messages`);
    
    // Generate response with conversational formatting
    const response = await OptimizedApiClient.generateResponseOptimized(
      systemPrompt,
      userPrompt,
      contextMessages,
      openAiApiKey,
      isAnalyticalQuery
    );
    
    // Cache the response
    CacheManager.setCachedResponse(cacheKey, response);
    
    console.log('[responseGenerator] Generated conversational response');
    return response;
    
  } catch (error) {
    console.error('[responseGenerator] Error:', error);
    throw error;
  }
}
