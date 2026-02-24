import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, SellerProfile, Society, SocietyAdmin } from '@/types/database';
import { AuthState, initialAuthState } from './types';
import { toast } from 'sonner';

export function useAuthState() {
  const [state, setState] = useState<AuthState>(initialAuthState);

  const setPartial = useCallback((partial: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_auth_context', {
        _user_id: userId,
      });

      if (error || !data) {
        console.error('Error fetching auth context:', error);
        return;
      }

      const ctx = data as any;

      // Finding #3: If profile is null for an authenticated user, attempt to create one
      if (!ctx.profile) {
        console.warn('Authenticated user has no profile, attempting to create one');
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const meta = userData.user.user_metadata || {};
          const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            email: userData.user.email || '',
            name: meta.name || meta.full_name || 'User',
            phone: meta.phone || null,
            flat_number: meta.flat_number || '',
            block: meta.block || '',
            phase: meta.phase || null,
            society_id: meta.society_id || null,
          });
          if (!insertError) {
            await supabase.from('user_roles').insert({ user_id: userId, role: 'buyer' });
            const { data: retryData } = await supabase.rpc('get_user_auth_context', { _user_id: userId });
            if (retryData) {
              const retryCtx = retryData as any;
              const retrySellers = (retryCtx.seller_profiles as SellerProfile[]) || [];
              setState(prev => ({
                ...prev,
                profile: retryCtx.profile as Profile | null,
                society: retryCtx.society as Society | null,
                societyAdminRole: retryCtx.society_admin_role as SocietyAdmin | null,
                roles: (retryCtx.roles as UserRole[]) || [],
                sellerProfiles: retrySellers,
                currentSellerId: retrySellers.length > 0 ? retrySellers[0].id : null,
                managedBuilderIds: (retryCtx.builder_ids as string[]) || [],
              }));
              return;
            }
          } else {
            console.error('Failed to auto-create profile:', insertError);
          }
        }
        return;
      }
      const sellers = (ctx.seller_profiles as SellerProfile[]) || [];

      setState(prev => {
        const newSellerId =
          sellers.length > 0 && !prev.currentSellerId
            ? sellers[0].id
            : sellers.length === 0
            ? null
            : prev.currentSellerId;

        return {
          ...prev,
          profile: ctx.profile as Profile | null,
          society: ctx.society as Society | null,
          societyAdminRole: ctx.society_admin_role as SocietyAdmin | null,
          roles: (ctx.roles as UserRole[]) || [],
          sellerProfiles: sellers,
          currentSellerId: newSellerId,
          managedBuilderIds: (ctx.builder_ids as string[]) || [],
        };
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      await fetchProfile(state.user.id);
    }
  }, [state.user, fetchProfile]);

  const setViewAsSociety = useCallback(async (id: string | null) => {
    if (!id) {
      setPartial({ viewAsSocietyId: null, viewAsSociety: null });
      return;
    }
    setPartial({ viewAsSocietyId: id });
    const { data } = await supabase
      .from('societies')
      .select('*')
      .eq('id', id)
      .single();
    setPartial({ viewAsSociety: data as Society | null });
  }, [setPartial]);

  const clearAuthState = useCallback(() => {
    setState({ ...initialAuthState, isLoading: false });
  }, []);

  // Track whether user explicitly called signOut
  const isExplicitSignOut = useRef(false);

  const signOut = useCallback(async () => {
    isExplicitSignOut.current = true;
    await supabase.auth.signOut();
    clearAuthState();
  }, [clearAuthState]);

  // Fix #8: Guard against double fetchProfile on mount
  const profileFetchedFor = useRef<string | null>(null);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setPartial({ session, user: session?.user ?? null, isLoading: false });

        if (session?.user) {
          if (profileFetchedFor.current !== session.user.id) {
            profileFetchedFor.current = session.user.id;
            setTimeout(() => fetchProfile(session.user.id), 0);
          }
        } else if (event === 'SIGNED_OUT') {
          profileFetchedFor.current = null;
          if (!isExplicitSignOut.current) {
            toast.error('Your session has expired. Please log in again.');
            window.location.hash = '#/auth';
          }
          isExplicitSignOut.current = false;
          clearAuthState();
        } else {
          clearAuthState();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setPartial({ session, user: session?.user ?? null, isLoading: false });
      if (session?.user && profileFetchedFor.current !== session.user.id) {
        profileFetchedFor.current = session.user.id;
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fix #18: Consolidated realtime — single channel with debounced refetch
  useEffect(() => {
    const userId = state.user?.id;
    if (!userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchProfile(userId), 500);
    };

    const roleChannel = supabase
      .channel(`role-changes-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${userId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_staff', filter: `user_id=eq.${userId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'society_admins', filter: `user_id=eq.${userId}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'builder_members', filter: `user_id=eq.${userId}` }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(roleChannel);
    };
  }, [state.user?.id, fetchProfile]);

  return {
    state,
    setPartial,
    refreshProfile,
    setViewAsSociety,
    signOut,
  };
}
