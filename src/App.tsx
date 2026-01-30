import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/hooks/useCart";

// Pages
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import SellerDetailPage from "./pages/SellerDetailPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import BecomeSellerPage from "./pages/BecomeSellerPage";
import SellerDashboardPage from "./pages/SellerDashboardPage";
import SellerProductsPage from "./pages/SellerProductsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

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
  
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile } = useAuth();
  
  return (
    <Routes>
      <Route path="/auth" element={user && profile ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/category/:category" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
      <Route path="/seller/:id" element={<ProtectedRoute><SellerDetailPage /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/become-seller" element={<ProtectedRoute><BecomeSellerPage /></ProtectedRoute>} />
      <Route path="/seller" element={<ProtectedRoute><SellerDashboardPage /></ProtectedRoute>} />
      <Route path="/seller/products" element={<ProtectedRoute><SellerProductsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
