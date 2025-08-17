
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      userMessage, 
      researchResults = [], 
      conversationContext = [],
      userProfile = {},
      threadId = null,
      messageId = null,
      queryPlan = {}
    } = await req.json();

    console.log('[GPT Response Consolidator] Processing results:', {
      userMessage: userMessage?.substring(0, 50) + '...',
      researchResultsCount: researchResults.length,
      contextLength: conversationContext.length,
      queryStrategy: queryPlan?.strategy
    });

    // Validate input parameters
    if (!userMessage) {
      throw new Error('userMessage is required');
    }

    // Ensure researchResults is an array
    const safeResearchResults = Array.isArray(researchResults) ? researchResults : [];

    // Format research results for GPT analysis
    const formattedResults = formatResearchResults(safeResearchResults);

    // Generate comprehensive system prompt
    const systemPrompt = generateSystemPrompt(userProfile, queryPlan);

    // Create the user prompt with formatted results
    const userPrompt = `Based on this comprehensive journal analysis:

${formattedResults}

User question: "${userMessage}"

Please provide a thoughtful, therapeutically informed response based on the analysis results and patterns from the user's journal data.`;

    // Build conversation messages
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

    // Generate response using GPT-4.1
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedResponse = data?.choices?.[0]?.message?.content?.trim() || '';

    if (!generatedResponse) {
      throw new Error('Empty response from GPT');
    }

    console.log('[GPT Response Consolidator] Response generated successfully');

    return new Response(JSON.stringify({
      response: generatedResponse,
      metadata: {
        researchResultsProcessed: safeResearchResults.length,
        queryStrategy: queryPlan?.strategy,
        confidence: queryPlan?.confidence,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GPT Response Consolidator] Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try rephrasing your question."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatResearchResults(researchResults: any[]): string {
  if (!researchResults || researchResults.length === 0) {
    return "No relevant journal data found for this specific query.";
  }

  let formattedText = "**COMPREHENSIVE JOURNAL ANALYSIS RESULTS:**\n\n";

  researchResults.forEach((subQuestion, index) => {
    formattedText += `**Sub-Question ${index + 1}: ${subQuestion.question}**\n`;
    if (subQuestion.purpose) {
      formattedText += `Purpose: ${subQuestion.purpose}\n`;
    }
    formattedText += '\n';

    if (subQuestion.results && subQuestion.results.length > 0) {
      subQuestion.results.forEach((stepResult: any, stepIndex: number) => {
        formattedText += `  **Step ${stepResult.step}**: ${stepResult.description}\n`;
        formattedText += `  Query Type: ${stepResult.queryType}\n`;

        if (stepResult.error) {
          formattedText += `  ⚠️ Error: ${stepResult.error}\n`;
        } else if (stepResult.result && Array.isArray(stepResult.result)) {
          formattedText += `  Results: ${stepResult.result.length} entries found\n`;
          
          // Show sample results
          stepResult.result.slice(0, 3).forEach((entry: any, entryIndex: number) => {
            formattedText += `    Entry ${entryIndex + 1}:\n`;
            
            // Format entry content
            const content = entry.content || 
                           entry["refined text"] || 
                           entry["transcription text"] || 
                           "No content available";
            formattedText += `    Content: ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}\n`;
            
            // Add date if available
            if (entry.created_at) {
              formattedText += `    Date: ${new Date(entry.created_at).toLocaleDateString()}\n`;
            }
            
            // Add emotions if available
            if (entry.emotions && typeof entry.emotions === 'object') {
              const topEmotions = Object.entries(entry.emotions)
                .filter(([_, score]) => typeof score === 'number' && score > 0.3)
                .sort(([_, a], [__, b]) => (b as number) - (a as number))
                .slice(0, 3)
                .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
                .join(', ');
              
              if (topEmotions) {
                formattedText += `    **Emotions**: ${topEmotions}\n`;
              }
            }

            // Add themes if available
            if (entry.master_themes && Array.isArray(entry.master_themes)) {
              formattedText += `    **Themes**: ${entry.master_themes.slice(0, 3).join(', ')}\n`;
            }

            // Add similarity score if available
            if (typeof entry.similarity === 'number') {
              formattedText += `    Similarity: ${entry.similarity.toFixed(3)}\n`;
            }

            formattedText += '\n';
          });

          if (stepResult.result.length > 3) {
            formattedText += `    ... and ${stepResult.result.length - 3} more entries\n`;
          }
        } else if (stepResult.result) {
          formattedText += `  Result: ${JSON.stringify(stepResult.result)}\n`;
        }
        
        formattedText += '\n';
      });
    } else {
      formattedText += "  No results found for this sub-question.\n\n";
    }
  });

  return formattedText;
}

function generateSystemPrompt(userProfile: any, queryPlan: any): string {
  const currentDate = new Date().toISOString();
  const userTimezone = userProfile?.timezone || 'UTC';
  
  return `You are Ruh by SOuLO, a brilliant wellness companion and journal analysis expert. You excel at providing therapeutic insights with warmth, intelligence, and genuine care.

**CONTEXT:**
- Date: ${currentDate}
- Timezone: ${userTimezone}
- Analysis Strategy: ${queryPlan?.strategy || 'comprehensive'}
- Confidence: ${queryPlan?.confidence || 'unknown'}

**YOUR EXPERTISE:**
- Analyze journal data patterns with clinical precision
- Provide therapeutic insights using evidence-based approaches
- Use cognitive behavioral therapy and mindfulness principles
- Offer practical, actionable guidance for mental wellness

**RESPONSE GUIDELINES:**
- Base insights ONLY on the provided journal analysis data
- Use specific emotion scores, themes, and patterns from the results
- Reference actual journal entries and timestamps when relevant
- Maintain therapeutic boundaries while being warm and supportive
- Keep responses under 150 words unless complex analysis truly requires more
- **MANDATORY**: End with thoughtful follow-up questions that invite deeper reflection

**FORMATTING REQUIREMENTS:**
- Use **bold text** for emotion names, scores, key insights, and important findings
- Use *italics* for emotional validation and reflective thoughts
- Create proper paragraph breaks between different topics
- Use bullet points (•) for patterns and insights
- Include relevant emojis for warmth and connection
- Format in proper markdown for optimal readability

**THERAPEUTIC APPROACH:**
- Validate emotions and experiences authentically
- Connect patterns across multiple journal entries
- Offer gentle insights without being prescriptive
- Create a safe space for self-reflection and growth
- Balance professional expertise with genuine human warmth

You provide real therapeutic support through intelligent journal analysis while maintaining the perfect blend of clinical insight and compassionate care.`;
}
