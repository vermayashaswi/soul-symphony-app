
import { processTimeRange } from "./dateProcessor.ts";

// Define the shape of filter validation request
interface FilterValidationRequest {
  originalQuery: string;
  detectedTimeRange: any;
  userTimezone: string;
  currentDate: string;
}

// Define the shape of validated filter response
interface ValidatedFilter {
  startDate?: string;
  endDate?: string;
  isValid: boolean;
  correctedTimeRange?: any;
  explanation?: string;
}

/**
 * Uses GPT to validate and if necessary correct time filters before they're used in database queries
 */
export async function validateDateFilter(
  apiKey: string, 
  request: FilterValidationRequest
): Promise<ValidatedFilter> {
  try {
    console.log("Validating date filter with GPT:", request);
    
    // Get the current date in ISO format for reference
    const now = new Date().toISOString();
    
    // Extract values from request
    const { originalQuery, detectedTimeRange, userTimezone, currentDate } = request;
    
    // Prepare detected date range info for prompt
    const detectedDateInfo = detectedTimeRange 
      ? `Detected time range: ${JSON.stringify(detectedTimeRange)}` 
      : "No time range detected";

    // Create the prompt for GPT to validate the filters
    const validationPrompt = `
You are a date filter validator for a journaling app's query system. Your task is to validate and correct time filters for database queries based on natural language user queries.

CURRENT INFORMATION:
- User's original query: "${originalQuery}"
- ${detectedDateInfo}
- User's timezone: ${userTimezone || "UTC"}
- Current system date: ${currentDate || now}

TASK:
1. Analyze if the time range correctly matches what the user is asking for
2. For queries with phrases like "in May", "last week", etc., validate that the date range is correct
3. If the time range is incorrect, provide the correct date range
4. Pay special attention to month names, especially "may" which could be ambiguous
5. For relative time periods like "last week", ensure dates are calculated relative to current date

OUTPUT FORMAT - Return a JSON object with:
{
  "isValid": boolean, // true if original filter is correct, false if needs correction
  "startDate": "ISO date string", // corrected or confirmed start date
  "endDate": "ISO date string", // corrected or confirmed end date
  "timeRangeType": string, // e.g., "lastWeek", "month", "specificMonth" 
  "monthName": string, // if applicable
  "year": number, // if applicable
  "explanation": "short explanation of your reasoning or corrections"
}

If the user query clearly refers to a specific month (e.g., "in May", "for the month of May"), ensure the date range covers exactly that month in the current year.
`;

    // Call OpenAI API to validate the filters
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: validationPrompt },
          { role: 'user', content: "Please validate this date filter." }
        ],
        temperature: 0.2, // Using a lower temperature for more consistent outputs
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error calling OpenAI for filter validation:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    const validationResult = JSON.parse(result.choices[0].message.content);
    
    console.log("GPT validation result:", validationResult);
    
    // Process the corrected time range if GPT found issues
    let processedTimeRange = detectedTimeRange;
    
    if (!validationResult.isValid) {
      console.log("Time range validation failed. Using GPT's corrected time range.");
      
      // Create a corrected time range object based on GPT's output
      const correctedTimeRange = {
        startDate: validationResult.startDate,
        endDate: validationResult.endDate,
        type: validationResult.timeRangeType,
        timezone: userTimezone
      };
      
      // Add month-specific properties if applicable
      if (validationResult.monthName) {
        correctedTimeRange.monthName = validationResult.monthName;
      }
      
      if (validationResult.year) {
        correctedTimeRange.year = validationResult.year;
      }
      
      // Process the corrected time range
      processedTimeRange = processTimeRange(correctedTimeRange);
      
      console.log("Processed corrected time range:", processedTimeRange);
    } else {
      console.log("Time range validation passed. Using original time range.");
    }
    
    return {
      startDate: processedTimeRange?.startDate,
      endDate: processedTimeRange?.endDate,
      isValid: validationResult.isValid,
      correctedTimeRange: processedTimeRange,
      explanation: validationResult.explanation
    };
  } catch (error) {
    console.error("Error in date filter validation:", error);
    // Return the original time range in case of error
    return {
      startDate: request.detectedTimeRange?.startDate,
      endDate: request.detectedTimeRange?.endDate,
      isValid: true, // Assume valid to avoid breaking the flow
      explanation: `Error during validation: ${error.message}`
    };
  }
}
