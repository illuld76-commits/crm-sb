import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subMonths } from 'date-fns';
import { History, User, Tag, Activity, Archive, Search, ChevronRight } from 'lucide-react';
import { AuditLog } from '@/types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    const fetch = async () => {
      const { data: recent } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(200);
      setLogs((recent || []) as unknown as AuditLog[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const recentLogs = useMemo(() => logs.filter(l => !l.is_archived), [logs]);
  const archivedLogs = useMemo(() => logs.filter(l => l.is_archived), [logs]);

  const filterLogs = (list: AuditLog[]) =>
    list.filter(l =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.target_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const renderLog = (log: AuditLog) => (
    <div key={log.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase">{log.target_type}</Badge>
          <span className="text-sm font-semibold">{log.action}</span>
        </div>
        <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3 h-3" /> By: <span className="text-foreground font-medium">{log.user_name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="w-3 h-3" /> Target: <span className="text-foreground font-medium">{log.target_name}</span>
        </div>
      </div>
      <div className="mt-2 text-xs bg-background/50 p-2 rounded border border-border/30">
        <p className="text-muted-foreground">{log.details}</p>
        {(log.old_value || log.new_value) && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-destructive line-through">{log.old_value}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-green-600 font-medium">{log.new_value}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header title="Audit Logs" />
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" /> System Activity Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full sm:w-96 mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            {loading ? (
              <p className="text-center py-10 text-muted-foreground">Loading...</p>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="recent" className="gap-2"><Activity className="w-4 h-4" /> Recent</TabsTrigger>
                  <TabsTrigger value="archived" className="gap-2"><Archive className="w-4 h-4" /> Archived</TabsTrigger>
                </TabsList>
                <TabsContent value="recent">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">{filterLogs(recentLogs).map(renderLog)}</div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="archived">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">{filterLogs(archivedLogs).map(renderLog)}</div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
