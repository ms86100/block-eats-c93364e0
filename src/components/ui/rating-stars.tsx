import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

export function RatingStars({
  rating,
  totalReviews = 0,
  size = 'md',
  showCount = true,
  className,
}: RatingStarsProps) {
  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1',
  };

  const starSizes = {
    sm: 12,
    md: 14,
    lg: 18,
  };

  const displayRating = Math.min(5, Math.max(0, rating));

  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      <div className="flex items-center gap-0.5 rounded bg-success px-1.5 py-0.5">
        <span className="font-semibold text-white">{displayRating.toFixed(1)}</span>
        <Star className="fill-white text-white" size={starSizes[size]} />
      </div>
      {showCount && totalReviews > 0 && (
        <span className="text-muted-foreground">
          ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
