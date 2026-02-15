import { useState, useEffect } from 'react';
import { MapPin, Bell, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface HeaderProps {
  showCart?: boolean;
  showLocation?: boolean;
  title?: string;
  className?: string;
}

export function Header({ 
  showCart = true, 
  showLocation = true, 
  title,
  className 
}: HeaderProps) {
  const { profile, isApproved, society, user, viewAsSocietyId, effectiveSociety, setViewAsSociety, isAdmin, isBuilderMember } = useAuth();
  const { itemCount } = useCart();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUnread();

    const channel = supabase
      .channel('notification-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

  return (
    <>
      <header className={cn(
        'sticky top-0 z-40 safe-top border-b border-primary/10',
        className
      )} style={{ background: 'var(--gradient-primary)' }}>
        <div className="flex items-center justify-between px-4 py-3">
        {showLocation && profile ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MapPin className="text-primary-foreground shrink-0" size={20} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-primary-foreground">
                  {profile.block}, {profile.flat_number}
                </p>
                <p className="text-xs text-primary-foreground/70">{displaySociety?.name || 'Community Market'}</p>
              </div>
            </div>
          ) : title ? (
            <h1 className="text-lg font-bold text-primary-foreground">{title}</h1>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary-foreground">Sociva</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {isApproved && (
              <>
                <Link to="/notifications/inbox">
                  <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-white/15">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>
                {showCart && (
                  <Link to="/cart">
                    <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-white/15">
                      <ShoppingCart size={20} />
                      {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                          {itemCount > 9 ? '9+' : itemCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      {isViewingAs && (
        <div className="sticky top-[52px] z-39 bg-warning/15 border-b border-warning/30 px-4 py-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-warning-foreground">
            Viewing: <span className="font-bold">{effectiveSociety?.name}</span>
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewAsSociety(null)}>
            <X size={14} />
          </Button>
        </div>
      )}
    </>
  );
}
