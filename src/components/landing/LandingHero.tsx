import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { ChevronRight, Shield, MapPin, Users } from 'lucide-react';

export function LandingHero() {
  const { platformName } = useSystemSettings();

  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Shield className="text-primary" size={16} />
            <span className="text-sm font-semibold text-primary">GPS-Verified Communities Only</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-foreground">
            Your Society's Private<br />
            <span className="text-primary">Marketplace & Services</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {platformName} connects verified residents with trusted home-based sellers, service providers, and community services — all within your residential society.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/welcome">
              <Button size="lg" className="font-semibold px-8 h-12 text-base shadow-cta">
                Get Started <ChevronRight size={18} className="ml-1" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="font-semibold px-8 h-12 text-base">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="text-primary" size={16} />
              <span>GPS Residence Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="text-primary" size={16} />
              <span>Society-Scoped Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="text-primary" size={16} />
              <span>Verified Neighbors Only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
