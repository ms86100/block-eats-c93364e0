import { memo, useCallback } from 'react';
import { Home, Building2, LayoutGrid, ShoppingCart, User, Shield, ClipboardList, Briefcase, ListChecks } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { useSecurityOfficer } from '@/hooks/useSecurityOfficer';
import { useWorkerRole } from '@/hooks/useWorkerRole';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import type { FeatureKey } from '@/hooks/useEffectiveFeatures';

const residentNavItems: { to: string; icon: typeof Home; label: string; featureKey?: FeatureKey; badge?: string }[] = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/society', icon: Building2, label: 'Society' },
  { to: '/categories', icon: LayoutGrid, label: 'Categories' },
  { to: '/cart', icon: ShoppingCart, label: 'Cart', badge: 'cart' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const securityNavItems: { to: string; icon: typeof Shield; label: string }[] = [
  { to: '/guard-kiosk', icon: Shield, label: 'Kiosk' },
  { to: '/security/audit', icon: ClipboardList, label: 'History' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const workerNavItems: { to: string; icon: typeof Briefcase; label: string }[] = [
  { to: '/worker/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/worker/my-jobs', icon: ListChecks, label: 'My Jobs' },
  { to: '/profile', icon: User, label: 'Profile' },
];

function BottomNavInner() {
  const location = useLocation();
  const { isFeatureEnabled, isLoading } = useEffectiveFeatures();
  const { isAdmin, isSocietyAdmin, isBuilderMember } = useAuth();
  // Fix #8: Gate role hooks — skip RPC for admins/builders/society admins (they always see resident nav)
  // For regular residents, these still fire but are cached with 5min staleTime
  const skipRoleCheck = isAdmin || isSocietyAdmin || isBuilderMember;
  const { isSecurityOfficer } = useSecurityOfficer(!skipRoleCheck);
  const { isWorker } = useWorkerRole(!skipRoleCheck);
  const { itemCount } = useCart();
  const { selectionChanged } = useHaptics();

  // Builders, admins, and society admins always see the full resident nav
  // Only pure security officers / workers (no admin/builder role) get restricted nav
  const isPrimaryRoleUser = isAdmin || isSocietyAdmin || isBuilderMember;
  const navItems = !isPrimaryRoleUser && isSecurityOfficer
    ? securityNavItems
    : !isPrimaryRoleUser && isWorker
      ? workerNavItems
      : residentNavItems;

  const visibleItems = isLoading
    ? navItems
    : navItems.filter(item => !('featureKey' in item && item.featureKey) || isFeatureEnabled((item as any).featureKey));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-1 py-2">
        {visibleItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          const showCartBadge = to === '/cart' && itemCount > 0;
          
          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => selectionChanged()}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px] relative',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {showCartBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[9px] leading-tight', isActive ? 'font-bold' : 'font-medium')}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

// Fix #1: React.memo prevents re-renders from parent (AppLayout) state changes
export const BottomNav = memo(BottomNavInner);
