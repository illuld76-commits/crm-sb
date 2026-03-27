import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ChevronDown, HelpCircle, Mail, Eye, Send, Save } from 'lucide-react';
import ToothChartSelector, { ToothSelection } from '@/components/ToothChartSelector';

interface PresetField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'tooth_chart' | 'ipr_data' | 'tooth_movement' | 'feasibility' | 'images' | 'video' | 'audio' | 'model_analysis' | 'cephalometric' | 'notes';
  options?: string[];
  required: boolean;
  linked_work_order_id?: string;
  linked_plan_preset_id?: string;
  fee?: number;
}

interface PresetRecord {
  id: string;
  name: string;
  fee_usd: number;
  type: string;
  category: string;
  description?: string;
  unit_price?: number;
  unit?: string;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  fields?: PresetField[];
}

interface EmailTemplate {
  id: string;
  name: string;
  trigger_event: string;
  subject: string;
  body: string;
  is_active: boolean;
}

// Dental field templates
const DENTAL_FIELD_TEMPLATES: { label: string; field: Omit<PresetField, 'id'> }[] = [
  { label: 'Arch Selection', field: { label: 'Arch Selection', type: 'radio', options: ['Upper Only', 'Lower Only', 'Both Arches', 'As per plan'], required: true } },
  { label: 'IPR Required', field: { label: 'IPR Required', type: 'radio', options: ['Yes - as per plan', 'No', 'Custom - specify in notes'], required: false } },
  { label: 'Attachment Type', field: { label: 'Attachment Type', type: 'checkbox', options: ['Conventional', 'Optimized', 'Precision Cut', 'Power Ridge', 'None'], required: false } },
  { label: 'Aligner Steps', field: { label: 'Aligner Steps', type: 'text', required: true } },
  { label: 'Pontic Required', field: { label: 'Pontic Required', type: 'radio', options: ['Yes', 'No'], required: false } },
  { label: 'Refinement Stage', field: { label: 'Refinement Stage', type: 'dropdown', options: ['Initial', 'Mid-course Correction', 'Refinement 1', 'Refinement 2', 'Final'], required: false } },
  { label: 'Overcorrection %', field: { label: 'Overcorrection %', type: 'text', required: false } },
  { label: 'Trimming Style', field: { label: 'Trimming Style', type: 'dropdown', options: ['Scalloped', 'Straight Cut', 'Festooned', 'As per protocol'], required: false } },
  { label: 'Material / Thickness', field: { label: 'Material / Thickness', type: 'dropdown', options: ['0.5mm Standard', '0.75mm Medium', '1.0mm Heavy', 'Smart Track equivalent', 'As specified'], required: true } },
  { label: 'Special Instructions', field: { label: 'Special Instructions', type: 'textarea', required: false } },
  { label: 'Bite Ramp Required', field: { label: 'Bite Ramp Required', type: 'radio', options: ['Yes', 'No', 'As per plan'], required: false } },
  { label: 'Extraction Guidance', field: { label: 'Extraction Guidance', type: 'textarea', required: false } },
  { label: 'Composite Attachment Count', field: { label: 'Composite Attachment Count', type: 'text', required: false } },
  { label: 'Engager Count', field: { label: 'Engager Count', type: 'text', required: false } },
  { label: 'Power Arms', field: { label: 'Power Arms', type: 'radio', options: ['Yes', 'No'], required: false } },
  { label: 'Elastics Required', field: { label: 'Elastics Required', type: 'radio', options: ['Yes - Class II', 'Yes - Class III', 'Yes - Cross', 'No'], required: false } },
  { label: 'Auxiliaries', field: { label: 'Auxiliaries', type: 'checkbox', options: ['Buttons', 'Hooks', 'Lingual Attachments', 'Precision Cuts', 'None'], required: false } },
  { label: 'Attachments on Canines', field: { label: 'Attachments on Canines', type: 'radio', options: ['Yes', 'No', 'As needed'], required: false } },
];

