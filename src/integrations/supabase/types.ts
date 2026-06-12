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
      ai_request_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          prompt: string
          source: string
          subject: string | null
          tokens_used: number | null
          topic: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          prompt: string
          source: string
          subject?: string | null
          tokens_used?: number | null
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          prompt?: string
          source?: string
          subject?: string | null
          tokens_used?: number | null
          topic?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          created_at: string
          id: string
          normalized_prompt: string
          prompt_hash: string
          response_text: string
          subject: string | null
          topic: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_prompt: string
          prompt_hash: string
          response_text: string
          subject?: string | null
          topic?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          normalized_prompt?: string
          prompt_hash?: string
          response_text?: string
          subject?: string | null
          topic?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_plan_suggestions: {
        Row: {
          action_type: string
          applied_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          payload: Json
          rationale: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          applied_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          payload?: Json
          rationale?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          applied_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          payload?: Json
          rationale?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_plan_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_plan_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "assistant_messages"
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
      external_diagnostic_results: {
        Row: {
          attachment_kind: string | null
          attachment_url: string | null
          created_at: string
          id: string
          max_score: number | null
          notes: string | null
          raw_text: string | null
          score: number | null
          score_percent: number | null
          source_name: string
          source_url: string | null
          strong_topics: Json
          subject_id: string
          taken_on: string
          task_details: Json
          updated_at: string
          user_id: string
          weak_topics: Json
        }
        Insert: {
          attachment_kind?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          notes?: string | null
          raw_text?: string | null
          score?: number | null
          score_percent?: number | null
          source_name: string
          source_url?: string | null
          strong_topics?: Json
          subject_id: string
          taken_on?: string
          task_details?: Json
          updated_at?: string
          user_id: string
          weak_topics?: Json
        }
        Update: {
          attachment_kind?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          notes?: string | null
          raw_text?: string | null
          score?: number | null
          score_percent?: number | null
          source_name?: string
          source_url?: string | null
          strong_topics?: Json
          subject_id?: string
          taken_on?: string
          task_details?: Json
          updated_at?: string
          user_id?: string
          weak_topics?: Json
        }
        Relationships: []
      }
      learning_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: number
          id: string
          is_public: boolean
          objective_type: string
          sort_order: number
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: number
          id?: string
          is_public?: boolean
          objective_type?: string
          sort_order?: number
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: number
          id?: string
          is_public?: boolean
          objective_type?: string
          sort_order?: number
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          provider: string
          sort_order: number
          source_kind: string
          subject_id: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          provider: string
          sort_order?: number
          source_kind: string
          subject_id?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          provider?: string
          sort_order?: number
          source_kind?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_overrides: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          lesson_date: string | null
          lesson_key: string
          slot_number: number | null
          status: string | null
          tasks: Json
          teacher_note: string | null
          theory_markdown: string | null
          title: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id?: string
          lesson_date?: string | null
          lesson_key: string
          slot_number?: number | null
          status?: string | null
          tasks?: Json
          teacher_note?: string | null
          theory_markdown?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          lesson_date?: string | null
          lesson_key?: string
          slot_number?: number | null
          status?: string | null
          tasks?: Json
          teacher_note?: string | null
          theory_markdown?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_resources: {
        Row: {
          block_kind: string
          block_title: string
          block_url: string
          created_at: string
          id: string
          lesson_id: string
          note: string | null
          sort_order: number
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_kind: string
          block_title: string
          block_url: string
          created_at?: string
          id?: string
          lesson_id: string
          note?: string | null
          sort_order?: number
          source_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_kind?: string
          block_title?: string
          block_url?: string
          created_at?: string
          id?: string
          lesson_id?: string
          note?: string | null
          sort_order?: number
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "learning_sources"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          exam_year: number | null
          first_name: string | null
          grade: number | null
          id: string
          last_name: string | null
          onboarding_completed: boolean
          program: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          subjects: string[]
          target_grade: number | null
          target_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          exam_year?: number | null
          first_name?: string | null
          grade?: number | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          program?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[]
          target_grade?: number | null
          target_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          exam_year?: number | null
          first_name?: string | null
          grade?: number | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          program?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          subjects?: string[]
          target_grade?: number | null
          target_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_topics: {
        Row: {
          created_at: string
          id: string
          program_id: string
          required: boolean
          sort_order: number
          topic_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          required?: boolean
          sort_order?: number
          topic_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          required?: boolean
          sort_order?: number
          topic_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_topics_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "subject_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_mistakes: {
        Row: {
          created_at: string
          id: string
          mistake_description: string | null
          mistake_type: string
          source: string | null
          student_profile_id: string
          subject_id: string | null
          task_id: string | null
          topic_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mistake_description?: string | null
          mistake_type: string
          source?: string | null
          student_profile_id: string
          subject_id?: string | null
          task_id?: string | null
          topic_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mistake_description?: string | null
          mistake_type?: string
          source?: string | null
          student_profile_id?: string
          subject_id?: string | null
          task_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_mistakes_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistakes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mistakes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          age: number | null
          country: string | null
          created_at: string
          display_name: string | null
          grade: string | null
          id: string
          language: string
          learning_goal: string | null
          preferred_intensity: string | null
          target_date: string | null
          target_exam: string | null
          target_score: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          grade?: string | null
          id?: string
          language?: string
          learning_goal?: string | null
          preferred_intensity?: string | null
          target_date?: string | null
          target_exam?: string | null
          target_score?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          grade?: string | null
          id?: string
          language?: string
          learning_goal?: string | null
          preferred_intensity?: string | null
          target_date?: string | null
          target_exam?: string | null
          target_score?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_subjects: {
        Row: {
          created_at: string
          goal: string | null
          id: string
          program_id: string | null
          started_at: string | null
          status: string
          student_profile_id: string
          subject_id: string
          target_level: string | null
          target_score: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal?: string | null
          id?: string
          program_id?: string | null
          started_at?: string | null
          status?: string
          student_profile_id: string
          subject_id: string
          target_level?: string | null
          target_score?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal?: string | null
          id?: string
          program_id?: string | null
          started_at?: string | null
          status?: string
          student_profile_id?: string
          subject_id?: string
          target_level?: string | null
          target_score?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "subject_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topic_progress: {
        Row: {
          attempts_count: number
          confidence_level: number | null
          created_at: string
          diagnostic_score: number | null
          id: string
          last_activity_at: string | null
          mastery_score: number
          mistakes_count: number
          practice_score: number | null
          program_id: string | null
          status: string
          student_profile_id: string
          subject_id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          attempts_count?: number
          confidence_level?: number | null
          created_at?: string
          diagnostic_score?: number | null
          id?: string
          last_activity_at?: string | null
          mastery_score?: number
          mistakes_count?: number
          practice_score?: number | null
          program_id?: string | null
          status?: string
          student_profile_id: string
          subject_id: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          attempts_count?: number
          confidence_level?: number | null
          created_at?: string
          diagnostic_score?: number | null
          id?: string
          last_activity_at?: string | null
          mastery_score?: number
          mistakes_count?: number
          practice_score?: number | null
          program_id?: string | null
          status?: string
          student_profile_id?: string
          subject_id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_topic_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "subject_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_topic_progress_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_topic_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_topic_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          first_name: string
          grade: number | null
          id: string
          last_name: string | null
          notes: string | null
          subjects: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          grade?: number | null
          id?: string
          last_name?: string | null
          notes?: string | null
          subjects?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          grade?: number | null
          id?: string
          last_name?: string | null
          notes?: string | null
          subjects?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
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
      subject_programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          exam_type: string | null
          grade: string | null
          id: string
          is_public: boolean
          language: string
          program_type: string
          slug: string | null
          sort_order: number
          standard: string | null
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_type?: string | null
          grade?: string | null
          id?: string
          is_public?: boolean
          language?: string
          program_type?: string
          slug?: string | null
          sort_order?: number
          standard?: string | null
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_type?: string | null
          grade?: string | null
          id?: string
          is_public?: boolean
          language?: string
          program_type?: string
          slug?: string | null
          sort_order?: number
          standard?: string | null
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_programs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string | null
          color_token: string | null
          created_at: string
          created_by: string | null
          description: string | null
          exam_code: string | null
          exam_type: string | null
          id: string
          is_public: boolean
          is_school_subject: boolean
          language: string
          name: string
          slug: string
          sort_order: number
          subject_type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          color_token?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_code?: string | null
          exam_type?: string | null
          id?: string
          is_public?: boolean
          is_school_subject?: boolean
          language?: string
          name: string
          slug: string
          sort_order?: number
          subject_type?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          color_token?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_code?: string | null
          exam_type?: string | null
          id?: string
          is_public?: boolean
          is_school_subject?: boolean
          language?: string
          name?: string
          slug?: string
          sort_order?: number
          subject_type?: string
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
      tasks: {
        Row: {
          answer_type: string
          correct_answer: Json | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          exam_section: string | null
          explanation: string | null
          id: string
          is_published: boolean
          options: Json
          prompt: string
          source_url: string | null
          subject_id: string
          tags: string[]
          task_key: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          answer_type?: string
          correct_answer?: Json | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          exam_section?: string | null
          explanation?: string | null
          id?: string
          is_published?: boolean
          options?: Json
          prompt: string
          source_url?: string | null
          subject_id: string
          tags?: string[]
          task_key: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          answer_type?: string
          correct_answer?: Json | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          exam_section?: string | null
          explanation?: string | null
          id?: string
          is_published?: boolean
          options?: Json
          prompt?: string
          source_url?: string | null
          subject_id?: string
          tags?: string[]
          task_key?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_prerequisites: {
        Row: {
          created_at: string
          id: string
          prerequisite_topic_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prerequisite_topic_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prerequisite_topic_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_prerequisites_prerequisite_topic_id_fkey"
            columns: ["prerequisite_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_prerequisites_topic_id_fkey"
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
          created_by: string | null
          description: string | null
          exam_section: string | null
          id: string
          is_public: boolean
          level: number
          parent_topic_id: string | null
          slug: string | null
          sort_order: number
          source_standard: string | null
          subject_id: string
          theme_code: string | null
          title: string
          topic_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_section?: string | null
          id?: string
          is_public?: boolean
          level?: number
          parent_topic_id?: string | null
          slug?: string | null
          sort_order?: number
          source_standard?: string | null
          subject_id: string
          theme_code?: string | null
          title: string
          topic_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_section?: string | null
          id?: string
          is_public?: boolean
          level?: number
          parent_topic_id?: string | null
          slug?: string | null
          sort_order?: number
          source_standard?: string | null
          subject_id?: string
          theme_code?: string | null
          title?: string
          topic_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_ai_requests_today: {
        Args: { _ip: string; _user_id: string }
        Returns: {
          global_api_count: number
          user_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      diagnostic_type: "entry" | "weekly" | "weekly_subject" | "external"
      difficulty_level: "easy" | "medium" | "hard" | "adaptive"
      lesson_status: "locked" | "available" | "completed" | "missed"
      resource_type: "theory" | "video" | "practice"
      user_role: "student" | "teacher"
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
      app_role: ["admin", "teacher", "student"],
      diagnostic_type: ["entry", "weekly", "weekly_subject", "external"],
      difficulty_level: ["easy", "medium", "hard", "adaptive"],
      lesson_status: ["locked", "available", "completed", "missed"],
      resource_type: ["theory", "video", "practice"],
      user_role: ["student", "teacher"],
    },
  },
} as const
