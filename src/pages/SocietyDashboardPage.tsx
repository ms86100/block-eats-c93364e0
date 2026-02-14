import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { SocietyTrustBadge } from '@/components/trust/SocietyTrustBadge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  IndianRupee, Building2, Bug, ShieldAlert, FileText, 
  MessageCircle, Radio, ChevronRight, CreditCard, Clock, BarChart3, Shield,
  Users, ClipboardCheck, Landmark, Package, UserCheck, ShieldCheck, Car, QrCode
} from 'lucide-react';

interface DashboardStat {
  icon: typeof IndianRupee;
  label: string;
  to: string;
  stat: string;
  color: string;
  adminOnly?: boolean;
}

export default function SocietyDashboardPage() {
  const { profile, effectiveSociety, effectiveSocietyId, isAdmin, isSocietyAdmin } = useAuth();
  const [stats, setStats] = useState({
    openSnags: 0,
    openDisputes: 0,
    recentExpenses: 0,
    recentMilestones: 0,
    documents: 0,
    unansweredQs: 0,
    pendingDues: 0,
  });
  const [avgResponseHours, setAvgResponseHours] = useState<number | null>(null);

  useEffect(() => {
    if (!effectiveSocietyId) return;
    fetchStats();
    fetchCommitteeResponseTime();
  }, [effectiveSocietyId]);

  const fetchStats = async () => {
    const sid = effectiveSocietyId!;
    const [snags, disputes, expenses, milestones, docs, questions, dues] = await Promise.all([
      supabase.from('snag_tickets').select('id', { count: 'exact', head: true }).eq('society_id', sid).not('status', 'in', '("fixed","verified","closed")'),
      supabase.from('dispute_tickets').select('id', { count: 'exact', head: true }).eq('society_id', sid).not('status', 'in', '("resolved","closed")'),
      supabase.from('society_expenses').select('id', { count: 'exact', head: true }).eq('society_id', sid).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('construction_milestones').select('id', { count: 'exact', head: true }).eq('society_id', sid).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase.from('project_documents').select('id', { count: 'exact', head: true }).eq('society_id', sid),
      supabase.from('project_questions').select('id', { count: 'exact', head: true }).eq('society_id', sid).eq('is_answered', false),
      supabase.from('maintenance_dues').select('id', { count: 'exact', head: true }).eq('society_id', sid).eq('status', 'pending'),
    ]);

    setStats({
      openSnags: snags.count || 0,
      openDisputes: disputes.count || 0,
      recentExpenses: expenses.count || 0,
      recentMilestones: milestones.count || 0,
      documents: docs.count || 0,
      unansweredQs: questions.count || 0,
      pendingDues: dues.count || 0,
    });
  };

  const fetchCommitteeResponseTime = async () => {
    const sid = effectiveSocietyId!;
    // Get disputes that have been acknowledged (within last 90 days)
    const { data: disputes } = await supabase
      .from('dispute_tickets')
      .select('created_at, acknowledged_at')
      .eq('society_id', sid)
      .not('acknowledged_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString());

    const { data: snags } = await supabase
      .from('snag_tickets')
      .select('created_at, acknowledged_at')
      .eq('society_id', sid)
      .not('acknowledged_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString());

    const allItems = [...(disputes || []), ...(snags || [])];
    if (allItems.length === 0) {
      setAvgResponseHours(null);
      return;
    }

    const totalHours = allItems.reduce((sum, item) => {
      const created = new Date(item.created_at).getTime();
      const acked = new Date(item.acknowledged_at!).getTime();
      return sum + (acked - created) / 3600000;
    }, 0);

    setAvgResponseHours(Math.round(totalHours / allItems.length));
  };

  const cards: DashboardStat[] = [
    { icon: Users, label: 'Visitors', to: '/visitors', stat: 'Gate Management', color: 'text-primary' },
    { icon: UserCheck, label: 'Domestic Help', to: '/domestic-help', stat: 'Attendance tracking', color: 'text-primary' },
    { icon: Package, label: 'Parcels', to: '/parcels', stat: 'Delivery tracking', color: 'text-warning' },
    { icon: Car, label: 'Parking', to: '/parking', stat: 'Slots & violations', color: 'text-primary' },
    { icon: IndianRupee, label: 'Finances', to: '/society/finances', stat: `${stats.recentExpenses} this month`, color: 'text-warning' },
    { icon: Landmark, label: 'Payment Schedule', to: '/payment-milestones', stat: 'Track milestones', color: 'text-info' },
    { icon: Building2, label: 'Construction', to: '/society/progress', stat: `${stats.recentMilestones} updates this week`, color: 'text-primary' },
    { icon: Bug, label: 'Snag Reports', to: '/society/snags', stat: `${stats.openSnags} open`, color: 'text-destructive' },
    { icon: ClipboardCheck, label: 'Inspection', to: '/inspection', stat: 'Pre-handover check', color: 'text-success' },
    { icon: ShieldAlert, label: 'Disputes', to: '/disputes', stat: `${stats.openDisputes} open`, color: 'text-destructive' },
    { icon: FileText, label: 'Documents', to: '/society/progress', stat: `${stats.documents} uploaded`, color: 'text-info' },
    { icon: MessageCircle, label: 'Q&A', to: '/society/progress', stat: `${stats.unansweredQs} unanswered`, color: 'text-primary' },
    { icon: CreditCard, label: 'Maintenance', to: '/maintenance', stat: stats.pendingDues > 0 ? `${stats.pendingDues} pending` : 'All clear', color: 'text-success' },
    ...(isSocietyAdmin ? [
      { icon: QrCode, label: 'Security Verify', to: '/security/verify', stat: 'Scan resident QR', color: 'text-success' } as DashboardStat,
      { icon: ShieldCheck, label: 'Guard Kiosk', to: '/guard-kiosk', stat: 'Verify visitor OTPs', color: 'text-success' } as DashboardStat,
      { icon: Shield, label: 'Society Admin', to: '/society/admin', stat: 'Manage society', color: 'text-info' } as DashboardStat,
    ] : []),
    ...(isAdmin ? [{ icon: Radio, label: 'Platform Admin', to: '/admin', stat: 'Global admin', color: 'text-destructive', adminOnly: true } as DashboardStat] : []),
  ];

  return (
    <AppLayout headerTitle={effectiveSociety?.name || 'Society'} showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Trust Badge */}
        <SocietyTrustBadge />

        {/* Committee Response Time */}
        {avgResponseHours !== null && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. committee response time</p>
                <p className="text-lg font-bold text-primary">
                  {avgResponseHours < 1 ? '<1 hour' : `${avgResponseHours} hour${avgResponseHours !== 1 ? 's' : ''}`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ icon: Icon, label, to, stat, color }) => (
            <Link key={label} to={to}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{stat}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Monthly Report Link */}
        <Link to="/society/reports">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary">
                <BarChart3 size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Monthly Report Card</p>
                <p className="text-[11px] text-muted-foreground">Auto-generated transparency report</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </AppLayout>
  );
}
