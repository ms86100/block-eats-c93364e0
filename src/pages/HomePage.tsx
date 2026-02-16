import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { VerificationPendingScreen } from '@/components/onboarding/VerificationPendingScreen';
import { MarketplaceSection } from '@/components/home/MarketplaceSection';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { Shield, ChevronRight, Store } from 'lucide-react';

export default function HomePage() {
  const { user, profile, isApproved, isSeller } = useAuth();
  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding();
  const { isFeatureEnabled } = useEffectiveFeatures();

  if (hasChecked && showOnboarding && isApproved) {
    return <OnboardingWalkthrough onComplete={completeOnboarding} />;
  }

  if (!isApproved && profile) {
    return <VerificationPendingScreen />;
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pb-4">
        {/* ═══ UNIFIED MARKETPLACE ═══ */}
        <MarketplaceSection />

        {/* Gate Entry — below marketplace */}
        {isFeatureEnabled('resident_identity_verification') && (
          <div className="px-4 mt-3">
            <Link to="/gate-entry">
              <div className="bg-card border border-border/40 rounded-2xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Shield className="text-primary-foreground" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-foreground">Gate Entry</h4>
                  <p className="text-[11px] text-muted-foreground">Show QR code to security</p>
                </div>
                <ChevronRight className="text-muted-foreground shrink-0" size={18} />
              </div>
            </Link>
          </div>
        )}

        {/* Become a Seller CTA */}
        {!isSeller && (
          <div className="mx-4 mt-4">
            <Link to="/become-seller">
              <div className="bg-accent rounded-2xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-accent-foreground/20 flex items-center justify-center">
                  <Store className="text-accent-foreground" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-accent-foreground">Start Selling</h4>
                  <p className="text-[11px] text-accent-foreground/80">
                    Share your homemade food with neighbors
                  </p>
                </div>
                <ChevronRight className="text-accent-foreground/60 shrink-0" size={18} />
              </div>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
