
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Rate limiting service for Supabase Edge Functions
export class RateLimitService {
  private supabase;
  
  constructor(supabaseUrl: string, serviceKey: string) {
    this.supabase = createClient(supabaseUrl, serviceKey);
  }

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(
    userId: string | null,
    ipAddress: string | null,
    functionName: string
  ): Promise<{
    allowed: boolean;
    limitType?: string;
    userLimits?: any;
    ipLimits?: any;
    retryAfter?: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_rate_limit', {
          p_user_id: userId,
          p_ip_address: ipAddress,
          p_function_name: functionName
        });

      if (error) {
        console.error('Rate limit check error:', error);
        // Fail open - allow request if rate limit check fails
        return { allowed: true };
      }

      // Calculate retry after time based on limit type
      let retryAfter = 60; // Default 1 minute
      if (data.limit_type?.includes('hour')) {
        retryAfter = 3600; // 1 hour
      } else if (data.limit_type?.includes('minute')) {
        retryAfter = 60; // 1 minute
      }

      return {
        allowed: data.allowed,
        limitType: data.limit_type,
        userLimits: data.user_limits,
        ipLimits: data.ip_limits,
        retryAfter: data.allowed ? undefined : retryAfter
      };
    } catch (error) {
      console.error('Rate limit service error:', error);
      // Fail open - allow request if service fails
      return { allowed: true };
    }
  }

  /**
   * Log API usage with comprehensive metrics
   */
  async logUsage(params: {
    userId?: string;
    ipAddress?: string;
    functionName: string;
    endpoint?: string;
    requestMethod?: string;
    statusCode?: number;
    responseTimeMs?: number;
    tokensUsed?: number;
    costUsd?: number;
    rateLimitHit?: boolean;
    rateLimitType?: string;
    userAgent?: string;
    referer?: string;
    requestPayloadSize?: number;
    responsePayloadSize?: number;
    errorMessage?: string;
  }): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('log_api_usage', {
          p_user_id: params.userId || null,
          p_ip_address: params.ipAddress || null,
          p_function_name: params.functionName,
          p_endpoint: params.endpoint || null,
          p_request_method: params.requestMethod || 'POST',
          p_status_code: params.statusCode || null,
          p_response_time_ms: params.responseTimeMs || null,
          p_tokens_used: params.tokensUsed || null,
          p_cost_usd: params.costUsd || null,
          p_rate_limit_hit: params.rateLimitHit || false,
          p_rate_limit_type: params.rateLimitType || null,
          p_user_agent: params.userAgent || null,
          p_referer: params.referer || null,
          p_request_payload_size: params.requestPayloadSize || null,
          p_response_payload_size: params.responsePayloadSize || null,
          p_error_message: params.errorMessage || null
        });

      if (error) {
        console.error('Usage logging error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Usage logging service error:', error);
      return null;
    }
  }

  /**
   * Get client IP address from request
   */
  getClientIP(request: Request): string | null {
    // Try multiple headers for client IP
    const headers = request.headers;
    
    return (
      headers.get('cf-connecting-ip') || // Cloudflare
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() || // Standard proxy header
      headers.get('x-real-ip') || // Nginx
      headers.get('x-client-ip') || // Apache
      null
    );
  }

  /**
   * Extract user ID from Authorization header
   */
  async getUserId(request: Request, supabase: any): Promise<string | null> {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }

      return user.id;
    } catch (error) {
      console.error('Error extracting user ID:', error);
      return null;
    }
  }

  /**
   * Create rate limit response
   */
  createRateLimitResponse(
    limitInfo: { limitType?: string; retryAfter?: number; userLimits?: any; ipLimits?: any }
  ): Response {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    });

    if (limitInfo.retryAfter) {
      headers.set('Retry-After', limitInfo.retryAfter.toString());
      headers.set('X-RateLimit-Reset', (Date.now() + limitInfo.retryAfter * 1000).toString());
    }

    // Add rate limit headers for transparency
    if (limitInfo.userLimits) {
      headers.set('X-RateLimit-User-Minute', limitInfo.userLimits.minute?.limit?.toString() || '0');
      headers.set('X-RateLimit-User-Minute-Remaining', 
        Math.max(0, (limitInfo.userLimits.minute?.limit || 0) - (limitInfo.userLimits.minute?.current || 0)).toString());
    }

    if (limitInfo.ipLimits) {
      headers.set('X-RateLimit-IP-Minute', limitInfo.ipLimits.minute?.limit?.toString() || '0');
      headers.set('X-RateLimit-IP-Minute-Remaining', 
        Math.max(0, (limitInfo.ipLimits.minute?.limit || 0) - (limitInfo.ipLimits.minute?.current || 0)).toString());
    }

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit type: ${limitInfo.limitType || 'unknown'}`,
        retryAfter: limitInfo.retryAfter,
        limitType: limitInfo.limitType
      }),
      {
        status: 429,
        headers
      }
    );
  }
}

// OpenAI usage tracking utility
export class OpenAIUsageTracker {
  private supabase;
  
  constructor(supabaseUrl: string, serviceKey: string) {
    this.supabase = createClient(supabaseUrl, serviceKey);
  }

  /**
   * Log OpenAI API usage
   */
  async logOpenAIUsage(params: {
    userId?: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    functionName?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('openai_usage')
        .insert({
          user_id: params.userId || null,
          model: params.model,
          prompt_tokens: params.promptTokens || null,
          completion_tokens: params.completionTokens || null,
          total_tokens: params.totalTokens || null,
          cost_usd: params.costUsd || null,
          function_name: params.functionName || null,
          request_id: params.requestId || null
        });

      if (error) {
        console.error('OpenAI usage logging error:', error);
      }
    } catch (error) {
      console.error('OpenAI usage tracking service error:', error);
    }
  }

  /**
   * Calculate OpenAI API cost based on model and tokens
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    // OpenAI pricing (as of 2024 - should be updated regularly)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 0.000005, completion: 0.000015 }, // $5/$15 per 1M tokens
      'gpt-4o-mini': { prompt: 0.00000015, completion: 0.0000006 }, // $0.15/$0.60 per 1M tokens
      'gpt-4-turbo': { prompt: 0.00001, completion: 0.00003 }, // $10/$30 per 1M tokens
      'gpt-4': { prompt: 0.00003, completion: 0.00006 }, // $30/$60 per 1M tokens
      'gpt-3.5-turbo': { prompt: 0.0000005, completion: 0.0000015 }, // $0.50/$1.50 per 1M tokens
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // Default to cheapest
    
    return (promptTokens * modelPricing.prompt) + (completionTokens * modelPricing.completion);
  }
}

// Helper function to create rate limiting middleware
export function createRateLimitMiddleware(
  rateLimitService: RateLimitService,
  functionName: string
) {
  return async (request: Request, supabase: any) => {
    const startTime = Date.now();
    const ipAddress = rateLimitService.getClientIP(request);
    const userId = await rateLimitService.getUserId(request, supabase);
    
    // Check rate limits
    const limitCheck = await rateLimitService.checkRateLimit(
      userId,
      ipAddress,
      functionName
    );

    // Log the request attempt
    await rateLimitService.logUsage({
      userId,
      ipAddress,
      functionName,
      requestMethod: request.method,
      rateLimitHit: !limitCheck.allowed,
      rateLimitType: limitCheck.limitType,
      userAgent: request.headers.get('user-agent') || undefined,
      referer: request.headers.get('referer') || undefined,
      requestPayloadSize: parseInt(request.headers.get('content-length') || '0')
    });

    if (!limitCheck.allowed) {
      return rateLimitService.createRateLimitResponse(limitCheck);
    }

    return {
      userId,
      ipAddress,
      startTime,
      rateLimitService
    };
  };
}
