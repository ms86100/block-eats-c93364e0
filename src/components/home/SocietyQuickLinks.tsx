import { Link } from 'react-router-dom';
import { useEffectiveFeatures, type FeatureKey } from '@/hooks/useEffectiveFeatures';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Car, IndianRupee, MessageCircle, Wrench, ShieldAlert, ChevronRight, Package, Building2,
} from 'lucide-react';

interface QuickLink {
  icon: typeof Users;
  label: string;
  to: string;
  color: string;
  featureKey?: FeatureKey;
}

const quickLinks: QuickLink[] = [
  { icon: Users, label: 'Visitors', to: '/visitors', color: 'text-primary bg-primary/10', featureKey: 'visitor_management' },
  { icon: Car, label: 'Parking', to: '/parking', color: 'text-primary bg-primary/10', featureKey: 'vehicle_parking' },
  { icon: IndianRupee, label: 'Finances', to: '/society/finances', color: 'text-warning bg-warning/10', featureKey: 'finances' },
  { icon: MessageCircle, label: 'Bulletin', to: '/community', color: 'text-accent bg-accent/10' },
  { icon: Wrench, label: 'Maintenance', to: '/maintenance', color: 'text-success bg-success/10', featureKey: 'maintenance' },
  { icon: ShieldAlert, label: 'Disputes', to: '/disputes', color: 'text-destructive bg-destructive/10', featureKey: 'disputes' },
];

export function SocietyQuickLinks() {
  const { effectiveSociety } = useAuth();
  const { isFeatureEnabled } = useEffectiveFeatures();

  if (!effectiveSociety) return null;

  const visibleLinks = quickLinks.filter(l => !l.featureKey || isFeatureEnabled(l.featureKey));
  if (visibleLinks.length === 0) return null;

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
          <Building2 size={14} className="text-primary" />
          Your Society
        </h3>
        <Link to="/society" className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
          View all <ChevronRight size={11} />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {visibleLinks.slice(0, 6).map(({ icon: Icon, label, to, color }) => (
          <Link key={to} to={to}>
            <div className="bg-card border border-border/40 rounded-xl p-2.5 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
              <span className="text-[10px] font-medium text-foreground text-center leading-tight">{label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
