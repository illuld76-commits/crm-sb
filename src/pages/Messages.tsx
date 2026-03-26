import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import CommunicationHub from '@/components/CommunicationHub';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRelationalNav } from '@/hooks/useRelationalNav';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';

interface ConversationItem {
  case_id: string;
  patient_name: string;
  related_type: string;
  related_id: string;
  last_message: string;
  last_at: string;
  unread: boolean;
  unread_count: number;
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openPreview } = useRelationalNav();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readConvKeys, setReadConvKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    // Get distinct conversations from communications
    const { data: comms } = await supabase
      .from('communications')
      .select('case_id, content, created_at, related_type, related_id')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!comms) { setLoading(false); return; }

    // Get unique case_ids
    const caseIds = [...new Set(comms.map(c => c.case_id))];
    const { data: patients } = await supabase.from('patients').select('id, patient_name').in('id', caseIds);
    const patientMap: Record<string, string> = {};
    patients?.forEach(p => { patientMap[p.id] = p.patient_name; });

    // Group by case_id + related_id with unread tracking
    const convMap = new Map<string, ConversationItem>();
    comms.forEach(c => {
      const key = `${c.case_id}-${c.related_id || 'case'}`;
      if (!convMap.has(key)) {
        convMap.set(key, {
          case_id: c.case_id,
          patient_name: patientMap[c.case_id] || 'Unknown',
          related_type: c.related_type || 'case',
          related_id: c.related_id || c.case_id,
          last_message: c.content,
          last_at: c.created_at,
          unread: false,
          unread_count: 0,
        });
      }
    });

    // Load read state from localStorage
    const readKeys = new Set<string>();
    try {
      const stored = localStorage.getItem(`msg_read_${user?.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        Object.entries(parsed).forEach(([k, lastReadAt]) => {
          readKeys.add(k);
          const conv = convMap.get(k);
          if (conv) {
            // Count messages after last read
            const unreadMsgs = comms.filter(c => {
              const ck = `${c.case_id}-${c.related_id || 'case'}`;
              return ck === k && new Date(c.created_at) > new Date(lastReadAt);
            });
            conv.unread_count = unreadMsgs.length;
            conv.unread = unreadMsgs.length > 0;
          }
        });
        // Conversations not in stored = new = unread
        convMap.forEach((conv, key) => {
          if (!readKeys.has(key)) {
            conv.unread = true;
            conv.unread_count = comms.filter(c => `${c.case_id}-${c.related_id || 'case'}` === key).length;
          }
        });
      } else {
        // No read state = all unread
        convMap.forEach(conv => { conv.unread = true; conv.unread_count = 1; });
      }
    } catch { /* ignore */ }
    
    setReadConvKeys(readKeys);
    setConversations(Array.from(convMap.values()));
    setLoading(false);
  };

  const markAsRead = (conv: ConversationItem) => {
    const key = `${conv.case_id}-${conv.related_id}`;
    try {
      const stored = localStorage.getItem(`msg_read_${user?.id}`);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[key] = new Date().toISOString();
      localStorage.setItem(`msg_read_${user?.id}`, JSON.stringify(parsed));
    } catch { /* ignore */ }
    setConversations(prev => prev.map(c => 
      c.case_id === conv.case_id && c.related_id === conv.related_id 
        ? { ...c, unread: false, unread_count: 0 } : c
    ));
  };

  const filteredConversations = conversations.filter(c => {
    if (filter === 'unread' && !c.unread) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.patient_name.toLowerCase().includes(q) || c.last_message.toLowerCase().includes(q);
    }
    return true;
  });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Messages" />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Unread {conversations.filter(c => c.unread).length > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5">{conversations.filter(c => c.unread).length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Conversation list */}
          <div className={`space-y-2 ${selected && !isMobile ? 'md:col-span-1' : 'md:col-span-3'} ${selected && isMobile ? 'hidden' : ''}`}>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            ) : filteredConversations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </CardContent>
              </Card>
            ) : (
              filteredConversations.map((conv, i) => (
                <Card key={i} className={`cursor-pointer hover:shadow-md transition-shadow ${selected?.case_id === conv.case_id && selected?.related_id === conv.related_id ? 'ring-2 ring-primary' : ''} ${conv.unread ? 'border-primary/40' : ''}`}
                  onClick={() => {
                    markAsRead(conv);
                    if (isMobile) {
                      navigate(`/patient/${conv.case_id}`);
                    } else {
                      setSelected(conv);
                    }
                  }}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {conv.unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                          <span className={`text-sm truncate ${conv.unread ? 'font-bold' : 'font-medium'}`}>{conv.patient_name}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{conv.related_type}</Badge>
                          {conv.unread_count > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5 shrink-0">{conv.unread_count}</span>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${conv.unread ? 'text-foreground' : 'text-muted-foreground'}`}>{conv.last_message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.last_at), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Right panel: CommunicationHub */}
          {selected && (
            <div className={`${isMobile ? 'col-span-1' : 'md:col-span-2'}`}>
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b border-border/50 flex items-center justify-between">
                    <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => openPreview('patient', selected.case_id)}>
                      👤 {selected.patient_name}
                    </Badge>
                    <button className="text-xs text-muted-foreground md:hidden" onClick={() => setSelected(null)}>← Back</button>
                  </div>
                  <CommunicationHub caseId={selected.case_id} relatedType={selected.related_type as any} relatedId={selected.related_id} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
