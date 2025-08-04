import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SelectionResult {
  themes: {
    name: string;
    relevanceScore: number;
    reasoning: string;
  }[];
  emotions: {
    name: string;
    relevanceScore: number;
    reasoning: string;
  }[];
  entities: {
    name: string;
    type: string;
    relevanceScore: number;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subQuestions, userQuery, userContext = {} } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get all available themes and emotions from database
    const [themesResult, emotionsResult] = await Promise.all([
      supabase.from('themes').select('*').eq('is_active', true).order('display_order'),
      supabase.from('emotions').select('*').order('name')
    ]);

    const availableThemes = themesResult.data || [];
    const availableEmotions = emotionsResult.data || [];

    const systemPrompt = `You are an intelligent theme and emotion selector for a personal journal analysis system. Your task is to identify the most relevant themes, emotions, and entities based on user queries and sub-questions.

AVAILABLE THEMES:
${availableThemes.map(t => `- ${t.name}: ${t.description} (Category: ${t.category_type})`).join('\n')}

AVAILABLE EMOTIONS:
${availableEmotions.map(e => `- ${e.name}: ${e.description || 'Core emotion'}`).join('\n')}

ENTITY TYPES TO CONSIDER:
- PERSON: People mentioned in entries
- LOCATION: Places, locations
- ORGANIZATION: Companies, groups, institutions  
- EVENT: Specific events or occasions
- ACTIVITY: Hobbies, exercises, activities
- OBJECT: Important items or possessions
- CONCEPT: Abstract concepts or ideas

GUIDELINES:
1. Select only highly relevant themes/emotions (relevance score > 0.7)
2. Consider both explicit and implicit relevance
3. Prioritize themes/emotions that appear in multiple sub-questions
4. Include potential entities that might be relevant for search
5. Provide clear reasoning for each selection
6. Limit selections to most important items (max 5 themes, 5 emotions, 10 entities)

RESPONSE FORMAT:
Return a JSON object with the SelectionResult structure containing themes, emotions, and entities arrays.`;

    const userPrompt = `
Original User Query: "${userQuery}"

Sub-questions: ${JSON.stringify(subQuestions)}

User Context: ${JSON.stringify(userContext)}

Select the most relevant themes, emotions, and potential entities that should be used for searching and analyzing journal entries to answer these questions effectively.`;

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
    let selectionResult: SelectionResult;

    try {
      selectionResult = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      selectionResult = generateFallbackSelection(subQuestions, availableThemes, availableEmotions);
    }

    // Validate selections against available themes/emotions
    const validatedResult = {
      themes: selectionResult.themes
        ?.filter(t => availableThemes.some(at => at.name.toLowerCase() === t.name.toLowerCase()))
        .map(t => ({
          ...t,
          relevanceScore: Math.max(0, Math.min(1, t.relevanceScore))
        }))
        .slice(0, 5) || [],
      
      emotions: selectionResult.emotions
        ?.filter(e => availableEmotions.some(ae => ae.name.toLowerCase() === e.name.toLowerCase()))
        .map(e => ({
          ...e,
          relevanceScore: Math.max(0, Math.min(1, e.relevanceScore))
        }))
        .slice(0, 5) || [],
      
      entities: selectionResult.entities
        ?.map(e => ({
          ...e,
          relevanceScore: Math.max(0, Math.min(1, e.relevanceScore))
        }))
        .slice(0, 10) || []
    };

    return new Response(JSON.stringify({
      success: true,
      selections: validatedResult,
      metadata: {
        originalQuery: userQuery,
        selectionMethod: 'gpt',
        totalSelections: {
          themes: validatedResult.themes.length,
          emotions: validatedResult.emotions.length,
          entities: validatedResult.entities.length
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-theme-emotion-selector:', error);
    
    // Fallback to rule-based selection
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    const [themesResult, emotionsResult] = await Promise.all([
      supabase.from('themes').select('*').eq('is_active', true).limit(10),
      supabase.from('emotions').select('*').limit(10)
    ]);

    const fallbackSelection = generateFallbackSelection(
      JSON.parse(await req.text()).subQuestions || [],
      themesResult.data || [],
      emotionsResult.data || []
    );

    return new Response(JSON.stringify({
      success: true,
      selections: fallbackSelection,
      metadata: {
        selectionMethod: 'fallback',
        error: error.message
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackSelection(subQuestions: any[], themes: any[], emotions: any[]): SelectionResult {
  const query = subQuestions.map(sq => sq.question).join(' ').toLowerCase();
  
  const relevantThemes = themes
    .filter(theme => 
      query.includes(theme.name.toLowerCase()) || 
      theme.description?.toLowerCase().split(' ').some((word: string) => query.includes(word))
    )
    .slice(0, 3)
    .map(theme => ({
      name: theme.name,
      relevanceScore: 0.8,
      reasoning: 'Rule-based selection based on keyword matching'
    }));

  const relevantEmotions = emotions
    .filter(emotion => 
      query.includes(emotion.name.toLowerCase()) ||
      query.includes('feel') || query.includes('mood') || query.includes('emotion')
    )
    .slice(0, 3)
    .map(emotion => ({
      name: emotion.name,
      relevanceScore: 0.8,
      reasoning: 'Rule-based selection based on emotional context'
    }));

  const basicEntities = [
    { name: 'work', type: 'ACTIVITY', relevanceScore: 0.7 },
    { name: 'family', type: 'PERSON', relevanceScore: 0.7 },
    { name: 'home', type: 'LOCATION', relevanceScore: 0.6 }
  ].filter(entity => query.includes(entity.name));

  return {
    themes: relevantThemes,
    emotions: relevantEmotions,
    entities: basicEntities
  };
}