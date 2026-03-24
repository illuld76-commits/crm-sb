import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Save, User } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name || '');
        setClinicName(data.clinic_name || '');
      }
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ display_name: displayName, clinic_name: clinicName }).eq('user_id', user.id);
    if (!error) toast.success('Profile updated');
    else toast.error('Failed to update profile');
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="My Profile" />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader className="items-center">
            <Avatar className="w-16 h-16">
              <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
            </Avatar>
            <CardTitle>{displayName || user?.email}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Display Name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Clinic Name</Label><Input value={clinicName} onChange={e => setClinicName(e.target.value)} /></div>
            <Button onClick={save} disabled={saving} className="w-full gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
