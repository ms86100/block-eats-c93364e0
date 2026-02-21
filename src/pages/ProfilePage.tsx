import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
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
  HelpCircle,
  Bell,
  Type,
  FileText,
  Camera,
  Repeat,
  Award,
} from 'lucide-react';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';
import { toast } from 'sonner';

const APP_VERSION = '2.0.0';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, society, isSeller, isAdmin, signOut, refreshProfile } = useAuth();
  const { isFeatureEnabled } = useEffectiveFeatures();
  const [largeFont, setLargeFont] = useState(() => {
    return localStorage.getItem('sociva_large_font') === 'true';
  });
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [skillBadges, setSkillBadges] = useState<{ skill_name: string; trust_score: number; endorsement_count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchBadges = async () => {
      const { data } = await supabase
        .from('skill_listings')
        .select('skill_name, trust_score, endorsement_count')
        .eq('user_id', user.id)
        .order('trust_score', { ascending: false })
        .limit(5);
      setSkillBadges(data || []);
    };
    fetchBadges();
  }, [user]);

  useEffect(() => {
    if (largeFont) document.documentElement.classList.add('large-font');
    else document.documentElement.classList.remove('large-font');
    localStorage.setItem('sociva_large_font', String(largeFont));
  }, [largeFont]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleAvatarChange = async (url: string | null) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile photo updated');
      setIsEditingAvatar(false);
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update profile photo');
    }
  };

  const quickActions = [
    { icon: Package, label: 'Orders', to: '/orders' },
    { icon: Heart, label: 'Favorites', to: '/favorites' },
    { icon: Repeat, label: 'Subscriptions', to: '/subscriptions' },
  ];

  const menuItems = [
    { icon: Award, label: 'Community Directory', to: '/directory' },
    ...(isSeller
      ? [{ icon: Store, label: 'Seller Dashboard', to: '/seller' }]
      : [{ icon: Store, label: 'Become a Seller', to: '/become-seller' }]),
    { icon: Bell, label: 'Notifications', to: '/notifications' },
    { icon: HelpCircle, label: 'Help & Guide', to: '/help' },
    { icon: FileText, label: 'Community Rules', to: '/community-rules' },
    { icon: Shield, label: 'Privacy Policy', to: '/privacy-policy' },
    { icon: FileText, label: 'Terms & Conditions', to: '/terms' },
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Panel', to: '/admin' }] : []),
  ];

  return (
    <AppLayout>
      <div className="pb-8">
        {/* Profile Header */}
        <div className="bg-card border-b border-border px-4 pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {isEditingAvatar && user ? (
                <div className="w-20">
                  <ImageUpload value={profile?.avatar_url} onChange={handleAvatarChange} folder="profiles" userId={user.id} aspectRatio="square" placeholder="Upload" />
                  <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setIsEditingAvatar(false)}>Cancel</Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingAvatar(true)}
                  className="w-16 h-16 rounded-full bg-muted flex items-center justify-center relative overflow-hidden group"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-muted-foreground" size={28} />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white" size={18} />
                  </div>
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{profile?.name}</h2>
              {society?.name && (
                <p className="text-xs text-primary font-medium mt-0.5">{society.name}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin size={12} />
                <span>{profile?.phase && `${profile.phase}, `}Block {profile?.block}, {profile?.flat_number}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone size={12} />
                <span>{profile?.phone}</span>
              </div>
            </div>
          </div>

          {profile?.verification_status === 'approved' && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-accent font-medium">
              <Shield size={12} />
              <span>Verified Resident</span>
            </div>
          )}

          {skillBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skillBadges.map((badge) => (
                <span key={badge.skill_name} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
                  <Award size={9} />
                  {badge.skill_name}
                  {badge.trust_score > 0 && <span className="text-muted-foreground">· {badge.trust_score}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions - 3 column */}
        <div className="grid grid-cols-3 gap-2.5 px-4 mt-4">
          {quickActions.map(({ icon: Icon, label, to }) => (
            <Link key={to} to={to}>
              <div className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Icon size={18} className="text-foreground" />
                </div>
                <span className="text-xs font-medium">{label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Access Cards */}
        <div className="px-4 mt-4 space-y-2">
          {isFeatureEnabled('resident_identity_verification') && (
            <Link to="/gate-entry">
              <div className="bg-card border border-border/40 rounded-2xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Shield className="text-primary-foreground" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-foreground">Gate Entry</h4>
                  <p className="text-[11px] text-muted-foreground">Show QR code to security</p>
                </div>
                <ChevronRight className="text-muted-foreground shrink-0" size={18} />
              </div>
            </Link>
          )}
          {!isSeller && (
            <Link to="/become-seller">
              <div className="bg-accent rounded-2xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-accent-foreground/20 flex items-center justify-center">
                  <Store className="text-accent-foreground" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-accent-foreground">Start Selling</h4>
                  <p className="text-[11px] text-accent-foreground/80">Share your homemade food with neighbors</p>
                </div>
                <ChevronRight className="text-accent-foreground/60 shrink-0" size={18} />
              </div>
            </Link>
          )}
        </div>

        {/* Accessibility */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Type size={16} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Larger Text</p>
              <p className="text-[11px] text-muted-foreground">Easier to read</p>
            </div>
          </div>
          <Switch checked={largeFont} onCheckedChange={setLargeFont} />
        </div>

        {/* Menu List */}
        <div className="mt-4 px-4 space-y-px">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">Your Information</p>
          {menuItems.map(({ icon: Icon, label, to }) => (
            <Link key={to} to={to}>
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors">
                <Icon size={18} className="text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
          <FeedbackSheet />
        </div>

        {/* Sign Out */}
        <div className="px-4 mt-6">
          <Button variant="outline" className="w-full" size="sm" onClick={handleSignOut}>
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Delete Account */}
        <div className="px-4 mt-3">
          <DeleteAccountDialog />
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">Sociva v{APP_VERSION}</p>
      </div>
    </AppLayout>
  );
}
