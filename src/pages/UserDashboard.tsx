import { useEffect, useState, useMemo } from 'react';
import { SHARE_BASE_URL } from '@/lib/share-utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, LogOut, Users, ChevronRight, ChevronDown, MessageSquare, Filter, ArrowUpDown, Eye, Copy, ExternalLink, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
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

interface PhaseRow {
  id: string;
  patient_id: string;
  phase_name: string;
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
  share_token?: string;
}

interface CaseRequestRow {
  id: string;
  patient_name: string;
  status: string;
  request_type: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  target_name: string;
  target_type: string;
  created_at: string;
  details: string;
}

export default function UserDashboard() {
  const { user, signOut } = useAuth();
  const { expired, expiresAt } = useRole();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [caseRequests, setCaseRequests] = useState<CaseRequestRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [newRemarkText, setNewRemarkText] = useState<Record<string, string>>({});
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'cases' | 'plans' | 'activity'>('cases');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: patientData } = await supabase.from('patients').select('*').is('archived_at', null).order('patient_name');
    setPatients(patientData || []);

    // Case requests
    const { data: caseReqs } = await supabase.from('case_requests').select('id, patient_name, status, request_type, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(50);
    setCaseRequests(caseReqs || []);

    if (patientData && patientData.length > 0) {
      const patientIds = patientData.map(p => p.id);
      const { data: phaseData } = await supabase.from('phases').select('id, patient_id, phase_name').in('patient_id', patientIds);
      setPhases(phaseData || []);

      if (phaseData && phaseData.length > 0) {
        const phaseIds = phaseData.map(ph => ph.id);
        const { data: planData } = await supabase.from('treatment_plans').select('id, plan_name, status, plan_date, phase_id, share_token, created_at').in('phase_id', phaseIds).order('created_at', { ascending: false });

        if (planData) {
          const planIds = planData.map(p => p.id);
          const { data: remarkCounts } = await supabase.from('plan_remarks').select('plan_id').in('plan_id', planIds);
          const remarkCountMap: Record<string, number> = {};
          remarkCounts?.forEach(r => { remarkCountMap[r.plan_id] = (remarkCountMap[r.plan_id] || 0) + 1; });

          const enrichedPlans: PlanRow[] = planData.map(plan => {
            const phase = phaseData.find(ph => ph.id === plan.phase_id);
            const patient = patientData.find(p => p.id === phase?.patient_id);
            return {
              id: plan.id, plan_name: plan.plan_name, status: plan.status, plan_date: plan.plan_date,
              phase_id: plan.phase_id, patient_id: patient?.id || '', patient_name: patient?.patient_name || 'Unknown',
              phase_name: phase?.phase_name || '', remarks_count: remarkCountMap[plan.id] || 0,
              share_token: plan.share_token,
            };
          });
          setPlans(enrichedPlans);
        }
      }
    }

    // Activity logs
    if (user) {
      const { data: logs } = await supabase.from('audit_logs').select('id, action, target_name, target_type, created_at, details')
        .order('created_at', { ascending: false }).limit(20);
      setActivityLogs((logs || []) as ActivityLog[]);
    }

    setLoading(false);
  };

  const addRemark = async (planId: string) => {
    const text = newRemarkText[planId]?.trim();
    if (!text || !user) return;
    const { error } = await supabase.from('plan_remarks').insert({ plan_id: planId, user_id: user.id, remark_text: text });
    if (error) { toast.error('Failed to add remark'); return; }
    toast.success('Remark added');
    setNewRemarkText(prev => ({ ...prev, [planId]: '' }));
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, remarks_count: (p.remarks_count || 0) + 1 } : p));
  };

  const handleStatusChange = (planId: string, newStatus: string) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
  };

  const uniqueDoctors = useMemo(() => [...new Set(patients.map(p => p.doctor_name).filter(Boolean))] as string[], [patients]);

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

  // Group plans by patient for case view
  const patientCaseData = useMemo(() => {
    return patients.map(patient => {
      const patientPhases = phases.filter(ph => ph.patient_id === patient.id);
      const patientPlans = plans.filter(p => p.patient_id === patient.id);
      const publishedCount = patientPlans.filter(p => p.status === 'published').length;
      const latestStatus = patientPlans.length > 0 ? patientPlans[0].status : 'no plans';
      const totalRemarks = patientPlans.reduce((sum, p) => sum + (p.remarks_count || 0), 0);
      return { ...patient, phases: patientPhases, plans: patientPlans, publishedCount, latestStatus, totalRemarks };
    }).filter(p => {
      if (!search) return true;
      return p.patient_name.toLowerCase().includes(search.toLowerCase());
    });
  }, [patients, phases, plans, search]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground', published: 'bg-primary/10 text-primary',
      ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      rejected: 'bg-destructive/10 text-destructive', completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      saved: 'bg-muted text-muted-foreground', 'no plans': 'bg-muted text-muted-foreground',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return map[s] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <SnaponLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-5 pb-20">
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

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-border/50 pb-2">
          {[
            { id: 'cases' as const, label: 'My Cases', count: patientCaseData.length },
            { id: 'plans' as const, label: 'My Reports', count: filteredPlans.length },
            { id: 'activity' as const, label: 'Activity', count: activityLogs.length },
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
            <Input placeholder="Search patient, plan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          {activeTab === 'plans' && (
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue placeholder="Sort..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="az">A → Z</SelectItem>
                  <SelectItem value="za">Z → A</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
          )}
        </div>

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader></Card>)}
            </div>
          ) : patientCaseData.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No cases assigned to you yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {patientCaseData.map(patient => (
                <Card key={patient.id} className="hover:shadow-md transition-shadow">
                  <Collapsible open={expandedPatients[patient.id]} onOpenChange={open => setExpandedPatients(prev => ({ ...prev, [patient.id]: open }))}>
                    <CardContent className="p-4">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expandedPatients[patient.id] ? 'rotate-90' : ''}`} />
                            <div className="flex-1 min-w-0 text-left">
                              <h3 className="font-bold text-sm truncate">{patient.patient_name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {patient.doctor_name && `Dr. ${patient.doctor_name}`}
                                {patient.clinic_name && ` • ${patient.clinic_name}`}
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
                              <span className="text-xs font-medium text-muted-foreground">{phase.phase_name}</span>
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
                                    {plan.status === 'published' && plan.share_token && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                                        e.stopPropagation();
                                        const url = `${SHARE_BASE_URL}/report/${plan.share_token}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success('Share link copied!');
                                      }}>
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => navigate(`/patient/${patient.id}`)}>
                          View Full Case <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </CollapsibleContent>
                    </CardContent>
                  </Collapsible>
                </Card>
              ))}

              {/* Case Requests */}
              {caseRequests.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Recent Case Requests</h3>
                  <div className="space-y-2">
                    {caseRequests.slice(0, 5).map(cr => (
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
          )
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /></CardHeader></Card>)}
            </div>
          ) : filteredPlans.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{plans.length === 0 ? 'No reports assigned to you yet.' : 'No reports match your search.'}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlans.map(plan => (
                <Card key={plan.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{plan.patient_name}</CardTitle>
                        <CardDescription className="text-xs">{plan.phase_name} • {plan.plan_name}</CardDescription>
                      </div>
                      <StatusMarker planId={plan.id} currentStatus={plan.status} onStatusChange={s => handleStatusChange(plan.id, s)} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {plan.plan_date && <p className="text-xs text-muted-foreground">{format(new Date(plan.plan_date), 'MMM d, yyyy')}</p>}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        <span>{plan.remarks_count} remark{plan.remarks_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex gap-2">
                        <Input value={newRemarkText[plan.id] || ''} onChange={e => setNewRemarkText(prev => ({ ...prev, [plan.id]: e.target.value }))}
                          placeholder="Add remark..." className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && addRemark(plan.id)} />
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addRemark(plan.id)} disabled={!newRemarkText[plan.id]?.trim()}>Add</Button>
                      </div>
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
            {activityLogs.length === 0 ? (
              <Card className="p-12 text-center">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No activity logs yet.</p>
              </Card>
            ) : activityLogs.map(log => (
              <Card key={log.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.target_name} ({log.target_type})</p>
                    {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
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
