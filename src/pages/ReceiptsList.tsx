import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Search, Receipt } from 'lucide-react';

interface ReceiptRow {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  invoice_number?: string;
  patient_name?: string;
}

export default function ReceiptsList() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: recs } = await supabase.from('receipts').select('*').order('payment_date', { ascending: false });
      if (!recs) { setLoading(false); return; }

      // Get invoice details for each receipt
      const invoiceIds = [...new Set(recs.map(r => r.invoice_id))];
      const { data: invoices } = await supabase.from('invoices').select('id, invoice_number, patient_name, user_id, patient_id').in('id', invoiceIds);
      const invoiceMap = new Map((invoices || []).map(i => [i.id, i]));

      let rows: ReceiptRow[] = recs.map(r => {
        const inv = invoiceMap.get(r.invoice_id);
        return {
          ...r,
          invoice_number: inv?.invoice_number || '',
          patient_name: inv?.patient_name || '',
        } as ReceiptRow;
      });

      // RBAC: non-admin only sees receipts from their invoices
      if (!isAdmin) {
        const myInvoiceIds = new Set((invoices || []).filter(i => (i as any).user_id === user.id).map(i => i.id));
        rows = rows.filter(r => myInvoiceIds.has(r.invoice_id));
      }

      setReceipts(rows);
      setLoading(false);
    };
    fetch();
  }, [user, isAdmin]);

  const filtered = receipts.filter(r => {
    if (search && !(r.patient_name || '').toLowerCase().includes(search.toLowerCase()) && !(r.invoice_number || '').toLowerCase().includes(search.toLowerCase()) && !(r.reference_number || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMethod !== 'all' && r.payment_method !== filterMethod) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Receipts" />
      <main className="container mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Collected</p>
              <p className="text-2xl font-bold">₹{totalAmount.toLocaleString()}</p>
            </div>
            <Badge variant="outline">{filtered.length} receipts</Badge>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search receipts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No receipts found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(rec => (
              <Card key={rec.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/billing/${rec.invoice_id}`)}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rec.patient_name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{rec.invoice_number}</span>
                      <Badge variant="outline" className="text-[10px]">{rec.payment_method.replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(rec.payment_date), 'MMM d, yyyy')}
                      {rec.reference_number && ` • Ref: ${rec.reference_number}`}
                    </div>
                  </div>
                  <span className="font-bold text-sm text-green-600 shrink-0">₹{rec.amount.toLocaleString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
