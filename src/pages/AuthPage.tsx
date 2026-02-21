import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loginSchema, emailSchema, profileDataSchema, validateForm } from '@/lib/validation-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, User, Search, MapPin, Building2, Plus, Navigation, Key, ShieldCheck, Sparkles, Home, ArrowLeft, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import authHero from '@/assets/auth-hero.jpg';
import { Society } from '@/types/database';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useAutocomplete, PlaceDetails } from '@/hooks/useGoogleMaps';

type SignupStep = 'credentials' | 'society' | 'profile' | 'verification';
type SocietySubStep = 'search' | 'map-confirm' | 'request-form';

interface ProfileData {
  name: string;
  flat_number: string;
  block: string;
  phase: string;
  phone: string;
}

export default function AuthPage() {
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request form
  const [newSocietyData, setNewSocietyData] = useState({ name: '', address: '', city: '', pincode: '', landmark: '', contact: '' });

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

  // Filter DB societies by search term (fallback when Google Maps not available or for existing societies)
  const filteredSocieties = societies.filter(s =>
    societySearch.length >= 2 && (
      s.name.toLowerCase().includes(societySearch.toLowerCase()) ||
      s.pincode?.includes(societySearch) ||
      s.city?.toLowerCase().includes(societySearch.toLowerCase()) ||
      s.address?.toLowerCase().includes(societySearch.toLowerCase())
    )
  );

  // Debounced Google search
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

    // Check if this society already exists in DB by name similarity
    const match = societies.find(s =>
      s.name.toLowerCase() === details.name.toLowerCase() ||
      s.name.toLowerCase().includes(details.name.toLowerCase()) ||
      details.name.toLowerCase().includes(s.name.toLowerCase())
    );

    if (match) {
      setSelectedSociety(match);
      toast.info('Found matching society in our system!');
    } else {
      // Directly register the place as a pending society (no map pin step)
      const name = details.name;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      setPendingNewSociety({
        name,
        slug,
        address: details.formattedAddress,
        city: details.city,
        state: details.state,
        pincode: details.pincode,
        latitude: details.latitude,
        longitude: details.longitude,
      });
      setSelectedSociety({ id: 'pending', name, slug, is_active: false, is_verified: false, latitude: details.latitude, longitude: details.longitude, created_at: '', updated_at: '' } as Society);
      toast.success('Location selected! Continue to complete signup.');
    }
  };

  // Pending society data for deferred creation after signup
  const [pendingNewSociety, setPendingNewSociety] = useState<{
    name: string; slug: string; address: string; city: string; state: string;
    pincode: string; latitude: number; longitude: number;
  } | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
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
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user?.id).single();
      if (profile) { toast.success('Welcome back!'); navigate('/'); }
      else { setAuthMode('signup'); setSignupStep('society'); }
    } catch (error: any) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('Your email is not verified yet. Please check your inbox and click the verification link before logging in.', { duration: 6000 });
      } else if (error.message.includes('Invalid login')) {
        toast.error('Invalid email or password. If you just signed up, please verify your email first by clicking the link we sent to your inbox.', { duration: 6000 });
      } else {
        toast.error(error.message || 'Failed to login');
      }
    } finally { setIsLoading(false); }
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
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally { setIsLoading(false); }
  };

  const handleCredentialsNext = () => {
    const validation = validateForm(loginSchema, { email, password });
    if ('errors' in validation) {
      toast.error(Object.values(validation.errors)[0] as string);
      return;
    }
    setEmail(validation.data.email);
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

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      city: newSocietyData.city,
      state: '',
      pincode: newSocietyData.pincode,
      latitude: 0,
      longitude: 0,
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
          data: { name: profileData.name, phone: `+91${profileData.phone}`, flat_number: profileData.flat_number, block: profileData.block, phase: profileData.phase, society_id: selectedSociety.id }
        },
      });
      if (error) throw error;
      if (data.user) {
        if (data.user.identities?.length === 0) {
          toast.error('This email is already registered. Please login instead.');
          setAuthMode('login'); setSignupStep('credentials'); return;
        }
        try {
          // If pending new society, create it via edge function first
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
              setIsLoading(false);
              return;
            }
          } else {
            // Validate existing society server-side
            try {
              await supabase.functions.invoke('validate-society', {
                body: { society_id: selectedSociety.id },
              });
            } catch (validateErr) {
              console.warn('Society validation call failed, will be validated by admin:', validateErr);
            }
          }

          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id, email, phone: `+91${profileData.phone}`, name: profileData.name,
            flat_number: profileData.flat_number, block: profileData.block,
            phase: profileData.phase || null, society_id: finalSocietyId,
          });
          if (!profileError) {
            await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'buyer' });
          }
        } catch (e) {
          console.warn('Profile creation during signup failed, will be auto-created on login:', e);
        }
        setSignupStep('verification');
        toast.success('Please check your email to verify your account');
      }
    } catch (error: any) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
        setAuthMode('login'); setSignupStep('credentials');
      } else { toast.error(error.message || 'Failed to create account'); }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Banner */}
      <div className="relative h-56 overflow-hidden">
        <img src={authHero} alt="Community marketplace" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-background" />
        <div className="absolute bottom-6 left-5 right-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="text-primary-foreground" size={16} />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-lg">Sociva</h1>
          </div>
          <p className="text-sm text-white/80 drop-shadow font-medium">Your Community Marketplace</p>
        </div>
      </div>

      {/* Trust Badge */}
      <div className="mx-5 -mt-3 relative z-10 mb-4">
        <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <ShieldCheck className="text-primary shrink-0" size={18} />
          <p className="text-xs text-foreground/80 font-medium">
            Exclusively for verified residential society members
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="px-5 pb-8">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* Step Header */}
          <div className="p-6 pb-4">
            {authMode === 'signup' && (
              <div className="flex items-center gap-1 mb-5">
                {stepLabels.map((label, i) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full transition-colors ${i + 1 <= currentStepNum ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={`text-[10px] font-medium ${i + 1 <= currentStepNum ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center">
              {authMode === 'login' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <Sparkles className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Welcome Back</h2>
                  <p className="text-sm text-muted-foreground mt-1">Sign in to your community</p>
                </>
              )}
              {authMode === 'reset' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <Key className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">We'll send you a reset link</p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'credentials' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <Mail className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Create Account</h2>
                  <p className="text-sm text-muted-foreground mt-1">Join your neighborhood community</p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'society' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <MapPin className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">
                    {societySubStep === 'map-confirm' ? 'Confirm Location' : societySubStep === 'request-form' ? 'Request Society' : 'Find Your Society'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {societySubStep === 'map-confirm' ? 'Verify the pin on the map' : societySubStep === 'request-form' ? 'Submit details for admin review' : 'Search by name, area, or pincode'}
                  </p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'profile' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <User className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Your Details</h2>
                  <p className="text-sm text-muted-foreground mt-1">Almost there!</p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'verification' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                    <CheckCircle2 className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Check Your Email</h2>
                  <p className="text-sm text-muted-foreground mt-1">Verification sent</p>
                </>
              )}
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 pb-6 overflow-visible">
            <AnimatePresence mode="wait">
              {/* Login Form */}
              {authMode === 'login' && (
                <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Input id="login-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl pr-10" />
                      {email.length > 0 && validateEmail(email) && (
                        <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl pr-12" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setAuthMode('reset'); setResetEmailSent(false); }} className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Button onClick={handleLogin} disabled={!email || !password || isLoading} className="w-full h-12 rounded-xl text-base font-semibold">
                    {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight className="mr-2" size={18} />}
                    Sign In
                  </Button>
                  <div className="text-center pt-1">
                    <button type="button" onClick={() => { setAuthMode('signup'); resetSignup(); }} className="text-sm text-primary font-medium hover:underline">
                      New here? Create an account
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Password Reset */}
              {authMode === 'reset' && (
                <motion.div key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
                  {resetEmailSent ? (
                    <div className="text-center py-4 space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Mail className="text-primary" size={32} />
                      </div>
                      <div className="space-y-2">
                        <p className="font-semibold">Check your email</p>
                        <p className="text-sm text-muted-foreground">We've sent a password reset link to:</p>
                        <p className="text-sm font-semibold text-primary">{email}</p>
                      </div>
                      <Button onClick={() => { setAuthMode('login'); setResetEmailSent(false); }} className="w-full h-12 rounded-xl text-base font-semibold">
                        Back to Login
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input id="reset-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
                      </div>
                      <Button onClick={handlePasswordReset} disabled={!email || isLoading} className="w-full h-12 rounded-xl text-base font-semibold">
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Mail className="mr-2" size={18} />}
                        Send Reset Link
                      </Button>
                      <div className="text-center pt-1">
                        <button type="button" onClick={() => setAuthMode('login')} className="text-sm text-primary font-medium hover:underline">
                          Back to Sign In
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Signup Step 1: Credentials */}
              {authMode === 'signup' && signupStep === 'credentials' && (
                <motion.div key="signup-credentials" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Input id="signup-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl pr-10" />
                      {email.length > 0 && validateEmail(email) && (
                        <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="Create a password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl pr-12" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={password} />
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="age-confirm"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-input accent-primary"
                    />
                    <div>
                      <label htmlFor="age-confirm" className="text-xs text-muted-foreground leading-snug">
                        I confirm that I am <strong>18 years of age or older</strong> and agree to the{' '}
                        <a href="#/terms" target="_blank" className="text-primary underline">Terms & Conditions</a> and{' '}
                        <a href="#/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</a>.
                      </label>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Required to comply with marketplace regulations</p>
                    </div>
                  </div>
                  <Button onClick={handleCredentialsNext} disabled={!email || password.length < 6 || !ageConfirmed} className="w-full h-12 rounded-xl text-base font-semibold">
                    <ArrowRight className="mr-2" size={18} /> Continue
                  </Button>
                  <div className="text-center pt-1">
                    <button type="button" onClick={() => setAuthMode('login')} className="text-sm text-primary font-medium hover:underline">
                      Already have an account? Sign in
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Signup Step 2: Society Selection */}
              {authMode === 'signup' && signupStep === 'society' && (
                <motion.div key="signup-society" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
                  <AnimatePresence mode="wait">

                    {/* Sub-step: Request Form */}
                    {societySubStep === 'request-form' && (
                      <motion.div key="request-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-3">
                        <div className="space-y-2">
                          <Label>Society Name *</Label>
                          <Input placeholder="e.g., Prestige Lakeside Habitat" value={newSocietyData.name} onChange={(e) => setNewSocietyData({ ...newSocietyData, name: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Full Address</Label>
                          <Input placeholder="Street, area, locality" value={newSocietyData.address} onChange={(e) => setNewSocietyData({ ...newSocietyData, address: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Landmark</Label>
                          <Input placeholder="Near park, temple, mall..." value={newSocietyData.landmark} onChange={(e) => setNewSocietyData({ ...newSocietyData, landmark: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>City *</Label>
                            <Input placeholder="City" value={newSocietyData.city} onChange={(e) => setNewSocietyData({ ...newSocietyData, city: e.target.value })} className="h-12 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Pincode *</Label>
                            <Input placeholder="PIN code" value={newSocietyData.pincode} onChange={(e) => setNewSocietyData({ ...newSocietyData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="h-12 rounded-xl" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Number *</Label>
                          <div className="flex gap-2">
                            <div className="flex items-center px-3 bg-muted rounded-xl border border-input text-sm font-medium h-12">+91</div>
                            <Input placeholder="Your phone number" value={newSocietyData.contact} onChange={(e) => setNewSocietyData({ ...newSocietyData, contact: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} className="flex-1 h-12 rounded-xl" />
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
                          Your request will be reviewed by our team. We'll contact you once the society is approved and activated.
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setSocietySubStep('search')} className="flex-1 h-12 rounded-xl">Back</Button>
                          <Button onClick={handleRequestNewSociety} disabled={isLoading || !newSocietyData.name || !newSocietyData.city || !newSocietyData.pincode || newSocietyData.contact.length !== 10} className="flex-1 h-12 rounded-xl font-semibold">
                            {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                            Submit Request
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Sub-step: Search */}
                    {societySubStep === 'search' && (
                      <motion.div key="search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
                        {/* Loading skeleton while Google Maps loads */}
                        {!mapsLoaded && (
                          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-xl border border-border animate-pulse">
                            <Loader2 size={14} className="text-muted-foreground animate-spin shrink-0" />
                            <span className="text-xs text-muted-foreground">Loading Google Maps...</span>
                          </div>
                        )}

                        {/* Search bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            placeholder="Search society, area, landmark, pincode..."
                            value={societySearch}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-12 rounded-xl"
                            autoFocus
                          />
                          {(isSearching || isLoadingSocieties) && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />
                          )}
                        </div>

                        {/* Results */}
                        {(showDbResults || showGoogleResults) && (
                          <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin">
                            {/* DB societies first */}
                            {showDbResults && (
                              <>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Registered Societies</p>
                                {filteredSocieties.map((s) => (
                                  <button key={s.id} onClick={() => handleSelectDbSociety(s)} className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedSociety?.id === s.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Building2 size={18} className="text-primary" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{s.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{[s.city, s.state, s.pincode].filter(Boolean).join(', ')}</p>
                                      </div>
                                      {selectedSociety?.id === s.id && <CheckCircle2 size={18} className="text-primary shrink-0 ml-auto" />}
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}

                            {/* Google Places results */}
                            {showGoogleResults && (
                              <>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-2">Google Maps Results</p>
                                {predictions.map((p) => (
                                  <button key={p.placeId} onClick={() => handleSelectGooglePlace(p.placeId)} className="w-full text-left p-3 rounded-xl border-2 border-border hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                        <MapPin size={18} className="text-accent" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{p.mainText}</p>
                                        <p className="text-xs text-muted-foreground truncate">{p.secondaryText}</p>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}

                        {/* Empty state */}
                        {societySearch.length >= 3 && !showDbResults && !showGoogleResults && !isSearching && !selectedSociety && (
                          <p className="text-center text-sm text-muted-foreground py-4">No results found for "{societySearch}"</p>
                        )}

                        {/* Initial hint */}
                        {societySearch.length < 2 && !selectedSociety && (
                          <div className="text-center py-6 space-y-2">
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                              <Search size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Start typing to search for your society</p>
                            <p className="text-xs text-muted-foreground/70">Search by society name, area, landmark, or pincode</p>
                          </div>
                        )}

                        {/* Request society button */}
                        <button onClick={() => setSocietySubStep('request-form')} className="w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                          <Plus size={16} /> Can't find your society? Request to add it
                        </button>

                        {/* Invite code */}
                        {selectedSociety?.invite_code && (
                          <div className="space-y-2">
                            <Label htmlFor="invite_code" className="flex items-center gap-1"><Key size={14} /> Invite Code *</Label>
                            <Input id="invite_code" placeholder="Enter society invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="h-12 rounded-xl" />
                            <p className="text-[10px] text-muted-foreground">Your society admin can share this code with you</p>
                          </div>
                        )}

                        {/* GPS verification */}
                        {selectedSociety && (
                          <div className="space-y-2">
                            <button onClick={verifyGpsLocation} disabled={gpsStatus === 'loading'} className={`w-full flex items-center gap-2 p-3 rounded-xl border text-sm transition-colors ${
                              gpsStatus === 'verified' ? 'border-primary/30 bg-primary/5 text-primary' :
                              gpsStatus === 'failed' ? 'border-warning/30 bg-warning/5 text-warning' :
                              'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                            }`}>
                              <Navigation size={16} className={gpsStatus === 'loading' ? 'animate-spin' : ''} />
                              {gpsStatus === 'idle' && 'Verify your location (optional)'}
                              {gpsStatus === 'loading' && 'Checking location...'}
                              {gpsStatus === 'verified' && `✓ Location verified (${gpsDistance}m away)`}
                              {gpsStatus === 'failed' && `Location check failed${gpsDistance ? ` (${gpsDistance}m away)` : ''}`}
                              {gpsStatus === 'unavailable' && 'GPS not available for this society'}
                            </button>
                            <p className="text-[10px] text-muted-foreground text-center">Location verification helps speed up admin approval</p>
                          </div>
                        )}

                        {/* Navigation buttons */}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setSignupStep('credentials')} className="flex-1 h-12 rounded-xl">
                            <ArrowLeft size={16} className="mr-1" /> Back
                          </Button>
                          <Button onClick={handleSocietyNext} disabled={!selectedSociety || (selectedSociety.invite_code ? !inviteCode.trim() : false)} className="flex-1 h-12 rounded-xl font-semibold">
                            Continue
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Signup Step 3: Profile Details */}
              {authMode === 'signup' && signupStep === 'profile' && (
                <motion.div key="signup-profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
                  {selectedSociety && (
                    <div className="flex items-center gap-2 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
                      <Building2 size={14} className="text-primary" />
                      <span className="text-sm font-medium truncate">{selectedSociety.name}</span>
                      <button onClick={() => setSignupStep('society')} className="ml-auto text-xs text-primary hover:underline shrink-0">Change</button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" placeholder="Enter your name" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} className="h-12 rounded-xl" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 bg-muted rounded-xl border border-input text-sm font-medium h-12">+91</div>
                      <Input id="phone" type="tel" placeholder="10-digit number" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: formatPhone(e.target.value) })} maxLength={10} className="flex-1 h-12 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phase">Phase / Wing (optional)</Label>
                    <Input id="phase" placeholder="e.g., Phase 1, Wing A" value={profileData.phase} onChange={(e) => setProfileData({ ...profileData, phase: e.target.value })} className="h-12 rounded-xl" />
                  </div>

                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="block">Block / Tower *</Label>
                        <Input id="block" placeholder="e.g., A, B, T1" value={profileData.block} onChange={(e) => setProfileData({ ...profileData, block: e.target.value })} className="h-12 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="flat">Flat Number *</Label>
                        <Input id="flat" placeholder="e.g., 101" value={profileData.flat_number} onChange={(e) => setProfileData({ ...profileData, flat_number: e.target.value })} className="h-12 rounded-xl" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 px-1">Used for delivery and identity verification within your society</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSignupStep('society')} className="flex-1 h-12 rounded-xl">
                      <ArrowLeft size={16} className="mr-1" /> Back
                    </Button>
                    <Button onClick={handleSignupComplete} disabled={!profileData.name || !profileData.flat_number || !profileData.block || profileData.phone.length !== 10 || isLoading} className="flex-1 h-12 rounded-xl font-semibold">
                      {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                      Create Account
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Signup Step 4: Email Verification */}
              {authMode === 'signup' && signupStep === 'verification' && (
                <motion.div key="signup-verification" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="space-y-4">
                  <div className="text-center py-4 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Mail className="text-primary" size={32} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">📧 Check Your Inbox!</p>
                      <p className="text-sm text-muted-foreground">We've sent a verification link to:</p>
                      <p className="text-sm font-semibold text-primary">{email}</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left text-sm space-y-2">
                      <p className="font-bold text-primary">⚠️ Important: You must verify before logging in</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                        <li>Open your email inbox (check spam/junk too)</li>
                        <li>Click the <span className="font-semibold text-foreground">"Confirm your email"</span> link</li>
                        <li>Come back here and <span className="font-semibold text-foreground">log in</span> with your credentials</li>
                      </ol>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-destructive font-medium">
                      🚫 You won't be able to log in until you verify your email
                    </div>
                  </div>
                  <Button onClick={() => { setAuthMode('login'); resetSignup(); }} className="w-full h-12 rounded-xl text-base font-semibold">
                    I've Verified — Go to Login
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Didn't receive the email?{' '}
                    <button type="button" onClick={() => toast.info('Check your spam/junk folder. If still missing, try signing up again with the same email.')} className="text-primary hover:underline">Get help</button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Legal Footer */}
        <div className="text-center text-xs text-muted-foreground mt-6 px-4 space-y-1.5">
          <p>
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy-policy" className="text-primary font-medium hover:underline">Privacy Policy</Link>.
          </p>
          <p className="font-medium text-muted-foreground/70">
            Available for verified residential society members only.
          </p>
        </div>
      </div>
    </div>
  );
}
