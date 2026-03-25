import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { useRelationalNav } from '@/hooks/useRelationalNav';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, CheckCircle2, XCircle, Eye, Download, ArrowUpDown, Ban, Play, Pause, CircleCheck, Trash2, UserPlus } from 'lucide-react';
import { CaseRequest } from '@/types';

type SortOption = 'date_desc' | 'date_asc' | 'name_az' | 'name_za';

export default function SubmittedCases() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { openPreview } = useRelationalNav();
  const [cases, setCases] = useState<CaseRequest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchCases = async () => {
      let query = supabase.from('case_requests').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('user_id', user?.id);
      const { data } = await query;
      setCases((data || []) as unknown as CaseRequest[]);
      setLoading(false);
    };
    fetchCases();
  }, [user, isAdmin]);

  const filtered = useMemo(() => {
    let result = cases.filter(c => !search || c.patient_name.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_az': return a.patient_name.localeCompare(b.patient_name);
        case 'name_za': return b.patient_name.localeCompare(a.patient_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [cases, search, sortBy, filterStatus]);

  const updateStatus = async (id: string, newStatus: CaseRequest['status']) => {
    const { error } = await supabase.from('case_requests').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setCases(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success(`Case ${newStatus.replace('_', ' ')}`);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Status', 'Date'];
    const rows = filtered.map(c => [c.patient_name, c.request_type, c.status, format(new Date(c.created_at), 'yyyy-MM-dd')]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'case_requests.csv'; a.click();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { draft: 'secondary', pending: 'default', accepted: 'default', rejected: 'destructive', in_progress: 'default', on_hold: 'secondary', completed: 'default', discarded: 'destructive' };
    return <Badge variant={map[status] as any || 'outline'} className="text-[10px]">{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Submitted Cases" />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search cases..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-32 h-9 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest</SelectItem>
                <SelectItem value="date_asc">Oldest</SelectItem>
                <SelectItem value="name_az">A-Z</SelectItem>
                <SelectItem value="name_za">Z-A</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3 h-3 mr-1" /> CSV</Button>}
          </div>
        </div>

        {loading ? (
          <p className="text-center py-10 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">No case requests found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.patient_name}</span>
                      {statusBadge(c.status)}
                      {(c as any).display_id && <span className="text-[10px] text-muted-foreground font-mono">{(c as any).display_id}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.request_type} • {format(new Date(c.created_at), 'MMM d, yyyy')}
                      {c.attachments && c.attachments.length > 0 && ` • ${c.attachments.length} files`}
                    </div>
                    {(c as any).patient_id && (
                      <Badge variant="outline" className="text-[10px] mt-1 cursor-pointer hover:bg-accent" onClick={(e) => { e.stopPropagation(); openPreview('patient', (c as any).patient_id); }}>
                        👤 Linked Patient
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <>
                        {c.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => updateStatus(c.id, 'accepted')} title="Accept">
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateStatus(c.id, 'rejected')} title="Reject">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {c.status === 'accepted' && (
                          <Button variant="ghost" size="sm" className="text-blue-600 text-xs" onClick={() => updateStatus(c.id, 'in_progress')} title="Start">
                            <Play className="w-3 h-3 mr-0.5" /> Start
                          </Button>
                        )}
                        {(c.status === 'in_progress' || c.status === 'accepted') && (
                          <Button variant="ghost" size="sm" className="text-orange-500 text-xs" onClick={() => updateStatus(c.id, 'on_hold')} title="Hold">
                            <Pause className="w-3 h-3 mr-0.5" /> Hold
                          </Button>
                        )}
                        {(c.status === 'in_progress' || c.status === 'on_hold') && (
                          <Button variant="ghost" size="sm" className="text-purple-600 text-xs" onClick={() => updateStatus(c.id, 'completed')} title="Complete">
                            <CircleCheck className="w-3 h-3 mr-0.5" /> Done
                          </Button>
                        )}
                        {c.status !== 'discarded' && c.status !== 'completed' && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateStatus(c.id, 'discarded')} title="Discard">
                            <Ban className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/case-submission/${c.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
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
