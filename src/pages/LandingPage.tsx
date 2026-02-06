import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Utensils, 
  ShoppingBag, 
  Wrench, 
  GraduationCap, 
  Package,
  Star,
  Shield,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

const features = [
  {
    icon: Utensils,
    title: 'Homemade Food',
    description: 'Fresh meals, snacks & bakery items from your neighbors',
    color: 'bg-orange-500/10 text-orange-500',
  },
  {
    icon: ShoppingBag,
    title: 'Local Shopping',
    description: 'Buy & sell pre-loved items within the community',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    icon: Wrench,
    title: 'Home Services',
    description: 'Electricians, plumbers & repair services at your doorstep',
    color: 'bg-green-500/10 text-green-500',
  },
  {
    icon: GraduationCap,
    title: 'Classes & Tutoring',
    description: 'Yoga, dance, music & academic coaching nearby',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    icon: Package,
    title: 'Rentals',
    description: 'Party supplies, equipment & more on rent',
    color: 'bg-pink-500/10 text-pink-500',
  },
];

const benefits = [
  {
    icon: Shield,
    title: 'Verified Residents Only',
    description: 'All sellers are verified Greenfield community members',
  },
  {
    icon: MapPin,
    title: 'Hyperlocal Delivery',
    description: 'Everything delivered within the community',
  },
  {
    icon: Clock,
    title: 'Quick & Convenient',
    description: 'Order anytime, get it delivered fast',
  },
  {
    icon: Users,
    title: 'Support Neighbors',
    description: 'Your purchases help local home businesses thrive',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[70vh] min-h-[500px]">
        <img
          src={heroBanner}
          alt="Community marketplace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        
        {/* Hero Content */}
        <div className="relative h-full flex flex-col justify-end px-6 pb-8 safe-top">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30">
              <Sparkles className="text-primary" size={14} />
              <span className="text-xs font-medium text-primary">Exclusive for Greenfield Residents</span>
            </div>
            
            <h1 className="text-4xl font-bold text-white leading-tight">
              Your Community<br />
              <span className="text-primary">Marketplace</span>
            </h1>
            
            <p className="text-white/80 text-lg max-w-xs">
              Buy homemade food, local goods & services from your trusted neighbors at Shriram Greenfield.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-6 py-8 -mt-4 relative z-10">
        <div className="bg-card rounded-2xl shadow-xl p-6 border border-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="text-primary" size={20} />
            What's Available
          </h2>
          
          <div className="space-y-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${feature.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="px-6 py-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Star className="text-warning" size={20} />
          Why Choose Us
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div 
                key={index}
                className="p-4 rounded-xl bg-card border border-border"
              >
                <Icon className="text-primary mb-2" size={24} />
                <h3 className="font-medium text-sm mb-1">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Testimonial/Social Proof */}
      <div className="px-6 py-6">
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20">
          <div className="flex items-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="fill-warning text-warning" size={16} />
            ))}
          </div>
          <p className="text-sm italic text-foreground/80 mb-3">
            "Finally a marketplace just for our community! I love ordering homemade food from my neighbors. It's fresh, tasty, and delivered in minutes!"
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            — Priya S., Block C Resident
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-6 py-4">
        <div className="flex justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-primary">50+</p>
            <p className="text-xs text-muted-foreground">Local Sellers</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-primary">12</p>
            <p className="text-xs text-muted-foreground">Categories</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-primary">100%</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-6 py-8 pb-12 safe-bottom">
        <div className="space-y-3">
          <Link to="/auth" className="block">
            <Button className="w-full h-14 text-base font-semibold" size="lg">
              Get Started
              <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
          
          <p className="text-center text-xs text-muted-foreground">
            Available exclusively for Shriram Greenfield residents.<br />
            <Link to="/auth" className="text-primary hover:underline">
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Footer Links */}
      <div className="px-6 pb-8 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
      </div>
    </div>
  );
}
