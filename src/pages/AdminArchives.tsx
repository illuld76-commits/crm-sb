import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

interface ArchiveItem {
  id: string;
  name: string;
  detail: string;
  archived_at: string;
  type: string;
}

export default function AdminArchives() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cases');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveItem | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const results: ArchiveItem[] = [];

    // Archived patients (cases)
    const { data: patients } = await supabase.from('patients').select('id, patient_name, archived_at, doctor_name, clinic_name').not('archived_at', 'is', null);
    (patients || []).forEach(p => results.push({ id: p.id, name: p.patient_name, detail: [p.doctor_name, p.clinic_name].filter(Boolean).join(' • '), archived_at: p.archived_at!, type: 'case' }));

    // Deleted plans
    const { data: plans } = await supabase.from('treatment_plans').select('id, plan_name, updated_at, status').eq('is_deleted', true);
    (plans || []).forEach(p => results.push({ id: p.id, name: p.plan_name, detail: `Status: ${p.status}`, archived_at: p.updated_at, type: 'plan' }));

    // Deleted phases
    const { data: phases } = await supabase.from('phases').select('id, phase_name, updated_at').eq('is_deleted', true);
    (phases || []).forEach(p => results.push({ id: p.id, name: p.phase_name, detail: '', archived_at: p.updated_at, type: 'phase' }));

    // Deleted case requests
    const { data: caseReqs } = await supabase.from('case_requests').select('id, patient_name, updated_at, request_type').eq('is_deleted', true);
    (caseReqs || []).forEach(c => results.push({ id: c.id, name: c.patient_name, detail: c.request_type, archived_at: c.updated_at, type: 'case_request' }));

    // Deleted settings entities
    const { data: entities } = await supabase.from('settings_entities').select('id, entity_name, entity_type, created_at').eq('is_deleted', true);
    (entities || []).forEach(e => results.push({ id: e.id, name: e.entity_name, detail: e.entity_type, archived_at: e.created_at, type: 'entity' }));

    // Deleted invoices
    const { data: invoices } = await supabase.from('invoices').select('id, patient_name, display_id, updated_at, amount_usd').eq('is_deleted', true);
    (invoices || []).forEach(i => results.push({ id: i.id, name: i.patient_name, detail: `${i.display_id || ''} $${i.amount_usd}`, archived_at: i.updated_at, type: 'invoice' }));

    // Deleted assets
    const { data: assets } = await supabase.from('assets').select('id, original_name, category, created_at').eq('is_deleted', true);
    (assets || []).forEach(a => results.push({ id: a.id, name: a.original_name || 'Unnamed', detail: a.category, archived_at: a.created_at, type: 'asset' }));

    setItems(results);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const restore = async (item: ArchiveItem) => {
    let error;
    switch (item.type) {
      case 'case':
        ({ error } = await supabase.from('patients').update({ archived_at: null }).eq('id', item.id));
        break;
      case 'plan':
        ({ error } = await supabase.from('treatment_plans').update({ is_deleted: false }).eq('id', item.id));
        break;
      case 'phase':
        ({ error } = await supabase.from('phases').update({ is_deleted: false }).eq('id', item.id));
        break;
      case 'case_request':
        ({ error } = await supabase.from('case_requests').update({ is_deleted: false }).eq('id', item.id));
        break;
      case 'entity':
        ({ error } = await supabase.from('settings_entities').update({ is_deleted: false }).eq('id', item.id));
        break;
      case 'invoice':
        ({ error } = await supabase.from('invoices').update({ is_deleted: false }).eq('id', item.id));
        break;
      case 'asset':
        ({ error } = await supabase.from('assets').update({ is_deleted: false }).eq('id', item.id));
        break;
    }
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Restored');
    } else {
      toast.error('Failed to restore');
    }
  };

  const permanentDelete = async () => {
    if (!deleteTarget || confirmText.toUpperCase() !== 'DELETE') return;
    let error;
    switch (deleteTarget.type) {
      case 'case': ({ error } = await supabase.from('patients').delete().eq('id', deleteTarget.id)); break;
      case 'plan': ({ error } = await supabase.from('treatment_plans').delete().eq('id', deleteTarget.id)); break;
      case 'phase': ({ error } = await supabase.from('phases').delete().eq('id', deleteTarget.id)); break;
      case 'case_request': ({ error } = await supabase.from('case_requests').delete().eq('id', deleteTarget.id)); break;
      case 'entity': ({ error } = await supabase.from('settings_entities').delete().eq('id', deleteTarget.id)); break;
      case 'invoice': ({ error } = await supabase.from('invoices').delete().eq('id', deleteTarget.id)); break;
      case 'asset': ({ error } = await supabase.from('assets').delete().eq('id', deleteTarget.id)); break;
    }
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      toast.success('Permanently deleted');
    } else {
      toast.error('Failed to delete');
    }
    setDeleteDialogOpen(false);
  };

  const typeLabel: Record<string, string> = {
    case: 'Cases', plan: 'Plans', phase: 'Phases', case_request: 'Case Requests',
    entity: 'Entities', invoice: 'Invoices', asset: 'Assets',
  };

  const tabs = ['cases', 'plans', 'phases', 'case_requests', 'entities', 'invoices', 'assets'];
  const tabTypeMap: Record<string, string> = {
    cases: 'case', plans: 'plan', phases: 'phase', case_requests: 'case_request',
    entities: 'entity', invoices: 'invoice', assets: 'asset',
  };

  const renderItems = (type: string) => {
    const filtered = items.filter(i => i.type === type);
    if (filtered.length === 0) return <p className="text-muted-foreground text-center py-10">No archived {typeLabel[type]?.toLowerCase()}</p>;
    return (
      <div className="space-y-3">
        {filtered.map(item => (
          <Card key={item.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">{item.name}</span>
                <div className="text-xs text-muted-foreground">
                  {item.detail && <span>{item.detail} • </span>}
                  Archived {format(new Date(item.archived_at), 'MMM d, yyyy')}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => restore(item)} title="Restore"><RotateCcw className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setDeleteTarget(item); setConfirmText(''); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Archives" />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">Archived & Deleted Items</h1>
        {loading ? <p className="text-muted-foreground text-center py-10">Loading...</p> : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {tabs.map(tab => (
                <TabsTrigger key={tab} value={tab} className="text-xs">
                  {typeLabel[tabTypeMap[tab]]} ({items.filter(i => i.type === tabTypeMap[tab]).length})
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map(tab => (
              <TabsContent key={tab} value={tab}>
                {renderItems(tabTypeMap[tab])}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. Type DELETE to confirm.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={permanentDelete} disabled={confirmText.toUpperCase() !== 'DELETE'} className="bg-destructive">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
