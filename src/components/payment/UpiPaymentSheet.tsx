import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Loader2, Smartphone, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface UpiPaymentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  sellerUpiId: string | null;
  sellerName: string;
  onPaymentSuccess: (transactionRef: string) => void;
  onPaymentFailed: () => void;
}

export function UpiPaymentSheet({
  isOpen,
  onClose,
  amount,
  sellerUpiId,
  sellerName,
  onPaymentSuccess,
  onPaymentFailed,
}: UpiPaymentSheetProps) {
  const [status, setStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');

  const handleUpiPayment = async () => {
    if (!sellerUpiId) {
      onPaymentFailed();
      return;
    }

    setStatus('processing');

    // Create UPI intent URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(sellerUpiId)}&pn=${encodeURIComponent(sellerName)}&am=${amount}&cu=INR&tn=Order%20Payment`;

    // Open UPI app
    window.location.href = upiUrl;

    // Simulate checking payment status after a delay
    // In production, this would verify with a payment gateway
    setTimeout(() => {
      // For demo, we'll show a confirmation dialog
      const confirmed = window.confirm('Did you complete the UPI payment successfully?');
      if (confirmed) {
        setStatus('success');
        const txnRef = `UPI${Date.now()}`;
        setTimeout(() => onPaymentSuccess(txnRef), 1000);
      } else {
        setStatus('failed');
      }
    }, 3000);
  };

  const handleRetry = () => {
    setStatus('pending');
  };

  const handleClose = () => {
    if (status === 'failed') {
      onPaymentFailed();
    }
    setStatus('pending');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-center pb-4">
          <SheetTitle>UPI Payment</SheetTitle>
          <SheetDescription>
            Pay ₹{amount} to {sellerName}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          {status === 'pending' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-info/10 flex items-center justify-center">
                <Smartphone className="text-info" size={40} />
              </div>
              <div>
                <p className="font-semibold text-2xl">₹{amount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll be redirected to your UPI app
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleUpiPayment}>
                  Pay with UPI
                </Button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="mx-auto animate-spin text-primary" size={48} />
              <div>
                <p className="font-semibold">Processing Payment</p>
                <p className="text-sm text-muted-foreground">
                  Complete the payment in your UPI app
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
                  Your order is being placed...
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
