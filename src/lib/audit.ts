import { supabase } from '@/integrations/supabase/client';

export async function logAction(params: {
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  user_id: string;
  user_name: string;
  details: string;
  old_value?: string | number | boolean | null;
  new_value?: string | number | boolean | null;
}) {
  try {
    await supabase.from('audit_logs').insert({
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id,
      target_name: params.target_name,
      user_id: params.user_id,
      user_name: params.user_name,
      details: params.details,
      old_value: params.old_value != null ? String(params.old_value) : null,
      new_value: params.new_value != null ? String(params.new_value) : null,
    });
  } catch (error) {
    console.error('Error logging action:', error);
  }
}
