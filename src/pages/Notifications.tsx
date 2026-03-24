import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, FilePlus, RefreshCw, MessageSquare, AtSign, Receipt, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

const typeIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('case') && t.includes('submit')) return <FilePlus className="w-4 h-4 text-blue-500" />;
  if (t.includes('status')) return <RefreshCw className="w-4 h-4 text-orange-500" />;
  if (t.includes('remark') || t.includes('message')) return <MessageSquare className="w-4 h-4 text-green-500" />;
  if (t.includes('mention') || t.includes('@')) return <AtSign className="w-4 h-4 text-purple-500" />;
  if (t.includes('invoice')) return <Receipt className="w-4 h-4 text-blue-500" />;
  if (t.includes('overdue')) return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (t.includes('payment')) return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (t.includes('complete') || t.includes('ready')) return <Package className="w-4 h-4 text-teal-500" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => {
        setNotifications((data || []) as Notification[]);
        setLoading(false);
      });
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All marked as read');
  };

  const markAsRead = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    if (n.link) navigate(n.link);
  };

  const filtered = notifications.filter(n => {
    if (tab === 'unread') return !n.is_read;
    if (tab === 'cases') return n.title.toLowerCase().includes('case');
    if (tab === 'billing') return n.title.toLowerCase().includes('invoice') || n.title.toLowerCase().includes('payment');
    if (tab === 'messages') return n.title.toLowerCase().includes('remark') || n.title.toLowerCase().includes('mention');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Notifications" />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Notification Center</h1>
            {unreadCount > 0 && <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">Mark all read</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList className="grid grid-cols-5 h-8">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
            <TabsTrigger value="cases" className="text-xs">Cases</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
            <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => (
              <Card
                key={n.id}
                className={`cursor-pointer hover:shadow-md transition-all ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => markAsRead(n)}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{typeIcon(n.title)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
