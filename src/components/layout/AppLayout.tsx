import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  showCart?: boolean;
  showLocation?: boolean;
  headerTitle?: string;
  className?: string;
}

export function AppLayout({
  children,
  showHeader = true,
  showNav = true,
  showCart = true,
  showLocation = true,
  headerTitle,
  className,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showHeader && (
        <Header 
          showCart={showCart} 
          showLocation={showLocation} 
          title={headerTitle} 
        />
      )}
      <main className={cn('pb-20', className)}>{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}
