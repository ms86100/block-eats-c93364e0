import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

type AuthStep = 'auth' | 'profile';

interface ProfileData {
  name: string;
  flat_number: string;
  block: string;
  phone: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    flat_number: '',
    block: '',
    phone: '',
  });

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
      
      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();

      if (profile) {
        toast.success('Welcome back!');
        navigate('/');
      } else {
        setStep('profile');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message.includes('Invalid login')) {
        toast.error('Invalid email or password');
      } else {
        toast.error(error.message || 'Failed to login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
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
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Check if user needs email confirmation
        if (data.user.identities?.length === 0) {
          toast.error('This email is already registered. Please login instead.');
          setAuthMode('login');
          return;
        }

        toast.success('Account created! Please complete your profile.');
        setStep('profile');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
        setAuthMode('login');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!profileData.name || !profileData.flat_number || !profileData.block || !profileData.phone) {
      toast.error('Please fill in all fields');
      return;
    }

    if (profileData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          phone: `+91${profileData.phone}`,
          name: profileData.name,
          flat_number: profileData.flat_number,
          block: profileData.block,
        });

      if (profileError) throw profileError;

      // Create default buyer role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'buyer',
        });

      if (roleError) throw roleError;

      toast.success('Profile created! Awaiting community verification.');
      navigate('/');
    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  const blocks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

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
            Greenfield Market
          </h1>
          <p className="text-sm text-white/90 drop-shadow">
            Your community marketplace
          </p>
        </div>
      </div>

      <div className="px-4 -mt-4 relative z-10">
        <Card className="shadow-elevated">
          <CardHeader className="text-center pb-2">
            {step === 'auth' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Mail className="text-primary" size={24} />
                </div>
                <CardTitle>Welcome to Greenfield</CardTitle>
                <CardDescription>
                  {authMode === 'login' ? 'Login to your account' : 'Create a new account'}
                </CardDescription>
              </>
            )}
            {step === 'profile' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <ShieldCheck className="text-success" size={24} />
                </div>
                <CardTitle>Complete Your Profile</CardTitle>
                <CardDescription>
                  Help us verify you're a Greenfield resident
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'auth' && (
              <>
                <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'signup')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4 mt-4">
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
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4 mt-4">
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
                      <p className="text-xs text-muted-foreground">
                        At least 6 characters
                      </p>
                    </div>
                    <Button
                      onClick={handleSignup}
                      disabled={!email || password.length < 6 || isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin mr-2" size={18} />
                      ) : (
                        <ArrowRight className="mr-2" size={18} />
                      )}
                      Create Account
                    </Button>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {step === 'profile' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-muted rounded-md border border-input text-sm font-medium">
                      +91
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="10-digit number"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: formatPhone(e.target.value) })
                      }
                      maxLength={10}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="block">Block</Label>
                    <select
                      id="block"
                      value={profileData.block}
                      onChange={(e) =>
                        setProfileData({ ...profileData, block: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select</option>
                      {blocks.map((b) => (
                        <option key={b} value={b}>
                          Block {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flat">Flat Number</Label>
                    <Input
                      id="flat"
                      placeholder="e.g., 101"
                      value={profileData.flat_number}
                      onChange={(e) =>
                        setProfileData({ ...profileData, flat_number: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateProfile}
                  disabled={
                    !profileData.name ||
                    !profileData.flat_number ||
                    !profileData.block ||
                    profileData.phone.length !== 10 ||
                    isLoading
                  }
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : null}
                  Complete Registration
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          This marketplace is exclusively for Shriram Greenfield residents.
        </p>
      </div>
    </div>
  );
}
