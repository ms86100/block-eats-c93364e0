import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Loader2, CreditCard, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useCurrency } from '@/hooks/useCurrency';

interface RazorpayCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  sellerId: string;
  sellerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onPaymentSuccess: (paymentId: string) => void;
  onPaymentFailed: () => void;
}

export function RazorpayCheckout({
  isOpen,
  onClose,
  orderId,
  amount,
  sellerId,
  sellerName,
  customerName,
  customerEmail,
  customerPhone,
  onPaymentSuccess,
  onPaymentFailed,
}: RazorpayCheckoutProps) {
  const { createOrder, isLoading, isScriptLoaded } = useRazorpay();
  const { formatPrice } = useCurrency();
  const [status, setStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');

  useEffect(() => {
    if (isOpen) {
      setStatus('pending');
    }
  }, [isOpen]);

  const handlePayment = async () => {
    setStatus('processing');

    await createOrder({
      orderId,
      amount,
      sellerId,
      customerName,
      customerEmail,
      customerPhone,
      businessName: sellerName,
      onSuccess: (paymentId, razorpayOrderId) => {
        setStatus('success');
        if (razorpayOrderId) {
          console.log('[Payment] Razorpay order_id for reconciliation:', razorpayOrderId);
        }
        setTimeout(() => onPaymentSuccess(paymentId), 1500);
      },
      onFailure: () => {
        setStatus('failed');
      },
      onDismiss: () => {
        // Razorpay popup closed without completing — let user retry
        setStatus('pending');
      },
    });
  };

  const handleRetry = () => {
    setStatus('pending');
  };

  const handleClose = () => {
    // Any close that isn't a success means payment wasn't completed
    if (status !== 'success') {
      onPaymentFailed();
    }
    setStatus('pending');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-center pb-4">
          <SheetTitle>Pay with UPI</SheetTitle>
          <SheetDescription>
            Pay {formatPrice(amount)} to {sellerName}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          {status === 'pending' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="text-primary" size={40} />
              </div>
              <div>
                <p className="font-semibold text-2xl">{formatPrice(amount)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Secure payment via Razorpay
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <img src="https://razorpay.com/assets/razorpay-glyph.svg" alt="Razorpay" className="h-4" />
                  <span className="text-xs text-muted-foreground">Secure UPI payment</span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handlePayment}
                  disabled={isLoading || !isScriptLoaded}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Processing...
                    </>
                  ) : (
                    'Pay Now'
                  )}
                </Button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="mx-auto animate-spin text-primary" size={48} />
              <div>
                <p className="font-semibold">Opening Payment</p>
                <p className="text-sm text-muted-foreground">
                  Complete payment in the popup
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="text-success" size={48} />
              </div>
              <div>
                <p className="font-semibold text-success">Payment Successful!</p>
                <p className="text-sm text-muted-foreground">
                  Your order is confirmed
                </p>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="text-destructive" size={48} />
              </div>
              <div>
                <p className="font-semibold text-destructive">Payment Failed</p>
                <p className="text-sm text-muted-foreground">
                  The payment was not completed
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  <RefreshCw size={16} className="mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
