import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SnaponLogo from '@/components/SnaponLogo';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
  leftActions?: React.ReactNode;
}

interface QuickNavItem {
  id: string;
  label: string;
  sub: string;
  url: string;
}

export default function Header({ title, children, leftActions }: HeaderProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [showQuickNav, setShowQuickNav] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [quickNavItems, setQuickNavItems] = useState<QuickNavItem[]>([]);
  const quickNavRef = useRef<HTMLDivElement>(null);

  // Load quick nav items on demand
  useEffect(() => {
    if (!showQuickNav) return;
    Promise.all([
      supabase.from('patients').select('id, patient_name').order('patient_name').limit(50),
      supabase.from('case_requests').select('id, patient_name, request_type, status').eq('is_deleted', false).order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: patients }, { data: requests }]) => {
      const items: QuickNavItem[] = [];
      (patients || []).forEach(p => items.push({ id: p.id, label: p.patient_name, sub: 'Patient', url: `/patient/${p.id}` }));
      (requests || []).forEach(r => items.push({ id: r.id, label: `${r.patient_name} — ${r.request_type}`, sub: `Request (${r.status})`, url: `/case-submission/${r.id}` }));
      setQuickNavItems(items);
    });
  }, [showQuickNav]);

  // Close on outside click
  useEffect(() => {
    if (!showQuickNav) return;
    const handler = (e: MouseEvent) => {
      if (quickNavRef.current && !quickNavRef.current.contains(e.target as Node)) setShowQuickNav(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showQuickNav]);

  const filteredItems = quickSearch
    ? quickNavItems.filter(i => i.label.toLowerCase().includes(quickSearch.toLowerCase()))
    : quickNavItems;

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto flex items-center justify-between h-14 px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {leftActions}
          <div className="shrink-0 cursor-pointer" onClick={() => navigate('/')} title="Home">
            <SnaponLogo size={28} />
          </div>
          {title && <span className="font-semibold text-sm truncate hidden sm:inline-block sm:max-w-xs">{title}</span>}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
          {children}

          {/* Quick Nav Search */}
          <div className="relative" ref={quickNavRef}>
            <Button variant="ghost" size="icon" onClick={() => setShowQuickNav(!showQuickNav)} title="Quick Navigation">
              <Search className="w-4 h-4" />
            </Button>
            {showQuickNav && (
              <div className="absolute right-0 top-10 w-72 sm:w-80 bg-popover border rounded-lg shadow-lg z-50">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search cases, patients..."
                    value={quickSearch}
                    onChange={e => setQuickSearch(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredItems.length > 0 ? filteredItems.slice(0, 20).map(item => (
                    <div key={`${item.sub}-${item.id}`}
                      className="px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center justify-between"
                      onClick={() => { navigate(item.url); setShowQuickNav(false); setQuickSearch(''); }}>
                      <span className="truncate font-medium text-xs">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{item.sub}</span>
                    </div>
                  )) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {quickSearch.length > 0 ? 'No results found' : 'Loading...'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground hidden md:block">{user?.email}</span>
          <ThemeToggle />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} title="Profile">
            <User className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
