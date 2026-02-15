import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle, Clock, Package, CreditCard, MessageCircle, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrderHelpSheetProps {
  orderId: string;
  onChatOpen?: () => void;
}

const HELP_OPTIONS = [
  { id: 'late', icon: Clock, label: 'Order is late', description: 'My order is taking longer than expected' },
  { id: 'wrong_item', icon: Package, label: 'Wrong item', description: 'I received incorrect items' },
  { id: 'payment', icon: CreditCard, label: 'Payment issue', description: 'Problem with my payment' },
  { id: 'other', icon: HelpCircle, label: 'Other issue', description: 'I have a different concern' },
];

export function OrderHelpSheet({ orderId, onChatOpen }: OrderHelpSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedIssue) {
      toast.error('Please select an issue type');
      return;
    }

    setIsSubmitting(true);
    try {
      // Route to seller chat as the primary resolution path
      if (onChatOpen) {
        setIsOpen(false);
        onChatOpen();
        toast.success('Opening chat with seller to resolve your issue.');
      } else {
        toast.info('Please contact the seller directly for help with this order.');
      }
      setSelectedIssue(null);
      setDetails('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChatWithSeller = () => {
    setIsOpen(false);
    onChatOpen?.();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <HelpCircle size={16} className="mr-2" />
          Need help?
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Need help with this order?</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Quick Chat Option */}
          {onChatOpen && (
            <button
              onClick={handleChatWithSeller}
              className="w-full flex items-center gap-3 p-4 bg-primary/5 rounded-xl text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="text-primary" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium">Chat with Seller</p>
                <p className="text-xs text-muted-foreground">Quick way to resolve most issues</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          )}

          {/* Issue Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Or select an issue:</p>
            {HELP_OPTIONS.map(({ id, icon: Icon, label, description }) => (
              <button
                key={id}
                onClick={() => setSelectedIssue(selectedIssue === id ? null : id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  selectedIssue === id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <Icon size={20} className="text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Details */}
          {selectedIssue && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional details (optional)</label>
              <Textarea
                placeholder="Tell us more about the issue..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Submit */}
          {selectedIssue && (
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : null}
              Report Issue
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
