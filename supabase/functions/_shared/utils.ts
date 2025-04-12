
/**
 * Shared utility functions for edge functions
 */

/**
 * Standard CORS headers to use in edge functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Helper function to handle CORS preflight requests
 */
export function handleCorsRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/**
 * Helper function to create a standard error response
 */
export function createErrorResponse(error: Error | string, status = 200): Response {
  const message = error instanceof Error ? error.message : error;
  console.error("Error:", message);
  
  return new Response(
    JSON.stringify({ 
      error: message, 
      success: false,
      message: "Error occurred, but edge function is returning 200 to avoid CORS issues"
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Helper function to create a standard success response
 */
export function createSuccessResponse(data: any): Response {
  return new Response(
    JSON.stringify({ ...data, success: true }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
