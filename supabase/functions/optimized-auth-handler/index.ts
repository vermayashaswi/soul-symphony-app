import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface AuthOperationRequest {
  operation: 'verify_profile' | 'optimize_auth_flow' | 'cleanup_session';
  user_id?: string;
  session_data?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, user_id, session_data }: AuthOperationRequest = await req.json();
    
    console.log(`[OptimizedAuthHandler] Processing operation: ${operation}`);

    switch (operation) {
      case 'verify_profile':
        return await handleProfileVerification(user_id!);
      
      case 'optimize_auth_flow':
        return await handleAuthFlowOptimization(user_id!, session_data);
      
      case 'cleanup_session':
        return await handleSessionCleanup(user_id!);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[OptimizedAuthHandler] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleProfileVerification(userId: string) {
  try {
    console.log(`[OptimizedAuthHandler] Verifying profile for user: ${userId}`);
    
    // Use optimized subscription status function
    const { data: subscriptionData, error: subError } = await supabase
      .rpc('get_user_subscription_status', { user_id_param: userId });
    
    if (subError) {
      console.error('[OptimizedAuthHandler] Subscription check error:', subError);
    }

    // Check trial eligibility
    const { data: trialEligible, error: trialError } = await supabase
      .rpc('is_trial_eligible', { user_id_param: userId });
    
    if (trialError) {
      console.error('[OptimizedAuthHandler] Trial eligibility error:', trialError);
    }

    // Get basic profile info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, onboarding_completed, subscription_status, is_premium')
      .eq('id', userId)
      .maybeSingle();

    const result = {
      profile_exists: !!profile,
      subscription_data: subscriptionData?.[0] || null,
      trial_eligible: trialEligible || false,
      profile: profile,
      optimized: true
    };

    console.log(`[OptimizedAuthHandler] Profile verification result:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[OptimizedAuthHandler] Profile verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message, profile_exists: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAuthFlowOptimization(userId: string, sessionData: any) {
  try {
    console.log(`[OptimizedAuthHandler] Optimizing auth flow for user: ${userId}`);
    
    // Cleanup expired trials first
    await supabase.rpc('cleanup_expired_trials');
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, subscription_status, trial_ends_at')
      .eq('id', userId)
      .maybeSingle();

    let profileResult = null;

    if (!existingProfile) {
      // Create profile using direct insert (optimized trigger will handle defaults)
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: sessionData?.user?.email || null,
          full_name: sessionData?.user?.user_metadata?.full_name || null,
          avatar_url: sessionData?.user?.user_metadata?.avatar_url || null
        })
        .select('id, subscription_status, trial_ends_at, is_premium')
        .single();

      if (createError && createError.code !== '23505') { // Ignore unique violation
        console.error('[OptimizedAuthHandler] Profile creation error:', createError);
      } else {
        profileResult = newProfile;
      }
    } else {
      profileResult = existingProfile;
    }

    // Optimize user session if session data provided
    let sessionId = null;
    if (sessionData?.session_fingerprint) {
      try {
        const { data: sessionResult } = await supabase
          .rpc('optimize_user_session', {
            p_user_id: userId,
            p_session_fingerprint: sessionData.session_fingerprint
          });
        sessionId = sessionResult;
      } catch (sessionError) {
        console.warn('[OptimizedAuthHandler] Session optimization warning:', sessionError);
      }
    }

    const result = {
      auth_flow_optimized: true,
      profile: profileResult,
      session_id: sessionId,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[OptimizedAuthHandler] Auth flow optimization error:', error);
    return new Response(
      JSON.stringify({ error: error.message, auth_flow_optimized: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleSessionCleanup(userId: string) {
  try {
    console.log(`[OptimizedAuthHandler] Cleaning up sessions for user: ${userId}`);
    
    // Close expired sessions
    const { error: cleanupError } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        session_end: new Date().toISOString(),
        session_state: 'expired'
      })
      .eq('user_id', userId)
      .eq('is_active', true)
      .lt('session_timeout', new Date().toISOString());

    if (cleanupError) {
      console.warn('[OptimizedAuthHandler] Session cleanup warning:', cleanupError);
    }

    return new Response(
      JSON.stringify({ session_cleanup_completed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[OptimizedAuthHandler] Session cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message, session_cleanup_completed: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}