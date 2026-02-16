import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Shield, Check, X, AlertTriangle } from 'lucide-react';

const RULES = [
  {
    title: 'For Buyers',
    do: [
      'Be respectful when communicating with sellers',
      'Provide accurate delivery details',
      'Pick up orders on time or be available for delivery',
      'Give honest and fair reviews',
      'Report issues through the app',
    ],
    dont: [
      'Use abusive language in chat or reviews',
      'Cancel orders repeatedly without reason',
      'Negotiate prices outside the app',
      'Share personal contact details publicly',
    ],
  },
  {
    title: 'For Sellers',
    do: [
      'Maintain food safety and hygiene standards',
      'Keep your menu and availability up to date',
      'Respond to orders promptly',
      'Communicate clearly with buyers',
      'Honor all accepted orders',
    ],
    dont: [
      'Accept orders you cannot fulfill',
      'Misrepresent food items or ingredients',
      'Share buyer contact details with others',
      'Charge differently than listed prices',
    ],
  },
];

const VIOLATIONS = [
  { level: 'Warning', description: 'First-time minor violations', action: 'Written warning' },
  { level: 'Temporary Suspension', description: 'Repeated violations or serious misconduct', action: '7-day account suspension' },
  { level: 'Permanent Ban', description: 'Severe violations or repeated serious misconduct', action: 'Account permanently disabled' },
];

export default function CommunityRulesPage() {
  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-8 safe-top">
        <Link to="/help" className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span>Back to Help</span>
        </Link>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <Shield className="text-warning" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Community Guidelines</h1>
          <p className="text-muted-foreground mt-1">
            Rules for a safe and trusted marketplace
          </p>
        </div>

        {/* Rules */}
        {RULES.map(({ title, do: doList, dont: dontList }) => (
          <Card key={title} className="mb-4">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">{title}</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-success flex items-center gap-2 mb-2">
                    <Check size={16} />
                    Do
                  </p>
                  <ul className="space-y-1.5">
                    {doList.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-success mt-0.5">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
                    <X size={16} />
                    Don't
                  </p>
                  <ul className="space-y-1.5">
                    {dontList.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-destructive mt-0.5">✗</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Violations */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-warning" size={18} />
              <h3 className="font-semibold">Violation Consequences</h3>
            </div>
            
            <div className="space-y-3">
              {VIOLATIONS.map(({ level, description, action }) => (
                <div key={level} className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-sm">{level}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  <p className="text-xs text-warning mt-1">{action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By using Sociva, you agree to follow these guidelines.
          Report violations through the app or contact the admin.
        </p>
      </div>
    </AppLayout>
  );
}
