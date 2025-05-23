
// Enhanced response generation utilities
export function generateSystemPrompt(
  userTimezone: string,
  timeRange?: any,
  queryType?: string
): string {
  const basePrompt = `You are a supportive mental health assistant analyzing journal entries from the SOULo voice journaling app.

Current date and time: ${new Date().toISOString()}
User timezone: ${userTimezone || 'UTC'}`;

  let contextualPrompt = basePrompt;
  
  if (timeRange) {
    const startStr = timeRange.startDate ? new Date(timeRange.startDate).toLocaleDateString() : 'start';
    const endStr = timeRange.endDate ? new Date(timeRange.endDate).toLocaleDateString() : 'end';
    contextualPrompt += `\nQuery timeframe: ${startStr} to ${endStr}`;
  }
  
  if (queryType === 'aggregated') {
    contextualPrompt += `\n\nThis is an aggregation query. Focus on providing statistical insights, patterns, and quantitative analysis.`;
  } else if (queryType === 'analysis') {
    contextualPrompt += `\n\nThis is an analysis query. Focus on identifying patterns, trends, and providing deep insights.`;
  }
  
  contextualPrompt += `

Your role is to:
1. Analyze journal entries with empathy and understanding
2. Provide personalized insights based on patterns and emotions
3. Offer constructive mental health guidance
4. Reference specific dates and timeframes accurately when relevant
5. Be supportive while maintaining appropriate boundaries

Guidelines:
- Always be encouraging, non-judgmental, and focused on the user's wellbeing
- When discussing emotions, provide context and patterns rather than just raw data
- For time-based queries, clearly reference the specific timeframe
- Provide actionable insights when appropriate
- If asking about patterns or trends, explain what the data shows and what it might mean
- For "top emotions" queries, identify the most prominent emotions with specific examples from the entries`;

  return contextualPrompt;
}

export function formatJournalEntriesForAnalysis(entries: any[]): string {
  return entries.map(entry => {
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
      themeInfo = `\nThemes: ${entry.master_themes.join(', ')}`;
    }
    
    return `Entry from ${date}: ${entry.content}${emotionInfo}${themeInfo}`;
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
    console.log('[responseGenerator] Calling OpenAI with prompts...');
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-10), // Include recent conversation context
      { role: 'user', content: userPrompt }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[responseGenerator] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedResponse = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    console.log('[responseGenerator] Successfully generated response');
    return generatedResponse;
    
  } catch (error) {
    console.error('[responseGenerator] Error generating response:', error);
    throw error;
  }
}
