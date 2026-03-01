import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Building2, Globe, Target, Scale } from 'lucide-react';

export function LandingAbout() {
  const { platformName } = useSystemSettings();

  return (
    <section id="about" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">About Us</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Building trusted, hyperlocal commerce for residential communities across India.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-6 rounded-2xl bg-card border border-border">
            <Building2 className="text-primary mb-4" size={28} />
            <h3 className="font-bold text-foreground mb-2">Legal Entity</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {platformName} is operated by Sociva Technologies. The platform is a registered business entity operating under the laws of India, committed to transparency and regulatory compliance.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border">
            <Target className="text-primary mb-4" size={28} />
            <h3 className="font-bold text-foreground mb-2">Our Mission</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To empower residential communities by providing a secure, verified marketplace where neighbors can buy, sell, and access services — fostering trust, convenience, and local entrepreneurship.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border">
            <Globe className="text-primary mb-4" size={28} />
            <h3 className="font-bold text-foreground mb-2">Operating Geography</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Currently serving residential societies across India, with primary operations in Bangalore, Karnataka. Expanding to new cities and communities on an ongoing basis.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border">
            <Scale className="text-primary mb-4" size={28} />
            <h3 className="font-bold text-foreground mb-2">Business Model</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {platformName} operates as a marketplace facilitator under Section 79 of the Information Technology Act, 2000. We connect buyers and sellers but are not a party to the transactions. All products and services are provided by independent, verified community sellers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
