
import { serve } from "https://deno.land/std@0.206.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const tier = searchParams.get('tier'); // Optional: for premium tiers
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    // Query for global flags and any for this user or tier
    let { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .or([
        "target_type.eq.global",
        ...(userId ? [`and(target_type.eq.user,target_value.eq.${userId})`] : []),
        ...(tier ? [`and(target_type.eq.tier,target_value.eq.${tier})`] : [])
      ].join(','));

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Return enabled feature keys only (true or per-user/segment)
    const flags = (data ?? [])
      .filter((f: any) => !!f.enabled)
      .map((f: any) => f.key);

    return new Response(JSON.stringify({ flags }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
