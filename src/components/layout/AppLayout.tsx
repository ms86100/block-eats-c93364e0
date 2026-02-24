import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { FloatingCartBar } from '@/components/cart/FloatingCartBar';
import { NavigatorBackButton } from '@/components/admin/NavigatorBackButton';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  showCart?: boolean;
  showLocation?: boolean;
  showBack?: boolean;
  headerTitle?: string;
  className?: string;
}

export function AppLayout({
  children,
  showHeader = true,
  showNav = true,
  showCart = true,
  showLocation = true,
  showBack,
  headerTitle,
  className,
}: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background">
      {showHeader && (
        <Header 
          showCart={showCart} 
          showLocation={showLocation}
          showBack={showBack}
          title={headerTitle} 
        />
      )}
      <main className={cn('pb-20', className)}>{children}</main>
      <NavigatorBackButton />
      <FloatingCartBar />
      {showNav && <BottomNav />}
    </div>
  );
}
