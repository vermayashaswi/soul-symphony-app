
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Get the Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_API');
    
    // Basic validation
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Google API key is not configured in environment variables",
          keyPresent: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Test validity by masking the key for security
    const maskedKey = `${googleApiKey.substring(0, 5)}...${googleApiKey.substring(googleApiKey.length - 5)}`;
    const keyLength = googleApiKey.length;
    const hasValidFormat = googleApiKey.includes('-');
    
    console.log("Performing Google NL API test...");
    
    // Simple test with a sample text
    const sampleText = "This is a test of the Google Natural Language API. I feel happy today!";
    
    // Try to call the API
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: sampleText,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let parsedError;
      
      try {
        parsedError = JSON.parse(errorText);
      } catch (e) {
        parsedError = { rawError: errorText };
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API call failed",
          details: parsedError,
          keyInfo: {
            maskedKey,
            keyLength,
            hasValidFormat
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        keyInfo: {
          maskedKey,
          keyLength, 
          hasValidFormat
        },
        testResult: {
          documentSentiment: result.documentSentiment,
          sentences: result.sentences?.map((s: any) => ({
            text: s.text.content,
            sentiment: s.sentiment
          }))
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing Google NL API:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
