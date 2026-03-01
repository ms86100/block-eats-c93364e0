import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { VerificationPendingScreen } from '@/components/onboarding/VerificationPendingScreen';
import { MarketplaceSection } from '@/components/home/MarketplaceSection';
import { ReorderLastOrder } from '@/components/home/ReorderLastOrder';
import { SocietyQuickLinks } from '@/components/home/SocietyQuickLinks';
// FeaturedBanners rendered inside MarketplaceSection
import { CommunityTeaser } from '@/components/home/CommunityTeaser';
import { useAuth } from '@/contexts/AuthContext';
import { PartyPopper, X, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getString, setString, restoreKeyIfMissing } from '@/lib/persistent-kv';

export default function HomePage() {
  const { user, profile, isApproved, isSeller, sellerProfiles, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding(user?.id);
  const [showSellerCongrats, setShowSellerCongrats] = useState(false);

  // Refresh profile when congrats banner should show (ensures roles are up-to-date)
  useEffect(() => {
    if (isSeller && sellerProfiles?.some((s: any) => s.verification_status === 'approved') && user) {
      const key = `seller_congrats_seen_${user.id}`;
      restoreKeyIfMissing(key).then(() => {
        if (!getString(key)) {
          // Refresh profile to ensure roles are current
          refreshProfile();
          setShowSellerCongrats(true);
        }
      });
    }
  }, [isSeller, sellerProfiles, user]);

  const handleAddProducts = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    dismissCongrats();
    // Refresh to ensure isSeller is true before navigating
    await refreshProfile();
    navigate('/seller/products');
  }, [refreshProfile, navigate]);

  const dismissCongrats = () => {
    if (user) {
      setString(`seller_congrats_seen_${user.id}`, 'true');
    }
    setShowSellerCongrats(false);
  };

  if (hasChecked && showOnboarding && isApproved) {
    return <OnboardingWalkthrough onComplete={completeOnboarding} />;
  }

  if (!isApproved && profile) {
    return <VerificationPendingScreen />;
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="px-4 py-6 space-y-5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-24 h-9 rounded-full bg-muted animate-pulse shrink-0" />
            ))}
          </div>
          <div className="h-36 rounded-2xl bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/2] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pb-6">
        {/* ═══ SELLER CONGRATS BANNER ═══ */}
        {showSellerCongrats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 relative overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground shadow-cta"
          >
            <button
              onClick={dismissCongrats}
              className="absolute top-3 right-3 p-1 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
                <PartyPopper size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight">🎉 Your store is approved!</h3>
                <p className="text-xs mt-1 text-primary-foreground/85 leading-relaxed">
                  Start adding products and selling to your neighbors.
                </p>
                <Link
                  to="/seller/products"
                  onClick={handleAddProducts}
                  className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold bg-primary-foreground/20 px-3 py-1.5 rounded-lg hover:bg-primary-foreground/30 transition-colors"
                >
                  Add Products <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ C9: INCOMPLETE PROFILE BANNER ═══ */}
        {profile && !profile.flat_number && (
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-muted border border-border p-3">
            <AlertCircle size={18} className="text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">Complete your profile to enable delivery orders.</p>
            </div>
            <Link to="/profile" className="text-xs font-bold text-primary shrink-0 hover:underline">Update</Link>
          </div>
        )}

        {/* FeaturedBanners rendered inside MarketplaceSection — removed here to avoid duplicates (#5) */}

        {/* ═══ REORDER LAST ORDER ═══ */}
        <ReorderLastOrder />

        {/* ═══ SOCIETY QUICK LINKS ═══ */}
        <SocietyQuickLinks />

        {/* ═══ UNIFIED MARKETPLACE ═══ */}
        <MarketplaceSection />

        {/* ═══ COMMUNITY TEASER ═══ */}
        <CommunityTeaser />
      </div>
    </AppLayout>
  );
}
