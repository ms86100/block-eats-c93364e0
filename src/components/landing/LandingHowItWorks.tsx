import { UserPlus, MapPin, ShoppingCart, CreditCard } from 'lucide-react';

const STEPS = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Sign Up & Verify',
    desc: 'Create an account with your phone number. Verify your residence through GPS-based location check and society invite code. Your account is linked to your specific society.',
  },
  {
    icon: MapPin,
    step: '02',
    title: 'Explore Your Community',
    desc: 'Browse products, home-cooked food, and services listed by verified sellers within your residential society. All listings are society-scoped \u2014 you only see what\u2019s available in your community.',
  },
  {
    icon: ShoppingCart,
    step: '03',
    title: 'Place Orders & Communicate',
    desc: 'Add items to your cart, apply coupons, and place orders. Chat directly with sellers about customizations, timing, and delivery preferences through the in-app messaging system.',
  },
  {
    icon: CreditCard,
    step: '04',
    title: 'Pay & Receive',
    desc: 'Pay via UPI or Cash on Delivery. Sellers prepare and deliver within your society compound. Track order status in real-time and leave reviews after delivery.',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From registration to delivery — a step-by-step guide to using the platform.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          {STEPS.map(({ icon: Icon, step, title, desc }, i) => (
            <div key={step} className="flex gap-6 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-cta">
                  <Icon className="text-primary-foreground" size={24} />
                </div>
                {i < STEPS.length - 1 && <div className="w-px h-12 bg-border mt-2" />}
              </div>
              <div className="pt-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Step {step}</span>
                <h3 className="text-lg font-bold text-foreground mt-1 mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
