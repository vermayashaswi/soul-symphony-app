
// Define the journal-specific prompt with enhanced mental health focus
const JOURNAL_SPECIFIC_PROMPT = `You are SOuLO — a voice journaling assistant that helps users reflect, find patterns, and grow emotionally. Use only the journal entries below to inform your response. Do not invent or infer beyond them.

Journal excerpts:
{journalData}
(Spanning from {startDate} to {endDate})

User's question: "{userMessage}"

Guidelines:
1. **Only use facts** from journal entries — no assumptions, no hallucinations.
2. **Tone**: Supportive, clear, and emotionally aware. Avoid generic advice.
3. **Data-grounded**: Back insights with bullet points referencing specific dates/events.
4. **Insightful & Brief**: Spot emotional patterns or changes over time.
5. **Structure**: Use bullets, bold headers, and short sections for easy reading.
6. **Mental Health Focus**: For queries about mental wellbeing, be especially thoughtful, supportive and personalized.
7. **When data is insufficient**, say so clearly and gently suggest journaling directions.

Keep response concise (max ~150 words), personalized, and well-structured.`;

// Define the general question prompt with enhanced mental health awareness
const GENERAL_QUESTION_PROMPT = `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. IF it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India" , "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.

For mental health related questions that don't specifically mention the user's personal journal entries, provide helpful general guidance but suggest that for personalized insights, you could analyze their journal entries if they'd like.`;

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
    
    // Format entries for the prompt with dates
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
      
      // Format entities for display if they exist
      let entityInfo = '';
      if (entry.entities && Array.isArray(entry.entities)) {
        const entityTypes = {};
        entry.entities.forEach(entity => {
          if (!entityTypes[entity.type]) {
            entityTypes[entity.type] = [];
          }
          entityTypes[entity.type].push(entity.name);
        });
        
        // Create a readable string of entities
        const entityStrings = [];
        for (const [type, names] of Object.entries(entityTypes)) {
          entityStrings.push(`${type}: ${names.join(', ')}`);
        }
        if (entityStrings.length > 0) {
          entityInfo = `\nMentioned: ${entityStrings.join(' | ')}`;
        }
      }

      // Format sentiment info
      const sentimentInfo = entry.sentiment 
        ? `\nSentiment: ${entry.sentiment} (${
            entry.sentiment <= -0.2 ? 'negative' :
            entry.sentiment >= 0.2 ? 'positive' : 'neutral'
          })`
        : '';

      return `- Entry from ${formattedDate}: ${entry.content}${entityInfo}${sentimentInfo}`;
    }).join('\n\n');

    // Get all the dates of entries as an array
    const entryDates = entries.map(entry => {
      return new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    });
    
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

    // Prepare prompt with updated instructions
    const promptFormatted = JOURNAL_SPECIFIC_PROMPT
      .replace('{journalData}', entriesWithDates)
      .replace('{userMessage}', message)
      .replace('{startDate}', startDateFormatted)
      .replace('{endDate}', endDateFormatted);
      
    // Call OpenAI
    console.log("Calling OpenAI for completion");
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: promptFormatted });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      // Log that we're using conversation context
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      
      // Add the conversation context messages
      messages.push(...conversationContext);
      
      // Add the current user message
      messages.push({ role: 'user', content: message });
    }
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: promptFormatted }],
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
