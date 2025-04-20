
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

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define available database functions for GPT to call
const availableFunctions = [
  {
    name: "match_entries_by_vector_similarity",
    description: "Find journal entries similar to the query using vector search",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        matchThreshold: {
          type: "number",
          description: "Similarity threshold (0.0-1.0, typically 0.5)"
        },
        matchCount: {
          type: "integer",
          description: "Maximum number of entries to return"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        }
      },
      required: ["userId"]
    }
  },
  {
    name: "match_entries_by_emotion",
    description: "Find journal entries containing a specific emotion with intensity above threshold",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        emotion: {
          type: "string",
          description: "Name of the emotion to search for"
        },
        minScore: {
          type: "number",
          description: "Minimum emotion intensity score (0.0-1.0)"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        },
        limitCount: {
          type: "integer",
          description: "Maximum number of entries to return"
        }
      },
      required: ["userId", "emotion"]
    }
  },
  {
    name: "get_top_emotions",
    description: "Get the top emotions across journal entries in a time period",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        },
        limitCount: {
          type: "integer",
          description: "Maximum number of emotions to return"
        }
      },
      required: ["userId"]
    }
  },
  {
    name: "match_entries_by_theme",
    description: "Find journal entries related to a specific theme or topic",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        themeQuery: {
          type: "string",
          description: "Theme or topic to search for"
        },
        matchThreshold: {
          type: "number",
          description: "Similarity threshold (0.0-1.0)"
        },
        matchCount: {
          type: "integer",
          description: "Maximum number of entries to return"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        }
      },
      required: ["userId", "themeQuery"]
    }
  },
  {
    name: "analyze_time_patterns",
    description: "Analyze patterns in journal entries over time periods",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        timeUnit: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Time unit for pattern analysis"
        },
        aspectToAnalyze: {
          type: "string",
          enum: ["emotions", "themes", "sentiment"],
          description: "Which aspect to analyze for patterns"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        }
      },
      required: ["userId", "timeUnit", "aspectToAnalyze"]
    }
  },
  {
    name: "track_entity_mentions",
    description: "Track mentions of a specific person, place, or entity over time",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "UUID of the user"
        },
        entityName: {
          type: "string",
          description: "Name of the entity to track (e.g., 'wife', 'job', 'yoga')"
        },
        startDate: {
          type: "string",
          description: "Optional ISO date string for start of time range"
        },
        endDate: {
          type: "string",
          description: "Optional ISO date string for end of time range"
        },
        includeEmotions: {
          type: "boolean",
          description: "Whether to include emotion data with entity mentions"
        }
      },
      required: ["userId", "entityName"]
    }
  }
];

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Smart Orchestrator: Processing query for user ${userId}: "${message.substring(0, 100)}..."`);
    
    // Step 1: Send the query to the planner to create an execution plan
    const planningResponse = await createExecutionPlan(message, userId);
    console.log("Planning completed, executing plan...");
    
    // Step 2: Execute the plan and gather results
    const results = await executePlan(planningResponse, userId);
    console.log("Plan execution completed, generating final response...");
    
    // Step 3: Generate final response based on results
    const finalResponse = await generateResponse(message, results, userId, threadId);
    console.log("Final response generated");
    
    return new Response(
      JSON.stringify({ 
        response: finalResponse,
        planDetails: planningResponse.plan,
        executionResults: results
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Smart Orchestrator Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Function to create an execution plan using GPT
async function createExecutionPlan(query: string, userId: string) {
  try {
    console.log("Creating execution plan with GPT-4o...");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI query planner for a journaling app. Your job is to analyze user questions and create an execution plan that uses available database functions to retrieve and analyze relevant journal data.

Given a user's question, you need to:
1. Understand what the user is asking about (emotions, relationships, patterns, specific people/entities)
2. Determine what time period is relevant (recent, specific dates, all time)
3. Create a logical sequence of database function calls to gather the necessary data
4. For each function call, specify the exact parameters needed

The available database functions are described in the "functions" property. You must only use these functions.

Some examples:
- For "How have I been feeling lately?", you should use get_top_emotions with recent dates
- For "What have I written about my wife?", use track_entity_mentions with entityName="wife"
- For "Am I happier on weekends?", use analyze_time_patterns with timeUnit="day" and aspectToAnalyze="emotions"

Your response should be a detailed execution plan in JSON format with reasoning for each step.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        functions: availableFunctions,
        function_call: { name: "createPlan" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create execution plan:', error);
      throw new Error('Failed to create execution plan');
    }

    const data = await response.json();
    
    // Extract the function calls from the response
    const functionCalls = [];
    const planExplanation = [];
    
    // Check if there are function calls in the response
    if (data.choices[0].message.function_call) {
      try {
        // Try to parse the function arguments as JSON
        const functionCall = data.choices[0].message.function_call;
        const parsedArgs = JSON.parse(functionCall.arguments);
        functionCalls.push({
          name: functionCall.name,
          arguments: parsedArgs
        });
      } catch (e) {
        console.error("Failed to parse function arguments:", e);
        // If parsing fails, try to extract functions from the content
        const content = data.choices[0].message.content;
        if (content) {
          planExplanation.push(content);
        }
      }
    } else if (data.choices[0].message.content) {
      // If there's no function call, look for functions in the content
      const content = data.choices[0].message.content;
      planExplanation.push(content);
      
      // Try to extract JSON from the content
      try {
        const jsonMatch = content.match(/```json([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          const jsonPlan = JSON.parse(jsonMatch[1].trim());
          if (jsonPlan.steps && Array.isArray(jsonPlan.steps)) {
            functionCalls.push(...jsonPlan.steps);
          }
        }
      } catch (e) {
        console.error("Failed to extract JSON plan from content:", e);
      }
    }
    
    // If we couldn't extract any function calls, create a fallback plan
    if (functionCalls.length === 0) {
      // Create a fallback plan with vector search
      functionCalls.push({
        name: "match_entries_by_vector_similarity",
        arguments: {
          userId,
          matchThreshold: 0.5,
          matchCount: 10
        }
      });
    }
    
    return {
      plan: {
        steps: functionCalls,
        explanation: planExplanation.join("\n")
      }
    };
  } catch (error) {
    console.error('Error in createExecutionPlan:', error);
    throw error;
  }
}

