import { Link } from 'react-router-dom';
import { CATEGORIES, ProductCategory } from '@/types/database';
import { cn } from '@/lib/utils';

interface CategoryGridProps {
  selectedCategory?: ProductCategory;
  onSelect?: (category: ProductCategory | undefined) => void;
  variant?: 'grid' | 'scroll';
}

export function CategoryGrid({
  selectedCategory,
  onSelect,
  variant = 'scroll',
}: CategoryGridProps) {
  const handleClick = (category: ProductCategory) => {
    if (onSelect) {
      onSelect(selectedCategory === category ? undefined : category);
    }
  };

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map(({ value, label, icon, color }) => (
          <button
            key={value}
            onClick={() => handleClick(value)}
            className={cn(
              'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
              selectedCategory === value
                ? 'bg-primary/10 ring-2 ring-primary'
                : 'hover:bg-muted'
            )}
          >
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-2xl', color)}>
              {icon}
            </div>
            <span className="text-[10px] font-medium text-center leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide py-2 -mx-4 px-4">
      {CATEGORIES.map(({ value, label, icon, color }) => (
        <Link
          key={value}
          to={`/category/${value}`}
          className="flex flex-col items-center gap-1.5 min-w-[72px]"
        >
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform hover:scale-105',
              color
            )}
          >
            {icon}
          </div>
          <span className="text-xs font-medium text-center">{label}</span>
        </Link>
      ))}
    </div>
  );
}
