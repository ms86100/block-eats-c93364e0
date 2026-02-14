import { cn } from '@/lib/utils';
import { 
  Megaphone, AlertTriangle, Wrench, BarChart3, Search as SearchIcon, LayoutGrid 
} from 'lucide-react';

export type BulletinCategory = 'all' | 'event' | 'alert' | 'maintenance' | 'poll' | 'lost_found';

const categories: { value: BulletinCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all', label: 'All', icon: LayoutGrid, color: 'text-foreground' },
  { value: 'event', label: 'Events', icon: Megaphone, color: 'text-blue-600' },
  { value: 'alert', label: 'Alerts', icon: AlertTriangle, color: 'text-destructive' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-amber-600' },
  { value: 'poll', label: 'Polls', icon: BarChart3, color: 'text-purple-600' },
  { value: 'lost_found', label: 'Lost & Found', icon: SearchIcon, color: 'text-emerald-600' },
];

interface CategoryFilterProps {
  selected: BulletinCategory;
  onSelect: (cat: BulletinCategory) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2">
      {categories.map(({ value, label, icon: Icon, color }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border',
            selected === value
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:border-primary/30'
          )}
        >
          <Icon size={14} className={selected === value ? 'text-primary-foreground' : color} />
          {label}
        </button>
      ))}
    </div>
  );
}

export const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  event: { label: 'Event', icon: Megaphone, color: 'text-blue-700', bg: 'bg-blue-100' },
  alert: { label: 'Alert', icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-100' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-amber-700', bg: 'bg-amber-100' },
  poll: { label: 'Poll', icon: BarChart3, color: 'text-purple-700', bg: 'bg-purple-100' },
  lost_found: { label: 'Lost & Found', icon: SearchIcon, color: 'text-emerald-700', bg: 'bg-emerald-100' },
};
