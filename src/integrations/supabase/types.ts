export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          analysis_data: Json | null
          content: string
          created_at: string
          has_numeric_result: boolean | null
          id: string
          is_processing: boolean | null
          reference_entries: Json | null
          role: string | null
          sender: string
          sub_query_responses: Json | null
          sub_query1: string | null
          sub_query2: string | null
          sub_query3: string | null
          thread_id: string
        }
        Insert: {
          analysis_data?: Json | null
          content: string
          created_at?: string
          has_numeric_result?: boolean | null
          id?: string
          is_processing?: boolean | null
          reference_entries?: Json | null
          role?: string | null
          sender: string
          sub_query_responses?: Json | null
          sub_query1?: string | null
          sub_query2?: string | null
          sub_query3?: string | null
          thread_id: string
        }
        Update: {
          analysis_data?: Json | null
          content?: string
          created_at?: string
          has_numeric_result?: boolean | null
          id?: string
          is_processing?: boolean | null
          reference_entries?: Json | null
          role?: string | null
          sender?: string
          sub_query_responses?: Json | null
          sub_query1?: string | null
          sub_query2?: string | null
          sub_query3?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          processing_status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          processing_status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emotions: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      "Journal Entries": {
        Row: {
          audio_url: string | null
          created_at: string
          duration: number | null
          Edit_Status: number
          emotions: Json | null
          entities: Json | null
          entityemotion: Json | null
          "foreign key": string | null
          id: number
          languages: Json | null
          master_themes: string[] | null
          "refined text": string | null
          sentiment: string | null
          "transcription text": string | null
          translation_status: string | null
          user_feedback: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          Edit_Status?: number
          emotions?: Json | null
          entities?: Json | null
          entityemotion?: Json | null
          "foreign key"?: string | null
          id?: number
          languages?: Json | null
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          "transcription text"?: string | null
          translation_status?: string | null
          user_feedback?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          Edit_Status?: number
          emotions?: Json | null
          entities?: Json | null
          entityemotion?: Json | null
          "foreign key"?: string | null
          id?: number
          languages?: Json | null
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          "transcription text"?: string | null
          translation_status?: string | null
          user_feedback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_journal_entries_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: number
          journal_entry_id: number
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: never
          journal_entry_id: number
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: never
          journal_entry_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_embeddings_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "Journal Entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_premium: boolean | null
          journal_focus_areas: string[] | null
          onboarding_completed: boolean | null
          reminder_settings: Json | null
          revenuecat_entitlements: Json | null
          subscription_status: string | null
          subscription_tier: string | null
          timezone: string | null
          trial_ends_at: string | null
          tutorial_completed: string | null
          tutorial_step: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          revenuecat_entitlements?: Json | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          tutorial_completed?: string | null
          tutorial_step?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          revenuecat_entitlements?: Json | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          tutorial_completed?: string | null
          tutorial_step?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles_backup: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_premium: boolean | null
          journal_focus_areas: string[] | null
          onboarding_completed: boolean | null
          reminder_settings: Json | null
          revenuecat_entitlements: Json | null
          subscription_status: string | null
          subscription_tier: string | null
          timezone: string | null
          trial_ends_at: string | null
          tutorial_completed: string | null
          tutorial_step: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          revenuecat_entitlements?: Json | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          tutorial_completed?: string | null
          tutorial_step?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          revenuecat_entitlements?: Json | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          tutorial_completed?: string | null
          tutorial_step?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      revenuecat_customers: {
        Row: {
          created_at: string
          id: string
          revenuecat_app_user_id: string | null
          revenuecat_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revenuecat_app_user_id?: string | null
          revenuecat_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revenuecat_app_user_id?: string | null
          revenuecat_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_subscriptions: {
        Row: {
          auto_renew_status: boolean | null
          billing_issues_detected_at: string | null
          created_at: string
          currency: string | null
          customer_id: string
          expires_date: string | null
          id: string
          is_sandbox: boolean | null
          offering_id: string | null
          original_purchase_date: string | null
          period_type: string | null
          price_in_purchased_currency: number | null
          product_id: string
          purchase_date: string | null
          revenuecat_subscription_id: string
          status: string
          unsubscribe_detected_at: string | null
          updated_at: string
        }
        Insert: {
          auto_renew_status?: boolean | null
          billing_issues_detected_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          expires_date?: string | null
          id?: string
          is_sandbox?: boolean | null
          offering_id?: string | null
          original_purchase_date?: string | null
          period_type?: string | null
          price_in_purchased_currency?: number | null
          product_id: string
          purchase_date?: string | null
          revenuecat_subscription_id: string
          status: string
          unsubscribe_detected_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew_status?: boolean | null
          billing_issues_detected_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          expires_date?: string | null
          id?: string
          is_sandbox?: boolean | null
          offering_id?: string | null
          original_purchase_date?: string | null
          period_type?: string | null
          price_in_purchased_currency?: number | null
          product_id?: string
          purchase_date?: string | null
          revenuecat_subscription_id?: string
          status?: string
          unsubscribe_detected_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "revenuecat_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_webhook_events: {
        Row: {
          app_user_id: string | null
          created_at: string
          error_message: string | null
          event_timestamp: string | null
          event_type: string
          id: string
          processed: boolean | null
          processed_at: string | null
          product_id: string | null
          raw_payload: Json
          revenuecat_user_id: string | null
          subscription_id: string | null
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          error_message?: string | null
          event_timestamp?: string | null
          event_type: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          product_id?: string | null
          raw_payload: Json
          revenuecat_user_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          error_message?: string | null
          event_timestamp?: string | null
          event_type?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          product_id?: string | null
          raw_payload?: Json
          revenuecat_user_id?: string | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          attribution_data: Json | null
          conversion_events: Json | null
          country_code: string | null
          created_at: string
          currency: string | null
          device_type: string | null
          entry_page: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          language: string | null
          last_active_page: string | null
          last_activity: string | null
          location: string | null
          page_views: number | null
          referrer: string | null
          session_duration: unknown | null
          session_end: string | null
          session_start: string
          user_agent: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attribution_data?: Json | null
          conversion_events?: Json | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          device_type?: string | null
          entry_page?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          language?: string | null
          last_active_page?: string | null
          last_activity?: string | null
          location?: string | null
          page_views?: number | null
          referrer?: string | null
          session_duration?: unknown | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attribution_data?: Json | null
          conversion_events?: Json | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          device_type?: string | null
          entry_page?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          language?: string | null
          last_active_page?: string | null
          last_activity?: string | null
          location?: string | null
          page_views?: number | null
          referrer?: string | null
          session_duration?: unknown | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_table_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      check_trial_expiry: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_trials: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      enhanced_manage_user_session: {
        Args:
          | {
              p_user_id: string
              p_device_type: string
              p_user_agent: string
              p_entry_page: string
              p_last_active_page: string
              p_language?: string
              p_referrer?: string
              p_ip_address?: string
            }
          | {
              p_user_id: string
              p_device_type: string
              p_user_agent: string
              p_entry_page: string
              p_last_active_page: string
              p_language?: string
              p_referrer?: string
              p_ip_address?: string
              p_country_code?: string
              p_currency?: string
              p_utm_source?: string
              p_utm_medium?: string
              p_utm_campaign?: string
              p_utm_term?: string
              p_utm_content?: string
              p_gclid?: string
              p_fbclid?: string
              p_attribution_data?: Json
            }
        Returns: string
      }
      execute_dynamic_query: {
        Args: { query_text: string; param_values?: string[] }
        Returns: Json
      }
      get_attribution_analytics: {
        Args: { p_start_date?: string; p_end_date?: string }
        Returns: {
          utm_source: string
          utm_medium: string
          utm_campaign: string
          sessions_count: number
          unique_users_count: number
          conversions_count: number
          top_countries: Json
        }[]
      }
      get_entity_emotion_statistics: {
        Args: {
          user_id_filter: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          entity_name: string
          entity_type: string
          emotion_name: string
          relationship_count: number
          avg_strength: number
          max_strength: number
          first_occurrence: string
          last_occurrence: string
        }[]
      }
      get_entity_statistics: {
        Args: {
          user_id_filter: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          entity_type: string
          entity_name: string
          entry_count: number
          avg_sentiment_score: number
          first_occurrence: string
          last_occurrence: string
        }[]
      }
      get_entries_by_emotion_term: {
        Args: {
          emotion_term: string
          user_id_filter: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          id: number
          content: string
          created_at: string
        }[]
      }
      get_theme_statistics: {
        Args: {
          user_id_filter: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          theme: string
          entry_count: number
          avg_sentiment_score: number
          first_occurrence: string
          last_occurrence: string
        }[]
      }
      get_top_emotions: {
        Args: {
          user_id_param: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          emotion: string
          score: number
        }[]
      }
      get_top_emotions_by_chunks: {
        Args: {
          user_id_param: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          emotion: string
          score: number
          sample_chunks: Json
        }[]
      }
      get_top_emotions_with_entries: {
        Args: {
          user_id_param: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          emotion: string
          score: number
          sample_entries: Json
        }[]
      }
      get_top_entities_with_entries: {
        Args: {
          user_id_param: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          entity_type: string
          entity_name: string
          entry_count: number
          avg_sentiment: number
          sample_entries: Json
        }[]
      }
      get_top_entity_emotion_relationships: {
        Args: {
          user_id_filter: string
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          entity_name: string
          entity_type: string
          emotion_name: string
          relationship_strength: number
          entry_count: number
          sample_entries: Json
        }[]
      }
      get_user_subscription_status: {
        Args: { user_id_param: string }
        Returns: {
          current_status: string
          current_tier: string
          is_premium_access: boolean
          trial_end_date: string
          is_trial_active: boolean
          days_remaining: number
        }[]
      }
      has_active_session: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      insert_sample_journal_entries: {
        Args: { target_user_id: string }
        Returns: {
          inserted_id: number
          inserted_created_at: string
        }[]
      }
      is_trial_eligible: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      manage_user_session: {
        Args: {
          p_user_id: string
          p_device_type: string
          p_user_agent: string
          p_entry_page: string
          p_last_active_page: string
        }
        Returns: string
      }
      mark_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      match_chunks_with_date: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          user_id_filter: string
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          chunk_id: number
          content: string
          created_at: string
          similarity: number
          chunk_index: number
          total_chunks: number
          entry_content: string
          themes: string[]
          emotions: Json
        }[]
      }
      match_journal_entries: {
        Args:
          | Record<PropertyKey, never>
          | {
              query_embedding: string
              match_threshold: number
              match_count: number
              user_id_filter: string
            }
        Returns: {
          id: number
          content: string
          similarity: number
          embedding: string
          created_at: string
          themes: string[]
          emotions: Json
        }[]
      }
      match_journal_entries_by_emotion: {
        Args: {
          emotion_name: string
          user_id_filter: string
          min_score?: number
          start_date?: string
          end_date?: string
          limit_count?: number
        }
        Returns: {
          id: number
          content: string
          created_at: string
          emotion_score: number
          embedding: string
        }[]
      }
      match_journal_entries_by_emotion_strength: {
        Args: {
          emotion_name: string
          user_id_filter: string
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          emotion_score: number
          embedding: string
        }[]
      }
      match_journal_entries_by_entities: {
        Args: {
          entity_queries: string[]
          user_id_filter: string
          match_threshold?: number
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          entities: Json
          similarity: number
          entity_matches: Json
        }[]
      }
      match_journal_entries_by_entity_emotion: {
        Args: {
          entity_queries: string[]
          emotion_queries: string[]
          user_id_filter: string
          match_threshold?: number
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          entities: Json
          emotions: Json
          entityemotion: Json
          similarity: number
          entity_emotion_matches: Json
          relationship_strength: number
        }[]
      }
      match_journal_entries_by_theme: {
        Args: {
          theme_query: string
          user_id_filter: string
          match_threshold?: number
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          themes: string[]
          similarity: number
        }[]
      }
      match_journal_entries_by_theme_array: {
        Args: {
          theme_queries: string[]
          user_id_filter: string
          match_threshold?: number
          match_count?: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          themes: string[]
          similarity: number
          theme_matches: string[]
        }[]
      }
      match_journal_entries_fixed: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          user_id_filter: string
        }
        Returns: {
          id: number
          content: string
          similarity: number
          embedding: string
          created_at: string
        }[]
      }
      match_journal_entries_with_date: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          user_id_filter: string
          start_date?: string
          end_date?: string
        }
        Returns: {
          id: number
          content: string
          created_at: string
          similarity: number
          themes: string[]
          emotions: Json
        }[]
      }
      store_user_query: {
        Args:
          | Record<PropertyKey, never>
          | {
              user_id: string
              query_text: string
              query_embedding: string
              thread_id: string
              message_id?: string
            }
        Returns: undefined
      }
      table_exists: {
        Args: { table_name: string }
        Returns: boolean
      }
      track_conversion_event: {
        Args: {
          p_session_id: string
          p_event_type: string
          p_event_data?: Json
        }
        Returns: undefined
      }
      update_session_activity: {
        Args: { p_session_id: string; p_page?: string; p_language?: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
