import { useState } from 'react';
import { PaymentMethod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Banknote, Smartphone, Check } from 'lucide-react';

interface PaymentMethodSelectorProps {
  acceptsCod: boolean;
  acceptsUpi: boolean;
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({
  acceptsCod,
  acceptsUpi,
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  const methods = [
    {
      id: 'upi' as PaymentMethod,
      label: 'UPI Payment',
      description: 'Pay via GPay, PhonePe, Paytm',
      icon: Smartphone,
      enabled: acceptsUpi,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      id: 'cod' as PaymentMethod,
      label: 'Cash on Delivery',
      description: 'Pay when you receive',
      icon: Banknote,
      enabled: acceptsCod,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-3">
      {methods.map(({ id, label, description, icon: Icon, enabled, color, bgColor }) => (
        <button
          key={id}
          onClick={() => enabled && onSelect(id)}
          disabled={!enabled}
          className={cn(
            'w-full text-left',
            !enabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Card className={cn(
            'transition-all',
            selectedMethod === id && enabled && 'ring-2 ring-primary'
          )}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', bgColor)}>
                <Icon className={color} size={24} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                {!enabled && (
                  <p className="text-xs text-destructive mt-1">Not available for this seller</p>
                )}
              </div>
              {selectedMethod === id && enabled && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="text-primary-foreground" size={14} />
                </div>
              )}
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
