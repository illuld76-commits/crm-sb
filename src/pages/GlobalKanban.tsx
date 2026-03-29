import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { Calendar, Lock, Search, ArrowUpDown, CheckCircle2, XCircle, Ban, Eye, Paperclip, User, MessageSquare, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { PlanWithContext } from '@/types';
import { logAction } from '@/lib/audit';
import { sendNotification } from '@/lib/notifications';

const PLAN_COLUMNS = [
  { id: 'draft', title: 'Draft', color: 'bg-muted-foreground' },
  { id: 'published', title: 'Published', color: 'bg-primary' },
  { id: 'ongoing', title: 'Ongoing', color: 'bg-blue-500' },
  { id: 'hold', title: 'On Hold', color: 'bg-yellow-500' },
  { id: 'approved', title: 'Approved', color: 'bg-green-500' },
  { id: 'rejected', title: 'Rejected', color: 'bg-destructive' },
  { id: 'completed', title: 'Completed', color: 'bg-purple-500' },
];

interface CaseItem {
  id: string;
  patient_name: string;
  status: string;
  request_type: string;
  created_at: string;
  display_id?: string;
  clinic_name?: string;
  doctor_name?: string;
  notes?: string;
  attachments?: { name: string }[];
  priority?: string;
  expected_due_date?: string;
}

interface EnrichedPlan extends PlanWithContext {
  doctor_name?: string;
  remarks_count?: number;
  attachment_count?: number;
}

type SortOption = 'date_desc' | 'date_asc' | 'name_az' | 'name_za';

export default function GlobalKanban() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { canAccessPatient, loading: scopeLoading } = useUserScope();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<EnrichedPlan[]>([]);
  const [caseRequests, setCaseRequests] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('plans');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [caseFilterStatus, setCaseFilterStatus] = useState('all');
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [caseViewMode, setCaseViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    if (scopeLoading) return;
    const fetchData = async () => {
      const [{ data: patients }, { data: phases }, { data: planData }, { data: cases }, { data: remarkCounts }] = await Promise.all([
        supabase.from('patients').select('id, patient_name, doctor_name, clinic_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id').is('archived_at', null),
        supabase.from('phases').select('id, patient_id, phase_name').eq('is_deleted', false),
        supabase.from('treatment_plans').select('*').eq('is_deleted', false).order('sort_order'),
        supabase.from('case_requests').select('id, patient_name, status, request_type, created_at, display_id, clinic_name, doctor_name, notes, attachments, is_deleted').eq('is_deleted', false),
        supabase.from('plan_remarks').select('plan_id'),
      ]);

      const remarkMap: Record<string, number> = {};
      remarkCounts?.forEach((r: any) => { remarkMap[r.plan_id] = (remarkMap[r.plan_id] || 0) + 1; });

      const enriched = (planData || []).map(plan => {
        const phase = phases?.find(ph => ph.id === plan.phase_id);
        const patient = patients?.find(p => p.id === phase?.patient_id);
        return {
          ...plan,
          patient_name: patient?.patient_name || 'Unknown',
          patient_id: patient?.id || '',
          phase_name: phase?.phase_name || '',
          doctor_name: (patient as any)?.doctor_name || undefined,
          remarks_count: remarkMap[plan.id] || 0,
          _patient: patient, // temp for filtering
        } as EnrichedPlan & { _patient?: any };
      });

      // RBAC: filter plans to only those whose patient the user can access
      const scopedPlans = isAdmin ? enriched : enriched.filter(p => {
        if (!p._patient) return false;
        return canAccessPatient(p._patient);
      });
      // Clean up temp field
      const cleanPlans = scopedPlans.map(({ _patient, ...rest }: any) => rest) as EnrichedPlan[];
      setPlans(cleanPlans);

      // RBAC: filter case requests for non-admin using entity-based scoping
      const scopedCases = isAdmin ? (cases || []) : (cases || []).filter((c: any) => {
        if (c.user_id === user?.id) return true;
        return canAccessPatient({
          id: c.id,
          clinic_name: c.clinic_name || null,
          doctor_name: c.doctor_name || null,
          lab_name: c.lab_name || null,
        });
      });
      setCaseRequests(scopedCases as unknown as CaseItem[]);
      setLoading(false);
    };
    fetchData();
  }, [scopeLoading, isAdmin]);

  const uniqueDoctors = useMemo(() => [...new Set(plans.map(p => p.doctor_name).filter(Boolean))] as string[], [plans]);

  const filteredPlans = useMemo(() => {
    let result = plans;
    if (search) result = result.filter(p => p.patient_name.toLowerCase().includes(search.toLowerCase()) || p.plan_name.toLowerCase().includes(search.toLowerCase()));
    if (filterDoctor !== 'all') result = result.filter(p => p.doctor_name === filterDoctor);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_az': return a.patient_name.localeCompare(b.patient_name);
        case 'name_za': return b.patient_name.localeCompare(a.patient_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [plans, search, sortBy, filterDoctor]);

  const filteredCases = useMemo(() => {
    let result = caseRequests;
    if (search) result = result.filter(c => c.patient_name.toLowerCase().includes(search.toLowerCase()));
    if (caseFilterStatus !== 'all') result = result.filter(c => c.status === caseFilterStatus);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_az': return a.patient_name.localeCompare(b.patient_name);
        case 'name_za': return b.patient_name.localeCompare(a.patient_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [caseRequests, search, sortBy, caseFilterStatus]);

  const visibleColumns = useMemo(() => {
    return isAdmin ? PLAN_COLUMNS : PLAN_COLUMNS.filter(c => c.id !== 'draft');
  }, [isAdmin]);

  const planColumnsData = useMemo(() => {
    const data: Record<string, EnrichedPlan[]> = {};
    visibleColumns.forEach(col => { data[col.id] = filteredPlans.filter(p => p.status === col.id); });
    return data;
  }, [filteredPlans, visibleColumns]);

  // Toggle plan status for non-admin users (approve/reject)
  const togglePlanApproval = async (planId: string, newStatus: 'approved' | 'rejected') => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    await supabase.from('treatment_plans').update({ status: newStatus }).eq('id', planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: newStatus } : p));
    toast.success(`Plan ${newStatus}`);

    // Notify the plan owner about status change
    if (user) {
      const { data: phaseData } = await supabase.from('phases').select('patient_id').eq('id', plan.phase_id).single();
      if (phaseData) {
        const { data: patientData } = await supabase.from('patients').select('user_id, primary_user_id').eq('id', phaseData.patient_id).single();
        const targetUserId = patientData?.primary_user_id || patientData?.user_id;
        if (targetUserId && targetUserId !== user.id) {
          sendNotification({
            userId: targetUserId,
            eventType: newStatus === 'approved' ? 'case_accepted' : 'case_on_hold',
            placeholders: { patient_name: plan.patient_name, case_type: plan.plan_name, case_status: newStatus },
            link: `/plan/${planId}`,
          });
        }
      }
    }
  };

  const onPlanDragEnd = async (result: DropResult) => {
    if (!isAdmin) return;
    const { destination, draggableId } = result;
    if (!destination) return;
    const plan = plans.find(p => p.id === draggableId);
    if (!plan || plan.is_finalized) { toast.error('Finalized plans cannot be moved'); return; }
    const newStatus = destination.droppableId;
    await supabase.from('treatment_plans').update({ status: newStatus }).eq('id', draggableId);
    setPlans(prev => prev.map(p => p.id === draggableId ? { ...p, status: newStatus } : p));
    await logAction({ action: 'Kanban Move', target_type: 'plan', target_id: draggableId, target_name: plan.plan_name, user_id: user?.id || '', user_name: user?.email || '', details: `Plan moved to ${newStatus}`, old_value: plan.status, new_value: newStatus });
    
    // Auto-create draft invoice when plan is approved
    if (newStatus === 'approved' && plan.status !== 'approved') {
      try {
        // Find linked request type to get fee
        const { data: phaseData } = await supabase.from('phases').select('patient_id').eq('id', plan.phase_id).single();
        if (phaseData) {
          let fee = 0;
          const { data: caseReqs } = await supabase.from('case_requests').select('request_type').eq('patient_id', phaseData.patient_id).limit(1);
          if (caseReqs && caseReqs.length > 0) {
            const { data: reqPreset } = await supabase.from('presets').select('fee_usd').eq('category', 'request_type').eq('name', caseReqs[0].request_type).single();
            if (reqPreset) fee = reqPreset.fee_usd || 0;
          }
          await supabase.from('invoices').insert({
            patient_id: phaseData.patient_id,
            phase_id: plan.phase_id,
            patient_name: plan.patient_name,
            user_id: user?.id || '',
            status: 'draft',
            amount_usd: fee,
            currency_local: 'INR',
            exchange_rate: 1,
            type: 'standard',
            merchant_details: { name: 'Admin', email: user?.email || '' },
            client_details: { name: plan.patient_name, email: '' },
            items: fee > 0 ? [{ description: plan.plan_name, qty: 1, rate: fee, amount: fee }] : [],
          });
          toast.success('Draft invoice auto-created');
        }
      } catch { /* silent fail for auto-invoice */ }
    }
    
    // Notify about plan status change via Kanban drag
    if (user && plan) {
      const { data: phData } = await supabase.from('phases').select('patient_id').eq('id', plan.phase_id).single();
      if (phData) {
        const { data: ptData } = await supabase.from('patients').select('user_id, primary_user_id').eq('id', phData.patient_id).single();
        const targetUid = ptData?.primary_user_id || ptData?.user_id;
        if (targetUid && targetUid !== user.id) {
          sendNotification({
            userId: targetUid,
            eventType: newStatus === 'published' ? 'case_completed' : 'case_on_hold',
            placeholders: { patient_name: plan.patient_name, case_type: plan.plan_name, case_status: newStatus },
            link: `/plan/${plan.id}`,
          });
        }
      }
    }

    toast.success(`Moved to ${newStatus}`);
  };

  const updateCaseStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('case_requests').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setCaseRequests(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success(`Case ${newStatus.replace('_', ' ')}`);
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { pending: 'bg-yellow-500', accepted: 'bg-green-500', in_progress: 'bg-blue-500', on_hold: 'bg-orange-500', completed: 'bg-purple-500', discarded: 'bg-destructive', draft: 'bg-muted-foreground', rejected: 'bg-destructive' };
    return map[s] || 'bg-muted-foreground';
  };

  const getSlaInfo = (createdAt: string) => {
    const days = differenceInDays(new Date(), new Date(createdAt));
    const slaDays = 14; // default SLA
    const pct = Math.min((days / slaDays) * 100, 100);
    const color = pct >= 100 ? 'bg-destructive' : pct >= 75 ? 'bg-yellow-500' : 'bg-primary';
    return { pct, color, daysLeft: Math.max(slaDays - days, 0) };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Kanban Board" />
      <main className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <Tabs value={activeView} onValueChange={setActiveView} className="w-auto">
            <TabsList><TabsTrigger value="plans" className="text-xs">Plans</TabsTrigger><TabsTrigger value="cases" className="text-xs">Case Queue</TabsTrigger></TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {activeView === 'plans' && uniqueDoctors.length > 0 && (
            <Select value={filterDoctor} onValueChange={setFilterDoctor}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Doctor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {uniqueDoctors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {activeView === 'cases' && (
            <>
              <Select value={caseFilterStatus} onValueChange={setCaseFilterStatus}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="discarded">Discarded</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center border rounded-md overflow-hidden">
                <Button variant={caseViewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-9 rounded-none" onClick={() => setCaseViewMode('list')}><List className="w-3 h-3" /></Button>
                <Button variant={caseViewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-9 rounded-none" onClick={() => setCaseViewMode('grid')}><LayoutGrid className="w-3 h-3" /></Button>
              </div>
            </>
          )}
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-28 h-9 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest</SelectItem>
              <SelectItem value="date_asc">Oldest</SelectItem>
              <SelectItem value="name_az">A-Z</SelectItem>
              <SelectItem value="name_za">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : activeView === 'plans' ? (
          <DragDropContext onDragEnd={onPlanDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px] md:min-h-[600px] snap-x snap-mandatory md:snap-none">
              {visibleColumns.map(column => (
                <div key={column.id} className="flex-shrink-0 w-72 sm:w-80 snap-start flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-2">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{planColumnsData[column.id]?.length || 0}</Badge>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}
                        className={`flex-1 rounded-lg border border-dashed p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-accent/50 border-accent' : 'bg-muted/30 border-border/50'}`}>
                        <div className="space-y-2">
                          {planColumnsData[column.id]?.map((plan, index) => {
                            const sla = getSlaInfo(plan.created_at);
                            return (
                                <Draggable key={plan.id} draggableId={plan.id} index={index} isDragDisabled={!isAdmin}>
                                {(provided, snapshot) => (
                                  <Card ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                    className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                                    onClick={() => navigate(`/plan/${plan.id}`)}>
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-center justify-between gap-1">
                                        <h4 className="font-bold text-sm truncate">{plan.patient_name}</h4>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {plan.is_finalized && <Lock className="w-3 h-3 text-yellow-500" />}
                                          {sla.daysLeft <= 2 && sla.pct < 100 && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        <Badge variant="outline" className="text-[9px] h-4">{plan.phase_name}</Badge>
                                        <span className="text-[10px] text-muted-foreground truncate">{plan.plan_name}</span>
                                      </div>
                                      {plan.doctor_name && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <User className="w-3 h-3" />
                                          <span className="truncate">{plan.doctor_name}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                          <span className="flex items-center gap-0.5">
                                            <Calendar className="w-3 h-3" />
                                            {plan.plan_date ? format(new Date(plan.plan_date), 'MMM d') : 'No date'}
                                          </span>
                                          {(plan.remarks_count || 0) > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <MessageSquare className="w-3 h-3" />
                                              {plan.remarks_count}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Approve/Reject for non-admin users */}
                                      {!isAdmin && (plan.status === 'published' || plan.status === 'ongoing') && (
                                        <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                                          <Button variant="outline" size="sm" className="h-6 text-[10px] text-green-600 flex-1" onClick={() => togglePlanApproval(plan.id, 'approved')}>
                                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve
                                          </Button>
                                          <Button variant="outline" size="sm" className="h-6 text-[10px] text-destructive flex-1" onClick={() => togglePlanApproval(plan.id, 'rejected')}>
                                            <XCircle className="w-3 h-3 mr-0.5" /> Reject
                                          </Button>
                                        </div>
                                      )}
                                      {/* SLA Progress */}
                                      <div className="space-y-0.5">
                                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                          <span>SLA</span>
                                          <span>{sla.daysLeft}d left</span>
                                        </div>
                                        <Progress value={sla.pct} className="h-1" />
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        ) : (
          /* Case Approval Queue */
          <div className={caseViewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {filteredCases.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground col-span-full">No case requests found</p>
            ) : filteredCases.map(c => {
              const attachCount = Array.isArray(c.attachments) ? c.attachments.length : 0;
              return caseViewMode === 'grid' ? (
                <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/work-order/${c.id}`)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{c.patient_name}</span>
                      <div className={`w-2 h-2 rounded-full ${statusColor(c.status)}`} />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{c.status.replace('_', ' ')}</Badge>
                    <p className="text-xs text-muted-foreground">{c.request_type}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'MMM d, yyyy')}</p>
                    {c.doctor_name && <p className="text-[10px] text-muted-foreground">{c.doctor_name}</p>}
                    <div className="flex gap-1 flex-wrap pt-1" onClick={e => e.stopPropagation()}>
                      {isAdmin && c.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" className="text-green-600 h-6 text-[10px]" onClick={() => updateCaseStatus(c.id, 'accepted')}>Accept</Button>
                          <Button variant="ghost" size="sm" className="text-destructive h-6 text-[10px]" onClick={() => updateCaseStatus(c.id, 'rejected')}>Reject</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusColor(c.status)}`} />
                        <span className="font-medium text-sm">{c.patient_name}</span>
                        <Badge variant="outline" className="text-[10px]">{c.status.replace('_', ' ')}</Badge>
                        {c.display_id && <span className="text-[10px] text-muted-foreground font-mono">{c.display_id}</span>}
                        {attachCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Paperclip className="w-3 h-3" /> {attachCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.request_type} • {format(new Date(c.created_at), 'MMM d, yyyy')}
                        {c.doctor_name && ` • ${c.doctor_name}`}
                        {c.clinic_name && ` • ${c.clinic_name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {isAdmin && (
                        <>
                          {c.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="sm" className="text-green-600 h-8" onClick={() => updateCaseStatus(c.id, 'accepted')} title="Accept">
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => updateCaseStatus(c.id, 'rejected')} title="Reject">
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {c.status === 'accepted' && (
                            <Button variant="ghost" size="sm" className="text-blue-600 h-8 text-xs" onClick={() => updateCaseStatus(c.id, 'in_progress')}>Start</Button>
                          )}
                          {(c.status === 'in_progress' || c.status === 'accepted') && (
                            <Button variant="ghost" size="sm" className="text-orange-500 h-8 text-xs" onClick={() => updateCaseStatus(c.id, 'on_hold')}>Hold</Button>
                          )}
                          {(c.status === 'in_progress' || c.status === 'on_hold') && (
                            <Button variant="ghost" size="sm" className="text-purple-600 h-8 text-xs" onClick={() => updateCaseStatus(c.id, 'completed')}>Done</Button>
                          )}
                          {c.status !== 'discarded' && c.status !== 'completed' && (
                            <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => updateCaseStatus(c.id, 'discarded')} title="Discard">
                              <Ban className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate(`/work-order/${c.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
