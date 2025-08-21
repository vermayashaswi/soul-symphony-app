
import { OptimizedApiClient } from './optimizedApiClient.ts';

export function generateSystemPrompt(
  timezone: string,
  timeRange?: any,
  expectedResponseType?: string,
  resultsCount?: number,
  searchInfo?: string,
  conversationContext?: any[],
  isPersonalQuery?: boolean,
  requiresTimeFilter?: boolean,
  searchStrategy?: string
): string {
  let prompt = `You are an AI assistant specializing in analyzing personal journal entries and providing insightful responses based on the user's documented experiences, thoughts, and emotions.

CONTEXT AND SEARCH INFORMATION:
- Search strategy: ${searchStrategy || 'comprehensive'}
- Results found: ${resultsCount || 0} relevant entries
- Search details: ${searchInfo || 'Standard search'}
- User timezone: ${timezone}
- Query type: ${isPersonalQuery ? 'Personal reflection' : 'General inquiry'}

RESPONSE GUIDELINES:
1. **Personalization**: Use insights from the journal entries to provide personalized, relevant responses
2. **Empathy**: Show understanding and emotional intelligence when discussing personal experiences
3. **Analysis**: ${expectedResponseType === 'analysis' ? 'Provide detailed analytical insights with patterns and trends' : 'Focus on conversational, supportive responses'}
4. **Time Awareness**: ${requiresTimeFilter ? 'Pay attention to temporal patterns and time-based insights' : 'Consider the chronological context of entries'}
5. **Confidentiality**: Treat all journal content with utmost privacy and respect

FORMAT:
- Use a warm, conversational tone
- Reference specific experiences when relevant
- Provide actionable insights when appropriate
- ${expectedResponseType === 'analysis' ? 'Structure analytical responses with clear sections and bullet points' : 'Keep responses natural and flowing'}

CONVERSATION CONTEXT:
${conversationContext && conversationContext.length > 0 ? 
  `Previous conversation:\n${conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n` : 
  'This is the start of the conversation.\n'}`;

  return prompt;
}

export function generateUserPrompt(message: string, searchResults: any[], searchType: string): string {
  const contextEntries = searchResults.slice(0, 10).map(entry => {
    const content = entry.content || entry.refined_text || entry.transcription_text || 'No content';
    const themes = entry.master_themes ? entry.master_themes.join(', ') : 'No themes';
    const emotions = entry.emotions ? Object.keys(entry.emotions).join(', ') : 'No emotions';
    const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'No date';
    
    return `Entry (${date}): ${content.slice(0, 300)}${content.length > 300 ? '...' : ''}\nThemes: ${themes}\nEmotions: ${emotions}\n---`;
  }).join('\n');

  return `Based on the following journal entries, please respond to the user's message:

USER MESSAGE: "${message}"

RELEVANT JOURNAL ENTRIES:
${contextEntries}

Please provide a thoughtful, personalized response based on these entries and the user's question.`;
}

export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  conversationContext: any[],
  apiKey: string,
  isAnalytical: boolean = false
): Promise<string> {
  console.log('[responseGenerator] Generating database-aware conversational response...');
  console.log(`[responseGenerator] Using ${conversationContext.length} conversation messages with database context`);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-5), // Include last 5 messages for context
      { role: 'user', content: userPrompt }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages,
        max_tokens: isAnalytical ? 1000 : 600,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[responseGenerator] OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response generated from OpenAI');
    }

    const generatedResponse = data.choices[0].message.content;
    console.log('[responseGenerator] Successfully generated response');
    
    return generatedResponse;

  } catch (error) {
    console.error('[responseGenerator] Error:', error);
    throw error;
  }
}
