import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SocietyHealthDashboard } from '@/components/dashboard/SocietyHealthDashboard';
import { CategoryGroupGrid } from '@/components/category/CategoryGroupGrid';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { VerificationPendingScreen } from '@/components/onboarding/VerificationPendingScreen';
import { MarketplaceSection } from '@/components/home/MarketplaceSection';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { Shield, ChevronRight, Activity, Store } from 'lucide-react';

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
        {/* Gate Entry Button */}
        {isFeatureEnabled('resident_identity_verification') && (
          <div className="px-4 pt-4">
            <Link to="/gate-entry">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Shield className="text-primary" size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Gate Entry</h4>
                  <p className="text-sm text-muted-foreground">Show QR code to security</p>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </Link>
          </div>
        )}

        {/* Society Health Dashboard */}
        <div className="px-4 pt-4">
          <SocietyHealthDashboard />
        </div>

        {/* Society Activity Feed */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-primary" size={18} />
            <h3 className="font-semibold text-sm">Recent Activity</h3>
          </div>
          <ActivityFeed />
        </div>

        {/* ═══ UNIFIED MARKETPLACE ═══ */}
        <MarketplaceSection />

        {/* Become a Seller CTA */}
        {!isSeller && (
          <div className="mx-4 mt-6">
            <Link to="/become-seller">
              <div className="bg-secondary rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary-foreground/10 flex items-center justify-center">
                  <Store className="text-secondary-foreground" size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-secondary-foreground">Start Selling</h4>
                  <p className="text-sm text-secondary-foreground/70">
                    Share your homemade food with neighbors
                  </p>
                </div>
                <ChevronRight className="text-secondary-foreground" size={20} />
              </div>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
