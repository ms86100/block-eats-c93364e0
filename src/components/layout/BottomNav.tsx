import { memo } from 'react';
import { Home, Building2, LayoutGrid, ShoppingCart, User, Shield, ClipboardList, Briefcase, ListChecks } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
// GlobalHapticListener handles navigation haptics centrally
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { useCartCount } from '@/hooks/useCartCount';
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
  const { isAdmin, isSocietyAdmin, isBuilderMember, roles, isSecurityOfficer, isWorker } = useAuth();
  const itemCount = useCartCount();
  // hapticSelection is called directly from lib/haptics

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
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1.5">
        {visibleItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          const showCartBadge = to === '/cart' && itemCount > 0;
          
          return (
            <NavLink
              key={to}
              to={to}
              /* haptic handled by GlobalHapticListener */
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all duration-200 min-w-[48px] relative',
                isActive
                  ? 'text-nav-active'
                  : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                {/* Active state: orange/peach glow circle behind icon */}
                {isActive && (
                  <div className="absolute -inset-1.5 rounded-full bg-nav-active/15" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className="relative z-10" />
                {showCartBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-badge-new text-primary-foreground text-[8px] font-bold flex items-center justify-center z-20">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-[10px] leading-tight',
                isActive ? 'font-bold text-nav-active' : 'font-medium'
              )}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
