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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          created_at: string
          focus_topics: Json
          id: string
          next_steps: Json
          source_id: string | null
          source_kind: string
          subject_id: string | null
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_topics?: Json
          id?: string
          next_steps?: Json
          source_id?: string | null
          source_kind: string
          subject_id?: string | null
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus_topics?: Json
          id?: string
          next_steps?: Json
          source_id?: string | null
          source_kind?: string
          subject_id?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resources: {
        Row: {
          content_markdown: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          is_published: boolean
          resource_type: Database["public"]["Enums"]["resource_type"]
          solution_text: string | null
          source_url: string | null
          subject_id: string
          tasks: Json
          title: string
          topic_id: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_markdown?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_published?: boolean
          resource_type: Database["public"]["Enums"]["resource_type"]
          solution_text?: string | null
          source_url?: string | null
          subject_id: string
          tasks?: Json
          title: string
          topic_id?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_markdown?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_published?: boolean
          resource_type?: Database["public"]["Enums"]["resource_type"]
          solution_text?: string | null
          source_url?: string | null
          subject_id?: string
          tasks?: Json
          title?: string
          topic_id?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_resources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_sessions: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          diagnostic_type: Database["public"]["Enums"]["diagnostic_type"]
          id: string
          max_score: number | null
          recommendations: Json
          scheduled_for: string | null
          score: number | null
          strengths: Json
          subject_id: string
          updated_at: string
          user_id: string
          weaknesses: Json
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          diagnostic_type: Database["public"]["Enums"]["diagnostic_type"]
          id?: string
          max_score?: number | null
          recommendations?: Json
          scheduled_for?: string | null
          score?: number | null
          strengths?: Json
          subject_id: string
          updated_at?: string
          user_id: string
          weaknesses?: Json
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          diagnostic_type?: Database["public"]["Enums"]["diagnostic_type"]
          id?: string
          max_score?: number | null
          recommendations?: Json
          scheduled_for?: string | null
          score?: number | null
          strengths?: Json
          subject_id?: string
          updated_at?: string
          user_id?: string
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          ai_feedback: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          lesson_date: string
          plan_id: string
          slot_number: number
          status: Database["public"]["Enums"]["lesson_status"]
          subject_id: string
          tasks: Json
          teacher_note: string | null
          theory_markdown: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          lesson_date: string
          plan_id: string
          slot_number: number
          status?: Database["public"]["Enums"]["lesson_status"]
          subject_id: string
          tasks?: Json
          teacher_note?: string | null
          theory_markdown?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          lesson_date?: string
          plan_id?: string
          slot_number?: number
          status?: Database["public"]["Enums"]["lesson_status"]
          subject_id?: string
          tasks?: Json
          teacher_note?: string | null
          theory_markdown?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          created_at: string
          generated_by_ai: boolean
          id: string
          metadata: Json
          period_end: string
          period_start: string
          plan_summary: string | null
          sessions_per_day: number
          title: string
          updated_at: string
          user_id: string
          weekly_rest_day: number
        }
        Insert: {
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          period_end: string
          period_start: string
          plan_summary?: string | null
          sessions_per_day?: number
          title?: string
          updated_at?: string
          user_id: string
          weekly_rest_day?: number
        }
        Update: {
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          period_end?: string
          period_start?: string
          plan_summary?: string | null
          sessions_per_day?: number
          title?: string
          updated_at?: string
          user_id?: string
          weekly_rest_day?: number
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color_token: string | null
          created_at: string
          exam_code: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          exam_code?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          exam_code?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_attempts: {
        Row: {
          correct_answer: Json | null
          created_at: string
          diagnostic_session_id: string | null
          feedback: string | null
          id: string
          is_correct: boolean | null
          lesson_id: string | null
          prompt_snapshot: string | null
          score: number | null
          student_answer: Json | null
          subject_id: string
          submitted_at: string
          task_key: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          diagnostic_session_id?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          lesson_id?: string | null
          prompt_snapshot?: string | null
          score?: number | null
          student_answer?: Json | null
          subject_id: string
          submitted_at?: string
          task_key: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          diagnostic_session_id?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          lesson_id?: string | null
          prompt_snapshot?: string | null
          score?: number | null
          student_answer?: Json | null
          subject_id?: string
          submitted_at?: string
          task_key?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attempts_diagnostic_session_id_fkey"
            columns: ["diagnostic_session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          exam_section: string | null
          id: string
          sort_order: number
          subject_id: string
          theme_code: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_section?: string | null
          id?: string
          sort_order?: number
          subject_id: string
          theme_code?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_section?: string | null
          id?: string
          sort_order?: number
          subject_id?: string
          theme_code?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          screen_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          screen_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          screen_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      diagnostic_type: "entry" | "weekly"
      difficulty_level: "easy" | "medium" | "hard" | "adaptive"
      lesson_status: "locked" | "available" | "completed" | "missed"
      resource_type: "theory" | "video" | "practice"
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
    Enums: {
      diagnostic_type: ["entry", "weekly"],
      difficulty_level: ["easy", "medium", "hard", "adaptive"],
      lesson_status: ["locked", "available", "completed", "missed"],
      resource_type: ["theory", "video", "practice"],
    },
  },
} as const
