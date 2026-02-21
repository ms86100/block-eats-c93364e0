import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_LABELS } from '@/types/database';
import { OrderItemStatusBadge, ItemStatus } from './OrderItemStatusBadge';
import { ChevronRight, Clock, CreditCard, Package, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';

interface OrderItemWithStatus {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  status?: string;
}

interface SellerOrderCardOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status?: string | null;
  payment_type?: string | null;
  buyer?: { name: string; block: string; flat_number: string };
  items?: OrderItemWithStatus[];
}

interface SellerOrderCardProps {
  order: SellerOrderCardOrder;
}

export function SellerOrderCard({ order }: SellerOrderCardProps) {
  const buyer = order.buyer;
  const items = order.items || [];
  const statusInfo = ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || { label: order.status, color: 'bg-muted text-muted-foreground' };

  // Calculate item-level stats
  const itemStatuses = items.map(item => item.status || 'pending');
  const pendingItems = itemStatuses.filter(s => s === 'pending').length;
  const preparingItems = itemStatuses.filter(s => s === 'preparing').length;
  const readyItems = itemStatuses.filter(s => s === 'ready').length;
  const deliveredItems = itemStatuses.filter(s => s === 'delivered').length;

  const getPaymentBadge = () => {
    if (order.payment_status === 'paid') {
      return <Badge variant="outline" className="text-success border-success text-[10px]">Paid</Badge>;
    }
    if (order.payment_type === 'cod') {
      return <Badge variant="outline" className="text-warning border-warning text-[10px]">COD</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Pending</Badge>;
  };

  return (
    <Link to={`/orders/${order.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Header: Customer & Order Status */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User size={14} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{buyer?.name || 'Customer'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {buyer?.block}-{buyer?.flat_number}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {getPaymentBadge()}
            </div>
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock size={12} />
              <span>{format(new Date(order.created_at), 'MMM d, h:mm a')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
              <CreditCard size={12} />
              <span className="font-medium text-foreground">₹{order.total_amount}</span>
            </div>
          </div>

          {/* Items Summary */}
          <div className="bg-muted/50 rounded-lg p-2.5 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Package size={12} className="text-muted-foreground" />
              <span className="text-xs font-medium">{items.length} Items</span>
            </div>
            
            {/* Show first 3 items with their individual status */}
            <div className="space-y-1.5">
              {items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground line-clamp-1 max-w-[65%]">
                    {item.quantity}x {item.product_name}
                  </span>
                  <OrderItemStatusBadge status={(item.status || 'pending') as ItemStatus} />
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-[10px] text-muted-foreground">
                  +{items.length - 3} more items
                </p>
              )}
            </div>
          </div>

          {/* Item Status Summary Bar */}
          {items.length > 1 && (
            <div className="flex items-center gap-2 text-[10px] mb-2">
              {pendingItems > 0 && (
                <span className="text-muted-foreground">{pendingItems} pending</span>
              )}
              {preparingItems > 0 && (
                <span className="text-warning">{preparingItems} preparing</span>
              )}
              {readyItems > 0 && (
                <span className="text-info">{readyItems} ready</span>
              )}
              {deliveredItems > 0 && (
                <span className="text-success">{deliveredItems} delivered</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MessageSquare size={10} />
              <span>View details & chat</span>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
