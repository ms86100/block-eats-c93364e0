import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  orderId: string;
  sellerId: string;
  sellerName: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function ReviewForm({ orderId, sellerId, sellerName, onSuccess, trigger }: ReviewFormProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        order_id: orderId,
        buyer_id: user.id,
        seller_id: sellerId,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      toast.success('Review submitted successfully!');
      setIsOpen(false);
      setRating(0);
      setComment('');
      onSuccess?.();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('You have already reviewed this order');
      } else {
        toast.error('Failed to submit review');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Star size={16} className="mr-1" />
            Write Review
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate your experience with {sellerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Tap to rate</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={cn(
                      'transition-colors',
                      (hoveredRating || rating) >= star
                        ? 'fill-warning text-warning'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-medium mt-2">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <Textarea
              placeholder="Share your experience (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {comment.length}/500
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
