import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, Plus,
  Edit, Trash2, Copy, Share2, Save, FileText, MessageSquare, Users,
  CreditCard, History, ImageIcon, Download, ExternalLink, Clock,
  Briefcase, Receipt, Paperclip, CalendarDays,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SnaponLogo from '@/components/SnaponLogo';
import IPRQuadrantDiagram from '@/components/IPRQuadrantDiagram';
import ToothMovementChart from '@/components/ToothMovementChart';
import CommunicationHub from '@/components/CommunicationHub';
import FilePreviewModal, { PreviewFile } from '@/components/FilePreviewModal';
import { IPRData, ToothMovementData } from '@/lib/csv-parser';

interface Phase {
  id: string;
  phase_name: string;
  phase_order: number;
  status: string;
  created_at: string;
}

interface Plan {
  id: string;
  phase_id: string;
  plan_name: string;
  plan_date: string | null;
  notes: string | null;
  status: string;
  share_token: string | null;
  sort_order: number;
  created_at: string;
}

interface PlanSection {
  id: string;
  plan_id: string;
  section_type: string;
  data_json: any;
  file_url: string | null;
  caption: string | null;
  sort_order: number;
}

interface Remark {
  id: string;
  plan_id: string;
  remark_text: string;
  created_at: string;
  user_id: string;
  display_name?: string;
}

interface PatientData {
  id: string;
  patient_name: string;
  patient_id_label: string | null;
  share_token: string | null;
  doctor_name: string | null;
  clinic_name: string | null;
  lab_name: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  company_name: string | null;
  primary_user_id: string | null;
  secondary_user_id: string | null;
}

interface ProfileItem {
  user_id: string;
  display_name: string | null;
}

interface InvoiceRow {
  id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  patient_name: string;
  display_id?: string;
  type?: string;
}

interface AssetRow {
  id: string;
  file_url: string;
  file_type: string;
  category: string;
  original_name?: string;
  is_viewable: boolean;
  is_downloadable: boolean;
  created_at: string;
  display_id?: string;
}

interface AuditRow {
  id: string;
  action: string;
  target_name: string;
  user_name: string;
  details: string;
  created_at: string;
}

