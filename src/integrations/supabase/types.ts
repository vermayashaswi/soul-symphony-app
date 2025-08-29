export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          analysis_data: Json | null
          content: string
          created_at: string
          has_numeric_result: boolean | null
          id: string
          idempotency_key: string | null
          is_processing: boolean | null
          reference_entries: Json | null
          request_correlation_id: string | null
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
          idempotency_key?: string | null
          is_processing?: boolean | null
          reference_entries?: Json | null
          request_correlation_id?: string | null
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
          idempotency_key?: string | null
          is_processing?: boolean | null
          reference_entries?: Json | null
          request_correlation_id?: string | null
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
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          rollout_percentage: number | null
          target_audience: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          rollout_percentage?: number | null
          target_audience?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          rollout_percentage?: number | null
          target_audience?: Json | null
          updated_at?: string
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
          "foreign key": string | null
          id: number
          languages: Json | null
          master_themes: string[] | null
          "refined text": string | null
          sentiment: number | null
          themeemotion: Json | null
          themes: string[] | null
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
          "foreign key"?: string | null
          id?: number
          languages?: Json | null
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: number | null
          themeemotion?: Json | null
          themes?: string[] | null
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
          "foreign key"?: string | null
          id?: number
          languages?: Json | null
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: number | null
          themeemotion?: Json | null
          themes?: string[] | null
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
            isOneToOne: true
            referencedRelation: "Journal Entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          entry_count: number | null
          full_name: string | null
          id: string
          is_premium: boolean | null
          journal_focus_areas: string[] | null
          notification_preferences: Json | null
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
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          entry_count?: number | null
          full_name?: string | null
          id: string
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          notification_preferences?: Json | null
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
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          entry_count?: number | null
          full_name?: string | null
          id?: string
          is_premium?: boolean | null
          journal_focus_areas?: string[] | null
          notification_preferences?: Json | null
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
      themes: {
        Row: {
          category_type: string
          created_at: string
          description: string | null
          display_order: number | null
          id: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_app_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          data: Json | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          message: string
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string
          device_token: string
          id: string
          last_seen: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          last_seen?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          last_seen?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feature_flags: {
        Row: {
          created_at: string
          feature_flag_id: string
          id: string
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_flag_id: string
          id?: string
          is_enabled: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_flag_id?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_flags_feature_flag_id_fkey"
            columns: ["feature_flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feature_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          scheduled_time: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          scheduled_time: string
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          scheduled_time?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_notifications_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          app_language: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity: string
          most_interacted_page: string | null
          page_interactions: Json | null
          pages_visited: string[] | null
          session_duration: unknown | null
          session_end: string | null
          session_start: string
          session_timeout: string
          start_page: string | null
          total_page_views: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app_language?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          most_interacted_page?: string | null
          page_interactions?: Json | null
          pages_visited?: string[] | null
          session_duration?: unknown | null
          session_end?: string | null
          session_start?: string
          session_timeout?: string
          start_page?: string | null
          total_page_views?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app_language?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          most_interacted_page?: string | null
          page_interactions?: Json | null
          pages_visited?: string[] | null
          session_duration?: unknown | null
          session_end?: string | null
          session_start?: string
          session_timeout?: string
          start_page?: string | null
          total_page_views?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_streak: {
        Args: { user_id_param: string }
        Returns: number
      }
      check_database_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_journal_entry_ownership: {
        Args: { entry_id_param: number }
        Returns: boolean
      }
      check_message_persistence_health: {
        Args: { expected_message_count?: number; thread_id_param: string }
        Returns: Json
      }
      check_table_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      check_thread_ownership: {
        Args: { thread_id_param: string }
        Returns: boolean
      }
      check_trial_expiry: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_trials: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_idle_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_malformed_json_messages: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_old_notifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      close_user_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      comprehensive_auth_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      comprehensive_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      debug_user_auth: {
        Args: { target_user_id: string }
        Returns: Json
      }
      delete_all_user_journal_entries: {
        Args: { p_user_id: string }
        Returns: Json
      }
      enhanced_manage_user_session: {
        Args:
          | {
              p_attribution_data?: Json
              p_country_code?: string
              p_currency?: string
              p_device_type: string
              p_entry_page: string
              p_fbclid?: string
              p_gclid?: string
              p_ip_address?: string
              p_language?: string
              p_last_active_page: string
              p_referrer?: string
              p_user_agent: string
              p_user_id: string
              p_utm_campaign?: string
              p_utm_content?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_utm_term?: string
            }
          | {
              p_device_type: string
              p_entry_page: string
              p_ip_address?: string
              p_language?: string
              p_last_active_page: string
              p_referrer?: string
              p_user_agent: string
              p_user_id: string
            }
        Returns: string
      }
      ensure_user_profile: {
        Args: { p_user_id: string }
        Returns: Json
      }
      execute_dynamic_query: {
        Args: { query_text: string; user_timezone?: string }
        Returns: Json
      }
      extend_session_activity: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      get_active_themes: {
        Args: Record<PropertyKey, never>
        Returns: {
          description: string
          display_order: number
          id: number
          name: string
        }[]
      }
      get_entity_emotion_statistics: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          avg_strength: number
          emotion_name: string
          entity_name: string
          entity_type: string
          first_occurrence: string
          last_occurrence: string
          max_strength: number
          relationship_count: number
        }[]
      }
      get_entity_statistics: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          avg_sentiment_score: number
          entity_name: string
          entity_type: string
          entry_count: number
          first_occurrence: string
          last_occurrence: string
        }[]
      }
      get_entries_by_emotion_term: {
        Args: {
          emotion_term: string
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          id: number
        }[]
      }
      get_journal_entry_count: {
        Args: { end_date?: string; start_date?: string; user_id_filter: string }
        Returns: number
      }
      get_theme_statistics: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          avg_sentiment_score: number
          entry_count: number
          first_occurrence: string
          last_occurrence: string
          theme: string
        }[]
      }
      get_time_of_day_distribution: {
        Args: { end_date?: string; start_date?: string; user_timezone?: string }
        Returns: {
          bucket: string
          entry_count: number
          percentage: number
        }[]
      }
      get_top_emotions: {
        Args:
          | { end_date?: string; limit_count?: number; start_date?: string }
          | {
              end_date?: string
              limit_count?: number
              start_date?: string
              user_id_param: string
            }
        Returns: {
          emotion: string
          score: number
        }[]
      }
      get_top_emotions_by_chunks: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_param: string
        }
        Returns: {
          emotion: string
          sample_chunks: Json
          score: number
        }[]
      }
      get_top_emotions_with_entries: {
        Args:
          | { end_date?: string; limit_count?: number; start_date?: string }
          | {
              end_date?: string
              limit_count?: number
              start_date?: string
              user_id_param: string
            }
        Returns: {
          emotion: string
          sample_entries: Json
          score: number
        }[]
      }
      get_top_entities_with_entries: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_param: string
        }
        Returns: {
          avg_sentiment: number
          entity_name: string
          entity_type: string
          entry_count: number
          sample_entries: Json
        }[]
      }
      get_top_entity_emotion_relationships: {
        Args: {
          end_date?: string
          limit_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          emotion_name: string
          entity_name: string
          entity_type: string
          entry_count: number
          relationship_strength: number
          sample_entries: Json
        }[]
      }
      get_user_profile_with_trial: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_subscription_status: {
        Args: { user_id_param: string }
        Returns: {
          current_status: string
          current_tier: string
          is_premium_access: boolean
          is_trial_active: boolean
          trial_end_date: string
        }[]
      }
      insert_sample_journal_entries: {
        Args: { target_user_id: string }
        Returns: {
          inserted_created_at: string
          inserted_id: number
        }[]
      }
      is_trial_eligible: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      manage_user_session: {
        Args: {
          p_device_type: string
          p_entry_page: string
          p_last_active_page: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: string
      }
      mark_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      match_chunks_with_date: {
        Args: {
          end_date?: string
          match_count: number
          match_threshold: number
          query_embedding: string
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          chunk_id: number
          chunk_index: number
          content: string
          created_at: string
          emotions: Json
          entry_content: string
          id: number
          similarity: number
          themes: string[]
          total_chunks: number
        }[]
      }
      match_journal_entries: {
        Args:
          | Record<PropertyKey, never>
          | {
              match_count: number
              match_threshold: number
              query_embedding: string
              user_id_filter: string
            }
        Returns: {
          content: string
          created_at: string
          embedding: string
          emotions: Json
          id: number
          similarity: number
          themes: string[]
        }[]
      }
      match_journal_entries_by_emotion: {
        Args: {
          emotion_name: string
          end_date?: string
          limit_count?: number
          min_score?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          embedding: string
          emotion_score: number
          id: number
        }[]
      }
      match_journal_entries_by_emotion_strength: {
        Args: {
          emotion_name: string
          end_date?: string
          match_count?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          embedding: string
          emotion_score: number
          id: number
        }[]
      }
      match_journal_entries_by_entities: {
        Args: {
          end_date?: string
          entity_queries: string[]
          match_count?: number
          match_threshold?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          entities: Json
          entity_matches: Json
          id: number
          similarity: number
        }[]
      }
      match_journal_entries_by_entity_emotion: {
        Args: {
          emotion_queries: string[]
          end_date?: string
          entity_queries: string[]
          match_count?: number
          match_threshold?: number
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          emotions: Json
          entities: Json
          entity_emotion_matches: Json
          entityemotion: Json
          id: number
          relationship_strength: number
          similarity: number
        }[]
      }
      match_journal_entries_by_theme: {
        Args: {
          end_date?: string
          match_count?: number
          match_threshold?: number
          start_date?: string
          theme_query: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          id: number
          similarity: number
          themes: string[]
        }[]
      }
      match_journal_entries_by_theme_array: {
        Args: {
          end_date?: string
          match_count?: number
          match_threshold?: number
          start_date?: string
          theme_queries: string[]
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          id: number
          similarity: number
          theme_matches: string[]
          themes: string[]
        }[]
      }
      match_journal_entries_fixed: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          embedding: string
          id: number
          similarity: number
        }[]
      }
      match_journal_entries_with_date: {
        Args: {
          end_date?: string
          match_count: number
          match_threshold: number
          query_embedding: string
          start_date?: string
          user_id_filter: string
        }
        Returns: {
          content: string
          created_at: string
          emotions: Json
          id: number
          similarity: number
          themes: string[]
        }[]
      }
      perform_database_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      pg_advisory_unlock: {
        Args: { key: number }
        Returns: boolean
      }
      pg_try_advisory_lock: {
        Args: { key: number }
        Returns: boolean
      }
      regenerate_missing_data_for_entry: {
        Args: { target_entry_id: number }
        Returns: Json
      }
      reset_user_auth: {
        Args: { target_user_id: string }
        Returns: Json
      }
      resume_or_create_session: {
        Args: {
          p_device_type?: string
          p_entry_page?: string
          p_user_id: string
        }
        Returns: string
      }
      setup_user_trial_fallback: {
        Args: { user_id: string }
        Returns: Json
      }
      simple_session_manager: {
        Args: {
          p_device_type?: string
          p_entry_page?: string
          p_user_id: string
        }
        Returns: string
      }
      store_user_query: {
        Args:
          | Record<PropertyKey, never>
          | {
              message_id?: string
              query_embedding: string
              query_text: string
              thread_id: string
              user_id: string
            }
        Returns: undefined
      }
      sync_all_reminder_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      sync_reminder_settings_to_notifications: {
        Args: { p_user_id: string }
        Returns: Json
      }
      table_exists: {
        Args: { table_name: string }
        Returns: boolean
      }
      test_auth_flow: {
        Args: { test_user_id: string }
        Returns: Json
      }
      test_vector_operations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      thread_belongs_to_user: {
        Args: { thread_id: string }
        Returns: boolean
      }
      update_session_activity: {
        Args: { p_language?: string; p_page?: string; p_session_id: string }
        Returns: undefined
      }
      upsert_journal_embedding: {
        Args: { embedding_vector: string; entry_id: number }
        Returns: undefined
      }
      validate_thread_ownership: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: boolean
      }
      verify_vector_operations: {
        Args: Record<PropertyKey, never>
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