const MERGE_VARIABLES = {
  'Patient': [
    { key: '{{patient_name}}', example: 'Rahul Sharma' },
    { key: '{{patient_age}}', example: '28' },
    { key: '{{patient_sex}}', example: 'Male' },
    { key: '{{patient_phone}}', example: '+91 98765 43210' },
  ],
  'Clinic': [
    { key: '{{clinic_name}}', example: 'Smile Dental Clinic' },
    { key: '{{doctor_name}}', example: 'Dr. Priya Iyer' },
    { key: '{{lab_name}}', example: 'Illusion Aligners' },
    { key: '{{support_email}}', example: 'support@clinic.com' },
  ],
  'Case': [
    { key: '{{case_number}}', example: 'WO-2025-0042' },
    { key: '{{case_type}}', example: 'Standard Aligner' },
    { key: '{{case_status}}', example: 'In Progress' },
    { key: '{{case_link}}', example: 'https://app.example.com/case/123' },
    { key: '{{technician_name}}', example: 'Vikram Patel' },
  ],
  'Billing': [
    { key: '{{invoice_number}}', example: 'INV-2025-0018' },
    { key: '{{invoice_amount}}', example: '₹45,000' },
    { key: '{{due_date}}', example: '15 Apr 2025' },
    { key: '{{balance_due}}', example: '₹15,000' },
    { key: '{{payment_amount}}', example: '₹30,000' },
    { key: '{{payment_date}}', example: '10 Apr 2025' },
    { key: '{{payment_method}}', example: 'UPI' },
  ],
  'System': [
    { key: '{{app_name}}', example: 'OrthoReports' },
    { key: '{{app_link}}', example: 'https://orthoreports.lovable.app' },
    { key: '{{current_date}}', example: '24 Mar 2025' },
  ],
};

const TRIGGER_EVENTS = [
  { value: 'case_submitted', label: '📋 Case Submitted', group: 'Case Lifecycle' },
  { value: 'case_accepted', label: '📋 Case Accepted', group: 'Case Lifecycle' },
  { value: 'case_completed', label: '📋 Case Completed', group: 'Case Lifecycle' },
  { value: 'case_on_hold', label: '📋 Case On Hold', group: 'Case Lifecycle' },
  { value: 'invoice_sent', label: '💰 Invoice Sent', group: 'Billing' },
  { value: 'invoice_overdue', label: '💰 Invoice Overdue', group: 'Billing' },
  { value: 'payment_received', label: '💰 Payment Received', group: 'Billing' },
  { value: 'remark_added', label: '💬 Remark Added', group: 'Communication' },
  { value: 'mention', label: '💬 @Mention', group: 'Communication' },
  { value: 'quick_reply', label: '💬 Quick Reply Template', group: 'Communication' },
];