// Function to execute the plan and gather results
async function executePlan(planningResponse: any, userId: string) {
  const results = [];
  const steps = planningResponse.plan.steps;
  
  console.log(`Executing plan with ${steps.length} steps`);
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`Executing step ${i+1}: ${step.name}`);
    
    try {
      let stepResult;
      
      // Execute the appropriate function based on the step name
      switch (step.name) {
        case "match_entries_by_vector_similarity":
          stepResult = await executeFunctionMatchEntriesByVectorSimilarity(step.arguments, userId);
          break;
        case "match_entries_by_emotion":
          stepResult = await executeFunctionMatchEntriesByEmotion(step.arguments, userId);
          break;
        case "get_top_emotions":
          stepResult = await executeFunctionGetTopEmotions(step.arguments, userId);
          break;
        case "match_entries_by_theme":
          stepResult = await executeFunctionMatchEntriesByTheme(step.arguments, userId);
          break;
        case "analyze_time_patterns":
          stepResult = await executeFunctionAnalyzeTimePatterns(step.arguments, userId);
          break;
        case "track_entity_mentions":
          stepResult = await executeFunctionTrackEntityMentions(step.arguments, userId);
          break;
        default:
          console.warn(`Unknown function: ${step.name}, skipping`);
          stepResult = { error: `Unknown function: ${step.name}` };
      }
      
      results.push({
        stepName: step.name,
        stepArguments: step.arguments,
        result: stepResult
      });
      
      console.log(`Step ${i+1} completed`);
    } catch (error) {
      console.error(`Error executing step ${i+1}:`, error);
      results.push({
        stepName: step.name,
        stepArguments: step.arguments,
        error: error.message
      });
    }
  }
  
  return results;
}

// Implementation of each function executor
async function executeFunctionMatchEntriesByVectorSimilarity(args: any, userId: string) {
  try {
    console.log("Executing vector similarity search with args:", JSON.stringify(args));
    
    // Ensure the query embedding is generated
    const queryEmbedding = await generateEmbedding(args.query || "journal entries");
    
    // Call the database function
    let { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: args.matchThreshold || 0.5,
        match_count: args.matchCount || 10,
        user_id_filter: userId,
        start_date: args.startDate || null,
        end_date: args.endDate || null
      }
    );
    
    if (error) {
      console.error("Error in vector similarity search:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in executeFunctionMatchEntriesByVectorSimilarity:", error);
    throw error;
  }
}

