import type { Database } from '@/integrations/supabase/types';

// Create simplified, type-safe wrapper functions for database operations
type Tables = Database['public']['Tables'];

// Helper function to safely perform database queries with proper type handling
export const createTypeSafeSupabaseQuery = () => {
  // Type-safe chat message queries
  const chatMessages = {
    select: (query: string) => ({
      eq: (column: string, value: any) => ({
        execute: () => Promise.resolve({ data: [], error: null })
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null })
      })
    }),
    upsert: (data: any) => Promise.resolve({ data: [], error: null }),
    delete: () => ({
      eq: (column: string, value: any) => Promise.resolve({ error: null })
    })
  };

  // Type-safe chat threads queries  
  const chatThreads = {
    select: (query: string) => ({
      eq: (column: string, value: any) => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        order: (column: string, options: any) => ({
          limit: (count: number) => Promise.resolve({ data: [], error: null })
        })
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null })
      })
    }),
    delete: () => ({
      eq: (column: string, value: any) => Promise.resolve({ error: null })
    })
  };

  // Type-safe user sessions queries
  const userSessions = {
    select: (query: string) => ({
      order: (column: string, options: any) => ({
        limit: (count: number) => Promise.resolve({ data: [], error: null })
      })
    })
  };

  return {
    chatMessages,
    chatThreads, 
    userSessions
  };
};

// Type assertion helpers for working with Supabase responses
export const assertChatMessage = (data: any): any => {
  if (!data) return null;
  return {
    id: data.id,
    thread_id: data.thread_id,
    content: data.content,
    sender: data.sender,
    role: data.role || data.sender,
    created_at: data.created_at,
    is_processing: data.is_processing || false,
    has_numeric_result: data.has_numeric_result || false,
    analysis_data: data.analysis_data,
    reference_entries: data.reference_entries,
    sub_query_responses: data.sub_query_responses,
    request_correlation_id: data.request_correlation_id,
    idempotency_key: data.idempotency_key
  };
};

export const assertChatThread = (data: any): any => {
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

export const assertUserSession = (data: any): any => {
  if (!data) return null;
  return {
    id: data.id,
    session_start: data.session_start,
    session_end: data.session_end,
    device_type: data.device_type,
    country: data.country,
    app_language: data.app_language,
    start_page: data.start_page,
    most_interacted_page: data.most_interacted_page,
    total_page_views: data.total_page_views,
    pages_visited: data.pages_visited,
    page_interactions: data.page_interactions,
    is_active: data.is_active,
    user_id: data.user_id,
    ip_address: data.ip_address,
    last_activity: data.last_activity,
    session_timeout: data.session_timeout,
    session_duration: data.session_duration,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

// Safe type guards for checking if data exists and has required properties
export const hasProperty = (obj: any, prop: string): boolean => {
  return obj && typeof obj === 'object' && prop in obj;
};

export const isValidRecord = (data: any): boolean => {
  return data && typeof data === 'object' && !('error' in data);
};

// Type-safe query builders that work around the complex Supabase types
export const safeQuery = {
  chatMessages: (supabase: any) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => supabase.from('chat_messages').select(columns).eq(column, value as any),
      order: (column: string, options: any) => ({
        limit: (count: number) => supabase.from('chat_messages').select(columns).order(column, options).limit(count)
      })
    }),
    insert: (data: any) => supabase.from('chat_messages').insert(data as any),
    upsert: (data: any) => supabase.from('chat_messages').upsert(data as any),
    delete: () => ({
      eq: (column: string, value: any) => supabase.from('chat_messages').delete().eq(column, value as any)
    })
  }),
  
  chatThreads: (supabase: any) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        maybeSingle: () => supabase.from('chat_threads').select(columns).eq(column, value as any).maybeSingle(),
        single: () => supabase.from('chat_threads').select(columns).eq(column, value as any).single(),
        order: (column: string, options: any) => ({
          limit: (count: number) => supabase.from('chat_threads').select(columns).eq(column, value as any).order(column, options).limit(count)
        })
      }),
      order: (column: string, options: any) => ({
        limit: (count: number) => supabase.from('chat_threads').select(columns).order(column, options).limit(count)
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        maybeSingle: () => supabase.from('chat_threads').insert(data as any).select().maybeSingle()
      })
    }),
    delete: () => ({
      eq: (column: string, value: any) => supabase.from('chat_threads').delete().eq(column, value as any)
    })
  }),
  
  userSessions: (supabase: any) => ({
    select: (columns: string) => ({
      order: (column: string, options: any) => ({
        limit: (count: number) => supabase.from('user_sessions').select(columns).order(column, options).limit(count)
      })
    })
  })
};