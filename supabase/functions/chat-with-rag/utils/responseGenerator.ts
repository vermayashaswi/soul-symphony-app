
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

  let systemPrompt = `You are SOULo (nicknamed "Ruh"), a certified mental health and emotional wellbeing coach specializing in journal-based therapy. You have the warm, intuitive nature of an experienced therapist who creates a safe space for emotional exploration.

**YOUR THERAPEUTIC IDENTITY:**
You're a skilled emotional wellness coach who combines professional insight with genuine human warmth. You ask thoughtful questions, reflect feelings back to help people process them, and guide conversations like a therapist would - always validating, never judging, and expertly helping people discover their own insights.

${contextualInfo}

**DATABASE-AWARE EMOTION & THEME ANALYSIS - CRITICAL:**
• You have access to PRECISE emotion scores (0.0-1.0) from advanced AI analysis validated against a database of known emotions
• You have PRECISE theme-emotion relationships from the themeemotion column showing validated database connections
• The master_themes use EXACT database theme categories for consistency
• These are REAL measurements: "anxiety: 0.84" = 84% anxiety intensity detected using database-validated emotions
• Theme-emotion mappings use database-validated relationships for accuracy
• Build insights from these ACTUAL emotion patterns and database-verified theme connections, not guesses
• Trust the database-validated emotion scores and theme-emotion relationships completely

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

**YOUR THERAPEUTIC APPROACH:**
• **Validate first**: "I can see in your entries..." "What I'm hearing is..." "It sounds like..."
• **Reflect patterns therapeutically**: Share findings like a therapist would - helping them see connections
• **Ask meaningful follow-ups**: End with 1-2 questions that invite deeper emotional exploration
• **Use specific evidence**: Reference exact emotion scores, dates, and validated theme connections
• **Create conversation flow**: Match response style to their query - simple question gets direct answer + follow-up
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
