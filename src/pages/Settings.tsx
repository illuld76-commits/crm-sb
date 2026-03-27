import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Plus, Trash2, Edit, ChevronDown, Search, Save, X, Building2, User, Phone, Mail, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import SnaponLogo from '@/components/SnaponLogo';
import ThemeToggle from '@/components/ThemeToggle';

interface Entity {
  id: string;
  entity_name: string;
  entity_type: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst_number?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
}

const emptyForm = (): Omit<Entity, 'id' | 'entity_type'> => ({
  entity_name: '', contact_person: '', email: '', phone: '', address: '', gst_number: '', city: '', state: '', country: '', notes: ''
});

export default function Settings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('doctor');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit form
  const [formData, setFormData] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/');
  }, [isAdmin, roleLoading]);

  useEffect(() => { fetchEntities(); }, []);

  const fetchEntities = async () => {
    const { data, error } = await supabase.from('settings_entities').select('*').eq('is_deleted', false).order('entity_name');
    if (error) { toast.error('Failed to load entities'); console.error(error); }
    setEntities(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const saveEntity = async () => {
    if (!formData.entity_name.trim() || !user) return;
    const payload = {
      entity_name: formData.entity_name.trim(),
      entity_type: activeTab,
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      gst_number: formData.gst_number || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      notes: formData.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from('settings_entities').update(payload).eq('id', editingId);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Updated');
    } else {
      const { error } = await supabase.from('settings_entities').insert(payload);
      if (error) { toast.error('Failed to add'); return; }
      toast.success('Added');
    }
    resetForm();
    fetchEntities();
  };

  const startEdit = (entity: Entity) => {
    setFormData({
      entity_name: entity.entity_name,
      contact_person: entity.contact_person || '',
      email: entity.email || '',
      phone: entity.phone || '',
      address: entity.address || '',
      gst_number: entity.gst_number || '',
      city: entity.city || '',
      state: entity.state || '',
      country: entity.country || '',
      notes: entity.notes || '',
    });
    setEditingId(entity.id);
    setShowForm(true);
  };

  const deleteEntity = async (id: string) => {
    const { error } = await supabase.from('settings_entities').update({ is_deleted: true }).eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setEntities(prev => prev.filter(e => e.id !== id));
    toast.success('Deleted');
  };

  const filtered = entities.filter(e =>
    e.entity_type === activeTab &&
    (searchQuery === '' || e.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (e.contact_person || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
     (e.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderForm = () => (
    <Card className="p-4 space-y-4 border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{editingId ? 'Edit Contact' : `Add New ${activeTab}`}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}><X className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Name *</Label>
          <Input placeholder={`${activeTab} name`} value={formData.entity_name} onChange={e => setFormData(p => ({ ...p, entity_name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact Person</Label>
          <Input placeholder="Contact person" value={formData.contact_person || ''} onChange={e => setFormData(p => ({ ...p, contact_person: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" placeholder="email@example.com" value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input placeholder="+1 234 567 890" value={formData.phone || ''} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Textarea placeholder="Street address..." rows={2} value={formData.address || ''} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input placeholder="City" value={formData.city || ''} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">State</Label>
          <Input placeholder="State/Province" value={formData.state || ''} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Input placeholder="Country" value={formData.country || ''} onChange={e => setFormData(p => ({ ...p, country: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">GST / Tax Number</Label>
          <Input placeholder="GST/Tax ID" value={formData.gst_number || ''} onChange={e => setFormData(p => ({ ...p, gst_number: e.target.value }))} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea placeholder="Additional notes..." rows={2} value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={saveEntity} disabled={!formData.entity_name.trim()} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {editingId ? 'Update' : 'Add'}
        </Button>
        <Button variant="ghost" onClick={resetForm}>Cancel</Button>
      </div>
    </Card>
  );

  const renderEntityCard = (entity: Entity) => {
    const isExpanded = expandedId === entity.id;
    const hasDetails = entity.contact_person || entity.email || entity.phone || entity.address || entity.city || entity.gst_number;

    return (
      <Collapsible key={entity.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : entity.id)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
            <div className="min-w-0">
              <span className="text-sm font-medium block truncate">{entity.entity_name}</span>
              {entity.contact_person && <span className="text-[11px] text-muted-foreground">{entity.contact_person}</span>}
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1 shrink-0">
            {entity.email && <Mail className="w-3 h-3 text-muted-foreground" />}
            {entity.phone && <Phone className="w-3 h-3 text-muted-foreground" />}
            {(entity.city || entity.address) && <MapPin className="w-3 h-3 text-muted-foreground" />}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); startEdit(entity); }}>
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteEntity(entity.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          {hasDetails ? (
            <div className="px-4 py-3 bg-muted/30 text-xs space-y-2 border-b border-border">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {entity.email && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{entity.email}</span></div>}
                {entity.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{entity.phone}</span></div>}
                {entity.gst_number && <div><span className="text-muted-foreground">GST:</span> <span className="font-medium">{entity.gst_number}</span></div>}
                {entity.country && <div><span className="text-muted-foreground">Country:</span> <span className="font-medium">{entity.country}</span></div>}
              </div>
              {entity.address && <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{entity.address}{entity.city ? `, ${entity.city}` : ''}{entity.state ? `, ${entity.state}` : ''}</span></div>}
              {entity.notes && <div><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{entity.notes}</span></div>}
            </div>
          ) : (
            <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground border-b border-border">No additional details. Click edit to add contact info.</div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <SnaponLogo size={24} showText={false} />
            <span className="font-semibold text-sm">CRM Contacts</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts & Master Data</h1>
          <p className="text-muted-foreground text-sm">Manage doctors, clinics, labs and companies with full contact details</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetForm(); setSearchQuery(''); }}>
          <TabsList>
            <TabsTrigger value="doctor" className="gap-1"><User className="w-3 h-3" /> Doctors</TabsTrigger>
            <TabsTrigger value="clinic" className="gap-1"><Building2 className="w-3 h-3" /> Clinics</TabsTrigger>
            <TabsTrigger value="lab" className="gap-1"><Building2 className="w-3 h-3" /> Labs</TabsTrigger>
            <TabsTrigger value="company" className="gap-1"><Building2 className="w-3 h-3" /> Companies</TabsTrigger>
          </TabsList>

          {['doctor', 'clinic', 'lab', 'company'].map(type => (
            <TabsContent key={type} value={type} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder={`Search ${type}s...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>

              {showForm && renderForm()}

              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      {searchQuery ? `No ${type}s matching "${searchQuery}"` : `No ${type}s added yet`}
                    </div>
                  ) : (
                    <div>{filtered.map(e => renderEntityCard(e))}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
