import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubQuestion {
  question: string;
  type: 'temporal' | 'emotional' | 'thematic' | 'entity' | 'analytical' | 'contextual';
  priority: number;
  searchStrategy: 'vector' | 'sql' | 'hybrid';
  parameters: {
    timeRange?: { start?: string; end?: string };
    emotions?: string[];
    themes?: string[];
    entities?: string[];
    analysisType?: string;
  };
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, conversationContext = [], userPatterns = {} } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get available themes and emotions from database
    const [themesResult, emotionsResult] = await Promise.all([
      supabase.from('themes').select('name, description').eq('is_active', true),
      supabase.from('emotions').select('name, description')
    ]);

    const availableThemes = themesResult.data?.map(t => `${t.name}: ${t.description}`) || [];
    const availableEmotions = emotionsResult.data?.map(e => `${e.name}: ${e.description}`) || [];

    const systemPrompt = `You are an intelligent sub-question generator for a personal journal analysis system. Your task is to analyze user queries and generate strategic sub-questions that will help retrieve the most relevant information.

DATABASE CONTEXT:
- Available themes: ${availableThemes.slice(0, 20).join(', ')}
- Available emotions: ${availableEmotions.slice(0, 20).join(', ')}
- User patterns: ${JSON.stringify(userPatterns)}

SEARCH STRATEGIES:
- vector: Best for semantic similarity and concept matching
- sql: Best for specific criteria, dates, exact matches
- hybrid: Combination of both for complex queries

GUIDELINES:
1. Generate 1-4 sub-questions based on query complexity
2. Each sub-question should target a specific aspect of the user's inquiry
3. Prioritize questions that will yield the most relevant results
4. Consider user's historical patterns when available
5. Include specific search parameters for each question

RESPONSE FORMAT:
Return a JSON array of SubQuestion objects with this structure:
{
  "question": "specific question to answer",
  "type": "temporal|emotional|thematic|entity|analytical|contextual",
  "priority": 1-5 (higher = more important),
  "searchStrategy": "vector|sql|hybrid",
  "parameters": {
    "timeRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
    "emotions": ["emotion1", "emotion2"],
    "themes": ["theme1", "theme2"],
    "entities": ["entity1", "entity2"],
    "analysisType": "trend|pattern|comparison|summary"
  },
  "reasoning": "why this sub-question is important"
}`;

    const userPrompt = `
User Query: "${userMessage}"

Recent Conversation Context: ${JSON.stringify(conversationContext.slice(-3))}

Generate intelligent sub-questions that will help answer the user's query effectively. Focus on what information would be most valuable to retrieve from their journal entries.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let subQuestions: SubQuestion[];

    try {
      const parsed = JSON.parse(data.choices[0].message.content);
      subQuestions = Array.isArray(parsed) ? parsed : parsed.subQuestions || [];
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      // Fallback to rule-based generation
      subQuestions = generateFallbackSubQuestions(userMessage);
    }

    // Validate and enhance sub-questions
    const validatedSubQuestions = subQuestions
      .filter(sq => sq.question && sq.type && sq.searchStrategy)
      .map(sq => ({
        ...sq,
        priority: Math.max(1, Math.min(5, sq.priority || 3)),
        parameters: {
          ...sq.parameters,
          emotions: sq.parameters?.emotions?.filter(e => 
            availableEmotions.some(ae => ae.toLowerCase().includes(e.toLowerCase()))
          ) || [],
          themes: sq.parameters?.themes?.filter(t => 
            availableThemes.some(at => at.toLowerCase().includes(t.toLowerCase()))
          ) || []
        }
      }))
      .slice(0, 4); // Limit to 4 sub-questions

    return new Response(JSON.stringify({
      success: true,
      subQuestions: validatedSubQuestions,
      metadata: {
        originalQuery: userMessage,
        generationMethod: 'gpt',
        totalSubQuestions: validatedSubQuestions.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-sub-question-generator:', error);
    
    // Fallback to rule-based generation
    const fallbackSubQuestions = generateFallbackSubQuestions(
      req.body ? JSON.parse(await req.text()).userMessage : "analyze my recent entries"
    );

    return new Response(JSON.stringify({
      success: true,
      subQuestions: fallbackSubQuestions,
      metadata: {
        generationMethod: 'fallback',
        error: error.message
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackSubQuestions(userMessage: string): SubQuestion[] {
  const message = userMessage.toLowerCase();
  const subQuestions: SubQuestion[] = [];

  // Basic fallback logic
  if (message.includes('mood') || message.includes('feel')) {
    subQuestions.push({
      question: "What emotions have been most prominent recently?",
      type: 'emotional',
      priority: 4,
      searchStrategy: 'sql',
      parameters: {
        timeRange: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
        analysisType: 'summary'
      },
      reasoning: "User is asking about emotional state"
    });
  }

  if (message.includes('progress') || message.includes('improve')) {
    subQuestions.push({
      question: "What patterns of growth or challenges can be identified?",
      type: 'analytical',
      priority: 5,
      searchStrategy: 'hybrid',
      parameters: {
        timeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
        analysisType: 'trend'
      },
      reasoning: "User is interested in progress analysis"
    });
  }

  // Default contextual question
  subQuestions.push({
    question: "What are the most relevant recent entries?",
    type: 'contextual',
    priority: 3,
    searchStrategy: 'vector',
    parameters: {},
    reasoning: "General context retrieval"
  });

  return subQuestions;
}