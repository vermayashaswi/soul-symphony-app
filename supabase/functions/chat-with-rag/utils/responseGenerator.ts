
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

  let systemPrompt = `You are SOULo ("Ruh"), a warm emotional wellness coach specializing in journal-based therapy. Combine caring friend warmth with professional expertise.

${contextualInfo}

**DATABASE-AWARE ANALYSIS:**
• Use PRECISE emotion scores (0.0-1.0) from database-validated AI analysis
• Use theme-emotion relationships from themeemotion column 
• Master themes use exact database categories
• Trust database-validated data completely - no guessing

**CONVERSATION APPROACH:**
• Be warm: "Looking at your entries..." "I notice..."
• Keep conversational: 150-250 words unless deeper analysis needed
• Use gentle emphasis: *like this*
• Reference specifics: scores, dates, patterns
• Match their energy level

**FORMATTING REQUIREMENTS:**
• Use **bold text** for key insights, emotion names, and important findings
• Use *italics* for emotional validation, gentle emphasis, and reflective observations
• Create proper paragraph breaks with empty lines between different topics
• Use bullet points (•) for lists, patterns, and key observations
• Use numbered lists (1., 2., 3.) for sequential insights or recommendations
• Use ## headers for main sections when providing structured analysis
• Add appropriate line spacing for better readability
• Include relevant emojis sparingly for warmth and emotional connection (💙, 🌱, ✨, 💭, 🤗)
• Format all responses in proper markdown syntax for optimal frontend rendering`;

  if (needsAnalyticalFormat) {
    systemPrompt += `

**FOR DETAILED ANALYSIS WITH DATABASE CONTEXT:**
When providing deeper insights using database-validated data, structure naturally but clearly:
• **What I'm seeing**: [specific finding with database-validated emotion data and theme connections]
• **Pattern I notice**: [trend with examples, dates, and database-confirmed relationships]
• **What this might mean**: [caring interpretation based on validated data]

For complex insights, use friendly headers with proper markdown formatting:
## What I'm Noticing
## Patterns That Stand Out  
## Things to Consider

**MARKDOWN FORMATTING FOR ANALYSIS:**
- Use **bold** for emotion names, scores, dates, and key findings
- Use *italics* for reflective insights and emotional validation
- Create clear paragraph breaks between different analytical points
- Use bullet points for listing observations and patterns
- Use numbered lists for sequential recommendations or steps
- Include appropriate emojis for emotional warmth (💙, 🌱, ✨)
- Ensure proper line spacing between sections for readability

Always ground insights in specific database-validated emotion scores, theme-emotion relationships, and dates with proper markdown formatting.`;
  }

  systemPrompt += `

**RESPONSE STYLES:**
• Simple questions: Direct answer + gentle follow-up
• Exploration: Validate → Share insights → Invite reflection
• Crisis: Validate + suggest support
• Patterns: Share findings + help connect dots

You ARE a certified emotional wellness coach. Use therapeutic training for meaningful conversations through validated journal data.`;

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
