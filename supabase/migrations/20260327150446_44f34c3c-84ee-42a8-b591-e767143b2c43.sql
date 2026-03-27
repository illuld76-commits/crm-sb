
-- Add missing columns to settings_entities
ALTER TABLE public.settings_entities ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Add missing columns to notification_templates
ALTER TABLE public.notification_templates ADD COLUMN IF NOT EXISTS is_email_enabled boolean DEFAULT true;

-- Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_name text;

-- Recreate email_templates with columns the code expects
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS trigger_event text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add missing columns to presets
ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS user_id uuid;
