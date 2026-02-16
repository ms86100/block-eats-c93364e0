import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Bell, MessageCircle, Tag, Volume2 } from 'lucide-react';

interface NotificationPreferences {
  orders: boolean;
  chat: boolean;
  promotions: boolean;
  sounds: boolean;
}

const STORAGE_KEY = 'notification_preferences';

const defaultPreferences: NotificationPreferences = {
  orders: true,
  chat: true,
  promotions: true,
  sounds: true,
};

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (error) {
      // Clear corrupted data and use defaults
      console.warn('[Notifications] Failed to parse saved preferences, clearing cache:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
  };

  const notificationItems = [
    {
      key: 'orders' as const,
      icon: Bell,
      title: 'Order Updates',
      description: 'Get notified about order status changes',
    },
    {
      key: 'chat' as const,
      icon: MessageCircle,
      title: 'Chat Messages',
      description: 'Receive notifications for new messages',
    },
    {
      key: 'promotions' as const,
      icon: Tag,
      title: 'Promotions',
      description: 'Special offers and featured sellers',
    },
    {
      key: 'sounds' as const,
      icon: Volume2,
      title: 'Notification Sounds',
      description: 'Play sounds for notifications',
    },
  ];

  return (
    <AppLayout showHeader={false}>
      <div className="p-4 safe-top">
        <Link to="/profile" className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span>Back to Profile</span>
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold">Notification Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose what notifications you want to receive
          </p>
        </div>

        <div className="space-y-3">
          {notificationItems.map(({ key, icon: Icon, title, description }) => (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label htmlFor={key} className="font-medium cursor-pointer">
                    {title}
                  </Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={key}
                  checked={preferences[key]}
                  onCheckedChange={(checked) => updatePreference(key, checked)}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          These preferences are saved on this device only.
        </p>
      </div>
    </AppLayout>
  );
}
