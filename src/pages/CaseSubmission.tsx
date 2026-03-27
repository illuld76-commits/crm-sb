import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileUp, X, Loader2, ArrowLeft, FileText, Image, Film, Music, Box, CheckCircle2, XCircle, Play, Pause, CircleCheck, Ban, ExternalLink, Download, UserPlus, Trash2, Plus, Hash } from 'lucide-react';
import { logAction } from '@/lib/audit';
import { sendNotification } from '@/lib/notifications';
import { FileAttachment, Preset, CaseRequest } from '@/types';
import FilePreviewModal from '@/components/FilePreviewModal';
import ToothChartSelector, { ToothSelection } from '@/components/ToothChartSelector';
import { convertCaseToProject } from '@/lib/case-conversion';
import { format, formatDistanceToNow } from 'date-fns';

export default function CaseSubmission() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { allowedClinics, allowedDoctors, allowedLabs, canAccessPatient, filterEntities, loading: scopeLoading } = useUserScope();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [caseData, setCaseData] = useState<CaseRequest | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: '', patient_age: '', patient_sex: 'male',
    request_type: '', request_name: '', notes: '', status: 'draft',
    clinic_name: '', doctor_name: '', lab_name: '',
  });
  const [existingAttachments, setExistingAttachments] = useState<FileAttachment[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string; size: number } | null>(null);

  // Multi-request type support
  const [selectedRequestTypes, setSelectedRequestTypes] = useState<{ presetId: string; name: string; qty: number; fee: number }[]>([]);
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({});
  const [toothChartData, setToothChartData] = useState<ToothSelection[]>([]);

  // Existing patient search for linking
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<{ id: string; patient_name: string; doctor_name: string | null; clinic_name: string | null }[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientSearchFocused, setPatientSearchFocused] = useState(false);

  // Settings entities for dropdowns
  const [settingsEntities, setSettingsEntities] = useState<{ entity_name: string; entity_type: string }[]>([]);

  useEffect(() => {
    supabase.from('presets').select('*').order('name').then(({ data }) => {
      setPresets((data || []) as unknown as Preset[]);
    });
    supabase.from('settings_entities').select('entity_name, entity_type').eq('is_deleted', false).order('entity_name').then(({ data }) => {
      setSettingsEntities(data || []);
    });

    // Auto-fill for single-assignment non-admin users
    if (!isAdmin && allowedClinics && allowedClinics.length === 1 && !id) {
      setFormData(prev => ({ ...prev, clinic_name: allowedClinics[0] }));
    }
    if (!isAdmin && allowedDoctors && allowedDoctors.length === 1 && !id) {
      setFormData(prev => ({ ...prev, doctor_name: allowedDoctors[0] }));
    }
    if (!isAdmin && allowedLabs && allowedLabs.length === 1 && !id) {
      setFormData(prev => ({ ...prev, lab_name: allowedLabs[0] }));
    }

    if (id) {
      supabase.from('case_requests').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          const typed = data as unknown as CaseRequest;
          setCaseData(typed);
          setFormData({
            patient_name: data.patient_name || '', patient_age: data.patient_age?.toString() || '',
            patient_sex: data.patient_sex || 'male', request_type: data.request_type || '',
            request_name: (data as any).request_name || '',
            notes: data.notes || '', status: data.status || 'draft',
            clinic_name: data.clinic_name || '', doctor_name: data.doctor_name || '', lab_name: data.lab_name || '',
          });
          setExistingAttachments((data.attachments as unknown as FileAttachment[]) || []);
          setSelectedPatientId(data.patient_id || null);
          if (data.status !== 'draft') {
            setIsViewMode(true);
          }
        }
      });
    }
  }, [id]);

  // Patient search (RBAC-scoped)
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('patients').select('id, patient_name, doctor_name, clinic_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id')
        .ilike('patient_name', `%${patientSearch}%`).limit(20);
      const results = (data || []).filter(p => canAccessPatient(p));
      setPatientResults(results.slice(0, 5));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch, canAccessPatient]);

  const selectExistingPatient = async (p: typeof patientResults[0]) => {
    setSelectedPatientId(p.id);
    // Fetch full patient data including age and sex for auto-population
    const { data: fullPatient } = await supabase.from('patients').select('patient_name, doctor_name, clinic_name, lab_name, patient_age, patient_sex').eq('id', p.id).single();
    if (fullPatient) {
      setFormData(prev => ({
        ...prev,
        patient_name: fullPatient.patient_name || prev.patient_name,
        doctor_name: fullPatient.doctor_name || prev.doctor_name,
        clinic_name: fullPatient.clinic_name || prev.clinic_name,
        lab_name: fullPatient.lab_name || prev.lab_name,
        patient_age: fullPatient.patient_age?.toString() || prev.patient_age,
        patient_sex: fullPatient.patient_sex || prev.patient_sex,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        patient_name: p.patient_name,
        doctor_name: p.doctor_name || prev.doctor_name,
        clinic_name: p.clinic_name || prev.clinic_name,
      }));
    }
    setPatientSearch('');
    setPatientResults([]);
  };

  const handleSubmit = async (isSubmitted: boolean) => {
    if (isSubmitting || !user) return;
    if (!formData.patient_name || !formData.request_type) {
      toast.error('Please fill required fields'); return;
    }
    setIsSubmitting(true);
    try {
      const attachments = [...existingAttachments];
      for (const file of files) {
        const path = `${user.id}/case-requests/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('case-files').upload(path, file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('case-files').getPublicUrl(path);
          attachments.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size });
        }
      }

      const payload: any = {
        patient_name: formData.patient_name,
        patient_age: formData.patient_age ? parseInt(formData.patient_age) : null,
        patient_sex: formData.patient_sex,
        request_type: formData.request_type,
        notes: formData.notes,
        attachments: attachments as any,
        status: isSubmitted ? 'pending' : 'draft',
        user_id: user.id,
        is_submitted: isSubmitted,
        clinic_name: formData.clinic_name,
        doctor_name: formData.doctor_name,
        lab_name: formData.lab_name,
        patient_id: selectedPatientId,
        dynamic_data: {
          ...dynamicFormData,
          ...(toothChartData.length > 0 ? { tooth_chart: toothChartData } : {}),
        } as any,
      };

      if (id) {
        await supabase.from('case_requests').update(payload).eq('id', id);
      } else {
        await supabase.from('case_requests').insert(payload);
      }

      if (isSubmitted) {
        await logAction({
          action: 'Submit Case Request', target_type: 'case_request',
          target_id: id || 'new', target_name: formData.patient_name,
          user_id: user.id, user_name: user.email || '',
          details: 'Case request submitted for review.',
        });
      }

      toast.success(isSubmitted ? 'Case submitted!' : 'Draft saved!');
      navigate('/submitted-cases');
    } catch (error) {
      toast.error('Failed to submit case');
    } finally { setIsSubmitting(false); }
  };

  const updateStatus = async (newStatus: CaseRequest['status']) => {
    if (!id || !user) return;
    const historyEntry = {
      id: crypto.randomUUID(),
      action: `Status changed to ${newStatus}`,
      user_name: user?.email || 'Admin',
      created_at: new Date().toISOString(),
    };
    const currentHistory = (caseData?.history || []) as any[];

    // If accepting and no patient linked, create one automatically
    let patientIdToLink = caseData?.patient_id || selectedPatientId;
    if (newStatus === 'accepted') {
      const requestTypeName = caseData!.request_type;
      const reqTypePreset = presets.find(p => p.category === 'request_type' && p.name === requestTypeName);
      const planPresetId = reqTypePreset?.description;
      const planPreset = planPresetId ? presets.find(p => p.id === planPresetId) : null;
      const planName = planPreset ? planPreset.name : requestTypeName || 'Treatment Plan';
      const caseName = caseData!.patient_name;

      if (!patientIdToLink) {
        // Create NEW patient
        const { data: newPatient, error: patientErr } = await supabase.from('patients').insert({
          patient_name: caseData!.patient_name,
          patient_age: caseData!.patient_age,
          patient_sex: caseData!.patient_sex,
          user_id: caseData!.user_id,
          clinic_name: caseData!.clinic_name || null,
          doctor_name: caseData!.doctor_name || null,
          lab_name: caseData!.lab_name || null,
        }).select('id').single();
        if (!patientErr && newPatient) {
          patientIdToLink = newPatient.id;
        }
      }

      if (patientIdToLink) {
        // Create phase named after the case request
        const { data: existingPhases } = await supabase.from('phases').select('phase_order').eq('patient_id', patientIdToLink).order('phase_order', { ascending: false }).limit(1);
        const nextOrder = (existingPhases?.[0]?.phase_order ?? -1) + 1;
        const { data: newPhase } = await supabase.from('phases').insert({
          patient_id: patientIdToLink,
          phase_name: caseName,
          phase_order: nextOrder,
        }).select('id').single();

        // Create plan named after the request type, store preset info in notes
        if (newPhase) {
          const notesJson = JSON.stringify({
            source: 'case_request',
            case_request_id: id,
            request_type: requestTypeName,
            plan_preset_id: planPresetId || null,
          });
          await supabase.from('treatment_plans').insert({
            phase_id: newPhase.id,
            plan_name: planName,
            plan_date: new Date().toISOString().split('T')[0],
            notes: notesJson,
            status: 'draft',
          } as any);
        }

        // Copy case request attachments to assets table
        const caseAttachments = caseData!.attachments || [];
        if (caseAttachments.length > 0) {
          const assetInserts = caseAttachments.map((att: any) => ({
            case_id: patientIdToLink!,
            file_url: att.url,
            file_type: att.type || 'application/octet-stream',
            original_name: att.name,
            category: 'case_request_attachment',
            is_viewable: true,
            is_downloadable: true,
          }));
          await supabase.from('assets').insert(assetInserts);
        }

        toast.success('Project, phase, and plan created');
        navigate(`/patient/${patientIdToLink}`);
      }
    }

    const { error } = await supabase.from('case_requests').update({
      status: newStatus,
      history: [...currentHistory, historyEntry] as any,
      patient_id: patientIdToLink || null,
    }).eq('id', id);
    if (!error) {
      setCaseData(prev => prev ? { ...prev, status: newStatus, patient_id: patientIdToLink || undefined, history: [...currentHistory, historyEntry] } : prev);
      toast.success(`Case ${newStatus.replace('_', ' ')}`);

      // Log action
      await logAction({
        action: `Case ${newStatus.replace('_', ' ')}`, target_type: 'case_request',
        target_id: id, target_name: caseData?.patient_name || '',
        user_id: user.id, user_name: user.email || '',
        details: `Case request status changed to ${newStatus}`,
        old_value: caseData?.status, new_value: newStatus,
      });

      // Send notification to case owner
      if (caseData?.user_id && caseData.user_id !== user.id) {
        await sendNotification({
          userId: caseData.user_id,
          eventType: `case_${newStatus}`,
          placeholders: { patient_name: caseData.patient_name, case_status: newStatus },
          link: `/case-submission/${id}`,
        });
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    if (type.startsWith('video/')) return <Film className="w-4 h-4 text-purple-500" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4 text-green-500" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type.includes('stl') || type.includes('model')) return <Box className="w-4 h-4 text-orange-500" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground', pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-destructive/10 text-destructive', in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      on_hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      completed: 'bg-primary/10 text-primary', discarded: 'bg-destructive/10 text-destructive',
    };
    return map[s] || 'bg-muted text-muted-foreground';
  };

  const doctorEntities = filterEntities(settingsEntities, 'doctor').length > 0
    ? filterEntities(settingsEntities, 'doctor')
    : (isAdmin ? settingsEntities.filter(e => e.entity_type === 'doctor') : []);
  const clinicEntities = filterEntities(settingsEntities, 'clinic').length > 0
    ? filterEntities(settingsEntities, 'clinic')
    : (isAdmin ? settingsEntities.filter(e => e.entity_type === 'clinic') : []);
  const labEntities = filterEntities(settingsEntities, 'lab').length > 0
    ? filterEntities(settingsEntities, 'lab')
    : (isAdmin ? settingsEntities.filter(e => e.entity_type === 'lab') : []);

  // ─── VIEW MODE (submitted case detail) ───
  if (isViewMode && caseData) {
    const allAttachments = caseData.attachments || [];
    const history = (caseData.history || []) as { id: string; action: string; user_name: string; created_at: string }[];

    return (
      <div className="min-h-screen bg-background">
        <Header title="Case Detail" leftActions={
          <Button variant="ghost" size="icon" onClick={() => navigate('/submitted-cases')}><ArrowLeft className="w-4 h-4" /></Button>
        } />
        <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
          {/* Status + Actions Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold">{caseData.patient_name}</h2>
                    <Badge className={statusColor(caseData.status)}>{caseData.status.replace('_', ' ')}</Badge>
                    {(caseData as any).display_id && (
                      <span className="text-xs font-mono text-muted-foreground">{(caseData as any).display_id}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDistanceToNow(new Date(caseData.created_at), { addSuffix: true })}
                    {' • '}{caseData.request_type}
                    {caseData.doctor_name && ` • Dr. ${caseData.doctor_name}`}
                    {caseData.clinic_name && ` • ${caseData.clinic_name}`}
                  </p>
                  {caseData.patient_id && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => navigate(`/patient/${caseData.patient_id}`)}>
                      View linked project →
                    </Button>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-1">
                    {caseData.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200" onClick={() => updateStatus('accepted')}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => updateStatus('rejected')}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {caseData.status === 'accepted' && (
                      <Button size="sm" variant="outline" className="text-blue-600" onClick={() => updateStatus('in_progress')}>
                        <Play className="w-3.5 h-3.5 mr-1" /> Start
                      </Button>
                    )}
                    {(caseData.status === 'in_progress' || caseData.status === 'accepted') && (
                      <Button size="sm" variant="outline" className="text-orange-500" onClick={() => updateStatus('on_hold')}>
                        <Pause className="w-3.5 h-3.5 mr-1" /> Hold
                      </Button>
                    )}
                    {(caseData.status === 'in_progress' || caseData.status === 'on_hold') && (
                      <Button size="sm" variant="outline" className="text-primary" onClick={() => updateStatus('completed')}>
                        <CircleCheck className="w-3.5 h-3.5 mr-1" /> Done
                      </Button>
                    )}
                    {!['discarded', 'completed'].includes(caseData.status) && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus('discarded')}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Discard
                      </Button>
                    )}
                    {!caseData.patient_id && ['accepted', 'in_progress', 'completed'].includes(caseData.status) && (
                      <Button size="sm" variant="outline" className="text-primary" onClick={async () => {
                        const requestTypeName = caseData.request_type;
                        const reqTypePreset = presets.find(p => p.category === 'request_type' && p.name === requestTypeName);
                        const planPresetId = reqTypePreset?.description;
                        const planPreset = planPresetId ? presets.find(p => p.id === planPresetId) : null;
                        const planName = planPreset ? planPreset.name : requestTypeName || 'Treatment Plan';

                        const { data: newPatient, error } = await supabase.from('patients').insert({
                          patient_name: caseData.patient_name,
                          patient_age: caseData.patient_age,
                          patient_sex: caseData.patient_sex,
                          user_id: caseData.user_id,
                          clinic_name: caseData.clinic_name || null,
                          doctor_name: caseData.doctor_name || null,
                          lab_name: caseData.lab_name || null,
                        }).select('id').single();
                        if (!error && newPatient) {
                          const { data: newPhase } = await supabase.from('phases').insert({ patient_id: newPatient.id, phase_name: caseData.patient_name, phase_order: 0 }).select('id').single();
                          if (newPhase) {
                            const notesJson = JSON.stringify({
                              source: 'case_request',
                              case_request_id: id,
                              request_type: requestTypeName,
                              plan_preset_id: planPresetId || null,
                            });
                            await supabase.from('treatment_plans').insert({
                              phase_id: newPhase.id,
                              plan_name: planName,
                              plan_date: new Date().toISOString().split('T')[0],
                              notes: notesJson,
                              status: 'draft',
                            } as any);
                          }
                          // Copy case request attachments to assets
                          const caseAttachments = caseData.attachments || [];
                          if (caseAttachments.length > 0) {
                            const assetInserts = caseAttachments.map((att: any) => ({
                              case_id: newPatient.id,
                              file_url: att.url,
                              file_type: att.type || 'application/octet-stream',
                              original_name: att.name,
                              category: 'case_request_attachment',
                              is_viewable: true,
                              is_downloadable: true,
                            }));
                            await supabase.from('assets').insert(assetInserts);
                          }
                          await supabase.from('case_requests').update({ patient_id: newPatient.id }).eq('id', id);
                          toast.success('Project created with phase and plan');
                          navigate(`/patient/${newPatient.id}`);
                        } else { toast.error('Failed to create project'); }
                      }}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Convert to Project
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={async () => {
                      const { error } = await supabase.from('case_requests').update({ is_deleted: true }).eq('id', id);
                      if (!error) { toast.success('Moved to archives'); navigate('/submitted-cases'); }
                      else toast.error('Failed to delete');
                    }}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Case Details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Case Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">Patient</span><span className="font-medium">{caseData.patient_name}</span></div>
                {caseData.patient_age && <div><span className="text-muted-foreground text-xs block">Age</span><span>{caseData.patient_age}y</span></div>}
                {caseData.patient_sex && <div><span className="text-muted-foreground text-xs block">Sex</span><span className="capitalize">{caseData.patient_sex}</span></div>}
                <div><span className="text-muted-foreground text-xs block">Type</span><span>{caseData.request_type}</span></div>
                {caseData.doctor_name && <div><span className="text-muted-foreground text-xs block">Doctor</span><span>{caseData.doctor_name}</span></div>}
                {caseData.clinic_name && <div><span className="text-muted-foreground text-xs block">Clinic</span><span>{caseData.clinic_name}</span></div>}
                {caseData.lab_name && <div><span className="text-muted-foreground text-xs block">Lab</span><span>{caseData.lab_name}</span></div>}
              </div>
              {caseData.notes && (
                <>
                  <Separator />
                  <div><span className="text-muted-foreground text-xs block mb-1">Notes</span><p className="text-sm whitespace-pre-wrap">{caseData.notes}</p></div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {allAttachments.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Attachments ({allAttachments.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allAttachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setPreviewFile(file)}>
                      {file.type.startsWith('image/') ? (
                        <img src={file.url} alt={file.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); window.open(file.url, '_blank'); }}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild onClick={e => e.stopPropagation()}>
                          <a href={file.url} download={file.name}><Download className="w-3 h-3" /></a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dynamic Data */}
          {caseData.dynamic_data && Object.keys(caseData.dynamic_data).length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Additional Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(caseData.dynamic_data).map(([key, val]) => {
                  if (key === 'tooth_chart' && Array.isArray(val)) {
                    return (
                      <div key={key}>
                        <span className="text-muted-foreground text-xs block capitalize mb-2">Tooth Chart</span>
                        <ToothChartSelector value={val as ToothSelection[]} onChange={() => {}} readOnly />
                      </div>
                    );
                  }
                  if (Array.isArray(val)) {
                    return (
                      <div key={key}>
                        <span className="text-muted-foreground text-xs block capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm">{val.join(', ')}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground text-xs block capitalize">{key.replace(/_/g, ' ')}</span><span>{String(val)}</span></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-xs">{h.action}</p>
                        <p className="text-xs text-muted-foreground">{h.user_name} • {format(new Date(h.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {previewFile && (
          <FilePreviewModal
            isOpen={!!previewFile}
            onClose={() => setPreviewFile(null)}
            file={previewFile}
          />
        )}
      </div>
    );
  }

  // ─── EDIT / CREATE FORM ───
  return (
    <div className="min-h-screen bg-background">
      <Header title={id ? 'Edit Case Request' : 'New Case Request'} leftActions={
        <Button variant="ghost" size="icon" onClick={() => navigate('/submitted-cases')}><ArrowLeft className="w-4 h-4" /></Button>
      } />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>{id ? 'Edit Case Request' : 'Submit New Case Request'}</CardTitle>
            <CardDescription>Fill in patient details and attach relevant files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link to existing patient */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link to Existing Patient (Optional)</Label>
              <div className="relative">
                <Input
                  placeholder="Search existing patients..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  onFocus={() => setPatientSearchFocused(true)}
                  onBlur={() => setTimeout(() => setPatientSearchFocused(false), 200)}
                />
                {patientSearchFocused && patientSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {patientResults.length > 0 ? patientResults.map(p => (
                      <div key={p.id} className="px-3 py-2 text-sm hover:bg-accent cursor-pointer" onClick={() => selectExistingPatient(p)}>
                        <span className="font-medium">{p.patient_name}</span>
                        {p.doctor_name && <span className="text-muted-foreground"> • {p.doctor_name}</span>}
                        {p.clinic_name && <span className="text-muted-foreground text-xs"> • {p.clinic_name}</span>}
                      </div>
                    )) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No patients found</div>
                    )}
                  </div>
                )}
              </div>
              {selectedPatientId && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <UserPlus className="w-3 h-3 mr-1" /> Linked: {formData.patient_name}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedPatientId(null)}><X className="w-3 h-3" /></Button>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Patient Name *</Label>
                <Input value={formData.patient_name} onChange={e => setFormData(p => ({ ...p, patient_name: e.target.value }))} placeholder="Patient name" />
              </div>
              <div className="space-y-2">
                <Label>Request Type *</Label>
                <Select value={formData.request_type} onValueChange={v => {
                  setFormData(p => ({ ...p, request_type: v }));
                  // Load linked work order form fields
                  const reqType = presets.find(p => p.category === 'request_type' && p.name === v);
                  if (reqType && reqType.unit) {
                    // unit stores linked work order ID
                    const wo = presets.find(p => p.id === reqType.unit);
                    if (wo?.fields) {
                      // Pre-populate dynamic form keys
                      const keys: Record<string, any> = {};
                      (wo.fields as any[]).forEach((f: any) => { keys[f.label] = ''; });
                      setDynamicFormData(keys);
                    }
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {presets.filter(p => p.category === 'request_type').map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name}{p.fee_usd ? ` ($${p.fee_usd})` : ''}</SelectItem>
                    ))}
                    {presets.filter(p => p.category === 'work_order').map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                    <SelectItem value="Aligner Treatment">Aligner Treatment</SelectItem>
                    <SelectItem value="Retainer">Retainer</SelectItem>
                    <SelectItem value="Refinement">Refinement</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={formData.patient_age} onChange={e => setFormData(p => ({ ...p, patient_age: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select value={formData.patient_sex} onValueChange={v => setFormData(p => ({ ...p, patient_sex: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Doctor</Label>
                <Select value={formData.doctor_name || '__none__'} onValueChange={v => setFormData(p => ({ ...p, doctor_name: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {doctorEntities.map(e => <SelectItem key={e.entity_name} value={e.entity_name}>{e.entity_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Clinic</Label>
                <Select value={formData.clinic_name || '__none__'} onValueChange={v => setFormData(p => ({ ...p, clinic_name: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select clinic..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clinicEntities.map(e => <SelectItem key={e.entity_name} value={e.entity_name}>{e.entity_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lab</Label>
                <Select value={formData.lab_name || '__none__'} onValueChange={v => setFormData(p => ({ ...p, lab_name: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select lab..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {labEntities.map(e => <SelectItem key={e.entity_name} value={e.entity_name}>{e.entity_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={4} placeholder="Treatment notes, special instructions..." />
            </div>

            {/* Dynamic Work Order Form Fields */}
            {(() => {
              const reqType = presets.find(p => p.category === 'request_type' && p.name === formData.request_type);
              const linkedWoId = reqType?.unit;
              const wo = linkedWoId ? presets.find(p => p.id === linkedWoId) : presets.find(p => p.category === 'work_order' && p.name === formData.request_type);
              if (!wo?.fields || (wo.fields as any[]).length === 0) return null;
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold">📋 {wo.name} — Work Order Form</h4>
                    {(wo.fields as any[]).map((field: any) => {
                      if (field.type === 'tooth_chart') {
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label || 'Tooth Selection'}</Label>
                            <ToothChartSelector value={toothChartData} onChange={setToothChartData} />
                          </div>
                        );
                      }
                      if (field.type === 'radio' && field.options) {
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                            <Select value={dynamicFormData[field.label] || ''} onValueChange={v => setDynamicFormData(prev => ({ ...prev, [field.label]: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{field.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        );
                      }
                      if (field.type === 'dropdown' && field.options) {
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                            <Select value={dynamicFormData[field.label] || ''} onValueChange={v => setDynamicFormData(prev => ({ ...prev, [field.label]: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{field.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        );
                      }
                      if (field.type === 'checkbox' && field.options) {
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label}</Label>
                            <div className="flex flex-wrap gap-2">
                              {field.options.map((o: string) => (
                                <label key={o} className="flex items-center gap-1 text-xs">
                                  <input type="checkbox" checked={dynamicFormData[field.label]?.includes(o)} onChange={e => {
                                    setDynamicFormData(prev => {
                                      const current = prev[field.label] || [];
                                      return { ...prev, [field.label]: e.target.checked ? [...current, o] : current.filter((x: string) => x !== o) };
                                    });
                                  }} />
                                  {o}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (field.type === 'textarea') {
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                            <Textarea className="text-xs" rows={3} value={dynamicFormData[field.label] || ''} onChange={e => setDynamicFormData(prev => ({ ...prev, [field.label]: e.target.value }))} />
                          </div>
                        );
                      }
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                          <Input className="h-8 text-xs" value={dynamicFormData[field.label] || ''} onChange={e => setDynamicFormData(prev => ({ ...prev, [field.label]: e.target.value }))} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })()}

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <FileUp className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Drop files or click to upload</span>
                <input type="file" className="hidden" multiple onChange={e => {
                  if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }} />
              </label>
              {(files.length > 0 || existingAttachments.length > 0) && (
                <div className="space-y-1 mt-2">
                  {existingAttachments.map((f, i) => (
                    <div key={`existing-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm cursor-pointer" onClick={() => setPreviewFile(f)}>
                      {getFileIcon(f.type)}
                      <span className="flex-1 truncate text-xs">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setExistingAttachments(prev => prev.filter((_, j) => j !== i)); }}><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  {files.map((f, i) => (
                    <div key={`new-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 text-sm">
                      {getFileIcon(f.type)}
                      <span className="flex-1 truncate text-xs">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => handleSubmit(false)} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Draft
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {previewFile && (
        <FilePreviewModal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} file={previewFile} />
      )}
    </div>
  );
}
