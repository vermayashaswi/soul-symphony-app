
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { threadId, userId } = await req.json();
    
    if (!threadId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: threadId or userId' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      );
    }
    
    // Check if thread exists and belongs to user
    const { data: thread, error: threadError } = await supabaseAdmin
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();
    
    if (threadError || !thread) {
      console.error('Thread not found or access denied:', threadError);
      
      // Create a new thread if the requested one doesn't exist
      const { data: newThread, error: createError } = await supabaseAdmin
        .from('chat_threads')
        .insert({
          id: threadId, // Use the requested ID
          user_id: userId,
          title: "Restored Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create replacement thread', details: createError }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 500 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          thread: newThread, 
          messages: [],
          created: true,
          restored: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        }
      );
    }
    
    // Get messages for the thread
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages', details: messagesError }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      );
    }
    
    // Update the thread's last activity timestamp
    await supabaseAdmin
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
    
    return new Response(
      JSON.stringify({ 
        thread,
        messages: messages || [],
        restored: false,
        messageCount: messages?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in ensure-chat-persistence function:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
