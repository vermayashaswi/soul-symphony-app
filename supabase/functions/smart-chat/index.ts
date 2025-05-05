import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

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
      message, 
      userId, 
      threadId, 
      generateTitleOnly = false,
      messages: providedMessages,
      clientTimestamp // Accept client timestamp
    } = await req.json();

    // Log the client timestamp if available
    if (clientTimestamp) {
      console.log(`Client timestamp: ${clientTimestamp}`);
    }

    if (!message && !generateTitleOnly) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message?.substring(0, 50)}...`);

    // If generateTitleOnly is true, use a different prompt and return only the title
    if (generateTitleOnly) {
      console.log("Generating title only");

      // Validate that messages are provided
      if (!providedMessages || providedMessages.length === 0) {
        throw new Error('Messages are required to generate a title');
      }

      // Extract user messages
      const userMessages = providedMessages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join("\n");

      // Call OpenAI to generate a title
      const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that creates short, concise titles (maximum 5 words) for chat conversations. Based on the user's messages, create a title that captures the main topic or theme of the conversation."
            },
            {
              role: "user",
              content: `Create a short, concise title (maximum 5 words) for a conversation about: ${userMessages}`
            }
          ],
          temperature: 0.7,
          max_tokens: 50
        }),
      });

      if (!titleResponse.ok) {
        console.error('Failed to generate title:', await titleResponse.text());
        throw new Error('Failed to generate title');
      }

      const titleData = await titleResponse.json();
      const title = titleData.choices[0]?.message?.content?.trim() || 'New Conversation';

      return new Response(
        JSON.stringify({ title }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Call OpenAI
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful mental health assistant. Respond to the user's query based on the context of the previous messages in the conversation. Be concise and helpful.`
          },
          ...(providedMessages || []),
          { role: 'user', content: message }
        ],
      }),
    });

    if (!completionResponse.ok) {
      console.error('Failed to get completion:', await completionResponse.text());
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const content = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return new Response(
      JSON.stringify({ content }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
