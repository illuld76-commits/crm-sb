import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, X, Plus, Star } from 'lucide-react';

interface Assignment {
  type: 'patient' | 'clinic' | 'doctor' | 'lab' | 'company';
  value: string;
  expires_at: string | null;
  is_primary: boolean;
}

interface CreateUserDialogProps {
  patients: { id: string; patient_name: string }[];
  onCreated?: () => void;
}

export default function CreateUserDialog({ patients, onCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignType, setAssignType] = useState<'patient' | 'clinic' | 'doctor' | 'lab' | 'company'>('patient');
  const [assignValue, setAssignValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<{ id: string; entity_name: string; entity_type: string }[]>([]);

  useEffect(() => {
    supabase.from('settings_entities').select('*').order('entity_name').then(({ data }) => {
      setEntities(data || []);
    });
  }, [open]);

  const addAssignment = () => {
    if (!assignValue) return;
    if (assignments.some(a => a.type === assignType && a.value === assignValue)) {
      toast.error('Assignment already added');
      return;
    }
    setAssignments(prev => [...prev, {
      type: assignType,
      value: assignValue,
      expires_at: expiresAt || null,
    }]);
    setAssignValue('');
  };

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const getAssignmentOptions = () => {
    switch (assignType) {
      case 'patient':
        return patients.map(p => ({ value: p.id, label: p.patient_name }));
      case 'clinic':
        return entities.filter(e => e.entity_type === 'clinic').map(e => ({ value: e.entity_name, label: e.entity_name }));
      case 'doctor':
        return entities.filter(e => e.entity_type === 'doctor').map(e => ({ value: e.entity_name, label: e.entity_name }));
      case 'lab':
        return entities.filter(e => e.entity_type === 'lab').map(e => ({ value: e.entity_name, label: e.entity_name }));
      case 'company':
        return entities.filter(e => e.entity_type === 'company').map(e => ({ value: e.entity_name, label: e.entity_name }));
      default:
        return [];
    }
  };

  const handleCreate = async () => {
    if (!email || !password) return;
    if (assignments.length === 0) {
      toast.error('Add at least one assignment');
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          display_name: displayName || email,
          password_hint: passwordHint || null,
          assignments: assignments.map(a => ({
            type: a.type,
            value: a.value,
            expires_at: a.expires_at,
          })),
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`User ${email} created successfully`);
      setOpen(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setPasswordHint('');
      setExpiresAt('');
      setAssignments([]);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a user account with assigned access to patients, clinics, or doctors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="user@clinic.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="text" placeholder="Set password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input placeholder="Dr. Smith" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password Hint</Label>
              <Input placeholder="For your reference" value={passwordHint} onChange={e => setPasswordHint(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expiry Date (optional)</Label>
            <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">Applies to all assignments below</p>
          </div>

          <div className="space-y-2">
            <Label>Assign Access</Label>
            <div className="flex gap-2">
              <Select value={assignType} onValueChange={(v: 'patient' | 'clinic' | 'doctor' | 'lab' | 'company') => { setAssignType(v); setAssignValue(''); }}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
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
                  <span className="text-xs font-medium">
                    {a.type === 'patient' ? patients.find(p => p.id === a.value)?.patient_name || a.value : a.value}
                  </span>
                  {a.expires_at && <span className="text-[10px] text-muted-foreground">exp:{a.expires_at}</span>}
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
          <Button onClick={handleCreate} disabled={loading || !email || !password || assignments.length === 0} className="dental-gradient">
            {loading ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
