
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { processSubQueryWithEmotionSupport } from './utils/enhancedSubQueryProcessor.ts'
import { generateSystemPrompt, generateResponse } from './utils/responseGenerator.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('[chat-with-rag] Auth header present:', !!req.headers.get('Authorization'))
    
    // JWT validation for user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseService.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    console.log('[chat-with-rag] JWT validated successfully for user:', user.id)

    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [],
      queryPlan = {},
      useAllEntries = false,
      hasPersonalPronouns = false,
      hasExplicitTimeReference = false,
      threadMetadata = {}
    } = await req.json()

    const validatedUserId = userId || user.id
    console.log('[chat-with-rag] Validated userId:', validatedUserId, '(type:', typeof validatedUserId, ')')

    console.log('[chat-with-rag] PROCESSING:', `"${message}"`)
    console.log('[chat-with-rag] Enhanced Context - UseAllEntries:', useAllEntries, ', PersonalPronouns:', hasPersonalPronouns, ', TimeRef:', hasExplicitTimeReference)
    console.log('[chat-with-rag] Conversation Context:', conversationContext.length, 'messages')
    console.log('[chat-with-rag] Thread Metadata:', threadMetadata)
    console.log('[chat-with-rag] Request userId:', userId, '(type:', typeof userId, ')')

    // Check if user has journal entries
    console.log('[chat-with-rag] Checking journal entries for user:', validatedUserId)
    const { count: entryCount, error: countError } = await supabaseService
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', validatedUserId)

    if (countError) {
      console.error('[chat-with-rag] Error counting journal entries:', countError)
    } else {
      console.log('[chat-with-rag] Successfully counted', entryCount, 'entries for user', validatedUserId)
    }

    // Handle query plan with proper sub-question processing
    const subQuestions = queryPlan.subQuestions || []
    console.log('[chat-with-rag] Pre-processed sub-questions:', subQuestions.length)

    // Analysis follow-up detection
    const isAnalysisFollowUp = message.toLowerCase().includes('also') || 
                              message.toLowerCase().includes('when') ||
                              conversationContext.some((msg: any) => 
                                msg.content && msg.content.toLowerCase().includes('emotion'))

    const shouldUseAllEntries = useAllEntries || queryPlan.useAllEntries || isAnalysisFollowUp

    console.log('[chat-with-rag] Analysis Follow-up Detection:', {
      isAnalysisFollowUp,
      shouldUseAllEntries,
      originalUseAllEntries: useAllEntries,
      queryPlanUseAllEntries: queryPlan.useAllEntries
    })

    // Process sub-questions with enhanced emotion support
    let allEmotionResults: any[] = []
    let allVectorResults: any[] = []
    let combinedContext = ''

    const strictDateEnforcement = hasExplicitTimeReference && !shouldUseAllEntries
    console.log('[chat-with-rag] Strict date enforcement:', strictDateEnforcement)

    if (subQuestions.length > 0) {
      console.log('[chat-with-rag] Processing', subQuestions.length, 'sub-questions with enhanced emotion support')
      
      // Process sub-questions sequentially to avoid overwhelming the system
      for (const subQuestion of subQuestions) {
        try {
          console.log('[chat-with-rag] Processing sub-question:', typeof subQuestion === 'string' ? subQuestion : JSON.stringify(subQuestion))
          
          const subQuestionResult = await processSubQueryWithEmotionSupport(
            subQuestion,
            supabaseService,
            validatedUserId,
            null, // dateRange - using null for now to use all entries
            openaiApiKey
          )

          console.log('[chat-with-rag] Sub-question analysis completed:', subQuestionResult.totalResults, 'results')

          allEmotionResults.push(...subQuestionResult.emotionResults)
          allVectorResults.push(...subQuestionResult.vectorResults)
          
          if (subQuestionResult.context) {
            combinedContext += subQuestionResult.context + '\n\n'
          }

        } catch (error) {
          console.error('[chat-with-rag] Error processing sub-question:', typeof subQuestion === 'string' ? subQuestion : JSON.stringify(subQuestion), error)
        }
      }
    } else {
      // Process the main message directly if no sub-questions
      console.log('[chat-with-rag] No sub-questions found, processing main message directly')
      
      try {
        const mainResult = await processSubQueryWithEmotionSupport(
          message,
          supabaseService,
          validatedUserId,
          null,
          openaiApiKey
        )

        allEmotionResults = mainResult.emotionResults
        allVectorResults = mainResult.vectorResults
        combinedContext = mainResult.context
      } catch (error) {
        console.error('[chat-with-rag] Error processing main message:', error)
      }
    }

    console.log('[chat-with-rag] Total results summary:', {
      emotionResults: allEmotionResults.length,
      vectorResults: allVectorResults.length,
      totalResults: allEmotionResults.length + allVectorResults.length,
      subQuestionCount: subQuestions.length
    })

    // Generate response if we have results
    if (allEmotionResults.length > 0 || allVectorResults.length > 0) {
      const systemPrompt = generateSystemPrompt(
        'UTC', // Default timezone
        null, // timeRange
        'analysis'
      )

      const userPrompt = `Based on the following analysis:

${combinedContext}

User question: ${message}

Please provide a thoughtful, personalized response focusing on emotional patterns and insights.`

      const response = await generateResponse(
        systemPrompt,
        userPrompt,
        conversationContext,
        openaiApiKey
      )

      console.log('[chat-with-rag] Successfully generated response with enhanced emotion support:', subQuestions.length, 'sub-question analyses,', allEmotionResults.length, 'emotion results and', allVectorResults.length, 'vector results')

      return new Response(
        JSON.stringify({ 
          response,
          references: [...allEmotionResults, ...allVectorResults],
          analysis: {
            emotionResults: allEmotionResults.length,
            vectorResults: allVectorResults.length,
            totalResults: allEmotionResults.length + allVectorResults.length
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.log('[chat-with-rag] No results found after processing all sub-questions individually')
      
      // Fallback response for when no data is found
      const fallbackResponse = `I don't have enough journal entry data to provide insights about "${message}". To get personalized emotional analysis, please make sure you have some journal entries recorded first.`
      
      return new Response(
        JSON.stringify({ 
          response: fallbackResponse,
          references: [],
          analysis: {
            emotionResults: 0,
            vectorResults: 0,
            totalResults: 0
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('[chat-with-rag] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'An error occurred while processing your request. Please try again.'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
