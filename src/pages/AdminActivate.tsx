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

export default function AdminActivate() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [licenseToken, setLicenseToken] = useState('');
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

  const handleActivate = async () => {
    if (!licenseToken.trim()) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        setLoading(false);
        return;
      }

      const res = await supabase.functions.invoke('validate-license', {
        body: { license_token: licenseToken.trim() },
      });

      if (res.error) {
        toast.error(res.error.message || 'License validation failed');
      } else if (res.data?.success) {
        toast.success('Admin access activated! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        toast.error(res.data?.error || 'License validation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to validate license');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center flex flex-col items-center gap-2">
          <SnaponLogo size={48} showText={false} />
          <h1 className="text-2xl font-bold">Admin Activation</h1>
          <p className="text-muted-foreground text-sm">Enter your license token to activate admin access</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              License Token
            </CardTitle>
            <CardDescription>
              Paste the license token generated for your email ({user.email})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              onClick={handleActivate}
              disabled={loading || !licenseToken.trim()}
              className="w-full dental-gradient"
            >
              {loading ? 'Validating...' : 'Activate Admin Access'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
