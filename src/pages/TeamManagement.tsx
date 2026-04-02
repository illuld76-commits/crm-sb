import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Trash2, UserCog, Edit, KeyRound, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SnaponLogo from '@/components/SnaponLogo';
import ThemeToggle from '@/components/ThemeToggle';
import CreateUserDialog from '@/components/CreateUserDialog';

interface TeamMember {
  user_id: string;
  display_name: string;
  role: 'admin' | 'user';
  password_hint: string | null;
  assignments: { id: string; type: string; value: string; expires_at: string | null }[];
  created_at: string;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [patients, setPatients] = useState<{ id: string; patient_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPasswordHint, setEditPasswordHint] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordMember, setPasswordMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordHint, setNewPasswordHint] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => { fetchTeam(); fetchPatients(); }, []);

  const fetchPatients = async () => {
    const { data } = await supabase.from('patients').select('id, patient_name').order('patient_name');
    setPatients(data || []);
  };

  const fetchTeam = async () => {
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, password_hint, created_at');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const { data: assignments } = await supabase.from('user_assignments').select('*');

    if (profiles && roles) {
      const memberMap: Record<string, TeamMember> = {};
      profiles.forEach(p => {
        const role = roles.find(r => r.user_id === p.user_id);
        const userAssignments = (assignments || [])
          .filter(a => a.user_id === p.user_id)
          .map(a => ({ id: a.id, type: a.assignment_type, value: a.assignment_value, expires_at: a.expires_at }));
        memberMap[p.user_id] = {
          user_id: p.user_id, display_name: p.display_name || 'Unknown',
          role: (role?.role as 'admin' | 'user') || 'user', password_hint: p.password_hint,
          assignments: userAssignments, created_at: p.created_at,
        };
      });
      setMembers(Object.values(memberMap));
    }
    setLoading(false);
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from('user_assignments').delete().eq('id', assignmentId);
    if (error) { toast.error('Failed to remove assignment'); return; }
    toast.success('Assignment removed');
    fetchTeam();
  };

  const callManageUser = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-user', { body: payload });
    if (error) { toast.error(error.message || 'Operation failed'); return false; }
    if (data?.error) { toast.error(data.error); return false; }
    return true;
  };

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member); setEditDisplayName(member.display_name);
    setEditPasswordHint(member.password_hint || ''); setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingMember) return;
    setEditSaving(true);
    const success = await callManageUser({ action: 'update_user', user_id: editingMember.user_id, display_name: editDisplayName, password_hint: editPasswordHint || null });
    setEditSaving(false);
    if (success) { toast.success('User updated'); setEditDialogOpen(false); fetchTeam(); }
  };

  const openPasswordDialog = (member: TeamMember) => {
    setPasswordMember(member); setNewPassword(''); setNewPasswordHint(member.password_hint || ''); setPasswordDialogOpen(true);
  };

  const handlePasswordChange = async () => {
    if (!passwordMember || !newPassword) return;
    setPasswordSaving(true);
    const success = await callManageUser({ action: 'change_password', user_id: passwordMember.user_id, new_password: newPassword, password_hint: newPasswordHint || null });
    setPasswordSaving(false);
    if (success) { toast.success('Password changed'); setPasswordDialogOpen(false); fetchTeam(); }
  };

  const handleDeleteUser = async (member: TeamMember) => {
    if (member.user_id === user?.id) { toast.error("Cannot delete your own account"); return; }
    if (!confirm(`Delete user "${member.display_name}"? This cannot be undone.`)) return;
    const success = await callManageUser({ action: 'delete_user', user_id: member.user_id });
    if (success) { toast.success('User deleted'); fetchTeam(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4" /></Button>
            <SnaponLogo size={24} showText={false} />
            <span className="font-semibold text-sm">Team Management</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Members</h1>
            <p className="text-muted-foreground text-sm">Manage user access, credentials, and assignments</p>
          </div>
          <CreateUserDialog patients={patients} onCreated={fetchTeam} />
        </div>

        {loading ? (
          <Card className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-1/3" /></CardHeader></Card>
        ) : members.length === 0 ? (
          <Card className="p-12 text-center">
            <UserCog className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No team members yet.</p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Assignments</TableHead>
                  <TableHead>Hint</TableHead><TableHead className="text-right">Joined</TableHead><TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(member => (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <div><div className="font-medium">{member.display_name}</div>
                        {member.user_id === user?.id && <span className="text-xs text-muted-foreground">(You)</span>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>{member.role}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.assignments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">{member.role === 'admin' ? 'Full access' : 'No assignments'}</span>
                        ) : member.assignments.map(a => (
                          <Badge key={a.id} variant="outline" className="gap-1 pr-1">
                            <span className="text-[10px] capitalize">{a.type}:</span>
                            <span className="text-[10px]">{a.type === 'patient' ? patients.find(p => p.id === a.value)?.patient_name || a.value : a.value}</span>
                            {a.expires_at && <span className="text-[9px] text-muted-foreground">exp:{format(new Date(a.expires_at), 'MM/dd')}</span>}
                            <button onClick={() => removeAssignment(a.id)} className="ml-0.5 hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{member.password_hint || '—'}</span></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{format(new Date(member.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(member)} title="Edit user"><Edit className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPasswordDialog(member)} title="Change password"><KeyRound className="w-3 h-3" /></Button>
                        {member.user_id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteUser(member)} title="Delete user"><Trash2 className="w-3 h-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle><DialogDescription>Update display name and password hint for {editingMember?.display_name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Display Name</Label><Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password Hint</Label><Input value={editPasswordHint} onChange={e => setEditPasswordHint(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editDisplayName.trim()}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Change Password</DialogTitle><DialogDescription>Set a new password for {passwordMember?.display_name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} /></div>
            <div className="space-y-2"><Label>Password Hint</Label><Input value={newPasswordHint} onChange={e => setNewPasswordHint(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={passwordSaving || newPassword.length < 6}>{passwordSaving ? 'Changing...' : 'Change Password'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
