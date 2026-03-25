import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, FileText, ImageIcon, Film, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import FilePreviewModal, { PreviewFile } from '@/components/FilePreviewModal';

interface AssetRow {
  id: string;
  case_id: string;
  file_url: string;
  file_type: string;
  category: string;
  original_name?: string;
  is_viewable: boolean;
  is_downloadable: boolean;
  created_at: string;
  file_size?: number;
  patient_name?: string;
}

const CATEGORIES = ['All', 'Photo', 'X-Ray', 'STL', 'Video', 'Document', 'Audio', 'Other'];

export default function GlobalAssets() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    const { data: assetData } = await supabase
      .from('assets')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (assetData) {
      const caseIds = [...new Set(assetData.map(a => a.case_id).filter(Boolean))];
      const { data: patients } = await supabase.from('patients').select('id, patient_name').in('id', caseIds);
      const patientMap: Record<string, string> = {};
      patients?.forEach(p => { patientMap[p.id] = p.patient_name; });

      setAssets(assetData.map(a => ({
        ...a,
        patient_name: patientMap[a.case_id] || 'Unknown',
      })));
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = isAdmin ? assets : assets.filter(a => a.is_viewable);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.original_name || '').toLowerCase().includes(q) ||
        (a.patient_name || '').toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'All') result = result.filter(a => a.category === filterCategory);
    return result;
  }, [assets, search, filterCategory, isAdmin]);

  const toggleBulk = async (field: 'is_viewable' | 'is_downloadable', value: boolean) => {
    const ids = filtered.map(a => a.id);
    if (ids.length === 0) return;
    await supabase.from('assets').update({ [field]: value }).in('id', ids);
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, [field]: value } : a));
    toast.success(`Updated ${ids.length} assets`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Global Assets" />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search files, patients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toggleBulk('is_viewable', true)}>
                <Eye className="w-3 h-3 mr-1" /> All Viewable
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toggleBulk('is_downloadable', true)}>
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
        ) : (
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
                    <span className="text-[10px] text-muted-foreground">{asset.patient_name}</span>
                    <Badge variant="outline" className="text-[9px]">{asset.category}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(asset.created_at), 'MMM d, yyyy')}</p>
                  {isAdmin && (
                    <div className="flex items-center gap-3 pt-1">
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
