import { useEffect } from "react";
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

// Pages
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import SellerDetailPage from "./pages/SellerDetailPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import FavoritesPage from "./pages/FavoritesPage";
import BecomeSellerPage from "./pages/BecomeSellerPage";
import SellerDashboardPage from "./pages/SellerDashboardPage";
import SellerProductsPage from "./pages/SellerProductsPage";
import SellerSettingsPage from "./pages/SellerSettingsPage";
import SellerEarningsPage from "./pages/SellerEarningsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import CategoryGroupPage from "./pages/CategoryGroupPage";
import PricingPage from "./pages/PricingPage";
import HelpPage from "./pages/HelpPage";
import NotificationsPage from "./pages/NotificationsPage";
import CommunityRulesPage from "./pages/CommunityRulesPage";
import BulletinPage from "./pages/BulletinPage";
const queryClient = new QueryClient();

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
