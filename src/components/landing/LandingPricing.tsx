import { Check } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';

const PLANS = [
  {
    name: 'Buyers',
    price: 'Free',
    period: 'forever',
    desc: 'Browse, order, and connect with your community at no cost.',
    features: [
      'Browse all listings in your society',
      'Place unlimited orders',
      'Chat with sellers directly',
      'Leave reviews & ratings',
      'Apply seller coupon codes',
      'Real-time order tracking',
    ],
  },
  {
    name: 'Sellers',
    price: 'Free',
    period: 'to start',
    desc: 'List your products and services to reach your community.',
    badge: 'Most Popular',
    features: [
      'List products, food, or services',
      'Accept UPI & Cash on Delivery',
      'Real-time order management dashboard',
      'Push notification alerts for new orders',
      'Create promotional coupons',
      'Customer reviews and ratings',
    ],
  },
];

export function LandingPricing() {
  const { currencySymbol, platformFeePercent } = useSystemSettings();

  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Pricing & Commercial Model</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparent pricing with no hidden fees. The platform operates as a marketplace facilitator.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-12">
          {PLANS.map(plan => (
            <div key={plan.name} className={`p-8 rounded-2xl bg-card border ${plan.badge ? 'border-primary shadow-md' : 'border-border'}`}>
              {plan.badge && (
                <span className="inline-block text-xs font-bold text-primary-foreground bg-primary px-3 py-1 rounded-full mb-4">{plan.badge}</span>
              )}
              <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
              <ul className="space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="text-primary shrink-0 mt-0.5" size={16} />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Commercial model explanation */}
        <div className="max-w-3xl mx-auto bg-muted/50 rounded-2xl p-8 border border-border">
          <h3 className="text-lg font-bold text-foreground mb-4">How Payments Work</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Marketplace Facilitator:</strong> The platform acts as an intermediary connecting buyers with independent sellers within residential communities. It does not directly sell or deliver products.</p>
            <p><strong className="text-foreground">Payment Methods:</strong> Buyers pay sellers via UPI (Google Pay, PhonePe, Paytm) or Cash on Delivery. Online payments are processed securely through Razorpay.</p>
            <p><strong className="text-foreground">Platform Fee:</strong> {platformFeePercent > 0 ? `A ${platformFeePercent}% platform fee may apply on transactions.` : 'Currently no platform fee is charged on transactions.'}</p>
            <p><strong className="text-foreground">Currency:</strong> All prices are displayed in {currencySymbol === '₹' ? 'Indian Rupees (INR)' : currencySymbol}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
