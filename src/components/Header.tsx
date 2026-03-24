import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SnaponLogo from '@/components/SnaponLogo';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
  leftActions?: React.ReactNode;
}

export default function Header({ title, children, leftActions }: HeaderProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

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
