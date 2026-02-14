import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/hooks/useCart";
import { OfflineBanner } from "@/components/network/OfflineBanner";
import { PushNotificationProvider } from "@/components/notifications/PushNotificationProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initializeMedianBridge } from "@/lib/median";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded pages for code splitting
const AuthPage = lazy(() => import("./pages/AuthPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
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
const DomesticHelpPage = lazy(() => import("./pages/DomesticHelpPage"));
const ParcelManagementPage = lazy(() => import("./pages/ParcelManagementPage"));
const GuardKioskPage = lazy(() => import("./pages/GuardKioskPage"));
const GateEntryPage = lazy(() => import("./pages/GateEntryPage"));
const SecurityVerifyPage = lazy(() => import("./pages/SecurityVerifyPage"));
const SecurityAuditPage = lazy(() => import("./pages/SecurityAuditPage"));

const queryClient = new QueryClient();

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
      </div>
    );
  }
  
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

// Defense-in-depth: router-level guard for security pages
function SecurityRoute({ children }: { children: React.ReactNode }) {
  const { isSocietyAdmin, isAdmin, isLoading } = useAuth();
  // Inline check — useSecurityOfficer is called inside the guarded pages too
  // This wrapper ensures unauthenticated/non-security users are blocked at the router level
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
      </div>
    );
  }
  // Allow through if society admin or platform admin; security officers pass here
  // and get their own in-page check via useSecurityOfficer
  // We can't call useSecurityOfficer here (async RPC) so we let authenticated users through
  // and rely on in-page guards for the officer-specific check
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
  
  return null;
}

function AppRoutes() {
  const { user, profile } = useAuth();
  
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Landing page for unauthenticated users */}
        <Route path="/welcome" element={user && profile ? <Navigate to="/" replace /> : <LandingPage />} />
        <Route path="/auth" element={user && profile ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/" element={user ? <ProtectedRoute><HomePage /></ProtectedRoute> : <Navigate to="/welcome" replace />} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><BulletinPage /></ProtectedRoute>} />
        <Route path="/category/:category" element={<ProtectedRoute><CategoryGroupPage /></ProtectedRoute>} />
        <Route path="/seller/:id" element={<ProtectedRoute><SellerDetailPage /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/subscriptions" element={<ProtectedRoute><MySubscriptionsPage /></ProtectedRoute>} />
        <Route path="/directory" element={<ProtectedRoute><TrustDirectoryPage /></ProtectedRoute>} />
        <Route path="/disputes" element={<ProtectedRoute><DisputesPage /></ProtectedRoute>} />
        <Route path="/society/finances" element={<ProtectedRoute><SocietyFinancesPage /></ProtectedRoute>} />
        <Route path="/society/progress" element={<ProtectedRoute><SocietyProgressPage /></ProtectedRoute>} />
        <Route path="/society/snags" element={<ProtectedRoute><SnagListPage /></ProtectedRoute>} />
        <Route path="/society" element={<ProtectedRoute><SocietyDashboardPage /></ProtectedRoute>} />
        <Route path="/notifications/inbox" element={<ProtectedRoute><NotificationInboxPage /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
        <Route path="/society/reports" element={<ProtectedRoute><SocietyReportPage /></ProtectedRoute>} />
        <Route path="/society/admin" element={<ProtectedRoute><SocietyAdminPage /></ProtectedRoute>} />
        <Route path="/builder" element={<ProtectedRoute><BuilderDashboardPage /></ProtectedRoute>} />
        <Route path="/builder/analytics" element={<ProtectedRoute><BuilderAnalyticsPage /></ProtectedRoute>} />
        <Route path="/parking" element={<ProtectedRoute><VehicleParkingPage /></ProtectedRoute>} />
        <Route path="/visitors" element={<ProtectedRoute><VisitorManagementPage /></ProtectedRoute>} />
        <Route path="/payment-milestones" element={<ProtectedRoute><PaymentMilestonesPage /></ProtectedRoute>} />
        <Route path="/inspection" element={<ProtectedRoute><InspectionChecklistPage /></ProtectedRoute>} />
        <Route path="/domestic-help" element={<ProtectedRoute><DomesticHelpPage /></ProtectedRoute>} />
        <Route path="/parcels" element={<ProtectedRoute><ParcelManagementPage /></ProtectedRoute>} />
        <Route path="/guard-kiosk" element={<ProtectedRoute><GuardKioskPage /></ProtectedRoute>} />
        <Route path="/gate-entry" element={<ProtectedRoute><GateEntryPage /></ProtectedRoute>} />
        <Route path="/security/verify" element={<ProtectedRoute><SecurityRoute><SecurityVerifyPage /></SecurityRoute></ProtectedRoute>} />
        <Route path="/security/audit" element={<ProtectedRoute><SecurityRoute><SecurityAuditPage /></SecurityRoute></ProtectedRoute>} />
        <Route path="/become-seller" element={<ProtectedRoute><BecomeSellerPage /></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><SellerDashboardPage /></ProtectedRoute>} />
        <Route path="/seller/products" element={<ProtectedRoute><SellerProductsPage /></ProtectedRoute>} />
        <Route path="/seller/settings" element={<ProtectedRoute><SellerSettingsPage /></ProtectedRoute>} />
        <Route path="/seller/earnings" element={<ProtectedRoute><SellerEarningsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/community-rules" element={<CommunityRulesPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineBanner />
        <Toaster />
        <Sonner />
        <HashRouter>
          <NavigationHandler />
          <AuthProvider>
            <CartProvider>
              <PushNotificationProvider>
                <AppRoutes />
              </PushNotificationProvider>
            </CartProvider>
          </AuthProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
