import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define corsHeaders directly in this file
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Month names for consistent recognition
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'
];

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
  
  // Also check for specific month names in the query
  const hasMonthName = MONTH_NAMES.some(month => lowerMessage.includes(month));
  
  // Special handling for "may" as it's both a month and a modal verb
  const hasMayAsMonth = /(^|\s)(may\s+month|month\s+of\s+may|\bin\s+may\b|during\s+may)/.test(lowerMessage);
  
  // Check if the query contains both a summary pattern and a time pattern
  const hasSummaryPattern = summaryPatterns.some(pattern => lowerMessage.includes(pattern));
  const hasTimePattern = timePatterns.some(pattern => lowerMessage.includes(pattern)) || hasMonthName || hasMayAsMonth;
  
  console.log(`Time summary detection - Has summary pattern: ${hasSummaryPattern}, Has time pattern: ${hasTimePattern}`);
  if (hasMayAsMonth) {
    console.log("Detected 'may' as a month reference");
  }
  
  return hasSummaryPattern && hasTimePattern;
}

/**
 * Detect month mentions in a query text
 */
function detectMonthInQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Special handling for the word "may" since it's both a month and a modal verb
  if (/(^|\s)(may\s+month|month\s+of\s+may|\bin\s+may\b|during\s+may)/.test(lowerMessage)) {
    console.log("Detected 'may' as a month in query:", message);
    return 'may';
  }
  
  for (const month of MONTH_NAMES) {
    if (lowerMessage.includes(month)) {
      console.log(`Detected month in query: ${month} in "${message}"`);
      return month;
    }
  }
  
  return null;
}

/**
 * Process a month-specific query to generate appropriate time range
 */
