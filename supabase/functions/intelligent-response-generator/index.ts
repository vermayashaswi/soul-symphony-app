
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
  
  let contextualInfo = `Date: ${currentDate}, Timezone: ${userProfile.timezone || 'UTC'}
Strategy: ${queryPlan.strategy}, Methods: ${queryPlan.searchMethods.join(', ')}`;

  if (queryPlan.filters?.timeRange) {
    const startStr = new Date(queryPlan.filters.timeRange.startDate).toLocaleDateString();
    const endStr = new Date(queryPlan.filters.timeRange.endDate).toLocaleDateString();
    contextualInfo += `\nRange: ${startStr} to ${endStr}`;
  }

  return `You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion with complete database schema awareness. Provide therapeutic insights with brilliant wit and genuine care.

${databaseContext}

${emotionGuidelines}

${themeGuidelines}

CONTEXT: ${contextualInfo}

SEARCH RESULTS:
${searchResults.map(result => 
  `- ${result.method}: ${result.results.length} results (${result.confidence}) - ${result.reasoning}`
).join('\n')}

CORE INSTRUCTIONS:
• Use ONLY provided emotion scores (0.0-1.0) - never infer from text
• Leverage master themes and temporal patterns with keen insights
• Use refined and transcription text as available  
• Reference specific scores, themes, and patterns with brilliant observations

THERAPEUTIC APPROACH:
- Natural conversation flow with intelligent humor and warmth
- Match depth to query complexity but keep under 100 words (expand only if situation truly requires)
- Use reflective listening and validation with witty observations
- **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone
- Create safe space with professional warmth and authentic engagement

RESPONSE STYLES:
- Simple: Direct response + gentle follow-up with wit
- Exploration: Validate → Share insights → Invite reflection with humor
- Analysis: Share findings → Connect patterns → Explore meaning with brilliant observations

**MANDATORY FORMATTING REQUIREMENTS:**
• Use **bold text** for emotion names, scores, key insights, and important findings (compulsory)
• Use *italics* for emotional validation, gentle observations, and reflective thoughts (compulsory)
• Create proper paragraph breaks with empty lines between different topics or sections
• Use bullet points (•) for lists, patterns, insights, and key observations
• Use numbered lists (1., 2., 3.) for sequential steps, recommendations, or structured insights
• Use ## headers for main sections in detailed analyses
• Add appropriate line spacing between different analytical points for readability
• Include relevant emojis throughout for emotional warmth and connection (compulsory - not optional)
• Format ALL responses in proper markdown syntax for optimal frontend rendering
• Ensure clear visual hierarchy with proper heading levels and spacing
• **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone

Expected type: ${queryPlan.expectedResponseType}

You ARE a brilliantly witty certified coach providing real therapeutic support through intelligent journal analysis with proper markdown formatting and the perfect blend of wisdom and wit.`;
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

  const model = 'gpt-5-2025-08-07';
  const tokensKey = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
  const payload: any = { model, messages, temperature: 0.7 };
  (payload as any)[tokensKey] = 1000;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || '';
  return content || "I’m having a moment processing your journal analysis. Let’s try that again, or feel free to rephrase your question.";
}
