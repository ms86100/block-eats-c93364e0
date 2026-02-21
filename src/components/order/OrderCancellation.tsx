import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderCancellationProps {
  orderId: string;
  orderStatus: string;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'ordered_wrong', label: 'Ordered wrong items' },
  { value: 'taking_too_long', label: 'Taking too long to accept' },
  { value: 'found_alternative', label: 'Found an alternative' },
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'other', label: 'Other reason' },
];

export function OrderCancellation({ orderId, orderStatus, onCancelled }: OrderCancellationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Can only cancel before "preparing" status
  const canCancel = ['placed', 'accepted'].includes(orderStatus);

  if (!canCancel) {
    return null;
  }

  const handleCancel = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    const finalReason = reason === 'other' ? otherReason : CANCELLATION_REASONS.find(r => r.value === reason)?.label;

    if (reason === 'other' && !otherReason.trim()) {
      toast.error('Please enter your reason');
      return;
    }

    setIsSubmitting(true);
    const previousStatus = orderStatus;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          rejection_reason: `Cancelled by buyer: ${finalReason}`,
        })
        .eq('id', orderId);

      if (error) throw error;

      setIsOpen(false);

      toast('Order cancelled', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const { error: undoError } = await supabase
                .from('orders')
                .update({ status: previousStatus as any, rejection_reason: null })
                .eq('id', orderId);
              if (undoError) throw undoError;
              toast.success('Order restored');
              onCancelled();
            } catch {
              toast.error('Could not undo cancellation');
            }
          },
        },
        duration: 5000,
      });

      onCancelled();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
          <X size={16} className="mr-2" />
          Cancel Order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-warning" size={20} />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            Please tell us why you want to cancel this order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <RadioGroup value={reason} onValueChange={setReason}>
            {CANCELLATION_REASONS.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={value} />
                <Label htmlFor={value} className="cursor-pointer">{label}</Label>
              </div>
            ))}
          </RadioGroup>

          {reason === 'other' && (
            <Textarea
              placeholder="Please describe your reason..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              rows={2}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : null}
              Cancel Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
