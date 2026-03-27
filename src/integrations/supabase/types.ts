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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          case_id: string | null
          category: string | null
          created_at: string
          display_id: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_deleted: boolean | null
          is_downloadable: boolean | null
          is_viewable: boolean | null
          original_name: string | null
          related_id: string | null
        }
        Insert: {
          case_id?: string | null
          category?: string | null
          created_at?: string
          display_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_deleted?: boolean | null
          is_downloadable?: boolean | null
          is_viewable?: boolean | null
          original_name?: string | null
          related_id?: string | null
        }
        Update: {
          case_id?: string | null
          category?: string | null
          created_at?: string
          display_id?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_deleted?: boolean | null
          is_downloadable?: boolean | null
          is_viewable?: boolean | null
          original_name?: string | null
          related_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          is_archived: boolean | null
          new_value: string | null
          old_value: string | null
          target_id: string
          target_name: string | null
          target_type: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          is_archived?: boolean | null
          new_value?: string | null
          old_value?: string | null
          target_id: string
          target_name?: string | null
          target_type: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          is_archived?: boolean | null
          new_value?: string | null
          old_value?: string | null
          target_id?: string
          target_name?: string | null
          target_type?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      case_requests: {
        Row: {
          attachments: Json | null
          clinic_name: string | null
          converted_at: string | null
          created_at: string
          display_id: string | null
          doctor_name: string | null
          dynamic_data: Json | null
          history: Json | null
          id: string
          is_deleted: boolean | null
          is_submitted: boolean | null
          lab_name: string | null
          notes: string | null
          patient_age: number | null
          patient_id: string | null
          patient_name: string
          patient_sex: string | null
          remarks: Json | null
          request_items: Json | null
          request_name: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
          work_order_type: string | null
        }
        Insert: {
          attachments?: Json | null
          clinic_name?: string | null
          converted_at?: string | null
          created_at?: string
          display_id?: string | null
          doctor_name?: string | null
          dynamic_data?: Json | null
          history?: Json | null
          id?: string
          is_deleted?: boolean | null
          is_submitted?: boolean | null
          lab_name?: string | null
          notes?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name: string
          patient_sex?: string | null
          remarks?: Json | null
          request_items?: Json | null
          request_name?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id: string
          work_order_type?: string | null
        }
        Update: {
          attachments?: Json | null
          clinic_name?: string | null
          converted_at?: string | null
          created_at?: string
          display_id?: string | null
          doctor_name?: string | null
          dynamic_data?: Json | null
          history?: Json | null
          id?: string
          is_deleted?: boolean | null
          is_submitted?: boolean | null
          lab_name?: string | null
          notes?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string
          patient_sex?: string | null
          remarks?: Json | null
          request_items?: Json | null
          request_name?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          work_order_type?: string | null
        }
        Relationships: []
      }
      communications: {
        Row: {
          attachments: Json | null
          case_id: string
          content: string | null
          created_at: string
          id: string
          message: string | null
          related_id: string | null
          related_type: string | null
          sender_id: string
          sender_name: string | null
          type: string | null
        }
        Insert: {
          attachments?: Json | null
          case_id: string
          content?: string | null
          created_at?: string
          id?: string
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          sender_id: string
          sender_name?: string | null
          type?: string | null
        }
        Update: {
          attachments?: Json | null
          case_id?: string
          content?: string | null
          created_at?: string
          id?: string
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          sender_id?: string
          sender_name?: string | null
          type?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string | null
          body_template: string
          created_at: string
          event_type: string
          id: string
          is_active: boolean | null
          name: string | null
          subject: string | null
          subject_template: string
          trigger_event: string | null
        }
        Insert: {
          body?: string | null
          body_template: string
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          subject?: string | null
          subject_template: string
          trigger_event?: string | null
        }
        Update: {
          body?: string | null
          body_template?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          subject?: string | null
          subject_template?: string
          trigger_event?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          invoice_id: string | null
          is_billable: boolean | null
          is_deleted: boolean | null
          notes: string | null
          patient_id: string | null
          user_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_billable?: boolean | null
          is_deleted?: boolean | null
          notes?: string | null
          patient_id?: string | null
          user_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_billable?: boolean | null
          is_deleted?: boolean | null
          notes?: string | null
          patient_id?: string | null
          user_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_usd: number
          balance_due: number | null
          case_request_id: string | null
          client_details: Json | null
          created_at: string
          currency_local: string | null
          discount_data: Json | null
          display_id: string | null
          due_date: string | null
          exchange_rate: number | null
          gst_number: string | null
          hsn_code: string | null
          id: string
          invoice_number: string | null
          is_deleted: boolean | null
          is_locked: boolean | null
          items: Json | null
          merchant_details: Json | null
          patient_id: string | null
          patient_name: string
          phase_id: string | null
          place_of_supply: string | null
          presets_applied: Json | null
          primary_user_id: string | null
          receipt_url: string | null
          secondary_user_ids: Json | null
          status: string
          tax_data: Json | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd?: number
          balance_due?: number | null
          case_request_id?: string | null
          client_details?: Json | null
          created_at?: string
          currency_local?: string | null
          discount_data?: Json | null
          display_id?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          gst_number?: string | null
          hsn_code?: string | null
          id?: string
          invoice_number?: string | null
          is_deleted?: boolean | null
          is_locked?: boolean | null
          items?: Json | null
          merchant_details?: Json | null
          patient_id?: string | null
          patient_name: string
          phase_id?: string | null
          place_of_supply?: string | null
          presets_applied?: Json | null
          primary_user_id?: string | null
          receipt_url?: string | null
          secondary_user_ids?: Json | null
          status?: string
          tax_data?: Json | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          balance_due?: number | null
          case_request_id?: string | null
          client_details?: Json | null
          created_at?: string
          currency_local?: string | null
          discount_data?: Json | null
          display_id?: string | null
          due_date?: string | null
          exchange_rate?: number | null
          gst_number?: string | null
          hsn_code?: string | null
          id?: string
          invoice_number?: string | null
          is_deleted?: boolean | null
          is_locked?: boolean | null
          items?: Json | null
          merchant_details?: Json | null
          patient_id?: string | null
          patient_name?: string
          phase_id?: string | null
          place_of_supply?: string | null
          presets_applied?: Json | null
          primary_user_id?: string | null
          receipt_url?: string | null
          secondary_user_ids?: Json | null
          status?: string
          tax_data?: Json | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body_template: string
          created_at: string
          event_type: string
          id: string
          is_email_enabled: boolean | null
          title_template: string
        }
        Insert: {
          body_template: string
          created_at?: string
          event_type: string
          id?: string
          is_email_enabled?: boolean | null
          title_template: string
        }
        Update: {
          body_template?: string
          created_at?: string
          event_type?: string
          id?: string
          is_email_enabled?: boolean | null
          title_template?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          archived_at: string | null
          clinic_name: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          doctor_name: string | null
          id: string
          lab_name: string | null
          patient_age: number | null
          patient_id_label: string | null
          patient_name: string
          patient_sex: string | null
          primary_user_id: string | null
          secondary_user_id: string | null
          share_token: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          clinic_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          doctor_name?: string | null
          id?: string
          lab_name?: string | null
          patient_age?: number | null
          patient_id_label?: string | null
          patient_name: string
          patient_sex?: string | null
          primary_user_id?: string | null
          secondary_user_id?: string | null
          share_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          clinic_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          doctor_name?: string | null
          id?: string
          lab_name?: string | null
          patient_age?: number | null
          patient_id_label?: string | null
          patient_name?: string
          patient_sex?: string | null
          primary_user_id?: string | null
          secondary_user_id?: string | null
          share_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean | null
          patient_id: string
          phase_name: string
          phase_order: number
          share_token: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          patient_id: string
          phase_name: string
          phase_order?: number
          share_token?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          patient_id?: string
          phase_name?: string
          phase_order?: number
          share_token?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_remarks: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          plan_id: string
          remark_text: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          plan_id: string
          remark_text: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          plan_id?: string
          remark_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_remarks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sections: {
        Row: {
          caption: string | null
          created_at: string
          data_json: Json | null
          file_url: string | null
          id: string
          plan_id: string
          section_type: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          data_json?: Json | null
          file_url?: string | null
          id?: string
          plan_id: string
          section_type: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          data_json?: Json | null
          file_url?: string | null
          id?: string
          plan_id?: string
          section_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_sections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      presets: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          fee_usd: number | null
          fields: Json | null
          id: string
          name: string
          tax_rate: number | null
          type: string | null
          unit: string | null
          unit_price: number | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          fee_usd?: number | null
          fields?: Json | null
          id?: string
          name: string
          tax_rate?: number | null
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          fee_usd?: number | null
          fields?: Json | null
          id?: string
          name?: string
          tax_rate?: number | null
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clinic_name: string | null
          created_at: string
          display_name: string | null
          password_hint: string | null
          user_id: string
        }
        Insert: {
          clinic_name?: string | null
          created_at?: string
          display_name?: string | null
          password_hint?: string | null
          user_id: string
        }
        Update: {
          clinic_name?: string | null
          created_at?: string
          display_name?: string | null
          password_hint?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_url: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      remark_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          remark_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          remark_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          remark_id?: string
          user_id?: string
        }
        Relationships: []
      }
      settings_entities: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          entity_name: string
          entity_type: string
          gst_number: string | null
          id: string
          is_deleted: boolean | null
          notes: string | null
          phone: string | null
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          entity_name: string
          entity_type: string
          gst_number?: string | null
          id?: string
          is_deleted?: boolean | null
          notes?: string | null
          phone?: string | null
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          entity_name?: string
          entity_type?: string
          gst_number?: string | null
          id?: string
          is_deleted?: boolean | null
          notes?: string | null
          phone?: string | null
          state?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          patient_id: string
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id: string
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          case_request_id: string | null
          created_at: string
          id: string
          is_deleted: boolean | null
          is_finalized: boolean | null
          notes: string | null
          phase_id: string
          plan_date: string | null
          plan_name: string
          share_token: string | null
          sort_order: number
          status: string | null
          updated_at: string
        }
        Insert: {
          case_request_id?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_finalized?: boolean | null
          notes?: string | null
          phase_id: string
          plan_date?: string | null
          plan_name: string
          share_token?: string | null
          sort_order?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          case_request_id?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_finalized?: boolean | null
          notes?: string | null
          phase_id?: string
          plan_date?: string | null
          plan_name?: string
          share_token?: string | null
          sort_order?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assignments: {
        Row: {
          assigned_by: string | null
          assignment_type: string
          assignment_value: string
          created_at: string
          expires_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_type: string
          assignment_value: string
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: string
          assignment_value?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
