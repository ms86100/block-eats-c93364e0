import { useParentGroups, ParentGroupInfo } from '@/hooks/useParentGroups';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ParentGroupTabsProps {
  activeGroup: string | null;
  onGroupChange: (slug: string | null) => void;
}

export function ParentGroupTabs({ activeGroup, onGroupChange }: ParentGroupTabsProps) {
  const { parentGroupInfos, isLoading } = useParentGroups();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="w-20 h-9 rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  const allTab: ParentGroupInfo = {
    value: '__all__',
    label: 'All',
    icon: '🏠',
    color: '',
    description: '',
    layoutType: 'ecommerce',
  };

  const tabs = [allTab, ...parentGroupInfos];

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1">
      {tabs.map((tab) => {
        const isActive = tab.value === '__all__' ? activeGroup === null : activeGroup === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onGroupChange(tab.value === '__all__' ? null : tab.value)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200 text-xs font-bold whitespace-nowrap',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105'
                : 'bg-card/80 text-foreground border border-border/40 hover:bg-card hover:shadow-sm active:scale-95'
            )}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
