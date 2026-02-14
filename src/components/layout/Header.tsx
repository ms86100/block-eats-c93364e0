import { useState, useEffect } from 'react';
import { MapPin, Bell, ShoppingCart } from 'lucide-react';
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
  const { profile, isApproved, society, user } = useAuth();
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

  return (
    <header className={cn('sticky top-0 z-40 glass border-b border-border safe-top', className)}>
      <div className="flex items-center justify-between px-4 py-3">
      {showLocation && profile ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPin className="text-primary shrink-0" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {profile.block}, {profile.flat_number}
              </p>
              <p className="text-xs text-muted-foreground">{society?.name || 'Community Market'}</p>
            </div>
          </div>
        ) : title ? (
          <h1 className="text-lg font-bold">{title}</h1>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">Sociva</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isApproved && (
            <>
              <Link to="/notifications/inbox">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
              {showCart && (
                <Link to="/cart">
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart size={20} />
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
  );
}
