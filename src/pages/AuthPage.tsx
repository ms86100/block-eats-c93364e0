import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, CheckCircle2, User, Search, MapPin, Building2, Plus } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';
import { Society } from '@/types/database';

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

  // Society selection
  const [societies, setSocieties] = useState<Society[]>([]);
  const [societySearch, setSocietySearch] = useState('');
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [isLoadingSocieties, setIsLoadingSocieties] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newSocietyData, setNewSocietyData] = useState({ name: '', address: '', city: '', pincode: '' });

  // Fetch societies
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

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();

      if (profile) {
        toast.success('Welcome back!');
        navigate('/');
      } else {
        setAuthMode('signup');
        setSignupStep('society');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message.includes('Invalid login')) {
        toast.error('Invalid email or password');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Please verify your email address first. Check your inbox.');
      } else {
        toast.error(error.message || 'Failed to login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsNext = () => {
    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSignupStep('society');
  };

  const handleSocietyNext = () => {
    if (!selectedSociety) {
      toast.error('Please select your society');
      return;
    }
    setSignupStep('profile');
  };

  const handleRequestNewSociety = async () => {
    if (!newSocietyData.name || !newSocietyData.city || !newSocietyData.pincode) {
      toast.error('Please fill in society name, city and pincode');
      return;
    }
    setIsLoading(true);
    try {
      const slug = newSocietyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data, error } = await supabase.from('societies').insert({
        name: newSocietyData.name,
        slug: slug + '-' + Date.now(),
        address: newSocietyData.address || null,
        city: newSocietyData.city,
        pincode: newSocietyData.pincode,
        is_verified: false,
        is_active: false,
      }).select().single();

      if (error) throw error;
      toast.success('Society request submitted! You\'ll be notified once approved.');
      setShowRequestForm(false);
      setNewSocietyData({ name: '', address: '', city: '', pincode: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupComplete = async () => {
    if (!profileData.name || !profileData.flat_number || !profileData.block || !profileData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (profileData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    if (!selectedSociety) {
      toast.error('Please select your society first');
      setSignupStep('society');
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: profileData.name,
            phone: `+91${profileData.phone}`,
            flat_number: profileData.flat_number,
            block: profileData.block,
            phase: profileData.phase,
            society_id: selectedSociety.id,
          }
        },
      });

      if (error) throw error;

      if (data.user) {
        if (data.user.identities?.length === 0) {
          toast.error('This email is already registered. Please login instead.');
          setAuthMode('login');
          setSignupStep('credentials');
          return;
        }

        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              phone: `+91${profileData.phone}`,
              name: profileData.name,
              flat_number: profileData.flat_number,
              block: profileData.block,
              phase: profileData.phase || null,
              society_id: selectedSociety.id,
            });

          if (!profileError) {
            await supabase
              .from('user_roles')
              .insert({
                user_id: data.user.id,
                role: 'buyer',
              });
          }
        } catch (e) {
          console.log('Profile will be created after email verification');
        }

        setSignupStep('verification');
        toast.success('Please check your email to verify your account');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
        setAuthMode('login');
        setSignupStep('credentials');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  const resetSignup = () => {
    setSignupStep('credentials');
    setEmail('');
    setPassword('');
    setSelectedSociety(null);
    setProfileData({
      name: '',
      flat_number: '',
      block: '',
      phase: '',
      phone: '',
    });
  };

  const totalSteps = 4;
  const currentStepNum = signupStep === 'credentials' ? 1 : signupStep === 'society' ? 2 : signupStep === 'profile' ? 3 : 4;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={heroBanner}
          alt="Community marketplace"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-background" />
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            BlockEats
          </h1>
          <p className="text-sm text-white/90 drop-shadow">
            Your Community Marketplace
          </p>
        </div>
      </div>

      {/* Community Notice Banner */}
      <div className="mx-4 -mt-2 mb-2 relative z-5">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-xs text-amber-800 font-medium">
            🏠 This app is exclusively for verified residential society members
          </p>
        </div>
      </div>

      <div className="px-4 -mt-4 relative z-10">
        <Card className="shadow-elevated">
          <CardHeader className="text-center pb-2">
            {authMode === 'login' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Mail className="text-primary" size={24} />
                </div>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Login to your account</CardDescription>
              </>
            )}
            {authMode === 'signup' && signupStep === 'credentials' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Mail className="text-primary" size={24} />
                </div>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Step 1 of {totalSteps}: Enter your email</CardDescription>
              </>
            )}
            {authMode === 'signup' && signupStep === 'society' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Building2 className="text-primary" size={24} />
                </div>
                <CardTitle>Select Your Society</CardTitle>
                <CardDescription>Step 2 of {totalSteps}: Find your community</CardDescription>
              </>
            )}
            {authMode === 'signup' && signupStep === 'profile' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <User className="text-success" size={24} />
                </div>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>Step 3 of {totalSteps}: Tell us about yourself</CardDescription>
              </>
            )}
            {authMode === 'signup' && signupStep === 'verification' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="text-success" size={24} />
                </div>
                <CardTitle>Verify Your Email</CardTitle>
                <CardDescription>Step 4 of {totalSteps}: Check your inbox</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login Form */}
            {authMode === 'login' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={!email || !password || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : (
                    <ArrowRight className="mr-2" size={18} />
                  )}
                  Login
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      resetSignup();
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    Don't have an account? Sign up
                  </button>
                </div>
              </>
            )}

            {/* Signup Step 1: Credentials */}
            {authMode === 'signup' && signupStep === 'credentials' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                </div>
                <Button
                  onClick={handleCredentialsNext}
                  disabled={!email || password.length < 6}
                  className="w-full"
                >
                  <ArrowRight className="mr-2" size={18} />
                  Continue
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-sm text-primary hover:underline"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </>
            )}

            {/* Signup Step 2: Society Selection */}
            {authMode === 'signup' && signupStep === 'society' && (
              <>
                {/* Progress */}
                <div className="flex items-center justify-center gap-2 pb-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`w-8 h-1 rounded-full ${s <= 2 ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>

                {!showRequestForm ? (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <Input
                        placeholder="Search by name, city or pincode..."
                        value={societySearch}
                        onChange={(e) => setSocietySearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* Society List */}
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {isLoadingSocieties ? (
                        <p className="text-center text-sm text-muted-foreground py-4">Loading...</p>
                      ) : filteredSocieties.length > 0 ? (
                        filteredSocieties.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSociety(s)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedSociety?.id === s.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Building2 size={18} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {[s.city, s.state, s.pincode].filter(Boolean).join(', ')}
                                </p>
                              </div>
                              {selectedSociety?.id === s.id && (
                                <CheckCircle2 size={18} className="text-primary shrink-0 ml-auto" />
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          No societies found matching "{societySearch}"
                        </p>
                      )}
                    </div>

                    {/* Request new society */}
                    <button
                      onClick={() => setShowRequestForm(true)}
                      className="w-full flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <Plus size={16} />
                      Can't find your society? Request to add it
                    </button>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSignupStep('credentials')} className="flex-1">
                        Back
                      </Button>
                      <Button onClick={handleSocietyNext} disabled={!selectedSociety} className="flex-1">
                        Continue
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Request new society form */
                  <>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Society Name *</Label>
                        <Input
                          placeholder="e.g., Prestige Lakeside Habitat"
                          value={newSocietyData.name}
                          onChange={(e) => setNewSocietyData({ ...newSocietyData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          placeholder="Full address"
                          value={newSocietyData.address}
                          onChange={(e) => setNewSocietyData({ ...newSocietyData, address: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>City *</Label>
                          <Input
                            placeholder="City"
                            value={newSocietyData.city}
                            onChange={(e) => setNewSocietyData({ ...newSocietyData, city: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Pincode *</Label>
                          <Input
                            placeholder="PIN code"
                            value={newSocietyData.pincode}
                            onChange={(e) => setNewSocietyData({ ...newSocietyData, pincode: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                      Your request will be reviewed by our team. You'll be notified once your society is approved.
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowRequestForm(false)} className="flex-1">
                        Back
                      </Button>
                      <Button onClick={handleRequestNewSociety} disabled={isLoading} className="flex-1">
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        Submit Request
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Signup Step 3: Profile Details */}
            {authMode === 'signup' && signupStep === 'profile' && (
              <>
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 pb-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`w-8 h-1 rounded-full ${s <= 3 ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>

                {/* Selected society badge */}
                {selectedSociety && (
                  <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <Building2 size={14} className="text-primary" />
                    <span className="text-sm font-medium">{selectedSociety.name}</span>
                    <button onClick={() => setSignupStep('society')} className="ml-auto text-xs text-primary hover:underline">
                      Change
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-muted rounded-md border border-input text-sm font-medium">
                      +91
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="10-digit number"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: formatPhone(e.target.value) })}
                      maxLength={10}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phase">Phase / Wing (optional)</Label>
                  <Input
                    id="phase"
                    placeholder="e.g., Phase 1, Wing A"
                    value={profileData.phase}
                    onChange={(e) => setProfileData({ ...profileData, phase: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="block">Block / Tower *</Label>
                    <Input
                      id="block"
                      placeholder="e.g., A, B, T1"
                      value={profileData.block}
                      onChange={(e) => setProfileData({ ...profileData, block: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flat">Flat Number *</Label>
                    <Input
                      id="flat"
                      placeholder="e.g., 101"
                      value={profileData.flat_number}
                      onChange={(e) => setProfileData({ ...profileData, flat_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSignupStep('society')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSignupComplete}
                    disabled={
                      !profileData.name ||
                      !profileData.flat_number ||
                      !profileData.block ||
                      profileData.phone.length !== 10 ||
                      isLoading
                    }
                    className="flex-1"
                  >
                    {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    Create Account
                  </Button>
                </div>
              </>
            )}

            {/* Signup Step 4: Email Verification */}
            {authMode === 'signup' && signupStep === 'verification' && (
              <>
                <div className="flex items-center justify-center gap-2 pb-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="w-8 h-1 rounded-full bg-primary" />
                  ))}
                </div>

                <div className="text-center py-4 space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                    <Mail className="text-success" size={32} />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">Check your email</p>
                    <p className="text-sm text-muted-foreground">
                      We've sent a verification link to:
                    </p>
                    <p className="text-sm font-medium text-primary">{email}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
                    <p className="font-medium">What happens next?</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Click the link in your email</li>
                      <li>You'll be redirected back here</li>
                      <li>Login with your credentials</li>
                      <li>Admin will verify your residency</li>
                    </ol>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setAuthMode('login');
                    resetSignup();
                  }}
                  className="w-full"
                >
                  Go to Login
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Didn't receive the email?{' '}
                  <button
                    type="button"
                    onClick={() => toast.info('Please check your spam folder or try signing up again.')}
                    className="text-primary hover:underline"
                  >
                    Get help
                  </button>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-6 px-4 space-y-2">
          <p>
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-primary underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>.
          </p>
          <p className="font-medium">
            Available for verified residential society members only.
          </p>
        </div>
      </div>
    </div>
  );
}
