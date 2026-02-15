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
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 py-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="w-16 h-14 rounded-lg shrink-0" />
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
    <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 py-1">
      {tabs.map((tab) => {
        const isActive = tab.value === '__all__' ? activeGroup === null : activeGroup === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onGroupChange(tab.value === '__all__' ? null : tab.value)}
            className={cn(
              'shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]',
              isActive
                ? 'bg-primary/10 border-b-2 border-primary'
                : 'hover:bg-muted/50'
            )}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className={cn(
              'text-[10px] font-semibold leading-none whitespace-nowrap',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
