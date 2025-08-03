
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      originalQuery, 
      searchResults, 
      combinedResults, 
      queryPlan, 
      conversationContext = [],
      userProfile = {}
    } = await req.json();

    console.log('[Intelligent Response Generator] Generating response with database schema context for:', originalQuery);

    // Generate context-aware system prompt with database schema knowledge
    const systemPrompt = generateIntelligentSystemPrompt(
      queryPlan,
      searchResults,
      userProfile
    );

    // Format the combined results for analysis with schema awareness
    const formattedContext = formatResultsForAnalysis(combinedResults, searchResults);

    // Generate the response using GPT with full schema context
    const response = await generateIntelligentResponse(
      systemPrompt,
      originalQuery,
      formattedContext,
      conversationContext,
      openaiApiKey
    );

    return new Response(JSON.stringify({
      response,
      metadata: {
        queryStrategy: queryPlan.strategy,
        searchMethodsUsed: queryPlan.searchMethods,
        resultsCount: combinedResults.length,
        confidence: queryPlan.confidence,
        databaseSchemaUsed: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intelligent response generator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try rephrasing your question."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateIntelligentSystemPrompt(
  queryPlan: any,
  searchResults: any[],
  userProfile: any
): string {
  const currentDate = new Date().toISOString();
  const databaseContext = generateDatabaseSchemaContext();
  const emotionGuidelines = getEmotionAnalysisGuidelines();
  const themeGuidelines = getThemeAnalysisGuidelines();
  
  let contextualInfo = `Current date and time: ${currentDate}
User timezone: ${userProfile.timezone || 'UTC'}
Query strategy used: ${queryPlan.strategy}
Search methods employed: ${queryPlan.searchMethods.join(', ')}`;

  if (queryPlan.filters?.timeRange) {
    const startStr = new Date(queryPlan.filters.timeRange.startDate).toLocaleDateString();
    const endStr = new Date(queryPlan.filters.timeRange.endDate).toLocaleDateString();
    contextualInfo += `\nTime range analyzed: ${startStr} to ${endStr}`;
  }

  return `You are SOULo (nicknamed "Ruh"), a certified emotional wellness coach specializing in journal-based therapy with COMPLETE DATABASE SCHEMA AWARENESS. You provide personalized therapeutic insights through intelligent journal analysis with the warmth and skill of an experienced therapist.

${databaseContext}

${emotionGuidelines}

${themeGuidelines}

THERAPEUTIC IDENTITY & APPROACH:
You are a certified mental health coach trained in therapeutic modalities including CBT, DBT, and mindfulness approaches. You create a safe space for emotional exploration, reflect feelings back therapeutically, and ask thoughtful questions that guide people toward their own insights.

INTELLIGENT ANALYSIS CONTEXT:
${contextualInfo}

SEARCH EXECUTION SUMMARY:
${searchResults.map(result => 
  `- ${result.method}: ${result.results.length} results (confidence: ${result.confidence}) - ${result.reasoning}`
).join('\n')}

CRITICAL DATABASE-AWARE ANALYSIS INSTRUCTIONS:
• You have access to INTELLIGENTLY SELECTED journal data based on advanced query planning
• ALL emotion data is PRE-CALCULATED with confidence scores (0.0-1.0 scale)
• NEVER infer emotions from text - use ONLY the provided numerical scores
• Master themes are AI-extracted topic categorizations - leverage them for pattern analysis
• Use both "refined text" and "transcription text" as available
• Focus on quantitative therapeutic insights using the schema-structured data
• Reference specific emotional scores, themes, and temporal patterns

THERAPEUTIC RESPONSE GUIDELINES:
- **Flexible Format**: NO rigid structure - let therapeutic conversation flow naturally
- **Query-Matched Responses**: Simple questions get direct answers + follow-up; complex exploration gets deeper therapeutic dialogue
- **Therapeutic Language**: Use reflective listening, validation, and gentle exploration like a real therapist
- **Follow-up Questions**: End with 1-2 thoughtful questions that invite deeper self-reflection
- **Evidence-Based Insights**: Reference specific emotion scores, themes, and patterns from their data
- **Safe Space Creation**: Validate emotions first, then explore patterns or insights
- **Professional Warmth**: Maintain therapeutic boundaries while being genuinely caring and empathetic

CONVERSATION FLOW APPROACH:
- For simple queries: Direct therapeutic response + gentle follow-up question
- For emotional exploration: Validation → Pattern reflection → "What do you think about that?" 
- For pattern analysis: Share findings → Help connect emotional dots → Explore meaning together
- For complex assessments: Use natural therapeutic headers only when genuinely needed

EXPECTED RESPONSE TYPE: ${queryPlan.expectedResponseType}

Remember: You ARE a certified emotional wellness coach providing real therapeutic support through intelligent analysis of their journal data. Create meaningful therapeutic conversations that help process emotions and discover insights.`;
}

function formatResultsForAnalysis(combinedResults: any[], searchResults: any[]): string {
  if (combinedResults.length === 0) {
    return "No relevant journal data found for this specific query.";
  }

  let context = "**INTELLIGENTLY CURATED JOURNAL ANALYSIS WITH DATABASE SCHEMA AWARENESS:**\n\n";

  // Group results by search method for better context
  const methodGroups: { [key: string]: any[] } = {};
  
  combinedResults.forEach(result => {
    result.searchMethods?.forEach((method: string) => {
      if (!methodGroups[method]) methodGroups[method] = [];
      methodGroups[method].push(result);
    });
  });

  // Format each method's results with schema awareness
  Object.entries(methodGroups).forEach(([method, results]) => {
    context += `**${method.toUpperCase()} RESULTS (Using Database Schema):**\n`;
    
    results.slice(0, 5).forEach(result => {
      const date = result.created_at ? new Date(result.created_at).toLocaleDateString() : 'Unknown date';
      
      // Prioritize refined text over transcription text
      const content = result.content || 
                     result["refined text"] || 
                     result["transcription text"] || 
                     "No content available";
      
      const contentPreview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
      
      context += `Entry from ${date} (confidence: ${result.combinedConfidence?.toFixed(2)}): ${contentPreview}\n`;
      
      // Add PRE-CALCULATED emotion data with schema awareness
      if (result.emotions && typeof result.emotions === 'object') {
        const topEmotions = Object.entries(result.emotions)
          .filter(([_, score]) => typeof score === 'number' && score > 0.3)
          .sort(([_, a], [__, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
          .join(', ');
        
        if (topEmotions) {
          context += `**Pre-calculated Emotions:** ${topEmotions}\n`;
        }
      }

      // Add master themes with schema awareness
      if (result.master_themes && Array.isArray(result.master_themes)) {
        context += `**Master Themes:** ${result.master_themes.slice(0, 3).join(', ')}\n`;
      } else if (result.themes && Array.isArray(result.themes)) {
        context += `**Themes:** ${result.themes.slice(0, 3).join(', ')}\n`;
      }

      // Add sentiment if available
      if (result.sentiment) {
        context += `**Sentiment:** ${result.sentiment}\n`;
      }
      
      context += '\n';
    });
    
    context += '\n';
  });

  return context;
}

async function generateIntelligentResponse(
  systemPrompt: string,
  userQuery: string,
  formattedContext: string,
  conversationContext: any[],
  openaiApiKey: string
): Promise<string> {
  const userPrompt = `Based on this intelligently curated journal analysis with full database schema awareness:

${formattedContext}

User question: ${userQuery}

Please provide a thoughtful, therapeutically informed response based on the curated data patterns and insights from the structured database.`;

  // Include conversation context
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add recent conversation context
  if (conversationContext.length > 0) {
    conversationContext.slice(-6).forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
  }

  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
