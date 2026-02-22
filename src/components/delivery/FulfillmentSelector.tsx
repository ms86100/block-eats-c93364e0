import { Package, Truck } from 'lucide-react';

interface FulfillmentSelectorProps {
  value: 'self_pickup' | 'delivery';
  onChange: (value: 'self_pickup' | 'delivery') => void;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  orderValue?: number;
}

export function FulfillmentSelector({ value, onChange, deliveryFee, freeDeliveryThreshold = 500, orderValue = 0 }: FulfillmentSelectorProps) {
  const isFreeDelivery = orderValue >= freeDeliveryThreshold;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fulfillment</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange('self_pickup')}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
            value === 'self_pickup'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-muted-foreground/30'
          }`}
        >
          <Package size={20} className={value === 'self_pickup' ? 'text-primary' : 'text-muted-foreground'} />
          <span className={`text-sm font-medium ${value === 'self_pickup' ? 'text-primary' : 'text-foreground'}`}>
            Self Pickup
          </span>
          <span className="text-[11px] text-primary font-medium">FREE</span>
        </button>
        <button
          onClick={() => onChange('delivery')}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
            value === 'delivery'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-muted-foreground/30'
          }`}
        >
          <Truck size={20} className={value === 'delivery' ? 'text-primary' : 'text-muted-foreground'} />
          <span className={`text-sm font-medium ${value === 'delivery' ? 'text-primary' : 'text-foreground'}`}>
            Delivery
          </span>
          <span className={`text-[11px] font-medium ${isFreeDelivery ? 'text-primary' : 'text-muted-foreground'}`}>
            {isFreeDelivery ? 'FREE' : `₹${deliveryFee}`}
          </span>
        </button>
      </div>
      {value === 'delivery' && !isFreeDelivery && freeDeliveryThreshold > 0 && (
        <p className="text-[11px] text-muted-foreground text-center">
          Free delivery on orders above ₹{freeDeliveryThreshold}
        </p>
      )}
    </div>
  );
}
