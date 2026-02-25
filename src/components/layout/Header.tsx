import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ArrowLeft, Bell, Building, Building2, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { TypewriterPlaceholder } from '@/components/search/TypewriterPlaceholder';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface HeaderProps {
  showCart?: boolean;
  showLocation?: boolean;
  title?: string;
  showBack?: boolean;
  className?: string;
}

function HeaderInner({ 
  showCart = true, 
  showLocation = true, 
  title,
  showBack,
  className 
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSystemSettings();

  const handleBack = useCallback(() => {
    // If there's real history, go back; otherwise navigate to society dashboard or home
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/society');
    }
  }, [navigate]);
  const { profile, isApproved, society, user, viewAsSocietyId, effectiveSociety, setViewAsSociety, isAdmin, isBuilderMember } = useAuth();
  const { itemCount } = useCart();
  const { selectionChanged } = useHaptics();
  const [unreadCount, setUnreadCount] = useState(0);

  // B4: Replace realtime channel with polling for notification badge
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchUnread();

    // Poll every 30 seconds instead of maintaining a persistent WebSocket
    pollIntervalRef.current = setInterval(fetchUnread, 30_000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user?.id]);

  const fetchUnread = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const displaySociety = effectiveSociety || society;
  const isViewingAs = viewAsSocietyId && (isAdmin || isBuilderMember);

  // Get initials for avatar
  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <header className={cn(
        'sticky top-0 z-40 bg-background border-b border-border',
        className
      )}>
        <div className="px-4 pt-0 pb-2 safe-top">
          {/* Top row: delivery info + actions */}
          <div className="flex items-start justify-between">
            {title ? (
              <div className="flex items-center gap-2">
                {(showBack ?? true) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full shrink-0"
                    onClick={handleBack}
                  >
                    <ArrowLeft size={18} />
                  </Button>
                )}
                <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">
                  <span className="text-primary">S</span>
                  <span className="text-foreground">oci</span>
                  <span className="text-warning">v</span>
                  <span className="text-foreground">a</span>
                </h1>
                <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  {settings.headerTagline}
                </p>
                {showLocation && displaySociety && (
                  <button 
                    className="flex items-center gap-1 mt-1"
                    onClick={() => selectionChanged()}
                  >
                    <Building size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-semibold text-foreground truncate max-w-[65vw]">
                      {displaySociety.name}
                    </span>
                    <ChevronDown size={12} className="text-muted-foreground shrink-0" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-1">
              <ThemeToggle className="h-8 w-8 rounded-full bg-secondary text-foreground border border-border hover:bg-muted" />
              {isBuilderMember && (
                <Link to="/builder">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full bg-secondary text-foreground border border-border hover:bg-muted"
                  >
                    <Building2 size={16} />
                  </Button>
                </Link>
              )}
              {isApproved && (
                <>
                  <Link to="/notifications/inbox">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="relative h-8 w-8 rounded-full bg-secondary text-foreground border border-border hover:bg-muted"
                    >
                      <Bell size={16} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-badge-new px-1 text-[9px] font-bold text-primary-foreground">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Link to="/profile">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold cursor-pointer hover:opacity-90 transition-opacity">
                      {initials}
                    </div>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Search bar */}
          {!title && (
            <Link to="/search" className="block mt-2">
              <div className="flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-2.5 border border-border">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                <TypewriterPlaceholder context="home" />
              </div>
            </Link>
          )}
        </div>
      </header>

      {isViewingAs && (
        <div className="sticky top-[120px] z-39 bg-warning/15 border-b border-warning/30 px-4 py-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">
            Viewing: <span className="font-bold">{effectiveSociety?.name}</span>
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewAsSociety(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </Button>
        </div>
      )}
    </>
  );
}

// Fix #2: React.memo — Header only re-renders when its props change
export const Header = memo(HeaderInner);
