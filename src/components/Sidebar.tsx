import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronRight, PanelLeftClose, PanelLeftOpen, LayoutGrid, X, FilePlus, Archive, Settings as SettingsIcon, Bell, User, History, CreditCard, UserCog, Columns3, LogOut, MessageSquare, FolderOpen, Inbox, Briefcase, FileText, Receipt, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { CaseRequest } from '@/types';

interface Patient {
  id: string;
  patient_name: string;
  doctor_name?: string | null;
  clinic_name?: string | null;
  lab_name?: string | null;
  company_name?: string | null;
}

interface Phase {
  id: string;
  patient_id: string;
  phase_name: string;
}

interface Plan {
  id: string;
  phase_id: string;
  plan_name: string;
}

interface SidebarProps {
  patients: Patient[];
  phases: Phase[];
  plans: Plan[];
  caseRequests: CaseRequest[];
  onClose?: () => void;
}

export default function Sidebar({ patients, phases, plans, caseRequests, onClose }: SidebarProps) {
  const { isAdmin } = useRole();
  const { signOut } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCasesExpanded, setIsCasesExpanded] = useState(false);
  const [isBillingExpanded, setIsBillingExpanded] = useState(location.pathname.startsWith('/billing'));
  const [requestsPaneOpen, setRequestsPaneOpen] = useState(false);
  const [projectsPaneOpen, setProjectsPaneOpen] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  const filteredProjects = useMemo(() =>
    patients.filter(p => !projectSearch || p.patient_name.toLowerCase().includes(projectSearch.toLowerCase())),
    [patients, projectSearch]
  );

  const filteredRequests = useMemo(() =>
    caseRequests.filter(r => !requestSearch || r.patient_name.toLowerCase().includes(requestSearch.toLowerCase())),
    [caseRequests, requestSearch]
  );

  const pendingCount = caseRequests.filter(r => r.status === 'pending').length;

  // Core navigation links
  const coreLinks = [
    { to: '/', icon: LayoutGrid, label: 'Dashboard', show: true },
    { to: '/kanban', icon: Columns3, label: 'Kanban Board', show: true },
    { to: '/messages', icon: MessageSquare, label: 'Messages', show: true },
    { to: '/notifications', icon: Bell, label: 'Notifications', show: true },
    { to: '/profile', icon: User, label: 'My Profile', show: true },
    
    { to: '/assets', icon: FolderOpen, label: 'Global Assets', show: true },
    { to: '/audit-logs', icon: History, label: 'Activity Logs', show: true },
  ];

  const adminLinks = [
    { to: '/team', icon: UserCog, label: 'Team', show: isAdmin },
    { to: '/settings', icon: SettingsIcon, label: 'Settings', show: isAdmin },
    { to: '/archives', icon: Archive, label: 'Archives', show: isAdmin },
    { to: '/preset-forms', icon: SettingsIcon, label: 'Presets', show: isAdmin },
    { to: '/notification-settings', icon: Bell, label: 'Notif. Templates', show: isAdmin },
  ];

  if (isCollapsed) {
    return (
      <div className="w-12 border-r bg-background h-screen flex-col items-center py-4 hidden md:flex">
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)} title="Expand">
          <PanelLeftOpen className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  const renderNavLink = (link: { to: string; icon: any; label: string }) => {
    const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
    return (
      <Link key={link.to} to={link.to} onClick={onClose}
        className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
        <link.icon className={`h-4 w-4 ${isActive ? 'text-accent-foreground' : 'text-primary'}`} /> {link.label}
      </Link>
    );
  };

  return (
    <>
      <div className="w-64 border-r bg-background h-screen flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Navigation</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 hidden md:flex" onClick={() => setIsCollapsed(true)}>
                <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden" onClick={onClose}>
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {/* Core Links */}
            {coreLinks.filter(l => l.show).map(renderNavLink)}

            {/* Billing expandable section */}
            <div className="pt-1">
              <button
                onClick={() => setIsBillingExpanded(!isBillingExpanded)}
                className={`flex items-center justify-between w-full p-2 rounded-md text-sm font-medium transition-colors hover:bg-muted ${isBillingExpanded ? 'bg-accent/50 text-accent-foreground' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing
                </span>
                <ChevronRight className={`h-3 w-3 transition-transform ${isBillingExpanded ? 'rotate-90' : ''}`} />
              </button>
              {isBillingExpanded && (
                <div className="ml-2 mt-1 space-y-0.5 border-l border-border/50 pl-3">
                  {renderNavLink({ to: '/billing', icon: FileText, label: 'Invoices' })}
                  {renderNavLink({ to: '/billing/expenses', icon: DollarSign, label: 'Expenses' })}
                  {renderNavLink({ to: '/billing/receipts', icon: Receipt, label: 'Receipts' })}
                </div>
              )}
            </div>

            {/* Cases & Projects Mega-Button */}
            <div className="pt-2">
              <button
                onClick={() => setIsCasesExpanded(!isCasesExpanded)}
                className={`flex items-center justify-between w-full p-2 rounded-md text-sm font-semibold transition-colors hover:bg-muted ${isCasesExpanded ? 'bg-accent/50 text-accent-foreground' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Cases & Projects
                </span>
                <div className="flex items-center gap-1">
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{pendingCount}</Badge>
                  )}
                  <ChevronRight className={`h-3 w-3 transition-transform ${isCasesExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isCasesExpanded && (
                <div className="ml-2 mt-1 space-y-0.5 border-l border-border/50 pl-3">
                  {/* New Case Request */}
                  <Link to="/case-submission" onClick={onClose}
                    className="flex items-center gap-2 p-2 rounded-md text-sm hover:bg-muted text-primary font-medium">
                    <FilePlus className="h-4 w-4" /> New Case Request
                  </Link>

                  {/* Case Requests - opens slidable pane */}
                  <button
                    onClick={() => setRequestsPaneOpen(true)}
                    className="flex items-center justify-between w-full p-2 rounded-md text-sm hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-muted-foreground" /> Case Requests
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">{caseRequests.length}</Badge>
                  </button>

                  {/* Projects - opens slidable pane */}
                  <button
                    onClick={() => setProjectsPaneOpen(true)}
                    className="flex items-center justify-between w-full p-2 rounded-md text-sm hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" /> Projects
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">{patients.length}</Badge>
                  </button>
                </div>
              )}
            </div>

            {/* Admin Links */}
            {adminLinks.filter(l => l.show).length > 0 && (
              <div className="pt-2 border-t border-border/30 mt-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">Admin</span>
                <div className="mt-1 space-y-0.5">
                  {adminLinks.filter(l => l.show).map(renderNavLink)}
                </div>
              </div>
            )}

            {/* Sign Out */}
            <button onClick={() => { onClose?.(); signOut(); }}
              className="flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors hover:bg-muted text-destructive w-full text-left mt-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* Case Requests Slide-Out Pane */}
      <Sheet open={requestsPaneOpen} onOpenChange={setRequestsPaneOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="text-sm">Case Requests</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search requests..." className="pl-7 h-7 text-xs" value={requestSearch} onChange={e => setRequestSearch(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="px-4 space-y-1">
              {filteredRequests.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No requests found</p>}
              {filteredRequests.map(req => (
                <Link key={req.id} to={`/case-submission/${req.id}`}
                  onClick={() => { setRequestsPaneOpen(false); onClose?.(); }}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-xs">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    req.status === 'pending' ? 'bg-orange-500' :
                    req.status === 'accepted' ? 'bg-green-500' :
                    req.status === 'completed' ? 'bg-primary' :
                    req.status === 'in_progress' ? 'bg-blue-500' :
                    'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{req.patient_name}</p>
                    <p className="text-[10px] text-muted-foreground">{req.request_type}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0 capitalize">{req.status}</span>
                </Link>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Projects Slide-Out Pane */}
      <Sheet open={projectsPaneOpen} onOpenChange={setProjectsPaneOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="text-sm">Projects</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search projects..." className="pl-7 h-7 text-xs" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="px-4 space-y-0.5">
              {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No projects found</p>}
              {filteredProjects.map(p => {
                const patientPhases = phases.filter(ph => ph.patient_id === p.id);
                return (
                  <div key={p.id}>
                    <div className="flex items-center gap-1">
                      {patientPhases.length > 0 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={e => { e.preventDefault(); setExpandedPatients(prev => ({ ...prev, [p.id]: !prev[p.id] })); }}>
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedPatients[p.id] ? 'rotate-90' : ''}`} />
                        </Button>
                      )}
                      <Link to={`/patient/${p.id}`} onClick={() => { setProjectsPaneOpen(false); onClose?.(); }}
                        className="flex-1 truncate text-xs p-1.5 rounded hover:bg-muted font-medium">{p.patient_name}</Link>
                    </div>
                    {expandedPatients[p.id] && patientPhases.map(ph => {
                      const phasePlans = plans.filter(pl => pl.phase_id === ph.id);
                      return (
                        <div key={ph.id} className="ml-6">
                          <div className="flex items-center gap-1">
                            {phasePlans.length > 0 && (
                              <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={e => { e.preventDefault(); setExpandedPhases(prev => ({ ...prev, [ph.id]: !prev[ph.id] })); }}>
                                <ChevronRight className={`h-2 w-2 transition-transform ${expandedPhases[ph.id] ? 'rotate-90' : ''}`} />
                              </Button>
                            )}
                            <span className="text-[10px] text-muted-foreground truncate p-1">{ph.phase_name}</span>
                          </div>
                          {expandedPhases[ph.id] && phasePlans.map(pl => (
                            <Link key={pl.id} to={`/plan/${pl.id}`} onClick={() => { setProjectsPaneOpen(false); onClose?.(); }}
                              className="ml-4 block text-[10px] text-muted-foreground p-1 rounded hover:bg-muted truncate">
                              {pl.plan_name}
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
