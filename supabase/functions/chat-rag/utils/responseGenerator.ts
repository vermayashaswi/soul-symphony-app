
// Define the refined SOuLO prompt with enhanced mental health focus and structured format
const JOURNAL_SPECIFIC_PROMPT = `You are SOuLO, an AI mental health assistant trained in CBT, DBT, and mindfulness. Your role is to help users understand emotional patterns in their journal entries using a structured, professional, and empathic tone.

Journal excerpts:
{journalData}
(Spanning from {startDate} to {endDate})

User's question: "{userMessage}"

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
- Only use facts from journal entries — no assumptions, no hallucinations
- Back insights with bullet points referencing specific dates/events when relevant`;

// Define the general question prompt with enhanced mental health awareness
const GENERAL_QUESTION_PROMPT = `You are SOuLO, an AI mental health assistant trained in CBT, DBT, and mindfulness. You are part of a voice journaling app called "SOuLO". 

For general mental health questions that don't specifically mention the user's personal journal entries, provide helpful guidance using the structured format below. For personalized insights, suggest that you could analyze their journal entries if they'd like.

**Response Format:**
## Current State – General guidance on the topic
## Pattern Insights – Common patterns or considerations
## Interpretation – Evidence-based therapeutic perspective  
## Recommended Actions – 1–3 realistic, actionable steps

**Guidelines:**
- Be supportive and professional
- Use second-person voice when providing advice
- Keep responses concise (max 200 words)
- If the question is unrelated to mental health or journaling, politely redirect to the app's purpose`;

/**
 * Generate a response using the entries and user message
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

    // Prepare prompt with updated SOuLO format
    const promptFormatted = JOURNAL_SPECIFIC_PROMPT
      .replace('{journalData}', entriesWithDates)
      .replace('{userMessage}', message)
      .replace('{startDate}', startDateFormatted)
      .replace('{endDate}', endDateFormatted);
      
    // Call OpenAI with structured SOuLO prompt
    console.log("Calling OpenAI with refined SOuLO prompt structure");
    
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
        max_tokens: 800, // Increased to accommodate structured format
        temperature: 0.7,
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    
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
