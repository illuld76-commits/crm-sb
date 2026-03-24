import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useRelationalNav } from '@/hooks/useRelationalNav';
import Header from '@/components/Header';
import CommunicationHub from '@/components/CommunicationHub';
import FilePreviewModal from '@/components/FilePreviewModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ArrowLeft, User, Receipt, FileText, Clock, AlertTriangle, Image, Film, Music, Box, ExternalLink } from 'lucide-react';
import { CaseRequest, FileAttachment } from '@/types';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { openPreview } = useRelationalNav();
  const [caseData, setCaseData] = useState<CaseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedInvoice, setLinkedInvoice] = useState<{ id: string; invoice_number: string; status: string; amount_usd: number; balance_due: number } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string; size: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('case_requests').select('*').eq('id', id).single(),
      supabase.from('invoices').select('id, invoice_number, status, amount_usd, balance_due').eq('case_request_id', id).limit(1),
    ]).then(([{ data: cr }, { data: invs }]) => {
      if (cr) setCaseData(cr as unknown as CaseRequest);
      if (invs && invs.length > 0) setLinkedInvoice(invs[0] as any);
      setLoading(false);
    });
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id || !caseData) return;
    const historyEntry = { id: crypto.randomUUID(), action: `Status changed to ${newStatus}`, user_name: user?.email || 'Admin', created_at: new Date().toISOString() };
    const currentHistory = (caseData.history || []) as any[];
    const { error } = await supabase.from('case_requests').update({
      status: newStatus, history: [...currentHistory, historyEntry] as any,
    }).eq('id', id);
    if (!error) {
      setCaseData(prev => prev ? { ...prev, status: newStatus as any, history: [...currentHistory, historyEntry] } : prev);
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    }
  };

  const generateInvoice = async () => {
    if (!caseData || !user) return;
    const { data, error } = await supabase.from('invoices').insert({
      user_id: user.id, patient_name: caseData.patient_name, patient_id: caseData.patient_id || null,
      case_request_id: id, status: 'draft', amount_usd: 0, currency_local: 'INR',
    }).select('id').single();
    if (!error && data) { navigate(`/billing/${data.id}`); }
  };

  const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    if (type?.startsWith('video/')) return <Film className="w-4 h-4 text-purple-500" />;
    if (type?.startsWith('audio/')) return <Music className="w-4 h-4 text-green-500" />;
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type?.includes('stl') || type?.includes('model')) return <Box className="w-4 h-4 text-orange-500" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
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

  const priorityColor = (p: string) => {
    const map: Record<string, string> = { low: 'bg-muted text-muted-foreground', normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', urgent: 'bg-destructive/10 text-destructive' };
    return map[p] || map.normal;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!caseData) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Work order not found</p></div>;

  const dueDate = (caseData as any).expected_due_date;
  const daysRemaining = dueDate ? differenceInDays(new Date(dueDate), new Date()) : null;
  const history = (caseData.history || []) as { id: string; action: string; user_name: string; created_at: string }[];

  return (
    <div className="min-h-screen bg-background">
      <Header title={`Work Order ${(caseData as any).display_id || ''}`} leftActions={
        <Button variant="ghost" size="icon" onClick={() => navigate('/submitted-cases')}><ArrowLeft className="w-4 h-4" /></Button>
      } />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold font-mono">{(caseData as any).display_id || 'WO-Pending'}</h2>
                  <Badge className={statusColor(caseData.status)}>{caseData.status.replace('_', ' ')}</Badge>
                  <Badge className={priorityColor((caseData as any).priority || 'normal')}>
                    {((caseData as any).priority || 'normal').toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {caseData.patient_name} • {caseData.request_type} • Submitted {formatDistanceToNow(new Date(caseData.created_at), { addSuffix: true })}
                </p>
              </div>
              {isAdmin && (
                <Select value={caseData.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['draft', 'pending', 'accepted', 'in_progress', 'on_hold', 'completed', 'rejected', 'discarded'].map(s =>
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Relational Context Bar */}
        <div className="flex flex-wrap gap-2">
          {caseData.patient_id ? (
            <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1" onClick={() => openPreview('patient', caseData.patient_id!)}>
              <User className="w-3 h-3" /> {caseData.patient_name}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">No patient linked</Badge>
          )}
          {linkedInvoice ? (
            <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1" onClick={() => openPreview('invoice', linkedInvoice.id)}>
              <Receipt className="w-3 h-3" /> {linkedInvoice.invoice_number || 'Invoice'}
            </Badge>
          ) : (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={generateInvoice}>
              <Receipt className="w-3 h-3 mr-1" /> Generate Invoice
            </Button>
          )}
        </div>

        {/* SLA Timer */}
        {daysRemaining !== null && ['in_progress', 'accepted'].includes(caseData.status) && (
          <Card className={`${daysRemaining < 0 ? 'border-destructive bg-destructive/5' : daysRemaining <= 2 ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' : 'border-green-400 bg-green-50 dark:bg-green-950/20'}`}>
            <CardContent className="p-3 flex items-center gap-2">
              {daysRemaining < 0 ? (
                <><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-sm font-medium text-destructive">OVERDUE by {Math.abs(daysRemaining)}d</span></>
              ) : (
                <><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{daysRemaining}d remaining (Due: {format(new Date(dueDate!), 'MMM d, yyyy')})</span></>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="details">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="communication" className="text-xs">Communication</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            <TabsTrigger value="invoice" className="text-xs">Invoice</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Patient info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Patient Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><Label className="text-xs text-muted-foreground">Name</Label><p className="font-medium">{caseData.patient_name}</p></div>
                <div><Label className="text-xs text-muted-foreground">Age</Label><p className="font-medium">{caseData.patient_age || '—'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Sex</Label><p className="font-medium capitalize">{caseData.patient_sex || '—'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Request Type</Label><p className="font-medium">{caseData.request_type}</p></div>
                {caseData.clinic_name && <div><Label className="text-xs text-muted-foreground">Clinic</Label><p className="font-medium">{caseData.clinic_name}</p></div>}
                {caseData.doctor_name && <div><Label className="text-xs text-muted-foreground">Doctor</Label><p className="font-medium">{caseData.doctor_name}</p></div>}
              </CardContent>
            </Card>

            {/* Dynamic Data */}
            {caseData.dynamic_data && Object.keys(caseData.dynamic_data).length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Work Order Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {Object.entries(caseData.dynamic_data).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-xs text-muted-foreground">{key}</Label>
                        <p className="font-medium">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {caseData.notes && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{caseData.notes}</p></CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Attachments {caseData.attachments?.length > 0 && <Badge variant="secondary" className="text-[10px]">{caseData.attachments.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!caseData.attachments || caseData.attachments.length === 0) ? (
                  <p className="text-sm text-muted-foreground">No attachments</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {caseData.attachments.map((att, i) => (
                      <div key={i} className="group border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => setPreviewFile(att)}>
                        {att.type?.startsWith('image/') ? (
                          <div className="relative h-28 bg-muted">
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 bg-muted/50 flex flex-col items-center justify-center gap-1">
                            {getFileIcon(att.type || '')}
                            <span className="text-[10px] text-muted-foreground uppercase">{att.type?.split('/')[1] || 'file'}</span>
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium truncate">{att.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communication">
            {caseData.patient_id ? (
              <Card>
                <CardContent className="p-0">
                  <CommunicationHub caseId={caseData.patient_id} relatedType="case" relatedId={id} />
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Link a patient to enable communication</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Activity History</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${h.action.includes('completed') || h.action.includes('accepted') ? 'bg-green-500' : h.action.includes('rejected') || h.action.includes('discarded') ? 'bg-destructive' : 'bg-primary'}`} />
                        <div className="text-sm">
                          <p>{h.action}</p>
                          <p className="text-xs text-muted-foreground">{h.user_name} • {format(new Date(h.created_at), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice">
            {linkedInvoice ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Invoice #</Label><p className="font-medium">{linkedInvoice.invoice_number || '—'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-medium">₹{linkedInvoice.amount_usd?.toFixed(2)}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Balance</Label><p className="font-medium text-destructive">₹{(linkedInvoice.balance_due || 0).toFixed(2)}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Status</Label><Badge variant="outline">{linkedInvoice.status}</Badge></div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/billing/${linkedInvoice.id}`)}>Open Full Invoice →</Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <p className="text-muted-foreground text-sm">No invoice linked to this work order</p>
                  <Button onClick={generateInvoice}><Receipt className="w-4 h-4 mr-2" /> Generate Invoice</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {previewFile && (
        <FilePreviewModal file={previewFile} allFiles={caseData.attachments || []} isOpen={!!previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
