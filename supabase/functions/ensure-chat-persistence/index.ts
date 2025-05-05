import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      threadId, 
      messageId, 
      content,
      clientTimestamp // Accept client timestamp 
    } = await req.json();

    // Log the client timestamp if available
    if (clientTimestamp) {
      console.log(`Client timestamp: ${clientTimestamp}`);
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    // Check if the thread exists and belongs to the user
    let { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();

    if (threadError) {
      console.error('Error fetching thread:', threadError);
      return new Response(JSON.stringify({ error: 'Could not fetch thread' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let restored = false;
    if (!thread) {
      // If the thread doesn't exist, create it
      const { data: newThread, error: newThreadError } = await supabase
        .from('chat_threads')
        .insert([{ id: threadId, user_id: userId, title: 'New Conversation' }])
        .select('*')
        .single();

      if (newThreadError) {
        console.error('Error creating thread:', newThreadError);
        return new Response(JSON.stringify({ error: 'Could not create thread' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      thread = newThread;
      restored = true;
      console.log(`Thread ${threadId} did not exist, so it was created.`);
    }

    // Fetch existing messages for the thread
    let { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(JSON.stringify({ error: 'Could not fetch messages' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // If a messageId and content are provided, ensure the message exists
    if (messageId && content) {
      let { data: message, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .eq('thread_id', threadId)
        .single();

      if (messageError) {
        console.warn('Error fetching message:', messageError);
        // Do not return an error, as the message might not exist yet
      }

      if (!message) {
        // If the message doesn't exist, create it
        const { data: newMessage, error: newMessageError } = await supabase
          .from('chat_messages')
          .insert([{ id: messageId, thread_id: threadId, content: content, sender: 'user' }])
          .select('*')
          .single();

        if (newMessageError) {
          console.error('Error creating message:', newMessageError);
          return new Response(JSON.stringify({ error: 'Could not create message' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        messages = [...(messages || []), newMessage];
        console.log(`Message ${messageId} did not exist, so it was created.`);
      }
    }

    return new Response(
      JSON.stringify({ 
        thread, 
        messages,
        restored
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in ensure chat persistence:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
