import { Link } from 'react-router-dom';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUP_TINTS: Record<string, string> = {
  food: 'bg-[hsl(var(--tint-food))]',
  services: 'bg-[hsl(var(--tint-services))]',
  personal: 'bg-[hsl(var(--tint-personal))]',
  resale: 'bg-[hsl(var(--tint-resale))]',
  events: 'bg-[hsl(var(--tint-events))]',
};

const SECTION_TINTS: Record<string, string> = {
  food: 'bg-[hsl(var(--tint-food)/0.5)]',
  services: 'bg-[hsl(var(--tint-services)/0.5)]',
  personal: 'bg-[hsl(var(--tint-personal)/0.5)]',
  resale: 'bg-[hsl(var(--tint-resale)/0.5)]',
  events: 'bg-[hsl(var(--tint-events)/0.5)]',
};

interface CategoryImageGridProps {
  parentGroup: string;
  title: string;
}

export function CategoryImageGrid({ parentGroup, title }: CategoryImageGridProps) {
  const { groupedConfigs, isLoading } = useCategoryConfigs();
  const categories = groupedConfigs[parentGroup] || [];
  const tint = GROUP_TINTS[parentGroup] || 'bg-[hsl(var(--tint-default))]';
  const sectionTint = SECTION_TINTS[parentGroup] || 'bg-[hsl(var(--tint-default)/0.5)]';

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className={cn('animate-fade-in py-4 rounded-3xl mx-2', sectionTint)}>
      {/* Section header with "see all" chip */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="font-bold text-base text-foreground">{title}</h3>
        <Link
          to={`/category/${parentGroup}`}
          className="flex items-center gap-0.5 bg-card/80 border border-border/40 text-xs font-semibold text-primary px-2.5 py-1 rounded-full hover:bg-card transition-colors"
        >
          see all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
        {categories.map((cat) => (
          <Link
            key={cat.category}
            to={`/category/${cat.parentGroup}?sub=${cat.category}`}
            className="group shrink-0 w-[88px] flex flex-col items-center gap-1.5"
          >
            <div
              className={cn(
                'w-[88px] h-[88px] rounded-2xl overflow-hidden',
                'border border-white/60 shadow-sm',
                'transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg group-active:scale-95',
                'flex items-center justify-center',
                tint
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
                <span className="text-4xl drop-shadow-sm">{cat.icon}</span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight text-foreground line-clamp-2 max-w-[88px]">
              {cat.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
