// Enhanced response generation utilities
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
    console.log('[responseGenerator] Calling OpenAI with refined SOuLO prompt...');
    
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
        max_tokens: 800, // Increased slightly to accommodate structured format
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
    
    console.log('[responseGenerator] Successfully generated structured SOuLO response');
    return generatedResponse;
    
  } catch (error) {
    console.error('[responseGenerator] Error generating response:', error);
    throw error;
  }
}
