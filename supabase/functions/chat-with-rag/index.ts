
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://esm.sh/openai@4.26.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openaiClient = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    })

    // Parse request
    const { message, userId, threadId } = await req.json()

    console.log('[chat-with-rag] Processing query:', message, 'for user:', userId)

    // Search for relevant journal entries
    const searchResponse = await supabaseClient.rpc('match_journal_entries', {
      query_embedding: await generateEmbedding(openaiClient, message),
      match_threshold: 0.3,
      match_count: 5,
      user_id_filter: userId
    })

    let context = ''
    if (searchResponse.data && searchResponse.data.length > 0) {
      context = searchResponse.data
        .map((entry: any) => `Entry from ${entry.created_at}: ${entry.content}`)
        .join('\n\n')
    }

    // Generate AI response
    const systemPrompt = `You are a helpful AI assistant analyzing journal entries. 
    Use the following journal entries to provide personalized insights and responses.
    
    Context from journal entries:
    ${context || 'No relevant journal entries found.'}
    
    Provide helpful, empathetic responses based on the user's journaling history.`

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const response = completion.choices[0]?.message?.content || 'No response generated'

    // Save conversation to database
    await supabaseClient
      .from('chat_messages')
      .insert([
        {
          thread_id: threadId,
          sender: 'user',
          content: message
        },
        {
          thread_id: threadId,
          sender: 'assistant',
          content: response,
          reference_entries: searchResponse.data || []
        }
      ])

    // Update thread timestamp
    await supabaseClient
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)

    return new Response(
      JSON.stringify({
        response,
        references: searchResponse.data || [],
        analysis: {
          entriesFound: searchResponse.data?.length || 0,
          searchQuery: message
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in chat-with-rag:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function generateEmbedding(client: OpenAI, text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}
