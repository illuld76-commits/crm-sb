import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, FilePlus, RefreshCw, MessageSquare, AtSign, Receipt, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

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
  if (t.includes('case') && t.includes('submit')) return <FilePlus className="w-3.5 h-3.5 text-blue-500" />;
  if (t.includes('status')) return <RefreshCw className="w-3.5 h-3.5 text-orange-500" />;
  if (t.includes('remark') || t.includes('message')) return <MessageSquare className="w-3.5 h-3.5 text-green-500" />;
  if (t.includes('mention') || t.includes('@')) return <AtSign className="w-3.5 h-3.5 text-purple-500" />;
  if (t.includes('invoice')) return <Receipt className="w-3.5 h-3.5 text-blue-500" />;
  if (t.includes('overdue')) return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  if (t.includes('payment')) return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  if (t.includes('complete') || t.includes('ready')) return <Package className="w-3.5 h-3.5 text-teal-500" />;
  return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);
      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 15));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string, link: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (link) navigate(link);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={markAllRead}>Mark all read</Button>
          )}
        </div>
        <ScrollArea className="max-h-[480px]">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors flex items-start gap-2.5 ${!n.is_read ? 'bg-primary/5' : ''}`}
                onClick={() => markAsRead(n.id, n.link)}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.title)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            ))
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/notifications')}>
            View all notifications →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
