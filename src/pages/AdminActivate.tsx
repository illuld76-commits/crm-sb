import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import SnaponLogo from '@/components/SnaponLogo';
import { Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminActivate() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [licenseToken, setLicenseToken] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleActivateWithToken = async () => {
    if (!licenseToken.trim()) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('validate-license', {
        body: { license_token: licenseToken.trim() },
      });
      if (res.error) {
        toast.error(res.error.message || 'License validation failed');
      } else if (res.data?.success) {
        toast.success('Admin access activated! Redirecting...');
        setTimeout(() => { window.location.href = '/'; }, 1500);
      } else {
        toast.error(res.data?.error || 'License validation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to validate license');
    }
    setLoading(false);
  };

  const handleBootstrap = async () => {
    if (!masterPassword.trim()) return;
    setLoading(true);
    try {
      // Step 1: Generate license token server-side
      const genRes = await supabase.functions.invoke('generate-license', {
        body: { email: user.email, master_password: masterPassword.trim() },
      });
      if (genRes.error || !genRes.data?.token) {
        toast.error(genRes.data?.error || genRes.error?.message || 'Failed to generate license');
        setLoading(false);
        return;
      }
      // Step 2: Validate it
      const valRes = await supabase.functions.invoke('validate-license', {
        body: { license_token: genRes.data.token },
      });
      if (valRes.error) {
        toast.error(valRes.error.message || 'License validation failed');
      } else if (valRes.data?.success) {
        toast.success('Admin access activated! Redirecting...');
        setTimeout(() => { window.location.href = '/'; }, 1500);
      } else {
        toast.error(valRes.data?.error || 'License validation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center flex flex-col items-center gap-2">
          <SnaponLogo size={48} showText={false} />
          <h1 className="text-2xl font-bold">Admin Activation</h1>
          <p className="text-muted-foreground text-sm">Activate admin access for {user.email}</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <Tabs defaultValue="bootstrap">
            <CardHeader className="pb-2">
              <TabsList className="w-full">
                <TabsTrigger value="bootstrap" className="flex-1">Quick Setup</TabsTrigger>
                <TabsTrigger value="token" className="flex-1">License Token</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="bootstrap">
              <CardContent className="space-y-4 pt-2">
                <CardDescription>
                  Enter the master password to activate admin. Default: <code className="text-xs bg-muted px-1 py-0.5 rounded">admin-bootstrap-2024</code>
                </CardDescription>
                <div className="space-y-2">
                  <Label>Master Password</Label>
                  <Input
                    type="password"
                    value={masterPassword}
                    onChange={e => setMasterPassword(e.target.value)}
                    placeholder="Enter master password..."
                  />
                </div>
                <Button
                  onClick={handleBootstrap}
                  disabled={loading || !masterPassword.trim()}
                  className="w-full dental-gradient"
                >
                  {loading ? 'Activating...' : 'Activate Admin Access'}
                </Button>
              </CardContent>
            </TabsContent>

            <TabsContent value="token">
              <CardContent className="space-y-4 pt-2">
                <CardDescription>
                  Paste a pre-generated license token
                </CardDescription>
                <div className="space-y-2">
                  <Label>License Token</Label>
                  <Input
                    value={licenseToken}
                    onChange={e => setLicenseToken(e.target.value)}
                    placeholder="Paste your license token here..."
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  onClick={handleActivateWithToken}
                  disabled={loading || !licenseToken.trim()}
                  className="w-full dental-gradient"
                >
                  {loading ? 'Validating...' : 'Activate with Token'}
                </Button>
              </CardContent>
            </TabsContent>
          </Tabs>

          <CardContent className="pt-0">
            <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
