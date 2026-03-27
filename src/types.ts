export interface Patient {
  id: string;
  patient_name: string;
  patient_id_label: string | null;
  doctor_name: string | null;
  clinic_name: string | null;
  lab_name: string | null;
  company_name: string | null;
  country: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  primary_user_id?: string | null;
  secondary_user_id?: string | null;
  share_token?: string;
  archived_at?: string | null;
}

export interface Phase {
  id: string;
  patient_id: string;
  phase_name: string;
  phase_order: number;
  share_token?: string | null;
  is_deleted?: boolean;
}

export interface TreatmentPlan {
  id: string;
  phase_id: string;
  plan_name: string;
  status: string;
  plan_date: string | null;
  notes: string | null;
  share_token?: string | null;
  created_at: string;
  sort_order: number;
  is_finalized?: boolean;
  is_deleted?: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  user_id: string;
  user_name: string;
  details: string;
  created_at: string;
  old_value?: string | null;
  new_value?: string | null;
  is_archived?: boolean;
}

export interface FileAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Remark {
  id: string;
  plan_id: string;
  remark_text: string;
  created_at: string;
  user_id: string;
  user_name?: string;
  display_name?: string;
  attachments?: FileAttachment[];
}

export interface CaseRequest {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  request_type: string;
  request_name?: string;
  request_items?: { request_type: string; qty: number; rate: number; preset_id?: string }[];
  work_order_type?: string;
  notes: string;
  attachments: FileAttachment[];
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'on_hold' | 'completed' | 'discarded';
  user_id: string;
  patient_id?: string;
  created_at: string;
  is_submitted: boolean;
  clinic_name: string;
  doctor_name: string;
  lab_name: string;
  dynamic_data?: Record<string, unknown>;
  remarks?: { id: string; user_id: string; user_name: string; remark_text: string; created_at: string; attachments?: FileAttachment[] }[];
  history?: { id: string; action: string; user_name: string; created_at: string }[];
  is_deleted?: boolean;
}

export interface Invoice {
  id: string;
  phase_id: string;
  user_id: string;
  patient_id: string;
  patient_name: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  amount_usd: number;
  created_at: string;
  currency_local: string;
  exchange_rate: number;
  type: string;
  display_id?: string;
  invoice_number?: string;
  due_date?: string;
  items?: { description: string; hsn?: string; qty: number; rate: number; disc_pct?: number; gst_pct?: number; amount: number }[];
  merchant_details: {
    name: string;
    email: string;
    address?: string;
    bank_details?: string;
  };
  client_details: {
    name: string;
    email: string;
    address?: string;
  };
  receipt_url?: string;
  primary_user_id?: string;
  secondary_user_ids?: string[];
  discount_data?: Record<string, unknown>;
  tax_data?: Record<string, unknown>;
  presets_applied?: Record<string, unknown>[];
  gst_number?: string;
  hsn_code?: string;
  place_of_supply?: string;
  case_request_id?: string;
  balance_due?: number;
  is_deleted?: boolean;
}

export interface Receipt {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  receipt_url?: string;
  created_at: string;
}

export interface Preset {
  id: string;
  name: string;
  fee_usd: number;
  type: string;
  category: string;
  description?: string;
  unit_price?: number;
  unit?: string;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  fields?: { id: string; label: string; type: string; options?: string[]; required: boolean }[];
}

export interface Task {
  id: string;
  patient_id: string;
  title: string;
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  created_by: string;
}

export interface PlanWithContext extends TreatmentPlan {
  patient_name: string;
  patient_id: string;
  phase_name: string;
  remarks_count?: number;
  last_remark?: string;
}
