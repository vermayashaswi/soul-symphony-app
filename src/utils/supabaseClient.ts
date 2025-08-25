// Type-safe Supabase client wrapper to avoid deep instantiation errors
import { supabase } from '@/integrations/supabase/client';
import type {
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  JournalEntryRow,
  ChatThreadRow,
  ChatThreadInsert,
  ChatMessageRow,
  ChatMessageInsert,
  FeatureFlagRow,
  UserFeatureFlagRow,
  UserFeatureFlagInsert,
  UserSessionRow,
  UserSessionInsert,
} from '@/types/database';

// Generic response type
export interface DatabaseResponse<T> {
  data: T | null;
  error: any;
}

export interface DatabaseListResponse<T> {
  data: T[] | null;
  error: any;
}

// Profiles table operations
export const profilesClient = {
  async select(userId: string): Promise<DatabaseResponse<ProfileRow>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    return { data: data as ProfileRow | null, error };
  },

  async insert(profile: ProfileInsert): Promise<DatabaseResponse<ProfileRow>> {
    const { data, error } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();
    
    return { data: data as ProfileRow | null, error };
  },

  async update(userId: string, updates: ProfileUpdate): Promise<DatabaseResponse<ProfileRow>> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    return { data: data as ProfileRow | null, error };
  }
};

// Journal Entries table operations
export const journalEntriesClient = {
  async selectByUser(userId: string, options?: {
    startDate?: string;
    endDate?: string;
    columns?: string;
    limit?: number;
  }): Promise<DatabaseListResponse<JournalEntryRow>> {
    let query = supabase
      .from('Journal Entries')
      .select(options?.columns || '*')
      .eq('user_id', userId);

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    return { data: data as any, error };
  }
};

// Chat Threads table operations
export const chatThreadsClient = {
  async selectByUser(userId: string): Promise<DatabaseListResponse<ChatThreadRow>> {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    return { data: data as ChatThreadRow[] | null, error };
  },

  async insert(thread: ChatThreadInsert): Promise<DatabaseResponse<ChatThreadRow>> {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert(thread)
      .select()
      .single();
    
    return { data: data as ChatThreadRow | null, error };
  }
};

// Chat Messages table operations
export const chatMessagesClient = {
  async selectByThread(threadId: string, options?: {
    columns?: string;
    limit?: number;
  }): Promise<DatabaseListResponse<ChatMessageRow>> {
    let query = supabase
      .from('chat_messages')
      .select(options?.columns || '*')
      .eq('thread_id', threadId);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    
    return { data: data as any, error };
  },

  async insert(message: ChatMessageInsert): Promise<DatabaseResponse<ChatMessageRow>> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(message)
      .select()
      .single();
    
    return { data: data as ChatMessageRow | null, error };
  },

  async selectByThreadAndSender(
    threadId: string, 
    sender: string, 
    options?: { columns?: string; limit?: number }
  ): Promise<DatabaseListResponse<ChatMessageRow>> {
    let query = supabase
      .from('chat_messages')
      .select(options?.columns || '*')
      .eq('thread_id', threadId)
      .eq('sender', sender);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    return { data: data as any, error };
  }
};

// Feature Flags table operations
export const featureFlagsClient = {
  async selectAll(): Promise<DatabaseListResponse<FeatureFlagRow>> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*');
    
    return { data: data as FeatureFlagRow[] | null, error };
  },

  async selectByName(name: string): Promise<DatabaseResponse<FeatureFlagRow>> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('name', name)
      .single();
    
    return { data: data as FeatureFlagRow | null, error };
  }
};

// User Feature Flags table operations
export const userFeatureFlagsClient = {
  async selectByUser(userId: string): Promise<DatabaseListResponse<UserFeatureFlagRow>> {
    const { data, error } = await supabase
      .from('user_feature_flags')
      .select('*')
      .eq('user_id', userId);
    
    return { data: data as UserFeatureFlagRow[] | null, error };
  },

  async upsert(userFlag: UserFeatureFlagInsert, options?: { onConflict?: string }): Promise<DatabaseResponse<UserFeatureFlagRow>> {
    const { data, error } = await supabase
      .from('user_feature_flags')
      .upsert(userFlag, options)
      .select()
      .single();
    
    return { data: data as UserFeatureFlagRow | null, error };
  },

  async delete(userId: string, featureFlagId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('user_feature_flags')
      .delete()
      .eq('user_id', userId)
      .eq('feature_flag_id', featureFlagId);
    
    return { error };
  }
};

// User Sessions table operations
export const userSessionsClient = {
  async insert(session: UserSessionInsert): Promise<DatabaseResponse<UserSessionRow>> {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert(session)
      .select()
      .single();
    
    return { data: data as UserSessionRow | null, error };
  }
};

// Export individual clients and a combined client
export const db = {
  profiles: profilesClient,
  journalEntries: journalEntriesClient,
  chatThreads: chatThreadsClient,
  chatMessages: chatMessagesClient,
  featureFlags: featureFlagsClient,
  userFeatureFlags: userFeatureFlagsClient,
  userSessions: userSessionsClient,
};