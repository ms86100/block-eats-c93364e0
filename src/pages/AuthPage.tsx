import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, User, Search, MapPin, Building2, Plus, Navigation, Key, ShieldCheck, Sparkles, Home, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import authHero from '@/assets/auth-hero.jpg';
import { Society } from '@/types/database';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

type SignupStep = 'credentials' | 'society' | 'profile' | 'verification';

interface ProfileData {
  name: string;
  flat_number: string;
  block: string;
  phase: string;
  phone: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    flat_number: '',
    block: '',
    phase: '',
    phone: '',
  });

  const [societies, setSocieties] = useState<Society[]>([]);
  const [societySearch, setSocietySearch] = useState('');
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [isLoadingSocieties, setIsLoadingSocieties] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newSocietyData, setNewSocietyData] = useState({ name: '', address: '', city: '', pincode: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'verified' | 'failed' | 'unavailable'>('idle');
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);

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
    s.name.toLowerCase().includes(societySearch.toLowerCase()) ||
    s.pincode?.includes(societySearch) ||
    s.city?.toLowerCase().includes(societySearch.toLowerCase())
  );

  const validateEmail = (email: string) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);
    if (!validateEmail(trimmedEmail)) { toast.error('Please enter a valid email address'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user?.id).single();
      if (profile) { toast.success('Welcome back!'); navigate('/'); }
      else { setAuthMode('signup'); setSignupStep('society'); }
    } catch (error: any) {
      if (error.message.includes('Invalid login')) toast.error('Invalid email or password');
      else if (error.message.includes('Email not confirmed')) toast.error('Please verify your email address first. Check your inbox.');
      else toast.error(error.message || 'Failed to login');
    } finally { setIsLoading(false); }
  };

  const handleCredentialsNext = () => {
    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);
    if (!validateEmail(trimmedEmail)) { toast.error('Please enter a valid email address'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
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

  const handleRequestNewSociety = async () => {
    if (!newSocietyData.name || !newSocietyData.city || !newSocietyData.pincode) {
      toast.error('Please fill in society name, city and pincode'); return;
    }
    setIsLoading(true);
    try {
      const slug = newSocietyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { error } = await supabase.from('societies').insert({
        name: newSocietyData.name, slug: slug + '-' + Date.now(),
        address: newSocietyData.address || null, city: newSocietyData.city,
        pincode: newSocietyData.pincode, is_verified: false, is_active: false,
      }).select().single();
      if (error) throw error;
      toast.success("Society request submitted! You'll be notified once approved.");
      setShowRequestForm(false);
      setNewSocietyData({ name: '', address: '', city: '', pincode: '' });
    } catch (error: any) { toast.error(error.message || 'Failed to submit request'); }
    finally { setIsLoading(false); }
  };

  const handleSignupComplete = async () => {
    if (!profileData.name || !profileData.flat_number || !profileData.block || !profileData.phone) {
      toast.error('Please fill in all required fields'); return;
    }
    if (profileData.phone.length !== 10) { toast.error('Please enter a valid 10-digit phone number'); return; }
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
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id, phone: `+91${profileData.phone}`, name: profileData.name,
            flat_number: profileData.flat_number, block: profileData.block,
            phase: profileData.phase || null, society_id: selectedSociety.id,
          });
          if (!profileError) {
            await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'buyer' });
          }
        } catch (e) { console.log('Profile will be created after email verification'); }
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
    setSignupStep('credentials'); setEmail(''); setPassword('');
    setSelectedSociety(null); setInviteCode(''); setGpsStatus('idle'); setGpsDistance(null);
    setProfileData({ name: '', flat_number: '', block: '', phase: '', phone: '' });
  };

  const totalSteps = 4;
  const currentStepNum = signupStep === 'credentials' ? 1 : signupStep === 'society' ? 2 : signupStep === 'profile' ? 3 : 4;

  const stepLabels = ['Account', 'Society', 'Profile', 'Verify'];

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
            {/* Step Progress (signup only) */}
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

            {/* Step Icon + Title */}
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
                    <Building2 className="text-primary" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Find Your Society</h2>
                  <p className="text-sm text-muted-foreground mt-1">Connect with your community</p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'profile' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center mb-3">
                    <User className="text-success" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Your Details</h2>
                  <p className="text-sm text-muted-foreground mt-1">Almost there!</p>
                </>
              )}
              {authMode === 'signup' && signupStep === 'verification' && (
                <>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center mb-3">
                    <CheckCircle2 className="text-success" size={26} />
                  </div>
                  <h2 className="text-xl font-bold">Check Your Email</h2>
                  <p className="text-sm text-muted-foreground mt-1">Verification sent</p>
                </>
              )}
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 pb-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {/* Login Form */}
              {authMode === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
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

              {/* Signup Step 1: Credentials */}
              {authMode === 'signup' && signupStep === 'credentials' && (
                <motion.div
                  key="signup-credentials"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
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
                  <Button onClick={handleCredentialsNext} disabled={!email || password.length < 6} className="w-full h-12 rounded-xl text-base font-semibold">
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
                <motion.div
                  key="signup-society"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  {!showRequestForm ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input placeholder="Search by name, city or pincode..." value={societySearch} onChange={(e) => setSocietySearch(e.target.value)} className="pl-9 h-12 rounded-xl" />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                        {isLoadingSocieties ? (
                          <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
                        ) : filteredSocieties.length > 0 ? (
                          filteredSocieties.map((s) => (
                            <button key={s.id} onClick={() => setSelectedSociety(s)} className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedSociety?.id === s.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'}`}>
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
                          ))
                        ) : (
                          <p className="text-center text-sm text-muted-foreground py-4">No societies found matching "{societySearch}"</p>
                        )}
                      </div>

                      <button onClick={() => setShowRequestForm(true)} className="w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                        <Plus size={16} /> Can't find your society? Request to add it
                      </button>

                      {selectedSociety?.invite_code && (
                        <div className="space-y-2">
                          <Label htmlFor="invite_code" className="flex items-center gap-1"><Key size={14} /> Invite Code *</Label>
                          <Input id="invite_code" placeholder="Enter society invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="h-12 rounded-xl" />
                          <p className="text-[10px] text-muted-foreground">Ask your society admin for the invite code</p>
                        </div>
                      )}

                      {selectedSociety && (
                        <div className="space-y-2">
                          <button onClick={verifyGpsLocation} disabled={gpsStatus === 'loading'} className={`w-full flex items-center gap-2 p-3 rounded-xl border text-sm transition-colors ${
                            gpsStatus === 'verified' ? 'border-green-300 bg-green-50 text-green-700' :
                            gpsStatus === 'failed' ? 'border-orange-300 bg-orange-50 text-orange-700' :
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

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSignupStep('credentials')} className="flex-1 h-12 rounded-xl">
                          <ArrowLeft size={16} className="mr-1" /> Back
                        </Button>
                        <Button onClick={handleSocietyNext} disabled={!selectedSociety || (selectedSociety.invite_code ? !inviteCode.trim() : false)} className="flex-1 h-12 rounded-xl font-semibold">
                          Continue
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Society Name *</Label>
                          <Input placeholder="e.g., Prestige Lakeside Habitat" value={newSocietyData.name} onChange={(e) => setNewSocietyData({ ...newSocietyData, name: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input placeholder="Full address" value={newSocietyData.address} onChange={(e) => setNewSocietyData({ ...newSocietyData, address: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>City *</Label>
                            <Input placeholder="City" value={newSocietyData.city} onChange={(e) => setNewSocietyData({ ...newSocietyData, city: e.target.value })} className="h-12 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Pincode *</Label>
                            <Input placeholder="PIN code" value={newSocietyData.pincode} onChange={(e) => setNewSocietyData({ ...newSocietyData, pincode: e.target.value })} className="h-12 rounded-xl" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
                        Your request will be reviewed by our team. You'll be notified once approved.
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowRequestForm(false)} className="flex-1 h-12 rounded-xl">Back</Button>
                        <Button onClick={handleRequestNewSociety} disabled={isLoading} className="flex-1 h-12 rounded-xl font-semibold">
                          {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                          Submit Request
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Signup Step 3: Profile Details */}
              {authMode === 'signup' && signupStep === 'profile' && (
                <motion.div
                  key="signup-profile"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  {selectedSociety && (
                    <div className="flex items-center gap-2 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
                      <Building2 size={14} className="text-primary" />
                      <span className="text-sm font-medium">{selectedSociety.name}</span>
                      <button onClick={() => setSignupStep('society')} className="ml-auto text-xs text-primary hover:underline">Change</button>
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
                <motion.div
                  key="signup-verification"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div className="text-center py-4 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center">
                      <Mail className="text-success" size={32} />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold">Check your email</p>
                      <p className="text-sm text-muted-foreground">We've sent a verification link to:</p>
                      <p className="text-sm font-semibold text-primary">{email}</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4 text-left text-sm space-y-2">
                      <p className="font-semibold">What happens next?</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Click the link in your email</li>
                        <li>You'll be redirected back here</li>
                        <li>Login with your credentials</li>
                        <li>Admin will verify your residency</li>
                      </ol>
                    </div>
                  </div>
                  <Button onClick={() => { setAuthMode('login'); resetSignup(); }} className="w-full h-12 rounded-xl text-base font-semibold">
                    Go to Login
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Didn't receive the email?{' '}
                    <button type="button" onClick={() => toast.info('Please check your spam folder or try signing up again.')} className="text-primary hover:underline">Get help</button>
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

