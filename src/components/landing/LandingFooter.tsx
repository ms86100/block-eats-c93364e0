import { Link } from 'react-router-dom';
import { useSystemSettings } from '@/hooks/useSystemSettings';

export function LandingFooter() {
  const { platformName } = useSystemSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="py-12 bg-card border-t border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">{platformName.charAt(0)}</span>
              </div>
              <span className="font-bold text-foreground">{platformName}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A private, GPS-verified marketplace for residential communities. Connecting neighbors with trusted sellers and services.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Legal</h4>
            <div className="space-y-2">
              <Link to="/privacy-policy" className="block text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="block text-sm text-muted-foreground hover:text-foreground">Terms & Conditions</Link>
              <Link to="/refund-policy" className="block text-sm text-muted-foreground hover:text-foreground">Refund & Cancellation Policy</Link>
              <Link to="/pricing" className="block text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Product</h4>
            <div className="space-y-2">
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="block text-sm text-muted-foreground hover:text-foreground">Features</button>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="block text-sm text-muted-foreground hover:text-foreground">How It Works</button>
              <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="block text-sm text-muted-foreground hover:text-foreground">About Us</button>
              <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="block text-sm text-muted-foreground hover:text-foreground">Contact</button>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {year} Sociva Technologies. All rights reserved. Operated under the laws of India.
          </p>
        </div>
      </div>
    </footer>
  );
}
