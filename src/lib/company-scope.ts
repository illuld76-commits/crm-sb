import { supabase } from '@/integrations/supabase/client';

/**
 * Get company peers for a user based on the SuiteDash "Company First" principle.
 * Returns user IDs that share at least one assignment_value with the given user,
 * plus all admin user IDs (the "bridge").
 */
export async function getCompanyPeers(userId: string): Promise<string[]> {
  // 1. Get current user's assignments
  const { data: myAssignments } = await supabase
    .from('user_assignments')
    .select('assignment_type, assignment_value')
    .eq('user_id', userId);

  if (!myAssignments || myAssignments.length === 0) {
    // No assignments — only return admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    return (admins || []).map(a => a.user_id);
  }

  // 2. Find all users sharing at least one assignment value
  const values = myAssignments.map(a => a.assignment_value);
  const { data: peerAssignments } = await supabase
    .from('user_assignments')
    .select('user_id')
    .in('assignment_value', values);

  const peerIds = new Set((peerAssignments || []).map(a => a.user_id));

  // 3. Add all admins
  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');
  (admins || []).forEach(a => peerIds.add(a.user_id));

  // Include self
  peerIds.add(userId);

  return Array.from(peerIds);
}
