import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { VerificationPendingScreen } from '@/components/onboarding/VerificationPendingScreen';
import { MarketplaceSection } from '@/components/home/MarketplaceSection';
import { SocietyQuickLinks } from '@/components/home/SocietyQuickLinks';
import { CommunityTeaser } from '@/components/home/CommunityTeaser';
import { useAuth } from '@/contexts/AuthContext';
import { PartyPopper, X, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  const { user, profile, isApproved, isSeller, sellerProfiles } = useAuth();
  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding();
  const [showSellerCongrats, setShowSellerCongrats] = useState(false);

  useEffect(() => {
    if (isSeller && sellerProfiles?.some((s: any) => s.verification_status === 'approved') && user) {
      const key = `seller_congrats_seen_${user.id}`;
      if (!localStorage.getItem(key)) {
        setShowSellerCongrats(true);
      }
    }
  }, [isSeller, sellerProfiles, user]);

  const dismissCongrats = () => {
    if (user) {
      localStorage.setItem(`seller_congrats_seen_${user.id}`, 'true');
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
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
                  onClick={dismissCongrats}
                  className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold bg-primary-foreground/20 px-3 py-1.5 rounded-lg hover:bg-primary-foreground/30 transition-colors"
                >
                  Add Products <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

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
