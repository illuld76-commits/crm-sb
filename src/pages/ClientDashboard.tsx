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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronRight, ChevronDown, MessageSquare, ArrowUpDown, FileText, Copy, Link2, Eye, Activity, LayoutGrid, List, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import StatusMarker from '@/components/StatusMarker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';

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
  share_token: string | null;
}

interface PhaseRow {
  id: string;
  patient_id: string;
  phase_name: string;
  phase_order: number;
  share_token: string | null;
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

interface CaseRequestRow {
  id: string;
  patient_name: string;
  status: string;
  request_type: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
  link?: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { expired, expiresAt, role } = useRole();
  const { canAccessPatient, isAdmin: scopeIsAdmin, loading: scopeLoading } = useUserScope();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [caseRequests, setCaseRequests] = useState<CaseRequestRow[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [activeTab, setActiveTab] = useState<'cases' | 'reports' | 'activity'>('cases');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  useEffect(() => { if (!scopeLoading) fetchData(); }, [scopeLoading]);

  const fetchData = async () => {
    const { data: patientData } = await supabase
      .from('patients')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    const scopedPatients = (patientData || []).filter(p => canAccessPatient(p));
    setPatients(scopedPatients);

    // Fetch phases and plans
    if (scopedPatients.length > 0) {
      const patientIds = scopedPatients.map(p => p.id);
      const [{ data: phaseData }, { data: crData }] = await Promise.all([
        supabase.from('phases').select('id, patient_id, phase_name, phase_order, share_token').in('patient_id', patientIds).eq('is_deleted', false).order('phase_order'),
        supabase.from('case_requests').select('id, patient_name, status, request_type, created_at').eq('is_deleted', false).eq('user_id', user?.id || '').order('created_at', { ascending: false }).limit(10),
      ]);
      setPhases(phaseData || []);
      setCaseRequests(crData || []);

      if (phaseData && phaseData.length > 0) {
        const phaseIds = phaseData.map(ph => ph.id);
        const { data: planData } = await supabase
          .from('treatment_plans')
          .select('*')
          .in('phase_id', phaseIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (planData) {
          const planIds = planData.map(p => p.id);
          const { data: remarkCounts } = await supabase.from('plan_remarks').select('plan_id').in('plan_id', planIds);
          const remarkCountMap: Record<string, number> = {};
          remarkCounts?.forEach(r => { remarkCountMap[r.plan_id] = (remarkCountMap[r.plan_id] || 0) + 1; });

          // Filter draft plans for non-admin (Plan Sovereignty)
          const visiblePlanData = scopeIsAdmin ? planData : planData.filter(p => p.status !== 'draft');
          const enrichedPlans: PlanRow[] = visiblePlanData.map(plan => {
            const phase = phaseData.find(ph => ph.id === plan.phase_id);
            const patient = scopedPatients.find(p => p.id === phase?.patient_id);
            return {
              id: plan.id, plan_name: plan.plan_name, status: plan.status, plan_date: plan.plan_date,
              phase_id: plan.phase_id, patient_id: patient?.id || '', patient_name: patient?.patient_name || 'Unknown',
              phase_name: phase?.phase_name || '', remarks_count: remarkCountMap[plan.id] || 0, share_token: plan.share_token,
            };
          });
          setPlans(enrichedPlans);
        }
      }

      // Activity: fetch from communications and notifications
      const [{ data: comms }, { data: notifs }] = await Promise.all([
        supabase.from('communications').select('id, content, created_at, case_id, related_type, related_id').in('case_id', patientIds).order('created_at', { ascending: false }).limit(20),
        supabase.from('notifications').select('id, title, body, link, created_at').eq('user_id', user?.id || '').order('created_at', { ascending: false }).limit(20),
      ]);

      const activities: ActivityItem[] = [];
      (comms || []).forEach(c => {
        const patient = scopedPatients.find(p => p.id === c.case_id);
        activities.push({
          id: c.id, type: 'message', title: `Message on ${patient?.patient_name || 'case'}`,
          detail: (c.content as string)?.substring(0, 80) || '', created_at: c.created_at,
          link: patient ? `/patient/${patient.id}` : undefined,
        });
      });
      (notifs || []).forEach(n => {
        activities.push({
          id: n.id, type: 'notification', title: (n.title || '').replace(/_/g, ' '),
          detail: n.body || '', created_at: n.created_at, link: n.link || undefined,
        });
      });
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivityItems(activities.slice(0, 30));
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyLink = (token: string, type: 'journey' | 'report', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const path = type === 'journey' ? 'journey' : 'report';
    navigator.clipboard.writeText(`${window.location.origin}/${path}/${token}`);
    toast.success(`${type === 'journey' ? 'Journey' : 'Report'} link copied!`);
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
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
        default: return new Date(b.plan_date || '1970').getTime() - new Date(a.plan_date || '1970').getTime();
      }
    });
    return result;
  }, [plans, search, filterStatus, sortBy]);