function processMonthSpecificQuery(message) {
  const monthName = detectMonthInQuery(message);
  if (!monthName) return null;
  
  console.log(`Processing month-specific query for: ${monthName}`);
  
  // Map month name to month index (0-based)
  const monthMap = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  // Find correct month index
  let monthIndex = -1;
  for (const [key, index] of Object.entries(monthMap)) {
    if (monthName.toLowerCase() === key.toLowerCase()) {
      monthIndex = index;
      break;
    }
  }
  
  if (monthIndex === -1) return null;
  
  // Extract year if specified, otherwise use current year
  const currentYear = new Date().getFullYear();
  let year = currentYear;
  const yearMatch = message.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }
  
  // Create start and end dates for the month
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0); // Last day of month
  
  console.log(`Month date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  return {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    periodName: `${monthName} ${year}`,
    duration: endDate.getDate(), // Number of days in the month
    type: 'specificMonth',
    monthName: monthName,
    year: year
  };
}

/**
 * Detect if query is a personality-related question
 */
function detectPersonalityQuestion(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for patterns that indicate personality questions
  const personalityPatterns = [
    'am i ', 'am i a', 'am i an', 
    'do i like', 'do i enjoy',
    'what kind of person am i',
    'what is my personality',
    'what do i like',
    'what are my preferences',
    'what are my strengths',
    'what are my weaknesses',
    'what are my traits',
    'my personality type',
    'personality traits',
    'introvert or extrovert',
    'am i introvert',
    'am i extrovert',
    'do i prefer',
    'what type of person am i'
  ];
  
  const isPersonalityQuestion = personalityPatterns.some(pattern => lowerMessage.includes(pattern));
  console.log(`Personality question detection: ${isPersonalityQuestion}`);
  
  return isPersonalityQuestion;
}

/**
 * Detect if query requires comprehensive journal analysis
 * These are queries about journal patterns, habits, or preferences that
 * should analyze all entries regardless of specific time mentions
 */
function detectComprehensiveAnalysisQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Patterns suggesting the query is about overall journal insights
  const analysisPatterns = [
    'pattern', 'habit', 'routine', 'tendency', 
    'typically', 'usually', 'often', 'frequently',
    'my top', 'most common', 'most frequent', 'overall',
    'in general', 'generally', 'typically', 'trends',
    'how many times', 'how often', 'when do i usually',
    'what do i normally', 'what do i mostly', 'what are my most',
    'common themes', 'recurring', 'consistent'
  ];
  
  const isComprehensiveQuery = analysisPatterns.some(pattern => lowerMessage.includes(pattern));
  console.log(`Comprehensive analysis query detection: ${isComprehensiveQuery}`);
  
  return isComprehensiveQuery;
}

/**
 * Detect if query is a direct date request (like asking for current week dates)
 * that should be answered directly without consulting the journal
 */
function detectDirectDateQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Patterns for direct date inquiries
  const dateQueryPatterns = [
    /\bwhat\s+(is|are)\s+(the\s+)?(current|this)\s+week('s)?\s+dates\b/i,
    /\bwhat\s+date\s+is\s+it\b/i,
    /\bwhat\s+day\s+is\s+(it|today)\b/i,
    /\bwhat\s+(is|are)\s+(the\s+)?dates?\s+for\s+(this|current)\s+week\b/i,
    /\bcurrent\s+week\s+dates?\b/i,
    /\bthis\s+week('s)?\s+dates?\b/i,
    /\bwhat\s+dates?\s+(is|are)\s+this\s+week\b/i,
    /\btoday's\s+date\b/i
  ];
  
  // Check if any of the patterns match
  for (const pattern of dateQueryPatterns) {
    if (pattern.test(lowerMessage)) {
      console.log(`Direct date query detected: ${lowerMessage}`);
      return true;
    }
  }
  
  return false;
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
    
    // Check for month-specific queries first
    const monthName = detectMonthInQuery(message);
    if (monthName) {
      console.log(`Detected month-specific query for: ${monthName}`);
      const monthDateRange = processMonthSpecificQuery(message);
      
      if (monthDateRange) {
        console.log(`Generated month date range for ${monthName}:`, monthDateRange);
        
        // Check if we have entries for this month
        let hasEntriesInMonth = false;
        try {
          const { count, error } = await supabase
            .from('Journal Entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', monthDateRange.start_date)
            .lte('created_at', monthDateRange.end_date);
            
          hasEntriesInMonth = count > 0;
          console.log(`User has ${count || 0} entries in ${monthName}`);
        } catch (error) {
          console.error("Error checking for entries in month:", error);
        }
        
        // Return a direct plan for month-specific query
        const isTimeSummary = detectTimeSummaryQuery(message);
        const monthQueryPlan = {
          strategy: "hybrid",
          filters: {
            date_range: monthDateRange,
            emotions: null,
            themes: null
          },
          isTimePatternQuery: false,
          needsDataAggregation: false,
          domainContext: "general_insights",
          isTimeSummaryQuery: isTimeSummary,
          hasEntriesInRange: hasEntriesInMonth,
          isMonthQuery: true,
          monthName: monthName
        };
        
        return new Response(
          JSON.stringify({
            queryPlan: monthQueryPlan,
            rawPlan: JSON.stringify({ plan: { ...monthQueryPlan } })
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Check if this is a direct date query that can be answered without journal analysis
    const isDateQuery = detectDirectDateQuery(message);
    if (isDateQuery) {
      console.log("Detected direct date query. Will handle specially.");
      
      return new Response(
        JSON.stringify({
          queryPlan: {
            strategy: "direct_date",
            isDirectDateQuery: true,
            filters: { },
            isTimePatternQuery: false,
            needsDataAggregation: false,
            domainContext: "date_information",
            isTimeSummaryQuery: false,
            hasEntriesInRange: true,
            queryType: "date_request"
          },
          rawPlan: "Direct date information request detected."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Add time summary detection
    const isTimeSummaryQuery = detectTimeSummaryQuery(message);
    if (isTimeSummaryQuery) {
      console.log("Detected time-based summary query.");
    }
    
    // Add personality question detection
    const isPersonalityQuestion = detectPersonalityQuestion(message);
    if (isPersonalityQuestion) {
      console.log("Detected personality-related question.");
    }
    
    // Add comprehensive analysis query detection
    const isComprehensiveAnalysisQuery = detectComprehensiveAnalysisQuery(message) || isPersonalityQuestion;
    if (isComprehensiveAnalysisQuery) {
      console.log("Detected query requiring comprehensive journal analysis.");
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
    
    // Provide direct plan for personality questions
    if (isPersonalityQuestion) {
      console.log("Generating plan for personality question");
      const personalityPlan = {
        strategy: "vector",
        filters: {
          date_range: null,
          emotions: null,
          themes: null
        },
        isTimePatternQuery: false,
        needsDataAggregation: false,
        domainContext: "personal_insights",
        isTimeSummaryQuery: false,
        isPersonalityQuery: true,
        needsComprehensiveAnalysis: true,
        totalEntryCount: entryCount
      };
      
      return new Response(
        JSON.stringify({
          queryPlan: personalityPlan,
          rawPlan: JSON.stringify({ plan: { ...personalityPlan } })
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Provide direct plan for comprehensive analysis queries
    if (isComprehensiveAnalysisQuery) {
      console.log("Generating plan for comprehensive analysis query");
      const analysisQueryPlan = {
        strategy: "hybrid",
        filters: {
          date_range: dateRange || null,
          emotions: null,
          themes: null
        },
        isTimePatternQuery: true,
        needsDataAggregation: true,
        domainContext: domainContext || "general_insights",
        isTimeSummaryQuery: false,
        needsComprehensiveAnalysis: true,
        totalEntryCount: entryCount
      };
      
      return new Response(
        JSON.stringify({
          queryPlan: analysisQueryPlan,
          rawPlan: JSON.stringify({ plan: { ...analysisQueryPlan } })
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
6. Whether this query requires comprehensive analysis of all journal entries (set needsComprehensiveAnalysis to true)

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
    "isTimeSummaryQuery": boolean,
    "needsComprehensiveAnalysis": boolean
  }
}`;

    console.log("Query Planner Prompt:", prompt);

    // Use direct fetch API call instead of OpenAI SDK to avoid issues
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: temperature,
        })
      });
      
      if (!openaiResponse.ok) {
        console.error("OpenAI API error:", openaiResponse.status, await openaiResponse.text());
        throw new Error(`OpenAI API returned error ${openaiResponse.status}`);
      }
      
      const openaiData = await openaiResponse.json();
      const rawPlan = openaiData.choices[0].message?.content;
      console.log("Raw Query Plan:", rawPlan);

      let planObject = null;
      try {
        planObject = JSON.parse(rawPlan);
      } catch (error) {
        console.error("Failed to parse query plan:", error);
        // Create a fallback plan when parsing fails
        planObject = {
          plan: {
            strategy: "hybrid",
            filters: {
              date_range: dateRange || null,
              emotions: null,
              themes: null
            },
            isTimePatternQuery: isTimeSummaryQuery || isComprehensiveAnalysisQuery,
            needsDataAggregation: false,
            domainContext: domainContext || "general_insights",
            isTimeSummaryQuery: isTimeSummaryQuery,
            needsComprehensiveAnalysis: isComprehensiveAnalysisQuery
          }
        };
        console.log("Using fallback plan due to parsing error:", planObject);
      }
      
      // Include isTimeSummaryQuery in the response
      if (planObject && !planObject.plan.isTimeSummaryQuery) {
        planObject.plan.isTimeSummaryQuery = isTimeSummaryQuery;
      }
      
      // Include needsComprehensiveAnalysis in the response
      if (planObject && !planObject.plan.needsComprehensiveAnalysis) {
        planObject.plan.needsComprehensiveAnalysis = isComprehensiveAnalysisQuery;
      }
      
      // Add the date range information explicitly if we have it
      if (dateRange && planObject && planObject.plan && planObject.plan.filters) {
        planObject.plan.filters.date_range = dateRange;
      }
      
      // Add entry count information to the plan
      if (planObject && planObject.plan) {
        planObject.plan.totalEntryCount = entryCount;
      }
      
      // Add isPersonalityQuery if it might be missed
      if (planObject && planObject.plan && isPersonalityQuestion && !planObject.plan.isPersonalityQuery) {
        planObject.plan.isPersonalityQuery = true;
        planObject.plan.domainContext = "personal_insights";
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
      console.error("Error in OpenAI API request:", error);
      
      // Return a fallback plan when OpenAI API call fails
      const fallbackPlan = {
        strategy: "hybrid",
        filters: {
          date_range: dateRange || null,
          emotions: null,
          themes: null
        },
        isTimePatternQuery: false,
        needsDataAggregation: false,
        domainContext: domainContext || "general_insights",
        isTimeSummaryQuery: isTimeSummaryQuery,
        needsComprehensiveAnalysis: isComprehensiveAnalysisQuery,
        totalEntryCount: entryCount,
        isErrorFallback: true,
        isPersonalityQuery: isPersonalityQuestion
      };
      
      return new Response(
        JSON.stringify({
          queryPlan: fallbackPlan,
          rawPlan: JSON.stringify({ plan: fallbackPlan }),
          error: error.message
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 // Return 200 with error info in body instead of 500
        }
      );
    }
  } catch (error) {
    console.error("Error in smart-query-planner:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      queryPlan: {
        strategy: "fallback",
        isErrorFallback: true
      } 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Return 200 with error info in body instead of 500
    });
  }
});
