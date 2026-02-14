import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface UserNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  reference_path: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationInboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as any) || []);
    setIsLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleTap = (n: UserNotification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.reference_path) navigate(n.reference_path);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AppLayout headerTitle="Notifications" showLocation={false}>
      <div className="p-4">
        {unreadCount > 0 && (
          <div className="flex justify-end mb-3">
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={markAllRead}>
              <CheckCheck size={14} /> Mark all read
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Inbox className="mx-auto mb-3" size={40} />
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm mt-1">You'll see updates from your society here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleTap(n)}
                className={`w-full text-left rounded-xl p-3 transition-colors border ${
                  n.is_read 
                    ? 'bg-card border-border' 
                    : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  }`}>
                    <Bell size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
