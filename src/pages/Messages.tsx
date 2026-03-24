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
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openPreview } = useRelationalNav();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [filter, setFilter] = useState('all');

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

    // Group by case_id + related_id
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
        });
      }
    });

    setConversations(Array.from(convMap.values()));
    setLoading(false);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Messages" />
      <main className="container mx-auto px-4 py-6">
        <Tabs value={filter} onValueChange={setFilter} className="mb-4">
          <TabsList>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Conversation list */}
          <div className={`space-y-2 ${selected && !isMobile ? 'md:col-span-1' : 'md:col-span-3'} ${selected && isMobile ? 'hidden' : ''}`}>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            ) : conversations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </CardContent>
              </Card>
            ) : (
              conversations.map((conv, i) => (
                <Card key={i} className={`cursor-pointer hover:shadow-md transition-shadow ${selected?.case_id === conv.case_id && selected?.related_id === conv.related_id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => {
                    if (isMobile) {
                      // Navigate to patient detail on mobile
                      navigate(`/patient/${conv.case_id}`);
                    } else {
                      setSelected(conv);
                    }
                  }}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{conv.patient_name}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{conv.related_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
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
