import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

/**
 * Authentication utility for edge functions
 * Provides secure user context extraction from JWT tokens
 */

export interface UserContext {
  userId: string;
  email?: string;
  role?: string;
}

/**
 * Extract user context from Authorization header
 * Returns authenticated Supabase client and user context
 */
export async function getAuthenticatedContext(req: Request): Promise<{
  supabase: any;
  userContext: UserContext;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Extract Authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Create authenticated Supabase client (uses anon key + JWT)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify the token and get user info
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return {
    supabase,
    userContext: {
      userId: user.id,
      email: user.email,
      role: user.user_metadata?.role,
    },
  };
}

/**
 * Create admin Supabase client (for system operations only)
 * WARNING: Bypasses RLS - use only for system-level operations
 */
export function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Validate that user has access to specific journal entry
 * This is a fallback check - RLS should be the primary security mechanism
 */
export async function validateJournalEntryAccess(
  supabase: any,
  entryId: string | number,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('id', entryId)
      .single();

    // If we can fetch the entry, RLS allowed it
    return !error && data;
  } catch {
    return false;
  }
}