import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loginSchema, emailSchema, profileDataSchema, validateForm } from '@/lib/validation-schemas';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';
import { Society } from '@/types/database';
import { useAutocomplete, PlaceDetails } from '@/hooks/useGoogleMaps';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLoginThrottle } from '@/hooks/useLoginThrottle';

export type SignupStep = 'credentials' | 'society' | 'profile' | 'verification';
export type SocietySubStep = 'search' | 'map-confirm' | 'request-form';

export interface ProfileData {
  name: string;
  flat_number: string;
  block: string;
  phase: string;
  phone: string;
}

export function useAuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('credentials');
  const [societySubStep, setSocietySubStep] = useState<SocietySubStep>('search');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '', flat_number: '', block: '', phase: '', phone: '',
  });

  // Society selection state
  const [societies, setSocieties] = useState<Society[]>([]);
  const [societySearch, setSocietySearch] = useState('');
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [isLoadingSocieties, setIsLoadingSocieties] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'verified' | 'failed' | 'unavailable'>('idle');
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // Google Places autocomplete state
  const { predictions, isSearching, searchPlaces, getPlaceDetails, clearPredictions, isLoaded: mapsLoaded } = useAutocomplete();
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [adjustedCoords, setAdjustedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const settings = useSystemSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request form
  const [newSocietyData, setNewSocietyData] = useState({ name: '', address: '', city: '', pincode: '', landmark: '', contact: '' });

  // Pending society data for deferred creation after signup
  const [pendingNewSociety, setPendingNewSociety] = useState<{
    name: string; slug: string; address: string; city: string; state: string;
    pincode: string; latitude: number; longitude: number;
  } | null>(null);

  const { isLocked, remainingSeconds, recordFailure, recordSuccess } = useLoginThrottle();

  useEffect(() => {
    fetchSocieties();
  }, []);

  const fetchSocieties = async () => {
    setIsLoadingSocieties(true);
    const { data } = await supabase
      .from('societies')
      .select('*')
      .eq('is_active', true)
      .eq('is_verified', true)
      .order('name');
    setSocieties((data as Society[]) || []);
    setIsLoadingSocieties(false);
  };

  const filteredSocieties = societies.filter(s =>
    societySearch.length >= 2 && (
      s.name.toLowerCase().includes(societySearch.toLowerCase()) ||
      s.pincode?.includes(societySearch) ||
      s.city?.toLowerCase().includes(societySearch.toLowerCase()) ||
      s.address?.toLowerCase().includes(societySearch.toLowerCase())
    )
  );

  const handleSearchChange = useCallback((value: string) => {
    setSocietySearch(value);
    setSelectedSociety(null);
    setSelectedPlace(null);
    setAdjustedCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 3 && mapsLoaded) {
      debounceRef.current = setTimeout(() => searchPlaces(value), 300);
    } else {
      clearPredictions();
    }
  }, [mapsLoaded, searchPlaces, clearPredictions]);

  const handleSelectDbSociety = (society: Society) => {
    setSelectedSociety(society);
    setSocietySearch(society.name);
    clearPredictions();
  };

  const handleSelectGooglePlace = async (placeId: string) => {
    const details = await getPlaceDetails(placeId);
    if (!details) { toast.error('Could not load address details'); return; }
    setSelectedPlace(details);
    clearPredictions();
    setSocietySearch(details.name);

    const match = societies.find(s =>
      s.name.toLowerCase() === details.name.toLowerCase() ||
      s.name.toLowerCase().includes(details.name.toLowerCase()) ||
      details.name.toLowerCase().includes(s.name.toLowerCase())
    );

    if (match) {
      setSelectedSociety(match);
      toast.info('Found matching society in our system!');
    } else {
      const name = details.name;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      setPendingNewSociety({
        name, slug,
        address: details.formattedAddress,
        city: details.city, state: details.state,
        pincode: details.pincode,
        latitude: details.latitude, longitude: details.longitude,
      });
      setSelectedSociety({ id: 'pending', name, slug, is_active: false, is_verified: false, latitude: details.latitude, longitude: details.longitude, created_at: '', updated_at: '' } as Society);
      toast.success('Location selected! Continue to complete signup.');
    }
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    if (isLocked) {
      toast.error(`Too many attempts. Please wait ${remainingSeconds}s before trying again.`);
      return;
    }
    const validation = validateForm(loginSchema, { email, password });
    if ('errors' in validation) {
      toast.error(Object.values(validation.errors)[0] as string);
      return;
    }
    const { email: trimmedEmail, password: validatedPassword } = validation.data;
    setEmail(trimmedEmail);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: validatedPassword });
      if (error) throw error;
      recordSuccess();

      // Quick profile check with 5s timeout — if it hangs, navigate anyway
      // Use rpc to bypass potential RLS timing issues on fresh login
      const profileResult = await Promise.race([
        supabase.rpc('get_user_auth_context', { _user_id: data.user?.id }),
        new Promise<{ data: null; error: string }>(resolve =>
          setTimeout(() => resolve({ data: null, error: 'timeout' }), 5000)
        ),
      ]);

      const ctx = profileResult.data as any;
      if (ctx?.profile || profileResult.error === 'timeout') {
        toast.success('Welcome back!');
        navigate('/');
      } else {
        // Don't sign out immediately — the auto-recovery in useAuthState may fix it
        // Only show a warning, let the auth state listener handle recovery
        console.warn('[Login] Profile not found via RPC, letting auth state listener attempt recovery');
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error: any) {
      recordFailure();
      if (error.message?.includes('Email not confirmed')) {
        toast.error('Your email is not verified yet. Please check your inbox and click the verification link.', { duration: 6000 });
      } else if (error.message?.includes('Invalid login')) {
        toast.error('Invalid email or password. If you just signed up, please verify your email first.', { duration: 6000 });
      } else {
        toast.error(friendlyError(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const validation = validateForm(emailSchema, email);
    if (!validation.success) {
      toast.error('Please enter a valid email address');
      return;
    }
    const trimmedEmail = validation.data;
    setEmail(trimmedEmail);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(friendlyError(error));
    } finally { setIsLoading(false); }
  };

  const handleCredentialsNext = async () => {
    const validation = validateForm(loginSchema, { email, password });
    if ('errors' in validation) {
      toast.error(Object.values(validation.errors)[0] as string);
      return;
    }
    const trimmedEmail = validation.data.email;
    setEmail(trimmedEmail);
    setIsLoading(true);

    try {
      // Early duplicate check: try signing up with a dummy call to see if user exists
      // We check profiles table for the email (public read for matching)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (existingProfile) {
        toast.error('This email is already registered. Please sign in instead.', { duration: 5000 });
        setAuthMode('login');
        setSignupStep('credentials');
        return;
      }
    } catch (err) {
      // If check fails, proceed anyway — the final signup will catch duplicates
      console.warn('[Signup] Early email check failed:', err);
    } finally {
      setIsLoading(false);
    }

    setSignupStep('society');
  };

  const handleSocietyNext = () => {
    if (!selectedSociety) { toast.error('Please select your society'); return; }
    if (selectedSociety.invite_code && inviteCode.trim().toLowerCase() !== selectedSociety.invite_code.trim().toLowerCase()) {
      toast.error('Invalid invite code for this society'); return;
    }
    setSignupStep('profile');
  };

  const verifyGpsLocation = () => {
    if (!selectedSociety?.latitude || !selectedSociety?.longitude) { setGpsStatus('unavailable'); return; }
    if (!navigator.geolocation) { setGpsStatus('unavailable'); toast.error('GPS is not supported on this device'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = haversineDistance(position.coords.latitude, position.coords.longitude, Number(selectedSociety.latitude), Number(selectedSociety.longitude));
        setGpsDistance(Math.round(dist));
        const radius = selectedSociety.geofence_radius_meters || 500;
        if (dist <= radius) { setGpsStatus('verified'); toast.success('Location verified!'); }
        else { setGpsStatus('failed'); toast.error(`You appear to be ${Math.round(dist)}m away.`); }
      },
      () => { setGpsStatus('failed'); toast.error('Unable to access your location.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRequestNewSociety = () => {
    if (!newSocietyData.name || !newSocietyData.city || !newSocietyData.pincode || !newSocietyData.contact) {
      toast.error('Please fill in all required fields'); return;
    }
    const slug = newSocietyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const pending = {
      name: newSocietyData.name,
      slug: slug + '-' + Date.now(),
      address: [newSocietyData.address, newSocietyData.landmark].filter(Boolean).join(', ') || '',
      city: newSocietyData.city, state: '', pincode: newSocietyData.pincode,
      latitude: 0, longitude: 0,
    };
    setPendingNewSociety(pending);
    setSelectedSociety({ id: 'pending', name: newSocietyData.name, slug: pending.slug, is_active: false, is_verified: false, created_at: '', updated_at: '' } as Society);
    toast.success("Society details saved! Complete signup to submit your request.");
    setSocietySubStep('search');
    setNewSocietyData({ name: '', address: '', city: '', pincode: '', landmark: '', contact: '' });
  };

  const handleSignupComplete = async () => {
    const profileValidation = validateForm(profileDataSchema, profileData);
    if ('errors' in profileValidation) {
      toast.error(Object.values(profileValidation.errors)[0] as string); return;
    }
    if (!selectedSociety) { toast.error('Please select your society first'); setSignupStep('society'); return; }
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth`;
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name: profileData.name, phone: `${settings.defaultCountryCode}${profileData.phone}`, flat_number: profileData.flat_number, block: profileData.block, phase: profileData.phase, society_id: selectedSociety.id }
        },
      });
      if (error) throw error;
      if (data.user) {
        if (data.user.identities?.length === 0) {
          toast.error('This email is already registered. Please login instead.');
          setAuthMode('login'); setSignupStep('credentials'); return;
        }
        let finalSocietyId = selectedSociety.id;

        if (pendingNewSociety && selectedSociety.id === 'pending') {
          try {
            const { data: validateData, error: validateError } = await supabase.functions.invoke('validate-society', {
              body: { new_society: pendingNewSociety },
            });
            if (validateError) throw validateError;
            if (validateData?.society?.id) {
              finalSocietyId = validateData.society.id;
            }
          } catch (validateErr) {
            console.warn('Society creation via edge function failed:', validateErr);
            toast.error('Failed to register society. Please try again.');
            await supabase.auth.signOut();
            setIsLoading(false);
            return;
          }
        }

        if (!finalSocietyId || finalSocietyId === 'pending') {
          toast.error('Failed to set up your society. Please try again.');
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id, email, phone: `${settings.defaultCountryCode}${profileData.phone}`, name: profileData.name,
          flat_number: profileData.flat_number, block: profileData.block,
          phase: profileData.phase || null, society_id: finalSocietyId,
        });

        if (profileError) {
          console.error('Profile insert error:', profileError);
          const msg = profileError.message || '';
          if (msg.includes('idx_profiles_email_unique') || msg.includes('profiles_email')) {
            toast.error('This email is already registered. Please login instead.');
            setAuthMode('login'); setSignupStep('credentials'); setIsLoading(false); return;
          } else if (msg.includes('idx_profiles_phone_unique') || msg.includes('profiles_phone')) {
            toast.error('This phone number is already in use by another account.');
            setIsLoading(false); return;
          }
          await supabase.auth.signOut();
          toast.error('Account setup failed. Please try signing up again. If the problem persists, contact support.', { duration: 8000 });
          setIsLoading(false);
          return;
        }

        await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'buyer' });

        if (!pendingNewSociety && selectedSociety.id !== 'pending') {
          try {
            await supabase.functions.invoke('validate-society', {
              body: { society_id: selectedSociety.id },
            });
          } catch (validateErr) {
            console.warn('Society validation call failed, will be validated by admin:', validateErr);
          }
        }
        setSignupStep('verification');
        toast.success('Please check your email to verify your account');
      }
    } catch (error: any) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
        setAuthMode('login'); setSignupStep('credentials');
      } else { toast.error(friendlyError(error)); }
    } finally { setIsLoading(false); }
  };

  const formatPhone = (value: string) => value.replace(/\D/g, '').slice(0, 10);

  const resetSignup = () => {
    setSignupStep('credentials'); setSocietySubStep('search');
    setEmail(''); setPassword('');
    setSelectedSociety(null); setSelectedPlace(null); setAdjustedCoords(null);
    setInviteCode(''); setGpsStatus('idle'); setGpsDistance(null);
    setSocietySearch('');
    setProfileData({ name: '', flat_number: '', block: '', phase: '', phone: '' });
  };

  const totalSteps = 4;
  const currentStepNum = signupStep === 'credentials' ? 1 : signupStep === 'society' ? 2 : signupStep === 'profile' ? 3 : 4;
  const stepLabels = ['Account', 'Society', 'Profile', 'Verify'];

  const showDbResults = societySearch.length >= 2 && filteredSocieties.length > 0;
  const showGoogleResults = societySearch.length >= 3 && predictions.length > 0 && !selectedSociety;

  return {
    // Auth mode
    authMode, setAuthMode,
    // Signup steps
    signupStep, setSignupStep, societySubStep, setSocietySubStep,
    // Credentials
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    isLoading, resetEmailSent,
    // Profile
    profileData, setProfileData,
    // Society
    societies, societySearch, selectedSociety, isLoadingSocieties,
    inviteCode, setInviteCode, gpsStatus, gpsDistance, ageConfirmed, setAgeConfirmed,
    // Google Maps
    predictions, isSearching, mapsLoaded, selectedPlace,
    // New society
    newSocietyData, setNewSocietyData, pendingNewSociety,
    // Settings
    settings,
    // Throttle
    isLocked, remainingSeconds,
    // Computed
    filteredSocieties, showDbResults, showGoogleResults,
    totalSteps, currentStepNum, stepLabels,
    // Handlers
    handleSearchChange, handleSelectDbSociety, handleSelectGooglePlace,
    validateEmail, handleLogin, handlePasswordReset,
    handleCredentialsNext, handleSocietyNext, verifyGpsLocation,
    handleRequestNewSociety, handleSignupComplete,
    formatPhone, resetSignup,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
