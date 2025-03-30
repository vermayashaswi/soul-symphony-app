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
          content: string
          created_at: string
          id: string
          reference_entries: Json | null
          sender: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reference_entries?: Json | null
          sender: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reference_entries?: Json | null
          sender?: string
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
          categories: string[] | null
          created_at: string
          duration: number | null
          emotions: Json | null
          entities: Json | null
          "foreign key": string | null
          id: number
          master_themes: string[] | null
          "refined text": string | null
          sentiment: string | null
          "transcription text": string | null
          user_id: string | null
        }
        Insert: {
          audio_url?: string | null
          categories?: string[] | null
          created_at?: string
          duration?: number | null
          emotions?: Json | null
          entities?: Json | null
          "foreign key"?: string | null
          id?: number
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          "transcription text"?: string | null
          user_id?: string | null
        }
        Update: {
          audio_url?: string | null
          categories?: string[] | null
          created_at?: string
          duration?: number | null
          emotions?: Json | null
          entities?: Json | null
          "foreign key"?: string | null
          id?: number
          master_themes?: string[] | null
          "refined text"?: string | null
          sentiment?: string | null
          "transcription text"?: string | null
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
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      user_queries: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          message_id: string | null
          query_text: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          message_id?: string | null
          query_text: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          message_id?: string | null
          query_text?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_queries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_queries_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
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
      mark_inactive_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      match_journal_entries:
        | {
            Args: Record<PropertyKey, never>
            Returns: undefined
          }
        | {
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
        }[]
      }
      store_user_query:
        | {
            Args: Record<PropertyKey, never>
            Returns: undefined
          }
        | {
            Args: {
              user_id: string
              query_text: string
              query_embedding: string
              thread_id: string
              message_id?: string
            }
            Returns: string
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
