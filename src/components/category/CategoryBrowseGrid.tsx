import { Link } from 'react-router-dom';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Blinkit-style sub-category browse grid.
 * Pulls all active sub-categories from category_config (DB-driven).
 */
export function CategoryBrowseGrid() {
  const { configs, isLoading } = useCategoryConfigs();

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!configs.length) return null;

  return (
    <div className="px-4">
      <h3 className="font-bold text-sm text-foreground mb-3">Shop by Category</h3>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {configs.map((cat) => (
          <Link
            key={cat.category}
            to={`/category/${cat.parentGroup}?sub=${cat.category}`}
            className="group flex flex-col items-center gap-1"
          >
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center',
                'bg-accent/40 border border-border/30',
                'transition-all group-hover:scale-[1.04] group-hover:shadow-md'
              )}
            >
              <span className="text-2xl">{cat.icon}</span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight text-foreground line-clamp-2">
              {cat.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