export default function PresetForms() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<PresetRecord[]>([]);
  const [activeTab, setActiveTab] = useState('work_order');
  const [dentalPanelOpen, setDentalPanelOpen] = useState(false);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const [previewToothData, setPreviewToothData] = useState<ToothSelection[]>([]);

  // New preset form state
  const [newName, setNewName] = useState('');
  const [newFee, setNewFee] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newDiscountType, setNewDiscountType] = useState('percentage');
  const [newDiscountValue, setNewDiscountValue] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [newFields, setNewFields] = useState<PresetField[]>([]);

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<Partial<EmailTemplate>>({});
  const [showPreview, setShowPreview] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body');

  useEffect(() => {
    supabase.from('presets').select('*').order('name').then(({ data }) => {
      setPresets((data || []).map((d: any) => ({
        ...d, fields: (d.fields as any as PresetField[]) || [],
      })));
    });
    supabase.from('email_templates').select('*').order('trigger_event').then(({ data }) => {
      setEmailTemplates((data || []) as EmailTemplate[]);
    });
  }, []);

  const resetForm = () => {
    setNewName(''); setNewFee(''); setNewDescription(''); setNewUnitPrice('');
    setNewUnit(''); setNewDiscountValue(''); setNewTaxRate(''); setNewFields([]);
  };

  const addPreset = async () => {
    if (!newName || !user) return;
    const payload: any = {
      name: newName, fee_usd: parseFloat(newFee) || 0, type: 'case',
      category: activeTab, user_id: user.id, description: newDescription || null,
    };
    if (activeTab === 'fee' || activeTab === 'item') {
      payload.unit_price = parseFloat(newUnitPrice) || 0;
      payload.unit = newUnit || null;
    }
    if (activeTab === 'discount') {
      payload.discount_type = newDiscountType;
      payload.discount_value = parseFloat(newDiscountValue) || 0;
    }
    if (activeTab === 'tax') {
      payload.tax_rate = parseFloat(newTaxRate) || 0;
    }
    if (activeTab === 'work_order') {
      payload.fields = newFields as any;
    }
    const { data, error } = await supabase.from('presets').insert(payload).select().single();
    if (!error && data) {
      setPresets(prev => [...prev, { ...data, fields: (data.fields as any) || [] } as PresetRecord]);
      resetForm();
      toast.success('Preset added');
    }
  };

  const deletePreset = async (id: string) => {
    await supabase.from('presets').delete().eq('id', id);
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success('Preset deleted');
  };

  const addField = (template?: Omit<PresetField, 'id'>) => {
    const field: PresetField = template
      ? { ...template, id: crypto.randomUUID() }
      : { id: crypto.randomUUID(), label: '', type: 'text', required: false };
    setNewFields(prev => [...prev, field]);
  };

  const updateField = (idx: number, updates: Partial<PresetField>) => {
    setNewFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeField = (idx: number) => {
    setNewFields(prev => prev.filter((_, i) => i !== idx));
  };

  // Email template handlers
  const selectEmailTemplate = (t: EmailTemplate) => {
    setSelectedTemplate(t);
    setEditTemplate({ ...t });
  };

  const newEmailTemplate = () => {
    setSelectedTemplate(null);
    setEditTemplate({ name: '', trigger_event: 'case_submitted', subject: '', body: '', is_active: true });
  };

  const saveEmailTemplate = async () => {
    if (!editTemplate.name || !editTemplate.trigger_event) { toast.error('Name and trigger required'); return; }
    const payload = {
      name: editTemplate.name!, trigger_event: editTemplate.trigger_event!,
      subject: editTemplate.subject || '', body: editTemplate.body || '',
      is_active: editTemplate.is_active ?? true,
    };
    if (selectedTemplate) {
      const { error } = await supabase.from('email_templates').update(payload).eq('id', selectedTemplate.id);
      if (!error) {
        setEmailTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? { ...t, ...payload } : t));
        toast.success('Template saved');
      }
    } else {
      const { data, error } = await supabase.from('email_templates').insert(payload).select().single();
      if (!error && data) {
        setEmailTemplates(prev => [...prev, data as EmailTemplate]);
        setSelectedTemplate(data as EmailTemplate);
        toast.success('Template created');
      }
    }
  };

  const deleteEmailTemplate = async (id: string) => {
    await supabase.from('email_templates').delete().eq('id', id);
    setEmailTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) { setSelectedTemplate(null); setEditTemplate({}); }
    toast.success('Template deleted');
  };

  const insertVariable = (variable: string) => {
    if (lastFocused === 'subject') {
      setEditTemplate(prev => ({ ...prev, subject: (prev.subject || '') + variable }));
    } else {
      setEditTemplate(prev => ({ ...prev, body: (prev.body || '') + variable }));
    }
  };

  const getPreviewText = (text: string) => {
    let result = text;
    Object.values(MERGE_VARIABLES).flat().forEach(v => {
      result = result.split(v.key).join(v.example);
    });
    return result;
  };

  const tabPresets = presets.filter(p => p.category === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Preset Forms" />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="work_order" className="text-xs">Work Orders</TabsTrigger>
            <TabsTrigger value="plan_preset" className="text-xs">Plan Presets</TabsTrigger>
            <TabsTrigger value="request_type" className="text-xs">Request Types</TabsTrigger>
            <TabsTrigger value="fee" className="text-xs">Fees</TabsTrigger>
            <TabsTrigger value="item" className="text-xs">Items</TabsTrigger>
            <TabsTrigger value="discount" className="text-xs">Discounts</TabsTrigger>
            <TabsTrigger value="tax" className="text-xs">Taxes</TabsTrigger>
            <TabsTrigger value="email_templates" className="text-xs"><Mail className="w-3 h-3 mr-1" />Email</TabsTrigger>
          </TabsList>

          {/* Work Order Presets */}
          <TabsContent value="work_order">
            <Card>
              <CardHeader><CardTitle className="text-base">Work Order Presets</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Standard Aligner" /></div>
                  <div className="space-y-1"><Label className="text-xs">Fee ($)</Label><Input type="number" value={newFee} onChange={e => setNewFee(e.target.value)} placeholder="0" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Description..." /></div>

                {/* Dental Field Templates */}
                <Collapsible open={dentalPanelOpen} onOpenChange={setDentalPanelOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                      📋 Dental Field Templates — click to add
                      <ChevronDown className={`w-3 h-3 transition-transform ${dentalPanelOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
                      {DENTAL_FIELD_TEMPLATES.map(t => (
                        <Badge key={t.label} variant="outline" className="cursor-pointer hover:bg-accent text-xs py-1 gap-1"
                          onClick={() => addField(t.field)}>
                          <Plus className="w-2.5 h-2.5" /> {t.label}
                        </Badge>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs font-semibold">Form Fields</Label>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">These labels become field names on submitted forms. Use clear dental terms.</TooltipContent>
                      </Tooltip>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addField()}><Plus className="w-3 h-3 mr-1" /> Field</Button>
                  </div>
                  {newFields.map((field, idx) => (
                    <div key={field.id} className="flex items-start gap-2 p-2 rounded border border-border/50 bg-muted/20">
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input value={field.label} onChange={e => updateField(idx, { label: e.target.value })} placeholder="Field label" className="h-8 text-xs" />
                        <Select value={field.type} onValueChange={v => updateField(idx, { type: v as any })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="textarea">Textarea</SelectItem>
                            <SelectItem value="radio">Radio</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="tooth_chart">🦷 Tooth Chart</SelectItem>
                          </SelectContent>
                        </Select>
                        {['radio', 'checkbox', 'dropdown'].includes(field.type) && (
                          <Input className="col-span-2 h-8 text-xs" placeholder="Options (comma separated)" value={field.options?.join(', ') || ''}
                            onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Switch checked={field.required} onCheckedChange={v => updateField(idx, { required: v })} className="h-4 w-7" />
                        <span className="text-[10px] text-muted-foreground">Req</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeField(idx)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Preview Button */}
                {newFields.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowFormPreview(true)}>
                    <Eye className="w-3 h-3" /> Preview Form
                  </Button>
                )}
                <Button onClick={addPreset} size="sm" className="gap-1"><Plus className="w-3 h-3" /> Add Preset</Button>
              </CardContent>
            </Card>

            {/* Form Preview Dialog */}
            <Dialog open={showFormPreview} onOpenChange={setShowFormPreview}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-sm">📋 Form Preview — {newName || 'Untitled'}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {newFields.map(field => {
                    if (field.type === 'tooth_chart') {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs font-medium">{field.label || 'Tooth Selection'}</Label>
                          <ToothChartSelector value={previewToothData} onChange={setPreviewToothData} />
                        </div>
                      );
                    }
                    if (field.type === 'textarea') {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                          <Textarea className="text-xs" rows={3} placeholder={field.label} readOnly />
                        </div>
                      );
                    }
                    if (['radio', 'dropdown'].includes(field.type) && field.options) {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                          <Select><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    if (field.type === 'checkbox' && field.options) {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs">{field.label}</Label>
                          <div className="flex flex-wrap gap-2">
                            {field.options.map(o => <label key={o} className="flex items-center gap-1 text-xs"><input type="checkbox" disabled /> {o}</label>)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={field.id} className="space-y-1">
                        <Label className="text-xs">{field.label}{field.required && ' *'}</Label>
                        <Input className="h-8 text-xs" placeholder={field.label} readOnly />
                      </div>
                    );
                  })}
                  {newFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No fields to preview</p>}
                </div>
              </DialogContent>
            </Dialog>

          {/* Plan Presets */}
          <TabsContent value="plan_preset">
            <Card>
              <CardHeader><CardTitle className="text-base">Plan Presets</CardTitle>
                <p className="text-xs text-muted-foreground">Create plan templates with dental-specific sections. These auto-apply when linked work order types are selected.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Plan Preset Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Orthodontic Plan" /></div>
                  <div className="space-y-1"><Label className="text-xs">Linked Work Order Type</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="e.g. Standard Aligner" /></div>
                </div>

                {/* Quick-add section types */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Quick Add Sections</Label>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
                    {[
                      { label: '📊 IPR Data', type: 'ipr_data' as const },
                      { label: '🦷 Tooth Movement', type: 'tooth_movement' as const },
                      { label: '🔬 Feasibility', type: 'feasibility' as const },
                      { label: '📷 Images', type: 'images' as const },
                      { label: '🎥 Video', type: 'video' as const },
                      { label: '🎙️ Audio', type: 'audio' as const },
                      { label: '📐 Model Analysis', type: 'model_analysis' as const },
                      { label: '📏 Cephalometric', type: 'cephalometric' as const },
                      { label: '📝 Notes', type: 'notes' as const },
                    ].map(s => (
                      <Badge key={s.type} variant="outline" className="cursor-pointer hover:bg-accent text-xs py-1 gap-1"
                        onClick={() => addField({ label: s.label.replace(/^[^\s]+ /, ''), type: s.type, required: false })}>
                        <Plus className="w-2.5 h-2.5" /> {s.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Plan Sections ({newFields.length})</Label>
                    <Button size="sm" variant="outline" onClick={() => addField({ label: '', type: 'notes', required: false })}><Plus className="w-3 h-3 mr-1" /> Custom Section</Button>
                  </div>
                  {newFields.map((field, idx) => (
                    <div key={field.id} className="flex items-start gap-2 p-2 rounded border border-border/50 bg-muted/20">
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input value={field.label} onChange={e => updateField(idx, { label: e.target.value })} placeholder="Section name" className="h-8 text-xs" />
                        <Select value={field.type} onValueChange={v => updateField(idx, { type: v as any })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ipr_data">📊 IPR Data</SelectItem>
                            <SelectItem value="tooth_movement">🦷 Tooth Movement</SelectItem>
                            <SelectItem value="feasibility">🔬 Feasibility</SelectItem>
                            <SelectItem value="images">📷 Images</SelectItem>
                            <SelectItem value="video">🎥 Video</SelectItem>
                            <SelectItem value="audio">🎙️ Audio</SelectItem>
                            <SelectItem value="model_analysis">📐 Model Analysis</SelectItem>
                            <SelectItem value="cephalometric">📏 Cephalometric</SelectItem>
                            <SelectItem value="notes">📝 Notes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeField(idx)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
                <Button onClick={addPreset} size="sm" className="gap-1"><Plus className="w-3 h-3" /> Save Plan Preset</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Request Types */}
          <TabsContent value="request_type">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Types</CardTitle>
                <p className="text-xs text-muted-foreground">Define request types that users select when submitting cases. Each links to work order form(s) and a plan preset.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Request Type Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Standard Aligner" /></div>
                  <div className="space-y-1"><Label className="text-xs">Fee ($)</Label><Input type="number" value={newFee} onChange={e => setNewFee(e.target.value)} placeholder="0" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Description of this request type" /></div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Linked Work Order Form</Label>
                    <Select value={newUnit || ''} onValueChange={setNewUnit}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select work order..." /></SelectTrigger>
                      <SelectContent>
                        {presets.filter(p => p.category === 'work_order').map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Linked Plan Preset</Label>
                    <Select value={newDescription || ''} onValueChange={setNewDescription}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select plan preset..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {presets.filter(p => p.category === 'plan_preset').map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={async () => {
                  if (!newName || !user) return;
                  const payload: any = {
                    name: newName, fee_usd: parseFloat(newFee) || 0, type: 'case',
                    category: 'request_type', user_id: user.id,
                    description: newDescription && newDescription !== '__none__' ? newDescription : null, // stores linked_plan_preset_id
                    unit: newUnit || null, // stores linked_work_order_id
                  };
                  const { data, error } = await supabase.from('presets').insert(payload).select().single();
                  if (!error && data) {
                    setPresets(prev => [...prev, { ...data, fields: (data.fields as any) || [] } as PresetRecord]);
                    resetForm();
                    toast.success('Request type added');
                  }
                }} size="sm" className="gap-1"><Plus className="w-3 h-3" /> Add Request Type</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee / Item Presets */}
          {['fee', 'item'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardHeader><CardTitle className="text-base">{tab === 'fee' ? 'Fee' : 'Item'} Presets</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Full Upper Aligner Package" /></div>
                    <div className="space-y-1"><Label className="text-xs">Unit Price ($)</Label><Input type="number" value={newUnitPrice} onChange={e => setNewUnitPrice(e.target.value)} /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="per case | per arch | per step | per set" />
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
                  </div>
                  <Button onClick={addPreset} size="sm"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* Discount Presets */}
          <TabsContent value="discount">
            <Card>
              <CardHeader><CardTitle className="text-base">Discount Presets</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Type</Label>
                    <Select value={newDiscountType} onValueChange={setNewDiscountType}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">%</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Value</Label><Input type="number" value={newDiscountValue} onChange={e => setNewDiscountValue(e.target.value)} /></div>
                </div>
                <Button onClick={addPreset} size="sm"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tax Presets */}
          <TabsContent value="tax">
            <Card>
              <CardHeader><CardTitle className="text-base">Tax Presets</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-3 text-xs space-y-1">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">GST Guide for Dental Services</p>
                    <p>• <strong>0%:</strong> Basic dental treatment (most clinical services)</p>
                    <p>• <strong>5%:</strong> Dental prosthetics & appliances (some categories)</p>
                    <p>• <strong>18%:</strong> Cosmetic dental procedures, luxury appliances</p>
                    <p>• <strong>Standard:</strong> CGST 9% + SGST 9% (intra-state) or IGST 18% (inter-state)</p>
                    <p>• <strong>HSN Code:</strong> 9993 (dental services)</p>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Rate (%)</Label><Input type="number" value={newTaxRate} onChange={e => setNewTaxRate(e.target.value)} /></div>
                </div>
                <Button onClick={addPreset} size="sm"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="email_templates">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Template list */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Email Templates</CardTitle>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={newEmailTemplate}>
                      <Plus className="w-3 h-3 mr-1" /> New
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                  {emailTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No templates yet</p>
                  ) : (
                    emailTemplates.map(t => (
                      <div key={t.id}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer hover:bg-accent/50 ${selectedTemplate?.id === t.id ? 'bg-accent' : ''}`}
                        onClick={() => selectEmailTemplate(t)}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.trigger_event.replace('_', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive"
                            onClick={e => { e.stopPropagation(); deleteEmailTemplate(t.id); }}>
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Right: Editor */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {selectedTemplate ? 'Edit Template' : editTemplate.name !== undefined ? 'New Template' : 'Select a template'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editTemplate.name !== undefined ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Template Name</Label><Input value={editTemplate.name || ''} onChange={e => setEditTemplate(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" /></div>
                        <div><Label className="text-xs">Trigger Event</Label>
                          <Select value={editTemplate.trigger_event || ''} onValueChange={v => setEditTemplate(p => ({ ...p, trigger_event: v }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{TRIGGER_EVENTS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editTemplate.is_active ?? true} onCheckedChange={v => setEditTemplate(p => ({ ...p, is_active: v }))} className="h-4 w-7" />
                        <Label className="text-xs">Trigger this email automatically</Label>
                      </div>
                      <div>
                        <Label className="text-xs">Email Subject</Label>
                        <Input ref={subjectRef} value={editTemplate.subject || ''} onChange={e => setEditTemplate(p => ({ ...p, subject: e.target.value }))}
                          onFocus={() => setLastFocused('subject')} className="h-8 text-xs font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs">Email Body</Label>
                        <Textarea ref={bodyRef} value={editTemplate.body || ''} onChange={e => setEditTemplate(p => ({ ...p, body: e.target.value }))}
                          onFocus={() => setLastFocused('body')} className="min-h-[150px] text-xs font-mono" />
                      </div>

                      {/* Merge Variables */}
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                            📌 Available Variables — click to insert
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {Object.entries(MERGE_VARIABLES).map(([group, vars]) => (
                            <div key={group}>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group}</p>
                              <div className="flex flex-wrap gap-1">
                                {vars.map(v => (
                                  <Tooltip key={v.key}>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[10px] font-mono"
                                        onClick={() => insertVariable(v.key)}>
                                        {v.key}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">e.g. {v.example}</TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEmailTemplate}><Save className="w-3 h-3 mr-1" /> Save Template</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}><Eye className="w-3 h-3 mr-1" /> Preview</Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">Select a template from the list or create a new one</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle className="text-sm">Email Preview</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="text-sm font-medium">{getPreviewText(editTemplate.subject || '')}</p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Body</Label>
                    <p className="text-sm whitespace-pre-wrap">{getPreviewText(editTemplate.body || '')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        {/* Existing Presets for active tab (not email_templates) */}
        {activeTab !== 'email_templates' && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Existing {activeTab.replace('_', ' ')} presets ({tabPresets.length})</h3>
            {tabPresets.map(p => {
              const linkedWo = activeTab === 'request_type' && p.unit ? presets.find(x => x.id === p.unit) : null;
              const linkedPlan = activeTab === 'request_type' && p.description ? presets.find(x => x.id === p.description) : null;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.fee_usd > 0 && <span className="text-xs text-muted-foreground ml-2">${p.fee_usd}</span>}
                      {p.unit_price && <span className="text-xs text-muted-foreground ml-2">${p.unit_price}{p.unit ? `/${p.unit}` : ''}</span>}
                      {p.discount_value && activeTab !== 'request_type' && <span className="text-xs text-muted-foreground ml-2">{p.discount_type === 'percentage' ? `${p.discount_value}%` : `$${p.discount_value}`}</span>}
                      {p.tax_rate && <span className="text-xs text-muted-foreground ml-2">{p.tax_rate}%</span>}
                      {linkedWo && <Badge variant="outline" className="text-[10px] ml-2">WO: {linkedWo.name}</Badge>}
                      {linkedPlan && <Badge variant="outline" className="text-[10px] ml-2">Plan: {linkedPlan.name}</Badge>}
                      {!linkedWo && !linkedPlan && p.description && activeTab !== 'request_type' && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      {p.fields && p.fields.length > 0 && <span className="text-[10px] text-muted-foreground ml-2">({p.fields.length} fields)</span>}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => deletePreset(p.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
