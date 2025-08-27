import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestData {
  action?: 'check' | 'register' | 'clear';
  deviceToken?: string;
  platform?: 'android' | 'ios' | 'web';
}

Deno.serve(async (req) => {
  console.log(`[debug-device-tokens] ${req.method} request received`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token or user not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const requestData: RequestData = req.method === 'POST' ? await req.json() : {};
    const action = requestData.action || 'check';

    console.log(`[debug-device-tokens] Processing action: ${action} for user: ${user.id}`);

    switch (action) {
      case 'check': {
        // Check current device tokens
        const { data: devices, error } = await supabase
          .from('user_devices')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[debug-device-tokens] Error fetching devices:', error);
          return new Response(JSON.stringify({ error: 'Failed to fetch devices' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Also check notification settings
        const { data: notifications, error: notifError } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'journal_reminder');

        if (notifError) {
          console.error('[debug-device-tokens] Error fetching notifications:', notifError);
        }

        return new Response(JSON.stringify({
          success: true,
          user_id: user.id,
          devices: devices || [],
          device_count: devices?.length || 0,
          notifications: notifications || [],
          notification_count: notifications?.length || 0,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'register': {
        // Manually register a device token
        const { deviceToken, platform } = requestData;
        
        if (!deviceToken || !platform) {
          return new Response(JSON.stringify({ error: 'Missing deviceToken or platform' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Check if device already exists
        const { data: existingDevice } = await supabase
          .from('user_devices')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', platform)
          .single();

        let result;
        if (existingDevice) {
          // Update existing device
          const { data, error } = await supabase
            .from('user_devices')
            .update({
              device_token: deviceToken,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('platform', platform)
            .select('*')
            .single();

          result = { data, error, action: 'updated' };
        } else {
          // Insert new device
          const { data, error } = await supabase
            .from('user_devices')
            .insert({
              user_id: user.id,
              device_token: deviceToken,
              platform: platform,
              last_seen: new Date().toISOString()
            })
            .select('*')
            .single();

          result = { data, error, action: 'inserted' };
        }

        if (result.error) {
          console.error('[debug-device-tokens] Error with device registration:', result.error);
          return new Response(JSON.stringify({ error: 'Failed to register device' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          action: result.action,
          device: result.data,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'clear': {
        // Clear all device tokens for user
        const { error } = await supabase
          .from('user_devices')
          .delete()
          .eq('user_id', user.id);

        if (error) {
          console.error('[debug-device-tokens] Error clearing devices:', error);
          return new Response(JSON.stringify({ error: 'Failed to clear devices' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          action: 'cleared',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

  } catch (error) {
    console.error('[debug-device-tokens] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});