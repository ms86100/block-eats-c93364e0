import {
  ShoppingBag, Utensils, Wrench, MapPin, Shield, Star,
  MessageSquare, CreditCard, Bell, BarChart3, Package, Users,
} from 'lucide-react';

const BUYER_FEATURES = [
  { icon: ShoppingBag, title: 'Browse & Order', desc: 'Discover products, groceries, and services from verified sellers in your society.' },
  { icon: Utensils, title: 'Home-Cooked Food', desc: 'Order fresh meals, tiffins, and snacks prepared by your neighbors.' },
  { icon: Wrench, title: 'Local Services', desc: 'Book home repairs, tuition, fitness classes, and more from trusted community providers.' },
  { icon: CreditCard, title: 'UPI & Cash on Delivery', desc: 'Pay securely via UPI or choose Cash on Delivery — no credit card required.' },
  { icon: Star, title: 'Reviews & Ratings', desc: 'Rate sellers and read genuine reviews from fellow residents.' },
  { icon: MessageSquare, title: 'In-App Chat', desc: 'Message sellers directly about orders, customizations, and delivery timing.' },
];

const SELLER_FEATURES = [
  { icon: Package, title: 'Easy Listing', desc: 'List products and services in minutes with photos, pricing, and availability schedules.' },
  { icon: Bell, title: 'Real-Time Notifications', desc: 'Instant alerts for new orders, messages, and status updates via push notifications.' },
  { icon: BarChart3, title: 'Seller Dashboard', desc: 'Track orders, revenue, and customer reviews in a comprehensive analytics dashboard.' },
  { icon: Users, title: 'Community Reach', desc: 'Reach hundreds of verified residents in your society without marketing costs.' },
  { icon: Shield, title: 'Verified Buyers', desc: 'Every buyer is a GPS-verified resident — no fraud, no strangers.' },
  { icon: MapPin, title: 'Hyperlocal Delivery', desc: 'Deliver within your society compound — zero logistics overhead.' },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Platform Features</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete marketplace infrastructure for residential communities — built for buyers, sellers, and society administrators.
          </p>
        </div>

        {/* Buyer features */}
        <div className="mb-16">
          <h3 className="text-xl font-bold text-foreground mb-8 text-center">For Buyers & Residents</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUYER_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="text-primary" size={22} />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Seller features */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-8 text-center">For Sellers & Service Providers</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SELLER_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="text-primary" size={22} />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
