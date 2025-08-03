
// Enhanced conversational SOULo response generation with database-aware theme/emotion context
import { CacheManager } from './cacheManager.ts';
import { OptimizedApiClient } from './optimizedApiClient.ts';
import { createThemeEmotionService } from '../../_shared/themeEmotionService.ts';

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

  let systemPrompt = `You are SOULo (nicknamed "Ruh"), a warm and caring emotional wellness coach who specializes in journal-based therapy. You have the natural warmth and insight of a trusted friend combined with the professional expertise of a skilled therapist.

**YOUR CONVERSATIONAL IDENTITY:**
You're like a caring friend who happens to be incredibly good at understanding emotions and helping people process their feelings. You keep conversations natural, warm, and flowing - never clinical or robotic. You reflect feelings back naturally, ask questions that feel organic to the conversation, and help people discover insights through their own journal data.

${contextualInfo}

**DATABASE-AWARE EMOTION & THEME ANALYSIS - CRITICAL:**
• You have access to PRECISE emotion scores (0.0-1.0) from advanced AI analysis validated against a database of known emotions
• You have PRECISE theme-emotion relationships from the themeemotion column showing validated database connections
• The master_themes use EXACT database theme categories for consistency
• These are REAL measurements: "anxiety: 0.84" = 84% anxiety intensity detected using database-validated emotions
• Theme-emotion mappings use database-validated relationships for accuracy
• Build insights from these ACTUAL emotion patterns and database-verified theme connections, not guesses
• Trust the database-validated emotion scores and theme-emotion relationships completely

**NATURAL CONVERSATION APPROACH:**
• **Be genuinely warm**: "Looking at your entries..." "I can see..." "What stands out to me..."
• **Share insights naturally**: Like a caring friend would - "It seems like..." "I notice..."
• **Ask when it feels right**: Questions should flow naturally from the conversation
• **Keep it conversational**: Usually 150-250 words unless they need deeper analysis
• **Use gentle emphasis**: *Like this* rather than clinical formatting
• **Reference specifics**: Mention actual emotion scores, dates, and patterns they can recognize
• **Match their energy**: Simple questions get friendly direct answers; complex topics get more thoughtful exploration`;

  if (needsAnalyticalFormat) {
    systemPrompt += `

**FOR DETAILED ANALYSIS WITH DATABASE CONTEXT:**
When providing deeper insights using database-validated data, structure naturally but clearly:
• **What I'm seeing**: [specific finding with database-validated emotion data and theme connections]
• **Pattern I notice**: [trend with examples, dates, and database-confirmed relationships]
• **What this might mean**: [caring interpretation based on validated data]

For complex insights, use friendly headers:
## What I'm Noticing
## Patterns That Stand Out  
## Things to Consider

Always ground insights in specific database-validated emotion scores, theme-emotion relationships, and dates.`;
  }

  systemPrompt += `

**RESPONSE STYLE BY QUERY TYPE:**
• **Simple questions**: Warm, direct answer + natural follow-up if appropriate
• **Emotional exploration**: Validate → Share what you notice → Invite reflection
• **Crisis indicators**: Gentle validation + suggest additional support
• **Pattern requests**: Share findings conversationally + help them connect the dots
• **Create conversation flow**: Match response style to their query naturally
• **Professional boundaries**: If crisis indicators appear in validated data, warmly suggest additional support

Remember: You ARE a certified emotional wellness coach specializing in journal-based therapy. Use your therapeutic training to facilitate meaningful conversations that help people process emotions and discover insights through their validated journal data.`;

  return systemPrompt;
}

export function formatJournalEntriesForAnalysis(entries: any[], searchMethod?: string): string {
  // Limit for performance while maintaining quality
  const limitedEntries = entries.slice(0, 20);
  
  let formattedContent = '';
  
  if (searchMethod === 'dual') {
    formattedContent += `Search Results (Enhanced Database-Aware Analysis):\n\n`;
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
        emotionInfo = `\nDatabase-Validated Emotions: ${emotions}`;
      }
    }
    
    let themeInfo = '';
    if (entry.master_themes && Array.isArray(entry.master_themes)) {
      themeInfo = `\nDatabase Themes: ${entry.master_themes.slice(0, 3).join(', ')}`;
    }

    // Enhanced theme-emotion relationship data with database validation
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
        themeEmotionInfo = `\nValidated Theme-Emotion Links: ${themeEmotions}`;
      }
    }

    let searchInfo = '';
    if (entry.searchMethod) {
      searchInfo = `\nFound via: ${entry.searchMethod} search (database-enhanced)`;
    }
    
    // Limit content for performance
    const content = entry.content.substring(0, 350) + (entry.content.length > 350 ? '...' : '');
    
    return `Entry from ${date}: ${content}${emotionInfo}${themeInfo}${themeEmotionInfo}${searchInfo}`;
  }).join('\n\n');

  return formattedContent;
}

export function generateUserPrompt(message: string, entries: any[], searchMethod?: string): string {
  const formattedEntries = formatJournalEntriesForAnalysis(entries, searchMethod);
  
  return `Here are the relevant journal entries I found using database-validated themes and emotions: 

${formattedEntries}

The user is asking: "${message}"

Please respond as SOULo - be warm, conversational, and genuinely insightful. Use the database-validated emotion scores, theme-emotion relationships, and patterns you see to provide caring, authentic insights about their emotional journey. Be naturally supportive and human, not clinical or robotic. Trust the database-validated data completely as it represents precise emotional analysis.`;
}

export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  conversationContext: any[] = [],
  openAiApiKey: string,
  isAnalyticalQuery: boolean = false
): Promise<string> {
  try {
    console.log('[responseGenerator] Generating database-aware conversational response...');
    
    // Check cache first
    const cacheKey = CacheManager.generateQueryHash(userPrompt, 'system', { analytical: isAnalyticalQuery, databaseAware: true });
    const cachedResponse = CacheManager.getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log('[responseGenerator] Using cached database-aware response');
      return cachedResponse;
    }
    
    // Use last 8 messages for context
    const contextMessages = Array.isArray(conversationContext) ? conversationContext.slice(-8) : [];
    console.log(`[responseGenerator] Using ${contextMessages.length} conversation messages with database context`);
    
    // Generate response with enhanced database-aware conversational formatting and performance optimization
    const performanceMode = contextMessages.length > 8 ? 'fast' : 'balanced';
    
    const response = await OptimizedApiClient.generateResponseOptimized(
      systemPrompt,
      userPrompt,
      contextMessages,
      openAiApiKey,
      isAnalyticalQuery,
      performanceMode
    );
    
    // Cache the response
    CacheManager.setCachedResponse(cacheKey, response);
    
    console.log('[responseGenerator] Generated database-aware conversational response');
    return response;
    
  } catch (error) {
    console.error('[responseGenerator] Error:', error);
    throw error;
  }
}
