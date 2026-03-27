import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Search, Trash2, Receipt } from 'lucide-react';

interface ExpenseRow {
  id: string;
  vendor_name: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  is_billable: boolean;
  notes: string | null;
  created_at: string;
  invoice_id: string | null;
  user_id: string | null;
  patient_id: string | null;
}

const CATEGORIES = ['general', 'material', 'shipping', 'outsource', 'equipment', 'overhead', 'other'];

export default function ExpensesList() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form
  const [vendor, setVendor] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [billable, setBillable] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      let query = supabase.from('expenses').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
      const { data } = await query;
      let rows = (data || []) as unknown as ExpenseRow[];
      if (!isAdmin) {
        rows = rows.filter(r => (r as any).user_id === user.id);
      }
      setExpenses(rows);
      setLoading(false);
    };
    fetch();
  }, [user, isAdmin]);

  const filtered = expenses.filter(e => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.vendor_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== 'all' && e.category !== filterCat) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);

  const handleAdd = async () => {
    if (!desc || !amount) { toast.error('Description and amount required'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('expenses').insert({
      vendor_name: vendor, description: desc,
      amount: parseFloat(amount) || 0, currency: 'INR',
      category, is_billable: billable, notes: notes || null,
      user_id: user!.id,
    } as any).select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    setExpenses(prev => [data as unknown as ExpenseRow, ...prev]);
    setDialogOpen(false);
    setVendor(''); setDesc(''); setAmount(''); setNotes('');
    setSaving(false);
    toast.success('Expense added');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Expense deleted');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Expenses" />
      <main className="container mx-auto px-4 py-6">
        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <p className="text-2xl font-bold">₹{totalAmount.toLocaleString()}</p>
            </div>
            <Badge variant="outline">{filtered.length} records</Badge>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-xs">Vendor</Label><Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name" /></div>
                <div><Label className="text-xs">Description *</Label><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was this expense for?" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Amount *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={billable} onCheckedChange={setBillable} />
                  <Label className="text-xs">Billable to client</Label>
                </div>
                <div><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
                <Button onClick={handleAdd} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Add Expense'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {loading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No expenses found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(exp => (
              <Card key={exp.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{exp.description}</span>
                      <Badge variant="outline" className="text-[10px]">{exp.category}</Badge>
                      {exp.is_billable && <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Billable</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {exp.vendor_name && `${exp.vendor_name} • `}
                      {format(new Date(exp.created_at), 'MMM d, yyyy')}
                      {exp.invoice_id && ' • Linked to invoice'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm">₹{exp.amount.toLocaleString()}</span>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
