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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          case_id: string
          category: string
          created_at: string
          display_id: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_deleted: boolean | null
          is_downloadable: boolean
          is_viewable: boolean
          original_name: string | null
          related_id: string | null
        }
        Insert: {
          case_id: string
          category?: string
          created_at?: string
          display_id?: string | null
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          is_deleted?: boolean | null
          is_downloadable?: boolean
          is_viewable?: boolean
          original_name?: string | null
          related_id?: string | null
        }
        Update: {
          case_id?: string
          category?: string
          created_at?: string
          display_id?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_deleted?: boolean | null
          is_downloadable?: boolean
          is_viewable?: boolean
          original_name?: string | null
          related_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string
          id: string
          is_archived: boolean
          new_value: string | null
          old_value: string | null
          target_id: string
          target_name: string
          target_type: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string
          id?: string
          is_archived?: boolean
          new_value?: string | null
          old_value?: string | null
          target_id: string
          target_name?: string
          target_type: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string
          id?: string
          is_archived?: boolean
          new_value?: string | null
          old_value?: string | null
          target_id?: string
          target_name?: string
          target_type?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      case_requests: {
        Row: {
          arch_selection: string | null
          assigned_tech_id: string | null
          attachments: Json | null
          clinic_name: string | null
          created_at: string
          display_id: string | null
          doctor_name: string | null
          dynamic_data: Json | null
          expected_due_date: string | null
          history: Json | null
          id: string
          is_deleted: boolean
          is_submitted: boolean
          lab_name: string | null
          notes: string | null
          patient_age: number | null
          patient_id: string | null
          patient_name: string
          patient_sex: string | null
          priority: string | null
          remarks: Json | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
          work_order_type: string | null
        }
        Insert: {
          arch_selection?: string | null
          assigned_tech_id?: string | null
          attachments?: Json | null
          clinic_name?: string | null
          created_at?: string
          display_id?: string | null
          doctor_name?: string | null
          dynamic_data?: Json | null
          expected_due_date?: string | null
          history?: Json | null
          id?: string
          is_deleted?: boolean
          is_submitted?: boolean
          lab_name?: string | null
          notes?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name: string
          patient_sex?: string | null
          priority?: string | null
          remarks?: Json | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id: string
          work_order_type?: string | null
        }
        Update: {
          arch_selection?: string | null
          assigned_tech_id?: string | null
          attachments?: Json | null
          clinic_name?: string | null
          created_at?: string
          display_id?: string | null
          doctor_name?: string | null
          dynamic_data?: Json | null
          expected_due_date?: string | null
          history?: Json | null
          id?: string
          is_deleted?: boolean
          is_submitted?: boolean
          lab_name?: string | null
          notes?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string
          patient_sex?: string | null
          priority?: string | null
          remarks?: Json | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          work_order_type?: string | null
        }
        Relationships: []
      }
      case_sections: {
        Row: {
          caption: string | null
          case_id: string
          created_at: string
          data_json: Json | null
          file_url: string | null
          id: string
          section_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          case_id: string
          created_at?: string
          data_json?: Json | null
          file_url?: string | null
          id?: string
          section_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          case_id?: string
          created_at?: string
          data_json?: Json | null
          file_url?: string | null
          id?: string
          section_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_sections_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_date: string | null
          case_id_label: string | null
          created_at: string
          id: string
          notes: string | null
          patient_name: string
          share_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_date?: string | null
          case_id_label?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_name: string
          share_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_date?: string | null
          case_id_label?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_name?: string
          share_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      communications: {
        Row: {
          attachments: Json | null
          case_id: string
          content: string
          created_at: string
          id: string
          related_id: string | null
          related_type: string | null
          sender_id: string
          type: string
        }
        Insert: {
          attachments?: Json | null
          case_id: string
          content: string
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          sender_id: string
          type?: string
        }
        Update: {
          attachments?: Json | null
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          entity_id: string | null
          error_message: string | null
          id: string
          recipient_email: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_name: string | null
          trigger_event: string | null
        }
        Insert: {
          entity_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_name?: string | null
          trigger_event?: string | null
        }
        Update: {
          entity_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_name?: string | null
          trigger_event?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          trigger_event: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          trigger_event: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          trigger_event?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          assigned_user_id: string | null
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          invoice_id: string | null
          is_billable: boolean
          is_deleted: boolean
          notes: string | null
          patient_id: string | null
          updated_at: string
          user_id: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          assigned_user_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          invoice_id?: string | null
          is_billable?: boolean
          is_deleted?: boolean
          notes?: string | null
          patient_id?: string | null
          updated_at?: string
          user_id: string
          vendor_name?: string
        }
        Update: {
          amount?: number
          assigned_user_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          invoice_id?: string | null
          is_billable?: boolean
          is_deleted?: boolean
          notes?: string | null
          patient_id?: string | null
          updated_at?: string
          user_id?: string
          vendor_name?: string
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
          currency: string | null
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
          secondary_user_ids: string[] | null
          status: string
          tax_data: Json | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd?: number
          balance_due?: number | null
          case_request_id?: string | null
          client_details?: Json | null
          created_at?: string
          currency?: string | null
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
          secondary_user_ids?: string[] | null
          status?: string
          tax_data?: Json | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          balance_due?: number | null
          case_request_id?: string | null
          client_details?: Json | null
          created_at?: string
          currency?: string | null
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
          secondary_user_ids?: string[] | null
          status?: string
          tax_data?: Json | null
          type?: string
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
          is_email_enabled: boolean
          placeholders: Json | null
          title_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          event_type: string
          id?: string
          is_email_enabled?: boolean
          placeholders?: Json | null
          title_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          event_type?: string
          id?: string
          is_email_enabled?: boolean
          placeholders?: Json | null
          title_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          archived_at: string | null
          chief_complaint: string | null
          clinic_name: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          display_id: string | null
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
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          chief_complaint?: string | null
          clinic_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          display_id?: string | null
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
          user_id: string
        }
        Update: {
          archived_at?: string | null
          chief_complaint?: string | null
          clinic_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          display_id?: string | null
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
          user_id?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          display_id: string | null
          id: string
          is_deleted: boolean | null
          patient_id: string
          phase_name: string
          phase_order: number
          share_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_id?: string | null
          id?: string
          is_deleted?: boolean | null
          patient_id: string
          phase_name?: string
          phase_order?: number
          share_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_id?: string | null
          id?: string
          is_deleted?: boolean | null
          patient_id?: string
          phase_name?: string
          phase_order?: number
          share_token?: string | null
          status?: string
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
          created_at: string
          id: string
          is_pinned: boolean | null
          parent_remark_id: string | null
          plan_id: string
          read_by: Json | null
          remark_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          parent_remark_id?: string | null
          plan_id: string
          read_by?: Json | null
          remark_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          parent_remark_id?: string | null
          plan_id?: string
          read_by?: Json | null
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
          category: string
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          fee_usd: number
          fields: Json | null
          id: string
          name: string
          tax_rate: number | null
          type: string
          unit: string | null
          unit_price: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          fee_usd?: number
          fields?: Json | null
          id?: string
          name: string
          tax_rate?: number | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          fee_usd?: number
          fields?: Json | null
          id?: string
          name?: string
          tax_rate?: number | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          clinic_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          notification_preferences: Json | null
          password_hint: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          clinic_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          notification_preferences?: Json | null
          password_hint?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          clinic_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          notification_preferences?: Json | null
          password_hint?: string | null
          updated_at?: string
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
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
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
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          is_deleted: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          is_deleted?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          is_deleted?: boolean | null
          user_id?: string
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
          status: string
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
          status?: string
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
          status?: string
          title?: string
        }
        Relationships: []
      }
      treatment_plans: {
        Row: {
          created_at: string
          display_id: string | null
          id: string
          is_deleted: boolean | null
          is_finalized: boolean | null
          notes: string | null
          phase_id: string
          plan_date: string | null
          plan_name: string
          share_token: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_finalized?: boolean | null
          notes?: string | null
          phase_id: string
          plan_date?: string | null
          plan_name?: string
          share_token?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_finalized?: boolean | null
          notes?: string | null
          phase_id?: string
          plan_date?: string | null
          plan_name?: string
          share_token?: string | null
          sort_order?: number
          status?: string
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
          assigned_by: string
          assignment_type: string
          assignment_value: string
          created_at: string
          expires_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          assignment_type: string
          assignment_value: string
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          assignment_type?: string
          assignment_value?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          email_events: Json | null
          id: string
          push_enabled: boolean | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          email_events?: Json | null
          id?: string
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          email_events?: Json | null
          id?: string
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_patient_owner: { Args: { p_patient_id: string }; Returns: string }
      get_phase_patient_owner: { Args: { p_phase_id: string }; Returns: string }
      get_plan_patient_owner: { Args: { p_plan_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_patient_access: {
        Args: { p_patient_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "lab" | "clinic" | "doctor"
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
      app_role: ["admin", "user", "lab", "clinic", "doctor"],
    },
  },
} as const
