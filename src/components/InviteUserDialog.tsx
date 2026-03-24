import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { UserPlus, X, Plus } from 'lucide-react';

interface Assignment {
  type: 'patient' | 'clinic' | 'doctor';
  value: string;
}

interface InviteUserDialogProps {
  patients: { id: string; patient_name: string }[];
  clinics: string[];
  doctors: string[];
  onInvited?: () => void;
}

export default function InviteUserDialog({ patients, clinics, doctors, onInvited }: InviteUserDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignType, setAssignType] = useState<'patient' | 'clinic' | 'doctor'>('patient');
  const [assignValue, setAssignValue] = useState('');
  const [loading, setLoading] = useState(false);

  const addAssignment = () => {
    if (!assignValue) return;
    if (assignments.some(a => a.type === assignType && a.value === assignValue)) {
      toast.error('Assignment already added');
      return;
    }
    setAssignments(prev => [...prev, { type: assignType, value: assignValue }]);
    setAssignValue('');
  };

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInvite = async () => {
    if (!email || !user) return;
    if (assignments.length === 0) {
      toast.error('Add at least one assignment');
      return;
    }

    setLoading(true);
    try {
      // 1. Create user with invited_role metadata via admin invite (or signUp with metadata)
      // For now, we'll use signUp with metadata. In production, you'd use admin API.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(), // Temp password, user will reset
        options: {
          data: {
            display_name: displayName || email,
            invited_role: 'user',
          },
          emailRedirectTo: window.location.origin + '/auth',
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // 2. Create assignments
      const assignmentInserts = assignments.map(a => ({
        user_id: authData.user!.id,
        assignment_type: a.type,
        assignment_value: a.value,
        assigned_by: user.id,
      }));

      const { error: assignError } = await supabase
        .from('user_assignments')
        .insert(assignmentInserts);

      if (assignError) throw assignError;

      toast.success(`Invitation sent to ${email}`);
      setOpen(false);
      setEmail('');
      setDisplayName('');
      setAssignments([]);
      onInvited?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite user');
    }
    setLoading(false);
  };

  const getAssignmentOptions = () => {
    switch (assignType) {
      case 'patient':
        return patients.map(p => ({ value: p.id, label: p.patient_name }));
      case 'clinic':
        return clinics.map(c => ({ value: c, label: c }));
      case 'doctor':
        return doctors.map(d => ({ value: d, label: d }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Invite a user with view-only access to assigned patients, clinics, or doctors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              placeholder="John Smith"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign Access</Label>
            <div className="flex gap-2">
              <Select value={assignType} onValueChange={(v: 'patient' | 'clinic' | 'doctor') => { setAssignType(v); setAssignValue(''); }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignValue} onValueChange={setAssignValue}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select ${assignType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {getAssignmentOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={addAssignment} disabled={!assignValue}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {assignments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {assignments.map((a, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  <span className="text-xs capitalize">{a.type}:</span>
                  <span className="text-xs font-medium">{a.type === 'patient' ? patients.find(p => p.id === a.value)?.patient_name || a.value : a.value}</span>
                  <button onClick={() => removeAssignment(i)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={loading || !email || assignments.length === 0} className="dental-gradient">
            {loading ? 'Sending...' : 'Send Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
