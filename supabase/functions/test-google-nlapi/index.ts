import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Testing Google NL API configuration");
    
    const googleNlApiKey = Deno.env.get('GOOGLE_API');
    
    if (!googleNlApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Google API key not configured",
        configured: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`API key found: ${googleNlApiKey.length} characters, starts with: ${googleNlApiKey.substring(0, 5)}...`);

    // Test API call with simple text
    const testText = "This is a simple test message for sentiment analysis.";
    
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleNlApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: testText,
        },
        encodingType: 'UTF8'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google NL API test failed:', errorText);
      
      let errorDetails = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = { rawError: errorText };
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: "Google NL API test failed",
        configured: true,
        apiError: errorDetails,
        statusCode: response.status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();
    const sentimentScore = result.documentSentiment?.score || 0;
    
    console.log('Google NL API test successful:', result);

    return new Response(JSON.stringify({
      success: true,
      configured: true,
      testSentiment: sentimentScore,
      message: "Google NL API is working correctly",
      fullResult: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error testing Google NL API:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      configured: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});