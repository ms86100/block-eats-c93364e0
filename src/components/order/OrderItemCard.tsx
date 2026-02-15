import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderItem, ItemStatus, ITEM_STATUS_LABELS } from '@/types/database';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OrderItemCardProps {
  item: OrderItem;
  isSellerView: boolean;
  orderStatus: string;
  onStatusUpdate?: (itemId: string, newStatus: ItemStatus) => void;
}

const STATUS_ORDER: ItemStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'delivered'];

export function OrderItemCard({ item, isSellerView, orderStatus, onStatusUpdate }: OrderItemCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentStatus = (item.status || 'pending') as ItemStatus;
  const statusInfo = ITEM_STATUS_LABELS[currentStatus];
  
  const canUpdateStatus = isSellerView && 
    !['completed', 'cancelled'].includes(orderStatus) && 
    currentStatus !== 'delivered' && 
    currentStatus !== 'cancelled';

  const getNextStatus = (): ItemStatus | null => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    if (currentIndex < STATUS_ORDER.length - 1) {
      return STATUS_ORDER[currentIndex + 1];
    }
    return null;
  };

  const updateItemStatus = async (newStatus: ItemStatus) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      
      onStatusUpdate?.(item.id, newStatus);
      toast.success(`${item.product_name} marked as ${ITEM_STATUS_LABELS[newStatus].label}`);
    } catch (error) {
      console.error('Error updating item status:', error);
      toast.error('Failed to update item status');
    } finally {
      setIsUpdating(false);
    }
  };

  const nextStatus = getNextStatus();

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate">{item.product_name}</p>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full shrink-0', statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            ₹{item.unit_price} × {item.quantity} = ₹{item.unit_price * item.quantity}
          </p>
        </div>
        
        {canUpdateStatus && nextStatus && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateItemStatus(nextStatus)}
            disabled={isUpdating}
            className="shrink-0 text-xs h-8"
          >
            {isUpdating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Check size={14} className="mr-1" />
                {ITEM_STATUS_LABELS[nextStatus].label}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Quick status selector for advanced control */}
      {canUpdateStatus && (
        <div className="mt-2 pt-2 border-t">
          <Select
            value={currentStatus}
            onValueChange={(value) => updateItemStatus(value as ItemStatus)}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((status) => {
                const statusIndex = STATUS_ORDER.indexOf(status);
                const currentIndex = STATUS_ORDER.indexOf(currentStatus);
                // Only allow forward transitions
                const isDisabled = statusIndex <= currentIndex;
                return (
                  <SelectItem key={status} value={status} className="text-xs" disabled={isDisabled}>
                    {ITEM_STATUS_LABELS[status].label}
                  </SelectItem>
                );
              })}
              <SelectItem value="cancelled" className="text-xs text-destructive">
                Cancelled
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
