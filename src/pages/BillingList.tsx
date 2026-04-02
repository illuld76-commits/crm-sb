import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useUserScope } from '@/hooks/useUserScope';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Search, CreditCard, Download, ArrowUpDown, Plus, TrendingUp, CheckCircle, Clock, AlertCircle, BookOpen, Trash2, LayoutGrid, List } from 'lucide-react';
import { useRelationalNav } from '@/hooks/useRelationalNav';

type SortOption = 'date_desc' | 'date_asc' | 'amount_asc' | 'amount_desc' | 'name_az' | 'name_za';

interface InvoiceRow {
  id: string;
  patient_name: string;
  patient_id: string | null;
  amount_usd: number;
  balance_due: number;
  status: string;
  created_at: string;
  type: string;
  display_id?: string;
  invoice_number?: string;
  due_date?: string;
  case_request_id?: string;
}

export default function BillingList() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { canAccessPatient } = useUserScope();
  const navigate = useNavigate();
  const { openPreview } = useRelationalNav();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [ledgerPatient, setLedgerPatient] = useState<{ name: string; id: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice? It will be moved to Archives.')) return;
    await supabase.from('invoices').update({ is_deleted: true } as any).eq('id', id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.success('Invoice deleted');
  };

  useEffect(() => {
    if (!user) return;
    const fetchInvoices = async () => {
      const { data } = await supabase.from('invoices').select('id, patient_name, patient_id, amount_usd, balance_due, status, created_at, type, display_id, invoice_number, due_date, case_request_id, is_deleted, user_id, secondary_user_ids, client_details')
        .eq('is_deleted', false).order('created_at', { ascending: false });

      let rows = (data || []).map((d: any) => ({
        id: d.id, patient_name: d.patient_name, patient_id: d.patient_id,
        amount_usd: d.amount_usd, balance_due: d.balance_due || 0, status: d.status,
        created_at: d.created_at, type: d.type || 'invoice',
        display_id: d.display_id, invoice_number: d.invoice_number, due_date: d.due_date,
        case_request_id: d.case_request_id, user_id: d.user_id,
        secondary_user_ids: d.secondary_user_ids,
        client_entity_name: d.client_details?.name || null,
      }));

      // RBAC: non-admin sees invoices they own, are secondary on, or share entity circle with
      if (!isAdmin) {
        // Get user's entity assignments for circle matching
        const { data: myAssignments } = await supabase.from('user_assignments')
          .select('assignment_type, assignment_value')
          .eq('user_id', user.id);
        const myEntityValues = new Set((myAssignments || []).map(a => a.assignment_value));

        const patientIds = rows.filter((r: any) => r.patient_id).map((r: any) => r.patient_id);
        const uniqueIds = [...new Set(patientIds)];
        let accessibleIds = new Set<string>();
        if (uniqueIds.length > 0) {
          const { data: patients } = await supabase.from('patients')
            .select('id, clinic_name, doctor_name, lab_name, company_name, user_id, primary_user_id, secondary_user_id')
            .in('id', uniqueIds);
          accessibleIds = new Set((patients || []).filter(p => canAccessPatient(p)).map(p => p.id));
        }
        rows = rows.filter((r: any) => {
          if (r.user_id === user.id) return true;
          if (r.patient_id && accessibleIds.has(r.patient_id)) return true;
          const secIds = Array.isArray(r.secondary_user_ids) ? r.secondary_user_ids : [];
          if (secIds.includes(user.id)) return true;
          // Entity circle: if invoice client entity name matches user's assignment
          if (r.client_entity_name && myEntityValues.has(r.client_entity_name)) return true;
          return false;
        });
      }

      setInvoices(rows);
      setLoading(false);
    };
    fetchInvoices();
  }, [user, isAdmin, canAccessPatient]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = invoices.filter(i => new Date(i.created_at) >= monthStart);
    const totalBilled = thisMonth.reduce((s, i) => s + i.amount_usd, 0);
    const collected = thisMonth.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0);
    const outstanding = invoices.filter(i => ['sent', 'partially_paid'].includes(i.status)).reduce((s, i) => s + (i.balance_due || 0), 0);
    const overdue = invoices.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date && new Date(i.due_date) < now)).length;
    return { totalBilled, collected, outstanding, overdue };
  }, [invoices]);

  const filtered = useMemo(() => {
    let result = invoices.filter(i => !search || i.patient_name.toLowerCase().includes(search.toLowerCase()) || (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') result = result.filter(i => i.status === filterStatus);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount_asc': return a.amount_usd - b.amount_usd;
        case 'amount_desc': return b.amount_usd - a.amount_usd;
        case 'name_az': return a.patient_name.localeCompare(b.patient_name);
        case 'name_za': return b.patient_name.localeCompare(a.patient_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [invoices, search, sortBy, filterStatus]);

  const ledgerInvoices = ledgerPatient ? invoices.filter(i => i.patient_id === ledgerPatient.id || i.patient_name === ledgerPatient.name) : [];

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground', sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      partially_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      overdue: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground',
    };
    return map[s] || 'bg-muted text-muted-foreground';
  };

  const exportCSV = () => {
    const headers = ['Invoice #', 'Project', 'Amount', 'Balance', 'Status', 'Date', 'Due'];
    const rows = filtered.map(i => [i.invoice_number || '', i.patient_name, i.amount_usd.toFixed(2), (i.balance_due || 0).toFixed(2), i.status, format(new Date(i.created_at), 'yyyy-MM-dd'), i.due_date || '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'invoices.csv'; a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Billing" />
      <main className="container mx-auto px-4 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Billed</p>
                <p className="text-lg font-bold">₹{kpis.totalBilled.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('paid')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                <p className="text-lg font-bold">₹{kpis.collected.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('sent')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <p className="text-lg font-bold">₹{kpis.outstanding.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${kpis.overdue > 0 ? 'ring-1 ring-destructive/30' : ''}`} onClick={() => setFilterStatus('overdue')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                <p className="text-lg font-bold">{kpis.overdue}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search project or invoice #..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-28 h-8 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest</SelectItem>
                <SelectItem value="date_asc">Oldest</SelectItem>
                <SelectItem value="amount_desc">High→Low</SelectItem>
                <SelectItem value="amount_asc">Low→High</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-none" onClick={() => setViewMode('list')}><List className="w-3 h-3" /></Button>
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-none" onClick={() => setViewMode('grid')}><LayoutGrid className="w-3 h-3" /></Button>
            </div>
            {isAdmin && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV}><Download className="w-3 h-3 mr-1" /> CSV</Button>}
            {isAdmin && <Button size="sm" className="h-8 text-xs" onClick={() => navigate('/billing/new')}><Plus className="w-3 h-3 mr-1" /> New Invoice</Button>}
          </div>
        </div>

        {/* Invoice list */}
        {loading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filtered.map(inv => (
              <Card key={inv.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/billing/${inv.id}`)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{inv.patient_name}</span>
                      {inv.invoice_number && <span className="text-[10px] font-mono text-muted-foreground">{inv.invoice_number}</span>}
                      <Badge className={`text-[10px] ${statusColor(inv.status)}`}>{inv.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ₹{inv.amount_usd.toLocaleString()} • {format(new Date(inv.created_at), 'MMM d, yyyy')}
                      {inv.due_date && ` • Due: ${format(new Date(inv.due_date), 'MMM d')}`}
                      {inv.balance_due > 0 && <span className="text-destructive"> • Balance: ₹{inv.balance_due.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inv.patient_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openPreview('patient', inv.patient_id!); }} title="Patient preview">
                        <span className="text-[10px]">👤</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setLedgerPatient({ name: inv.patient_name, id: inv.patient_id || '' }); }} title="View ledger">
                      <BookOpen className="w-3.5 h-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteInvoice(inv.id); }} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(inv => (
              <Card key={inv.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/billing/${inv.id}`)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{inv.patient_name}</span>
                    <Badge className={`text-[10px] ${statusColor(inv.status)}`}>{inv.status.replace('_', ' ')}</Badge>
                  </div>
                  {inv.invoice_number && <p className="text-[10px] font-mono text-muted-foreground">{inv.invoice_number}</p>}
                  <p className="text-lg font-bold">₹{inv.amount_usd.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(inv.created_at), 'MMM d, yyyy')}</p>
                  {inv.balance_due > 0 && <p className="text-xs text-destructive">Balance: ₹{inv.balance_due.toLocaleString()}</p>}
                  <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLedgerPatient({ name: inv.patient_name, id: inv.patient_id || '' })} title="Ledger">
                      <BookOpen className="w-3 h-3" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteInvoice(inv.id)} title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Patient Ledger Sheet */}
      <Sheet open={!!ledgerPatient} onOpenChange={() => setLedgerPatient(null)}>
        <SheetContent className="w-[380px] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle>Account Statement — {ledgerPatient?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {ledgerInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices for this patient</p>
            ) : (
              <>
                {ledgerInvoices.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-sm border rounded-md p-2 cursor-pointer hover:bg-accent" onClick={() => { setLedgerPatient(null); navigate(`/billing/${i.id}`); }}>
                    <div>
                      <p className="font-medium text-xs">{i.invoice_number || i.display_id || 'Draft'}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(i.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-xs">₹{i.amount_usd.toLocaleString()}</p>
                      <Badge className={`text-[9px] ${statusColor(i.status)}`}>{i.status}</Badge>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-medium">₹{ledgerInvoices.reduce((s, i) => s + i.amount_usd, 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Paid</span><span className="font-medium text-green-600">₹{ledgerInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0).toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold"><span>Outstanding</span><span className="text-destructive">₹{ledgerInvoices.reduce((s, i) => s + (i.balance_due || 0), 0).toLocaleString()}</span></div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
