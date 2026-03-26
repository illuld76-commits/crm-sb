import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronRight, PanelLeftClose, PanelLeftOpen, LayoutGrid, X, FilePlus, Archive, Settings as SettingsIcon, Bell, User, History, CreditCard, UserCog, Columns3, LogOut, MessageSquare, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
  const [search, setSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPatientsExpanded, setIsPatientsExpanded] = useState(true);
  const [isCasesExpanded, setIsCasesExpanded] = useState(true);
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  const filteredPatients = useMemo(() =>
    patients.filter(p => !search || p.patient_name.toLowerCase().includes(search.toLowerCase())),
    [patients, search]
  );

  const filteredCaseRequests = useMemo(() =>
    caseRequests.filter(r => !search || r.patient_name.toLowerCase().includes(search.toLowerCase())),
    [caseRequests, search]
  );

  if (isCollapsed) {
    return (
      <div className="w-12 border-r bg-background h-screen flex-col items-center py-4 hidden md:flex">
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)} title="Expand">
          <PanelLeftOpen className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
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

        <div className="space-y-1">
          {[
            { to: '/', icon: LayoutGrid, label: 'Dashboard', show: true },
            { to: '/kanban', icon: Columns3, label: 'Kanban Board', show: true },
            { to: '/case-submission', icon: FilePlus, label: 'New Case Request', show: true },
            { to: '/messages', icon: MessageSquare, label: 'Messages', show: true },
            { to: '/notifications', icon: Bell, label: 'Notifications', show: true },
            { to: '/profile', icon: User, label: 'My Profile', show: true },
            { to: '/assets', icon: FolderOpen, label: 'Global Assets', show: true },
            { to: '/billing', icon: CreditCard, label: 'Billing', show: true },
            { to: '/team', icon: UserCog, label: 'Team', show: isAdmin },
            { to: '/settings', icon: SettingsIcon, label: 'Settings', show: isAdmin },
            { to: '/archives', icon: Archive, label: 'Archives', show: isAdmin },
            { to: '/audit-logs', icon: History, label: 'Activity Logs', show: true },
            { to: '/preset-forms', icon: SettingsIcon, label: 'Presets', show: isAdmin },
            { to: '/notification-settings', icon: Bell, label: 'Notif. Templates', show: isAdmin },
          ].filter(l => l.show).map(link => {
            const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
            return (
              <Link key={link.to} to={link.to} onClick={onClose}
                className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                <link.icon className={`h-4 w-4 ${isActive ? 'text-accent-foreground' : 'text-primary'}`} /> {link.label}
              </Link>
            );
          })}
          <button onClick={() => { onClose?.(); signOut(); }}
            className="flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors hover:bg-muted text-destructive w-full text-left">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        {/* Case Requests Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Link to="/submitted-cases" onClick={onClose} className="font-semibold text-xs text-muted-foreground uppercase tracking-wider hover:text-primary">
              Case Requests ({filteredCaseRequests.length})
            </Link>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsCasesExpanded(!isCasesExpanded)}>
              <ChevronRight className={`h-3 w-3 transition-transform ${isCasesExpanded ? 'rotate-90' : ''}`} />
            </Button>
          </div>
          {isCasesExpanded && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredCaseRequests.map(req => (
                <Link
                  key={req.id}
                  to={req.status === 'accepted' && req.patient_id ? `/patient/${req.patient_id}` : `/case-submission/${req.id}`}
                  onClick={onClose}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted text-xs"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${req.status === 'pending' ? 'bg-orange-500' : req.status === 'accepted' ? 'bg-green-500' : 'bg-blue-500'}`} />
                  <span className="truncate">{req.patient_name}</span>
                </Link>
              ))}
              {filteredCaseRequests.length === 0 && <div className="text-xs text-muted-foreground py-1">No case requests</div>}
            </div>
          )}
        </div>

        {/* Cases Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Cases ({filteredPatients.length})</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsPatientsExpanded(!isPatientsExpanded)}>
              <ChevronRight className={`h-3 w-3 transition-transform ${isPatientsExpanded ? 'rotate-90' : ''}`} />
            </Button>
          </div>
          {isPatientsExpanded && (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-7 h-7 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="space-y-0.5">
                {filteredPatients.map(p => {
                  const patientPhases = phases.filter(ph => ph.patient_id === p.id);
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-1">
                        {patientPhases.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={e => { e.preventDefault(); setExpandedPatients(prev => ({ ...prev, [p.id]: !prev[p.id] })); }}>
                            <ChevronRight className={`h-3 w-3 transition-transform ${expandedPatients[p.id] ? 'rotate-90' : ''}`} />
                          </Button>
                        )}
                        <Link to={`/patient/${p.id}`} onClick={onClose} className="flex-1 truncate text-xs p-1.5 rounded hover:bg-muted">{p.patient_name}</Link>
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
                              <Link key={pl.id} to={`/plan/${pl.id}`} onClick={onClose} className="ml-4 block text-[10px] text-muted-foreground p-1 rounded hover:bg-muted truncate">
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
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
