import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { SocietyTrustBadge } from '@/components/trust/SocietyTrustBadge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  IndianRupee, Building2, Bug, ShieldAlert, FileText, 
  MessageCircle, Radio, ChevronRight, CreditCard
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
  const { profile, society, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    openSnags: 0,
    openDisputes: 0,
    recentExpenses: 0,
    recentMilestones: 0,
    documents: 0,
    unansweredQs: 0,
    pendingDues: 0,
  });

  useEffect(() => {
    if (!profile?.society_id) return;
    fetchStats();
  }, [profile?.society_id]);

  const fetchStats = async () => {
    const sid = profile!.society_id!;
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

  const cards: DashboardStat[] = [
    { icon: IndianRupee, label: 'Finances', to: '/society/finances', stat: `${stats.recentExpenses} this month`, color: 'text-warning' },
    { icon: Building2, label: 'Construction', to: '/society/progress', stat: `${stats.recentMilestones} updates this week`, color: 'text-primary' },
    { icon: Bug, label: 'Snag Reports', to: '/society/snags', stat: `${stats.openSnags} open`, color: 'text-destructive' },
    { icon: ShieldAlert, label: 'Disputes', to: '/disputes', stat: `${stats.openDisputes} open`, color: 'text-destructive' },
    { icon: FileText, label: 'Documents', to: '/society/progress', stat: `${stats.documents} uploaded`, color: 'text-info' },
    { icon: MessageCircle, label: 'Q&A', to: '/society/progress', stat: `${stats.unansweredQs} unanswered`, color: 'text-primary' },
    { icon: CreditCard, label: 'Maintenance', to: '/maintenance', stat: stats.pendingDues > 0 ? `${stats.pendingDues} pending` : 'All clear', color: 'text-success' },
    ...(isAdmin ? [{ icon: Radio, label: 'Broadcasts', to: '/admin', stat: 'Admin only', color: 'text-destructive', adminOnly: true } as DashboardStat] : []),
  ];

  return (
    <AppLayout headerTitle={society?.name || 'Society'} showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Trust Badge */}
        <SocietyTrustBadge />

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
      </div>
    </AppLayout>
  );
}
