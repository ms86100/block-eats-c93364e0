import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, User, Search, MapPin, Building2, Plus, ArrowLeft, Key, ShieldCheck, Sparkles, Home } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import authHero from '@/assets/auth-hero.jpg';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { useAuthPage } from '@/hooks/useAuthPage';
import { toast } from 'sonner';

export default function AuthPage() {
  const auth = useAuthPage();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background to-secondary/20 overflow-y-auto">
      {/* Hero Banner */}
      <div className="relative h-40 sm:h-56 overflow-hidden">
        <img src={authHero} alt="Community marketplace" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-background" />
        <div className="absolute bottom-6 left-5 right-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="text-primary-foreground" size={16} />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-lg">{auth.settings.platformName}</h1>
          </div>
          <p className="text-sm text-white/80 drop-shadow font-medium">Your Community Marketplace</p>
        </div>
      </div>

      {/* Trust Badge */}
      <div className="mx-5 -mt-3 relative z-10 mb-4">
        <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <ShieldCheck className="text-primary shrink-0" size={18} />
          <p className="text-xs text-foreground/80 font-medium">Exclusively for verified residential society members</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="px-5 pb-8">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* Step Header */}
          <div className="p-6 pb-4">
            {auth.authMode === 'signup' && (
              <div className="flex items-center gap-1 mb-5">
                {auth.stepLabels.map((label, i) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full transition-colors ${i + 1 <= auth.currentStepNum ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={`text-[10px] font-medium ${i + 1 <= auth.currentStepNum ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            <StepHeader authMode={auth.authMode} signupStep={auth.signupStep} societySubStep={auth.societySubStep} />
          </div>

          {/* Form Content */}
          <div className="px-6 pb-6 overflow-visible">
            <AnimatePresence mode="wait">
              {/* Login */}
              {auth.authMode === 'login' && (
                <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Input id="login-email" type="email" placeholder="your@email.com" value={auth.email} onChange={(e) => auth.setEmail(e.target.value)} className="h-12 rounded-xl pr-10" />
                      {auth.email.length > 0 && auth.validateEmail(auth.email) && <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={auth.showPassword ? 'text' : 'password'} placeholder="Enter your password" value={auth.password} onChange={(e) => auth.setPassword(e.target.value)} className="h-12 rounded-xl pr-12" />
                      <button type="button" onClick={() => auth.setShowPassword(!auth.showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {auth.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { auth.setAuthMode('reset'); }} className="text-xs text-primary hover:underline">Forgot password?</button>
                  </div>
                  {auth.isLocked && (
                    <div className="text-center p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                      Too many attempts. Try again in {auth.remainingSeconds}s
                    </div>
                  )}
                  <Button onClick={auth.handleLogin} disabled={!auth.email || !auth.password || auth.isLoading || auth.isLocked} className="w-full h-12 rounded-xl text-base font-semibold">
                    {auth.isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight className="mr-2" size={18} />} Sign In
                  </Button>
                  <div className="text-center pt-1">
                    <button type="button" onClick={() => { auth.setAuthMode('signup'); auth.resetSignup(); }} className="text-sm text-primary font-medium hover:underline">New here? Create an account</button>
                  </div>
                </motion.div>
              )}

              {/* Password Reset */}
              {auth.authMode === 'reset' && (
                <motion.div key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="space-y-4">
                  {auth.resetEmailSent ? (
                    <div className="text-center py-4 space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"><Mail className="text-primary" size={32} /></div>
                      <div className="space-y-2">
                        <p className="font-semibold text-lg">Check your email</p>
                        <p className="text-sm text-muted-foreground">We've sent a password reset link to:</p>
                        <p className="text-sm font-semibold text-primary">{auth.email}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                        <p>📧 Check your inbox and spam folder</p>
                        <p>🔗 Click the link in the email to reset your password</p>
                        <p>⏱️ The link expires in 1 hour</p>
                      </div>
                      <Button onClick={() => auth.setAuthMode('login')} className="w-full h-12 rounded-xl text-base font-semibold"><ArrowLeft size={16} className="mr-2" /> Back to Login</Button>
                      <button type="button" onClick={auth.handlePasswordReset} disabled={auth.isLoading} className="text-xs text-primary hover:underline">{auth.isLoading ? 'Sending...' : "Didn't receive it? Resend"}</button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input id="reset-email" type="email" placeholder="your@email.com" value={auth.email} onChange={(e) => auth.setEmail(e.target.value)} className="h-12 rounded-xl" />
                      </div>
                      <Button onClick={auth.handlePasswordReset} disabled={!auth.email || auth.isLoading} className="w-full h-12 rounded-xl text-base font-semibold">
                        {auth.isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Mail className="mr-2" size={18} />} Send Reset Link
                      </Button>
                      <div className="text-center pt-1">
                        <button type="button" onClick={() => auth.setAuthMode('login')} className="text-sm text-primary font-medium hover:underline">Back to Sign In</button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Signup Step 1: Credentials */}
              {auth.authMode === 'signup' && auth.signupStep === 'credentials' && (
                <motion.div key="signup-credentials" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Input id="signup-email" type="email" placeholder="your@email.com" value={auth.email} onChange={(e) => auth.setEmail(e.target.value)} className="h-12 rounded-xl pr-10" />
                      {auth.email.length > 0 && auth.validateEmail(auth.email) && <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={auth.showPassword ? 'text' : 'password'} placeholder="Create a password (min 6 chars)" value={auth.password} onChange={(e) => auth.setPassword(e.target.value)} className="h-12 rounded-xl pr-12" />
                      <button type="button" onClick={() => auth.setShowPassword(!auth.showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {auth.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={auth.password} />
                  </div>
                  <div className="flex items-start gap-3 pt-1">
                    <Checkbox id="age-confirm" checked={auth.ageConfirmed} onCheckedChange={(checked) => auth.setAgeConfirmed(checked === true)} className="mt-0.5" />
                    <div>
                      <label htmlFor="age-confirm" className="text-xs text-muted-foreground leading-snug">
                        I confirm that I am <strong>18 years of age or older</strong> and agree to the{' '}
                        <a href="#/terms" target="_blank" className="text-primary underline">Terms & Conditions</a> and{' '}
                        <a href="#/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</a>.
                      </label>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Required to comply with marketplace regulations</p>
                    </div>
                  </div>
                  <Button onClick={auth.handleCredentialsNext} disabled={!auth.email || auth.password.length < 6 || !auth.ageConfirmed || auth.isLoading} className="w-full h-12 rounded-xl text-base font-semibold">{auth.isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight className="mr-2" size={18} />} Continue</Button>
                  <div className="text-center pt-1">
                    <button type="button" onClick={() => auth.setAuthMode('login')} className="text-sm text-primary font-medium hover:underline">Already have an account? Sign in</button>
                  </div>
                </motion.div>
              )}

              {/* Signup Step 2: Society */}
              {auth.authMode === 'signup' && auth.signupStep === 'society' && (
                <motion.div key="signup-society" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="space-y-4">
                  <button type="button" onClick={() => auth.setSignupStep('credentials')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"><ArrowLeft size={16} /> Back</button>
                  <AnimatePresence mode="wait">
                    {auth.societySubStep === 'request-form' && (
                      <motion.div key="request-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-3">
                        <div className="space-y-2"><Label>Society Name *</Label><Input placeholder="e.g., Prestige Lakeside Habitat" value={auth.newSocietyData.name} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, name: e.target.value })} className="h-12 rounded-xl" /></div>
                        <div className="space-y-2"><Label>Full Address</Label><Input placeholder="Street, area, locality" value={auth.newSocietyData.address} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, address: e.target.value })} className="h-12 rounded-xl" /></div>
                        <div className="space-y-2"><Label>Landmark</Label><Input placeholder="Near park, temple, mall..." value={auth.newSocietyData.landmark} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, landmark: e.target.value })} className="h-12 rounded-xl" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>City *</Label><Input placeholder="City" value={auth.newSocietyData.city} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, city: e.target.value })} className="h-12 rounded-xl" /></div>
                          <div className="space-y-2"><Label>Pincode *</Label><Input placeholder="PIN code" value={auth.newSocietyData.pincode} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="h-12 rounded-xl" /></div>
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Number *</Label>
                          <div className="flex gap-2">
                            <div className="flex items-center px-3 bg-muted rounded-xl border border-input text-sm font-medium h-12">{auth.settings.defaultCountryCode}</div>
                            <Input placeholder="Your phone number" value={auth.newSocietyData.contact} onChange={(e) => auth.setNewSocietyData({ ...auth.newSocietyData, contact: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} className="flex-1 h-12 rounded-xl" />
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">Your request will be reviewed by our team. We'll contact you once the society is approved and activated.</div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => auth.setSocietySubStep('search')} className="flex-1 h-12 rounded-xl">Back</Button>
                          <Button onClick={auth.handleRequestNewSociety} disabled={auth.isLoading || !auth.newSocietyData.name || !auth.newSocietyData.city || !auth.newSocietyData.pincode || auth.newSocietyData.contact.length !== 10} className="flex-1 h-12 rounded-xl font-semibold">
                            {auth.isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null} Submit Request
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {auth.societySubStep === 'search' && (
                      <motion.div key="search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
                        {!auth.mapsLoaded && (
                          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-xl border border-border animate-pulse">
                            <Loader2 size={14} className="text-muted-foreground animate-spin shrink-0" />
                            <span className="text-xs text-muted-foreground">Loading Google Maps...</span>
                          </div>
                        )}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input placeholder="Search society, area, landmark, pincode..." value={auth.societySearch} onChange={(e) => auth.handleSearchChange(e.target.value)} className="pl-9 h-12 rounded-xl" autoFocus />
                          {(auth.isSearching || auth.isLoadingSocieties) && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />}
                        </div>
                        {(auth.showDbResults || auth.showGoogleResults) && (
                          <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin">
                            {auth.showDbResults && (
                              <>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Registered Societies</p>
                                {auth.filteredSocieties.map((s) => (
                                  <button key={s.id} onClick={() => auth.handleSelectDbSociety(s)} className={`w-full text-left p-3 rounded-xl border-2 transition-all ${auth.selectedSociety?.id === s.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 size={18} className="text-primary" /></div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{s.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{[s.city, s.state, s.pincode].filter(Boolean).join(', ')}</p>
                                      </div>
                                      {auth.selectedSociety?.id === s.id && <CheckCircle2 size={18} className="text-primary shrink-0 ml-auto" />}
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                            {auth.showGoogleResults && (
                              <>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mt-2">Google Maps Results</p>
                                {auth.predictions.map((p) => (
                                  <button key={p.placeId} onClick={() => auth.handleSelectGooglePlace(p.placeId)} className="w-full text-left p-3 rounded-xl border-2 border-border hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><MapPin size={18} className="text-accent" /></div>
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
                        {auth.societySearch.length >= 3 && !auth.showDbResults && !auth.showGoogleResults && !auth.isSearching && !auth.selectedSociety && (
                          <p className="text-center text-sm text-muted-foreground py-4">No results found for "{auth.societySearch}"</p>
                        )}
                        {auth.societySearch.length < 2 && !auth.selectedSociety && (
                          <div className="text-center py-6 space-y-2">
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Search size={20} className="text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">Start typing to search for your society</p>
                            <p className="text-xs text-muted-foreground/70">Search by society name, area, landmark, or pincode</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => auth.setSignupStep('credentials')} className="flex-1 h-12 rounded-xl"><ArrowLeft size={16} className="mr-1" /> Back</Button>
                          <Button onClick={auth.handleSocietyNext} disabled={!auth.selectedSociety || (auth.selectedSociety.invite_code ? !auth.inviteCode.trim() : false)} className="flex-1 h-12 rounded-xl font-semibold">Continue</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Signup Step 3: Profile */}
              {auth.authMode === 'signup' && auth.signupStep === 'profile' && (
                <motion.div key="signup-profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="space-y-4">
                  <button type="button" onClick={() => auth.setSignupStep('society')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"><ArrowLeft size={16} /> Back</button>
                  {auth.selectedSociety && (
                    <div className="flex items-center gap-2 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
                      <Building2 size={14} className="text-primary" />
                      <span className="text-sm font-medium truncate">{auth.selectedSociety.name}</span>
                      <button onClick={() => auth.setSignupStep('society')} className="ml-auto text-xs text-primary hover:underline shrink-0">Change</button>
                    </div>
                  )}
                  <div className="space-y-2"><Label htmlFor="name">Full Name *</Label><Input id="name" placeholder="Enter your name" value={auth.profileData.name} onChange={(e) => auth.setProfileData({ ...auth.profileData, name: e.target.value })} className="h-12 rounded-xl" /></div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 bg-muted rounded-xl border border-input text-sm font-medium h-12">{auth.settings.defaultCountryCode}</div>
                      <Input id="phone" type="tel" placeholder="10-digit number" value={auth.profileData.phone} onChange={(e) => auth.setProfileData({ ...auth.profileData, phone: auth.formatPhone(e.target.value) })} maxLength={10} className="flex-1 h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="phase">Phase / Wing (optional)</Label><Input id="phase" placeholder="e.g., Phase 1, Wing A" value={auth.profileData.phase} onChange={(e) => auth.setProfileData({ ...auth.profileData, phase: e.target.value })} className="h-12 rounded-xl" /></div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label htmlFor="block">{auth.settings.addressBlockLabel} *</Label><Input id="block" placeholder="e.g., A, B, T1" value={auth.profileData.block} onChange={(e) => auth.setProfileData({ ...auth.profileData, block: e.target.value })} className="h-12 rounded-xl" /></div>
                      <div className="space-y-2"><Label htmlFor="flat">{auth.settings.addressFlatLabel} *</Label><Input id="flat" placeholder="e.g., 101" value={auth.profileData.flat_number} onChange={(e) => auth.setProfileData({ ...auth.profileData, flat_number: e.target.value })} className="h-12 rounded-xl" /></div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 px-1">Used for delivery and identity verification within your society</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => auth.setSignupStep('society')} className="flex-1 h-12 rounded-xl"><ArrowLeft size={16} className="mr-1" /> Back</Button>
                    <Button onClick={auth.handleSignupComplete} disabled={!auth.profileData.name || !auth.profileData.flat_number || !auth.profileData.block || auth.profileData.phone.length !== 10 || auth.isLoading} className="flex-1 h-12 rounded-xl font-semibold">
                      {auth.isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null} Create Account
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Signup Step 4: Verification */}
              {auth.authMode === 'signup' && auth.signupStep === 'verification' && (
                <motion.div key="signup-verification" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="space-y-4">
                  <div className="text-center py-4 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"><Mail className="text-primary" size={32} /></div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">📧 Check Your Inbox!</p>
                      <p className="text-sm text-muted-foreground">We've sent a verification link to:</p>
                      <p className="text-sm font-semibold text-primary">{auth.email}</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left text-sm space-y-2">
                      <p className="font-bold text-primary">⚠️ Important: You must verify before logging in</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                        <li>Open your email inbox (check spam/junk too)</li>
                        <li>Click the <span className="font-semibold text-foreground">"Confirm your email"</span> link</li>
                        <li>Come back here and <span className="font-semibold text-foreground">log in</span> with your credentials</li>
                      </ol>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-destructive font-medium">🚫 You won't be able to log in until you verify your email</div>
                  </div>
                  <Button onClick={() => { auth.setAuthMode('login'); auth.resetSignup(); }} className="w-full h-12 rounded-xl text-base font-semibold">I've Verified — Go to Login</Button>
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
          <p>By continuing, you agree to our{' '}<Link to="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link>{' '}and{' '}<Link to="/privacy-policy" className="text-primary font-medium hover:underline">Privacy Policy</Link>.</p>
          <p className="font-medium text-muted-foreground/70">Available for verified residential society members only.</p>
        </div>
      </div>
    </div>
  );
}

// ── Step Header sub-component ──
function StepHeader({ authMode, signupStep, societySubStep }: { authMode: string; signupStep: string; societySubStep: string }) {
  const iconClass = "mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3";
  const configs: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
    login: { icon: <Sparkles className="text-primary" size={26} />, title: 'Welcome Back', subtitle: 'Sign in to your community' },
    reset: { icon: <Key className="text-primary" size={26} />, title: 'Reset Password', subtitle: "We'll send you a reset link" },
    'signup-credentials': { icon: <Mail className="text-primary" size={26} />, title: 'Create Account', subtitle: 'Join your neighborhood community' },
    'signup-society-search': { icon: <MapPin className="text-primary" size={26} />, title: 'Find Your Society', subtitle: 'Search by name, area, or pincode' },
    'signup-society-map-confirm': { icon: <MapPin className="text-primary" size={26} />, title: 'Confirm Location', subtitle: 'Verify the pin on the map' },
    'signup-society-request-form': { icon: <MapPin className="text-primary" size={26} />, title: 'Request Society', subtitle: 'Submit details for admin review' },
    'signup-profile': { icon: <User className="text-primary" size={26} />, title: 'Your Details', subtitle: 'Almost there!' },
    'signup-verification': { icon: <CheckCircle2 className="text-primary" size={26} />, title: 'Check Your Email', subtitle: 'Verification sent' },
  };

  const key = authMode === 'signup'
    ? signupStep === 'society' ? `signup-society-${societySubStep}` : `signup-${signupStep}`
    : authMode;

  const config = configs[key];
  if (!config) return null;

  return (
    <div className="text-center">
      <div className={iconClass}>{config.icon}</div>
      <h2 className="text-xl font-bold">{config.title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
    </div>
  );
}