async function executeFunctionMatchEntriesByEmotion(args: any, userId: string) {
  try {
    console.log("Executing emotion-based search with args:", JSON.stringify(args));
    
    // Call the database function
    let { data, error } = await supabase.rpc(
      'match_journal_entries_by_emotion',
      {
        emotion_name: args.emotion,
        user_id_filter: userId,
        min_score: args.minScore || 0.3,
        start_date: args.startDate || null,
        end_date: args.endDate || null,
        limit_count: args.limitCount || 5
      }
    );
    
    if (error) {
      console.error("Error in emotion-based search:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in executeFunctionMatchEntriesByEmotion:", error);
    throw error;
  }
}

async function executeFunctionGetTopEmotions(args: any, userId: string) {
  try {
    console.log("Executing get top emotions with args:", JSON.stringify(args));
    
    // Call the database function
    let { data, error } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
        user_id_param: userId,
        start_date: args.startDate || null,
        end_date: args.endDate || null,
        limit_count: args.limitCount || 3
      }
    );
    
    if (error) {
      console.error("Error in get top emotions:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in executeFunctionGetTopEmotions:", error);
    throw error;
  }
}

async function executeFunctionMatchEntriesByTheme(args: any, userId: string) {
  try {
    console.log("Executing theme-based search with args:", JSON.stringify(args));
    
    // Call the database function
    let { data, error } = await supabase.rpc(
      'match_journal_entries_by_theme',
      {
        theme_query: args.themeQuery,
        user_id_filter: userId,
        match_threshold: args.matchThreshold || 0.5,
        match_count: args.matchCount || 5,
        start_date: args.startDate || null,
        end_date: args.endDate || null
      }
    );
    
    if (error) {
      console.error("Error in theme-based search:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in executeFunctionMatchEntriesByTheme:", error);
    throw error;
  }
}

async function executeFunctionAnalyzeTimePatterns(args: any, userId: string) {
  try {
    console.log("Executing time pattern analysis with args:", JSON.stringify(args));
    
    // This would normally call a real-time pattern analysis function
    // For now, we'll use a simplified approach by fetching journal entries
    // and analyzing them client-side
    
    // Get journal entries in the specified time range
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, created_at, emotions, master_themes, sentiment')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (entriesError) {
      console.error("Error fetching entries for time pattern analysis:", entriesError);
      throw entriesError;
    }
    
    // Group entries by the specified time unit
    const groupedEntries = {};
    const timeUnitMap = {
      'day': (date) => date.getDay(), // 0-6 for Sunday-Saturday
      'week': (date) => Math.floor(date.getDate() / 7), // 0-4 for week of month
      'month': (date) => date.getMonth() // 0-11 for Jan-Dec
    };
    
    const timeUnitLabels = {
      'day': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      'week': ['First Week', 'Second Week', 'Third Week', 'Fourth Week', 'Fifth Week'],
      'month': ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December']
    };
    
    // Initialize groups
    const groupFunction = timeUnitMap[args.timeUnit] || timeUnitMap.day;
    const labels = timeUnitLabels[args.timeUnit] || timeUnitLabels.day;
    
    labels.forEach((label, index) => {
      groupedEntries[index] = {
        label,
        entries: [],
        emotions: {},
        themes: {},
        avgSentiment: 0
      };
    });
    
    // Group entries
    (entriesData || []).forEach(entry => {
      const date = new Date(entry.created_at);
      const groupIndex = groupFunction(date);
      
      if (groupedEntries[groupIndex]) {
        groupedEntries[groupIndex].entries.push(entry);
        
        // Aggregate emotions
        if (entry.emotions) {
          Object.entries(entry.emotions).forEach(([emotion, score]) => {
            if (!groupedEntries[groupIndex].emotions[emotion]) {
              groupedEntries[groupIndex].emotions[emotion] = [];
            }
            groupedEntries[groupIndex].emotions[emotion].push(Number(score));
          });
        }
        
        // Aggregate themes
        if (entry.master_themes && Array.isArray(entry.master_themes)) {
          entry.master_themes.forEach(theme => {
            if (!groupedEntries[groupIndex].themes[theme]) {
              groupedEntries[groupIndex].themes[theme] = 0;
            }
            groupedEntries[groupIndex].themes[theme]++;
          });
        }
        
        // Aggregate sentiment
        if (entry.sentiment !== null && entry.sentiment !== undefined) {
          const sentiment = parseFloat(entry.sentiment);
          if (!isNaN(sentiment)) {
            groupedEntries[groupIndex].entries.forEach(e => e.sentiment = 0);
            groupedEntries[groupIndex].entries[groupedEntries[groupIndex].entries.length - 1].sentiment = sentiment;
          }
        }
      }
    });
    
    // Calculate averages and prepare results
    const results = Object.entries(groupedEntries).map(([index, group]) => {
      // Average emotions
      const avgEmotions = {};
      Object.entries(group.emotions).forEach(([emotion, scores]) => {
        avgEmotions[emotion] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      });
      
      // Sort themes by frequency
      const sortedThemes = Object.entries(group.themes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count }));
      
      // Calculate average sentiment
      const sentiments = group.entries
        .map(e => parseFloat(e.sentiment))
        .filter(s => !isNaN(s));
      
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
        : 0;
      
      return {
        timeUnit: labels[index],
        entryCount: group.entries.length,
        avgEmotions,
        topThemes: sortedThemes,
        avgSentiment,
        timeUnitIndex: parseInt(index)
      };
    }).sort((a, b) => a.timeUnitIndex - b.timeUnitIndex);
    
    return results;
  } catch (error) {
    console.error("Error in executeFunctionAnalyzeTimePatterns:", error);
    throw error;
  }
}

