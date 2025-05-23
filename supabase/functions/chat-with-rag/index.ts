import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processSubQuestionsInParallel, ProcessingContext } from "./utils/parallelProcessor.ts";
import { PerformanceOptimizer } from "./utils/performanceOptimizer.ts";
import { generateDisplayHeader } from "./utils/headerGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

// Create service client for database operations (bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// JWT validation function
async function validateJWTAndGetUserId(authHeader: string): Promise<string | null> {
  try {
    const token = authHeader.replace('Bearer ', '');
    
    // Use service client to verify the JWT token
    const { data: { user }, error } = await supabaseService.auth.getUser(token);
    
    if (error || !user) {
      console.error('[chat-with-rag] JWT validation failed:', error);
      return null;
    }
    
    console.log(`[chat-with-rag] JWT validated successfully for user: ${user.id}`);
    return user.id;
  } catch (error) {
    console.error('[chat-with-rag] JWT validation exception:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const globalTimer = PerformanceOptimizer.startTimer('complete_request');

  try {
    const authHeader = req.headers.get('Authorization');
    console.log(`[chat-with-rag] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.error('[chat-with-rag] No authorization header provided');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate JWT token and extract user ID
    const jwtTimer = PerformanceOptimizer.startTimer('jwt_validation');
    const validatedUserId = await validateJWTAndGetUserId(authHeader);
    PerformanceOptimizer.endTimer(jwtTimer, 'jwt_validation');
    
    if (!validatedUserId) {
      console.error('[chat-with-rag] JWT validation failed');
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      message, 
      userId, 
      queryPlan, 
      conversationContext = [],
      useAllEntries = false,
      hasPersonalPronouns = false,
      hasExplicitTimeReference = false,
      threadMetadata = {}
    } = await req.json();

    console.log(`[chat-with-rag] PROCESSING: "${message}"`);
    console.log(`[chat-with-rag] Enhanced Context - UseAllEntries: ${useAllEntries}, PersonalPronouns: ${hasPersonalPronouns}, TimeRef: ${hasExplicitTimeReference}`);
    console.log(`[chat-with-rag] Conversation Context: ${conversationContext.length} messages`);
    console.log(`[chat-with-rag] Thread Metadata:`, threadMetadata);
    console.log(`[chat-with-rag] Validated userId: ${validatedUserId} (type: ${typeof validatedUserId})`);
    console.log(`[chat-with-rag] Request userId: ${userId} (type: ${typeof userId})`);

    // Verify that the userId from request matches the validated JWT user
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    if (userIdString !== validatedUserId) {
      console.error('[chat-with-rag] User ID mismatch between request and JWT');
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!message || !userId || !queryPlan) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check user's journal entry count using service client with performance optimization
    console.log(`[chat-with-rag] Checking journal entries for user: ${validatedUserId}`);
    
    const entryCountTimer = PerformanceOptimizer.startTimer('entry_count_check');
    let userEntryCount = 0;
    
    try {
      const entryCountResult = await PerformanceOptimizer.withConnectionPooling(async () => {
        return await supabaseService
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', validatedUserId);
      });

      const { count, error: countError } = entryCountResult;
      
      if (countError) {
        console.error(`[chat-with-rag] Error counting entries:`, countError);
        userEntryCount = 0;
      } else {
        userEntryCount = count || 0;
        console.log(`[chat-with-rag] Successfully counted ${userEntryCount} entries for user ${validatedUserId}`);
      }
    } catch (error) {
      console.error(`[chat-with-rag] Exception counting entries:`, error);
      userEntryCount = 0;
    }
    
    PerformanceOptimizer.endTimer(entryCountTimer, 'entry_count_check');

    // Only return "no entries" if we're absolutely certain
    if (userEntryCount === 0) {
      console.log(`[chat-with-rag] Confirmed: No journal entries found for user ${validatedUserId}`);
      return new Response(JSON.stringify({
        response: "I'd love to help you analyze your journal entries, but it looks like you haven't created any entries yet. Once you start journaling, I'll be able to provide insights about your emotions, patterns, and personal growth!",
        hasData: false,
        entryCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enhanced follow-up detection based on conversation context
    const isAnalysisFollowUp = detectAnalysisFollowUpFromContext(message, conversationContext);
    const shouldUseAllEntries = useAllEntries || isAnalysisFollowUp || queryPlan.useAllEntries;
    
    console.log(`[chat-with-rag] Analysis Follow-up Detection:`, {
      isAnalysisFollowUp,
      shouldUseAllEntries,
      originalUseAllEntries: useAllEntries,
      queryPlanUseAllEntries: queryPlan.useAllEntries
    });

    // Process sub-questions with parallel processing optimization
    console.log(`[chat-with-rag] Processing ${queryPlan.subQuestions?.length || 0} sub-questions with enhanced context awareness`);
    
    const strictDateEnforcement = !shouldUseAllEntries && hasExplicitTimeReference;
    console.log(`[chat-with-rag] Strict date enforcement: ${strictDateEnforcement}`);

    const parallelTimer = PerformanceOptimizer.startTimer('parallel_processing');
    
    // Prepare processing context with enhanced parameters
    const processingContext: ProcessingContext = {
      validatedUserId,
      openaiApiKey,
      supabaseService
    };

    // Process sub-questions in parallel with enhanced context
    const subQuestionAnalyses = await processSubQuestionsInParallel(
      queryPlan.subQuestions || [],
      processingContext,
      queryPlan.dateRange,
      strictDateEnforcement,
      shouldUseAllEntries // Pass the enhanced scope flag
    );
    
    PerformanceOptimizer.endTimer(parallelTimer, 'parallel_processing');

    let hasAnyEntriesInDateRange = false;
    subQuestionAnalyses.forEach(analysis => {
      if (analysis.hasEntriesInDateRange) {
        hasAnyEntriesInDateRange = true;
      }
    });

    // Handle case where no entries found due to strict date enforcement across all sub-questions
    if (strictDateEnforcement && !hasAnyEntriesInDateRange) {
      console.log(`[chat-with-rag] STRICT DATE ENFORCEMENT: No entries in specified date range across all sub-questions`);
      
      const temporalContext = queryPlan.dateRange ? 
        ` from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 
        ' in the specified time period';
        
      return new Response(JSON.stringify({
        response: `I don't see any journal entries${temporalContext}. You might want to try a different time period, or if you haven't been journaling during that time, that's completely normal! Would you like me to look at a broader time range or help you with something else?`,
        hasData: false,
        searchedTimeRange: queryPlan.dateRange,
        strictDateEnforcement: true,
        entryCount: userEntryCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate total results across all sub-questions
    const totalEmotionResults = subQuestionAnalyses.reduce((sum, analysis) => sum + analysis.emotionResults.length, 0);
    const totalVectorResults = subQuestionAnalyses.reduce((sum, analysis) => sum + analysis.vectorResults.length, 0);
    const totalResults = totalEmotionResults + totalVectorResults;

    if (totalResults === 0) {
      console.log(`[chat-with-rag] No results found after processing all sub-questions individually`);
      
      let fallbackResponse;
      
      if (shouldUseAllEntries && hasPersonalPronouns) {
        fallbackResponse = "I'd love to help analyze your personal patterns, but I'm having trouble finding relevant entries right now. This might be because your journal entries don't contain the specific topics we're looking for, or there might be a technical issue. Could you try rephrasing your question or asking about something more specific?";
      } else if (isAnalysisFollowUp) {
        fallbackResponse = "I understand you'd like me to expand the analysis to all your entries. However, I'm having trouble finding relevant content for this specific query across your journal history. Could you try rephrasing your question or being more specific about what you'd like me to analyze?";
      } else {
        fallbackResponse = "I couldn't find any journal entries that match your query. This could be because you haven't journaled about this topic yet, or the entries don't contain similar content. Would you like to try asking about something else or rephrase your question?";
      }
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        hasData: false,
        entryCount: userEntryCount,
        useAllEntries: shouldUseAllEntries,
        hasPersonalPronouns,
        isAnalysisFollowUp
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if this is an emotion-focused query
    const isEmotionQuery = queryPlan.isEmotionQuery || message.toLowerCase().includes('emotion');
    
    // Prepare comprehensive context for GPT with enhanced conversation awareness
    let journalContext = '';
    
    // Add conversation context summary if this is a follow-up
    if (conversationContext.length > 0 && isAnalysisFollowUp) {
      journalContext += "**CONVERSATION CONTEXT:**\n";
      journalContext += "This is a follow-up question to previous analysis. ";
      
      // Find the original analytical question
      const originalQuestion = conversationContext
        .filter(msg => msg.role === 'user')
        .find(msg => /\b(when|what time|pattern|trend|analysis|most|least|often|frequency)\b/i.test(msg.content));
      
      if (originalQuestion) {
        journalContext += `Original question: "${originalQuestion.content}"\n`;
        journalContext += `Current request: "${message}"\n`;
        journalContext += `Scope: User wants analysis expanded to ALL entries, not just recent ones.\n\n`;
      }
    }
    
    if (subQuestionAnalyses.length > 1) {
      // Multi-question query - structure by sub-question with user-friendly headers
      journalContext += "**MULTI-QUESTION ANALYSIS**\n\n";
      journalContext += "The user asked a multi-part question. Below is the individual analysis for each part:\n\n";
      
      subQuestionAnalyses.forEach((analysis, index) => {
        // Generate a user-friendly header instead of "SUB-QUESTION N"
        const friendlyHeader = generateDisplayHeader(analysis.subQuestion);
        journalContext += `## ${friendlyHeader}\n\n`;
        
        if (analysis.context.length > 0) {
          journalContext += analysis.context + "\n\n";
        } else {
          journalContext += "No specific data found for this analysis.\n\n";
        }
        
        journalContext += `**Analysis Summary:** ${analysis.reasoning}\n`;
        journalContext += `**Results Count:** ${analysis.emotionResults.length} emotion results, ${analysis.vectorResults.length} entry results\n\n`;
        journalContext += "---\n\n";
      });
      
      journalContext += "**SYNTHESIS INSTRUCTIONS:**\n";
      journalContext += "1. Address each analysis section individually first\n";
      journalContext += "2. Then provide cross-analysis and patterns between sections\n";
      journalContext += "3. Synthesize insights that span multiple analysis areas\n";
      journalContext += "4. Provide a comprehensive conclusion that addresses the overall query\n\n";
      
    } else {
      // Single question - use the analysis directly
      const analysis = subQuestionAnalyses[0];
      journalContext += analysis.context;
    }

    // Enhanced system prompt for enhanced context processing
    const systemPrompt = `You are SOULo, a compassionate AI assistant that helps users understand their journal entries and emotional patterns.

Context: The user has ${userEntryCount} total journal entries. ${shouldUseAllEntries ? 'You are analyzing ALL their entries for comprehensive personal insights.' : `You are analyzing ${totalResults} relevant results across ${subQuestionAnalyses.length} sub-question(s).`}

${conversationContext.length > 0 ? `**CONVERSATION AWARENESS:**
This query is part of an ongoing conversation with ${conversationContext.length} previous messages. Pay attention to the conversation context and maintain continuity with previous discussions.` : ''}

${isAnalysisFollowUp ? `**FOLLOW-UP ANALYSIS:**
This is a follow-up request to expand or broaden a previous analysis. The user wants you to consider ALL their journal entries, not just recent ones. Provide comprehensive insights across their entire journaling history.` : ''}

${hasPersonalPronouns ? 'IMPORTANT: This is a personal question about the user themselves. Provide personalized insights and speak directly to them about their patterns, growth, and experiences.' : ''}

${hasExplicitTimeReference ? `IMPORTANT: This query is specifically about ${queryPlan.dateRange ? `the time period from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 'a specific time period'}. Focus your analysis on that timeframe.` : ''}

${subQuestionAnalyses.length > 1 ? `**MULTI-QUESTION PROCESSING:**
You are handling a multi-part query with ${subQuestionAnalyses.length} analysis sections. Each section has been analyzed separately and the results are structured below with descriptive headers. Your task is to:
1. Address each analysis section individually using its specific data
2. Identify patterns and connections across sections  
3. Provide synthesis insights that span multiple parts of the query
4. Give a comprehensive response that addresses the overall multi-part question

IMPORTANT: Use the section headers provided in the journal context. These are user-friendly headers that replace technical sub-question numbering.` : ''}

${isEmotionQuery ? `**CRITICAL EMOTION ANALYSIS INSTRUCTIONS:**
• You have access to PRE-CALCULATED emotion scores from the database (0.0 to 1.0 scale)
• These scores were generated by advanced AI analysis of the journal content
• DO NOT attempt to infer emotions from the text snippets - use ONLY the provided scores
• Focus on quantitative analysis: patterns, frequencies, score distributions, and trends
• The emotion scores represent the intensity/strength of each emotion detected
• Analyze relationships between emotions based on their numerical values
• When you see "Score: 0.842" this means that emotion was detected with 84.2% intensity
• For co-occurrence analysis, look at which emotions appear together in the same entries
• NEVER say "your entries don't explicitly mention emotions" - the emotions are already calculated and scored` : ''}

**RESPONSE LENGTH REQUIREMENTS:**
• Keep responses UNDER 200 WORDS unless the analysis requires greater depth
• For complex multi-question queries or detailed emotional patterns, longer responses are acceptable
• Prioritize key insights and actionable advice within the word limit
• Be concise while maintaining warmth and empathy

Based on these journal entries and analyses, provide a helpful, warm, and insightful response to: "${message}"

Journal Data and Analysis:
${journalContext}

FORMATTING REQUIREMENTS - YOU MUST FOLLOW THESE:
- Structure your response with clear markdown headers using ## for main sections
- Use **bold text** for key insights, emotions, and important points
- Organize information with bullet points using - for lists
- Break content into digestible sections with descriptive headers
- Make the response visually scannable and well-organized
- Use markdown formatting consistently throughout
${subQuestionAnalyses.length > 1 ? '- Use the provided section headers from the journal context - they are already user-friendly' : ''}
${isAnalysisFollowUp ? '- Acknowledge that this is an expanded analysis of all entries' : ''}

Guidelines:
- Be warm, empathetic, and supportive
- Provide specific insights based on the actual data provided
- ${hasPersonalPronouns ? 'Use "you" and "your" to make it personal since they asked about themselves' : 'Keep the tone conversational but not overly personal'}
- If patterns emerge, point them out constructively using bullet points
- ${shouldUseAllEntries ? 'Since you have access to their full journal history, provide comprehensive insights about long-term patterns' : 'Focus on the specific entries provided'}
- End with an encouraging note or helpful suggestion
- Structure everything with proper markdown headers and bullet points for easy reading
${subQuestionAnalyses.length > 1 ? '- Ensure each section gets adequate attention before moving to synthesis' : ''}
${isAnalysisFollowUp ? '- Make it clear that this analysis covers their complete journal history' : ''}`;

    try {
      const gptTimer = PerformanceOptimizer.startTimer('gpt_response');
      
      // Optimize the GPT request
      const optimizedRequest = PerformanceOptimizer.optimizeOpenAIRequest(systemPrompt + '\n\n' + message);
      
      const gptResponse = await PerformanceOptimizer.withConnectionPooling(async () => {
        return await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });
      });
      
      PerformanceOptimizer.endTimer(gptTimer, 'gpt_response');

      if (!gptResponse.ok) {
        throw new Error(`OpenAI API error: ${gptResponse.status}`);
      }

      const gptData = await gptResponse.json();
      const response = gptData.choices[0].message.content;

      // Response data with enhanced context information
      const responseData = {
        response,
        hasData: true,
        entryCount: totalResults,
        emotionResultsCount: totalEmotionResults,
        vectorResultsCount: totalVectorResults,
        totalUserEntries: userEntryCount,
        subQuestionCount: subQuestionAnalyses.length,
        subQuestionAnalyses: subQuestionAnalyses.map(analysis => ({
          question: analysis.subQuestion,
          emotionResults: analysis.emotionResults.length,
          vectorResults: analysis.vectorResults.length,
          hasData: analysis.totalResults > 0
        })),
        useAllEntries: shouldUseAllEntries,
        hasPersonalPronouns,
        strictDateEnforcement,
        analyzedTimeRange: queryPlan.dateRange,
        processingFlags: {
          useAllEntries: shouldUseAllEntries,
          hasPersonalPronouns,
          hasExplicitTimeReference,
          strictDateEnforcement,
          isMultiQuestion: subQuestionAnalyses.length > 1,
          isAnalysisFollowUp,
          conversationContextLength: conversationContext.length
        }
      };

      const globalDuration = PerformanceOptimizer.endTimer(globalTimer, 'complete_request');
      console.log(`[chat-with-rag] Successfully generated response with enhanced context: ${subQuestionAnalyses.length} sub-question analyses, ${totalEmotionResults} emotion results and ${totalVectorResults} vector results in ${globalDuration}ms`);

      // Log performance stats periodically (no cache stats)
      if (Math.random() < 0.1) { // 10% chance
        console.log('[chat-with-rag] Performance Report:', PerformanceOptimizer.getPerformanceReport());
      }

      // Clean up large objects to help with memory
      PerformanceOptimizer.cleanupLargeObjects(subQuestionAnalyses);

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[chat-with-rag] Error calling OpenAI:', error);
      return new Response(JSON.stringify({
        error: 'Failed to generate response',
        hasData: totalResults > 0,
        entryCount: totalResults
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('[chat-with-rag] Error:', error);
    PerformanceOptimizer.endTimer(globalTimer, 'complete_request');
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Enhanced function to detect analysis follow-up from conversation context
 */
function detectAnalysisFollowUpFromContext(message: string, conversationContext: any[]): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patterns that indicate wanting to expand previous analysis
  const analysisFollowUpPatterns = [
    /^now (analyze|look at|check|examine) (all|my|the)/i,
    /^(analyze|look at|check|examine) all (my|the|entries)/i,
    /what about (all|my|the) (entries|data|journal)/i,
    /^all (my|the) (entries|data|journal)/i,
    /^expand (the|this) (analysis|search)/i,
    /^broaden (the|this) (analysis|search)/i
  ];
  
  const isFollowUpPattern = analysisFollowUpPatterns.some(pattern => pattern.test(lowerMessage));
  
  if (!isFollowUpPattern) return false;
  
  // Check if there's a previous analytical question in the conversation
  const hasAnalyticalContext = conversationContext.some(msg => {
    if (msg.role !== 'user') return false;
    const content = msg.content.toLowerCase();
    return /\b(when|what time|pattern|trend|analysis|most|least|often|frequency)\b/.test(content);
  });
  
  console.log(`[detectAnalysisFollowUpFromContext] Pattern match: ${isFollowUpPattern}, Has context: ${hasAnalyticalContext}, Context length: ${conversationContext.length}`);
  
  return hasAnalyticalContext;
}
