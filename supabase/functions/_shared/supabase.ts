
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// DEPRECATED: Use getAuthenticatedContext from auth.ts instead
// This admin client bypasses RLS and should only be used for system operations
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
