
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'usage-stats':
        return await getUsageStats(supabase, url.searchParams);
      
      case 'rate-limits':
        if (req.method === 'GET') {
          return await getRateLimitConfig(supabase);
        } else if (req.method === 'POST') {
          const body = await req.json();
          return await updateRateLimitConfig(supabase, body);
        }
        break;
      
      case 'openai-usage':
        return await getOpenAIUsage(supabase, url.searchParams);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Rate limit admin error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getUsageStats(supabase: any, searchParams: URLSearchParams) {
  const timeframe = searchParams.get('timeframe') || '24h';
  const functionName = searchParams.get('function');
  
  let timeFilter = "created_at > NOW() - INTERVAL '24 hours'";
  
  if (timeframe === '7d') {
    timeFilter = "created_at > NOW() - INTERVAL '7 days'";
  } else if (timeframe === '30d') {
    timeFilter = "created_at > NOW() - INTERVAL '30 days'";
  }

  let query = supabase
    .from('api_usage')
    .select('*')
    .gte('created_at', new Date(Date.now() - (timeframe === '7d' ? 7 * 24 * 60 * 60 * 1000 : timeframe === '30d' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)));

  if (functionName) {
    query = query.eq('function_name', functionName);
  }

  const { data: usage, error } = await query;

  if (error) {
    throw error;
  }

  // Calculate statistics
  const stats = {
    totalRequests: usage.length,
    rateLimitHits: usage.filter(u => u.rate_limit_hit).length,
    avgResponseTime: usage.length > 0 ? usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / usage.length : 0,
    totalTokens: usage.reduce((sum, u) => sum + (u.tokens_used || 0), 0),
    totalCost: usage.reduce((sum, u) => sum + (parseFloat(u.cost_usd) || 0), 0),
    errorRate: usage.length > 0 ? usage.filter(u => u.status_code >= 400).length / usage.length : 0,
    topUsers: getTopUsers(usage),
    topIPs: getTopIPs(usage),
    hourlyBreakdown: getHourlyBreakdown(usage)
  };

  return new Response(
    JSON.stringify(stats),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getRateLimitConfig(supabase: any) {
  const { data, error } = await supabase
    .from('rate_limit_config')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateRateLimitConfig(supabase: any, body: any) {
  const { rule_name, ...updates } = body;

  const { data, error } = await supabase
    .from('rate_limit_config')
    .upsert({ rule_name, ...updates, updated_at: new Date().toISOString() })
    .select();

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getOpenAIUsage(supabase: any, searchParams: URLSearchParams) {
  const timeframe = searchParams.get('timeframe') || '24h';
  const userId = searchParams.get('userId');
  
  let query = supabase
    .from('openai_usage')
    .select('*')
    .gte('created_at', new Date(Date.now() - (timeframe === '7d' ? 7 * 24 * 60 * 60 * 1000 : timeframe === '30d' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)));

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: usage, error } = await query;

  if (error) {
    throw error;
  }

  const stats = {
    totalRequests: usage.length,
    totalTokens: usage.reduce((sum, u) => sum + (u.total_tokens || 0), 0),
    totalCost: usage.reduce((sum, u) => sum + (parseFloat(u.cost_usd) || 0), 0),
    modelBreakdown: getModelBreakdown(usage),
    dailyUsage: getDailyUsage(usage)
  };

  return new Response(
    JSON.stringify(stats),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getTopUsers(usage: any[]): Array<{userId: string, requests: number, tokens: number}> {
  const userStats = usage.reduce((acc, u) => {
    if (!u.user_id) return acc;
    if (!acc[u.user_id]) {
      acc[u.user_id] = { requests: 0, tokens: 0 };
    }
    acc[u.user_id].requests++;
    acc[u.user_id].tokens += u.tokens_used || 0;
    return acc;
  }, {} as Record<string, {requests: number, tokens: number}>);

  return Object.entries(userStats)
    .map(([userId, stats]) => ({ userId, ...stats }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
}

function getTopIPs(usage: any[]): Array<{ip: string, requests: number}> {
  const ipStats = usage.reduce((acc, u) => {
    if (!u.ip_address) return acc;
    acc[u.ip_address] = (acc[u.ip_address] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(ipStats)
    .map(([ip, requests]) => ({ ip, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
}

function getHourlyBreakdown(usage: any[]): Array<{hour: string, requests: number, rateLimitHits: number}> {
  const hourlyStats = usage.reduce((acc, u) => {
    const hour = new Date(u.created_at).toISOString().substring(0, 13) + ':00:00Z';
    if (!acc[hour]) {
      acc[hour] = { requests: 0, rateLimitHits: 0 };
    }
    acc[hour].requests++;
    if (u.rate_limit_hit) {
      acc[hour].rateLimitHits++;
    }
    return acc;
  }, {} as Record<string, {requests: number, rateLimitHits: number}>);

  return Object.entries(hourlyStats)
    .map(([hour, stats]) => ({ hour, ...stats }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

function getModelBreakdown(usage: any[]): Array<{model: string, requests: number, tokens: number, cost: number}> {
  const modelStats = usage.reduce((acc, u) => {
    if (!acc[u.model]) {
      acc[u.model] = { requests: 0, tokens: 0, cost: 0 };
    }
    acc[u.model].requests++;
    acc[u.model].tokens += u.total_tokens || 0;
    acc[u.model].cost += parseFloat(u.cost_usd) || 0;
    return acc;
  }, {} as Record<string, {requests: number, tokens: number, cost: number}>);

  return Object.entries(modelStats)
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((a, b) => b.cost - a.cost);
}

function getDailyUsage(usage: any[]): Array<{date: string, requests: number, tokens: number, cost: number}> {
  const dailyStats = usage.reduce((acc, u) => {
    const date = new Date(u.created_at).toISOString().substring(0, 10);
    if (!acc[date]) {
      acc[date] = { requests: 0, tokens: 0, cost: 0 };
    }
    acc[date].requests++;
    acc[date].tokens += u.total_tokens || 0;
    acc[date].cost += parseFloat(u.cost_usd) || 0;
    return acc;
  }, {} as Record<string, {requests: number, tokens: number, cost: number}>);

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
