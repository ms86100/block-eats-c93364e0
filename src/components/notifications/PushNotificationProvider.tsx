import { useEffect, useContext, useRef } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { IdentityContext } from '@/contexts/auth/contexts';

interface PushNotificationProviderProps {
  children: React.ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const { removeTokenFromDatabase } = usePushNotifications();
  const prevUserRef = useRef(user);

  console.log('[Push][Provider] PushNotificationProvider render — userId:', user?.id ?? 'null');

  // DEFECT 10 FIX: Only remove token on explicit logout (user transitions non-null → null)
  useEffect(() => {
    if (prevUserRef.current && !user) {
      removeTokenFromDatabase();
    }
    prevUserRef.current = user;
  }, [user, removeTokenFromDatabase]);

  return <>{children}</>;
}
