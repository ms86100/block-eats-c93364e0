import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  MapPin,
  Phone,
  Store,
  Package,
  Heart,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, isSeller, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    { icon: Package, label: 'My Orders', to: '/orders' },
    { icon: Heart, label: 'Favorites', to: '/favorites' },
    ...(isSeller
      ? [{ icon: Store, label: 'Seller Dashboard', to: '/seller' }]
      : [{ icon: Store, label: 'Become a Seller', to: '/become-seller' }]),
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Panel', to: '/admin' }] : []),
  ];

  return (
    <AppLayout headerTitle="Profile" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="text-primary" size={32} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{profile?.name}</h2>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin size={14} />
                  <span>
                    Block {profile?.block}, {profile?.flat_number}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone size={14} />
                  <span>{profile?.phone}</span>
                </div>
              </div>
            </div>

            {profile?.verification_status === 'approved' && (
              <div className="mt-3 flex items-center gap-2 text-xs text-success">
                <Shield size={14} />
                <span>Verified Greenfield Resident</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map(({ icon: Icon, label, to }) => (
            <Link key={to} to={to}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Icon size={20} className="text-muted-foreground" />
                  </div>
                  <span className="flex-1 font-medium">{label}</span>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full mt-6"
          onClick={handleSignOut}
        >
          <LogOut size={18} className="mr-2" />
          Sign Out
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Greenfield Market v2.0.0 • Phase 2
        </p>
      </div>
    </AppLayout>
  );
}
