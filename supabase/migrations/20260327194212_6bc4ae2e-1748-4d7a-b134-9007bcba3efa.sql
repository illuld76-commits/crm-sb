ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS patient_id uuid;
ALTER TABLE public.case_requests ADD COLUMN IF NOT EXISTS converted_at timestamptz;
CREATE POLICY "Authenticated can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);