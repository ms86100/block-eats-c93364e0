import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ProductActionType } from '@/types/database';
import { Loader2, MessageCircle, Calendar, Send, Home, Handshake } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

interface ProductEnquirySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  sellerId: string;
  sellerName: string;
  actionType: ProductActionType;
  price?: number;
}

const ACTION_META: Record<string, { title: string; icon: typeof Send; placeholder: string; submitLabel: string }> = {
  book: {
    title: 'Book Service',
    icon: Calendar,
    placeholder: 'When would you like to book? Any preferences for date/time?',
    submitLabel: 'Send Booking Request',
  },
  request_service: {
    title: 'Request Service',
    icon: Send,
    placeholder: 'Describe what you need — scope, timing, any specific requirements…',
    submitLabel: 'Send Request',
  },
  request_quote: {
    title: 'Request Quote',
    icon: MessageCircle,
    placeholder: 'Describe your requirements so the seller can provide an accurate quote…',
    submitLabel: 'Request Quote',
  },
  schedule_visit: {
    title: 'Schedule a Visit',
    icon: Home,
    placeholder: 'When would you like to visit? Any preferred dates or times?',
    submitLabel: 'Request Visit',
  },
  make_offer: {
    title: 'Make an Offer',
    icon: Handshake,
    placeholder: 'What price are you offering? Include any conditions or notes…',
    submitLabel: 'Send Offer',
  },
};

export function ProductEnquirySheet({
  open,
  onOpenChange,
  productId,
  productName,
  sellerId,
  sellerName,
  actionType,
  price,
}: ProductEnquirySheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const meta = ACTION_META[actionType] || ACTION_META.request_service;
  const Icon = meta.icon;

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsLoading(true);
    try {
      // Create an enquiry order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: sellerId,
          total_amount: price || 0,
          order_type: 'enquiry',
          status: 'enquired',
          notes: `${meta.title} for: ${productName}\n\n${message}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create initial chat message
      const { error: chatError } = await supabase
        .from('chat_messages')
        .insert({
          order_id: order.id,
          sender_id: user.id,
          receiver_id: sellerId,
          message_text: `Hi! I'd like to ${meta.title.toLowerCase()} for "${productName}".\n\n${message}`,
        });

      if (chatError) throw chatError;

      toast.success('Request sent! The seller will respond soon.');
      onOpenChange(false);
      setMessage('');
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error sending enquiry:', error);
      toast.error('Failed to send request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Icon size={18} className="text-primary" />
            {meta.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Product summary */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium text-sm">{productName}</p>
            <p className="text-xs text-muted-foreground">
              by {sellerName}
              {price ? ` · ${formatPrice(price)}` : ''}
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Message</label>
            <Textarea
              placeholder={meta.placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading || !message.trim()}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <Icon size={16} className="mr-2" />
            )}
            {meta.submitLabel}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your contact details will be shared with the seller
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
