import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Send, Lock, Paperclip, X, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  case_id: string;
  sender_id: string;
  content: string;
  type: 'internal' | 'external';
  created_at: string;
  sender_name?: string;
  related_type?: string;
  related_id?: string;
  attachments?: Attachment[];
}

interface CommunicationHubProps {
  caseId: string;
  relatedType?: 'case' | 'phase' | 'plan';
  relatedId?: string;
}

export default function CommunicationHub({ caseId, relatedType, relatedId }: CommunicationHubProps) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`comms-${caseId}-${relatedType || 'all'}-${relatedId || 'all'}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'communications',
        filter: `case_id=eq.${caseId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (relatedType && relatedId) {
          if (newMsg.related_type !== relatedType || newMsg.related_id !== relatedId) return;
        }
        newMsg.sender_name = profiles[newMsg.sender_id] || 'Unknown';
        newMsg.attachments = (newMsg.attachments as any) || [];
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [caseId, relatedType, relatedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    let query = supabase.from('communications').select('*').eq('case_id', caseId).order('created_at', { ascending: true });
    if (relatedType && relatedId) {
      query = query.eq('related_type', relatedType).eq('related_id', relatedId);
    }
    const { data, error } = await query;
    if (error) { console.error(error); setLoading(false); return; }
    const msgs = data || [];
    const userIds = [...new Set(msgs.map(m => m.sender_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const profileMap: Record<string, string> = {};
      profileData?.forEach(p => { profileMap[p.user_id] = p.display_name || 'Unknown'; });
      setProfiles(profileMap);
      setMessages(msgs.map(m => ({
        ...m, type: m.type as 'internal' | 'external',
        sender_name: profileMap[m.sender_id] || 'Unknown',
        attachments: (m.attachments as any as Attachment[]) || [],
      })));
    } else { setMessages([]); }
    setLoading(false);
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    const attachments: Attachment[] = [];
    for (const file of pendingFiles) {
      const path = `${user!.id}/communications/${caseId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('case-files').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('case-files').getPublicUrl(path);
        const att: Attachment = { name: file.name, url: urlData.publicUrl, type: file.type, size: file.size };
        attachments.push(att);

        // Also create an asset record so it shows in the Assets tab
        await supabase.from('assets').insert({
          case_id: caseId,
          file_url: urlData.publicUrl,
          file_type: file.type,
          original_name: file.name,
          file_size: file.size,
          category: file.type.startsWith('image') ? 'Photo' : file.type.startsWith('video') ? 'Video' : 'Document',
          is_viewable: false,
          is_downloadable: false,
          related_id: relatedId || null,
        });
      }
    }
    return attachments;
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user) return;
    setUploading(true);
    try {
      const attachments = pendingFiles.length > 0 ? await uploadFiles() : [];
      const { error } = await supabase.from('communications').insert({
        case_id: caseId, sender_id: user.id,
        content: newMessage.trim(), type: isInternal ? 'internal' : 'external',
        related_type: relatedType || 'case', related_id: relatedId || caseId,
        attachments: attachments as any,
      });
      if (error) { toast.error('Failed to send message'); return; }
      setNewMessage(''); setPendingFiles([]);
    } finally { setUploading(false); }
  };

  const filteredMessages = messages.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (!m.content.toLowerCase().includes(q) && !m.sender_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const canPreviewInApp = (type: string) => type.startsWith('image/') || type.startsWith('video/') || type === 'application/pdf';

  const renderAttachment = (att: Attachment) => {
    const isImage = att.type.startsWith('image/');
    const isVideo = att.type.startsWith('video/');
    const isPdf = att.type === 'application/pdf';

    return (
      <div key={att.url} className="mt-1">
        {isImage && (
          <a href={att.url} target="_blank" rel="noopener noreferrer">
            <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] rounded object-cover" />
          </a>
        )}
        {isVideo && (
          <video src={att.url} controls className="max-w-[250px] max-h-[150px] rounded" />
        )}
        {isPdf && (
          <a href={att.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/50 hover:bg-background text-xs border border-border/50 max-w-[200px]">
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{att.name}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )}
        {!isImage && !isVideo && !isPdf && (
          <a href={att.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/50 hover:bg-background text-xs border border-border/50 max-w-[200px]">
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{att.name}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-8 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {messages.length === 0 ? 'No messages yet. Start the conversation.' : 'No messages match your search.'}
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isOwn = msg.sender_id === user?.id;
            const hasContext = msg.related_type && msg.related_type !== 'case';
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 space-y-1 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <div className="flex items-center gap-2 text-xs opacity-80 flex-wrap">
                    <span className="font-semibold">{isOwn ? 'You' : msg.sender_name}</span>
                    {msg.type === 'internal' && (
                      <Badge variant="outline" className="text-[9px] h-4 gap-0.5"><Lock className="w-2 h-2" /> Internal</Badge>
                    )}
                    {hasContext && (
                      <Badge variant="secondary" className="text-[9px] h-4 capitalize">
                        📌 {msg.related_type}
                      </Badge>
                    )}
                  </div>
                  {msg.content && <p className="text-sm">{msg.content}</p>}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="space-y-1">{msg.attachments.map(renderAttachment)}</div>
                  )}
                  <p className="text-[10px] opacity-60">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border/50 space-y-2">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} className="h-4 w-7" />
            <Label htmlFor="internal" className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Internal Note
            </Label>
          </div>
        )}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                {f.name}
                <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="w-4 h-4" />
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
          <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="text-sm"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
          <Button size="icon" onClick={sendMessage} disabled={(!newMessage.trim() && pendingFiles.length === 0) || uploading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
