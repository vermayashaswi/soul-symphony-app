
// Conversational SOULo prompts for journal-specific queries
const JOURNAL_SPECIFIC_PROMPT = `You are SOULo, a warm and caring AI companion who helps people understand their emotional patterns through their journal entries. You're like a wise, supportive friend who really listens and genuinely cares.

CONVERSATION STYLE:
Think of yourself as someone who truly cares about the user's emotional wellbeing. You're insightful but never clinical, warm but not overly cheerful, and always grounded in what their actual journal data shows.

Journal excerpts:
{journalData}
(Spanning from {startDate} to {endDate})

User's question: "{userMessage}"

EMOTION ANALYSIS - CRITICAL:
• You have access to PRECISE emotion scores (0.0-1.0 scale) from advanced AI analysis
• These are REAL emotional measurements, not guesses
• "anxiety: 0.75" means 75% anxiety intensity was actually detected
• Build insights from these ACTUAL emotion patterns, not text interpretation
• Never say "your entries don't show emotions" - the emotions are already calculated and scored

HOW TO RESPOND:
• Start warmly: "Looking at your entries..." "I can see..." "What stands out to me..."
• Share insights naturally: "It seems like..." "I notice a pattern where..."
• Include specific examples: "Like on [date] when you mentioned..."
• Use natural emphasis (*like this*) rather than clinical formatting
• Keep it conversational - like a caring friend sharing observations
• Stay around 200-250 words unless they need more detail
• End with care: gentle observations, thoughtful questions, or encouragement

REMEMBER: You're not a therapist - you're a caring companion helping someone understand their emotional journey using real data from their own words and genuine human insight.`;

// Conversational general question prompt
const GENERAL_QUESTION_PROMPT = `You are SOULo, a warm and supportive mental health companion. You're part of a voice journaling app that helps people understand their emotions, but right now you're answering a general question.

PERSONALITY:
- Conversational and genuine, like a caring friend who knows about mental health
- Encouraging without dismissing real struggles
- Naturally warm and understanding

RESPONSE STYLE:
- Be conversational, not clinical: "Many people find..." instead of "Research indicates..."
- Keep it human-length (150-250 words)
- Use natural emphasis and simple formatting
- End with warmth or a gentle question

For personal insights about their emotional patterns, warmly suggest they could ask you to analyze their journal entries directly.`;

/**
 * Generate a conversational response using the entries and user message
 */
export async function generateResponse(
  entries: any[],
  message: string,
  conversationContext: any[],
  apiKey: string
): Promise<string> {
  try {
    // Get earliest and latest entry dates
    let earliestDate = null;
    let latestDate = null;
    
    // Format entries for the prompt with dates and emotion scores
    const entriesWithDates = entries.map(entry => {
      const entryDate = new Date(entry.created_at);
      
      // Track earliest and latest dates
      if (!earliestDate || entryDate < earliestDate) {
        earliestDate = entryDate;
      }
      if (!latestDate || entryDate > latestDate) {
        latestDate = entryDate;
      }
      
      const formattedDate = entryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Format emotion scores if they exist
      let emotionInfo = '';
      if (entry.emotions && typeof entry.emotions === 'object') {
        const emotions = Object.entries(entry.emotions)
          .filter(([_, score]) => typeof score === 'number' && score > 0.3)
          .sort(([_, a], [__, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
          .join(', ');
        
        if (emotions) {
          emotionInfo = `\nEmotion scores: ${emotions}`;
        }
      }
      
      // Format themes info
      let themeInfo = '';
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        themeInfo = `\nThemes: ${entry.master_themes.join(', ')}`;
      }

      // Format sentiment info with score
      const sentimentInfo = entry.sentiment 
        ? `\nSentiment score: ${entry.sentiment.toFixed(2)} (${
            entry.sentiment <= -0.2 ? 'negative' :
            entry.sentiment >= 0.2 ? 'positive' : 'neutral'
          })`
        : '';

      return `- Entry from ${formattedDate}: ${entry.content}${emotionInfo}${themeInfo}${sentimentInfo}`;
    }).join('\n\n');
    
    // Format date range for the prompt
    const startDateFormatted = earliestDate ? earliestDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) : 'unknown date';
    
    const endDateFormatted = latestDate ? latestDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) : 'unknown date';

    // Prepare prompt with conversational SOULo format
    const promptFormatted = JOURNAL_SPECIFIC_PROMPT
      .replace('{journalData}', entriesWithDates)
      .replace('{userMessage}', message)
      .replace('{startDate}', startDateFormatted)
      .replace('{endDate}', endDateFormatted);
      
    // Call OpenAI with conversational SOULo prompt
    console.log("Calling OpenAI with conversational SOULo prompt structure");
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: promptFormatted });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      messages.push(...conversationContext);
      messages.push({ role: 'user', content: message });
    }
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: promptFormatted }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'I want to help you understand your emotional patterns, but I\'m having trouble processing that right now. Could you try rephrasing your question?';
    
    return responseContent;
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
}

// Function to check for potentially hallucinated dates in the response
export function checkForHallucinatedDates(response: string, entries: any[]): boolean {
  try {
    // Extract all potential dates from the response using regex
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthRegex = new RegExp(`\\b(${months.join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?\\b`, 'gi');
    const foundDates = response.match(monthRegex) || [];
    
    // Create a set of actual dates from entries
    const actualDates = new Set();
    entries.forEach(entry => {
      const date = new Date(entry.created_at);
      months.forEach(month => {
        // Add various formats of the same date
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const day = date.getDate();
        const year = date.getFullYear();
        
        actualDates.add(`${monthName} ${day}`);
        actualDates.add(`${monthName} ${day}, ${year}`);
        actualDates.add(`${monthName} ${day}th`);
        actualDates.add(`${monthName} ${day}st`);
        actualDates.add(`${monthName} ${day}nd`);
        actualDates.add(`${monthName} ${day}rd`);
      });
    });
    
    // Check if any found dates are not in the actual dates set
    for (const foundDate of foundDates) {
      // Normalize the found date for comparison
      const normalizedDate = foundDate.replace(/(?:st|nd|rd|th)/, '').replace(/\s+/g, ' ').trim();
      
      // Extract just month and day for partial matching
      const parts = normalizedDate.split(' ');
      if (parts.length >= 2) {
        const monthDay = `${parts[0]} ${parts[1].replace(',', '')}`;
        
        // Check if either the full date or the month+day exists in actual dates
        if (!actualDates.has(normalizedDate) && !actualDates.has(monthDay)) {
          console.warn(`Potential hallucinated date found: ${foundDate}`);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for hallucinated dates:", error);
    return false; // Default to not blocking the response
  }
}
