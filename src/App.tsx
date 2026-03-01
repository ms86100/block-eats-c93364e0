import React, { useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdentityContext as IdentityCtx, SellerContext as SellerCtx } from "@/contexts/auth/contexts";

import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/hooks/useCart";
import { OfflineBanner } from "@/components/network/OfflineBanner";
import { PushNotificationProvider } from "@/components/notifications/PushNotificationProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { GlobalHapticListener } from "@/components/haptics/GlobalHapticListener";
import { initializeMedianBridge } from "@/lib/median";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { useSecurityOfficer } from "@/hooks/useSecurityOfficer";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { useBuyerOrderAlerts } from "@/hooks/useBuyerOrderAlerts";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { NewOrderAlertOverlay } from "@/components/seller/NewOrderAlertOverlay";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded pages for code splitting
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const WelcomeCarousel = lazy(() => import("./pages/WelcomeCarousel"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));

const SellerDetailPage = lazy(() => import("./pages/SellerDetailPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const BecomeSellerPage = lazy(() => import("./pages/BecomeSellerPage"));
const SellerDashboardPage = lazy(() => import("./pages/SellerDashboardPage"));
const SellerProductsPage = lazy(() => import("./pages/SellerProductsPage"));
const SellerSettingsPage = lazy(() => import("./pages/SellerSettingsPage"));
const SellerEarningsPage = lazy(() => import("./pages/SellerEarningsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CategoryGroupPage = lazy(() => import("./pages/CategoryGroupPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const CommunityRulesPage = lazy(() => import("./pages/CommunityRulesPage"));
const BulletinPage = lazy(() => import("./pages/BulletinPage"));
const MySubscriptionsPage = lazy(() => import("./pages/MySubscriptionsPage"));
const TrustDirectoryPage = lazy(() => import("./pages/TrustDirectoryPage"));
const DisputesPage = lazy(() => import("./pages/DisputesPage"));
const SocietyFinancesPage = lazy(() => import("./pages/SocietyFinancesPage"));
const SocietyProgressPage = lazy(() => import("./pages/SocietyProgressPage"));
const SnagListPage = lazy(() => import("./pages/SnagListPage"));
const SocietyDashboardPage = lazy(() => import("./pages/SocietyDashboardPage"));
const NotificationInboxPage = lazy(() => import("./pages/NotificationInboxPage"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));
const SocietyReportPage = lazy(() => import("./pages/SocietyReportPage"));
const SocietyAdminPage = lazy(() => import("./pages/SocietyAdminPage"));
const BuilderDashboardPage = lazy(() => import("./pages/BuilderDashboardPage"));
const BuilderAnalyticsPage = lazy(() => import("./pages/BuilderAnalyticsPage"));
const VehicleParkingPage = lazy(() => import("./pages/VehicleParkingPage"));
const VisitorManagementPage = lazy(() => import("./pages/VisitorManagementPage"));
const PaymentMilestonesPage = lazy(() => import("./pages/PaymentMilestonesPage"));
const InspectionChecklistPage = lazy(() => import("./pages/InspectionChecklistPage"));

const WorkforceManagementPage = lazy(() => import("./pages/WorkforceManagementPage"));
const ParcelManagementPage = lazy(() => import("./pages/ParcelManagementPage"));
const GuardKioskPage = lazy(() => import("./pages/GuardKioskPage"));
const GateEntryPage = lazy(() => import("./pages/GateEntryPage"));

const SecurityAuditPage = lazy(() => import("./pages/SecurityAuditPage"));
const WorkerJobsPage = lazy(() => import("./pages/WorkerJobsPage"));
const WorkerMyJobsPage = lazy(() => import("./pages/WorkerMyJobsPage"));
const WorkerHirePage = lazy(() => import("./pages/WorkerHirePage"));
const CreateJobRequestPage = lazy(() => import("./pages/CreateJobRequestPage"));
const SocietyNoticesPage = lazy(() => import("./pages/SocietyNoticesPage"));
const SocietyDeliveriesPage = lazy(() => import("./pages/SocietyDeliveriesPage"));
const DeliveryPartnerManagementPage = lazy(() => import("./pages/DeliveryPartnerManagementPage"));
const DeliveryPartnerDashboardPage = lazy(() => import("./pages/DeliveryPartnerDashboardPage"));
const WorkerAttendancePage = lazy(() => import("./pages/WorkerAttendancePage"));
const MyWorkersPage = lazy(() => import("./pages/MyWorkersPage"));
const WorkerLeavePage = lazy(() => import("./pages/WorkerLeavePage"));
const WorkerSalaryPage = lazy(() => import("./pages/WorkerSalaryPage"));
const AuthorizedPersonsPage = lazy(() => import("./pages/AuthorizedPersonsPage"));
const BuilderInspectionsPage = lazy(() => import("./pages/BuilderInspectionsPage"));
const TestResultsPage = lazy(() => import("./pages/TestResultsPage"));
const CollectiveBuyPage = lazy(() => import("./pages/CollectiveBuyPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));

/**
 * Detect if an error is caused by an expired/invalid auth session.
 * Covers Supabase JWT errors, PostgREST 401s, and common auth error messages.
 */
function isAuthSessionError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const authPatterns = [
    'JWT expired', 'jwt expired', 'invalid claim', 'token is expired',
    'not authenticated', 'Invalid Refresh Token', 'Refresh Token Not Found',
    'Auth session missing', 'session_not_found',
  ];
  if (authPatterns.some(p => msg.toLowerCase().includes(p.toLowerCase()))) return true;
  // PostgREST / Supabase HTTP errors
  if ((error as any)?.code === 'PGRST301') return true;
  if ((error as any)?.status === 401 || (error as any)?.status === 403) return true;
  return false;
}

let authRedirectScheduled = false;
function handleAuthError() {
  if (authRedirectScheduled) return; // prevent flood
  authRedirectScheduled = true;
  toast.error('Your session has expired. Please log in again.');
  // Sign out and redirect after a brief delay to let toast render
  supabase.auth.signOut().finally(() => {
    window.location.hash = '#/auth';
    // Reset flag after navigation
    setTimeout(() => { authRedirectScheduled = false; }, 3000);
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.error('[Query Error]', error);
      if (isAuthSessionError(error)) {
        handleAuthError();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('[Mutation Error]', error);
      if (isAuthSessionError(error)) {
        handleAuthError();
        return;
      }
      const message = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors — they won't self-heal
        if (isAuthSessionError(error)) return false;
        return failureCount < 1;
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="min-h-[100dvh] bg-background p-4 space-y-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Skeleton className="h-6 w-32 rounded-lg" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Skeleton className="h-6 w-32 rounded-lg" />
      </div>
    );
  }
  
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

// Defense-in-depth: router-level guard for security pages
function SecurityRoute({ children }: { children: React.ReactNode }) {
  const { isSocietyAdmin, isAdmin, isLoading: authLoading } = useAuth();
  const { isSecurityOfficer, isLoading: officerLoading } = useSecurityOfficer();

  if (authLoading || officerLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Skeleton className="h-6 w-32 rounded-lg" />
      </div>
    );
  }

  if (!isSocietyAdmin && !isAdmin && !isSecurityOfficer) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Route guard for society admins
function SocietyAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSocietyAdmin, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Skeleton className="h-6 w-32 rounded-lg" /></div>;
  if (!isSocietyAdmin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Route guard for builder members
function BuilderRoute({ children }: { children: React.ReactNode }) {
  const { isBuilderMember, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Skeleton className="h-6 w-32 rounded-lg" /></div>;
  if (!isBuilderMember && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Route guard for society management pages (society admin, builder, or platform admin)
function ManagementRoute({ children }: { children: React.ReactNode }) {
  const { isSocietyAdmin, isBuilderMember, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Skeleton className="h-6 w-32 rounded-lg" /></div>;
  if (!isSocietyAdmin && !isBuilderMember && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Route guard for seller-only pages
function SellerRoute({ children }: { children: React.ReactNode }) {
  const { isSeller, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Skeleton className="h-6 w-32 rounded-lg" /></div>;
  if (!isSeller && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Route guard for worker-only pages
function WorkerRoute({ children }: { children: React.ReactNode }) {
  const { roles, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Skeleton className="h-6 w-32 rounded-lg" /></div>;
  if (!roles.includes('worker') && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Median.co SPA Navigation Handler + Deep Links
function NavigationHandler() {
  const navigate = useNavigate();
  
  // Initialize Median bridge for SPA navigation
  useEffect(() => {
    const cleanup = initializeMedianBridge(navigate);
    return cleanup;
  }, [navigate]);
  
  // Handle Capacitor deep links
  useDeepLinks();

  // Invalidate critical queries on mobile app foreground resume
  useAppLifecycle();

  return null;
}

function GlobalSellerAlert() {
  // Use raw useContext with null-safety to avoid fatal crash if AuthProvider
  // hasn't fully initialized yet (HMR / startup race condition).
  const identity = React.useContext(IdentityCtx);
  const seller = React.useContext(SellerCtx);
  const isSeller = seller?.isSeller ?? false;
  const currentSellerId = seller?.currentSellerId ?? null;
  const { pendingAlerts, dismiss, snooze } = useNewOrderAlert(isSeller ? currentSellerId : null);
  if (!identity) return null;
  return <NewOrderAlertOverlay orders={pendingAlerts} onDismiss={dismiss} onSnooze={snooze} />;
}

/** Error boundary that silently swallows GlobalSellerAlert crashes */
class SafeSellerAlert extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { console.error('[SafeSellerAlert] Contained crash:', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

function AppRoutes() {
  const { user, profile } = useAuth();

  // Real-time buyer order status alerts (toast + haptic)
  useBuyerOrderAlerts();
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Landing page for unauthenticated users */}
        <Route path="/welcome" element={user && profile ? <Navigate to="/" replace /> : <WelcomeCarousel />} />
        <Route path="/landing" element={user && profile ? <Navigate to="/" replace /> : <LandingPage />} />
        <Route path="/auth" element={user && profile ? <Navigate to="/" replace /> : <RouteErrorBoundary sectionName="Authentication"><AuthPage /></RouteErrorBoundary>} />
        <Route path="/reset-password" element={<RouteErrorBoundary sectionName="Reset Password"><ResetPasswordPage /></RouteErrorBoundary>} />
        <Route path="/" element={user ? <ProtectedRoute><HomePage /></ProtectedRoute> : <Navigate to="/landing" replace />} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><BulletinPage /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
        <Route path="/category/:category" element={<ProtectedRoute><CategoryGroupPage /></ProtectedRoute>} />
        <Route path="/seller/:id" element={<ProtectedRoute><SellerDetailPage /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><RouteErrorBoundary sectionName="Cart"><CartPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/subscriptions" element={<ProtectedRoute><MySubscriptionsPage /></ProtectedRoute>} />
        <Route path="/directory" element={<ProtectedRoute><TrustDirectoryPage /></ProtectedRoute>} />
        <Route path="/disputes" element={<ProtectedRoute><DisputesPage /></ProtectedRoute>} />
        <Route path="/group-buys" element={<ProtectedRoute><CollectiveBuyPage /></ProtectedRoute>} />
        <Route path="/society/finances" element={<ProtectedRoute><RouteErrorBoundary sectionName="Society Finances"><SocietyFinancesPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/society/progress" element={<ProtectedRoute><RouteErrorBoundary sectionName="Construction Progress"><SocietyProgressPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/society/snags" element={<ProtectedRoute><RouteErrorBoundary sectionName="Snag List"><SnagListPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/society" element={<ProtectedRoute><RouteErrorBoundary sectionName="Society Dashboard"><SocietyDashboardPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/notifications/inbox" element={<ProtectedRoute><NotificationInboxPage /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><RouteErrorBoundary sectionName="Maintenance"><MaintenancePage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/society/reports" element={<ProtectedRoute><RouteErrorBoundary sectionName="Society Reports"><SocietyReportPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/society/admin" element={<ProtectedRoute><SocietyAdminRoute><RouteErrorBoundary sectionName="Society Admin"><SocietyAdminPage /></RouteErrorBoundary></SocietyAdminRoute></ProtectedRoute>} />
        <Route path="/builder" element={<ProtectedRoute><BuilderRoute><RouteErrorBoundary sectionName="Builder Dashboard"><BuilderDashboardPage /></RouteErrorBoundary></BuilderRoute></ProtectedRoute>} />
        <Route path="/builder/analytics" element={<ProtectedRoute><BuilderRoute><RouteErrorBoundary sectionName="Builder Analytics"><BuilderAnalyticsPage /></RouteErrorBoundary></BuilderRoute></ProtectedRoute>} />
        <Route path="/parking" element={<ProtectedRoute><VehicleParkingPage /></ProtectedRoute>} />
        <Route path="/visitors" element={<ProtectedRoute><VisitorManagementPage /></ProtectedRoute>} />
        <Route path="/payment-milestones" element={<ProtectedRoute><PaymentMilestonesPage /></ProtectedRoute>} />
        <Route path="/inspection" element={<ProtectedRoute><InspectionChecklistPage /></ProtectedRoute>} />
        <Route path="/domestic-help" element={<Navigate to="/workforce" replace />} />
        <Route path="/workforce" element={<ProtectedRoute><WorkforceManagementPage /></ProtectedRoute>} />
        <Route path="/parcels" element={<ProtectedRoute><ParcelManagementPage /></ProtectedRoute>} />
        <Route path="/guard-kiosk" element={<ProtectedRoute><SecurityRoute><GuardKioskPage /></SecurityRoute></ProtectedRoute>} />
        <Route path="/gate-entry" element={<ProtectedRoute><GateEntryPage /></ProtectedRoute>} />
        <Route path="/security/verify" element={<Navigate to="/guard-kiosk" replace />} />
        <Route path="/security/audit" element={<ProtectedRoute><SecurityRoute><SecurityAuditPage /></SecurityRoute></ProtectedRoute>} />
        <Route path="/worker/jobs" element={<ProtectedRoute><WorkerRoute><WorkerJobsPage /></WorkerRoute></ProtectedRoute>} />
        <Route path="/worker/my-jobs" element={<ProtectedRoute><WorkerRoute><WorkerMyJobsPage /></WorkerRoute></ProtectedRoute>} />
        <Route path="/worker-hire" element={<ProtectedRoute><WorkerHirePage /></ProtectedRoute>} />
        <Route path="/worker-hire/create" element={<ProtectedRoute><CreateJobRequestPage /></ProtectedRoute>} />
        <Route path="/society/notices" element={<ProtectedRoute><SocietyNoticesPage /></ProtectedRoute>} />
        <Route path="/society/deliveries" element={<ProtectedRoute><SocietyDeliveriesPage /></ProtectedRoute>} />
        <Route path="/delivery-partners" element={<ProtectedRoute><ManagementRoute><DeliveryPartnerManagementPage /></ManagementRoute></ProtectedRoute>} />
        <Route path="/my-deliveries" element={<ProtectedRoute><ManagementRoute><DeliveryPartnerDashboardPage /></ManagementRoute></ProtectedRoute>} />
        <Route path="/worker-attendance" element={<ProtectedRoute><ManagementRoute><WorkerAttendancePage /></ManagementRoute></ProtectedRoute>} />
        <Route path="/my-workers" element={<ProtectedRoute><MyWorkersPage /></ProtectedRoute>} />
        <Route path="/worker-leave" element={<ProtectedRoute><ManagementRoute><WorkerLeavePage /></ManagementRoute></ProtectedRoute>} />
        <Route path="/worker-salary" element={<ProtectedRoute><ManagementRoute><WorkerSalaryPage /></ManagementRoute></ProtectedRoute>} />
        <Route path="/authorized-persons" element={<ProtectedRoute><AuthorizedPersonsPage /></ProtectedRoute>} />
        <Route path="/builder-inspections" element={<ProtectedRoute><BuilderRoute><BuilderInspectionsPage /></BuilderRoute></ProtectedRoute>} />
        <Route path="/become-seller" element={<ProtectedRoute><RouteErrorBoundary sectionName="Seller Onboarding"><BecomeSellerPage /></RouteErrorBoundary></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><SellerRoute><RouteErrorBoundary sectionName="Seller Dashboard"><SellerDashboardPage /></RouteErrorBoundary></SellerRoute></ProtectedRoute>} />
        <Route path="/seller/products" element={<ProtectedRoute><SellerRoute><RouteErrorBoundary sectionName="Products"><SellerProductsPage /></RouteErrorBoundary></SellerRoute></ProtectedRoute>} />
        <Route path="/seller/settings" element={<ProtectedRoute><SellerRoute><RouteErrorBoundary sectionName="Seller Settings"><SellerSettingsPage /></RouteErrorBoundary></SellerRoute></ProtectedRoute>} />
        <Route path="/seller/earnings" element={<ProtectedRoute><SellerRoute><RouteErrorBoundary sectionName="Earnings"><SellerEarningsPage /></RouteErrorBoundary></SellerRoute></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
        <Route path="/test-results" element={<ProtectedRoute><AdminRoute><TestResultsPage /></AdminRoute></ProtectedRoute>} />
        <Route path="/api-docs" element={<ProtectedRoute><AdminRoute><ApiDocsPage /></AdminRoute></ProtectedRoute>} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/community-rules" element={<CommunityRulesPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  // Listen for cache-clear event dispatched by signOut
  useEffect(() => {
    const handler = () => queryClient.clear();
    window.addEventListener('app:clear-cache', handler);
    return () => window.removeEventListener('app:clear-cache', handler);
  }, []);

  // Global safety net — only log, don't toast for every rejection.
  // Auth init, realtime, and network retries produce benign rejections
  // that should not alarm users.
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || '');

      // Suppress known benign rejections (auth, network, realtime)
      const benign = [
        'Failed to fetch', 'NetworkError', 'Load failed',
        'JWT expired', 'Auth session missing', 'session_not_found',
        'Invalid Refresh Token', 'AbortError', 'REALTIME',
        'not authenticated', 'AuthRetryableFetchError',
        'AuthSessionMissingError', 'AuthApiError',
      ];
      const isBenign = benign.some(p => msg.includes(p));

      console.error('[Unhandled Rejection]', reason);
      // Never show a generic toast — it's not actionable for users.
      // Specific error handling belongs in the components that trigger the action.
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.error('[Unhandled Error]', event.error || event.message);
      // Don't toast — ErrorBoundary handles render errors,
      // and network/script errors shouldn't alarm users.
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <OfflineBanner />
            <Toaster />
            <Sonner />
            <HashRouter>
              <GlobalHapticListener />
              <AuthProvider>
                <NavigationHandler />
                <CartProvider>
                  <PushNotificationProvider>
                    <SafeSellerAlert><GlobalSellerAlert /></SafeSellerAlert>
                    <AppRoutes />
                  </PushNotificationProvider>
                </CartProvider>
              </AuthProvider>
            </HashRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
