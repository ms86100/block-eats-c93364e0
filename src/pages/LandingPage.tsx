import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingTrustBar } from '@/components/landing/LandingTrustBar';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { LandingAbout } from '@/components/landing/LandingAbout';
import { LandingContact } from '@/components/landing/LandingContact';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background overflow-y-auto">
      <LandingNav />
      <LandingHero />
      <LandingTrustBar />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingAbout />
      <LandingContact />
      <LandingFooter />
    </div>
  );
}
