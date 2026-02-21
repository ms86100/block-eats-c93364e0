import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
  orderId: string;
  amount: number;
  sellerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessName: string;
  onSuccess: (paymentId: string, orderId: string) => void;
  onFailure: (error: any) => void;
}

export function useRazorpay() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (window.Razorpay) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      toast.error('Payment service unavailable');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on unmount to avoid reloading
    };
  }, []);

  const createOrder = useCallback(async (options: RazorpayOptions) => {
    if (!isScriptLoaded) {
      toast.error('Payment service is loading. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please login to continue');
        return;
      }

      // Call edge function to create Razorpay order
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          orderId: options.orderId,
          amount: options.amount,
          sellerId: options.sellerId,
          customerName: options.customerName,
          customerEmail: options.customerEmail,
          customerPhone: options.customerPhone,
        },
      });

      if (error) {
        console.error('Create order error:', error);
        throw new Error(error.message || 'Failed to create payment order');
      }

      console.log('Razorpay order created:', data);

      // Open Razorpay checkout
      const razorpayOptions = {
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: data.currency,
        name: options.businessName,
        description: `Order Payment`,
        order_id: data.razorpay_order_id,
        prefill: data.prefill,
        notes: data.notes,
        theme: {
          color: '#F37254',
        },
        handler: function (response: any) {
          console.log('Payment successful:', response);
          options.onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
        },
        modal: {
          ondismiss: function () {
            console.log('Payment modal closed');
            setIsLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      
      razorpay.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        options.onFailure(response.error);
      });

      razorpay.open();
    } catch (error: any) {
      console.error('Razorpay error:', error);
      toast.error(friendlyError(error));
      options.onFailure(error);
    } finally {
      setIsLoading(false);
    }
  }, [isScriptLoaded]);

  return {
    createOrder,
    isLoading,
    isScriptLoaded,
  };
}
