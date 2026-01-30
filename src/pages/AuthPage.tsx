import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Phone, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

type AuthStep = 'phone' | 'otp' | 'profile';

interface ProfileData {
  name: string;
  flat_number: string;
  block: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    flat_number: '',
    block: '',
  });

  const formatPhone = (value: string) => {
    // Keep only digits
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });

      if (error) throw error;
      
      toast.success('OTP sent to your phone');
      setStep('otp');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: otp,
        type: 'sms',
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
      console.error('Error verifying OTP:', error);
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!profileData.name || !profileData.flat_number || !profileData.block) {
      toast.error('Please fill in all fields');
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
          phone: `+91${phone}`,
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
            {step === 'phone' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Phone className="text-primary" size={24} />
                </div>
                <CardTitle>Welcome to Greenfield</CardTitle>
                <CardDescription>
                  Enter your phone number to get started
                </CardDescription>
              </>
            )}
            {step === 'otp' && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <ShieldCheck className="text-primary" size={24} />
                </div>
                <CardTitle>Verify OTP</CardTitle>
                <CardDescription>
                  Enter the 6-digit code sent to +91 {phone}
                </CardDescription>
              </>
            )}
            {step === 'profile' && (
              <>
                <CardTitle>Complete Your Profile</CardTitle>
                <CardDescription>
                  Help us verify you're a Greenfield resident
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'phone' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-muted rounded-md border border-input text-sm font-medium">
                      +91
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="flex-1"
                      maxLength={10}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSendOTP}
                  disabled={phone.length !== 10 || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : (
                    <ArrowRight className="mr-2" size={18} />
                  )}
                  Continue
                </Button>
              </>
            )}

            {step === 'otp' && (
              <>
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otp.length !== 6 || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : null}
                  Verify OTP
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOtp('');
                    setStep('phone');
                  }}
                  className="w-full"
                >
                  Change phone number
                </Button>
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
