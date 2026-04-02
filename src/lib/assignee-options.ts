import { supabase } from '@/integrations/supabase/client';
import { getCompanyPeers } from '@/lib/company-scope';

export interface AssigneeOption {
  user_id: string;
  display_name: string | null;
  email: string | null;
  assignmentSummary: string;
}

interface AssignmentRow {
  user_id: string;
  assignment_type: string;
  assignment_value: string;
  is_primary: boolean;
}

const summarizeAssignments = (assignments: AssignmentRow[]) => {
  if (assignments.length === 0) return '';

  const labels = assignments.map((assignment) => (
    `${assignment.assignment_type}: ${assignment.assignment_value}${assignment.is_primary ? ' ★' : ''}`
  ));

  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
};

export const formatAssigneeLabel = (profile: Pick<AssigneeOption, 'user_id' | 'display_name' | 'email' | 'assignmentSummary'>) => (
  [profile.display_name || 'Unnamed user', profile.email, profile.assignmentSummary].filter(Boolean).join(' • ') || profile.user_id
);

export async function loadAssignableProfiles(currentUserId: string | null | undefined, isAdmin: boolean): Promise<AssigneeOption[]> {
  const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, email');
  const baseProfiles = profiles || [];

  if (isAdmin) {
    const { data: assignments } = await supabase
      .from('user_assignments')
      .select('user_id, assignment_type, assignment_value, is_primary')
      .order('created_at', { ascending: true });

    const assignmentMap = new Map<string, AssignmentRow[]>();
    (assignments || []).forEach((assignment) => {
      const existing = assignmentMap.get(assignment.user_id) || [];
      existing.push(assignment as AssignmentRow);
      assignmentMap.set(assignment.user_id, existing);
    });

    return baseProfiles
      .map((profile) => ({
        ...profile,
        assignmentSummary: summarizeAssignments(assignmentMap.get(profile.user_id) || []),
      }))
      .sort((a, b) => (a.display_name || a.email || a.user_id).localeCompare(b.display_name || b.email || b.user_id));
  }

  if (!currentUserId) return [];

  const peerIds = await getCompanyPeers(currentUserId);
  return baseProfiles
    .filter((profile) => peerIds.includes(profile.user_id))
    .map((profile) => ({ ...profile, assignmentSummary: '' }))
    .sort((a, b) => (a.display_name || a.email || a.user_id).localeCompare(b.display_name || b.email || b.user_id));
}