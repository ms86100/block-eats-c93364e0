import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProductCategory } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';

export interface FilterState {
  priceRange: [number, number];
  minRating: number;
  isVeg: boolean | null;
  categories: ProductCategory[];
  sortBy: 'rating' | 'newest' | 'price_low' | 'price_high' | null;
}

interface SearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  showPriceFilter?: boolean;
}

const defaultFilters: FilterState = {
  priceRange: [0, 5000],
  minRating: 0,
  isVeg: null,
  categories: [],
  sortBy: null,
};

export function SearchFilters({
  filters,
  onFiltersChange,
  showPriceFilter = true,
}: SearchFiltersProps) {
  const { configs: allCategories } = useCategoryConfigs();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const activeFilterCount = [
    filters.minRating > 0,
    filters.isVeg !== null,
    filters.categories.length > 0,
    filters.sortBy !== null,
    filters.priceRange[0] > 0 || filters.priceRange[1] < 5000,
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const toggleCategory = (category: ProductCategory) => {
    const newCategories = localFilters.categories.includes(category)
      ? localFilters.categories.filter((c) => c !== category)
      : [...localFilters.categories, category];
    setLocalFilters({ ...localFilters, categories: newCategories });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
          activeFilterCount > 0
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-background text-foreground'
        }`}>
          <SlidersHorizontal size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1">
              {activeFilterCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Filters & Sort</SheetTitle>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset all
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto pb-20">
          {/* Sort By */}
          <div>
            <Label className="text-sm font-semibold">Sort by</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { value: 'rating', label: 'Top Rated' },
                { value: 'newest', label: 'Newest' },
                { value: 'price_low', label: 'Price: Low to High' },
                { value: 'price_high', label: 'Price: High to Low' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() =>
                    setLocalFilters({
                      ...localFilters,
                      sortBy: localFilters.sortBy === value ? null : (value as any),
                    })
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    localFilters.sortBy === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Veg / Non-Veg */}
          <div>
            <Label className="text-sm font-semibold">Dietary Preference</Label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  setLocalFilters({
                    ...localFilters,
                    isVeg: localFilters.isVeg === true ? null : true,
                  })
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  localFilters.isVeg === true
                    ? 'border-veg bg-veg/10'
                    : 'border-border'
                }`}
              >
                <div className="w-4 h-4 border-2 border-veg rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-veg" />
                </div>
                <span className="text-sm">Veg Only</span>
              </button>
              <button
                onClick={() =>
                  setLocalFilters({
                    ...localFilters,
                    isVeg: localFilters.isVeg === false ? null : false,
                  })
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  localFilters.isVeg === false
                    ? 'border-non-veg bg-non-veg/10'
                    : 'border-border'
                }`}
              >
                <div className="w-4 h-4 border-2 border-non-veg rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-non-veg" />
                </div>
                <span className="text-sm">Non-Veg</span>
              </button>
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <Label className="text-sm font-semibold">Minimum Rating</Label>
            <div className="flex gap-2 mt-2">
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <button
                  key={rating}
                  onClick={() =>
                    setLocalFilters({ ...localFilters, minRating: rating })
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    localFilters.minRating === rating
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {rating === 0 ? 'Any' : `${rating}+`}
                </button>
              ))}
            </div>
          </div>


          {/* Price Range */}
          {showPriceFilter && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Price Range</Label>
                <span className="text-sm text-muted-foreground">
                  ₹{localFilters.priceRange[0]} - ₹{localFilters.priceRange[1]}
                </span>
              </div>
              <Slider
                value={localFilters.priceRange}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    priceRange: value as [number, number],
                  })
                }
                min={0}
                max={5000}
                step={50}
                className="mt-4"
              />
            </div>
          )}
        </div>

        {/* Apply Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button className="w-full" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { defaultFilters };
