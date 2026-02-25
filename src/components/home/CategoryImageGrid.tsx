import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useCurrency } from '@/hooks/useCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Users, Tag, Star, ChevronRight } from 'lucide-react';

interface CategoryImageGridProps {
  parentGroup: string;
  title: string;
  activeCategories?: Set<string>;
}

/* ── Metadata builder ─── */

interface CategoryMeta {
  count: number;
  sellerCount: number;
  minPrice: number | null;
  collageImages: string[];
  hasBestseller: boolean;
}

function buildCategoryMeta(
  productCategories: { category: string; products: any[] }[],
): Record<string, CategoryMeta> {
  const map: Record<string, CategoryMeta> = {};
  for (const pc of productCategories) {
    const products = pc.products ?? [];
    const sellers = new Set<string>();
    const images: string[] = [];
    let min: number | null = null;
    let bestseller = false;

    for (const p of products) {
      if (p.seller_id) sellers.add(p.seller_id);
      if (p.image_url && images.length < 4 && !images.includes(p.image_url)) {
        images.push(p.image_url);
      }
      const price = typeof p.price === 'number' ? p.price : parseFloat(p.price);
      if (!isNaN(price) && (min === null || price < min)) min = price;
      if (p.is_bestseller) bestseller = true;
    }

    map[pc.category] = { count: products.length, sellerCount: sellers.size, minPrice: min, collageImages: images, hasBestseller: bestseller };
  }
  return map;
}

/* ── Image collage ──────────── */

function ImageCollage({ images, fallbackIcon, fallbackUrl, alt }: {
  images: string[];
  fallbackIcon: string;
  fallbackUrl?: string | null;
  alt: string;
}) {
  if (images.length === 0 && fallbackUrl) {
    return <img src={fallbackUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />;
  }
  if (images.length === 0) {
    return (
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        <span className="text-3xl">{fallbackIcon}</span>
      </div>
    );
  }
  const itemClass = `items-${Math.min(images.length, 4)}`;
  return (
    <div className={cn('category-collage absolute inset-0', itemClass)}>
      {images.slice(0, 4).map((src, i) => (
        <img key={i} src={src} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
      ))}
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

function CategoryImageGridInner({ parentGroup, title, activeCategories }: CategoryImageGridProps) {
  const { groupedConfigs, isLoading } = useCategoryConfigs();
  const { data: productCategories = [], isLoading: productsLoading } = useProductsByCategory();
  const { formatPrice } = useCurrency();

  const allCategories = groupedConfigs[parentGroup] || [];
  const categories = activeCategories
    ? allCategories.filter(c => activeCategories.has(c.category))
    : allCategories;

  const metaMap = useMemo(() => buildCategoryMeta(productCategories), [productCategories]);

  if (isLoading || productsLoading) {
    return (
      <div className="px-4 mb-5">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-[3/2] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="mb-6 max-w-5xl">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 px-4">
        <h3 className="font-extrabold text-[15px] text-foreground tracking-tight">{title}</h3>
        <Link
          to={`/category/${parentGroup}`}
          className="text-[11px] font-bold text-primary flex items-center gap-0.5"
        >
          See all <ChevronRight size={12} />
        </Link>
      </div>

      {/* Responsive card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
        {categories.slice(0, 6).map((cat) => {
          const meta = metaMap[cat.category] || { count: 0, sellerCount: 0, minPrice: null, collageImages: [], hasBestseller: false };
          return (
            <Link
              key={cat.category}
              to={`/category/${cat.parentGroup}?sub=${cat.category}`}
              className="block rounded-2xl overflow-hidden active:scale-[0.97] transition-all duration-200 group bg-card border border-border hover:border-primary/20 hover:shadow-md"
            >
              {/* Image area */}
              <div className="relative aspect-[3/2] overflow-hidden">
                <ImageCollage
                  images={meta.collageImages}
                  fallbackIcon={cat.icon}
                  fallbackUrl={cat.imageUrl}
                  alt={cat.displayName}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Count badge — top right */}
                {meta.count > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[9px] font-bold shadow-sm">
                    {meta.count} items
                  </div>
                )}

                {/* Bestseller star — top left */}
                {meta.hasBestseller && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-rating-star/90 flex items-center justify-center shadow-sm">
                    <Star size={12} className="text-foreground fill-foreground" />
                  </div>
                )}

                {/* Category name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <span className="text-[14px] font-extrabold text-white leading-tight line-clamp-2 drop-shadow-lg tracking-tight">
                    {cat.displayName}
                  </span>
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 text-[10px] text-muted-foreground">
                {meta.sellerCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} className="shrink-0 text-primary/70" />
                    <span className="font-medium">{meta.sellerCount} {meta.sellerCount === 1 ? 'seller' : 'sellers'}</span>
                  </span>
                )}
                {meta.minPrice !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Tag size={10} className="shrink-0 text-primary/70" />
                    <span className="font-medium">From {formatPrice(meta.minPrice)}</span>
                  </span>
                )}
                {meta.sellerCount === 0 && meta.minPrice === null && (
                  <span className="text-muted-foreground/60 font-medium">Explore →</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export const CategoryImageGrid = memo(CategoryImageGridInner);
