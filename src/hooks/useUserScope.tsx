import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { checkAccess, getUserAssignments, UserAssignment } from '@/lib/access-control';

export function useUserScope() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!user || isAdmin) {
      setAssignments([]);
      setLoading(false);
      return;
    }
    getUserAssignments(user.id).then(a => {
      setAssignments(a);
      setLoading(false);
    });
  }, [user, isAdmin, roleLoading]);

  // Returns null for admin (no filtering), or string[] for scoped users
  const allowedClinics: string[] | null = isAdmin ? null :
    assignments.filter(a => a.assignment_type === 'clinic' && (!a.expires_at || new Date(a.expires_at) >= new Date())).map(a => a.assignment_value);

  const allowedDoctors: string[] | null = isAdmin ? null :
    assignments.filter(a => a.assignment_type === 'doctor' && (!a.expires_at || new Date(a.expires_at) >= new Date())).map(a => a.assignment_value);

  const allowedLabs: string[] | null = isAdmin ? null :
    assignments.filter(a => a.assignment_type === 'lab' && (!a.expires_at || new Date(a.expires_at) >= new Date())).map(a => a.assignment_value);

  const allowedCompanies: string[] | null = isAdmin ? null :
    assignments.filter(a => a.assignment_type === 'company' && (!a.expires_at || new Date(a.expires_at) >= new Date())).map(a => a.assignment_value);

  const allowedPatientIds: string[] | null = isAdmin ? null :
    assignments.filter(a => a.assignment_type === 'patient' && (!a.expires_at || new Date(a.expires_at) >= new Date())).map(a => a.assignment_value);

  const filterEntities = useCallback((entities: { entity_name: string; entity_type: string }[], type: string): { entity_name: string; entity_type: string }[] => {
    if (isAdmin) return entities.filter(e => e.entity_type === type);
    let allowed: string[] | null = null;
    switch (type) {
      case 'clinic': allowed = allowedClinics; break;
      case 'doctor': allowed = allowedDoctors; break;
      case 'lab': allowed = allowedLabs; break;
      case 'company': allowed = allowedCompanies; break;
    }
    if (!allowed || allowed.length === 0) return [];
    // Return assignment values, using matching settings_entities where available,
    // but also including assignment values not in settings_entities
    const existingNames = new Set(entities.filter(e => e.entity_type === type).map(e => e.entity_name));
    const result: { entity_name: string; entity_type: string }[] = [];
    for (const name of allowed) {
      if (existingNames.has(name)) {
        result.push(entities.find(e => e.entity_type === type && e.entity_name === name)!);
      } else {
        result.push({ entity_name: name, entity_type: type });
      }
    }
    return result;
  }, [isAdmin, assignments]);

  const canAccessPatient = useCallback((patient: {
    id: string; clinic_name?: string | null; doctor_name?: string | null;
    lab_name?: string | null; company_name?: string | null;
    primary_user_id?: string | null; secondary_user_id?: string | null; user_id?: string;
  }): boolean => {
    if (isAdmin) return true;
    return checkAccess(patient, assignments, user?.id);
  }, [isAdmin, assignments, user]);

  return {
    allowedClinics,
    allowedDoctors,
    allowedLabs,
    allowedCompanies,
    allowedPatientIds,
    assignments,
    filterEntities,
    canAccessPatient,
    loading: loading || roleLoading,
    isAdmin,
  };
}
