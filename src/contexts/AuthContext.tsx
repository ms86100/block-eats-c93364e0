import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, SellerProfile, Society } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  society: Society | null;
  roles: UserRole[];
  sellerProfiles: SellerProfile[];
  currentSellerId: string | null;
  isLoading: boolean;
  isApproved: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setCurrentSellerId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [society, setSociety] = useState<Society | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<SellerProfile[]>([]);
  const [currentSellerId, setCurrentSellerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      setProfile(profileData as Profile | null);

      // Fetch society data if profile has society_id
      if (profileData?.society_id) {
        const { data: societyData } = await supabase
          .from('societies')
          .select('*')
          .eq('id', profileData.society_id)
          .single();
        setSociety(societyData as Society | null);
      } else {
        setSociety(null);
      }
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      setRoles((rolesData?.map(r => r.role) as UserRole[]) || []);

      // Fetch all seller profiles for the user (multi-seller support)
      const { data: sellersData } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      const sellers = (sellersData as SellerProfile[]) || [];
      setSellerProfiles(sellers);
      
      // Set current seller to first one if not already set
      if (sellers.length > 0 && !currentSellerId) {
        setCurrentSellerId(sellers[0].id);
      } else if (sellers.length === 0) {
        setCurrentSellerId(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSociety(null);
          setRoles([]);
          setSellerProfiles([]);
          setCurrentSellerId(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setSociety(null);
    setRoles([]);
    setSellerProfiles([]);
    setCurrentSellerId(null);
  };

  const isApproved = profile?.verification_status === 'approved';
  const isSeller = roles.includes('seller') || sellerProfiles.length > 0;
  const isAdmin = roles.includes('admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        society,
        roles,
        sellerProfiles,
        currentSellerId,
        isLoading,
        isApproved,
        isSeller,
        isAdmin,
        signOut,
        refreshProfile,
        setCurrentSellerId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