  const patientCaseData = useMemo(() => {
    return filteredPatients.map(patient => {
      const patientPhases = phases.filter(ph => ph.patient_id === patient.id).sort((a, b) => a.phase_order - b.phase_order);
      const patientPlans = plans.filter(p => p.patient_id === patient.id);
      const publishedCount = patientPlans.filter(p => ['published', 'approved'].includes(p.status)).length;
      const latestStatus = patientPlans.length > 0 ? patientPlans[0].status : 'no plans';
      const totalRemarks = patientPlans.reduce((sum, p) => sum + (p.remarks_count || 0), 0);
      return { ...patient, phases: patientPhases, plans: patientPlans, publishedCount, latestStatus, totalRemarks };
    });
  }, [filteredPatients, phases, plans]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground', published: 'bg-primary/10 text-primary',
      ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      rejected: 'bg-destructive/10 text-destructive', completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'no plans': 'bg-muted text-muted-foreground',
    };
    return map[s] || 'bg-muted text-muted-foreground';
  };

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
    <div className="min-h-screen bg-background">
      <Header title={`${role === 'lab' ? 'Lab' : role === 'clinic' ? 'Clinic' : role === 'doctor' ? 'Doctor' : 'My'} Dashboard`} />

      <main className="p-4 md:p-8 space-y-5">
        {expiresAt && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertDescription className="text-sm">
              Your access expires on <strong>{new Date(expiresAt).toLocaleDateString()}</strong>. Contact your admin to extend.
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('cases')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">My Cases</p>
                <p className="text-lg font-bold">{patients.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('reports')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Published Plans</p>
                <p className="text-lg font-bold">{plans.filter(p => ['published', 'approved'].includes(p.status)).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/submitted-cases')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">My Requests</p>
                <p className="text-lg font-bold">{caseRequests.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('activity')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Activity</p>
                <p className="text-lg font-bold">{activityItems.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border/50 pb-2">
          {[
            { id: 'cases' as const, label: 'My Cases', count: patientCaseData.length },
            { id: 'reports' as const, label: 'Reports', count: filteredPlans.length },
            { id: 'activity' as const, label: 'Activity', count: activityItems.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {tab.label} <span className="text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
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
            {activeTab === 'reports' && (
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
            {activeTab === 'cases' && (
              <div className="flex border border-border rounded-md">
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setViewMode('list')}>
                  <List className="w-4 h-4" />
                </Button>
                <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setViewMode('grid')}>
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader></Card>)}
            </div>
          ) : patientCaseData.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No cases assigned to you yet.</p>
            </Card>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {patientCaseData.map(patient => {
                const isExpanded = expandedPatients.has(patient.id);
                return (
                  <Card key={patient.id} className="hover:shadow-md transition-shadow">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(patient.id)}>
                      <CardContent className="p-4">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                              <div className="flex-1 min-w-0 text-left">
                                <h3 className="font-bold text-sm truncate">{patient.patient_name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {patient.doctor_name && `Dr. ${patient.doctor_name}`}
                                  {patient.clinic_name && ` • ${patient.clinic_name}`}
                                  {patient.patient_age && ` • ${patient.patient_age}y`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={statusColor(patient.latestStatus)} variant="secondary">
                                {patient.latestStatus}
                              </Badge>
                              {patient.publishedCount > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Eye className="w-3 h-3 mr-0.5" />{patient.publishedCount}
                                </Badge>
                              )}
                              {patient.totalRemarks > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                  <MessageSquare className="w-3 h-3 mr-0.5" />{patient.totalRemarks}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="mt-3 space-y-2">
                          {patient.phases.map(phase => {
                            const phasePlans = patient.plans.filter(p => p.phase_id === phase.id);
                            return (
                              <div key={phase.id} className="pl-6 border-l-2 border-border/50 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">{phase.phase_name}</span>
                                  {phase.share_token && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); copyLink(phase.share_token!, 'journey', e); }} title="Copy phase link">
                                      <Link2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                                {phasePlans.length === 0 ? (
                                  <p className="text-xs text-muted-foreground/50 pl-2">No plans</p>
                                ) : phasePlans.map(plan => (
                                  <div key={plan.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/plan/${plan.id}`)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Badge className={statusColor(plan.status)} variant="secondary" style={{ fontSize: '9px', padding: '1px 6px' }}>{plan.status}</Badge>
                                      <span className="text-xs truncate">{plan.plan_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {plan.plan_date && <span className="text-[10px] text-muted-foreground">{format(new Date(plan.plan_date), 'MMM d')}</span>}
                                      {plan.remarks_count > 0 && (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1"><MessageSquare className="w-2.5 h-2.5 mr-0.5" />{plan.remarks_count}</Badge>
                                      )}
                                      {plan.status === 'published' && plan.share_token && (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); copyLink(plan.share_token!, 'report', e); }} title="Copy report link">
                                            <Copy className="w-2.5 h-2.5" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); window.open(`${window.location.origin}/report/${plan.share_token}`, '_blank'); }} title="Open report">
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </Button>
                                        </>
                                      )}
                                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                          <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => navigate(`/patient/${patient.id}`)}>
                            View Full Project <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </CollapsibleContent>
                      </CardContent>
                    </Collapsible>
                  </Card>
                );
              })}

              {/* Case Requests Section */}
              {caseRequests.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Recent Case Requests</h3>
                  <div className="space-y-2">
                    {caseRequests.map(cr => (
                      <Card key={cr.id} className="cursor-pointer hover:shadow-sm" onClick={() => navigate(`/case-submission/${cr.id}`)}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{cr.patient_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{cr.request_type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColor(cr.status)} variant="secondary" style={{ fontSize: '10px' }}>{cr.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(cr.created_at), { addSuffix: true })}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patientCaseData.map(p => (
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
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">{p.phases.length} phase{p.phases.length !== 1 ? 's' : ''}</Badge>
                        <Badge className={statusColor(p.latestStatus)} variant="secondary">{p.latestStatus}</Badge>
                      </div>
                      {p.share_token && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); copyLink(p.share_token!, 'journey', e); }} title="Copy journey link">
                          <Link2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader></Card>)}
            </div>
          ) : filteredPlans.length === 0 ? (
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
                      <StatusMarker planId={plan.id} currentStatus={plan.status} onStatusChange={() => {}} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {plan.plan_date && <p className="text-xs text-muted-foreground">{format(new Date(plan.plan_date), 'MMM d, yyyy')}</p>}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      <span>{plan.remarks_count} remark{plan.remarks_count !== 1 ? 's' : ''}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => {
                      if (plan.share_token) navigate(`/report/${plan.share_token}`);
                      else navigate(`/plan/${plan.id}`);
                    }}>
                      View Report <ChevronRight className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activityItems.length === 0 ? (
              <Card className="p-12 text-center">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No activity yet.</p>
              </Card>
            ) : activityItems.map(item => (
              <Card key={item.id} className={item.link ? 'cursor-pointer hover:shadow-sm' : ''} onClick={() => item.link && navigate(item.link)}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.type === 'message' ? 'bg-blue-500' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{item.title}</p>
                    {item.detail && <p className="text-xs text-muted-foreground truncate">{item.detail}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
