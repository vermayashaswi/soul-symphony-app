
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle ping request for availability check
  try {
    const requestData = await req.json();
    if (requestData.ping === true) {
      console.log("Received ping request");
      return new Response(
        JSON.stringify({ pong: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Regular processing
    const { message, userId, threadId = null, includeDiagnostics = false } = requestData;
    
    if (!message) {
      console.error("No message provided");
      return new Response(
        JSON.stringify({ 
          error: "No message provided", 
          response: "I need a question to answer. Could you try asking me something?" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for required API key
    if (!openAIApiKey) {
      console.error("OpenAI API key not configured");
      return new Response(
        JSON.stringify({ 
          error: "API key not configured", 
          response: "I'm not able to respond right now because my API key is not properly configured. Please contact support." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Thread ID:", threadId);
    console.log("Include diagnostics:", includeDiagnostics ? "yes" : "no");
    
    // Get journal entries to provide context
    let entries = [];
    try {
      console.log("Fetching recent entries for context");
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at, emotions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
      } else if (recentEntries && recentEntries.length > 0) {
        entries = recentEntries;
        console.log("Retrieved", entries.length, "recent entries for context");
      } else {
        console.log("No recent entries found for user");
      }
    } catch (recentError) {
      console.error("Exception fetching recent entries:", recentError);
    }
    
    // Create context from relevant entries
    let journalContext = "";
    if (entries && entries.length > 0) {
      // Format entries as context
      journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
        entries.map((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          return `Entry ${index+1} (${date}):\n${entry["refined text"]}`;
        }).join('\n\n') + "\n\n";
    } else {
      journalContext = "I don't see any journal entries yet. If you'd like to get more personalized insights, consider adding some journal entries.";
    }
    
    // Get user's first name for personalized response
    let firstName = "";
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
        
      if (!profileError && profileData?.full_name) {
        firstName = profileData.full_name.split(' ')[0];
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
    
    // Prepare system prompt with context
    const systemPrompt = `You are Roha, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively.
Focus on being helpful rather than diagnostic. 
${firstName ? `Always address the user by their first name (${firstName}) in your responses.` : ""}`;

    console.log("Sending to GPT with context...");
    
    try {
      // Send to GPT with context
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
        
        return new Response(
          JSON.stringify({ 
            error: `GPT API error: ${errorText}`, 
            response: "I'm having trouble connecting to my brain right now. Please try again in a moment."
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      console.log("AI response generated successfully");
      
      // Prepare the response including diagnostic information if requested
      const responseData = { 
        response: aiResponse 
      };
      
      if (includeDiagnostics) {
        responseData.diagnostics = {
          entriesFound: entries.length
        };
      }
      
      return new Response(
        JSON.stringify(responseData),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (apiError) {
      console.error("API error:", apiError);
      
      // Return a proper response with error information
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          response: "I'm having trouble connecting right now. Please try again later.",
          success: false 
        }),
        { 
          status: 200, // Use 200 to avoid CORS issues
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-rag function:", error);
    
    // Return a proper response with error information
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false 
      }),
      {
        status: 200, // Use 200 to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
