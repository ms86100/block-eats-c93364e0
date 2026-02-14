import { Home, Store, Users, Building2, User } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import type { FeatureKey } from '@/hooks/useEffectiveFeatures';

const navItems: { to: string; icon: typeof Home; label: string; featureKey?: FeatureKey }[] = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/search', icon: Store, label: 'Marketplace', featureKey: 'marketplace' },
  { to: '/community', icon: Users, label: 'Community', featureKey: 'bulletin' },
  { to: '/society', icon: Building2, label: 'Society' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();
  const { isFeatureEnabled, isLoading } = useEffectiveFeatures();

  const visibleItems = isLoading
    ? navItems
    : navItems.filter(item => !item.featureKey || isFeatureEnabled(item.featureKey));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {visibleItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn('text-[10px]', isActive && 'font-medium')}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
