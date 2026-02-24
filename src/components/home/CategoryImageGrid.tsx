import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CategoryImageGridProps {
  parentGroup: string;
  title: string;
  activeCategories?: Set<string>;
}

// Fix #14 + #19: lazy images already present, removed useHaptics overhead
function CategoryImageGridInner({ parentGroup, title, activeCategories }: CategoryImageGridProps) {
  const { groupedConfigs, isLoading } = useCategoryConfigs();
  const allCategories = groupedConfigs[parentGroup] || [];
  const categories = activeCategories
    ? allCategories.filter(c => activeCategories.has(c.category))
    : allCategories;

  if (isLoading) {
    return (
      <div className="px-4 mb-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-2.5">
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
      </div>

      {/* 3-column grid — larger category images like category page */}
      <div className="grid grid-cols-3 gap-2.5 px-4">
        {categories.slice(0, 6).map((cat) => (
            <Link
            key={cat.category}
            to={`/category/${cat.parentGroup}?sub=${cat.category}`}
            className="group flex flex-col items-center"
          >
            <div
              className={cn(
                'w-full aspect-[4/3] rounded-xl overflow-hidden',
                'bg-muted border border-border',
                'transition-all duration-200 group-hover:scale-[1.03] group-active:scale-95',
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
                <span className="text-3xl">{cat.icon}</span>
              )}
            </div>
            <span className="text-[11px] font-semibold text-center leading-tight text-foreground line-clamp-1 mt-1.5 px-0.5">
              {cat.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const CategoryImageGrid = memo(CategoryImageGridInner);