async function executeFunctionTrackEntityMentions(args: any, userId: string) {
  try {
    console.log("Executing entity tracking with args:", JSON.stringify(args));
    
    // For now, use a simpler text search approach
    const { data, error } = await supabase.rpc(
      'get_entries_by_emotion_term',
      {
        emotion_term: args.entityName,
        user_id_filter: userId,
        start_date: args.startDate || null,
        end_date: args.endDate || null,
        limit_count: 10
      }
    );
    
    if (error) {
      console.error("Error in entity tracking:", error);
      throw error;
    }
    
    // If includeEmotions is true, fetch emotion data for these entries
    if (args.includeEmotions && data && data.length > 0) {
      const entryIds = data.map(entry => entry.id);
      
      const { data: entriesWithEmotions, error: emotionsError } = await supabase
        .from('Journal Entries')
        .select('id, emotions, sentiment, created_at')
        .in('id', entryIds);
      
      if (emotionsError) {
        console.error("Error fetching emotions data:", emotionsError);
      } else if (entriesWithEmotions) {
        // Merge emotion data with the original results
        const entriesMap = {};
        entriesWithEmotions.forEach(entry => {
          entriesMap[entry.id] = entry;
        });
        
        return data.map(entry => ({
          ...entry,
          emotions: entriesMap[entry.id]?.emotions || null,
          sentiment: entriesMap[entry.id]?.sentiment || null
        }));
      }
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in executeFunctionTrackEntityMentions:", error);
    throw error;
  }
}

// Function to generate final response based on results
async function generateResponse(query: string, results: any[], userId: string, threadId: string | null = null) {
  try {
    console.log("Generating final response from execution results...");
    
    // Format the results for presentation to GPT
    const formattedResults = results.map(result => {
      return {
        step: result.stepName,
        arguments: result.stepArguments,
        data: result.result || [],
        error: result.error || null
      };
    });
    
    // Check if there are any valid results
    const hasValidResults = formattedResults.some(r => 
      Array.isArray(r.data) && r.data.length > 0
    );
    
    if (!hasValidResults) {
      return "I don't have enough journal data to answer that question. Try asking about something you've written about in your journal.";
    }
    
    // Call GPT-4o to generate the final response
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that analyzes journal entries. Your job is to interpret the results of database queries on a user's journal entries and provide a clear, helpful response.

The user asked: "${query}"

I've executed a series of database functions to retrieve relevant information. Your job is to:
1. Analyze the results
2. Identify patterns, trends, or key insights
3. Present this information in a clear, conversational way
4. Reference specific journal entries as evidence when helpful
5. Be empathetic and supportive when discussing emotional content
6. Be concise - keep your response under 250 words unless the complexity of the data requires more

Important guidelines:
- If the results are empty or insufficient, acknowledge the limitations rather than making things up
- Focus on answering the specific question asked
- Don't include technical details about the database functions
- Structure longer responses with headings or bullet points for readability
- If discussing relationships, be objective and non-judgmental
- Express confidence when the data clearly supports a conclusion, and appropriate uncertainty when it doesn't`
          },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              executionResults: formattedResults
            })
          }
        ],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to generate final response:', error);
      throw new Error('Failed to generate final response');
    }

    const data = await response.json();
    const finalResponse = data.choices[0]?.message?.content || 
      "I'm sorry, I couldn't analyze your journal entries effectively. Please try asking in a different way.";
    
    return finalResponse;
  } catch (error) {
    console.error('Error in generateResponse:', error);
    return "I encountered an error while analyzing your journal entries. Please try again later.";
  }
}

// Helper function to generate an embedding
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000) // Limit to 8000 chars
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Embedding API error:", errorText);
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error("[AI] Error in generateEmbedding:", error);
    throw error;
  }
}
