import { useEffect, useState, useMemo, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { checkAccess, getUserAssignments, UserAssignment } from '@/lib/access-control';
import { CaseRequest } from '@/types';

interface PatientMin { id: string; patient_name: string; doctor_name?: string | null; clinic_name?: string | null; lab_name?: string | null; company_name?: string | null; user_id?: string; primary_user_id?: string | null; secondary_user_id?: string | null; archived_at?: string | null; }
interface PhaseMin { id: string; patient_id: string; phase_name: string; }
interface PlanMin { id: string; phase_id: string; plan_name: string; }

export default function Layout() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [patients, setPatients] = useState<PatientMin[]>([]);
  const [phases, setPhases] = useState<PhaseMin[]>([]);
  const [plans, setPlans] = useState<PlanMin[]>([]);
  const [caseRequests, setCaseRequests] = useState<CaseRequest[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [{ data: pData }, { data: phData }, { data: plData }] = await Promise.all([
        supabase.from('patients').select('id, patient_name, doctor_name, clinic_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id, archived_at').is('archived_at', null).order('created_at', { ascending: false }),
        supabase.from('phases').select('id, patient_id, phase_name').order('phase_order'),
        supabase.from('treatment_plans').select('id, phase_id, plan_name').order('sort_order'),
      ]);
      setPatients(pData || []);
      setPhases(phData || []);
      setPlans(plData || []);

      let crQuery = supabase.from('case_requests').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
      if (!isAdmin) {
        crQuery = crQuery.eq('user_id', user.id);
      }
      const { data: crData } = await crQuery;
      setCaseRequests((crData || []) as unknown as CaseRequest[]);

      if (!isAdmin) {
        const a = await getUserAssignments(user.id);
        setAssignments(a);
      }
    };

    fetchData();

    // Realtime subscription for patients, phases, treatment_plans
    const channel = supabase
      .channel('layout-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phases' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treatment_plans' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_requests' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  const filteredPatients = useMemo(() => {
    if (isAdmin) return patients;
    return patients.filter(p => checkAccess(p, assignments, user?.id));
  }, [patients, assignments, isAdmin, user]);

  const filteredPhases = useMemo(() => {
    const ids = new Set(filteredPatients.map(p => p.id));
    return phases.filter(ph => ids.has(ph.patient_id));
  }, [phases, filteredPatients]);

  const filteredPlans = useMemo(() => {
    const ids = new Set(filteredPhases.map(ph => ph.id));
    return plans.filter(pl => ids.has(pl.phase_id));
  }, [plans, filteredPhases]);

  return (
    <div className="flex h-screen relative overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar patients={filteredPatients} phases={filteredPhases} plans={filteredPlans} caseRequests={caseRequests} />
      </div>

      <main className="flex-1 overflow-auto w-full relative pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
