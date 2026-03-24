import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RelationalNavProvider } from "@/hooks/useRelationalNav";
import RelationalPreviewDrawer from "@/components/RelationalPreviewDrawer";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PatientDetail from "./pages/PatientDetail";
import PlanEditor from "./pages/PlanEditor";
import ReportView from "./pages/ReportView";
import JourneyView from "./pages/JourneyView";
import TeamManagement from "./pages/TeamManagement";
import AdminActivate from "./pages/AdminActivate";
import Settings from "./pages/Settings";
import GlobalKanban from "./pages/GlobalKanban";
import AuditLogs from "./pages/AuditLogs";
import CaseSubmission from "./pages/CaseSubmission";
import SubmittedCases from "./pages/SubmittedCases";
import AdminArchives from "./pages/AdminArchives";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import BillingList from "./pages/BillingList";
import PresetForms from "./pages/PresetForms";
import NotificationSettings from "./pages/NotificationSettings";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import Messages from "./pages/Messages";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RelationalNavProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <RelationalPreviewDrawer />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Index />} />
                    <Route path="patient/:id" element={<PatientDetail />} />
                    <Route path="plan/:id" element={<ProtectedRoute requireAdmin><PlanEditor /></ProtectedRoute>} />
                    <Route path="team" element={<ProtectedRoute requireAdmin><TeamManagement /></ProtectedRoute>} />
                    <Route path="kanban" element={<GlobalKanban />} />
                    <Route path="audit-logs" element={<AuditLogs />} />
                    <Route path="settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
                    <Route path="preset-forms" element={<ProtectedRoute requireAdmin><PresetForms /></ProtectedRoute>} />
                    <Route path="case-submission" element={<CaseSubmission />} />
                    <Route path="case-submission/:id" element={<CaseSubmission />} />
                    <Route path="submitted-cases" element={<SubmittedCases />} />
                    <Route path="work-order/:id" element={<WorkOrderDetail />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="archives" element={<ProtectedRoute requireAdmin><AdminArchives /></ProtectedRoute>} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="billing" element={<BillingList />} />
                    <Route path="billing/new" element={<ProtectedRoute requireAdmin><Billing /></ProtectedRoute>} />
                    <Route path="billing/:invoiceId" element={<Billing />} />
                    <Route path="notification-settings" element={<ProtectedRoute requireAdmin><NotificationSettings /></ProtectedRoute>} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="admin-activate" element={<AdminActivate />} />
                  </Route>
                  <Route path="/report/:token" element={<ReportView />} />
                  <Route path="/journey/:token" element={<JourneyView />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </RelationalNavProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
