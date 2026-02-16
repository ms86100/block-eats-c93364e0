import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowLeft } from 'lucide-react';

const plans = [
  {
    name: 'Free (Buyers)',
    price: 'Free',
    period: 'forever',
    description: 'Browse, order, and connect with your community.',
    badge: null,
    features: [
      'Browse all listings in your society',
      'Place unlimited orders',
      'Chat with sellers',
      'Leave reviews & ratings',
      'Apply coupon codes',
    ],
  },
  {
    name: 'Free (Sellers)',
    price: 'Free',
    period: 'to start',
    description: 'Start selling to your neighbors today.',
    badge: null,
    features: [
      'List up to 10 products/services',
      'Basic seller dashboard',
      'Accept COD & UPI payments',
      'Receive order notifications',
      'Community visibility',
    ],
  },
  {
    name: 'Seller Pro',
    price: '₹199',
    period: '/month',
    description: 'Unlock the full power of your home business.',
    badge: 'Popular',
    features: [
      'Unlimited product listings',
      'Create coupons & promotions',
      'Advanced analytics dashboard',
      'Priority in search results',
      'Featured seller badge',
      'Bulk order management',
    ],
  },
  {
    name: 'Society Plan',
    price: '₹999',
    period: '/month',
    description: 'For society administrators and RWAs.',
    badge: 'Enterprise',
    features: [
      'White-label society branding',
      'Custom community rules',
      'Admin moderation tools',
      'Member verification controls',
      'Priority support',
      'Analytics for society activity',
    ],
  },
];

export default function PricingPage() {
  return (
    <AppLayout showHeader={false}>
      <div className="p-4 pb-8 safe-top">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Pricing</h1>
            <p className="text-sm text-muted-foreground">Simple, transparent pricing for everyone</p>
          </div>
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.badge === 'Popular' ? 'border-primary shadow-md' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.badge && (
                    <Badge variant={plan.badge === 'Popular' ? 'default' : 'secondary'}>
                      {plan.badge}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="text-primary shrink-0 mt-0.5" size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.price !== 'Free' && (
                  <Button className="w-full mt-4" variant={plan.badge === 'Popular' ? 'default' : 'outline'} onClick={() => window.open('mailto:support@sociva.com?subject=Inquiry about ' + plan.name, '_blank')}>
                    Contact Us
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          All prices are in INR. GST applicable where required.
        </p>
      </div>
    </AppLayout>
  );
}
