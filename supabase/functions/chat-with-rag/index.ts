
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { OptimizedRagPipeline } from './utils/optimizedPipeline.ts'
import { SSEStreamManager } from './utils/streamingResponseManager.ts'

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
      messageLength: requestData.message?.length || 0
    })

    // Validate required fields
    if (!requestData.message || !requestData.userId) {
      throw new Error('Missing required fields: message and userId')
    }

    // Initialize streaming response manager
    streamManager = new SSEStreamManager()
    
    // Initialize optimized RAG pipeline
    const pipeline = new OptimizedRagPipeline(
      streamManager,
      supabaseClient,
      openaiApiKey
    )

    // Process the query through the optimized pipeline
    await pipeline.processQuery(requestData)

    // Return the streaming response
    return streamManager.getResponse()

  } catch (error) {
    console.error('[ChatWithRAG] Error processing request:', error)
    
    if (streamManager) {
      await streamManager.sendEvent('error', {
        message: error.message || 'An unexpected error occurred',
        type: 'processing_error'
      })
      return streamManager.getResponse()
    }

    // Fallback error response
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        type: 'processing_error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
