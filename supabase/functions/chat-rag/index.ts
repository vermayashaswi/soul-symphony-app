
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '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';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://kwnwhgucnzqxndzjayyq.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    const { message, userId } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request:", message);
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey || 'anon-key');
    
    // Retrieve relevant journal entries for context
    let journalContext = "";
    if (supabaseServiceKey) {
      console.log("Retrieving journal entries for context...");
      
      // Get the most recent journal entries
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('refined text, transcription, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error("Error retrieving journal entries:", error);
      } else if (entries && entries.length > 0) {
        // Format entries as context
        journalContext = "Here are some recent journal entries for context:\n\n" + 
          entries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const text = entry["refined text"] || entry.transcription || "No content";
            return `Entry ${index+1} (${date}): ${text}`;
          }).join('\n\n') + "\n\n";
      }
    }
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are an empathetic AI mental health assistant named Feelosophy. 
You help users understand their emotions, detect patterns in their mood, and provide supportive advice.
${journalContext}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context...");
    
    // Send to GPT with RAG context
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GPT API error:", errorText);
      throw new Error(`GPT API error: ${errorText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log("AI response generated successfully");
    
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error in chat-rag function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
