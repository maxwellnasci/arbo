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
      anamnesis: {
        Row: {
          created_at: string | null
          experience_years: number | null
          height_cm: number | null
          id: string
          max_heart_rate: number | null
          objectives: string[] | null
          physical_limitations: string | null
          updated_at: string | null
          user_id: string
          weekly_frequency: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          experience_years?: number | null
          height_cm?: number | null
          id?: string
          max_heart_rate?: number | null
          objectives?: string[] | null
          physical_limitations?: string | null
          updated_at?: string | null
          user_id: string
          weekly_frequency?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          experience_years?: number | null
          height_cm?: number | null
          id?: string
          max_heart_rate?: number | null
          objectives?: string[] | null
          physical_limitations?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_frequency?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          actual_distance_m: number | null
          actual_duration_seconds: number | null
          actual_pace_seconds_per_km: number | null
          approved: boolean | null
          approved_by: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          perceived_effort: number | null
          plan_id: string | null
          strava_activity_id: number | null
          student_id: string
          training_id: string | null
        }
        Insert: {
          actual_distance_m?: number | null
          actual_duration_seconds?: number | null
          actual_pace_seconds_per_km?: number | null
          approved?: boolean | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          strava_activity_id?: number | null
          student_id: string
          training_id?: string | null
        }
        Update: {
          actual_distance_m?: number | null
          actual_duration_seconds?: number | null
          actual_pace_seconds_per_km?: number | null
          approved?: boolean | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          plan_id?: string | null
          strava_activity_id?: number | null
          student_id?: string
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_plan_trainings: {
        Row: {
          day_of_week: number
          group_plan_id: string
          id: string
          sort_order: number
          training_id: string
          week_number: number
        }
        Insert: {
          day_of_week: number
          group_plan_id: string
          id?: string
          sort_order?: number
          training_id: string
          week_number: number
        }
        Update: {
          day_of_week?: number
          group_plan_id?: string
          id?: string
          sort_order?: number
          training_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_plan_trainings_group_plan_id_fkey"
            columns: ["group_plan_id"]
            isOneToOne: false
            referencedRelation: "group_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_plan_trainings_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      group_plans: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          notes: string | null
          released_through_week: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          notes?: string | null
          released_through_week?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          notes?: string | null
          released_through_week?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          frequency: string
          goal: string
          id: string
          is_active: boolean
          name: string
          plan_type: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency: string
          goal: string
          id?: string
          is_active?: boolean
          name: string
          plan_type?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          goal?: string
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string | null
          full_name: string | null
          group_id: string | null
          has_set_password: boolean
          id: string
          level: Database["public"]["Enums"]["user_level"] | null
          role: string | null
          strava_athlete_id: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name?: string | null
          group_id?: string | null
          has_set_password?: boolean
          id: string
          level?: Database["public"]["Enums"]["user_level"] | null
          role?: string | null
          strava_athlete_id?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name?: string | null
          group_id?: string | null
          has_set_password?: boolean
          id?: string
          level?: Database["public"]["Enums"]["user_level"] | null
          role?: string | null
          strava_athlete_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          achieved_at: string
          checkin_id: string | null
          created_at: string | null
          distance_category: Database["public"]["Enums"]["distance_category"]
          id: string
          strava_activity_id: number | null
          student_id: string
          time_seconds: number
        }
        Insert: {
          achieved_at: string
          checkin_id?: string | null
          created_at?: string | null
          distance_category: Database["public"]["Enums"]["distance_category"]
          id?: string
          strava_activity_id?: number | null
          student_id: string
          time_seconds: number
        }
        Update: {
          achieved_at?: string
          checkin_id?: string | null
          created_at?: string | null
          distance_category?: Database["public"]["Enums"]["distance_category"]
          id?: string
          strava_activity_id?: number | null
          student_id?: string
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "records_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_activities: {
        Row: {
          created_at: string | null
          distance_m: number
          duration_seconds: number
          id: string
          name: string
          pace_seconds_per_km: number | null
          raw: Json | null
          start_date: string
          strava_id: number | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          distance_m: number
          duration_seconds: number
          id?: string
          name: string
          pace_seconds_per_km?: number | null
          raw?: Json | null
          start_date: string
          strava_id?: number | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          distance_m?: number
          duration_seconds?: number
          id?: string
          name?: string
          pace_seconds_per_km?: number | null
          raw?: Json | null
          start_date?: string
          strava_id?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_connections: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          refresh_token: string
          scope: string | null
          strava_athlete_id: number
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          refresh_token: string
          scope?: string | null
          strava_athlete_id: number
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          distance_m: number | null
          duration_minutes: number | null
          id: string
          sets: number | null
          tag_id: string | null
          target_pace_seconds_per_km: number | null
          title: string
          type: Database["public"]["Enums"]["training_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          distance_m?: number | null
          duration_minutes?: number | null
          id?: string
          sets?: number | null
          tag_id?: string | null
          target_pace_seconds_per_km?: number | null
          title: string
          type: Database["public"]["Enums"]["training_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          distance_m?: number | null
          duration_minutes?: number | null
          id?: string
          sets?: number | null
          tag_id?: string | null
          target_pace_seconds_per_km?: number | null
          title?: string
          type?: Database["public"]["Enums"]["training_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plan_trainings: {
        Row: {
          day_of_week: number
          id: string
          plan_id: string
          sort_order: number | null
          training_id: string
        }
        Insert: {
          day_of_week: number
          id?: string
          plan_id: string
          sort_order?: number | null
          training_id: string
        }
        Update: {
          day_of_week?: number
          id?: string
          plan_id?: string
          sort_order?: number | null
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plan_trainings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plan_trainings_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          student_id: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          student_id: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          student_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      distance_category: "1km" | "5km" | "10km" | "21km" | "42km"
      training_type: "corrida" | "hiit" | "recovery" | "forca" | "mobilidade"
      user_level: "iniciante" | "intermediario" | "avancado"
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
      distance_category: ["1km", "5km", "10km", "21km", "42km"],
      training_type: ["corrida", "hiit", "recovery", "forca", "mobilidade"],
      user_level: ["iniciante", "intermediario", "avancado"],
    },
  },
} as const
