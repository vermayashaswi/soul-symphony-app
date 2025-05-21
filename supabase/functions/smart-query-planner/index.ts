
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

const config = new Configuration({
  apiKey: apiKey,
});

const openai = new OpenAIApi(config);

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Detect if query appears to be a time-based summary query
 */
function detectTimeSummaryQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for phrases that suggest the user wants a summary of a period
  const summaryPatterns = [
    'how has', 'how have', 'how was', 'how were',
    'summarize', 'summary of', 'recap',
    'what happened', 'what was happening',
    'how did i feel', 'how was i feeling'
  ];
  
  // Check for time periods
  const timePatterns = [
    'day', 'week', 'month', 'year',
    'last few days', 'past few days',
    'last night', 'yesterday',
    'last week', 'last month', 'past month',
    'recent', 'lately'
  ];
  
  // Check if the query contains both a summary pattern and a time pattern
  const hasSummaryPattern = summaryPatterns.some(pattern => lowerMessage.includes(pattern));
  const hasTimePattern = timePatterns.some(pattern => lowerMessage.includes(pattern));
  
  console.log(`Time summary detection - Has summary pattern: ${hasSummaryPattern}, Has time pattern: ${hasTimePattern}`);
  
  return hasSummaryPattern && hasTimePattern;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const { message, userId, previousMessages, isFollowUp = false, referenceDate = null, preserveTopicContext = false, intentType = null } = await req.json();

    console.log(`Request received:
      Message: ${message}
      User ID: ${userId}
      Context length: ${previousMessages?.length || 0}
      Is follow-up: ${isFollowUp}
      Reference date provided: ${referenceDate ? 'yes' : 'no'}
      Preserve topic context: ${preserveTopicContext}
      Intent type: ${intentType || 'not provided'}
    `);
    
    // Add time summary detection
    const isTimeSummaryQuery = detectTimeSummaryQuery(message);
    if (isTimeSummaryQuery) {
      console.log("Detected time-based summary query.");
    }

    // Time expression detection and parsing
    let timeExpression = null;
    let dateRange = null;
    try {
      const timeAnalysisResponse = await fetch('https://roha-ai-time-pattern-analyzer.modal.run/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message,
          referenceDate: referenceDate
        })
      });

      if (timeAnalysisResponse.ok) {
        const timeAnalysisData = await timeAnalysisResponse.json();
        timeExpression = timeAnalysisData.timeExpression;
        dateRange = timeAnalysisData.dateRange;
        console.log("Time analysis result:", timeExpression, dateRange);
      } else {
        console.error("Error calling time analysis service:", timeAnalysisResponse.status, await timeAnalysisResponse.text());
      }
    } catch (error) {
      console.error("Error during time analysis:", error);
    }

    // Domain context detection
    let domainContext = null;
    try {
      const domainAnalysisResponse = await fetch('https://roha-ai-domain-classifier.modal.run/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message
        })
      });

      if (domainAnalysisResponse.ok) {
        const domainAnalysisData = await domainAnalysisResponse.json();
        domainContext = domainAnalysisData.domain;
        console.log("Domain context:", domainContext);
      } else {
        console.error("Error calling domain classifier service:", domainAnalysisResponse.status, await domainAnalysisResponse.text());
      }
    } catch (error) {
      console.error("Error during domain classification:", error);
    }
    
    // Get journal entry count for accurate information in the prompt
    let entryCount = 0;
    try {
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (!error && count !== null) {
        entryCount = count;
        console.log(`User ${userId} has ${entryCount} total journal entries available`);
      }
    } catch (error) {
      console.error("Error fetching journal entry count:", error);
    }
    
    // Check for entries in the specified time range if a date range was detected
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      try {
        const { count: rangeCount, error: rangeError } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', dateRange.startDate)
          .lte('created_at', dateRange.endDate);
          
        if (!rangeError && rangeCount !== null) {
          console.log(`User ${userId} has ${rangeCount} journal entries in ${dateRange.periodName} (${dateRange.startDate} to ${dateRange.endDate})`);
          
          // If no entries in this time range, we can indicate that in the response
          if (rangeCount === 0) {
            console.log(`No entries found in the specified time range - serving early response`);
            return new Response(
              JSON.stringify({
                queryPlan: {
                  strategy: "none",
                  filters: {
                    date_range: dateRange,
                    emotions: null,
                    themes: null
                  },
                  isTimePatternQuery: true,
                  needsDataAggregation: false,
                  domainContext: domainContext || null,
                  isTimeSummaryQuery: true,
                  hasEntriesInRange: false
                },
                rawPlan: "No entries found in the specified time range."
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      } catch (error) {
        console.error("Error checking for entries in date range:", error);
      }
    }
    
    // Include isTimeSummaryQuery in the prompt
    let promptAddition = "";
    if (isTimeSummaryQuery) {
      promptAddition += `\nThis appears to be a time-based summary query where the user wants a concise overview of a period.`;
      promptAddition += `\nThe user has ${entryCount} journal entries available for analysis.`;
    }

    // Set temperature based on follow-up status
    let temperature = 0.5;
    if (isFollowUp) {
      temperature = preserveTopicContext ? 0.3 : 0.7;
    }

    const prompt = `
You are a query planner that analyzes user messages to determine the optimal search strategy for retrieving information from their journal entries.

For this message: "${message}"${intentType ? `\nIntent type: ${intentType}` : ''}
${timeExpression ? `Time expression detected: ${timeExpression}` : ''}
${dateRange ? `Date range calculated: 
    Start: ${dateRange.startDate} (${new Date(dateRange.startDate).toLocaleDateString()})
    End: ${dateRange.endDate} (${new Date(dateRange.endDate).toLocaleDateString()})
    Period: ${dateRange.periodName}
    Duration in days: ${dateRange.duration}` : ''}
${domainContext ? `Domain context detected: ${domainContext}` : 'Domain context detected: null'}
${promptAddition}

Analyze the message and generate a search plan that includes:
1. The optimal search strategy ('vector', 'sql', or 'hybrid')
2. Any filters that should be applied (date range, emotions, themes)
3. Whether this query requires time pattern analysis
4. Whether this query requires data aggregation
5. The domain context of the query (mental_health, productivity, relationships, general_insights)

Return a JSON object with the following structure:
{
  "plan": {
    "strategy": string,
    "filters": {
      "date_range": object | null,
      "emotions": string[] | null,
      "themes": string[] | null
    },
    "isTimePatternQuery": boolean,
    "needsDataAggregation": boolean,
    "domainContext": string | null,
    "isTimeSummaryQuery": boolean
  }
}`;

    console.log("Query Planner Prompt:", prompt);

    const apiResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: temperature,
    });

    const rawPlan = apiResponse.data.choices[0].message?.content;
    console.log("Raw Query Plan:", rawPlan);

    let planObject = null;
    try {
      planObject = JSON.parse(rawPlan);
    } catch (error) {
      console.error("Failed to parse query plan:", error);
      return new Response(JSON.stringify({ error: "Failed to parse query plan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    
    // Include isTimeSummaryQuery in the response
    if (planObject && !planObject.plan.isTimeSummaryQuery) {
      planObject.plan.isTimeSummaryQuery = isTimeSummaryQuery;
    }
    
    // Add the date range information explicitly if we have it
    if (dateRange && planObject && planObject.plan && planObject.plan.filters) {
      planObject.plan.filters.date_range = dateRange;
    }
    
    // Add entry count information to the plan
    if (planObject && planObject.plan) {
      planObject.plan.totalEntryCount = entryCount;
    }

    console.log("Parsed Query Plan:", planObject);

    return new Response(
      JSON.stringify({
        queryPlan: planObject?.plan || null,
        rawPlan: rawPlan
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in smart-query-planner:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
