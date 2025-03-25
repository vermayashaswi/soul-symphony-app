
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a summarized title for a new chat thread
async function generateThreadTitle(message: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates concise, descriptive titles for chat conversations. The title should be no longer than 5-6 words and should capture the essence of the user\'s message.'
          },
          {
            role: 'user',
            content: `Generate a short, descriptive title for a chat that starts with this message: "${message}"`
          }
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate thread title');
    }

    const result = await response.json();
    const generatedTitle = result.choices[0].message.content.trim().replace(/^"|"$/g, '');
    
    return generatedTitle || message.substring(0, 30) + (message.length > 30 ? "..." : "");
  } catch (error) {
    console.error("Error generating thread title:", error);
    return message.substring(0, 30) + (message.length > 30 ? "..." : "");
  }
}

// Retrieve and format thread history as context
async function getThreadHistory(threadId: string) {
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(10); // Limit to most recent messages

  if (error) {
    console.error("Error retrieving thread history:", error);
    return [];
  }

  return messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== CHAT REQUEST RECEIVED ===");
    const { message, userId, threadId, isNewThread, threadTitle } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    let currentThreadId = threadId;
    
    // Create a new thread if needed
    if (isNewThread) {
      let title = threadTitle;
      
      if (!title || title === message.substring(0, 30) + (message.length > 30 ? "..." : "")) {
        try {
          title = await generateThreadTitle(message);
        } catch (error) {
          console.error("Error generating thread title:", error);
          // Fall back to default title if generation fails
          title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
        }
      }
      
      const { data: newThread, error } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          title: title,
        })
        .select('id')
        .single();
        
      if (error) {
        console.error("Error creating new thread:", error);
        throw error;
      }
      
      currentThreadId = newThread.id;
      console.log("Created new thread with ID:", currentThreadId);
    } else {
      // Update the thread's updated_at timestamp
      const { error: updateError } = await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
        
      if (updateError) {
        console.error("Error updating thread timestamp:", updateError);
      }
    }
    
    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: currentThreadId,
        content: message,
        sender: 'user'
      });
      
    if (userMessageError) {
      console.error("Error storing user message:", userMessageError);
    }
    
    // Get conversation history for this thread
    let previousMessages = [];
    try {
      previousMessages = await getThreadHistory(currentThreadId);
      console.log(`Retrieved ${previousMessages.length} previous messages from thread history`);
    } catch (historyError) {
      console.error("Error getting thread history:", historyError);
    }
    
    // Prepare system prompt
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling.
Your role is to provide thoughtful responses to help users reflect on their emotions and experiences.
Be warm, empathetic, and insightful in your responses. Focus on wellbeing, emotional intelligence, and personal growth.
Encourage journaling as a practice, but don't push it excessively.`;

    console.log("System prompt prepared");
    console.log("Number of previous messages in context:", previousMessages.length);
    
    // Send to GPT with conversation history
    const messagesForGPT = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...previousMessages,
      {
        role: 'user',
        content: message
      }
    ];
    
    let aiResponse = "";
    try {
      console.log("Sending request to OpenAI API...");
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messagesForGPT,
          temperature: 0.7,
        }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ GPT API error:", errorText);
        throw new Error(`GPT API error: ${errorText}`);
      }
  
      const result = await response.json();
      aiResponse = result.choices[0].message.content;
      
      console.log("✅ AI response generated successfully");
    } catch (gptError) {
      console.error("❌ Error calling OpenAI API:", gptError);
      
      // Provide a fallback response if OpenAI call fails
      aiResponse = "I'm currently having trouble responding. Could you please try again in a moment?";
    }
    
    // Store assistant response
    try {
      const { error: assistantMessageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: aiResponse,
          sender: 'assistant'
        });
        
      if (assistantMessageError) {
        console.error("Error storing assistant message:", assistantMessageError);
      }
    } catch (storeError) {
      console.error("Error storing assistant message:", storeError);
    }
    
    console.log("=== CHAT REQUEST COMPLETED SUCCESSFULLY ===");
    
    return new Response(
      JSON.stringify({ 
        response: aiResponse, 
        threadId: currentThreadId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("=== ERROR IN CHAT FUNCTION ===");
    console.error(error);
    
    // Return 200 status with a more helpful error message
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm sorry, I couldn't process your request at the moment. Please try again in a moment.",
        success: false 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
