
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts'
import { SSEStreamManager, createStreamingResponse } from './utils/streamingResponseManager.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let streamManager: SSEStreamManager | null = null;
  let streamingResponse: Response | null = null;

  try {
    console.log('[ChatWithRAG] Starting request processing')
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse request data
    const requestData = await req.json()
    console.log('[ChatWithRAG] Request data received:', {
      hasMessage: !!requestData.message,
      hasUserId: !!requestData.userId,
      messageLength: requestData.message?.length || 0,
      streamingMode: requestData.streamingMode
    })

    // Validate required fields
    if (!requestData.message || !requestData.userId) {
      throw new Error('Missing required fields: message and userId')
    }

    // Check if streaming mode is requested (default to true for backward compatibility)
    const useStreamingMode = requestData.streamingMode !== false

    if (useStreamingMode) {
      // Initialize streaming response using factory function
      const { response, controller } = createStreamingResponse()
      streamingResponse = response
      streamManager = new SSEStreamManager(controller)
      
      // Initialize optimized RAG pipeline
      const pipeline = new OptimizedRagPipeline(
        streamManager,
        supabaseClient,
        openaiApiKey
      )

      // Process the query through the optimized pipeline
      await pipeline.processQuery(requestData)

      // Return the streaming response
      return streamingResponse
    } else {
      // Non-streaming mode: collect results and return as JSON
      console.log('[ChatWithRAG] Using non-streaming mode')
      
      // Create a simple collector for non-streaming results
      let finalResponse = ''
      let analysisData = null
      
      // Create a mock stream manager that collects instead of streaming
      const mockStreamManager = {
        sendEvent: async (type: string, data: any) => {
          if (type === 'final_response' || type === 'response_chunk') {
            if (data.response) {
              finalResponse = data.response
            } else if (data.chunk) {
              finalResponse += data.chunk
            }
            if (data.analysis) {
              analysisData = data.analysis
            }
          }
        },
        sendUserMessage: async () => {},
        sendBackendTask: async () => {},
        sendProgress: async () => {},
        close: async () => {}
      }
      
      // Initialize optimized RAG pipeline with mock manager
      const pipeline = new OptimizedRagPipeline(
        mockStreamManager as any,
        supabaseClient,
        openaiApiKey
      )

      // Process the query through the optimized pipeline
      await pipeline.processQuery(requestData)

      // Return standard JSON response
      const responseData = {
        response: finalResponse || 'No response generated',
        analysis: analysisData,
        success: true
      }

      console.log('[ChatWithRAG] Non-streaming response:', { hasResponse: !!finalResponse, hasAnalysis: !!analysisData })

      return new Response(
        JSON.stringify(responseData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('[ChatWithRAG] Error processing request:', error)
    
    if (streamManager && streamingResponse) {
      await streamManager.sendEvent('error', {
        message: error.message || 'An unexpected error occurred',
        type: 'processing_error'
      })
      return streamingResponse
    }

    // Fallback error response
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        type: 'processing_error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
