import { supabase } from '@/integrations/supabase/client';

export interface UserAssignment {
  id: string;
  user_id: string;
  assignment_type: string;
  assignment_value: string;
  expires_at?: string | null;
}

export async function getUserAssignments(userId: string): Promise<UserAssignment[]> {
  const { data, error } = await supabase
    .from('user_assignments')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.error('Error fetching assignments:', error); return []; }
  return data || [];
}

export function checkAccess(patient: {
  id: string;
  clinic_name?: string | null;
  doctor_name?: string | null;
  lab_name?: string | null;
  company_name?: string | null;
  primary_user_id?: string | null;
  secondary_user_id?: string | null;
  user_id?: string;
}, assignments: UserAssignment[], currentUserId?: string): boolean {
  if (currentUserId && patient.user_id === currentUserId) return true;
  if (currentUserId && (patient.primary_user_id === currentUserId || patient.secondary_user_id === currentUserId)) return true;
  if (assignments.length === 0) return false;

  return assignments.some(rule => {
    if (rule.expires_at && new Date(rule.expires_at) < new Date()) return false;
    
    switch (rule.assignment_type) {
      case 'patient': return patient.id === rule.assignment_value;
      case 'clinic': return patient.clinic_name === rule.assignment_value;
      case 'doctor': return patient.doctor_name === rule.assignment_value;
      case 'lab': return patient.lab_name === rule.assignment_value;
      case 'company': return patient.company_name === rule.assignment_value;
      default: return false;
    }
  });
}
