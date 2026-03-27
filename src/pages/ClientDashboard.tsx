import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronRight, MessageSquare, Filter, ArrowUpDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import StatusMarker from '@/components/StatusMarker';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PatientRow {
  id: string;
  patient_name: string;
  patient_id_label: string | null;
  doctor_name: string | null;
  clinic_name: string | null;
  lab_name: string | null;
  country: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  created_at: string;
}

interface PlanRow {
  id: string;
  plan_name: string;
  status: string;
  plan_date: string | null;
  phase_id: string;
  patient_id: string;
  patient_name: string;
  phase_name: string;
  remarks_count: number;
  share_token: string | null;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { expired, expiresAt, role } = useRole();
  const { canAccessPatient } = useUserScope();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [viewMode, setViewMode] = useState<'cases' | 'reports'>('cases');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    // RBAC: filter to only patients the user can access
    const scopedPatients = (patientData || []).filter(p => canAccessPatient(p));
    setPatients(scopedPatients);

    if (patientData && patientData.length > 0) {
      const patientIds = patientData.map(p => p.id);
      const { data: phases } = await supabase
        .from('phases')
        .select('*')
        .in('patient_id', patientIds);

      if (phases && phases.length > 0) {
        const phaseIds = phases.map(ph => ph.id);
        const { data: planData } = await supabase
          .from('treatment_plans')
          .select('*')
          .in('phase_id', phaseIds)
          .in('status', ['published', 'ongoing', 'approved', 'hold', 'rejected'])
          .order('created_at', { ascending: false });

        if (planData) {
          const planIds = planData.map(p => p.id);
          const { data: remarkCounts } = await supabase
            .from('plan_remarks')
            .select('plan_id')
            .in('plan_id', planIds);

          const remarkCountMap: Record<string, number> = {};
          remarkCounts?.forEach(r => {
            remarkCountMap[r.plan_id] = (remarkCountMap[r.plan_id] || 0) + 1;
          });

          const enrichedPlans: PlanRow[] = planData.map(plan => {
            const phase = phases.find(ph => ph.id === plan.phase_id);
            const patient = patientData.find(p => p.id === phase?.patient_id);
            return {
              id: plan.id,
              plan_name: plan.plan_name,
              status: plan.status,
              plan_date: plan.plan_date,
              phase_id: plan.phase_id,
              patient_id: patient?.id || '',
              patient_name: patient?.patient_name || 'Unknown',
              phase_name: phase?.phase_name || '',
              remarks_count: remarkCountMap[plan.id] || 0,
              share_token: plan.share_token,
            };
          });

          setPlans(enrichedPlans);
        }
      }
    }
    setLoading(false);
  };

  const filteredPatients = useMemo(() => {
    let result = patients.filter(p => {
      const q = search.toLowerCase();
      return !q || [p.patient_name, p.patient_id_label, p.doctor_name, p.clinic_name, p.lab_name].some(f => f?.toLowerCase().includes(q));
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'az': return a.patient_name.localeCompare(b.patient_name);
        case 'za': return b.patient_name.localeCompare(a.patient_name);
        case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc': default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [patients, search, sortBy]);

  const filteredPlans = useMemo(() => {
    let result = plans.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || [p.patient_name, p.plan_name, p.phase_name].some(f => f?.toLowerCase().includes(q));
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'az': return a.patient_name.localeCompare(b.patient_name);
        case 'za': return b.patient_name.localeCompare(a.patient_name);
        case 'date-asc': return new Date(a.plan_date || '1970').getTime() - new Date(b.plan_date || '1970').getTime();
        case 'date-desc': default: return new Date(b.plan_date || '1970').getTime() - new Date(a.plan_date || '1970').getTime();
      }
    });
    return result;
  }, [plans, search, filterStatus, sortBy]);

  if (expired) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-destructive/50 mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Expired</h2>
          <p className="text-muted-foreground">Your access has expired. Please contact your administrator to renew.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5">
      {expiresAt && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertDescription className="text-sm">
            Your access expires on <strong>{new Date(expiresAt).toLocaleDateString()}</strong>. Contact your admin to extend.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {role === 'lab' ? 'Lab' : role === 'clinic' ? 'Clinic' : role === 'doctor' ? 'Doctor' : 'My'} Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            {viewMode === 'cases' ? `${filteredPatients.length} case${filteredPatients.length !== 1 ? 's' : ''}` : `${filteredPlans.length} report${filteredPlans.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'cases' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cases')}>Cases</Button>
          <Button variant={viewMode === 'reports' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('reports')}>Reports</Button>
        </div>
      </div>

      {/* Search + Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Sort..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'reports' && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="hold">On Hold</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/3 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : viewMode === 'cases' ? (
        filteredPatients.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No cases assigned to you yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map(p => (
              <Card key={p.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/patient/${p.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{p.patient_name}</CardTitle>
                      <CardDescription className="text-xs space-x-2">
                        {p.patient_id_label && <span>{p.patient_id_label}</span>}
                        {p.patient_age && <span>• {p.patient_age}y {p.patient_sex || ''}</span>}
                      </CardDescription>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {p.doctor_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.doctor_name}</span>}
                    {p.clinic_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.clinic_name}</span>}
                    {p.lab_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.lab_name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        filteredPlans.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No reports available.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlans.map(plan => (
              <Card key={plan.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{plan.patient_name}</CardTitle>
                      <CardDescription className="text-xs">
                        {plan.phase_name} • {plan.plan_name}
                      </CardDescription>
                    </div>
                    <StatusMarker
                      planId={plan.id}
                      currentStatus={plan.status}
                      onStatusChange={() => {}}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {plan.plan_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(plan.plan_date), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    <span>{plan.remarks_count} remark{plan.remarks_count !== 1 ? 's' : ''}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      if (plan.share_token) {
                        navigate(`/report/${plan.share_token}`);
                      }
                    }}
                  >
                    View Report <ChevronRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
