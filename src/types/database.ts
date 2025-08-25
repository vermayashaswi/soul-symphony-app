// Simplified database types to avoid TypeScript deep instantiation errors

export interface ProfileRow {
  id: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  country?: string;
  subscription_status?: string;
  subscription_tier?: string;
  is_premium?: boolean;
  trial_ends_at?: string;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  country?: string;
  subscription_status?: string;
  subscription_tier?: string;
  is_premium?: boolean;
  trial_ends_at?: string;
  onboarding_completed?: boolean;
}

export interface ProfileUpdate {
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  country?: string;
  subscription_status?: string;
  subscription_tier?: string;
  is_premium?: boolean;
  trial_ends_at?: string;
  onboarding_completed?: boolean;
  updated_at?: string;
}

export interface JournalEntryRow {
  id: number;
  user_id: string;
  'transcription text'?: string;
  'refined text'?: string;
  audio_url?: string;
  duration?: number;
  emotions?: any;
  entities?: any;
  themes?: string[];
  master_themes?: string[];
  themeemotion?: any;
  sentiment?: number;
  created_at: string;
}

export interface ChatThreadRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatThreadInsert {
  user_id: string;
  title: string;
}

export interface ChatMessageRow {
  id: string;
  thread_id: string;
  content: string;
  sender: string;
  role?: string;
  created_at: string;
  analysis_data?: any;
  sub_query_responses?: any;
  is_processing?: boolean;
  has_numeric_result?: boolean;
  reference_entries?: any;
}

export interface ChatMessageInsert {
  thread_id: string;
  content: string;
  sender: string;
  role?: string;
  analysis_data?: any;
  sub_query_responses?: any;
  is_processing?: boolean;
  has_numeric_result?: boolean;
  reference_entries?: any;
}

export interface FeatureFlagRow {
  id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  rollout_percentage?: number;
  target_audience?: any;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureFlagRow {
  id: string;
  user_id: string;
  feature_flag_id: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureFlagInsert {
  user_id: string;
  feature_flag_id: string;
  is_enabled: boolean;
}

export interface UserSessionRow {
  id: string;
  user_id?: string;
  session_start: string;
  session_end?: string;
  session_duration?: string;
  last_activity: string;
  is_active: boolean;
  device_type?: string;
  start_page?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSessionInsert {
  user_id?: string;
  device_type?: string;
  start_page?: string;
  last_activity?: string;
}