
ALTER TABLE public.case_requests ADD COLUMN IF NOT EXISTS request_name text DEFAULT '';
ALTER TABLE public.case_requests ADD COLUMN IF NOT EXISTS request_items jsonb DEFAULT '[]'::jsonb;
