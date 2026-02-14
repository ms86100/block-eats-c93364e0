import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
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
  HelpCircle,
  Bell,
  Type,
  FileText,
  Camera,
  Repeat,
  Award,
  ShieldAlert,
  IndianRupee,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, society, isSeller, isAdmin, signOut, refreshProfile } = useAuth();
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
    if (largeFont) {
      document.documentElement.classList.add('large-font');
    } else {
      document.documentElement.classList.remove('large-font');
    }
    localStorage.setItem('sociva_large_font', String(largeFont));
  }, [largeFont]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleAvatarChange = async (url: string | null) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success('Profile photo updated');
      setIsEditingAvatar(false);
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update profile photo');
    }
  };

  const menuItems = [
    { icon: Package, label: 'My Orders', to: '/orders' },
    { icon: Heart, label: 'Favorites', to: '/favorites' },
    { icon: Repeat, label: 'My Subscriptions', to: '/subscriptions' },
    { icon: Award, label: 'Community Directory', to: '/directory' },
    { icon: ShieldAlert, label: 'My Concerns', to: '/disputes' },
    { icon: IndianRupee, label: 'Society Finances', to: '/society/finances' },
    { icon: Building2, label: 'Construction Progress', to: '/society/progress' },
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
    <AppLayout headerTitle="Profile" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {isEditingAvatar && user ? (
                  <div className="w-20">
                    <ImageUpload
                      value={profile?.avatar_url}
                      onChange={handleAvatarChange}
                      folder="profiles"
                      userId={user.id}
                      aspectRatio="square"
                      placeholder="Upload"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 text-xs"
                      onClick={() => setIsEditingAvatar(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingAvatar(true)}
                    className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden group"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="text-primary" size={32} />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="text-white" size={20} />
                    </div>
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{profile?.name}</h2>
                {society?.name && (
                  <p className="text-xs text-primary font-medium mt-0.5">{society.name}</p>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin size={14} />
                  <span>
                    {profile?.phase && `${profile.phase}, `}Block {profile?.block}, {profile?.flat_number}
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
                <span>Verified Resident</span>
              </div>
            )}

            {skillBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skillBadges.map((badge) => (
                  <div
                    key={badge.skill_name}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-medium"
                  >
                    <Award size={10} />
                    {badge.skill_name}
                    {badge.trust_score > 0 && (
                      <span className="text-muted-foreground">· {badge.trust_score}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accessibility Settings */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Type size={20} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Larger Text</p>
                  <p className="text-xs text-muted-foreground">Easier to read</p>
                </div>
              </div>
              <Switch checked={largeFont} onCheckedChange={setLargeFont} />
            </div>
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

        {/* Delete Account - Required for App Store compliance */}
        <div className="mt-4">
          <DeleteAccountDialog />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Sociva v2.0.0
        </p>
      </div>
    </AppLayout>
  );
}
