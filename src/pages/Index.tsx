import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import ClientDashboard from './ClientDashboard';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, isAdmin, isClient } = useRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Clients (lab, clinic, doctor, user) see ClientDashboard
  if (isClient) {
    return <ClientDashboard />;
  }

  // Admin sees full Dashboard
  return <Dashboard />;
};

export default Index;
