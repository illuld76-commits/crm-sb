import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SnaponLogo from '@/components/SnaponLogo';
import ThemeToggle from '@/components/ThemeToggle';

interface Entity {
  id: string;
  entity_name: string;
  entity_type: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState('doctor');

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/');
  }, [isAdmin, roleLoading]);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    const { data } = await supabase
      .from('settings_entities')
      .select('*')
      .order('entity_name');
    setEntities(data || []);
    setLoading(false);
  };

  const addEntity = async () => {
    if (!newName.trim() || !user) return;
    const { error } = await supabase.from('settings_entities').insert({
      entity_name: newName.trim(),
      entity_type: activeTab,
      user_id: user.id,
    });
    if (error) {
      toast.error('Failed to add');
      return;
    }
    toast.success('Added');
    setNewName('');
    fetchEntities();
  };

  const deleteEntity = async (id: string) => {
    const { error } = await supabase.from('settings_entities').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    setEntities(prev => prev.filter(e => e.id !== id));
    toast.success('Deleted');
  };

  const filtered = entities.filter(e => e.entity_type === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <SnaponLogo size={24} showText={false} />
            <span className="font-semibold text-sm">Settings</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Master Data</h1>
          <p className="text-muted-foreground text-sm">Manage doctors, clinics, and labs used across the platform</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setNewName(''); }}>
          <TabsList>
            <TabsTrigger value="doctor">Doctors</TabsTrigger>
            <TabsTrigger value="clinic">Clinics</TabsTrigger>
            <TabsTrigger value="lab">Labs</TabsTrigger>
            <TabsTrigger value="company">Companies</TabsTrigger>
          </TabsList>

          {['doctor', 'clinic', 'lab', 'company'].map(type => (
            <TabsContent key={type} value={type} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={`Add new ${type}...`}
                  value={activeTab === type ? newName : ''}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEntity()}
                />
                <Button onClick={addEntity} disabled={!newName.trim()} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No {type}s added yet
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filtered.map(e => (
                        <li key={e.id} className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm font-medium">{e.entity_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteEntity(e.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
