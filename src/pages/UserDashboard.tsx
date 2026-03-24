import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, LogOut, Users, ChevronRight, MessageSquare, Filter, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SnaponLogo from '@/components/SnaponLogo';
import ThemeToggle from '@/components/ThemeToggle';
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
  remarks_count?: number;
}

export default function UserDashboard() {
  const { user, signOut } = useAuth();
  const { expired, expiresAt } = useRole();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [newRemarkText, setNewRemarkText] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch patients the user has access to
    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .order('patient_name');

    setPatients(patientData || []);

    if (patientData && patientData.length > 0) {
      const patientIds = patientData.map(p => p.id);
      
      // Fetch phases
      const { data: phases } = await supabase
        .from('phases')
        .select('*')
        .in('patient_id', patientIds);

      if (phases && phases.length > 0) {
        const phaseIds = phases.map(ph => ph.id);
        
        // Fetch plans with phase info
        const { data: planData } = await supabase
          .from('treatment_plans')
          .select('*')
          .in('phase_id', phaseIds)
          .in('status', ['published', 'ongoing', 'approved', 'hold', 'rejected'])
          .order('created_at', { ascending: false });

        if (planData) {
          // Fetch remark counts
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
            };
          });

          setPlans(enrichedPlans);
        }
      }
    }

    setLoading(false);
  };

  const addRemark = async (planId: string) => {
    const text = newRemarkText[planId]?.trim();
    if (!text || !user) return;

    const { error } = await supabase.from('plan_remarks').insert({
      plan_id: planId,
      user_id: user.id,
      remark_text: text,
    });

    if (error) {
      toast.error('Failed to add remark');
      return;
    }

    toast.success('Remark added');
    setNewRemarkText(prev => ({ ...prev, [planId]: '' }));
    
    // Update local count
    setPlans(prev => prev.map(p => 
      p.id === planId ? { ...p, remarks_count: (p.remarks_count || 0) + 1 } : p
    ));
  };

  const handleStatusChange = (planId: string, newStatus: string) => {
    setPlans(prev => prev.map(p => 
      p.id === planId ? { ...p, status: newStatus } : p
    ));
  };

  const uniqueDoctors = useMemo(() => 
    [...new Set(patients.map(p => p.doctor_name).filter(Boolean))] as string[]
  , [patients]);

  const filteredPlans = useMemo(() => {
    let result = plans.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || [p.patient_name, p.plan_name, p.phase_name].some(f => f?.toLowerCase().includes(q));
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const patient = patients.find(pt => pt.id === p.patient_id);
      const matchDoctor = filterDoctor === 'all' || patient?.doctor_name === filterDoctor;
      return matchSearch && matchStatus && matchDoctor;
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
  }, [plans, search, filterStatus, filterDoctor, patients, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <SnaponLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-5">
        {expired ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-destructive/50 mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Expired</h2>
            <p className="text-muted-foreground">Your access has expired. Please contact your administrator to renew.</p>
          </Card>
        ) : (
        <>
        {expiresAt && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertDescription className="text-sm">
              Your access expires on <strong>{new Date(expiresAt).toLocaleDateString()}</strong>. Contact your admin to extend.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Assigned Reports</h1>
            <p className="text-muted-foreground text-sm">{filteredPlans.length} report{filteredPlans.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patient, plan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-accent' : ''}>
              <Filter className="w-4 h-4" />
            </Button>
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
          </div>
        </div>

        {/* Filters */}
        {showFilters && uniqueDoctors.length > 0 && (
          <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Select value={filterDoctor} onValueChange={setFilterDoctor}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {uniqueDoctors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterDoctor('all'); setFilterStatus('all'); }}>
              Clear Filters
            </Button>
          </div>
        )}

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
        ) : filteredPlans.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {plans.length === 0 ? 'No reports assigned to you yet.' : 'No reports match your search.'}
            </p>
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
                      onStatusChange={(s) => handleStatusChange(plan.id, s)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {plan.plan_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(plan.plan_date), 'MMM d, yyyy')}
                    </p>
                  )}

                  {/* Remark input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      <span>{plan.remarks_count} remark{plan.remarks_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newRemarkText[plan.id] || ''}
                        onChange={e => setNewRemarkText(prev => ({ ...prev, [plan.id]: e.target.value }))}
                        placeholder="Add remark..."
                        className="h-7 text-xs"
                        onKeyDown={e => e.key === 'Enter' && addRemark(plan.id)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => addRemark(plan.id)}
                        disabled={!newRemarkText[plan.id]?.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      // Navigate to report view
                      supabase.from('treatment_plans').select('share_token').eq('id', plan.id).single()
                        .then(({ data }) => {
                          if (data?.share_token) {
                            navigate(`/report/${data.share_token}`);
                          }
                        });
                    }}
                  >
                    View Report <ChevronRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
