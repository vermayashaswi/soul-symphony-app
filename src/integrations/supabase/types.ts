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
          master_themes: string[] | null
          "refined text": string | null
          sentiment: string | null
          timezone_name: string | null
          timezone_offset: number | null
          "transcription text": string | null
          translation_status: string | null
          user_feedback: string | null
          user_id: string | null
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
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          timezone_name?: string | null
          timezone_offset?: number | null
          "transcription text"?: string | null
          translation_status?: string | null
          user_feedback?: string | null
          user_id?: string | null
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
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          timezone_name?: string | null
          timezone_offset?: number | null
          "transcription text"?: string | null
          translation_status?: string | null
          user_feedback?: string | null
          user_id?: string | null
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
          journal_focus_areas: string[] | null
          onboarding_completed: boolean | null
          reminder_settings: Json | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          journal_focus_areas?: string[] | null
          onboarding_completed?: boolean | null
          reminder_settings?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      "Subscription Status": {
        Row: {
          "cancellation date": string | null
          created_at: string
          id: number
          "subscription date": string | null
        }
        Insert: {
          "cancellation date"?: string | null
          created_at?: string
          id?: number
          "subscription date"?: string | null
        }
        Update: {
          "cancellation date"?: string | null
          created_at?: string
          id?: number
          "subscription date"?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_type: string | null
          entry_page: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_active_page: string | null
          last_activity: string | null
          location: string | null
          referrer: string | null
          session_end: string | null
          session_start: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          entry_page?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_active_page?: string | null
          last_activity?: string | null
          location?: string | null
          referrer?: string | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          entry_page?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_active_page?: string | null
          last_activity?: string | null
          location?: string | null
          referrer?: string | null
          session_end?: string | null
          session_start?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_subscribed: boolean | null
          trial_start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_subscribed?: boolean | null
          trial_start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_subscribed?: boolean | null
          trial_start_date?: string | null
          user_id?: string
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
      execute_dynamic_query: {
        Args: { query_text: string; param_values?: string[] }
        Returns: Json
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
