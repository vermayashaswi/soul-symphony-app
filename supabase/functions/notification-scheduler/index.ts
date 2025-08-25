import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          reminder_settings: any;
          timezone: string | null;
          email: string | null;
        };
      };
      notification_queue: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          scheduled_for: string;
          title: string;
          body: string;
          data: any;
          status: string;
        };
        Insert: {
          user_id: string;
          notification_type: string;
          scheduled_for: string;
          title: string;
          body: string;
          data?: any;
          status?: string;
        };
      };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[notification-scheduler] Starting notification scheduling process');

    // Call the database function to schedule reminders
    const { data, error } = await supabaseClient.rpc('schedule_journal_reminders');

    if (error) {
      console.error('[notification-scheduler] Error scheduling reminders:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[notification-scheduler] Scheduled reminders:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications scheduled successfully',
        ...data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[notification-scheduler] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});