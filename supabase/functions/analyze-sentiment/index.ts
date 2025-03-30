
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const googleNLApiKey = Deno.env.get('GOOGLE_NL_API_KEY') || '';

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
    const { text, entryId } = await req.json();
    
    if (!text) {
      throw new Error('No text provided for analysis');
    }

    console.log("Analyzing text with Google NL API:", text.substring(0, 100) + "...");

    // Get both sentiment and entity analysis in one request
    const response = await fetch(`https://language.googleapis.com/v1/documents:annotateText?key=${googleNLApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text,
        },
        features: {
          extractSyntax: false,
          extractEntities: true,
          extractDocumentSentiment: true,
          extractEntitySentiment: false,
          classifyText: false
        },
        encodingType: 'UTF8',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google NL API error:", errorText);
      throw new Error(`Google NL API error: ${errorText}`);
    }

    const result = await response.json();
    console.log("Google NL API analysis complete");

    // Extract sentiment score
    const sentimentScore = result.documentSentiment?.score;

    // Process and format entities
    const formattedEntities = result.entities?.map(entity => ({
      type: mapEntityType(entity.type),
      name: entity.name
    })) || [];

    // Remove duplicate entities
    const uniqueEntities = removeDuplicateEntities(formattedEntities);
    
    console.log(`Extracted ${uniqueEntities.length} entities and sentiment score: ${sentimentScore}`);

    if (entryId) {
      // Update the database with the sentiment score and entities
      const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error } = await supabase
        .from('Journal Entries')
        .update({ 
          sentiment: sentimentScore?.toString(),
          entities: uniqueEntities
        })
        .eq('id', entryId);
        
      if (error) {
        console.error(`Error updating entry ${entryId}:`, error);
      } else {
        console.log(`Successfully updated entry ${entryId} with sentiment and entities`);
      }
    }
    
    return new Response(
      JSON.stringify({
        sentiment: {
          score: sentimentScore,
          magnitude: result.documentSentiment?.magnitude
        },
        entities: uniqueEntities
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error in analyze-sentiment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Map Google's entity types to our simplified schema
function mapEntityType(googleEntityType: string): string {
  switch (googleEntityType) {
    case 'PERSON':
      return 'person';
    case 'LOCATION':
    case 'ADDRESS':
      return 'place';
    case 'ORGANIZATION':
    case 'CONSUMER_GOOD':
    case 'WORK_OF_ART':
      return 'organization';
    case 'EVENT':
      return 'event';
    case 'OTHER':
    default:
      return 'other';
  }
}

// Remove duplicate entities
function removeDuplicateEntities(entities: Array<{type: string, name: string}>): Array<{type: string, name: string}> {
  const seen = new Set();
  return entities.filter(entity => {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Import the createClient function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
