import { Link } from 'react-router-dom';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CategoryImageGridProps {
  parentGroup: string;
  title: string;
}

/**
 * Blinkit "Household Essentials" style — large image cards grouped by parent group.
 * Shows category image (falls back to emoji) with label underneath.
 */
export function CategoryImageGrid({ parentGroup, title }: CategoryImageGridProps) {
  const { groupedConfigs, isLoading } = useCategoryConfigs();

  const categories = groupedConfigs[parentGroup] || [];

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-base text-foreground px-4 mb-3">{title}</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
        {categories.map((cat) => (
          <Link
            key={cat.category}
            to={`/category/${cat.parentGroup}?sub=${cat.category}`}
            className="group shrink-0 w-[100px] flex flex-col items-center gap-1.5"
          >
            <div
              className={cn(
                'w-[100px] h-[100px] rounded-2xl overflow-hidden',
                'bg-muted/40 border border-border/20',
                'transition-all group-hover:scale-105 group-hover:shadow-lg group-active:scale-95',
                'flex items-center justify-center'
              )}
            >
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-4xl">{cat.icon}</span>
              )}
            </div>
            <span className="text-[11px] font-medium text-center leading-tight text-foreground line-clamp-2 max-w-[100px]">
              {cat.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
