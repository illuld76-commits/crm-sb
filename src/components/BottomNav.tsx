import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FolderOpen, PlusCircle, MessageSquare, Menu, Columns3 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import MoreDrawer from './MoreDrawer';

const tabs = [
  { id: 'home', label: 'Home', icon: LayoutGrid, route: '/' },
  { id: 'cases', label: 'Cases', icon: FolderOpen, route: '/submitted-cases' },
  { id: 'new', label: 'New', icon: PlusCircle, route: null },
  { id: 'messages', label: 'Messages', icon: MessageSquare, route: '/messages' },
  { id: 'more', label: 'More', icon: Menu, route: null },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Fetch pending case count
    supabase.from('case_requests').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').eq('is_deleted', false)
      .then(({ count }) => setPendingCount(count || 0));

    // Fetch unread notification count
    supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [user, location.pathname]);

  const activeTab = tabs.find(t => t.route && location.pathname === t.route)?.id || 
    (location.pathname.startsWith('/patient') || location.pathname.startsWith('/plan') ? 'home' : '');

  const handleTab = (tab: typeof tabs[0]) => {
    if (tab.id === 'new') {
      setNewSheetOpen(true);
    } else if (tab.id === 'more') {
      setMoreOpen(true);
    } else if (tab.route) {
      navigate(tab.route);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t h-14 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-full max-w-lg mx-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const isNew = tab.id === 'new';
            return (
              <button
                key={tab.id}
                onClick={() => handleTab(tab)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors
                  ${isActive ? 'text-primary' : 'text-muted-foreground'}
                  ${isNew ? '' : 'hover:text-primary/80'}
                `}
              >
                {isNew ? (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center -mt-3 shadow-lg">
                    <PlusCircle className="h-5 w-5 text-primary-foreground" />
                  </div>
                ) : (
                  <>
                    <tab.icon className="h-5 w-5" />
                    {tab.id === 'cases' && pendingCount > 0 && (
                      <span className="absolute top-1 right-1/4 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-medium">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                    {tab.id === 'messages' && unreadCount > 0 && (
                      <span className="absolute top-1 right-1/4 w-2 h-2 bg-destructive rounded-full" />
                    )}
                  </>
                )}
                <span className="text-[10px] leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* New Action Sheet */}
      <Sheet open={newSheetOpen} onOpenChange={setNewSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <div className="grid grid-cols-3 gap-4 pt-4">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-6"
              onClick={() => { setNewSheetOpen(false); navigate('/patient/new'); }}
            >
              <LayoutGrid className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Project</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-6"
              onClick={() => { setNewSheetOpen(false); navigate('/case-submission'); }}
            >
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Case</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-6"
              onClick={() => { setNewSheetOpen(false); navigate('/billing/new'); }}
            >
              <MessageSquare className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Invoice</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* More Drawer */}
      <MoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
