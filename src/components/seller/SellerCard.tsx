import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { VegBadge } from '@/components/ui/veg-badge';
import { FavoriteButton } from '@/components/favorite/FavoriteButton';
import { Badge } from '@/components/ui/badge';
import { SellerProfile, Product } from '@/types/database';
import { Clock, MapPin, Award, Zap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerCardProps {
  seller: SellerProfile & { profile?: { name: string; block: string } };
  featuredProduct?: Product;
  showFavorite?: boolean;
}

export function SellerCard({ seller, featuredProduct, showFavorite = true }: SellerCardProps) {
  const isOpen = seller.is_available;
  const profile = seller.profile;
  const isNewSeller = !seller.rating || seller.rating === 0 || seller.total_reviews === 0;

  return (
    <Link to={`/seller/${seller.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-all border-border/50">
        <div className="relative h-32">
          {seller.cover_image_url ? (
            <img
              src={seller.cover_image_url}
              alt={seller.business_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <span className="text-4xl opacity-40">🏪</span>
            </div>
          )}
          {!isOpen && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-foreground font-medium text-sm">Currently Closed</span>
            </div>
          )}
          
          {/* Featured Badge */}
          {seller.is_featured && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center gap-1">
              <Award size={12} />
              Trusted
            </div>
          )}

          {/* Favorite Button */}
          {showFavorite && (
            <div className="absolute top-2 right-2">
              <FavoriteButton sellerId={seller.id} size="sm" />
            </div>
          )}

          {/* Seller Avatar */}
          {seller.profile_image_url && (
            <div className="absolute -bottom-4 left-3 w-12 h-12 rounded-full border-2 border-card overflow-hidden shadow-md">
              <img
                src={seller.profile_image_url}
                alt={seller.business_name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
        
        <CardContent className={cn('p-3', seller.profile_image_url && 'pt-5')}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{seller.business_name}</h3>
              {seller.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {seller.description}
                </p>
              )}
            </div>
            {/* Replace star ratings with community proof */}
            {isNewSeller ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
                New Seller
              </Badge>
            ) : (seller.completed_order_count || 0) > 0 ? (
              <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1 shrink-0">
                <Users size={10} />
                {seller.completed_order_count} orders
              </span>
            ) : null}
          </div>

          {/* Location + Hours */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {profile && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                Block {profile.block}
              </span>
            )}
            {seller.availability_start && seller.availability_end && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {seller.availability_start.slice(0, 5)} - {seller.availability_end.slice(0, 5)}
              </span>
            )}
          </div>

          {/* Real trust signals */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {seller.avg_response_minutes != null && seller.avg_response_minutes > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-0.5">
                <Zap size={9} />
                ~{seller.avg_response_minutes}m response
              </span>
            )}
            {seller.last_active_at && isRecentlyActive(seller.last_active_at) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Active today
              </span>
            )}
            {seller.cancellation_rate != null && seller.cancellation_rate < 5 && (seller.completed_order_count || 0) >= 5 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5">
                Reliable
              </span>
            )}
          </div>

          {seller.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {seller.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
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

function isRecentlyActive(lastActive: string): boolean {
  const diff = Date.now() - new Date(lastActive).getTime();
  return diff < 24 * 60 * 60 * 1000;
}
