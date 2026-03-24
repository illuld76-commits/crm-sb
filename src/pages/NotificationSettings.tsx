import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';

interface Template {
  id: string;
  event_type: string;
  title_template: string;
  body_template: string;
  is_email_enabled: boolean;
}

export default function NotificationSettings() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplate, setNewTemplate] = useState({ event_type: '', title_template: '', body_template: '', is_email_enabled: true });

  useEffect(() => {
    supabase.from('notification_templates').select('*').order('event_type').then(({ data }) => {
      setTemplates((data || []) as Template[]);
    });
  }, []);

  const addTemplate = async () => {
    if (!newTemplate.event_type || !newTemplate.title_template) { toast.error('Fill required fields'); return; }
    const { data, error } = await supabase.from('notification_templates').insert(newTemplate).select().single();
    if (!error && data) {
      setTemplates(prev => [...prev, data as Template]);
      setNewTemplate({ event_type: '', title_template: '', body_template: '', is_email_enabled: true });
      toast.success('Template added');
    }
  };

  const updateTemplate = async (id: string, updates: Partial<Template>) => {
    await supabase.from('notification_templates').update(updates).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('notification_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Notification Templates" />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Add Template</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Event Type</Label><Input value={newTemplate.event_type} onChange={e => setNewTemplate(p => ({ ...p, event_type: e.target.value }))} placeholder="e.g. new_case" /></div>
              <div className="space-y-1"><Label className="text-xs">Title Template</Label><Input value={newTemplate.title_template} onChange={e => setNewTemplate(p => ({ ...p, title_template: e.target.value }))} placeholder="New case: {{patient_name}}" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Body Template</Label><Textarea value={newTemplate.body_template} onChange={e => setNewTemplate(p => ({ ...p, body_template: e.target.value }))} rows={2} /></div>
            <Button onClick={addTemplate} size="sm" className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
          </CardContent>
        </Card>

        {templates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">{t.event_type}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span>Email</span>
                    <Switch checked={t.is_email_enabled} onCheckedChange={v => updateTemplate(t.id, { is_email_enabled: v })} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <Input value={t.title_template} onChange={e => updateTemplate(t.id, { title_template: e.target.value })} className="text-xs h-8" />
              <Textarea value={t.body_template} onChange={e => updateTemplate(t.id, { body_template: e.target.value })} className="text-xs" rows={2} />
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
