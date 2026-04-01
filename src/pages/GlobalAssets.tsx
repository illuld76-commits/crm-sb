import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, FileText, ImageIcon, Film, Eye, EyeOff, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import FilePreviewModal, { PreviewFile } from '@/components/FilePreviewModal';

interface AssetRow {
  id: string;
  file_url: string;
  file_type: string;
  category: string;
  original_name?: string;
  is_viewable: boolean;
  is_downloadable: boolean;
  created_at: string;
  file_size?: number;
  patient_name?: string;
  source: string;
  source_detail?: string;
}

const CATEGORIES = ['All', 'Photo', 'X-Ray', 'STL', 'Video', 'Document', 'Audio', 'Other', 'Plan Section', 'Case Attachment'];

export default function GlobalAssets() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { canAccessPatient, loading: scopeLoading } = useUserScope();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!scopeLoading) fetchAssets();
  }, [scopeLoading]);

  const fetchAssets = async () => {
    const allAssets: AssetRow[] = [];

    // 1. Fetch from assets table
    const { data: assetData } = await supabase
      .from('assets')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (assetData) {
      const caseIds = [...new Set(assetData.map(a => a.case_id).filter(Boolean))];
      let patientMap: Record<string, string> = {};
      let scopedCaseIds = new Set<string>();
      if (caseIds.length > 0) {
        const { data: patients } = await supabase.from('patients').select('id, patient_name, clinic_name, doctor_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id').in('id', caseIds);
        const scopedPatients = isAdmin ? (patients || []) : (patients || []).filter(p => canAccessPatient(p));
        scopedPatients.forEach(p => { patientMap[p.id] = p.patient_name; scopedCaseIds.add(p.id); });
      }
      const scopedAssetData = isAdmin ? assetData : assetData.filter(a => !a.case_id || scopedCaseIds.has(a.case_id));
      scopedAssetData.forEach(a => {
        allAssets.push({
          id: a.id,
          file_url: a.file_url,
          file_type: a.file_type || 'application/octet-stream',
          category: a.category || 'Other',
          original_name: a.original_name || undefined,
          is_viewable: a.is_viewable ?? true,
          is_downloadable: a.is_downloadable ?? true,
          created_at: a.created_at,
          file_size: a.file_size || undefined,
          patient_name: patientMap[a.case_id] || 'Unknown',
          source: 'Asset',
        });
      });
    }

    // 2. Fetch from plan_sections (file_url IS NOT NULL)
    const { data: sections } = await supabase
      .from('plan_sections')
      .select('id, section_type, file_url, created_at, plan_id')
      .not('file_url', 'is', null);

    if (sections && sections.length > 0) {
      const planIds = [...new Set(sections.map(s => s.plan_id))];
      const { data: plans } = await supabase.from('treatment_plans').select('id, plan_name, phase_id').in('id', planIds);
      const phaseIds = [...new Set((plans || []).map(p => p.phase_id))];
      const { data: phases } = phaseIds.length > 0
        ? await supabase.from('phases').select('id, patient_id, phase_name').in('id', phaseIds)
        : { data: [] };
      const patientIds = [...new Set((phases || []).map(p => p.patient_id))];
      const { data: patients } = patientIds.length > 0
        ? await supabase.from('patients').select('id, patient_name, clinic_name, doctor_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id').in('id', patientIds)
        : { data: [] };
      const scopedSectionPatients = isAdmin ? (patients || []) : (patients || []).filter(p => canAccessPatient(p));
      const scopedSectionPatientIds = new Set(scopedSectionPatients.map(p => p.id));

      const planMap: Record<string, any> = {};
      (plans || []).forEach(p => { planMap[p.id] = p; });
      const phaseMap: Record<string, any> = {};
      (phases || []).forEach(p => { phaseMap[p.id] = p; });
      const patMap: Record<string, string> = {};
      scopedSectionPatients.forEach(p => { patMap[p.id] = p.patient_name; });

      sections.forEach(s => {
        if (!s.file_url) return;
        const plan = planMap[s.plan_id];
        const phase = plan ? phaseMap[plan.phase_id] : null;
        // RBAC: skip if patient not in scoped set
        if (phase && !scopedSectionPatientIds.has(phase.patient_id)) return;
        const patName = phase ? patMap[phase.patient_id] : 'Unknown';
        const ext = s.file_url.split('.').pop()?.toLowerCase() || '';
        const ftype = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'image/' + ext
          : ['mp4', 'mov', 'webm'].includes(ext) ? 'video/' + ext
          : ['stl'].includes(ext) ? 'model/stl'
          : ['mp3', 'wav', 'ogg'].includes(ext) ? 'audio/' + ext
          : 'application/octet-stream';

        allAssets.push({
          id: `section-${s.id}`,
          file_url: s.file_url,
          file_type: ftype,
          category: 'Plan Section',
          original_name: `${s.section_type} — ${plan?.plan_name || 'Plan'}`,
          is_viewable: true,
          is_downloadable: true,
          created_at: s.created_at,
          patient_name: patName,
          source: 'Plan',
          source_detail: `${phase?.phase_name || ''} → ${plan?.plan_name || ''}`,
        });
      });
    }

    // 3. Fetch from case_requests (attachments array)
    const { data: caseReqs } = await supabase
      .from('case_requests')
      .select('id, patient_name, request_type, attachments, created_at')
      .eq('is_deleted', false);

    if (caseReqs) {
      caseReqs.forEach(cr => {
        const attachments = cr.attachments as any[];
        if (!Array.isArray(attachments)) return;
        attachments.forEach((att, idx) => {
          if (!att.url) return;
          allAssets.push({
            id: `case-${cr.id}-${idx}`,
            file_url: att.url,
            file_type: att.type || 'application/octet-stream',
            category: 'Case Attachment',
            original_name: att.name || `Attachment ${idx + 1}`,
            is_viewable: true,
            is_downloadable: true,
            created_at: cr.created_at,
            file_size: att.size || undefined,
            patient_name: cr.patient_name,
            source: 'Case Request',
            source_detail: cr.request_type,
          });
        });
      });
    }

    // Sort all by date desc
    allAssets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAssets(allAssets);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = isAdmin ? assets : assets.filter(a => a.is_viewable);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.original_name || '').toLowerCase().includes(q) ||
        (a.patient_name || '').toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.source_detail || '').toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'All') result = result.filter(a => a.category === filterCategory);
    return result;
  }, [assets, search, filterCategory, isAdmin]);

  const sourceBadgeColor = (source: string) => {
    if (source === 'Plan') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (source === 'Case Request') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Global Assets" />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search files, patients, plans..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-none" onClick={() => setViewMode('grid')}><LayoutGrid className="w-3 h-3" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-none" onClick={() => setViewMode('list')}><List className="w-3 h-3" /></Button>
          </div>
          {isAdmin && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={async () => {
                const ids = filtered.filter(a => a.id.startsWith('section-') || a.id.startsWith('case-') ? false : true).map(a => a.id);
                if (ids.length === 0) return;
                await supabase.from('assets').update({ is_viewable: true }).in('id', ids);
                setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_viewable: true } : a));
                toast.success(`Updated ${ids.length} assets`);
              }}>
                <Eye className="w-3 h-3 mr-1" /> All Viewable
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={async () => {
                const ids = filtered.filter(a => !a.id.startsWith('section-') && !a.id.startsWith('case-')).map(a => a.id);
                if (ids.length === 0) return;
                await supabase.from('assets').update({ is_downloadable: true }).in('id', ids);
                setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_downloadable: true } : a));
                toast.success(`Updated ${ids.length} assets`);
              }}>
                <Download className="w-3 h-3 mr-1" /> All DL
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-3">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</p>

        {loading ? (
          <p className="text-center py-10 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No assets found</p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(asset => (
              <Card key={asset.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                <div
                  className="h-40 bg-muted/30 flex items-center justify-center cursor-pointer relative"
                  onClick={() => setPreviewFile({
                    name: asset.original_name || asset.category,
                    url: asset.file_url,
                    type: asset.file_type,
                    size: asset.file_size || 0,
                  })}
                >
                  {asset.file_type.startsWith('image') ? (
                    <img src={asset.file_url} alt={asset.original_name || ''} className="w-full h-full object-cover" />
                  ) : asset.file_type.startsWith('video') ? (
                    <Film className="w-10 h-10 text-muted-foreground" />
                  ) : (
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  )}
                  {!asset.is_viewable && (
                    <Badge variant="destructive" className="absolute top-2 right-2 text-[9px]">
                      <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Hidden
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="text-xs font-medium truncate">{asset.original_name || asset.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{asset.patient_name} (Project)</span>
                    <Badge variant="outline" className="text-[9px]">{asset.category}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge className={`text-[9px] ${sourceBadgeColor(asset.source)}`}>{asset.source}</Badge>
                    {asset.source_detail && <Badge variant="outline" className="text-[9px]">{asset.source_detail}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(asset.created_at), 'MMM d, yyyy')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(asset => (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted/30 rounded flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => setPreviewFile({
                      name: asset.original_name || asset.category,
                      url: asset.file_url,
                      type: asset.file_type,
                      size: asset.file_size || 0,
                    })}>
                    {asset.file_type.startsWith('image') ? (
                      <img src={asset.file_url} alt="" className="w-full h-full object-cover rounded" />
                    ) : asset.file_type.startsWith('video') ? (
                      <Film className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{asset.original_name || asset.category}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{asset.patient_name}</span>
                      <Badge className={`text-[9px] ${sourceBadgeColor(asset.source)}`}>{asset.source}</Badge>
                      {asset.source_detail && <Badge variant="outline" className="text-[9px]">{asset.source_detail}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{format(new Date(asset.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{asset.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
