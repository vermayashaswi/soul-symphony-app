
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://kwnwhgucnzqxndzjayyq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheSJ5cSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM2NDMxNDcyLCJleHAiOjIwNTIwMDc0NzJ9.NZoyb7BoqCrklJjF6ULM8GN9_zHKPHgzFJUxHJl7zZU";

// Enhanced Supabase client configuration for webtonative OAuth
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Critical: Proper storage and session management
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Enhanced flow type for webtonative
    flowType: 'pkce',
    // Improve OAuth handling
    debug: process.env.NODE_ENV === 'development'
  },
  // Enhanced real-time configuration
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // Global request configuration
  global: {
    headers: {
      'x-client-info': 'supabase-js-web'
    }
  }
});

// Add connection monitoring for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Supabase] Client initialized with enhanced config');
}
