import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { Calendar, Lock, Search, ArrowUpDown, CheckCircle2, XCircle, Ban, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PlanWithContext } from '@/types';
import { logAction } from '@/lib/audit';

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
}

type SortOption = 'date_desc' | 'date_asc' | 'name_az' | 'name_za';

export default function GlobalKanban() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanWithContext[]>([]);
  const [caseRequests, setCaseRequests] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('plans');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [caseFilterStatus, setCaseFilterStatus] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: patients }, { data: phases }, { data: planData }, { data: cases }] = await Promise.all([
        supabase.from('patients').select('id, patient_name').is('archived_at', null),
        supabase.from('phases').select('id, patient_id, phase_name'),
        supabase.from('treatment_plans').select('*').order('sort_order'),
        supabase.from('case_requests').select('id, patient_name, status, request_type, created_at, display_id, clinic_name, doctor_name').eq('is_deleted', false),
      ]);

      const enriched = (planData || []).map(plan => {
        const phase = phases?.find(ph => ph.id === plan.phase_id);
        const patient = patients?.find(p => p.id === phase?.patient_id);
        return { ...plan, patient_name: patient?.patient_name || 'Unknown', patient_id: patient?.id || '', phase_name: phase?.phase_name || '' } as PlanWithContext;
      });
      setPlans(enriched);
      setCaseRequests((cases || []) as CaseItem[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredPlans = useMemo(() => {
    let result = plans;
    if (search) result = result.filter(p => p.patient_name.toLowerCase().includes(search.toLowerCase()) || p.plan_name.toLowerCase().includes(search.toLowerCase()));
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_az': return a.patient_name.localeCompare(b.patient_name);
        case 'name_za': return b.patient_name.localeCompare(a.patient_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [plans, search, sortBy]);

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

  const planColumnsData = useMemo(() => {
    const data: Record<string, PlanWithContext[]> = {};
    PLAN_COLUMNS.forEach(col => { data[col.id] = filteredPlans.filter(p => p.status === col.id); });
    return data;
  }, [filteredPlans]);

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
          {activeView === 'cases' && (
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
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
              {PLAN_COLUMNS.map(column => (
                <div key={column.id} className="flex-shrink-0 w-72 flex flex-col gap-3">
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
                          {planColumnsData[column.id]?.map((plan, index) => (
                            <Draggable key={plan.id} draggableId={plan.id} index={index} isDragDisabled={!isAdmin}>
                              {(provided, snapshot) => (
                                <Card ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                  className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer ${snapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                                  onClick={() => navigate(`/plan/${plan.id}`)}>
                                  <CardContent className="p-3 space-y-1">
                                    <div className="flex items-center gap-1">
                                      <h4 className="font-bold text-sm truncate">{plan.patient_name}</h4>
                                      {plan.is_finalized && <Lock className="w-3 h-3 text-yellow-500" />}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-[9px] h-4">{plan.phase_name}</Badge>
                                      <span className="text-[10px] text-muted-foreground">{plan.plan_name}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {plan.plan_date ? format(new Date(plan.plan_date), 'MMM d') : 'No date'}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
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
          /* Case Approval Queue — no drag-and-drop */
          <div className="space-y-3">
            {filteredCases.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No case requests found</p>
            ) : filteredCases.map(c => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColor(c.status)}`} />
                      <span className="font-medium text-sm">{c.patient_name}</span>
                      <Badge variant="outline" className="text-[10px]">{c.status.replace('_', ' ')}</Badge>
                      {c.display_id && <span className="text-[10px] text-muted-foreground font-mono">{c.display_id}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.request_type} • {format(new Date(c.created_at), 'MMM d, yyyy')}
                      {c.doctor_name && ` • ${c.doctor_name}`}
                      {c.clinic_name && ` • ${c.clinic_name}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate(`/case-submission/${c.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
