import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, Save, Upload, Eye, Trash2, FileText, Image, Pencil, ChevronDown, ChevronRight, Mic, Video, Plus, MousePointerClick, FlaskConical, Scan, Undo2 } from 'lucide-react';
import { logAction } from '@/lib/audit';
import SnaponLogo from '@/components/SnaponLogo';
import { parseIPRCSV, parseToothMovementCSV, parseCombinedCSV, readFileAsText, readFileAsTextUTF8, IPRData, ToothMovementData } from '@/lib/csv-parser';
import IPRQuadrantDiagram, { getAllContactKeys } from '@/components/IPRQuadrantDiagram';
import ToothMovementChart from '@/components/ToothMovementChart';
import AudioRecorder from '@/components/AudioRecorder';

interface SectionItem {
  id?: string;
  section_type: string;
  data_json: any;
  file_url: string | null;
  caption: string;
  sort_order: number;
  file?: File;
}

// Feasibility field component - defined OUTSIDE to prevent re-mount on every render
const FeasibilityField: React.FC<{
  label: string; field: string; value: string;
  onChange: (field: string, value: string) => void;
  type?: 'text' | 'select'; options?: string[];
}> = ({ label, field, value, onChange, type = 'text', options }) => (
  <div className="space-y-1">
    <Label className="text-[10px] text-muted-foreground">{label}</Label>
    {type === 'select' && options ? (
      <Select value={value || ''} onValueChange={v => onChange(field, v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : (
      <Input
        value={value || ''}
        onChange={e => onChange(field, e.target.value)}
        className="h-8 text-xs"
        placeholder={label}
      />
    )}
  </div>
);

export default function PlanEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  const phaseIdParam = searchParams.get('phaseId');
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState<string | null>(isNew ? null : id || null);
  const [phaseId, setPhaseId] = useState<string | null>(phaseIdParam);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [planStatus, setPlanStatus] = useState<string>('draft');

  // Plan info
  const [planName, setPlanName] = useState('Treatment Plan');
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Sections
  const [iprSections, setIprSections] = useState<SectionItem[]>([]);
  const [movementSections, setMovementSections] = useState<SectionItem[]>([]);
  const [imageSections, setImageSections] = useState<SectionItem[]>([]);
  const [videoSections, setVideoSections] = useState<SectionItem[]>([]);
  const [audioSections, setAudioSections] = useState<SectionItem[]>([]);
  const [feasibilitySections, setFeasibilitySections] = useState<SectionItem[]>([]);
  const [modelSections, setModelSections] = useState<SectionItem[]>([]);
  const [cephSections, setCephSections] = useState<SectionItem[]>([]);

  // Active indices
  const [activeIprIndex, setActiveIprIndex] = useState(0);
  const [activeMovementIndex, setActiveMovementIndex] = useState(0);

  // Collapsible state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true, feasibility: true, ipr: true, movement: true,
    images: false, videos: false, audio: false, model: false, ceph: false,
  });

  // Editing section name
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // IPR stage assignment via selection
  const [iprSelectMode, setIprSelectMode] = useState(false);
  const [selectedIPRContacts, setSelectedIPRContacts] = useState<Set<string>>(new Set());
  const [assignStageName, setAssignStageName] = useState('');
  const lastSelectedContact = useRef<string | null>(null);

  useEffect(() => {
    if (!isNew && id) loadPlan(id);
  }, [id]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const loadPlan = async (planId: string) => {
    const { data: plan } = await supabase.from('treatment_plans').select('*').eq('id', planId).single();
    if (!plan) { toast.error('Plan not found'); navigate('/'); return; }

    setPlanName(plan.plan_name);
    setPlanDate(plan.plan_date || '');
    setNotes(plan.notes || '');
    setPhaseId(plan.phase_id);
    setPlanStatus(plan.status || 'draft');
    // Open in read-only mode for saved/published plans
    if (plan.status === 'published' || plan.status === 'saved') {
      setIsEditing(false);
    }

    const { data: sections } = await supabase.from('plan_sections').select('*').eq('plan_id', planId).order('sort_order');
    if (sections) {
      const ipr: SectionItem[] = [], mov: SectionItem[] = [], img: SectionItem[] = [],
        vid: SectionItem[] = [], aud: SectionItem[] = [], feas: SectionItem[] = [],
        model: SectionItem[] = [], ceph: SectionItem[] = [];

      sections.forEach(s => {
        const item: SectionItem = { id: s.id, section_type: s.section_type, data_json: s.data_json, file_url: s.file_url, caption: s.caption || '', sort_order: s.sort_order };
        switch (s.section_type) {
          case 'ipr': ipr.push(item); break;
          case 'movement': mov.push(item); break;
          case 'image': img.push(item); break;
          case 'video': vid.push(item); break;
          case 'audio': aud.push(item); break;
          case 'feasibility': feas.push(item); break;
          case 'model_analysis': model.push(item); break;
          case 'cephalometric': ceph.push(item); break;
        }
      });

      setIprSections(ipr); setMovementSections(mov); setImageSections(img);
      setVideoSections(vid); setAudioSections(aud); setFeasibilitySections(feas);
      setModelSections(model); setCephSections(ceph);

      setOpenSections(prev => ({
        ...prev,
        feasibility: feas.length > 0,
        ipr: ipr.length > 0,
        movement: mov.length > 0,
        images: img.length > 0,
        videos: vid.length > 0,
        audio: aud.length > 0,
        model: model.length > 0,
        ceph: ceph.length > 0,
      }));
    }
  };

  const savePlan = async () => {
    if (!user || !phaseId) return;
    setSaving(true);
    try {
      let currentPlanId = planId;
      if (!currentPlanId) {
        const { data, error } = await supabase.from('treatment_plans').insert({ phase_id: phaseId, plan_name: planName, plan_date: planDate || null, notes: notes || null }).select().single();
        if (error) throw error;
        currentPlanId = data.id;
        setPlanId(currentPlanId);
      } else {
        await supabase.from('treatment_plans').update({ plan_name: planName, plan_date: planDate || null, notes: notes || null }).eq('id', currentPlanId);
      }

      const allSections: SectionItem[] = [
        ...feasibilitySections.map((s, i) => ({ ...s, sort_order: i })),
        ...iprSections.map((s, i) => ({ ...s, sort_order: 50 + i })),
        ...movementSections.map((s, i) => ({ ...s, sort_order: 100 + i })),
        ...imageSections.map((s, i) => ({ ...s, sort_order: 150 + i })),
        ...videoSections.map((s, i) => ({ ...s, sort_order: 200 + i })),
        ...audioSections.map((s, i) => ({ ...s, sort_order: 300 + i })),
        ...modelSections.map((s, i) => ({ ...s, sort_order: 350 + i })),
        ...cephSections.map((s, i) => ({ ...s, sort_order: 400 + i })),
      ];

      for (const section of allSections) {
        if (section.file && currentPlanId) {
          const ext = section.file.name.split('.').pop() || 'bin';
          const filePath = `${user.id}/${currentPlanId}/${section.section_type}_${section.sort_order}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('case-files').upload(filePath, section.file, { upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('case-files').getPublicUrl(filePath);
            section.file_url = urlData.publicUrl;
          }
        }
      }

      await supabase.from('plan_sections').delete().eq('plan_id', currentPlanId);
      const sectionInserts = allSections.map(s => ({ plan_id: currentPlanId!, section_type: s.section_type, data_json: s.data_json, file_url: s.file_url, caption: s.caption || null, sort_order: s.sort_order }));
      if (sectionInserts.length > 0) await supabase.from('plan_sections').insert(sectionInserts);
      toast.success('Plan saved!');
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    setSaving(false);
  };

  const publishPlan = async () => {
    await savePlan();
    if (!planId) return;
    const { data, error } = await supabase.from('treatment_plans').update({ status: 'published' }).eq('id', planId).select('share_token').single();
    if (error) { toast.error('Failed to publish'); } else {
      setPlanStatus('published');
      const url = `${window.location.origin}/report/${data.share_token}`;
      navigator.clipboard.writeText(url);
      toast.success('Published! Share link copied.');
      await logAction({ action: 'Publish Plan', target_type: 'plan', target_id: planId, target_name: planName, user_id: user?.id || '', user_name: user?.email || '', details: 'Plan published and share link generated' });
    }
  };

  const unpublishPlan = async () => {
    if (!planId) return;
    const { error } = await supabase.from('treatment_plans').update({ status: 'saved' }).eq('id', planId);
    if (error) { toast.error('Failed to unpublish'); } else {
      setPlanStatus('saved');
      setIsEditing(true);
      toast.success('Plan unpublished. It is now editable.');
      await logAction({ action: 'Unpublish Plan', target_type: 'plan', target_id: planId, target_name: planName, user_id: user?.id || '', user_name: user?.email || '', details: 'Plan unpublished and reverted to saved state' });
    }
  };

  const saveAsTemplate = async () => {
    if (!user) return;
    const sectionTypes = [
      ...feasibilitySections.map(s => ({ label: s.caption || 'Feasibility', type: 'feasibility' as const, required: false })),
      ...iprSections.map(s => ({ label: s.caption || 'IPR Data', type: 'ipr_data' as const, required: false })),
      ...movementSections.map(s => ({ label: s.caption || 'Tooth Movement', type: 'tooth_movement' as const, required: false })),
      ...imageSections.map(s => ({ label: s.caption || 'Images', type: 'images' as const, required: false })),
      ...videoSections.map(s => ({ label: s.caption || 'Video', type: 'video' as const, required: false })),
      ...audioSections.map(s => ({ label: s.caption || 'Audio', type: 'audio' as const, required: false })),
      ...modelSections.map(s => ({ label: s.caption || 'Model Analysis', type: 'model_analysis' as const, required: false })),
      ...cephSections.map(s => ({ label: s.caption || 'Cephalometric', type: 'cephalometric' as const, required: false })),
    ].map(f => ({ ...f, id: crypto.randomUUID() }));

    if (sectionTypes.length === 0) {
      toast.error('No sections to save as template');
      return;
    }

    const { error } = await supabase.from('presets').insert({
      name: `${planName} Template`,
      fee_usd: 0,
      type: 'case',
      category: 'plan_preset',
      user_id: user.id,
      description: `Template from plan: ${planName}`,
      fields: sectionTypes as any,
    });

    if (!error) {
      toast.success('Plan saved as template! Find it in Presets → Plan Presets.');
    } else {
      toast.error('Failed to save template');
    }
  };

  const handleIPRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      let content: string;
      try { content = await readFileAsText(file); if (!content.includes('Maxilla') && !content.includes('maxilla') && !content.includes('Step')) content = await readFileAsTextUTF8(file); } catch { content = await readFileAsTextUTF8(file); }
      const parsed = parseIPRCSV(content);
      setIprSections(prev => [...prev, { section_type: 'ipr', data_json: parsed, file_url: null, caption: `IPR ${prev.length + 1}`, sort_order: prev.length }]);
      setActiveIprIndex(iprSections.length);
      setOpenSections(prev => ({ ...prev, ipr: true }));
      toast.success('IPR data parsed!');
    } catch { toast.error('Failed to parse IPR CSV'); }
  };

  const handleMovementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      let content: string;
      try { content = await readFileAsText(file); if (!content.includes('Maxilla') && !content.includes('maxilla') && !content.includes('Tooth')) content = await readFileAsTextUTF8(file); } catch { content = await readFileAsTextUTF8(file); }
      const parsed = parseToothMovementCSV(content);
      setMovementSections(prev => [...prev, { section_type: 'movement', data_json: parsed, file_url: null, caption: `Movement ${prev.length + 1}`, sort_order: prev.length }]);
      setActiveMovementIndex(movementSections.length);
      setOpenSections(prev => ({ ...prev, movement: true }));
      toast.success('Movement data parsed!');
    } catch { toast.error('Failed to parse movement CSV'); }
  };

  const handleCombinedCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      let content: string;
      try { content = await readFileAsText(file); if (!content.includes('Maxilla') && !content.includes('maxilla')) content = await readFileAsTextUTF8(file); } catch { content = await readFileAsTextUTF8(file); }
      const { ipr, movement } = parseCombinedCSV(content);
      const hasIPR = ['maxilla', 'mandible'].some(arch =>
        ipr[arch as 'maxilla' | 'mandible']?.steps?.some(s => Object.values(s.values).some(v => v && v > 0))
      );
      const hasMovement = ['maxilla', 'mandible'].some(arch =>
        Object.keys(movement[arch as 'maxilla' | 'mandible'].parameters).length > 0
      );
      if (hasIPR) {
        setIprSections(prev => [...prev, { section_type: 'ipr', data_json: ipr, file_url: null, caption: `IPR ${prev.length + 1} (combined)`, sort_order: prev.length }]);
        setActiveIprIndex(iprSections.length);
        setOpenSections(prev => ({ ...prev, ipr: true }));
      }
      if (hasMovement) {
        setMovementSections(prev => [...prev, { section_type: 'movement', data_json: movement, file_url: null, caption: `Movement ${prev.length + 1} (combined)`, sort_order: prev.length }]);
        setActiveMovementIndex(movementSections.length);
        setOpenSections(prev => ({ ...prev, movement: true }));
      }
      toast.success(`Combined CSV parsed! ${hasIPR ? 'IPR' : ''}${hasIPR && hasMovement ? ' + ' : ''}${hasMovement ? 'Movement' : ''} data loaded.`);
    } catch { toast.error('Failed to parse combined CSV'); }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setVideoSections(prev => [...prev, { section_type: 'video', data_json: null, file_url: URL.createObjectURL(file), caption: `Video ${prev.length + 1}`, sort_order: prev.length, file }]);
    setOpenSections(prev => ({ ...prev, videos: true }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newImages: SectionItem[] = [];
    for (let i = 0; i < files.length; i++) {
      newImages.push({ section_type: 'image', data_json: null, file_url: URL.createObjectURL(files[i]), caption: `Image ${imageSections.length + newImages.length + 1}`, sort_order: imageSections.length + newImages.length, file: files[i] });
    }
    setImageSections(prev => [...prev, ...newImages]);
    setOpenSections(prev => ({ ...prev, images: true }));
  };

  const handleAudioRecorded = (blob: Blob, transcription: string) => {
    const file = new File([blob], `recording_${Date.now()}.webm`, { type: blob.type });
    setAudioSections(prev => [...prev, { section_type: 'audio', data_json: { transcription }, file_url: URL.createObjectURL(blob), caption: transcription || `Audio ${prev.length + 1}`, sort_order: prev.length, file }]);
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAudioSections(prev => [...prev, { section_type: 'audio', data_json: null, file_url: URL.createObjectURL(file), caption: `Audio ${prev.length + 1}`, sort_order: prev.length, file }]);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-report-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: formData,
      });
      if (!response.ok) { const errText = await response.text(); throw new Error(errText || 'Failed to analyze PDF'); }
      const result = await response.json();

      if (result.feasibility) {
        setFeasibilitySections(prev => [...prev, { section_type: 'feasibility', data_json: result.feasibility, file_url: null, caption: 'Feasibility Report', sort_order: prev.length }]);
        setOpenSections(prev => ({ ...prev, feasibility: true }));
      }
      if (result.ipr) {
        setIprSections(prev => [...prev, { section_type: 'ipr', data_json: result.ipr, file_url: null, caption: `IPR ${prev.length + 1} (from PDF)`, sort_order: prev.length }]);
        setOpenSections(prev => ({ ...prev, ipr: true }));
      }
      if (result.movement) {
        setMovementSections(prev => [...prev, { section_type: 'movement', data_json: result.movement, file_url: null, caption: `Movement ${prev.length + 1} (from PDF)`, sort_order: prev.length }]);
        setOpenSections(prev => ({ ...prev, movement: true }));
      }
      if (result.notes) setNotes(prev => prev ? `${prev}\n\n${result.notes}` : result.notes);

      toast.success('PDF analyzed! All sections populated.');
    } catch (err: any) { toast.error(err.message || 'Failed to analyze PDF'); }
    setUploadingPdf(false);
  };

  // Model Analysis - manual entry
  const addEmptyModelAnalysis = () => {
    setModelSections(prev => [...prev, {
      section_type: 'model_analysis',
      data_json: {
        discrepancies: [
          { description: 'Available Space Right Maxilla', norm: '', value: '', diff: '' },
          { description: 'Required Space Right Maxilla', norm: '', value: '', diff: '' },
          { description: 'Available Space Left Maxilla', norm: '', value: '', diff: '' },
          { description: 'Required Space Left Maxilla', norm: '', value: '', diff: '' },
          { description: 'Available Space Right Mandible', norm: '', value: '', diff: '' },
          { description: 'Required Space Right Mandible', norm: '', value: '', diff: '' },
          { description: 'Available Space Left Mandible', norm: '', value: '', diff: '' },
          { description: 'Required Space Left Mandible', norm: '', value: '', diff: '' },
        ],
        anteriorRatio: { norm: '77.2±0.2%', value: '', diff: '' },
        overallRatio: { norm: '91.3±0.3%', value: '', diff: '' },
      },
      file_url: null, caption: 'Model Analysis', sort_order: prev.length,
    }]);
    setOpenSections(prev => ({ ...prev, model: true }));
  };

  // Cephalometric - manual entry
  const addEmptyCephalometric = () => {
    setCephSections(prev => [...prev, {
      section_type: 'cephalometric',
      data_json: {
        cephSvg: null,
        skeletal: [
          { parameter: 'SNA', norm: '82±2', computed: '', inference: '' },
          { parameter: 'SNB', norm: '80±2', computed: '', inference: '' },
          { parameter: 'ANB', norm: '2±2', computed: '', inference: '' },
        ],
        dental: [
          { parameter: 'U1 to NA (°)', norm: '22±2', computed: '', inference: '' },
          { parameter: 'U1 to NA (mm)', norm: '4±1', computed: '', inference: '' },
          { parameter: 'L1 to NB (°)', norm: '25±2', computed: '', inference: '' },
          { parameter: 'L1 to NB (mm)', norm: '4±1', computed: '', inference: '' },
        ],
        softTissue: [
          { parameter: 'Nasolabial Angle', norm: '102±8', computed: '', inference: '' },
          { parameter: 'E-line Upper', norm: '-4±2', computed: '', inference: '' },
          { parameter: 'E-line Lower', norm: '-2±2', computed: '', inference: '' },
        ],
      },
      file_url: null, caption: 'Cephalometric Analysis', sort_order: prev.length,
    }]);
    setOpenSections(prev => ({ ...prev, ceph: true }));
  };

  // Ceph SVG upload via HTML file
  const handleCephHtmlUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const content = await readFileAsTextUTF8(file);
      // Extract SVG from HTML
      const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        setCephSections(prev => prev.map((s, i) => i === idx ? { ...s, data_json: { ...s.data_json, cephSvg: svgMatch[0] } } : s));
        toast.success('Cephalometric tracing loaded!');
      }
      // Try to extract tables
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const tables = doc.querySelectorAll('table');
      if (tables.length > 0) {
        const categories = ['skeletal', 'dental', 'softTissue'];
        const extracted: Record<string, any[]> = {};
        tables.forEach((table, tIdx) => {
          const rows = table.querySelectorAll('tr');
          const items: any[] = [];
          rows.forEach((row, rIdx) => {
            if (rIdx === 0) return; // skip header
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 3) {
              items.push({
                parameter: cells[0]?.textContent?.trim() || '',
                norm: cells[1]?.textContent?.trim() || '',
                computed: cells[2]?.textContent?.trim() || '',
                inference: cells.length > 3 ? cells[3]?.textContent?.trim() || '' : '',
              });
            }
          });
          if (items.length > 0 && tIdx < categories.length) {
            extracted[categories[tIdx]] = items;
          }
        });
        if (Object.keys(extracted).length > 0) {
          setCephSections(prev => prev.map((s, i) => i === idx ? { ...s, data_json: { ...s.data_json, ...extracted } } : s));
        }
      }
    } catch { toast.error('Failed to parse HTML'); }
  };

  const removeSection = useCallback((type: string, index: number) => {
    switch (type) {
      case 'ipr':
        setIprSections(prev => {
          const next = prev.filter((_, i) => i !== index);
          setActiveIprIndex(ai => Math.min(ai, Math.max(0, next.length - 1)));
          return next;
        });
        break;
      case 'movement':
        setMovementSections(prev => {
          const next = prev.filter((_, i) => i !== index);
          setActiveMovementIndex(ai => Math.min(ai, Math.max(0, next.length - 1)));
          return next;
        });
        break;
      case 'image': setImageSections(prev => prev.filter((_, i) => i !== index)); break;
      case 'video': setVideoSections(prev => prev.filter((_, i) => i !== index)); break;
      case 'audio': setAudioSections(prev => prev.filter((_, i) => i !== index)); break;
      case 'feasibility': setFeasibilitySections(prev => prev.filter((_, i) => i !== index)); break;
      case 'model_analysis': setModelSections(prev => prev.filter((_, i) => i !== index)); break;
      case 'cephalometric': setCephSections(prev => prev.filter((_, i) => i !== index)); break;
    }
    toast.success('Section removed');
  }, []);

  const updateSectionCaption = (type: string, index: number, caption: string) => {
    const updater = (prev: SectionItem[]) => prev.map((s, i) => i === index ? { ...s, caption } : s);
    switch (type) {
      case 'ipr': setIprSections(updater); break;
      case 'movement': setMovementSections(updater); break;
      case 'image': setImageSections(updater); break;
      case 'video': setVideoSections(updater); break;
      case 'audio': setAudioSections(updater); break;
      case 'feasibility': setFeasibilitySections(updater); break;
      case 'model_analysis': setModelSections(updater); break;
      case 'cephalometric': setCephSections(updater); break;
    }
  };

  const startEditName = (key: string, currentName: string) => { setEditingSectionName(key); setEditNameValue(currentName); };
  const finishEditName = (type: string, index: number) => { if (editNameValue.trim()) updateSectionCaption(type, index, editNameValue.trim()); setEditingSectionName(null); };

  // IPR contact selection for stage assignment
  const handleContactToggle = useCallback((contactKey: string, event: React.MouseEvent) => {
    setSelectedIPRContacts(prev => {
      const next = new Set(prev);
      if (event.ctrlKey || event.metaKey) {
        if (next.has(contactKey)) next.delete(contactKey);
        else next.add(contactKey);
      } else if (event.shiftKey && lastSelectedContact.current) {
        const activeIpr = iprSections[activeIprIndex]?.data_json as IPRData | null;
        if (activeIpr) {
          const allKeys = getAllContactKeys(activeIpr);
          const startIdx = allKeys.indexOf(lastSelectedContact.current);
          const endIdx = allKeys.indexOf(contactKey);
          if (startIdx >= 0 && endIdx >= 0) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let i = from; i <= to; i++) next.add(allKeys[i]);
          }
        }
      } else {
        if (next.has(contactKey) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(contactKey);
        }
      }
      lastSelectedContact.current = contactKey;
      return next;
    });
  }, [iprSections, activeIprIndex]);

  // Assign selected contacts to a stage
  const assignSelectedToStage = useCallback(() => {
    if (!assignStageName.trim() || selectedIPRContacts.size === 0 || !iprSections[activeIprIndex]) return;

    const updated = [...iprSections];
    const section = { ...updated[activeIprIndex] };
    const data = JSON.parse(JSON.stringify(section.data_json)) as IPRData;

    for (const arch of ['maxilla', 'mandible'] as const) {
      if (!data[arch]) continue;
      const totalStep = data[arch].steps?.find(s => s.step.toLowerCase() === 'total');
      if (!totalStep) continue;

      const newStepValues: Record<string, number | null> = {};
      selectedIPRContacts.forEach(key => {
        const [contactArch] = key.split(':');
        if (contactArch !== arch) return;
        const teeth = key.split(':')[1].split('-');
        const t1 = teeth[0], t2 = teeth[1];
        [`${t1}m`, `${t1}d`, `${t2}m`, `${t2}d`].forEach(k => {
          if (totalStep.values[k] != null && totalStep.values[k]! > 0) {
            newStepValues[k] = totalStep.values[k];
          }
        });
      });

      if (Object.keys(newStepValues).length > 0) {
        const existingIdx = data[arch].steps.findIndex(s => s.step === assignStageName.trim());
        if (existingIdx >= 0) {
          Object.assign(data[arch].steps[existingIdx].values, newStepValues);
        } else {
          const totalIdx = data[arch].steps.findIndex(s => s.step.toLowerCase() === 'total');
          const newStep = { step: assignStageName.trim(), values: newStepValues };
          if (totalIdx >= 0) {
            data[arch].steps.splice(totalIdx, 0, newStep);
          } else {
            data[arch].steps.push(newStep);
          }
        }
      }
    }

    section.data_json = data;
    updated[activeIprIndex] = section;
    setIprSections(updated);
    setSelectedIPRContacts(new Set());
    setAssignStageName('');
    setIprSelectMode(false);
    toast.success(`Stage "${assignStageName.trim()}" assigned to ${selectedIPRContacts.size} contact(s)`);
  }, [assignStageName, selectedIPRContacts, iprSections, activeIprIndex]);

  // Remove IPR stage
  const removeIPRStage = (stageIndex: number) => {
    if (!iprSections[activeIprIndex]) return;
    const updated = [...iprSections];
    const section = { ...updated[activeIprIndex] };
    const data = JSON.parse(JSON.stringify(section.data_json)) as IPRData;

    (['maxilla', 'mandible'] as const).forEach(arch => {
      if (data[arch]?.steps) {
        data[arch].steps = data[arch].steps.filter((_, i) => i !== stageIndex);
      }
    });

    section.data_json = data;
    updated[activeIprIndex] = section;
    setIprSections(updated);
    toast.success('Stage removed');
  };

  // Feasibility field editing - stable callback
  const updateFeasibilityField = useCallback((index: number, field: string, value: string) => {
    setFeasibilitySections(prev => prev.map((s, i) => {
      if (i !== index) return s;
      return { ...s, data_json: { ...s.data_json, [field]: value } };
    }));
  }, []);

  const addEmptyFeasibility = () => {
    setFeasibilitySections(prev => [...prev, {
      section_type: 'feasibility',
      data_json: {
        complexity: '', extractionType: '', upperAlignersCount: '', lowerAlignersCount: '',
        upperOvercorrectionStages: '', lowerOvercorrectionStages: '',
        upperArch: '', lowerArch: '', iprUpper: '', iprLower: '',
        attachmentUpper: '', attachmentLower: '', notes: '',
      },
      file_url: null, caption: 'Feasibility Report', sort_order: prev.length,
    }]);
    setOpenSections(prev => ({ ...prev, feasibility: true }));
  };

  // Model analysis field editing
  const updateModelField = useCallback((sectionIdx: number, discIdx: number, field: string, value: string) => {
    setModelSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const data = { ...s.data_json };
      if (field === 'anteriorValue') { data.anteriorRatio = { ...data.anteriorRatio, value }; }
      else if (field === 'anteriorDiff') { data.anteriorRatio = { ...data.anteriorRatio, diff: value }; }
      else if (field === 'overallValue') { data.overallRatio = { ...data.overallRatio, value }; }
      else if (field === 'overallDiff') { data.overallRatio = { ...data.overallRatio, diff: value }; }
      else {
        const discs = [...(data.discrepancies || [])];
        discs[discIdx] = { ...discs[discIdx], [field]: value };
        data.discrepancies = discs;
      }
      return { ...s, data_json: data };
    }));
  }, []);

  // Ceph field editing
  const updateCephField = useCallback((sectionIdx: number, category: string, rowIdx: number, field: string, value: string) => {
    setCephSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const data = { ...s.data_json };
      const items = [...(data[category] || [])];
      items[rowIdx] = { ...items[rowIdx], [field]: value };
      data[category] = items;
      return { ...s, data_json: data };
    }));
  }, []);

  const addCephRow = useCallback((sectionIdx: number, category: string) => {
    setCephSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const data = { ...s.data_json };
      const items = [...(data[category] || [])];
      items.push({ parameter: '', norm: '', computed: '', inference: '' });
      data[category] = items;
      return { ...s, data_json: data };
    }));
  }, []);

  const addModelRow = useCallback((sectionIdx: number) => {
    setModelSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const data = { ...s.data_json };
      const discs = [...(data.discrepancies || [])];
      discs.push({ description: '', norm: '', value: '', diff: '' });
      data.discrepancies = discs;
      return { ...s, data_json: data };
    }));
  }, []);

  const activeIpr = iprSections[activeIprIndex]?.data_json as IPRData | null;
  const activeMovement = movementSections[activeMovementIndex]?.data_json as ToothMovementData | null;

  const goBack = () => {
    if (phaseId) {
      supabase.from('phases').select('patient_id').eq('id', phaseId).single().then(({ data }) => {
        if (data) navigate(`/patient/${data.patient_id}`); else navigate('/');
      });
    } else navigate('/');
  };

  const renderSectionTab = (type: string, sections: SectionItem[], index: number, activeIndex: number, setActive: (i: number) => void) => {
    const key = `${type}-${index}`;
    const name = sections[index]?.caption || `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`;

    if (editingSectionName === key) {
      return (
        <div key={key} className="inline-flex items-center gap-1">
          <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="h-7 w-28 text-xs px-1.5" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') finishEditName(type, index); if (e.key === 'Escape') setEditingSectionName(null); }}
            onBlur={() => setTimeout(() => finishEditName(type, index), 150)} />
        </div>
      );
    }

    return (
      <div key={key} className="inline-flex items-center gap-0.5">
        <Button size="sm" variant={index === activeIndex ? 'default' : 'outline'} onClick={() => setActive(index)} className="gap-1 pr-1">
          <span className="text-xs">{name}</span>
          <Pencil className="w-2.5 h-2.5 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); startEditName(key, name); }} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeSection(type, index); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  const SectionHeader: React.FC<{ sectionKey: string; icon: React.ReactNode; title: string; count?: number; children?: React.ReactNode }> = ({ sectionKey, icon, title, count, children }) => (
    <CollapsibleTrigger asChild onClick={() => toggleSection(sectionKey)}>
      <div className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors group">
        <div className="flex items-center gap-2.5">
          {openSections[sectionKey] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {count !== undefined && count > 0 && <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </CollapsibleTrigger>
  );

  const totalSections = feasibilitySections.length + iprSections.length + movementSections.length + imageSections.length + videoSections.length + audioSections.length + modelSections.length + cephSections.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-4 h-4" /></Button>
            <SnaponLogo size={24} showText={false} />
            <span className="font-semibold text-sm">{isNew ? 'New Plan' : planName}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && !isNew && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            )}
            {isEditing && (
              <>
                {!isNew && (
                  <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); if (id) loadPlan(id); }}>
                    Cancel
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={savePlan} disabled={saving}>
                  <Save className="w-3 h-3 mr-1" /> Save
                </Button>
                <Button size="sm" onClick={publishPlan} className="dental-gradient" disabled={saving || !planName}>
                  <Eye className="w-3 h-3 mr-1" /> Publish
                </Button>
                {isAdmin && planStatus === 'published' && (
                  <Button variant="outline" size="sm" className="text-orange-600 border-orange-300" onClick={() => {
                    if (confirm('Unpublish this plan? The public share link will stop working.')) unpublishPlan();
                  }}>
                    <Undo2 className="w-3 h-3 mr-1" /> Unpublish
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        {/* Read-only banner */}
        {!isEditing && !isNew && (
          <Card className="bg-muted/50 border-border/50">
            <CardContent className="p-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                This plan is in <Badge variant="outline" className="mx-1">{planStatus}</Badge> mode. Click <strong>Edit</strong> to make changes.
              </p>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Bar */}
        {isEditing && (
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="cursor-pointer flex-1 w-full">
                  <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-opacity ${uploadingPdf ? 'opacity-60' : 'hover:opacity-90'}`}>
                    <FileText className="w-4 h-4" />
                    {uploadingPdf ? 'Analyzing PDF...' : 'Upload Report PDF'}
                  </div>
                  <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />Combined CSV</Badge>
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCombinedCSVUpload} />
                  </label>
                  <span className="text-xs text-muted-foreground">or upload individual CSVs below</span>
                </div>
              </div>
              {uploadingPdf && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  AI is analyzing your PDF for feasibility, IPR, and movement data...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Info */}
        <Collapsible open={openSections.info}>
          <Card>
            <SectionHeader sectionKey="info" icon={<FileText className="w-4 h-4 text-primary" />} title="Plan Information" />
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name *</Label>
                    <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Treatment Plan 1" disabled={!isEditing} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} disabled={!isEditing} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Treatment plan notes..." rows={3} disabled={!isEditing} />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Feasibility */}
        <Collapsible open={openSections.feasibility}>
          <Card>
            <SectionHeader sectionKey="feasibility" icon={<span className="w-4 h-4 rounded-full bg-chart-2 flex items-center justify-center text-[8px] text-primary-foreground font-bold">F</span>} title="Feasibility" count={feasibilitySections.length}>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={e => { e.stopPropagation(); addEmptyFeasibility(); }}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {feasibilitySections.map((fs, idx) => {
                  const data = fs.data_json || {};
                  const onChange = (field: string, value: string) => updateFeasibilityField(idx, field, value);
                  return (
                    <div key={idx} className="p-4 rounded-lg border border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{fs.caption || 'Feasibility Report'}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection('feasibility', idx)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <FeasibilityField label="Complexity" field="complexity" value={data.complexity} onChange={onChange} type="select" options={['Mild', 'Moderate', 'Severe']} />
                        <FeasibilityField label="Extraction" field="extractionType" value={data.extractionType} onChange={onChange} type="select" options={['EXTRACTION', 'NON-EXTRACTION']} />
                      </div>
                      <div className="p-3 rounded-md bg-muted/30 space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upper Arch</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FeasibilityField label="Feasibility" field="upperArch" value={data.upperArch} onChange={onChange} type="select" options={['FEASIBLE', 'NOT FEASIBLE']} />
                          <FeasibilityField label="Stages" field="upperAlignersCount" value={data.upperAlignersCount} onChange={onChange} />
                          <FeasibilityField label="O/C Stages" field="upperOvercorrectionStages" value={data.upperOvercorrectionStages} onChange={onChange} />
                          <FeasibilityField label="IPR" field="iprUpper" value={data.iprUpper} onChange={onChange} type="select" options={['YES', 'NO']} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FeasibilityField label="Attachment" field="attachmentUpper" value={data.attachmentUpper} onChange={onChange} type="select" options={['YES', 'NO']} />
                        </div>
                      </div>
                      <div className="p-3 rounded-md bg-muted/30 space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lower Arch</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FeasibilityField label="Feasibility" field="lowerArch" value={data.lowerArch} onChange={onChange} type="select" options={['FEASIBLE', 'NOT FEASIBLE']} />
                          <FeasibilityField label="Stages" field="lowerAlignersCount" value={data.lowerAlignersCount} onChange={onChange} />
                          <FeasibilityField label="O/C Stages" field="lowerOvercorrectionStages" value={data.lowerOvercorrectionStages} onChange={onChange} />
                          <FeasibilityField label="IPR" field="iprLower" value={data.iprLower} onChange={onChange} type="select" options={['YES', 'NO']} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <FeasibilityField label="Attachment" field="attachmentLower" value={data.attachmentLower} onChange={onChange} type="select" options={['YES', 'NO']} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Notes</Label>
                        <Textarea value={data.notes || ''} onChange={e => updateFeasibilityField(idx, 'notes', e.target.value)} className="text-xs min-h-[60px]" placeholder="Additional notes..." />
                      </div>
                    </div>
                  );
                })}
                {feasibilitySections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Upload a PDF report or add manually</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* IPR */}
        <Collapsible open={openSections.ipr}>
          <Card>
            <SectionHeader sectionKey="ipr" icon={<span className="w-4 h-4 rounded-full bg-chart-1 flex items-center justify-center text-[8px] text-primary-foreground font-bold">I</span>} title="IPR Data" count={iprSections.length}>
              <label className="cursor-pointer">
                <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />CSV</Badge>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleIPRUpload} />
              </label>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {iprSections.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {iprSections.map((_, i) => renderSectionTab('ipr', iprSections, i, activeIprIndex, setActiveIprIndex))}
                  </div>
                )}
                {activeIpr && (
                  <>
                    <IPRQuadrantDiagram
                      iprData={activeIpr}
                      editable={iprSelectMode}
                      selectedContacts={selectedIPRContacts}
                      onContactToggle={handleContactToggle}
                    />
                    <div className="border-t border-border/30 pt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Stages: {(activeIpr.maxilla?.steps || activeIpr.mandible?.steps || []).filter(s => s.step.toLowerCase() !== 'total').length}
                        </span>
                        <Button
                          size="sm"
                          variant={iprSelectMode ? 'default' : 'outline'}
                          className="h-7 text-[10px] gap-1"
                          onClick={() => {
                            setIprSelectMode(!iprSelectMode);
                            if (iprSelectMode) {
                              setSelectedIPRContacts(new Set());
                              setAssignStageName('');
                            }
                          }}
                        >
                          <MousePointerClick className="w-3 h-3" />
                          {iprSelectMode ? 'Cancel Selection' : 'Select & Assign Stages'}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(activeIpr.maxilla?.steps || activeIpr.mandible?.steps || []).map((step, si) => (
                          <Badge key={si} variant={step.step.toLowerCase() === 'total' ? 'secondary' : 'outline'} className="gap-1 pr-1 text-[10px]">
                            {step.step}
                            {step.step.toLowerCase() !== 'total' && (
                              <button onClick={() => removeIPRStage(si)} className="ml-0.5 hover:text-destructive">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                      {iprSelectMode && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                          <p className="text-[11px] text-muted-foreground">
                            <strong>Click</strong> contacts to select • <strong>Ctrl+Click</strong> for multiple • <strong>Shift+Click</strong> for range
                          </p>
                          {selectedIPRContacts.size > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {Array.from(selectedIPRContacts).map(k => (
                                <Badge key={k} variant="default" className="text-[9px]">{k.split(':')[1]}</Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="Stage name (e.g. Before Step 3)"
                              value={assignStageName}
                              onChange={e => setAssignStageName(e.target.value)}
                              className="h-8 text-xs flex-1"
                              onKeyDown={e => e.key === 'Enter' && assignSelectedToStage()}
                            />
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              onClick={assignSelectedToStage}
                              disabled={!assignStageName.trim() || selectedIPRContacts.size === 0}
                            >
                              Assign Stage ({selectedIPRContacts.size})
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {iprSections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Upload a PDF report or IPR CSV to populate this section</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Movement */}
        <Collapsible open={openSections.movement}>
          <Card>
            <SectionHeader sectionKey="movement" icon={<span className="w-4 h-4 rounded-full bg-chart-3 flex items-center justify-center text-[8px] text-primary-foreground font-bold">M</span>} title="Tooth Movement" count={movementSections.length}>
              <label className="cursor-pointer">
                <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />CSV</Badge>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleMovementUpload} />
              </label>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {movementSections.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {movementSections.map((_, i) => renderSectionTab('movement', movementSections, i, activeMovementIndex, setActiveMovementIndex))}
                  </div>
                )}
                {activeMovement && <ToothMovementChart data={activeMovement} />}
                {movementSections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Upload a PDF report or Movement CSV to populate this section</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Model Analysis */}
        <Collapsible open={openSections.model}>
          <Card>
            <SectionHeader sectionKey="model" icon={<FlaskConical className="w-4 h-4 text-chart-4" />} title="Model Analysis" count={modelSections.length}>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={e => { e.stopPropagation(); addEmptyModelAnalysis(); }}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {modelSections.map((ms, idx) => {
                  const data = ms.data_json || {};
                  return (
                    <div key={idx} className="p-4 rounded-lg border border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{ms.caption || 'Model Analysis'}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection('model_analysis', idx)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      {/* Discrepancy table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1 px-2 text-muted-foreground font-medium">Description</th>
                              <th className="text-center py-1 px-2 text-muted-foreground font-medium w-20">Norm</th>
                              <th className="text-center py-1 px-2 text-muted-foreground font-medium w-20">Value</th>
                              <th className="text-center py-1 px-2 text-muted-foreground font-medium w-20">Diff</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.discrepancies || []).map((d: any, di: number) => (
                              <tr key={di} className="border-b border-border/20">
                                <td className="py-1 px-2"><Input value={d.description || ''} onChange={e => updateModelField(idx, di, 'description', e.target.value)} className="h-7 text-xs border-0 p-0 shadow-none" /></td>
                                <td className="py-1 px-2"><Input value={d.norm || ''} onChange={e => updateModelField(idx, di, 'norm', e.target.value)} className="h-7 text-xs text-center border-0 p-0 shadow-none" /></td>
                                <td className="py-1 px-2"><Input value={d.value || ''} onChange={e => updateModelField(idx, di, 'value', e.target.value)} className="h-7 text-xs text-center border-0 p-0 shadow-none" /></td>
                                <td className="py-1 px-2"><Input value={d.diff || ''} onChange={e => updateModelField(idx, di, 'diff', e.target.value)} className="h-7 text-xs text-center border-0 p-0 shadow-none" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] mt-1" onClick={() => addModelRow(idx)}><Plus className="w-2.5 h-2.5 mr-1" /> Add Row</Button>
                      </div>
                      {/* Bolton Ratios */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Anterior Ratio (norm: {data.anteriorRatio?.norm || '77.2±0.2%'})</Label>
                          <div className="flex gap-2">
                            <Input placeholder="Value" value={data.anteriorRatio?.value || ''} onChange={e => updateModelField(idx, 0, 'anteriorValue', e.target.value)} className="h-7 text-xs" />
                            <Input placeholder="Diff" value={data.anteriorRatio?.diff || ''} onChange={e => updateModelField(idx, 0, 'anteriorDiff', e.target.value)} className="h-7 text-xs w-20" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Overall Ratio (norm: {data.overallRatio?.norm || '91.3±0.3%'})</Label>
                          <div className="flex gap-2">
                            <Input placeholder="Value" value={data.overallRatio?.value || ''} onChange={e => updateModelField(idx, 0, 'overallValue', e.target.value)} className="h-7 text-xs" />
                            <Input placeholder="Diff" value={data.overallRatio?.diff || ''} onChange={e => updateModelField(idx, 0, 'overallDiff', e.target.value)} className="h-7 text-xs w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {modelSections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Add model analysis data manually or via PDF upload</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Cephalometric */}
        <Collapsible open={openSections.ceph}>
          <Card>
            <SectionHeader sectionKey="ceph" icon={<Scan className="w-4 h-4 text-chart-5" />} title="Cephalometric Analysis" count={cephSections.length}>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={e => { e.stopPropagation(); addEmptyCephalometric(); }}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {cephSections.map((cs, idx) => {
                  const data = cs.data_json || {};
                  return (
                    <div key={idx} className="p-4 rounded-lg border border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{cs.caption || 'Cephalometric Analysis'}</span>
                        <div className="flex items-center gap-1">
                          <label className="cursor-pointer">
                            <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />HTML</Badge>
                            <input type="file" accept=".html,.htm" className="hidden" onChange={e => handleCephHtmlUpload(e, idx)} />
                          </label>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection('cephalometric', idx)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>

                      {/* SVG Preview */}
                      {data.cephSvg && (
                        <div className="flex justify-center border border-border/30 rounded-lg p-2 bg-card max-h-64 overflow-auto">
                          <div dangerouslySetInnerHTML={{ __html: data.cephSvg }} className="max-w-full [&_svg]:max-w-full [&_svg]:h-auto" />
                        </div>
                      )}

                      {/* Analysis tables */}
                      {(['skeletal', 'dental', 'softTissue'] as const).map(category => {
                        const items = data[category] || [];
                        const label = category === 'softTissue' ? 'Soft Tissue' : category.charAt(0).toUpperCase() + category.slice(1);
                        return (
                          <div key={category} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label} Analysis</span>
                              <Button variant="ghost" size="sm" className="h-5 text-[9px]" onClick={() => addCephRow(idx, category)}><Plus className="w-2.5 h-2.5 mr-0.5" />Row</Button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1 px-2 text-muted-foreground font-medium">Parameter</th>
                                    <th className="text-center py-1 px-2 text-muted-foreground font-medium w-20">Norm</th>
                                    <th className="text-center py-1 px-2 text-muted-foreground font-medium w-20">Value</th>
                                    <th className="text-left py-1 px-2 text-muted-foreground font-medium">Inference</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item: any, ri: number) => (
                                    <tr key={ri} className="border-b border-border/20">
                                      <td className="py-1 px-2"><Input value={item.parameter || ''} onChange={e => updateCephField(idx, category, ri, 'parameter', e.target.value)} className="h-7 text-xs border-0 p-0 shadow-none" /></td>
                                      <td className="py-1 px-2"><Input value={item.norm || ''} onChange={e => updateCephField(idx, category, ri, 'norm', e.target.value)} className="h-7 text-xs text-center border-0 p-0 shadow-none" /></td>
                                      <td className="py-1 px-2"><Input value={item.computed || ''} onChange={e => updateCephField(idx, category, ri, 'computed', e.target.value)} className="h-7 text-xs text-center border-0 p-0 shadow-none" /></td>
                                      <td className="py-1 px-2"><Input value={item.inference || ''} onChange={e => updateCephField(idx, category, ri, 'inference', e.target.value)} className="h-7 text-xs border-0 p-0 shadow-none" /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {cephSections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Add cephalometric analysis manually or upload HTML file</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Images */}
        <Collapsible open={openSections.images}>
          <Card>
            <SectionHeader sectionKey="images" icon={<Image className="w-4 h-4 text-chart-4" />} title="Images" count={imageSections.length}>
              <label className="cursor-pointer">
                <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />Upload</Badge>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {imageSections.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imageSections.map((img, i) => (
                      <div key={i} className="relative group">
                        {img.file_url && <img src={img.file_url} alt={img.caption} className="w-full rounded-lg border border-border object-cover aspect-square" />}
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSection('image', i)}><Trash2 className="w-3 h-3" /></Button>
                        <Input value={img.caption} onChange={e => updateSectionCaption('image', i, e.target.value)} placeholder="Caption" className="text-xs h-7 mt-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 p-6 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors">
                    <Image className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Click to upload images</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Videos */}
        <Collapsible open={openSections.videos}>
          <Card>
            <SectionHeader sectionKey="videos" icon={<Video className="w-4 h-4 text-chart-5" />} title="Videos" count={videoSections.length}>
              <label className="cursor-pointer">
                <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />Upload</Badge>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {videoSections.map((v, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      {editingSectionName === `video-${i}` ? (
                        <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="h-6 w-32 text-xs" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') finishEditName('video', i); }}
                          onBlur={() => setTimeout(() => finishEditName('video', i), 150)} />
                      ) : (
                        <span className="text-sm font-medium flex items-center gap-1">
                          {v.caption || `Video ${i + 1}`}
                          <Pencil className="w-3 h-3 opacity-40 hover:opacity-100 cursor-pointer" onClick={() => startEditName(`video-${i}`, v.caption || `Video ${i + 1}`)} />
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection('video', i)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    {v.file_url && <video src={v.file_url} controls className="w-full rounded-lg border border-border" />}
                  </div>
                ))}
                {videoSections.length === 0 && (
                  <label className="cursor-pointer flex flex-col items-center gap-2 p-6 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors">
                    <Video className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Click to upload video</span>
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  </label>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Audio */}
        <Collapsible open={openSections.audio}>
          <Card>
            <SectionHeader sectionKey="audio" icon={<Mic className="w-4 h-4 text-chart-2" />} title="Audio Notes" count={audioSections.length}>
              <label className="cursor-pointer">
                <Badge variant="outline" className="cursor-pointer text-[10px] hover:bg-accent"><Upload className="w-3 h-3 mr-1" />File</Badge>
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFileUpload} />
              </label>
            </SectionHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <AudioRecorder onRecorded={handleAudioRecorded} />
                {audioSections.map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      {editingSectionName === `audio-${i}` ? (
                        <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="h-6 w-32 text-xs" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') finishEditName('audio', i); }}
                          onBlur={() => setTimeout(() => finishEditName('audio', i), 150)} />
                      ) : (
                        <span className="text-sm font-medium flex items-center gap-1">
                          {a.caption || `Audio ${i + 1}`}
                          <Pencil className="w-3 h-3 opacity-40 hover:opacity-100 cursor-pointer" onClick={() => startEditName(`audio-${i}`, a.caption || `Audio ${i + 1}`)} />
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection('audio', i)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    {a.file_url && <audio src={a.file_url} controls className="w-full" />}
                    {a.data_json?.transcription && (
                      <div className="p-2 bg-muted/50 rounded-lg text-xs">{a.data_json.transcription}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Summary footer */}
        {totalSections > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {feasibilitySections.length > 0 && <Badge variant="secondary">✓ Feasibility</Badge>}
            {iprSections.length > 0 && <Badge variant="secondary">✓ {iprSections.length} IPR</Badge>}
            {movementSections.length > 0 && <Badge variant="secondary">✓ {movementSections.length} Movement</Badge>}
            {modelSections.length > 0 && <Badge variant="secondary">✓ Model Analysis</Badge>}
            {cephSections.length > 0 && <Badge variant="secondary">✓ Cephalometric</Badge>}
            {imageSections.length > 0 && <Badge variant="secondary">✓ {imageSections.length} Images</Badge>}
            {videoSections.length > 0 && <Badge variant="secondary">✓ {videoSections.length} Videos</Badge>}
            {audioSections.length > 0 && <Badge variant="secondary">✓ {audioSections.length} Audio</Badge>}
          </div>
        )}
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 flex items-center justify-between z-20">
        <span className="text-xs text-muted-foreground">{totalSections} section{totalSections !== 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={savePlan} disabled={saving}>
            <Save className="w-3 h-3 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" onClick={publishPlan} className="dental-gradient" disabled={saving || !planName}>
            <Eye className="w-3 h-3 mr-1" /> Publish
          </Button>
          {isAdmin && planStatus === 'published' && (
            <Button variant="outline" size="sm" className="text-orange-600 border-orange-300" onClick={() => {
              if (confirm('Unpublish this plan? The public share link will stop working.')) unpublishPlan();
            }}>
              <Undo2 className="w-3 h-3 mr-1" /> Unpublish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
