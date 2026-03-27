
-- Profiles table (stores display names for auth users)
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  password_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- User assignments table
CREATE TABLE public.user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assignment_type text NOT NULL,
  assignment_value text NOT NULL,
  assigned_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own assignments" ON public.user_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage assignments" ON public.user_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Settings entities (CRM contacts)
CREATE TABLE public.settings_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL,
  entity_type text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  gst_number text,
  city text,
  state text,
  country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read entities" ON public.settings_entities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage entities" ON public.settings_entities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Patients table
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  patient_id_label text,
  doctor_name text,
  clinic_name text,
  lab_name text,
  company_name text,
  country text,
  contact_email text,
  contact_phone text,
  patient_age integer,
  patient_sex text,
  user_id uuid REFERENCES auth.users(id),
  primary_user_id uuid,
  secondary_user_id uuid,
  share_token text DEFAULT gen_random_uuid()::text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update patients" ON public.patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete patients" ON public.patients FOR DELETE TO authenticated USING (true);

-- Phases table
CREATE TABLE public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  phase_name text NOT NULL,
  phase_order integer NOT NULL DEFAULT 0,
  status text DEFAULT 'active',
  share_token text DEFAULT gen_random_uuid()::text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read phases" ON public.phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert phases" ON public.phases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update phases" ON public.phases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete phases" ON public.phases FOR DELETE TO authenticated USING (true);

-- Treatment plans table
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES public.phases(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL,
  status text DEFAULT 'draft',
  plan_date date,
  notes text,
  share_token text DEFAULT gen_random_uuid()::text,
  sort_order integer NOT NULL DEFAULT 0,
  is_finalized boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  case_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read plans" ON public.treatment_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert plans" ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update plans" ON public.treatment_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete plans" ON public.treatment_plans FOR DELETE TO authenticated USING (true);

-- Plan sections table
CREATE TABLE public.plan_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE CASCADE NOT NULL,
  section_type text NOT NULL,
  data_json jsonb,
  file_url text,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read sections" ON public.plan_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sections" ON public.plan_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sections" ON public.plan_sections FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete sections" ON public.plan_sections FOR DELETE TO authenticated USING (true);

-- Plan remarks table
CREATE TABLE public.plan_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  remark_text text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_remarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read remarks" ON public.plan_remarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert remarks" ON public.plan_remarks FOR INSERT TO authenticated WITH CHECK (true);

-- Case requests table
CREATE TABLE public.case_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  patient_age integer,
  patient_sex text,
  request_type text NOT NULL DEFAULT '',
  work_order_type text,
  notes text DEFAULT '',
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  patient_id uuid,
  clinic_name text DEFAULT '',
  doctor_name text DEFAULT '',
  lab_name text DEFAULT '',
  dynamic_data jsonb,
  remarks jsonb DEFAULT '[]'::jsonb,
  history jsonb DEFAULT '[]'::jsonb,
  is_submitted boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  display_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.case_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own case requests" ON public.case_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert case requests" ON public.case_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update case requests" ON public.case_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete case requests" ON public.case_requests FOR DELETE TO authenticated USING (true);

-- Communications table
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  content text DEFAULT '',
  message text,
  sender_name text,
  type text DEFAULT 'external',
  related_type text,
  related_id text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read communications" ON public.communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert communications" ON public.communications FOR INSERT TO authenticated WITH CHECK (true);

-- Remark reactions table
CREATE TABLE public.remark_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remark_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.remark_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reactions" ON public.remark_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert reactions" ON public.remark_reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete own reactions" ON public.remark_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  patient_id uuid,
  patient_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  amount_usd numeric NOT NULL DEFAULT 0,
  currency_local text DEFAULT 'INR',
  exchange_rate numeric DEFAULT 1,
  type text DEFAULT 'standard',
  display_id text,
  invoice_number text,
  due_date date,
  items jsonb DEFAULT '[]'::jsonb,
  merchant_details jsonb DEFAULT '{}'::jsonb,
  client_details jsonb DEFAULT '{}'::jsonb,
  receipt_url text,
  primary_user_id uuid,
  secondary_user_ids jsonb,
  discount_data jsonb,
  tax_data jsonb,
  presets_applied jsonb,
  gst_number text,
  hsn_code text,
  place_of_supply text,
  case_request_id uuid,
  balance_due numeric DEFAULT 0,
  is_locked boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (true);

-- Receipts table
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  reference_number text,
  notes text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read receipts" ON public.receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert receipts" ON public.receipts FOR INSERT TO authenticated WITH CHECK (true);

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  vendor_name text DEFAULT '',
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'INR',
  category text DEFAULT 'general',
  is_billable boolean DEFAULT false,
  notes text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  link text DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Notification templates table
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  title_template text NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read templates" ON public.notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.notification_templates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read email templates" ON public.email_templates FOR SELECT TO authenticated USING (true);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_name text DEFAULT '',
  user_id text NOT NULL,
  user_name text DEFAULT '',
  details text DEFAULT '',
  old_value text,
  new_value text,
  is_archived boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  file_url text NOT NULL,
  file_type text DEFAULT '',
  file_size integer,
  category text DEFAULT 'Document',
  original_name text,
  is_viewable boolean DEFAULT true,
  is_downloadable boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  display_id text,
  related_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update assets" ON public.assets FOR UPDATE TO authenticated USING (true);

-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid,
  due_date date,
  status text DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Presets table
CREATE TABLE public.presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fee_usd numeric DEFAULT 0,
  type text DEFAULT 'fee',
  category text DEFAULT 'fee',
  description text,
  unit_price numeric,
  unit text,
  discount_type text,
  discount_value numeric,
  tax_rate numeric,
  fields jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read presets" ON public.presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage presets" ON public.presets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create storage bucket for case files
INSERT INTO storage.buckets (id, name, public) VALUES ('case-files', 'case-files', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-files');
CREATE POLICY "Anyone can view case files" ON storage.objects FOR SELECT USING (bucket_id = 'case-files');
CREATE POLICY "Authenticated users can delete own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-files');

-- Create profile on user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.communications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
