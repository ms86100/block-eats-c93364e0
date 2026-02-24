import { useParentGroups, ParentGroupInfo } from '@/hooks/useParentGroups';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface ParentGroupTabsProps {
  activeGroup: string | null;
  onGroupChange: (slug: string | null) => void;
  activeParentGroups?: Set<string>;
}

export function ParentGroupTabs({ activeGroup, onGroupChange, activeParentGroups }: ParentGroupTabsProps) {
  const { parentGroupInfos, isLoading } = useParentGroups();
  const { selectionChanged } = useHaptics();
  const filteredGroups = activeParentGroups
    ? parentGroupInfos.filter(g => activeParentGroups.has(g.value))
    : parentGroupInfos;

  if (!isLoading && filteredGroups.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="w-24 h-9 rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  const tabs: ParentGroupInfo[] = filteredGroups.length > 1
    ? [{ value: '__all__', label: 'All', icon: '🏠', color: '', description: '', layoutType: 'ecommerce' }, ...filteredGroups]
    : filteredGroups;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1">
      {tabs.map((tab) => {
        const isActive = tab.value === '__all__' ? activeGroup === null : activeGroup === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => {
              selectionChanged();
              onGroupChange(tab.value === '__all__' ? null : tab.value);
            }}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200 text-[12px] font-bold whitespace-nowrap',
              isActive
                ? 'bg-primary text-primary-foreground shadow-cta'
                : 'bg-card text-foreground border border-border hover:border-primary/30 active:scale-95'
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