export default function PatientDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientIdLabel, setPatientIdLabel] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [labName, setLabName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [primaryUserId, setPrimaryUserId] = useState('');
  const [secondaryUserId, setSecondaryUserId] = useState('');

  const [phases, setPhases] = useState<Phase[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [allProfiles, setAllProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState<Record<string, string>>({});
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState('');
  const [activeTab, setActiveTab] = useState('workbench');
  const [activePhaseId, setActivePhaseId] = useState<string>('');
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [planSubTab, setPlanSubTab] = useState<string>('details');

  // Billing & Logs
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  // Assets from assets table
  const [assets, setAssets] = useState<AssetRow[]>([]);

  // All files across sections for Assets tab (plan_sections files)
  const allFiles = sections.filter(s => s.file_url).map(s => ({
    id: s.id,
    url: s.file_url!,
    type: s.section_type,
    caption: s.caption,
  }));

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'phase' | 'plan'>('phase');
  const [deleteTargetId, setDeleteTargetId] = useState<string>('');
  const [deleteTargetName, setDeleteTargetName] = useState('');

  const [settingsEntities, setSettingsEntities] = useState<{ id: string; entity_name: string; entity_type: string }[]>([]);

  useEffect(() => {
    if (!isNew && id) loadPatient(id);
    fetchSettingsEntities();
    if (isAdmin) fetchAllProfiles();
  }, [id]);

  const fetchSettingsEntities = async () => {
    const { data } = await supabase.from('settings_entities').select('*').order('entity_name');
    setSettingsEntities(data || []);
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, display_name');
    setAllProfiles(data || []);
  };

  const loadPatient = async (patientId: string) => {
    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).single();
    if (!p) { toast.error('Case not found'); navigate('/'); return; }
    setPatient(p);
    setPatientName(p.patient_name);
    setPatientIdLabel(p.patient_id_label || '');
    setDoctorName(p.doctor_name || '');
    setClinicName(p.clinic_name || '');
    setLabName(p.lab_name || '');
    setCompanyName(p.company_name || '');
    setCountry(p.country || '');
    setContactEmail(p.contact_email || '');
    setContactPhone(p.contact_phone || '');
    setPatientAge(p.patient_age?.toString() || '');
    setPatientSex(p.patient_sex || '');
    setPrimaryUserId(p.primary_user_id || '');
    setSecondaryUserId(p.secondary_user_id || '');

    const { data: phaseData } = await supabase.from('phases').select('*').eq('patient_id', patientId).order('phase_order');
    setPhases(phaseData || []);
    if (phaseData && phaseData.length > 0 && !activePhaseId) {
      setActivePhaseId(phaseData[0].id);
    }
    if (phaseData && phaseData.length > 0) {
      const phaseIds = phaseData.map(ph => ph.id);
      const { data: planData } = await supabase.from('treatment_plans').select('*').in('phase_id', phaseIds).order('sort_order');
      setPlans(planData || []);

      if (planData && planData.length > 0) {
        const planIds = planData.map(pl => pl.id);
        const [{ data: sectionData }, { data: remarkData }] = await Promise.all([
          supabase.from('plan_sections').select('*').in('plan_id', planIds).order('sort_order'),
          supabase.from('plan_remarks').select('*').in('plan_id', planIds).order('created_at', { ascending: false }),
        ]);
        setSections(sectionData || []);

        if (remarkData && remarkData.length > 0) {
          const userIds = [...new Set(remarkData.map(r => r.user_id))];
          const { data: profileData } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
          const profileMap: Record<string, string> = {};
          profileData?.forEach(p => { profileMap[p.user_id] = p.display_name || 'Unknown'; });
          setProfiles(profileMap);
          setRemarks(remarkData.map(r => ({ ...r, display_name: profileMap[r.user_id] || 'Unknown' })));
        } else {
          setRemarks([]);
        }
      }
    }

    // Fetch invoices, audit logs, and assets for this case
    const [{ data: invData }, { data: assetData }] = await Promise.all([
      supabase.from('invoices').select('id, amount_usd, status, created_at, patient_name, display_id, type').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('assets').select('*').eq('case_id', patientId).order('created_at', { ascending: false }),
    ]);
    setInvoices(invData || []);
    setAssets(assetData || []);
    if (isAdmin) {
      const { data: logData } = await supabase.from('audit_logs').select('id, action, target_name, user_name, details, created_at').eq('target_id', patientId).order('created_at', { ascending: false }).limit(50);
      setAuditLogs(logData || []);
    }

    setLoading(false);
  };

  const savePatient = async () => {
    if (!user || !patientName.trim() || !isAdmin) return;
    setSaving(true);
    try {
      const payload: any = {
        patient_name: patientName,
        patient_id_label: patientIdLabel || null,
        doctor_name: doctorName || null,
        clinic_name: clinicName || null,
        lab_name: labName || null,
        company_name: companyName || null,
        country: country || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        patient_age: patientAge ? parseInt(patientAge) : null,
        patient_sex: patientSex || null,
        primary_user_id: primaryUserId || null,
        secondary_user_id: secondaryUserId || null,
      };

      if (isNew) {
        const { data, error } = await supabase.from('patients').insert({ ...payload, user_id: user.id }).select().single();
        if (error) throw error;
        await supabase.from('phases').insert({ patient_id: data.id, phase_name: 'Initial Treatment', phase_order: 0 });
        toast.success('Case created!');
        navigate(`/patient/${data.id}`);
      } else if (patient) {
        const { error } = await supabase.from('patients').update(payload).eq('id', patient.id);
        if (error) throw error;
        toast.success('Case updated!');
      }
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    setSaving(false);
  };

  const addPhase = async () => {
    if (!patient) return;
    const { data, error } = await supabase.from('phases').insert({ patient_id: patient.id, phase_name: `Phase ${phases.length + 1}`, phase_order: phases.length }).select().single();
    if (!error && data) { setPhases(prev => [...prev, data]); setActivePhaseId(data.id); toast.success('Phase added!'); }
  };

  const updatePhaseName = async (phaseId: string) => {
    if (!editPhaseName.trim()) return;
    const { error } = await supabase.from('phases').update({ phase_name: editPhaseName }).eq('id', phaseId);
    if (!error) { setPhases(prev => prev.map(ph => ph.id === phaseId ? { ...ph, phase_name: editPhaseName } : ph)); setEditingPhase(null); }
  };

  const confirmDeletePhase = (phaseId: string, phaseName: string) => {
    setDeleteType('phase'); setDeleteTargetId(phaseId); setDeleteTargetName(phaseName); setDeleteDialogOpen(true);
  };

  const confirmDeletePlan = (planId: string, planName: string, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleteType('plan'); setDeleteTargetId(planId); setDeleteTargetName(planName); setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteType === 'phase') {
      const { error } = await supabase.from('phases').delete().eq('id', deleteTargetId);
      if (!error) { setPhases(prev => prev.filter(ph => ph.id !== deleteTargetId)); setPlans(prev => prev.filter(pl => pl.phase_id !== deleteTargetId)); toast.success('Phase deleted'); }
    } else {
      const { error } = await supabase.from('treatment_plans').delete().eq('id', deleteTargetId);
      if (!error) { setPlans(prev => prev.filter(pl => pl.id !== deleteTargetId)); toast.success('Plan deleted'); }
    }
    setDeleteDialogOpen(false);
  };

  const copyShareLink = (shareToken: string, type: 'plan' | 'journey') => {
    const path = type === 'journey' ? 'journey' : 'report';
    navigator.clipboard.writeText(`${window.location.origin}/${path}/${shareToken}`);
    toast.success('Share link copied!');
  };

  const addRemark = async (planId: string) => {
    const text = newRemarkText[planId]?.trim();
    if (!text || !user) return;
    const { data, error } = await supabase.from('plan_remarks').insert({ plan_id: planId, user_id: user.id, remark_text: text }).select().single();
    if (!error && data) {
      const displayName = profiles[user.id] || user.email || 'You';
      setRemarks(prev => [{ ...data, display_name: displayName }, ...prev]);
      setNewRemarkText(prev => ({ ...prev, [planId]: '' }));

      // Also sync to communications so it appears in the Chat hub
      if (patient) {
        const plan = plans.find(p => p.id === planId);
        const phase = plan ? phases.find(ph => ph.id === plan.phase_id) : null;
        const contextLabel = phase ? `[${phase.phase_name} → ${plan?.plan_name}] ` : `[Plan Remark] `;
        await supabase.from('communications').insert({
          case_id: patient.id,
          sender_id: user.id,
          content: `${contextLabel}${text}`,
          type: 'external',
          related_type: 'plan',
          related_id: planId,
        });
      }
    }
  };

  // Get plans for active phase
  const activePhase = phases.find(ph => ph.id === activePhaseId);
  const activePhasePlans = plans.filter(pl => pl.phase_id === activePhaseId);
  const visibleActivePhasePlans = isAdmin ? activePhasePlans : activePhasePlans.filter(pl => ['published', 'ongoing', 'approved', 'hold', 'rejected'].includes(pl.status));

  const doctorEntities = settingsEntities.filter(e => e.entity_type === 'doctor');
  const clinicEntities = settingsEntities.filter(e => e.entity_type === 'clinic');
  const labEntities = settingsEntities.filter(e => e.entity_type === 'lab');
  const companyEntities = settingsEntities.filter(e => e.entity_type === 'company');

  const renderFeasibilityCard = (data: any, caption: string | null) => {
    if (!data) return null;
    return (
      <Card className="p-4 space-y-3">
        <h4 className="text-sm font-semibold">{caption || 'Feasibility Report'}</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {data.complexity && (
            <div className="p-2 rounded-lg bg-muted/50 space-y-0.5">
              <span className="text-muted-foreground block">Complexity</span>
              <Badge variant="outline" className="text-xs">{data.complexity}</Badge>
            </div>
          )}
          {data.extractionType && (
            <div className="p-2 rounded-lg bg-muted/50 space-y-0.5">
              <span className="text-muted-foreground block">Extraction</span>
              <span className="font-semibold">{data.extractionType}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Card className="p-3 space-y-2">
            <h5 className="font-semibold text-xs text-muted-foreground uppercase">Upper Arch</h5>
            <div className="space-y-1">
              {data.upperArch && <div className="flex justify-between"><span>Feasibility:</span><span className={`font-semibold ${data.upperArch === 'FEASIBLE' ? 'text-green-600' : 'text-destructive'}`}>{data.upperArch}</span></div>}
              {data.upperAlignersCount && <div className="flex justify-between"><span>Stages:</span><span className="font-semibold">{data.upperAlignersCount}</span></div>}
              {data.upperOvercorrectionStages && <div className="flex justify-between"><span>O/C Stages:</span><span className="font-semibold">{data.upperOvercorrectionStages}</span></div>}
              {data.iprUpper && <div className="flex justify-between"><span>IPR:</span><span className="font-semibold">{data.iprUpper}</span></div>}
              {data.attachmentUpper && <div className="flex justify-between"><span>Attachments:</span><span className="font-semibold">{data.attachmentUpper}</span></div>}
            </div>
          </Card>
          <Card className="p-3 space-y-2">
            <h5 className="font-semibold text-xs text-muted-foreground uppercase">Lower Arch</h5>
            <div className="space-y-1">
              {data.lowerArch && <div className="flex justify-between"><span>Feasibility:</span><span className={`font-semibold ${data.lowerArch === 'FEASIBLE' ? 'text-green-600' : 'text-destructive'}`}>{data.lowerArch}</span></div>}
              {data.lowerAlignersCount && <div className="flex justify-between"><span>Stages:</span><span className="font-semibold">{data.lowerAlignersCount}</span></div>}
              {data.lowerOvercorrectionStages && <div className="flex justify-between"><span>O/C Stages:</span><span className="font-semibold">{data.lowerOvercorrectionStages}</span></div>}
              {data.iprLower && <div className="flex justify-between"><span>IPR:</span><span className="font-semibold">{data.iprLower}</span></div>}
              {data.attachmentLower && <div className="flex justify-between"><span>Attachments:</span><span className="font-semibold">{data.attachmentLower}</span></div>}
            </div>
          </Card>
        </div>
        {data.notes && <p className="text-xs text-muted-foreground italic mt-2">{data.notes}</p>}
      </Card>
    );
  };

  const renderEntitySelect = (label: string, value: string, onChange: (v: string) => void, entities: { entity_name: string }[], placeholder: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {entities.map(e => <SelectItem key={e.entity_name} value={e.entity_name}>{e.entity_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const renderUserSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select user..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {allProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0, 8)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading case...</div></div>;

  // New patient form - admin only
  if (isNew) {
    if (!isAdmin) { navigate('/'); return null; }
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto flex items-center h-14 px-4 gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4" /></Button>
            <SnaponLogo size={24} />
            <span className="font-semibold text-sm">New Case</span>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
              <CardDescription>Add a new case record with all details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Patient Name *</Label><Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="John Doe" /></div>
                <div className="space-y-2"><Label>Patient ID / Label</Label><Input value={patientIdLabel} onChange={e => setPatientIdLabel(e.target.value)} placeholder="PAT-001" /></div>
                <div className="space-y-2"><Label>Age</Label><Input type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="25" /></div>
                <div className="space-y-2"><Label>Sex</Label><Select value={patientSex} onValueChange={setPatientSex}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                {renderEntitySelect('Doctor', doctorName, setDoctorName, doctorEntities, 'Select doctor...')}
                {renderEntitySelect('Clinic', clinicName, setClinicName, clinicEntities, 'Select clinic...')}
                {renderEntitySelect('Lab', labName, setLabName, labEntities, 'Select lab...')}
                {renderEntitySelect('Company', companyName, setCompanyName, companyEntities, 'Select company...')}
                <div className="space-y-2"><Label>Country / Location</Label><Input value={country} onChange={e => setCountry(e.target.value)} placeholder="India" /></div>
                <div className="space-y-2"><Label>Contact Email</Label><Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="patient@email.com" /></div>
                <div className="space-y-2"><Label>Contact Phone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
              </div>
              {isAdmin && allProfiles.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Users className="w-3 h-3" /> User Assignment
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderUserSelect('Primary User', primaryUserId, setPrimaryUserId)}
                    {renderUserSelect('Secondary User', secondaryUserId, setSecondaryUserId)}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
                <Button onClick={savePatient} disabled={saving || !patientName.trim()} className="dental-gradient">
                  <Save className="w-4 h-4 mr-1" /> Create Case
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ==================== EXISTING PATIENT DETAIL - 4-TAB HUB ====================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between h-auto sm:h-14 px-4 py-2 sm:py-0 gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4" /></Button>
            <SnaponLogo size={24} showText={false} />
            <span className="font-semibold text-sm">{patientName}</span>
            {patientIdLabel && <Badge variant="secondary" className="text-xs">{patientIdLabel}</Badge>}
            {patientAge && <span className="text-xs text-muted-foreground">{patientAge}y {patientSex}</span>}
          </div>
          <div className="flex items-center gap-2">
            {patient?.share_token && (
              <>
                <Button variant="outline" size="sm" onClick={() => copyShareLink(patient.share_token!, 'journey')}>
                  <Share2 className="w-3 h-3 mr-1" /> Journey
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/journey/${patient.share_token}`)}>
                  <ExternalLink className="w-3 h-3 mr-1" /> View Journey
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* 4-Tab Hub */}
        {/* Quick Links Row */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1 shrink-0 py-1.5" onClick={() => setActiveTab('billing')}>
            <Receipt className="w-3 h-3" /> {invoices.length} Invoice{invoices.length !== 1 ? 's' : ''}
            {invoices.reduce((s, i) => s + (i.status !== 'paid' ? i.amount_usd : 0), 0) > 0 && (
              <span className="text-destructive ml-1">₹{invoices.reduce((s, i) => s + (i.status !== 'paid' ? i.amount_usd : 0), 0).toLocaleString()}</span>
            )}
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1 shrink-0 py-1.5" onClick={() => setActiveTab('assets')}>
            <Paperclip className="w-3 h-3" /> {assets.length + allFiles.length} Files
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1 shrink-0 py-1.5" onClick={() => setActiveTab('timeline')}>
            <Clock className="w-3 h-3" /> {auditLogs.length} Events
          </Badge>
          {remarks.length > 0 && (
            <Badge variant="outline" className="gap-1 shrink-0 py-1.5">
              <MessageSquare className="w-3 h-3" /> Last remark {formatDistanceToNow(new Date(remarks[0].created_at), { addSuffix: true })}
            </Badge>
          )}
          {patient?.share_token && (
            <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1 shrink-0 py-1.5" onClick={() => navigate(`/journey/${patient.share_token}`)}>
              <ExternalLink className="w-3 h-3" /> Share Report
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 mb-6">
            <TabsTrigger value="workbench" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> Workbench
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm">
              <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" /> Assets
            </TabsTrigger>
            <TabsTrigger value="communication" className="gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-xs sm:text-sm">
              <History className="w-3 h-3 sm:w-4 sm:h-4" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" /> Billing
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: TREATMENT WORKBENCH ===== */}
          <TabsContent value="workbench" className="space-y-6">
            {/* Edit Case Info (collapsible) */}
            {isAdmin && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground"><Edit className="w-3 h-3 mr-1" /> Edit Case Info</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={patientName} onChange={e => setPatientName(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">ID</Label><Input value={patientIdLabel} onChange={e => setPatientIdLabel(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Age</Label><Input type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Sex</Label>
                          <Select value={patientSex} onValueChange={setPatientSex}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                        </div>
                        {renderEntitySelect('Doctor', doctorName, setDoctorName, doctorEntities, 'Select...')}
                        {renderEntitySelect('Clinic', clinicName, setClinicName, clinicEntities, 'Select...')}
                        {renderEntitySelect('Lab', labName, setLabName, labEntities, 'Select...')}
                        {renderEntitySelect('Company', companyName, setCompanyName, companyEntities, 'Select...')}
                        <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={country} onChange={e => setCountry(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
                      </div>
                      {allProfiles.length > 0 && (
                        <div className="pt-3 border-t border-border/50 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <Users className="w-3 h-3" /> User Assignment
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {renderUserSelect('Primary User', primaryUserId, setPrimaryUserId)}
                            {renderUserSelect('Secondary User', secondaryUserId, setSecondaryUserId)}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={savePatient} disabled={saving}><Save className="w-3 h-3 mr-1" /> Save</Button>
                        <Button size="sm" variant="outline" onClick={() => id && loadPatient(id)}>Discard</Button>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Phase Tabs → Plan Tabs → Sub-tabs */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Treatment Phases</h2>
              {isAdmin && <Button size="sm" variant="outline" onClick={addPhase}><Plus className="w-3 h-3 mr-1" /> Add Phase</Button>}
            </div>

            {phases.length === 0 ? (
              <Card className="p-8 text-center"><p className="text-muted-foreground">No phases yet. Add a phase to start.</p></Card>
            ) : (
              <>
                {/* Phase horizontal tabs */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                  {phases.map((phase, i) => (
                    <Button
                      key={phase.id}
                      variant={activePhaseId === phase.id ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 text-xs gap-1.5"
                      onClick={() => { setActivePhaseId(phase.id); setActivePlanId(''); setPlanSubTab('details'); }}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      {phase.phase_name}
                    </Button>
                  ))}
                </div>

                {activePhase && (
                  <div className="space-y-4">
                    {/* Phase actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {editingPhase === activePhase.id ? (
                          <div className="flex items-center gap-2">
                            <Input value={editPhaseName} onChange={e => setEditPhaseName(e.target.value)} className="h-7 w-48 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && updatePhaseName(activePhase.id)} />
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => updatePhaseName(activePhase.id)}><Save className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingPhase(activePhase.id); setEditPhaseName(activePhase.phase_name); }}>
                            <Edit className="w-3 h-3 mr-1" /> Rename
                          </Button>
                        )}
                        {phases.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => confirmDeletePhase(activePhase.id, activePhase.phase_name)}>
                            <Trash2 className="w-3 h-3 mr-1" /> Delete Phase
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Plan horizontal tabs */}
                    {visibleActivePhasePlans.length === 0 ? (
                      <Card className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">No treatment plans in this phase</p>
                        {isAdmin && (
                          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/plan/new?phaseId=${activePhase.id}`)}>
                            <Plus className="w-3 h-3 mr-1" /> Add Plan
                          </Button>
                        )}
                      </Card>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {visibleActivePhasePlans.map(plan => (
                            <Button
                              key={plan.id}
                              variant={activePlanId === plan.id ? 'secondary' : 'ghost'}
                              size="sm"
                              className="shrink-0 text-xs"
                              onClick={() => { setActivePlanId(plan.id); setPlanSubTab('details'); }}
                            >
                              {plan.plan_name}
                              <Badge variant="outline" className="ml-1.5 text-[9px] h-4">{plan.status}</Badge>
                            </Button>
                          ))}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={() => navigate(`/plan/new?phaseId=${activePhase.id}`)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {/* Active plan content with sub-tabs */}
                        {(() => {
                          const plan = visibleActivePhasePlans.find(p => p.id === activePlanId) || visibleActivePhasePlans[0];
                          if (!plan) return null;
                          // Auto-select first plan if none selected
                          if (activePlanId !== plan.id) {
                            setTimeout(() => setActivePlanId(plan.id), 0);
                          }
                          const planSections = sections.filter(s => s.plan_id === plan.id);
                          const planRemarks = remarks.filter(r => r.plan_id === plan.id);
                          const feasSecs = planSections.filter(s => s.section_type === 'feasibility');
                          const iprSecs = planSections.filter(s => s.section_type === 'ipr');
                          const movSecs = planSections.filter(s => s.section_type === 'movement');
                          const imgSecs = planSections.filter(s => s.section_type === 'image');
                          const vidSecs = planSections.filter(s => s.section_type === 'video');
                          const audSecs = planSections.filter(s => s.section_type === 'audio');
                          const modelSecs = planSections.filter(s => s.section_type === 'model_analysis');
                          const cephSecs = planSections.filter(s => s.section_type === 'cephalometric');
                          const planFiles = planSections.filter(s => s.file_url);

                          return (
                            <Card className="overflow-hidden">
                              {/* Plan header */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{plan.plan_name}</span>
                                    <Badge variant={plan.status === 'published' ? 'default' : 'outline'} className="text-xs">{plan.status}</Badge>
                                    {plan.plan_date && <span className="text-xs text-muted-foreground">{format(new Date(plan.plan_date), 'MMM d, yyyy')}</span>}
                                  </div>
                                  {plan.notes && <p className="text-xs text-muted-foreground mt-1">{plan.notes}</p>}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isAdmin && <Button variant="outline" size="sm" onClick={() => navigate(`/plan/${plan.id}`)}><Edit className="w-3 h-3 mr-1" /> Edit</Button>}
                                  {plan.share_token && plan.status === 'published' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyShareLink(plan.share_token!, 'plan')}><Copy className="w-3 h-3" /></Button>
                                  )}
                                  {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => confirmDeletePlan(plan.id, plan.plan_name, e)}><Trash2 className="w-3 h-3" /></Button>}
                                </div>
                              </div>

                              {/* Sub-tabs: Details | Files | Chat */}
                              <Tabs value={planSubTab} onValueChange={setPlanSubTab} className="w-full">
                                <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent h-10 px-4">
                                  <TabsTrigger value="details" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Details</TabsTrigger>
                                  <TabsTrigger value="files" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Files ({planFiles.length})</TabsTrigger>
                                  <TabsTrigger value="chat" className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Chat</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="p-4 space-y-4 mt-0">
                                  {feasSecs.map(sec => <div key={sec.id}>{renderFeasibilityCard(sec.data_json, sec.caption)}</div>)}
                                  {iprSecs.map(sec => {
                                    const iprData = sec.data_json as IPRData;
                                    if (!iprData) return null;
                                    return (<Card key={sec.id} className="p-4 space-y-3"><h4 className="text-sm font-semibold">{sec.caption || 'IPR'}</h4><IPRQuadrantDiagram iprData={iprData} /></Card>);
                                  })}
                                  {movSecs.map(sec => (<Card key={sec.id} className="p-4 space-y-3"><h4 className="text-sm font-semibold">{sec.caption || 'Tooth Movement'}</h4><ToothMovementChart data={sec.data_json as ToothMovementData} /></Card>))}
                                  {modelSecs.map(sec => (
                                    <Card key={sec.id} className="p-4 space-y-3">
                                      <h4 className="text-sm font-semibold">{sec.caption || 'Model Analysis'}</h4>
                                      {sec.data_json?.discrepancies && (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs border-collapse">
                                            <thead><tr className="border-b border-border"><th className="text-left py-1 px-2">Description</th><th className="text-center py-1 px-2">Norm</th><th className="text-center py-1 px-2">Value</th><th className="text-center py-1 px-2">Diff</th></tr></thead>
                                            <tbody>{sec.data_json.discrepancies.map((d: any, i: number) => (
                                              <tr key={i} className="border-b border-border/20"><td className="py-1 px-2">{d.description}</td><td className="py-1 px-2 text-center text-muted-foreground">{d.norm || '—'}</td><td className="py-1 px-2 text-center font-medium">{d.value || '—'}</td><td className="py-1 px-2 text-center">{d.diff || '—'}</td></tr>
                                            ))}</tbody>
                                          </table>
                                        </div>
                                      )}
                                    </Card>
                                  ))}
                                  {cephSecs.map(sec => (
                                    <Card key={sec.id} className="p-4 space-y-3">
                                      <h4 className="text-sm font-semibold">{sec.caption || 'Cephalometric'}</h4>
                                      {sec.data_json?.cephSvg && <div className="flex justify-center max-h-48 overflow-auto" dangerouslySetInnerHTML={{ __html: sec.data_json.cephSvg }} />}
                                    </Card>
                                  ))}
                                  {imgSecs.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {imgSecs.map(sec => (
                                        <Card key={sec.id} className="p-3 space-y-2">
                                          {sec.file_url && <img src={sec.file_url} alt={sec.caption || ''} className="w-full rounded-lg object-cover max-h-64" />}
                                          {sec.caption && <p className="text-xs text-muted-foreground">{sec.caption}</p>}
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                  {vidSecs.map(sec => (<Card key={sec.id} className="p-4 space-y-2"><h4 className="text-sm font-semibold">{sec.caption || 'Video'}</h4>{sec.file_url && <video src={sec.file_url} controls className="w-full rounded-lg" />}</Card>))}
                                  {audSecs.map(sec => (
                                    <Card key={sec.id} className="p-4 space-y-2"><h4 className="text-sm font-semibold">{sec.caption || 'Audio'}</h4>{sec.file_url && <audio src={sec.file_url} controls className="w-full" />}
                                      {sec.data_json?.transcription && <div className="p-2 bg-muted/50 rounded text-sm">{sec.data_json.transcription}</div>}
                                    </Card>
                                  ))}

                                  {/* Remarks */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                      <MessageSquare className="w-3 h-3" /> Remarks ({planRemarks.length})
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                      {planRemarks.map(r => (
                                        <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <span className="font-semibold text-foreground">{r.display_name || 'Unknown'}</span>
                                              <span className="text-muted-foreground/60">{format(new Date(r.created_at), 'MMM d, h:mm a')}</span>
                                            </div>
                                            <p className="text-foreground/80">{r.remark_text}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex gap-2">
                                      <Input value={newRemarkText[plan.id] || ''} onChange={e => setNewRemarkText(prev => ({ ...prev, [plan.id]: e.target.value }))}
                                        placeholder="Add a remark..." className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && addRemark(plan.id)} />
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addRemark(plan.id)} disabled={!newRemarkText[plan.id]?.trim()}>Add</Button>
                                    </div>
                                  </div>
                                </TabsContent>

                                <TabsContent value="files" className="p-4 mt-0">
                                  {planFiles.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No files in this plan</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {planFiles.map(sec => (
                                        <Card key={sec.id} className="p-3 space-y-2">
                                          {sec.section_type === 'image' && sec.file_url ? (
                                            <img src={sec.file_url} alt={sec.caption || ''} className="w-full rounded-lg object-cover h-40" />
                                          ) : sec.section_type === 'video' && sec.file_url ? (
                                            <video src={sec.file_url} controls className="w-full rounded-lg h-40 object-cover" />
                                          ) : (
                                            <div className="h-40 rounded-lg bg-muted/50 flex items-center justify-center">
                                              <FileText className="w-8 h-8 text-muted-foreground" />
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground truncate">{sec.caption || sec.section_type}</span>
                                            {sec.file_url && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                <a href={sec.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
                                              </Button>
                                            )}
                                          </div>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="chat" className="mt-0">
                                  {patient && <CommunicationHub caseId={patient.id} relatedType="plan" relatedId={plan.id} />}
                                </TabsContent>
                              </Tabs>
                            </Card>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ===== TAB 2: ASSETS WITH PERMISSIONS ===== */}
          <TabsContent value="assets" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Files & Assets</h2>
              {isAdmin && assets.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={async () => {
                    await supabase.from('assets').update({ is_viewable: true }).eq('case_id', patient!.id);
                    setAssets(prev => prev.map(a => ({ ...a, is_viewable: true })));
                    toast.success('All assets marked viewable');
                  }}>Mark All Viewable</Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={async () => {
                    await supabase.from('assets').update({ is_downloadable: true }).eq('case_id', patient!.id);
                    setAssets(prev => prev.map(a => ({ ...a, is_downloadable: true })));
                    toast.success('All assets marked downloadable');
                  }}>Mark All Downloadable</Button>
                </div>
              )}
            </div>
            {/* Combined: assets table + plan_sections files */}
            {assets.length === 0 && allFiles.length === 0 ? (
              <Card className="p-8 text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No files attached to this case yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.filter(a => isAdmin || a.is_viewable).map(asset => (
                  <Card key={asset.id} className="p-3 space-y-2">
                    {asset.file_type.startsWith('image') ? (
                      <img src={asset.file_url} alt={asset.original_name || ''} className="w-full rounded-lg object-cover h-40" />
                    ) : asset.file_type.startsWith('video') ? (
                      <video src={asset.file_url} controls className="w-full rounded-lg h-40 object-cover" />
                    ) : asset.file_type === 'application/pdf' ? (
                      <iframe src={asset.file_url} className="w-full rounded-lg h-40" title={asset.original_name || 'PDF'} />
                    ) : (
                      <div className="h-40 rounded-lg bg-muted/50 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate">{asset.original_name || asset.category}</span>
                        {asset.display_id && <span className="text-[9px] text-muted-foreground font-mono">{asset.display_id}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        {(isAdmin || asset.is_downloadable) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={asset.file_url} target="_blank" rel="noopener noreferrer" download><Download className="w-3 h-3" /></a>
                          </Button>
                        )}
                        {isAdmin && (
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                              <input type="checkbox" checked={asset.is_viewable} onChange={async (e) => {
                                const val = e.target.checked;
                                await supabase.from('assets').update({ is_viewable: val }).eq('id', asset.id);
                                setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_viewable: val } : a));
                              }} className="w-3 h-3" /> View
                            </label>
                            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                              <input type="checkbox" checked={asset.is_downloadable} onChange={async (e) => {
                                const val = e.target.checked;
                                await supabase.from('assets').update({ is_downloadable: val }).eq('id', asset.id);
                                setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_downloadable: val } : a));
                              }} className="w-3 h-3" /> DL
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {/* Plan section files */}
                {allFiles.map(file => (
                  <Card key={file.id} className="p-3 space-y-2">
                    {file.type === 'image' && file.url ? (
                      <img src={file.url} alt={file.caption || ''} className="w-full rounded-lg object-cover h-40" />
                    ) : file.type === 'video' && file.url ? (
                      <video src={file.url} className="w-full rounded-lg h-40 object-cover" />
                    ) : (
                      <div className="h-40 rounded-lg bg-muted/50 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">{file.caption || file.type}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer"><Download className="w-3 h-3" /></a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 3: COMMUNICATION HUB ===== */}
          <TabsContent value="communication">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-lg">Communication</CardTitle>
                <CardDescription>All messaging for this case (general + plan-specific)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {patient && <CommunicationHub caseId={patient.id} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 4: TIMELINE ===== */}
          <TabsContent value="timeline" className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5" /> Activity Timeline</h2>
            {auditLogs.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">No activity recorded for this case yet.</p>
              </Card>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {auditLogs.map((log, i) => {
                    const prevLog = auditLogs[i - 1];
                    const thisDate = format(new Date(log.created_at), 'MMM d, yyyy');
                    const prevDate = prevLog ? format(new Date(prevLog.created_at), 'MMM d, yyyy') : '';
                    const showDateSep = thisDate !== prevDate;
                    const iconColor = log.action.includes('Delete') || log.action.includes('Reject') ? 'bg-destructive' :
                      log.action.includes('Accept') || log.action.includes('Complete') || log.action.includes('Paid') ? 'bg-green-500' :
                      log.action.includes('Submit') || log.action.includes('Create') ? 'bg-blue-500' : 'bg-muted-foreground';
                    return (
                      <div key={log.id}>
                        {showDateSep && (
                          <div className="ml-10 py-2">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-background px-2">{thisDate}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-3 py-2 pl-1">
                          <div className={`w-3 h-3 rounded-full ${iconColor} shrink-0 mt-1 ring-2 ring-background z-10 ml-[6px]`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{log.action}</span>
                              <Badge variant="outline" className="text-[9px]">{log.target_name}</Badge>
                            </div>
                            {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {log.user_name} · {format(new Date(log.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 5: BILLING ===== */}
          <TabsContent value="billing" className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Billing</h2>
              {isAdmin && patient && (
                <Button size="sm" onClick={() => navigate(`/billing/new?patientId=${patient.id}&patientName=${encodeURIComponent(patientName)}${activePhaseId ? `&phaseId=${activePhaseId}` : ''}`)}>
                  <Plus className="w-3 h-3 mr-1" /> Bill This Case
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No invoices for this case.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/billing/${inv.id}`)}>
                          <div>
                            <span className="font-medium">₹{inv.amount_usd.toFixed(2)}</span>
                            {inv.display_id && <span className="text-[10px] text-muted-foreground ml-1 font-mono">{inv.display_id}</span>}
                            <span className="text-xs text-muted-foreground ml-2">{format(new Date(inv.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          <Badge variant={inv.status === 'paid' ? 'default' : 'outline'} className="text-xs">{inv.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Activity Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No activity recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {auditLogs.map(log => (
                          <div key={log.id} className="p-2 rounded-lg bg-muted/30 text-xs space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{log.user_name}</span>
                              <Badge variant="outline" className="text-[9px]">{log.action}</Badge>
                            </div>
                            <p className="text-muted-foreground">{log.details || log.target_name}</p>
                            <p className="text-muted-foreground/60">{format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteType === 'phase' ? 'Phase' : 'Plan'}</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteTargetName}" and all its {deleteType === 'phase' ? 'plans and data' : 'sections and data'}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
