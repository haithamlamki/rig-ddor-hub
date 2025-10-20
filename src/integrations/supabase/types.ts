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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      extracted_ddor_data: {
        Row: {
          am_hr: number | null
          client: string | null
          created_at: string
          date: string
          force_majeure_hr: number | null
          id: string
          not_received_ddor: string | null
          operation_hr: number | null
          reduce_hr: number | null
          remarks: string | null
          repair_hr: number | null
          rig_move_amount_applied: number | null
          rig_move_hr: number | null
          rig_move_rate_id: string | null
          rig_number: string
          special_hr: number | null
          stacking_hr: number | null
          standby_hr: number | null
          total_amount: number | null
          total_hrs: number | null
          updated_at: string
          zero_hr: number | null
        }
        Insert: {
          am_hr?: number | null
          client?: string | null
          created_at?: string
          date: string
          force_majeure_hr?: number | null
          id?: string
          not_received_ddor?: string | null
          operation_hr?: number | null
          reduce_hr?: number | null
          remarks?: string | null
          repair_hr?: number | null
          rig_move_amount_applied?: number | null
          rig_move_hr?: number | null
          rig_move_rate_id?: string | null
          rig_number: string
          special_hr?: number | null
          stacking_hr?: number | null
          standby_hr?: number | null
          total_amount?: number | null
          total_hrs?: number | null
          updated_at?: string
          zero_hr?: number | null
        }
        Update: {
          am_hr?: number | null
          client?: string | null
          created_at?: string
          date?: string
          force_majeure_hr?: number | null
          id?: string
          not_received_ddor?: string | null
          operation_hr?: number | null
          reduce_hr?: number | null
          remarks?: string | null
          repair_hr?: number | null
          rig_move_amount_applied?: number | null
          rig_move_hr?: number | null
          rig_move_rate_id?: string | null
          rig_number?: string
          special_hr?: number | null
          stacking_hr?: number | null
          standby_hr?: number | null
          total_amount?: number | null
          total_hrs?: number | null
          updated_at?: string
          zero_hr?: number | null
        }
        Relationships: []
      }
      npt_data_quality: {
        Row: {
          created_at: string
          description: string | null
          field_name: string
          id: string
          npt_record_id: string
          quality_issue_type: string
          severity: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_name: string
          id?: string
          npt_record_id: string
          quality_issue_type: string
          severity: string
        }
        Update: {
          created_at?: string
          description?: string | null
          field_name?: string
          id?: string
          npt_record_id?: string
          quality_issue_type?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_npt_record"
            columns: ["npt_record_id"]
            isOneToOne: false
            referencedRelation: "npt_records"
            referencedColumns: ["id"]
          },
        ]
      }
      npt_records: {
        Row: {
          action_party: string | null
          contractual: string | null
          corrective_action: string | null
          created_at: string
          data_quality_issues: Json | null
          data_quality_score: number | null
          date: string
          department_responsibility: string | null
          equipment: string | null
          failure_description: string | null
          failure_investigation_reports: string | null
          future_action: string | null
          hours: number
          id: string
          missing_fields: Json | null
          month: string
          notification_number_n2: string | null
          npt_type: string | null
          rig_number: string
          root_cause: string | null
          system: string | null
          the_part: string | null
          updated_at: string
          year: number
        }
        Insert: {
          action_party?: string | null
          contractual?: string | null
          corrective_action?: string | null
          created_at?: string
          data_quality_issues?: Json | null
          data_quality_score?: number | null
          date: string
          department_responsibility?: string | null
          equipment?: string | null
          failure_description?: string | null
          failure_investigation_reports?: string | null
          future_action?: string | null
          hours: number
          id?: string
          missing_fields?: Json | null
          month: string
          notification_number_n2?: string | null
          npt_type?: string | null
          rig_number: string
          root_cause?: string | null
          system?: string | null
          the_part?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          action_party?: string | null
          contractual?: string | null
          corrective_action?: string | null
          created_at?: string
          data_quality_issues?: Json | null
          data_quality_score?: number | null
          date?: string
          department_responsibility?: string | null
          equipment?: string | null
          failure_description?: string | null
          failure_investigation_reports?: string | null
          future_action?: string | null
          hours?: number
          id?: string
          missing_fields?: Json | null
          month?: string
          notification_number_n2?: string | null
          npt_type?: string | null
          rig_number?: string
          root_cause?: string | null
          system?: string | null
          the_part?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      rig_configs: {
        Row: {
          column_mappings: Json
          created_at: string
          id: string
          rig_number: string
          sheet_name: string
          updated_at: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string
          id?: string
          rig_number: string
          sheet_name?: string
          updated_at?: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string
          id?: string
          rig_number?: string
          sheet_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rig_rates: {
        Row: {
          annual_maintenance_hr_rate: number | null
          created_at: string
          force_majeure_hr_rate: number | null
          fuel_operation_day_rate_usd: number | null
          fuel_reduce_day_rate_usd: number | null
          fuel_repair_day_rate_usd: number | null
          fuel_special_day_rate_usd: number | null
          fuel_zero_day_rate_usd: number | null
          id: string
          obm_operation_day_rate_usd: number | null
          obm_reduce_day_rate_usd: number | null
          obm_repair_day_rate_usd: number | null
          obm_zero_day_rate_usd: number | null
          operation_hr_rate: number | null
          reduce_hr_rate: number | null
          repair_hr_rate: number | null
          rig_move_hr_rate: number | null
          rig_move_times: number | null
          rig_number: string
          special_hr_rate: number | null
          stacking_hr_rate: number | null
          standby_hr_rate: number | null
          updated_at: string
          zero_hr_rate: number | null
        }
        Insert: {
          annual_maintenance_hr_rate?: number | null
          created_at?: string
          force_majeure_hr_rate?: number | null
          fuel_operation_day_rate_usd?: number | null
          fuel_reduce_day_rate_usd?: number | null
          fuel_repair_day_rate_usd?: number | null
          fuel_special_day_rate_usd?: number | null
          fuel_zero_day_rate_usd?: number | null
          id?: string
          obm_operation_day_rate_usd?: number | null
          obm_reduce_day_rate_usd?: number | null
          obm_repair_day_rate_usd?: number | null
          obm_zero_day_rate_usd?: number | null
          operation_hr_rate?: number | null
          reduce_hr_rate?: number | null
          repair_hr_rate?: number | null
          rig_move_hr_rate?: number | null
          rig_move_times?: number | null
          rig_number: string
          special_hr_rate?: number | null
          stacking_hr_rate?: number | null
          standby_hr_rate?: number | null
          updated_at?: string
          zero_hr_rate?: number | null
        }
        Update: {
          annual_maintenance_hr_rate?: number | null
          created_at?: string
          force_majeure_hr_rate?: number | null
          fuel_operation_day_rate_usd?: number | null
          fuel_reduce_day_rate_usd?: number | null
          fuel_repair_day_rate_usd?: number | null
          fuel_special_day_rate_usd?: number | null
          fuel_zero_day_rate_usd?: number | null
          id?: string
          obm_operation_day_rate_usd?: number | null
          obm_reduce_day_rate_usd?: number | null
          obm_repair_day_rate_usd?: number | null
          obm_zero_day_rate_usd?: number | null
          operation_hr_rate?: number | null
          reduce_hr_rate?: number | null
          repair_hr_rate?: number | null
          rig_move_hr_rate?: number | null
          rig_move_times?: number | null
          rig_number?: string
          special_hr_rate?: number | null
          stacking_hr_rate?: number | null
          standby_hr_rate?: number | null
          updated_at?: string
          zero_hr_rate?: number | null
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
