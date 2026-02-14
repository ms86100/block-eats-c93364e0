import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import type { FeatureKey } from '@/hooks/useEffectiveFeatures';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldOff } from 'lucide-react';

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { isFeatureEnabled, isLoading } = useEffectiveFeatures();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isFeatureEnabled(feature)) {
    return fallback ?? (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
        <ShieldOff className="text-muted-foreground mb-4" size={48} />
        <h2 className="text-lg font-semibold">Feature Not Available</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          This feature is not enabled for your society. Contact your society admin for more information.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
