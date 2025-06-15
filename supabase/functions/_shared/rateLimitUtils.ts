
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface RateLimitCheck {
  allowed: boolean;
  limitType?: string;
  userLimits?: {
    minute: { current: number; limit: number };
    hour: { current: number; limit: number };
  };
  ipLimits?: {
    minute: { current: number; limit: number };
    hour: { current: number; limit: number };
  };
}

export interface RateLimitOptions {
  userId?: string;
  ipAddress?: string;
  functionName: string;
  statusCode?: number;
  responseTimeMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  errorMessage?: string;
}

export class RateLimitManager {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  async checkRateLimit(options: RateLimitOptions): Promise<RateLimitCheck> {
    try {
      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_user_id: options.userId || null,
        p_ip_address: options.ipAddress || null,
        p_function_name: options.functionName
      });

      if (error) {
        console.error('Rate limit check error:', error);
        // Fail open - allow request if rate limit check fails
        return { allowed: true };
      }

      return data as RateLimitCheck;
    } catch (error) {
      console.error('Rate limit check exception:', error);
      // Fail open - allow request if rate limit check fails
      return { allowed: true };
    }
  }

  async logApiUsage(options: RateLimitOptions): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('log_api_usage', {
        p_user_id: options.userId || null,
        p_ip_address: options.ipAddress || null,
        p_function_name: options.functionName,
        p_endpoint: `/${options.functionName}`,
        p_request_method: 'POST',
        p_status_code: options.statusCode || 200,
        p_response_time_ms: options.responseTimeMs || 0,
        p_tokens_used: options.tokensUsed || 0,
        p_cost_usd: options.costUsd || 0,
        p_rate_limit_hit: false,
        p_error_message: options.errorMessage || null
      });

      if (error) {
        console.error('API usage logging error:', error);
      }
    } catch (error) {
      console.error('API usage logging exception:', error);
    }
  }

  createRateLimitResponse(rateLimitCheck: RateLimitCheck): Response {
    const retryAfter = this.calculateRetryAfter(rateLimitCheck);
    
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      limitType: rateLimitCheck.limitType,
      retryAfter: retryAfter
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': this.getRateLimitHeader(rateLimitCheck),
        'X-RateLimit-Remaining': this.getRemainingHeader(rateLimitCheck),
        'X-RateLimit-Reset': this.getResetHeader(rateLimitCheck)
      }
    });
  }

  private calculateRetryAfter(rateLimitCheck: RateLimitCheck): number {
    // Return seconds until the rate limit resets
    if (rateLimitCheck.limitType?.includes('minute')) {
      return 60; // 1 minute
    }
    return 3600; // 1 hour
  }

  private getRateLimitHeader(rateLimitCheck: RateLimitCheck): string {
    if (rateLimitCheck.limitType?.includes('user')) {
      const limits = rateLimitCheck.userLimits;
      return rateLimitCheck.limitType.includes('minute') ? 
        limits?.minute.limit.toString() || '60' : 
        limits?.hour.limit.toString() || '1000';
    }
    
    const limits = rateLimitCheck.ipLimits;
    return rateLimitCheck.limitType?.includes('minute') ? 
      limits?.minute.limit.toString() || '30' : 
      limits?.hour.limit.toString() || '500';
  }

  private getRemainingHeader(rateLimitCheck: RateLimitCheck): string {
    if (rateLimitCheck.limitType?.includes('user')) {
      const limits = rateLimitCheck.userLimits;
      const current = rateLimitCheck.limitType.includes('minute') ? 
        limits?.minute.current || 0 : 
        limits?.hour.current || 0;
      const limit = rateLimitCheck.limitType.includes('minute') ? 
        limits?.minute.limit || 60 : 
        limits?.hour.limit || 1000;
      return Math.max(0, limit - current).toString();
    }
    
    const limits = rateLimitCheck.ipLimits;
    const current = rateLimitCheck.limitType?.includes('minute') ? 
      limits?.minute.current || 0 : 
      limits?.hour.current || 0;
    const limit = rateLimitCheck.limitType?.includes('minute') ? 
      limits?.minute.limit || 30 : 
      limits?.hour.limit || 500;
    return Math.max(0, limit - current).toString();
  }

  private getResetHeader(rateLimitCheck: RateLimitCheck): string {
    const now = Date.now();
    const resetTime = rateLimitCheck.limitType?.includes('minute') ? 
      now + (60 * 1000) : // Next minute
      now + (3600 * 1000); // Next hour
    return Math.floor(resetTime / 1000).toString();
  }

  static getClientInfo(request: Request): { userId?: string; ipAddress?: string } {
    const authHeader = request.headers.get('Authorization');
    let userId: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (error) {
        console.warn('Failed to parse auth token:', error);
      }
    }

    // Get IP address from various headers
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     request.headers.get('cf-connecting-ip') ||
                     '127.0.0.1';

    return { userId, ipAddress };
  }
}
