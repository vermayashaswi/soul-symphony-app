
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add diagnostic helper function at the beginning of the edge function
function createDiagnosticStep(name: string, status: string, details: any = null) {
  return {
    name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
}

// Define the general question prompt
const GENERAL_QUESTION_PROMPT = `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. 

IF the query concerns introductory messages or greetings, respond accordingly. 

If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly.

IMPORTANT: If the user explicitly asks for a rating, score, or evaluation of any kind (e.g., "Rate my anxiety", "Score my happiness", etc.), you MUST provide a numerical rating on a scale of 1-10 along with an explanation. Even though you don't have access to their journal entries in this context, provide a hypothetical rating and clearly state that it's based on the limited context, for example:

"Based on our limited interaction, I'd rate your [trait] as a 7/10. However, for a more accurate assessment, I'd need to analyze your journal entries in detail. Would you like me to do that? If so, please rephrase your question to specifically ask about your journal entries."

If it contains any abstract question unrelated to mental health or the app's purpose, feel free to deny politely.`;

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

// Helper function for calling OpenAI API using fetch instead of SDK
async function callOpenAI(messages: any[], model = 'gpt-4o-mini', temperature = 0.7) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

// Helper function for creating OpenAI embeddings using fetch
async function createEmbedding(input: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI embedding API error: ${response.status} ${errorText}`);
      throw new Error(`OpenAI embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

// Helper function to handle general questions
async function handleGeneralQuestion(message: string, conversationContext: any[]) {
  console.log("Processing as general question, skipping journal entry retrieval");
  
  try {
    const messages = [
      { role: 'system', content: GENERAL_QUESTION_PROMPT },
      ...(conversationContext.length > 0 ? conversationContext : []),
      { role: 'user', content: message }
    ];
    
    const completionData = await callOpenAI(messages);
    const generalResponse = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("General response generated successfully");
    
    return generalResponse;
  } catch (error) {
    console.error("Error generating general response:", error);
    throw error;
  }
}

// Function to detect personality trait questions that should always use journal entries
function isPersonalityQuestion(query: string): boolean {
  const personalityPatterns = [
    /\bam i\b/i,                      // "Am I an introvert?"
    /\bintrovert\b/i,                 // Any mention of introvert
    /\bextrovert\b/i,                 // Any mention of extrovert
    /\bambivert\b/i,                  // Any mention of ambivert
    /\bpersonality\b/i,               // "my personality"
    /\bmy traits\b/i,                 // "my traits"
    /\bmy characteristic/i,           // "my characteristics"
    /\bmy nature\b/i,                 // "my nature"
    /\bhow (am|do) i\b.{0,30}\b(like|feel about|think about|respond to)\b/i, // "How do I like people?"
    /\bdo i\b.{0,20}\b(like|enjoy|prefer)\b/i, // "Do I like people?"
    /\bwhat (kind|type) of person\b/i, // "What kind of person am I?"
    /\bam i a\b.{0,20}\b(person|individual)\b/i, // "Am I a quiet person?"
    /\bam i more\b/i,                 // "Am I more introverted or extroverted?"
    /\bdo i tend to\b/i,              // "Do I tend to avoid social situations?"
    /\bwhat does my\b.{0,20}\b(journal|entries)\b.{0,30}\b(say|reveal|indicate) about\b/i, // "What does my journal say about me?"
    /\bwhat are my\b.{0,20}\b(traits|characteristics|tendencies)\b/i, // "What are my personality traits?"
  ];

  return personalityPatterns.some(pattern => pattern.test(query.toLowerCase()));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      userId, 
      threadId, 
      includeDiagnostics, 
      queryPlan,
      timezoneOffset,
      isHistoricalDataRequest, 
      isMentalHealthQuery
    } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log(`Local timezone offset: ${timezoneOffset || 0} minutes`);
    
    // Add this where appropriate in the main request handler:
    const diagnostics = {
      steps: [],
      similarityScores: [],
      functionCalls: [],
      references: []
    };
    
    // Check if this is a rating request
    const isRatingRequest = /rate|score|analyze|evaluate|assess|rank|review/i.test(message.toLowerCase());
    if (isRatingRequest) {
      console.log("Detected rating/evaluation request");
      diagnostics.steps.push(createDiagnosticStep("Request Analysis", "success", "Detected rating/evaluation request"));
    }
    
    // Log the query plan if provided
    if (queryPlan) {
      console.log("Using provided query plan:", queryPlan);
      diagnostics.steps.push(createDiagnosticStep(
        "Query Plan", 
        "success", 
        JSON.stringify(queryPlan)
      ));
      
      // If this is a rating request, force journal_specific handling
      if (isRatingRequest && !queryPlan.needs_data_aggregation) {
        console.log("Rating request detected - forcing data aggregation");
        queryPlan.needs_data_aggregation = true;
      }
    }
    
    // Fetch previous messages from this thread if a threadId is provided
    let conversationContext = [];
    if (threadId) {
      diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "loading"));
      try {
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2); // Get more messages than needed to ensure we have message pairs
        
        if (error) {
          console.error('Error fetching thread context:', error);
          diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "error", error.message));
        } else if (previousMessages && previousMessages.length > 0) {
          // Process messages to create conversation context
          // We need to reverse the messages to get them in chronological order
          const chronologicalMessages = [...previousMessages].reverse();
          
          // Format as conversation context
          conversationContext = chronologicalMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          // Limit to the most recent messages to avoid context length issues
          if (conversationContext.length > MAX_CONTEXT_MESSAGES) {
            conversationContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
          }
          
          diagnostics.steps.push(createDiagnosticStep(
            "Thread Context Retrieval", 
            "success", 
            `Retrieved ${conversationContext.length} messages for context`
          ));
          
          console.log(`Added ${conversationContext.length} previous messages as context`);
        } else {
          diagnostics.steps.push(createDiagnosticStep(
            "Thread Context Retrieval", 
            "success", 
            "No previous messages found in thread"
          ));
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
        diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "error", contextError.message));
      }
    }
    
    // First check if this is a personality question to bypass classification
    const isPersonality = isPersonalityQuestion(message);
    if (isPersonality) {
      console.log("Detected personality question, bypassing classification");
      diagnostics.steps.push(createDiagnosticStep("Request Analysis", "success", "Detected personality question"));
    }
    
    // First categorize if this is a general question or a journal-specific question
    diagnostics.steps.push(createDiagnosticStep("Question Categorization", "loading"));
    console.log("Categorizing question type");
    
    // Force journal_specific for personality or rating requests
    let questionType = "GENERAL";
    
    if (isPersonality || isRatingRequest) {
      console.log("Personality or rating request detected - forcing journal_specific classification");
      questionType = "JOURNAL_SPECIFIC";
      diagnostics.steps.push(createDiagnosticStep("Question Categorization", "success", "Personality or rating request detected: JOURNAL_SPECIFIC"));
    } else {
      // Use the callOpenAI helper instead of the direct OpenAI SDK call
      try {
        const categorizationResponse = await callOpenAI([
          {
            role: 'system',
            content: `You are a classifier that determines if a user's query is a general question about mental health, greetings, or an abstract question unrelated to journaling (respond with "GENERAL") OR if it's a question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC"). 
            
            IMPORTANT: If the query contains ANY request for ratings, scores, or evaluations (e.g., "Rate my anxiety", "Score my happiness", etc.), you MUST classify it as "JOURNAL_SPECIFIC".
            
            If you remotely feel this question could be about the person's journal entries or an exploration of his/her specific mental health, classify it as "JOURNAL_SPECIFIC".
            
            The following types of questions should ALWAYS be classified as "JOURNAL_SPECIFIC":
            - Questions about the user's personality traits (e.g., "Am I an introvert?", "Am I extroverted?")
            - Questions about the user's preferences (e.g., "Do I like people?", "What activities do I enjoy?")
            - Questions about the user's patterns or tendencies (e.g., "Do I tend to avoid social situations?")
            - Questions that use phrases like "my personality", "my traits", "my characteristics"
            
            Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC".
            
            Examples:
            - "How are you doing?" -> "GENERAL"
            - "What is journaling?" -> "GENERAL"
            - "Who is the president of India?" -> "GENERAL"
            - "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
            - "What patterns do you see in my anxiety?" -> "JOURNAL_SPECIFIC"
            - "Am I happier on weekends based on my entries?" -> "JOURNAL_SPECIFIC"
            - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"
            - "Rate my happiness level" -> "JOURNAL_SPECIFIC"
            - "Score my productivity" -> "JOURNAL_SPECIFIC"
            - "Analyze my emotional patterns" -> "JOURNAL_SPECIFIC"
            - "Am I an introvert?" -> "JOURNAL_SPECIFIC"
            - "Do I like people?" -> "JOURNAL_SPECIFIC"
            - "What are my personality traits?" -> "JOURNAL_SPECIFIC"
            - "Am I more social or reserved?" -> "JOURNAL_SPECIFIC"`
          },
          { role: 'user', content: message }
        ], 'gpt-4o-mini', 0.1);

        questionType = categorizationResponse.choices[0]?.message?.content.trim();
        console.log(`Question categorized as: ${questionType}`);
        diagnostics.steps.push(createDiagnosticStep("Question Categorization", "success", `Classified as ${questionType}`));
      } catch (error) {
        console.error("Error classifying question:", error);
        // Default to JOURNAL_SPECIFIC on error for personality questions
        if (isPersonalityQuestion(message)) {
          questionType = "JOURNAL_SPECIFIC";
          console.log("Classification error, but detected personality question - defaulting to JOURNAL_SPECIFIC");
        } else {
          // Default to GENERAL for other questions
          questionType = "GENERAL";
        }
        diagnostics.steps.push(createDiagnosticStep("Question Categorization", "error", `Error: ${error.message}, defaulting to ${questionType}`));
      }
    }

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL" && !isRatingRequest && !isPersonality) {
      console.log("Processing as general question, skipping journal entry retrieval");
      diagnostics.steps.push(createDiagnosticStep("General Question Processing", "loading"));
      
      try {
        const generalResponse = await handleGeneralQuestion(message, conversationContext);
        diagnostics.steps.push(createDiagnosticStep("General Question Processing", "success"));

        return new Response(
          JSON.stringify({ 
            response: generalResponse, 
            diagnostics: includeDiagnostics ? diagnostics : undefined,
            references: []
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        console.error("Error handling general question:", error);
        diagnostics.steps.push(createDiagnosticStep("General Question Processing", "error", error.message));
        
        return new Response(
          JSON.stringify({ 
            response: "I'm having trouble answering that right now. Could you please try again?", 
            diagnostics: includeDiagnostics ? diagnostics : undefined,
            references: []
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }
    
    // If it's a journal-specific question, continue with the enhanced RAG flow
    // 1. Generate embedding for the message
    console.log("Generating embedding for message");
    diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "loading"));
    
    let queryEmbedding;
    try {
      queryEmbedding = await createEmbedding(message);
      console.log("Embedding generated successfully");
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "success"));
    } catch (embeddingError) {
      console.error('Failed to generate embedding:', embeddingError);
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", embeddingError.message));
      throw new Error('Could not generate embedding for the message');
    }

    // 2. Search for relevant entries based on the query plan
    console.log("Searching for relevant entries");
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "loading"));

    let entries = [];
    const matchCount = queryPlan?.matchCount || 15;

    // Handle the search strategy from the query plan
    if (queryPlan) {
      console.log(`Using search strategy: ${queryPlan.searchStrategy}`);
      
      // For historical data requests, use a wider date range or no date filter
      if (isHistoricalDataRequest && queryPlan.filters && queryPlan.filters.dateRange) {
        console.log("Historical data request detected, removing date filters");
        delete queryPlan.filters.dateRange;
      }
      
      // For personality questions, ensure we have the right themes if not already specified
      if (isPersonality && queryPlan.filters) {
        if (!queryPlan.filters.themes || queryPlan.filters.themes.length === 0) {
          console.log("Adding personality-related themes to filter");
          queryPlan.filters.themes = [
            "social interactions", 
            "self-reflection", 
            "personality traits",
            "social gatherings",
            "relationships"
          ];
        }
        
        // Use hybrid search for personality questions for best results
        if (queryPlan.searchStrategy !== "hybrid") {
          console.log("Switching to hybrid search strategy for personality question");
          queryPlan.searchStrategy = "hybrid";
        }
      }
      
      diagnostics.steps.push(createDiagnosticStep(
        "Search Strategy", 
        "success", 
        `Using ${queryPlan.searchStrategy} strategy with filters: ${JSON.stringify(queryPlan.filters)}`
      ));
      
      switch(queryPlan.searchStrategy) {
        case 'sql':
          // Use SQL query with flexible filters
          entries = await searchEntriesWithSQL(userId, queryPlan.filters, matchCount);
          break;
          
        case 'hybrid':
          // Combine vector search with SQL filtering
          entries = await searchEntriesHybrid(userId, queryEmbedding, queryPlan.filters, matchCount, timezoneOffset);
          break;
          
        case 'vector':
        default:
          // Use vector search with optional filters
          entries = await searchEntriesWithVector(userId, queryEmbedding, queryPlan.filters, matchCount, timezoneOffset);
          break;
      }
    } else {
      console.log("No query plan provided, using default vector search");
      
      // For personality questions without a query plan, create a basic filter
      let filters = {};
      if (isPersonality) {
        console.log("Creating personality-focused search without query plan");
        filters = {
          themes: ["social interactions", "self-reflection", "personality traits", "relationships"],
          dateRange: { startDate: null, endDate: null, periodName: "all time" }
        };
      }
      
      entries = await searchEntriesWithVector(userId, queryEmbedding, filters, 15, timezoneOffset);
    }

    console.log(`Found ${entries.length} relevant entries`);
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "success", `Found ${entries.length} entries`));

    // Check if we found any entries
    if (entries.length === 0) {
      console.log("No entries found");
      diagnostics.steps.push(createDiagnosticStep("Entry Check", "warning", "No entries found"));
      
      // Return a response with no entries but proper message
      return new Response(
        JSON.stringify({ 
          response: isHistoricalDataRequest 
            ? "I don't see any journal entries that match what you're asking about in your entire journal history."
            : "I don't see any journal entries that match what you're asking about for the specified time period.",
          diagnostics: includeDiagnostics ? diagnostics : undefined,
          references: [],
          noEntriesForTimeRange: true
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Extract available dates for later validation
    const availableDates = entries.map(entry => {
      return new Date(entry.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });
    
    console.log("Available journal entry dates:", availableDates);
    
    // Get the date range for the entries
    const entryDates = entries.map(entry => new Date(entry.created_at));
    const oldestDate = entryDates.length > 0 ? new Date(Math.min(...entryDates.map(d => d.getTime()))) : null;
    const newestDate = entryDates.length > 0 ? new Date(Math.max(...entryDates.map(d => d.getTime()))) : null;
    
    const dateRangeInfo = oldestDate && newestDate ? 
      `Your journal entries span from ${oldestDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to ${newestDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ` : 
      '';
    
    console.log("Entry date range:", dateRangeInfo);

    // Format entries for the prompt with dates - using user's timezone
    const entriesWithDates = entries.map(entry => {
      // Apply user's timezone offset to display dates in their local time
      const localDate = new Date(new Date(entry.created_at).getTime() + (timezoneOffset || 0) * 60 * 1000);
      
      const formattedDate = localDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric' // Added year to ensure precise dating
      });
      return `- Entry from ${formattedDate}: ${entry.content}`;
    }).join('\n\n');

    // 3. Prepare prompt with updated instructions - enhance for personality questions
    let prompt = `You are SOuLO, a personal mental well-being assistant designed to help users reflect on their emotions, understand patterns in their thoughts, and gain insight from their journaling practice and sometimes also give quantitative assessments, if asked to. If you are responding to an existing conversation thread, don't provide repetitive information.

Below are excerpts from the user's journal entries, along with dates:
${entriesWithDates}

${dateRangeInfo}

CRITICAL INSTRUCTION: ONLY reference dates and events that appear explicitly in the user's journal entries listed above. NEVER invent, hallucinate or make up dates, events, or journal content that is not present in the provided entries. If asked about a specific time period that isn't covered in the entries above, clearly state that there are no entries for that period.

The user has now asked:
"${message}"

Please respond with the following guidelines:

1. **Factual Accuracy**
   - ONLY mention dates, events, and emotions that are explicitly present in the journal entries provided.
   - If you're unsure if something happened on a specific date, DO NOT mention it.
   - NEVER invent or hallucinate events, dates, or journal content.

2. **Tone & Purpose**
   - Be emotionally supportive, non-judgmental, and concise.
   - Avoid generic advice—make your response feel personal, grounded in the user's own journal reflections.

3. **Data Grounding**
   - Use the user's past entries as the primary source of truth.
   - Reference journal entries with specific bullet points that include accurate dates.
   - Do not make assumptions or speculate beyond what the user has written.

4. **Handling Ambiguity**
   - If the user's question is broad, philosophical, or ambiguous (e.g., "Am I introverted?"), respond with thoughtful reflection:
     - Acknowledge the ambiguity or complexity of the question.
     - Offer the most likely patterns or insights based on journal entries.
     - Clearly state when there isn't enough information to give a definitive answer, and gently suggest what the user could explore further in their journaling.
   - If user asks you to rate them, do it! 

5. **Insight & Structure**
   - Highlight recurring patterns, emotional trends, or changes over time.
   - Suggest gentle, practical self-reflections or actions, only if relevant.
   - Keep responses between 120–180 words, formatted for easy reading.
   - Always use bulleted pointers wherever necessary!!

Example format (only to be used when you feel the need to) :
- "On March 18, 2025, you mentioned feeling drained after social interactions."
- "Your entry on April 2, 2025, reflects a desire for deeper connection with others."
- "Based on these entries, it seems you may lean toward introversion, but more context would help."

**MAKE SURE YOUR RESPONSES ARE STRUCTURED WITH BULLETS, POINTERS, BOLD HEADERS, and other boldened information that's important. Don't need lengthy paragraphs that are difficult to read. Use headers and sub headers wisely**`;

    // Add special instructions for personality questions
    if (isPersonality) {
      prompt += `

**SPECIAL INSTRUCTIONS FOR PERSONALITY QUESTIONS:**
Since the user is asking about their personality traits or preferences (like whether they're an introvert or how they feel about people), please:
1. Look for patterns in how they describe their social interactions and reactions to people
2. Pay special attention to any mentions of:
   - Feeling energized or drained by social situations
   - Preferring alone time vs seeking out company
   - Their comfort level in groups vs one-on-one interactions
   - How they process thoughts (internally vs externally)
3. If possible, provide a nuanced analysis rather than a binary label
4. Use specific examples from their journal entries to support your conclusions
5. For questions like "Am I an introvert?" or "Do I like people?", provide a clear answer based on the evidence, then support it with specifics`;
    }

    prompt += `

Now generate your thoughtful, emotionally intelligent response:`;

    // 4. Call OpenAI using our new helper function
    console.log("Calling OpenAI for completion");
    diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "loading"));
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: prompt });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      // Log that we're using conversation context
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      diagnostics.steps.push(createDiagnosticStep(
        "Conversation Context", 
        "success",
        `Including ${conversationContext.length} previous messages for context`
      ));
      
      // Add the conversation context messages
      messages.push(...conversationContext);
      
      // Add the current user message
      messages.push({ role: 'user', content: message });
    }
    
    try {
      // Use our helper instead of the direct call
      const completionData = await callOpenAI(
        conversationContext.length > 0 ? messages : [{ role: 'system', content: prompt }],
        'gpt-4o-mini'
      );
      
      let responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("Response generated successfully");
      diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "success"));
    
      // Validate response for hallucinated dates
      diagnostics.steps.push(createDiagnosticStep("Response Validation", "loading"));
      
      // Extract dates from the response using a regex pattern for dates
      const dateRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi;
      const mentionedDates = responseContent.match(dateRegex) || [];
      
      // Check if any mentioned dates are not in the available dates
      const invalidDates = mentionedDates.filter(mentionedDate => {
        // Normalize date formats for comparison (remove ordinal suffixes)
        const normalizedDate = mentionedDate.replace(/(st|nd|rd|th)/g, '').trim();
        // Check if this normalized date exists in availableDates
        return !availableDates.some(availableDate => {
          return normalizedDate.includes(availableDate.replace(/(\d+)(st|nd|rd|th)/, '$1')) || 
                availableDate.includes(normalizedDate.replace(/(\d+)(st|nd|rd|th)/, '$1'));
        });
      });
      
      // Log any invalid dates found
      if (invalidDates.length > 0) {
        console.log("Found potentially hallucinated dates in response:", invalidDates);
        diagnostics.steps.push(createDiagnosticStep(
          "Response Validation", 
          "warning", 
          `Found ${invalidDates.length} potentially hallucinated dates: ${invalidDates.join(', ')}`
        ));
        
        // Add a disclaimer to the response
        responseContent += `\n\n**Note:** This response may contain inaccuracies in the dates referenced. Please refer to your actual journal entries for precise dates.`;
      } else {
        console.log("No hallucinated dates detected in response");
        diagnostics.steps.push(createDiagnosticStep("Response Validation", "success", "No date hallucinations detected"));
      }

      // Process entries to ensure valid dates
      const processedEntries = entries.map(entry => {
        // Make sure created_at is a valid date string
        let createdAt = entry.created_at;
        if (!createdAt || isNaN(new Date(createdAt).getTime())) {
          createdAt = new Date().toISOString();
        }
        
        return {
          id: entry.id,
          content: entry.content,
          created_at: createdAt,
          similarity: entry.similarity || 0,
          sentiment: entry.sentiment || null,
          emotions: entry.emotions || null,
          themes: entry.master_themes || []
        };
      });

      // 5. Return response
      return new Response(
        JSON.stringify({ 
          response: responseContent, 
          diagnostics: includeDiagnostics ? diagnostics : undefined,
          references: processedEntries.map(entry => {
            // Apply user's timezone offset for display
            const localDate = new Date(new Date(entry.created_at).getTime() + (timezoneOffset || 0) * 60 * 1000);
            
            return {
              id: entry.id,
              content: entry.content,
              date: entry.created_at,
              localDate: localDate.toISOString(), // Add local date for client-side display
              snippet: entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : ''),
              similarity: entry.similarity,
              themes: entry.themes || [],
              sentiment: entry.sentiment,
              emotions: entry.emotions
            };
          }),
          entryDateRange: dateRangeInfo
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (error) {
      console.error('Error generating response:', error);
      diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "error", error.message));
      
      return new Response(
        JSON.stringify({ 
          response: "I'm having trouble analyzing your journal entries right now. Please try again in a moment.", 
          diagnostics: includeDiagnostics ? diagnostics : undefined,
          error: error.message
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

/**
 * Perform vector search with optional filters using match_journal_entries_with_date
 */
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[],
  filters: any = {},
  matchCount: number = 15,
  timezoneOffset: number = 0
) {
  try {
    console.log(`Vector search with filters for userId: ${userId}`, filters);
    
    // Extract date range from filters if it exists
    let startDate = null;
    let endDate = null;
    
    if (filters.dateRange) {
      startDate = filters.dateRange.startDate;
      endDate = filters.dateRange.endDate;
      
      console.log(`Using date range: ${startDate} to ${endDate} (${filters.dateRange.periodName})`);
    }
    
    // Use the match_journal_entries_with_date function for direct database filtering with date range
    let { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: matchCount * 2, // Get more to allow for filtering
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      }
    );
    
    if (error) {
      console.error(`Error in vector search with date: ${error.message}`);
      
      // Fallback to regular vector search if the with_date function fails
      console.log("Falling back to standard vector search without date parameters");
      const fallbackResult = await supabase.rpc(
        'match_journal_entries_fixed',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: matchCount * 2,
          user_id_filter: userId
        }
      );
      
      if (fallbackResult.error) {
        console.error(`Error in fallback vector search: ${fallbackResult.error.message}`);
        throw fallbackResult.error;
      }
      
      data = fallbackResult.data || [];
    }
    
    let filteredData = data || [];
    
    // Log entry dates for debugging time range issues
    if (filteredData.length > 0) {
      const entryDates = filteredData.map(entry => {
        const date = new Date(entry.created_at);
        return `${date.toISOString()} (${date.toLocaleDateString()})`;
      });
      console.log("Initial entry dates before filtering:", entryDates);
    }
    
    // Apply additional filters if the dateRange was already applied at the database level
    if (filteredData.length > 0) {
      // Apply emotions filter
      if (filters.emotions && filters.emotions.length > 0) {
        filteredData = filteredData.filter(entry => {
          if (!entry.emotions) return false;
          return filters.emotions.some((emotion: string) => 
            entry.emotions && typeof entry.emotions === 'object' && 
            Object.keys(entry.emotions).some(key => 
              key.toLowerCase().includes(emotion.toLowerCase()) && 
              entry.emotions[key] > 0.3
            )
          );
        });
      }
      
      // Apply sentiment filter
      if (filters.sentiment && filters.sentiment.length > 0) {
        filteredData = filteredData.filter(entry => {
          if (!entry.sentiment) return false;
          return filters.sentiment.some((sentiment: string) => 
            entry.sentiment && entry.sentiment.toLowerCase().includes(sentiment.toLowerCase())
          );
        });
      }
      
      // Apply themes filter
      if (filters.themes && filters.themes.length > 0) {
        filteredData = filteredData.filter(entry => {
          if (!entry.themes || !Array.isArray(entry.themes)) return false;
          return filters.themes.some((theme: string) => 
            entry.themes.some((entryTheme: string) => 
              entryTheme.toLowerCase().includes(theme.toLowerCase())
            )
          );
        });
      }
    }
    
    // If no entries found and we have date filters, log a detailed message
    if (filteredData.length === 0 && (startDate || endDate)) {
      console.log(`No entries found for date range: ${startDate || 'any'} to ${endDate || 'any'}`);
      
      // Get a count of all entries for this user as a sanity check
      const { count, error: countError } = await supabase
        .from('Journal Entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (countError) {
        console.error(`Error getting entry count: ${countError.message}`);
      } else {
        console.log(`User has ${count} total journal entries`);
      }
    }
    
    console.log(`Returning ${filteredData.length} entries after filtering`);
    
    // Return the filtered data, limited to the requested count
    return filteredData.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesWithVector:', error);
    return [];
  }
}

/**
 * Use SQL queries to search entries with filters
 */
async function searchEntriesWithSQL(
  userId: string,
  filters: any = {},
  matchCount: number = 15
) {
  try {
    console.log(`SQL search with filters for userId: ${userId}`, filters);
    
    // Start building the query - Fix: Use quoted column names for columns with spaces
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, emotions, sentiment, master_themes, entities')
      .eq('user_id', userId);
    
    // Apply date range filter with clear logging
    if (filters.dateRange) {
      if (filters.dateRange.startDate) {
        console.log(`Adding start date filter: ${filters.dateRange.startDate}`);
        query = query.gte('created_at', filters.dateRange.startDate);
      }
      
      if (filters.dateRange.endDate) {
        console.log(`Adding end date filter: ${filters.dateRange.endDate}`);
        query = query.lte('created_at', filters.dateRange.endDate);
      }
    }
    
    // Apply sentiment filter if provided
    if (filters.sentiment && filters.sentiment.length > 0) {
      query = query.in('sentiment', filters.sentiment);
    }
    
    // Order by most recent for time-based queries
    query = query.order('created_at', { ascending: false });
    
    // Execute the query
    const { data, error } = await query.limit(matchCount * 3); // Get more to allow for post-filtering
    
    if (error) {
      console.error(`Error in SQL search: ${error.message}`);
      throw error;
    }
    
    // Log result count for debugging
    if (data) {
      console.log(`SQL search returned ${data.length} results`);
    } else {
      console.log(`SQL search returned no results`);
    }
    
    let results = data || [];
    
    // Process the results - Fix: Use correct column access with spaces
    results = results.map(entry => ({
      id: entry.id,
      content: entry['refined text'] || entry['transcription text'] || '',
      created_at: entry.created_at,
      emotions: entry.emotions,
      sentiment: entry.sentiment,
      master_themes: entry.master_themes,
      entities: entry.entities
    }));
    
    // Apply post-query filters
    
    // Apply emotions filter
    if (filters.emotions && filters.emotions.length > 0) {
      results = results.filter(entry => {
        if (!entry.emotions) return false;
        return filters.emotions.some((emotion: string) => 
          entry.emotions && typeof entry.emotions === 'object' && 
          Object.keys(entry.emotions).some(key => 
            key.toLowerCase().includes(emotion.toLowerCase()) && 
            entry.emotions[key] > 0.3
          )
        );
      });
    }
    
    // Apply themes filter
    if (filters.themes && filters.themes.length > 0) {
      results = results.filter(entry => {
        if (!entry.master_themes || !Array.isArray(entry.master_themes)) return false;
        return filters.themes.some((theme: string) => 
          entry.master_themes.some((entryTheme: string) => 
            entryTheme.toLowerCase().includes(theme.toLowerCase())
          )
        );
      });
    }
    
    // Apply entities filter
    if (filters.entities && filters.entities.length > 0) {
      results = results.filter(entry => {
        if (!entry.entities || !Array.isArray(entry.entities)) return false;
        
        return filters.entities.some((filterEntity: { type?: string, name?: string }) => {
          if (!filterEntity) return false;
          
          return entry.entities.some((entryEntity: any) => {
            if (!entryEntity) return false;
            
            const typeMatch = !filterEntity.type || 
              (entryEntity.type && entryEntity.type.toLowerCase().includes(filterEntity.type.toLowerCase()));
            
            const nameMatch = !filterEntity.name ||
              (entryEntity.name && entryEntity.name.toLowerCase().includes(filterEntity.name.toLowerCase()));
            
            return typeMatch && nameMatch;
          });
        });
      });
    }
    
    // Log filtered result count for debugging
    console.log(`Found ${results.length} relevant entries`);
    
    // If no results but we have a date range filter, clearly indicate this
    if (results.length === 0 && filters.dateRange) {
      console.log("No entries found for the specified time range");
    }
    
    // Return the final filtered results, limited to the requested count
    return results.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesWithSQL:', error);
    return [];
  }
}

/**
 * Hybrid search combining vector similarity with SQL filtering
 */
async function searchEntriesHybrid(
  userId: string,
  queryEmbedding: any[],
  filters: any = {},
  matchCount: number = 15,
  timezoneOffset: number = 0
) {
  try {
    console.log(`Hybrid search for userId: ${userId}`);
    
    // First get vector results
    const vectorResults = await searchEntriesWithVector(userId, queryEmbedding, filters, Math.floor(matchCount * 0.7), timezoneOffset);
    
    // Then get SQL results - use fewer SQL results for hybrid approach
    const sqlResults = await searchEntriesWithSQL(userId, filters, Math.floor(matchCount * 0.5));
    
    // Combine the results, avoiding duplicates
    const seenIds = new Set(vectorResults.map(entry => entry.id));
    const combinedResults = [...vectorResults];
    
    sqlResults.forEach(entry => {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        combinedResults.push(entry);
      }
    });
    
    // Return the combined results, limited to the requested count
    return combinedResults.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesHybrid:', error);
    return [];
  }
}

