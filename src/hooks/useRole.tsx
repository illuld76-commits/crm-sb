import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'user' | 'lab' | 'clinic' | 'doctor';

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      setExpired(false);
      setExpiresAt(null);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setRole('user');
      } else {
        setRole(data.role as AppRole);
      }

      // Check expiry for non-admin users
      if (data?.role !== 'admin') {
        const { data: assignments } = await supabase
          .from('user_assignments')
          .select('expires_at')
          .eq('user_id', user.id);

        if (assignments && assignments.length > 0) {
          const now = new Date();
          const allExpired = assignments.every(a =>
            a.expires_at && new Date(a.expires_at) < now
          );
          setExpired(allExpired);

          const validExpiries = assignments
            .filter(a => a.expires_at)
            .map(a => a.expires_at!)
            .sort();
          if (validExpiries.length > 0) {
            setExpiresAt(validExpiries[0]);
          }
        }
      }

      setLoading(false);
    };

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isUser: role === 'user',
    isLab: role === 'lab',
    isClinic: role === 'clinic',
    isDoctor: role === 'doctor',
    isClient: role === 'lab' || role === 'clinic' || role === 'doctor' || role === 'user',
    expired,
    expiresAt,
  };
}
