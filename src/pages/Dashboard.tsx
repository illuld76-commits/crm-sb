import React, { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, LogOut, Trash2, Users, ChevronRight, ChevronDown, LayoutGrid, List, Filter, UserCog, Settings, Copy, Link2, ArrowUpDown, Archive, RotateCcw, Columns3, History as HistoryIcon } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SnaponLogo from '@/components/SnaponLogo';
import ThemeToggle from '@/components/ThemeToggle';
import BulkImportDialog from '@/components/BulkImportDialog';

interface PatientRow {
  id: string;
  patient_name: string;
  patient_id_label: string | null;
  share_token: string | null;
  created_at: string;
  doctor_name: string | null;
  clinic_name: string | null;
  lab_name: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  archived_at: string | null;
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
  phase_id: string;
  plan_name: string;
  status: string;
  share_token: string | null;
  plan_date: string | null;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { canAccessPatient, isAdmin, loading: scopeLoading } = useUserScope();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupBy, setGroupBy] = useState<string>('none');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [filterClinic, setFilterClinic] = useState<string>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [pendingCaseCount, setPendingCaseCount] = useState(0);
  const [outstandingInvoiceCount, setOutstandingInvoiceCount] = useState(0);
  const [dueThisWeekCount, setDueThisWeekCount] = useState(0);
  const [activityLogs, setActivityLogs] = useState<{ id: string; action: string; target_name: string; user_name: string; created_at: string; details: string }[]>([]);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  useEffect(() => { if (!scopeLoading) fetchData(); }, [scopeLoading, isAdmin]);

  const fetchData = async () => {
    const { data: patientData, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to load cases'); setLoading(false); return; }

    // RBAC: filter patients for non-admin users
    const scopedPatients = isAdmin ? (patientData || []) : (patientData || []).filter(p => canAccessPatient(p));
    setPatients(scopedPatients);

    if (scopedPatients.length > 0) {
      const patientIds = scopedPatients.map(p => p.id);
      const { data: phaseData } = await supabase
        .from('phases')
        .select('*')
        .in('patient_id', patientIds)
        .eq('is_deleted', false)
        .order('phase_order');
      setPhases(phaseData || []);

      if (phaseData && phaseData.length > 0) {
        const phaseIds = phaseData.map(ph => ph.id);
        const { data: planData } = await supabase
          .from('treatment_plans')
          .select('*')
          .in('phase_id', phaseIds)
          .eq('is_deleted', false)
          .order('sort_order');
        setPlans(planData || []);
      }
    }
    // Fetch KPI data
    const [{ count: pendingCount }, { data: invoiceData }, { data: caseData }] = await Promise.all([
      supabase.from('case_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('is_deleted', false),
      supabase.from('invoices').select('status, balance_due, is_deleted').eq('is_deleted', false),
      supabase.from('case_requests').select('created_at, status, is_deleted').eq('is_deleted', false).in('status', ['pending', 'accepted', 'in_progress']),
    ]);
    setPendingCaseCount(pendingCount || 0);
    setOutstandingInvoiceCount((invoiceData || []).filter((i: any) => ['sent', 'partially_paid'].includes(i.status)).length);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    setDueThisWeekCount((caseData || []).filter((c: any) => {
      const d = new Date(c.created_at);
      return d <= weekEnd;
    }).length);

    // Fetch activity timeline from audit_logs + notifications
    const [{ data: auditData }, { data: notifData }] = await Promise.all([
      supabase.from('audit_logs').select('id, action, target_name, user_name, created_at, details').order('created_at', { ascending: false }).limit(20),
      supabase.from('notifications').select('id, title, body, link, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    const combined = [
      ...(auditData || []).map(a => ({ id: a.id, action: a.action, target_name: a.target_name, user_name: a.user_name, created_at: a.created_at, details: a.details || '' })),
      ...(notifData || []).map(n => ({ id: n.id, action: n.title?.replace(/_/g, ' ') || 'Notification', target_name: '', user_name: '', created_at: n.created_at, details: n.body || '' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25);
    setActivityLogs(combined);

    setLoading(false);
  };

  const openDeleteDialog = (patient: PatientRow, permanent: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(patient);
    setIsPermanentDelete(permanent);
    setDeleteConfirmText('');
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (isPermanentDelete) {
      // Permanent delete from archives
      const { error } = await supabase.from('patients').delete().eq('id', deleteTarget.id);
      if (error) { toast.error('Failed to delete permanently'); return; }
      toast.success('Case permanently deleted');
    } else {
      // Check if any plans are published
      const patientPhases = phases.filter(ph => ph.patient_id === deleteTarget.id);
      const phaseIds = patientPhases.map(ph => ph.id);
      const hasPublished = plans.some(pl => phaseIds.includes(pl.phase_id) && pl.status === 'published');

      if (hasPublished) {
        // Soft delete (archive)
        const { error } = await supabase.from('patients').update({ archived_at: new Date().toISOString() }).eq('id', deleteTarget.id);
        if (error) { toast.error('Failed to archive'); return; }
        toast.success('Case archived');
      } else {
        // Direct delete for non-published
        const { error } = await supabase.from('patients').delete().eq('id', deleteTarget.id);
        if (error) { toast.error('Failed to delete'); return; }
        toast.success('Case deleted');
      }
    }

    setPatients(prev => isPermanentDelete
      ? prev.filter(p => p.id !== deleteTarget.id)
      : prev.map(p => p.id === deleteTarget.id ? { ...p, archived_at: new Date().toISOString() } : p)
    );
    setDeleteDialogOpen(false);
  };

  const restoreCase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('patients').update({ archived_at: null }).eq('id', id);
    if (error) { toast.error('Failed to restore'); return; }
    setPatients(prev => prev.map(p => p.id === id ? { ...p, archived_at: null } : p));
    toast.success('Case restored');
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCases(prev => {
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

  const getPhaseCount = (patientId: string) => phases.filter(ph => ph.patient_id === patientId).length;
  const getLatestStatus = (patientId: string) => {
    const patientPhases = phases.filter(ph => ph.patient_id === patientId);
    const phaseIds = patientPhases.map(ph => ph.id);
    const patientPlans = plans.filter(pl => phaseIds.includes(pl.phase_id));
    if (patientPlans.length === 0) return 'no plans';
    return patientPlans[patientPlans.length - 1]?.status || 'draft';
  };

  const activePatients = useMemo(() => patients.filter(p => !p.archived_at), [patients]);
  const archivedPatients = useMemo(() => patients.filter(p => !!p.archived_at), [patients]);

  const currentPatients = activeTab === 'active' ? activePatients : archivedPatients;

  const uniqueDoctors = useMemo(() => [...new Set(currentPatients.map(p => p.doctor_name).filter(Boolean))] as string[], [currentPatients]);
  const uniqueClinics = useMemo(() => [...new Set(currentPatients.map(p => p.clinic_name).filter(Boolean))] as string[], [currentPatients]);
  const uniqueLabs = useMemo(() => [...new Set(currentPatients.map(p => p.lab_name).filter(Boolean))] as string[], [currentPatients]);

  const filtered = useMemo(() => {
    let result = currentPatients.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || [p.patient_name, p.patient_id_label, p.doctor_name, p.clinic_name, p.lab_name, p.country, p.contact_email].some(f => f?.toLowerCase().includes(q));
      const matchDoctor = filterDoctor === 'all' || p.doctor_name === filterDoctor;
      const matchClinic = filterClinic === 'all' || p.clinic_name === filterClinic;
      const matchLab = filterLab === 'all' || p.lab_name === filterLab;
      return matchSearch && matchDoctor && matchClinic && matchLab;
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
  }, [currentPatients, search, filterDoctor, filterClinic, filterLab, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { 'All Cases': filtered };
    const key = groupBy === 'doctor' ? 'doctor_name' : groupBy === 'clinic' ? 'clinic_name' : groupBy === 'lab' ? 'lab_name' : 'country';
    const groups: Record<string, PatientRow[]> = {};
    filtered.forEach(p => {
      const g = (p as any)[key] || 'Unassigned';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return groups;
  }, [filtered, groupBy]);

  const renderExpandedPhases = (patientId: string) => {
    const casePhases = phases.filter(ph => ph.patient_id === patientId).sort((a, b) => a.phase_order - b.phase_order);
    if (casePhases.length === 0) return <p className="text-xs text-muted-foreground px-4 py-2">No phases yet</p>;

    return (
      <div className="px-4 pb-3 space-y-2">
        {casePhases.map(phase => {
          const phasePlans = plans.filter(pl => pl.phase_id === phase.id);
          return (
            <div key={phase.id} className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{phase.phase_name}</span>
                {phase.share_token && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); copyLink(phase.share_token!, 'journey', e); }} title="Copy phase link">
                    <Link2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {phasePlans.length > 0 && (
                <div className="space-y-1">
                  {phasePlans.map(plan => (
                    <div key={plan.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span>{plan.plan_name}</span>
                        <Badge variant={plan.status === 'published' ? 'default' : 'outline'} className="text-[9px] h-4">{plan.status}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {plan.plan_date && <span className="text-muted-foreground text-[10px]">{format(new Date(plan.plan_date), 'MMM d')}</span>}
                        {plan.share_token && plan.status === 'published' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); copyLink(plan.share_token!, 'report', e); }} title="Copy report link">
                              <Copy className="w-2.5 h-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={e => { e.stopPropagation(); window.open(`${window.location.origin}/report/${plan.share_token}`, '_blank'); }} title="Open published report">
                              <ChevronRight className="w-2.5 h-2.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCaseCard = (p: PatientRow, isArchived: boolean) => {
    const phaseCount = getPhaseCount(p.id);
    const latestStatus = getLatestStatus(p.id);
    const isExpanded = expandedCases.has(p.id);

    return (
      <Card key={p.id} className={`group hover:shadow-md transition-shadow ${isArchived ? 'opacity-70' : ''}`}>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => !isArchived && navigate(`/patient/${p.id}`)}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{p.patient_name}</CardTitle>
              <CardDescription className="text-xs space-x-2">
                {p.patient_id_label && <span>{p.patient_id_label}</span>}
                {p.patient_age && <span>• {p.patient_age}y {p.patient_sex || ''}</span>}
              </CardDescription>
            </div>
            {!isArchived && <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {p.doctor_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.doctor_name}</span>}
            {p.clinic_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.clinic_name}</span>}
            {p.lab_name && <span className="bg-muted px-1.5 py-0.5 rounded">{p.lab_name}</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">{phaseCount} phase{phaseCount !== 1 ? 's' : ''}</Badge>
              <Badge variant={latestStatus === 'published' ? 'default' : 'outline'} className="text-xs">{latestStatus}</Badge>
            </div>
            <div className="flex items-center gap-0.5">
              {isArchived ? (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => restoreCase(p.id, e)} title="Restore">
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => openDeleteDialog(p, true, e)} title="Delete permanently">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
                  {p.share_token && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => copyLink(p.share_token!, 'journey', e)} title="Copy journey link">
                      <Link2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => toggleExpand(p.id, e)} title="Expand phases">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={e => openDeleteDialog(p, false, e)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
          {isArchived && p.archived_at && (
            <p className="text-xs text-destructive/70">Archived {format(new Date(p.archived_at), 'MMM d, yyyy')}</p>
          )}
          {!isArchived && isExpanded && renderExpandedPhases(p.id)}
        </CardContent>
      </Card>
    );
  };

  // Determine if target has published plans
  const targetHasPublished = useMemo(() => {
    if (!deleteTarget) return false;
    const patientPhases = phases.filter(ph => ph.patient_id === deleteTarget.id);
    const phaseIds = patientPhases.map(ph => ph.id);
    return plans.some(pl => phaseIds.includes(pl.phase_id) && pl.status === 'published');
  }, [deleteTarget, phases, plans]);

  const needsConfirmText = isPermanentDelete || targetHasPublished;
  const confirmTextMatch = deleteConfirmText.toUpperCase() === 'DELETE';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <SnaponLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <ThemeToggle />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => navigate('/kanban')} title="Kanban Board">
              <Columns3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/audit-logs')} title="Activity Logs">
              <HistoryIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Settings">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/team')} title="Team Management">
              <UserCog className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign Out"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-5">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => { setActiveTab('active'); setSearch(''); }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <LayoutGrid className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Cases</p>
                <p className="text-lg font-bold">{activePatients.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => navigate('/submitted-cases')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                <Filter className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending Review</p>
                <p className="text-lg font-bold">{pendingCaseCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => navigate('/billing')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding Invoices</p>
                <p className="text-lg font-bold">{outstandingInvoiceCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow group ${dueThisWeekCount > 0 ? 'ring-1 ring-destructive/30' : ''}`} onClick={() => navigate('/kanban')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                <Columns3 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Due This Week</p>
                <p className="text-lg font-bold">{dueThisWeekCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cases</h1>
            <p className="text-muted-foreground text-sm">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <BulkImportDialog onImported={fetchData} />
            <Button onClick={() => navigate('/patient/new')} className="dental-gradient gap-2">
              <Plus className="w-4 h-4" /> New Case
            </Button>
          </div>
        </div>

        {/* Active / Archived tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'active' | 'archived')}>
          <TabsList>
            <TabsTrigger value="active">Active ({activePatients.length})</TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5">
              <Archive className="w-3 h-3" /> Archives ({archivedPatients.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, ID, doctor, clinic, lab..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-accent' : ''}>
              <Filter className="w-4 h-4" />
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
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
            {activeTab === 'active' && (
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Group by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="country">Location</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex border border-border rounded-md">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setViewMode('list')}>
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            {uniqueDoctors.length > 0 && (
              <Select value={filterDoctor} onValueChange={setFilterDoctor}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Doctor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {uniqueDoctors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {uniqueClinics.length > 0 && (
              <Select value={filterClinic} onValueChange={setFilterClinic}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Clinic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clinics</SelectItem>
                  {uniqueClinics.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {uniqueLabs.length > 0 && (
              <Select value={filterLab} onValueChange={setFilterLab}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Lab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labs</SelectItem>
                  {uniqueLabs.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterDoctor('all'); setFilterClinic('all'); setFilterLab('all'); }}>
              Clear Filters
            </Button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /><div className="h-4 bg-muted rounded w-1/3 mt-2" /></CardHeader></Card>)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {activeTab === 'archived'
                ? 'No archived cases.'
                : patients.length === 0
                  ? 'No cases yet. Add your first case!'
                  : 'No cases match your search.'}
            </p>
          </Card>
        ) : (
          Object.entries(grouped).map(([groupName, groupPatients]) => (
            <div key={groupName} className="space-y-3">
              {groupBy !== 'none' && (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-1">
                  {groupName} <span className="text-xs font-normal">({groupPatients.length})</span>
                </h3>
              )}

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupPatients.map(p => renderCaseCard(p, activeTab === 'archived'))}
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Case</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">Doctor</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden lg:table-cell">Clinic</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden lg:table-cell">Lab</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Phases</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                        <th className="py-2 px-2 w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupPatients.map(p => {
                        const phaseCount = getPhaseCount(p.id);
                        const latestStatus = getLatestStatus(p.id);
                        const isArchived = activeTab === 'archived';

                        return (
                          <React.Fragment key={p.id}>
                          <tr className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${isArchived ? 'opacity-70' : ''}`} onClick={() => !isArchived && navigate(`/patient/${p.id}`)}>
                            <td className="py-2 px-3">
                              <div className="font-medium">{p.patient_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.patient_id_label}{p.patient_age ? ` • ${p.patient_age}y` : ''}{p.patient_sex ? ` ${p.patient_sex}` : ''}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">{p.doctor_name || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">{p.clinic_name || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">{p.lab_name || '—'}</td>
                            <td className="py-2 px-3 text-center">{phaseCount}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant={latestStatus === 'published' ? 'default' : 'outline'} className="text-xs">{latestStatus}</Badge>
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{format(new Date(p.created_at), 'MMM d, yyyy')}</td>
                            <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5">
                                {isArchived ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => restoreCase(p.id, e)} title="Restore">
                                      <RotateCcw className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => openDeleteDialog(p, true, e)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => toggleExpand(p.id, e)} title="Expand phases">
                                      {expandedCases.has(p.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </Button>
                                    {p.share_token && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => copyLink(p.share_token!, 'journey', e)} title="Copy journey link">
                                        <Link2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => openDeleteDialog(p, false, e)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {!isArchived && expandedCases.has(p.id) && (
                            <tr>
                              <td colSpan={8} className="bg-muted/20 py-0">
                                {renderExpandedPhases(p.id)}
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}

        {/* Activity Timeline */}
        {activityLogs.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" /> Recent Activity
            </h2>
            <div className="space-y-2">
              {activityLogs.slice(0, 15).map(log => (
                <Card key={log.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{log.action?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.target_name && <span>{log.target_name} • </span>}
                        {log.user_name && <span>by {log.user_name} • </span>}
                        {log.details}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isPermanentDelete ? 'Permanently Delete Case' : targetHasPublished ? 'Archive Published Case' : 'Delete Case'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isPermanentDelete ? (
                <>This will <strong>permanently delete</strong> "{deleteTarget?.patient_name}" and all its data. This cannot be undone. Type <strong>DELETE</strong> to confirm.</>
              ) : targetHasPublished ? (
                <>This case has published reports. It will be moved to <strong>Archives</strong> (hidden from users). Type <strong>DELETE</strong> to confirm.</>
              ) : (
                <>Delete "{deleteTarget?.patient_name}" and all its phases and plans? This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsConfirmText && (
            <Input
              placeholder='Type "DELETE" to confirm'
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className="mt-2"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={needsConfirmText && !confirmTextMatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPermanentDelete ? 'Delete Permanently' : targetHasPublished ? 'Archive' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
