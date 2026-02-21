import { Link } from 'react-router-dom';
import { useSellerHealth, SellerHealthCheck } from '@/hooks/queries/useSellerHealth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck, ChevronRight, ShieldAlert, Package, Globe, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  warn: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  fail: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
} as const;

const GROUP_CONFIG = {
  critical: { label: 'Visibility Requirements', icon: ShieldAlert, description: 'Must pass for buyers to see you' },
  products: { label: 'Product Health', icon: Package, description: 'Product listing status' },
  discovery: { label: 'Discovery & Reach', icon: Globe, description: 'Cross-society visibility' },
  quality: { label: 'Store Quality', icon: Sparkles, description: 'Improves buyer trust & conversion' },
} as const;

function CheckItem({ check }: { check: SellerHealthCheck }) {
  const config = STATUS_CONFIG[check.status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 p-2.5 rounded-lg', config.bg)}>
      <Icon size={16} className={cn('shrink-0 mt-0.5', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{check.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{check.message}</p>
        {check.actionLabel && check.actionRoute && (
          <Link to={check.actionRoute}>
            <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-[10px] gap-1">
              {check.actionLabel}
              <ChevronRight size={10} />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function CheckGroup({ groupKey, checks }: { groupKey: keyof typeof GROUP_CONFIG; checks: SellerHealthCheck[] }) {
  if (checks.length === 0) return null;
  const config = GROUP_CONFIG[groupKey];
  const GroupIcon = config.icon;
  const hasIssues = checks.some(c => c.status === 'fail' || c.status === 'warn');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <GroupIcon size={12} className={hasIssues ? 'text-warning' : 'text-muted-foreground'} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{config.label}</span>
      </div>
      {checks.map(check => (
        <CheckItem key={check.key} check={check} />
      ))}
    </div>
  );
}

export function SellerVisibilityChecklist({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useSellerHealth(sellerId);
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!data || data.checks.length === 0) return null;

  const { checks, passCount, totalChecks, isFullyVisible, criticalBlockers } = data;

  // Group checks
  const criticalChecks = checks.filter(c => c.group === 'critical');
  const productChecks = checks.filter(c => c.group === 'products');
  const discoveryChecks = checks.filter(c => c.group === 'discovery');
  const qualityChecks = checks.filter(c => c.group === 'quality');

  // Sort within groups: issues first
  const sortByStatus = (a: SellerHealthCheck, b: SellerHealthCheck) => {
    const order = { fail: 0, warn: 1, info: 2, pass: 3 };
    return order[a.status] - order[b.status];
  };
  criticalChecks.sort(sortByStatus);
  productChecks.sort(sortByStatus);
  discoveryChecks.sort(sortByStatus);
  qualityChecks.sort(sortByStatus);

  return (
    <Card className={cn(
      'overflow-hidden border',
      isFullyVisible ? 'border-success/30' : criticalBlockers > 0 ? 'border-destructive/30' : 'border-warning/30'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isFullyVisible ? 'bg-success/10' : criticalBlockers > 0 ? 'bg-destructive/10' : 'bg-warning/10'
          )}>
            <ShieldCheck size={20} className={isFullyVisible ? 'text-success' : criticalBlockers > 0 ? 'text-destructive' : 'text-warning'} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">
              {isFullyVisible
                ? 'Store is fully visible'
                : criticalBlockers > 0
                  ? `${criticalBlockers} visibility blocker(s)`
                  : 'Store visibility issues'}
            </p>
            <p className="text-xs text-muted-foreground">
              {passCount}/{totalChecks} critical checks passed
            </p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={cn(
            'text-muted-foreground transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 pb-4 px-4 space-y-4">
              <CheckGroup groupKey="critical" checks={criticalChecks} />
              <CheckGroup groupKey="products" checks={productChecks} />
              <CheckGroup groupKey="discovery" checks={discoveryChecks} />
              <CheckGroup groupKey="quality" checks={qualityChecks} />
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
