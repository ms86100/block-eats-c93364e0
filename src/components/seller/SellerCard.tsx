import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { VegBadge } from '@/components/ui/veg-badge';
import { RatingStars } from '@/components/ui/rating-stars';
import { SellerProfile, Product } from '@/types/database';
import { Clock, MapPin } from 'lucide-react';

interface SellerCardProps {
  seller: SellerProfile & { profile?: { name: string; block: string } };
  featuredProduct?: Product;
}

export function SellerCard({ seller, featuredProduct }: SellerCardProps) {
  const isOpen = seller.is_available;

  return (
    <Link to={`/seller/${seller.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="relative h-32">
          {seller.cover_image_url ? (
            <img
              src={seller.cover_image_url}
              alt={seller.business_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-4xl">🍴</span>
            </div>
          )}
          {!isOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-medium">Currently Closed</span>
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{seller.business_name}</h3>
              {seller.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {seller.description}
                </p>
              )}
            </div>
            {seller.rating > 0 && (
              <RatingStars
                rating={seller.rating}
                totalReviews={seller.total_reviews}
                size="sm"
                showCount={false}
              />
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {seller.profile && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                Block {seller.profile.block}
              </span>
            )}
            {seller.availability_start && seller.availability_end && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {seller.availability_start.slice(0, 5)} - {seller.availability_end.slice(0, 5)}
              </span>
            )}
          </div>

          {seller.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {seller.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  {cat.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
