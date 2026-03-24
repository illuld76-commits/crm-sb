import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LayoutGrid, Columns3, FolderOpen, CreditCard, BarChart3,
  UserCog, Settings, Archive, History, FileText, Bell,
  User, LogOut
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import ThemeToggle from './ThemeToggle';

interface MoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const clinicalLinks = [
  { label: 'Dashboard', icon: LayoutGrid, route: '/' },
  { label: 'Kanban Board', icon: Columns3, route: '/kanban', adminOnly: true },
  { label: 'Submitted Cases', icon: FolderOpen, route: '/submitted-cases' },
];

const billingLinks = [
  { label: 'Invoices', icon: CreditCard, route: '/billing' },
];

const settingsLinks = [
  { label: 'Team', icon: UserCog, route: '/team' },
  { label: 'Presets', icon: FileText, route: '/preset-forms' },
  { label: 'Notification Templates', icon: Bell, route: '/notification-settings' },
  { label: 'Settings', icon: Settings, route: '/settings' },
  { label: 'Audit Logs', icon: History, route: '/audit-logs' },
  { label: 'Archives', icon: Archive, route: '/archives' },
];

const accountLinks = [
  { label: 'Profile', icon: User, route: '/profile' },
];

export default function MoreDrawer({ open, onOpenChange }: MoreDrawerProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, role } = useRole();

  const go = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  const email = user?.email || '';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-8">
        {/* User Card */}
        <div className="flex items-center gap-3 py-3 px-1">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{email}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5">{role || 'user'}</Badge>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Clinical */}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Clinical</p>
        <div className="space-y-0.5 mb-3">
          {clinicalLinks.filter(l => !l.adminOnly || isAdmin).map(link => (
            <Button key={link.route} variant="ghost" className="w-full justify-start gap-3 h-10 text-sm" onClick={() => go(link.route)}>
              <link.icon className="h-4 w-4 text-primary" /> {link.label}
            </Button>
          ))}
        </div>

        {/* Billing */}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Billing</p>
        <div className="space-y-0.5 mb-3">
          {billingLinks.map(link => (
            <Button key={link.route} variant="ghost" className="w-full justify-start gap-3 h-10 text-sm" onClick={() => go(link.route)}>
              <link.icon className="h-4 w-4 text-primary" /> {link.label}
            </Button>
          ))}
        </div>

        {/* Settings (admin only) */}
        {isAdmin && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Settings</p>
            <div className="space-y-0.5 mb-3">
              {settingsLinks.map(link => (
                <Button key={link.route} variant="ghost" className="w-full justify-start gap-3 h-10 text-sm" onClick={() => go(link.route)}>
                  <link.icon className="h-4 w-4 text-primary" /> {link.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {/* Account */}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">Account</p>
        <div className="space-y-0.5 mb-3">
          {accountLinks.map(link => (
            <Button key={link.route} variant="ghost" className="w-full justify-start gap-3 h-10 text-sm" onClick={() => go(link.route)}>
              <link.icon className="h-4 w-4 text-primary" /> {link.label}
            </Button>
          ))}
          <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-sm text-destructive hover:text-destructive" onClick={() => { onOpenChange(false); signOut(); }}>
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Separator className="my-2" />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}
