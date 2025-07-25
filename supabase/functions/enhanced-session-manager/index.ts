import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface SessionRequest {
  action: 'create' | 'update' | 'terminate';
  userId: string;
  sessionId?: string;
  deviceType?: string;
  userAgent?: string;
  entryPage?: string;
  appVersion?: string;
  timestamp?: number;
  deferredData?: any;
}

serve(async (req) => {
  console.log('[enhanced-session-manager] Function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, sessionId, deviceType, userAgent, entryPage, appVersion, timestamp, deferredData }: SessionRequest = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    switch (action) {
      case 'create': {
        console.log('[enhanced-session-manager] Creating session for user:', userId);
        
        // Generate a simple session fingerprint
        const sessionFingerprint = `${deviceType}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        // Close any existing active sessions for this user
        await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            session_end: new Date().toISOString(),
            session_duration: '00:00:00' // Will be calculated by trigger
          })
          .eq('user_id', userId)
          .eq('is_active', true);
        
        // Create new minimal session record
        const { data: sessionData, error: sessionError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            device_type: deviceType || 'unknown',
            user_agent: userAgent ? userAgent.substring(0, 255) : null, // Limit length
            entry_page: entryPage || '/',
            session_fingerprint: sessionFingerprint,
            session_timeout: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            is_active: true,
            page_views: 1,
            app_version: appVersion || '1.0.0'
          })
          .select('id')
          .single();
        
        if (sessionError) {
          console.error('[enhanced-session-manager] Session creation error:', sessionError);
          return new Response(JSON.stringify({ error: 'Failed to create session' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('[enhanced-session-manager] Session created successfully:', sessionData.id);
        
        return new Response(JSON.stringify({ 
          success: true, 
          sessionId: sessionData.id,
          message: 'Session created successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'update': {
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'Session ID required for update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('[enhanced-session-manager] Updating session:', sessionId);
        
        // Update session with deferred data
        const updateData: any = {
          last_activity: new Date().toISOString(),
          session_timeout: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        if (deferredData) {
          // Process deferred data results
          deferredData.forEach((result: any) => {
            if (result.status === 'fulfilled' && result.value) {
              if (result.value.country) {
                updateData.country_code = result.value.country;
              }
              if (result.value.utm_source) {
                updateData.utm_source = result.value.utm_source;
              }
              if (result.value.utm_medium) {
                updateData.utm_medium = result.value.utm_medium;
              }
              if (result.value.utm_campaign) {
                updateData.utm_campaign = result.value.utm_campaign;
              }
            }
          });
        }
        
        const { error: updateError } = await supabase
          .from('user_sessions')
          .update(updateData)
          .eq('id', sessionId)
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('[enhanced-session-manager] Session update error:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update session' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Session updated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'terminate': {
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'Session ID required for termination' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('[enhanced-session-manager] Terminating session:', sessionId);
        
        const { error: terminateError } = await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            session_end: new Date().toISOString()
          })
          .eq('id', sessionId)
          .eq('user_id', userId);
        
        if (terminateError) {
          console.error('[enhanced-session-manager] Session termination error:', terminateError);
          return new Response(JSON.stringify({ error: 'Failed to terminate session' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Session terminated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
  } catch (error) {
    console.error('[enhanced-session-manager] Error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});