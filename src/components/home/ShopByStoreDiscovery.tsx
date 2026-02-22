import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLocalSellers,
  useNearbySocietySellers,
  type LocalSeller,
  type NearbySeller,
  type DistanceBand,
  type SocietyGroup,
} from '@/hooks/queries/useStoreDiscovery';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Store, Star, MapPin, ChevronDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function ShopByStoreDiscovery() {
  const { effectiveSociety, profile } = useAuth();
  const browseBeyond = profile?.browse_beyond_community ?? true;
  const radiusKm = profile?.search_radius_km ?? 10;
  const { data: localGrouped = {}, isLoading: loadingLocal } = useLocalSellers();
  const { data: nearbyBands = [], isLoading: loadingNearby } = useNearbySocietySellers(radiusKm, browseBeyond);

  const hasLocal = Object.keys(localGrouped).length > 0;
  const hasNearby = nearbyBands.length > 0;

  if (!loadingLocal && !loadingNearby && !hasLocal && !hasNearby) return null;

  return (
    <div className="mt-5 space-y-5">
      {/* ━━━ In Your Society ━━━ */}
      {(loadingLocal || hasLocal) && (
        <section>
          <div className="flex items-center gap-2 px-4 mb-2.5">
            <Building2 size={16} className="text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              In Your Society
              {effectiveSociety?.name && (
                <span className="font-normal text-muted-foreground ml-1">
                  – {effectiveSociety.name}
                </span>
              )}
            </h3>
          </div>

          {loadingLocal ? (
            <LocalSkeleton />
          ) : (
            <div className="space-y-3">
              {Object.entries(localGrouped).map(([group, sellers]) => (
                <CategorySellerRow
                  key={group}
                  groupLabel={group}
                  sellers={sellers.map(s => ({
                    id: s.id,
                    business_name: s.business_name,
                    profile_image_url: s.profile_image_url,
                    rating: s.rating,
                  }))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ━━━ Nearby Societies ━━━ */}
      {(loadingNearby || hasNearby) && (
        <section>
          <div className="flex items-center gap-2 px-4 mb-2.5">
            <MapPin size={16} className="text-primary" />
            <h3 className="font-bold text-sm text-foreground">Nearby Societies</h3>
          </div>

          {loadingNearby ? (
            <NearbySkeleton />
          ) : (
            <div className="space-y-3">
              {nearbyBands.map(band => (
                <DistanceBandSection key={band.label} band={band} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Distance Band (collapsible) ──
function DistanceBandSection({ band }: { band: DistanceBand }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 px-4 w-full text-left">
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {band.label}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {band.societies.map(society => (
          <SocietyCard key={society.societyName} society={society} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Society Card inside a distance band ──
function SocietyCard({ society }: { society: SocietyGroup }) {
  return (
    <div className="mx-4 rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{society.societyName}</span>
        <span className="text-[10px] text-muted-foreground">{society.distanceKm} km</span>
      </div>
      <div className="p-2 space-y-2">
        {Object.entries(society.sellersByGroup).map(([group, sellers]) => (
          <CategorySellerRow
            key={group}
            groupLabel={group}
            sellers={sellers.map(s => ({
              id: s.seller_id,
              business_name: s.business_name,
              profile_image_url: s.profile_image_url,
              rating: s.rating,
            }))}
            compact
          />
        ))}
      </div>
    </div>
  );
}

// ── Horizontal seller row for a category group ──
function CategorySellerRow({
  groupLabel,
  sellers,
  compact = false,
}: {
  groupLabel: string;
  sellers: { id: string; business_name: string; profile_image_url: string | null; rating: number }[];
  compact?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="px-4 mb-1.5">
        <Badge variant="secondary" className="text-[10px] px-2 py-0 capitalize">
          {groupLabel.replace(/_/g, ' ')}
        </Badge>
      </div>
      <div className="relative">
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-1">
          {sellers.map(seller => (
            <div
              key={seller.id}
              onClick={() => navigate(`/seller/${seller.id}`)}
              className={cn(
                'shrink-0 rounded-2xl overflow-hidden cursor-pointer',
                'bg-card border border-border/30',
                'transition-all duration-200 hover:shadow-md hover:scale-[1.03] active:scale-95',
                compact ? 'w-20' : 'w-24'
              )}
            >
              <div className={cn('flex items-center justify-center bg-muted/50', compact ? 'h-12 p-1.5' : 'h-16 p-2')}>
                {seller.profile_image_url ? (
                  <img
                    src={seller.profile_image_url}
                    alt={seller.business_name}
                    className={cn('rounded-xl object-cover', compact ? 'w-9 h-9' : 'w-12 h-12')}
                    loading="lazy"
                  />
                ) : (
                  <div className={cn('rounded-xl bg-muted flex items-center justify-center', compact ? 'w-9 h-9' : 'w-12 h-12')}>
                    <Store className="text-muted-foreground" size={compact ? 16 : 22} />
                  </div>
                )}
              </div>
              <div className="px-1.5 pb-2 pt-1.5 text-center">
                <p className={cn('font-semibold text-foreground line-clamp-2 leading-tight', compact ? 'text-[9px]' : 'text-[10px]')}>
                  {seller.business_name}
                </p>
                {seller.rating > 0 && (
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <Star size={8} className="text-warning fill-warning" />
                    <span className="text-[9px] font-bold text-muted-foreground">{seller.rating}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-1 w-6 pointer-events-none bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );
}

// ── Skeletons ──
function LocalSkeleton() {
  return (
    <div className="px-4 space-y-3">
      {[1, 2].map(i => (
        <div key={i}>
          <Skeleton className="h-4 w-16 mb-2 rounded-full" />
          <div className="flex gap-2.5">
            {[1, 2, 3].map(j => <Skeleton key={j} className="w-24 h-28 rounded-2xl shrink-0" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function NearbySkeleton() {
  return (
    <div className="px-4 space-y-3">
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
