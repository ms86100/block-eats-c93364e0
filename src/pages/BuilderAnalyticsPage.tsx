import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, AlertTriangle, Clock, CheckCircle, Building2, 
  Bug, ShieldAlert, Users, IndianRupee, BarChart3
} from 'lucide-react';

interface SocietyAnalytics {
  id: string;
  name: string;
  totalSnags: number;
  resolvedSnags: number;
  totalDisputes: number;
  resolvedDisputes: number;
  avgResolutionHours: number;
  slaBreached: number;
  slaOnTrack: number;
  revenue: number;
  memberCount: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--info, 200 80% 50%))',
  'hsl(var(--success, 142 76% 36%))',
  'hsl(var(--accent))',
];

export default function BuilderAnalyticsPage() {
  const { managedBuilderIds, isAdmin } = useAuth();
  const [societies, setSocieties] = useState<SocietyAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  useEffect(() => {
    if (managedBuilderIds.length === 0 && !isAdmin) return;
    fetchAnalytics();
  }, [managedBuilderIds, isAdmin]);

  const fetchAnalytics = async () => {
    try {
      // Get builder societies
      const builderId = managedBuilderIds[0];
      if (!builderId) return;

      const { data: bSocieties } = await supabase
        .from('builder_societies')
        .select('society_id, society:societies!builder_societies_society_id_fkey(id, name, member_count)')
        .eq('builder_id', builderId);

      if (!bSocieties || bSocieties.length === 0) { setIsLoading(false); return; }

      const societyIds = bSocieties.map(s => s.society_id);
      
      // Fetch all data in parallel
      const [snagsRes, disputesRes, ordersRes] = await Promise.all([
        supabase.from('snag_tickets')
          .select('id, society_id, status, created_at, acknowledged_at')
          .in('society_id', societyIds),
        supabase.from('dispute_tickets')
          .select('id, society_id, status, created_at, acknowledged_at, resolved_at, sla_deadline')
          .in('society_id', societyIds),
        supabase.from('orders')
          .select('total_amount, society_id, created_at')
          .in('society_id', societyIds)
          .eq('status', 'completed'),
      ]);

      const snags = snagsRes.data || [];
      const disputes = disputesRes.data || [];
      const orders = ordersRes.data || [];
      const now = new Date().toISOString();

      const analyticsMap: SocietyAnalytics[] = bSocieties.map(bs => {
        const s = bs.society as any;
        const societySnags = snags.filter(sn => sn.society_id === bs.society_id);
        const societyDisputes = disputes.filter(d => d.society_id === bs.society_id);
        const societyOrders = orders.filter(o => o.society_id === bs.society_id);

        const resolvedSnags = societySnags.filter(sn => ['fixed', 'verified', 'closed'].includes(sn.status));
        const resolvedDisputes = societyDisputes.filter(d => ['resolved', 'closed'].includes(d.status));
        
        // Calculate avg resolution time from resolved disputes
        const resolvedWithTime = resolvedDisputes.filter(d => d.resolved_at);
        const avgHours = resolvedWithTime.length > 0
          ? resolvedWithTime.reduce((sum, d) => {
              return sum + (new Date(d.resolved_at!).getTime() - new Date(d.created_at).getTime()) / 3600000;
            }, 0) / resolvedWithTime.length
          : 0;

        const openDisputes = societyDisputes.filter(d => !['resolved', 'closed'].includes(d.status));
        const breached = openDisputes.filter(d => d.sla_deadline < now).length;
        const onTrack = openDisputes.filter(d => d.sla_deadline >= now).length;

        return {
          id: bs.society_id,
          name: s?.name || 'Unknown',
          totalSnags: societySnags.length,
          resolvedSnags: resolvedSnags.length,
          totalDisputes: societyDisputes.length,
          resolvedDisputes: resolvedDisputes.length,
          avgResolutionHours: Math.round(avgHours),
          slaBreached: breached,
          slaOnTrack: onTrack,
          revenue: societyOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
          memberCount: s?.member_count || 0,
        };
      });

      setSocieties(analyticsMap);

      // Build monthly trend (last 6 months)
      const months: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        
        const monthSnags = snags.filter(s => s.created_at.startsWith(monthKey));
        const monthDisputes = disputes.filter(dd => dd.created_at.startsWith(monthKey));
        const monthResolvedDisputes = monthDisputes.filter(
          (item) => item.resolved_at && item.resolved_at.startsWith(monthKey)
        );
        const monthResolvedSnags = monthSnags.filter(
          (item) => ['fixed', 'verified', 'closed'].includes(item.status)
        );

        months.push({
          month: label,
          complaints: monthSnags.length + monthDisputes.length,
          resolved: monthResolvedSnags.length + monthResolvedDisputes.length,
        });
      }
      setMonthlyTrend(months);
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => {
    return {
      totalSnags: societies.reduce((s, a) => s + a.totalSnags, 0),
      resolvedSnags: societies.reduce((s, a) => s + a.resolvedSnags, 0),
      totalDisputes: societies.reduce((s, a) => s + a.totalDisputes, 0),
      resolvedDisputes: societies.reduce((s, a) => s + a.resolvedDisputes, 0),
      totalRevenue: societies.reduce((s, a) => s + a.revenue, 0),
      totalMembers: societies.reduce((s, a) => s + a.memberCount, 0),
      totalBreached: societies.reduce((s, a) => s + a.slaBreached, 0),
      totalOnTrack: societies.reduce((s, a) => s + a.slaOnTrack, 0),
      avgResolution: societies.length > 0 
        ? Math.round(societies.reduce((s, a) => s + a.avgResolutionHours, 0) / societies.filter(s => s.avgResolutionHours > 0).length || 0) 
        : 0,
    };
  }, [societies]);

  const resolutionRate = totals.totalSnags + totals.totalDisputes > 0
    ? Math.round(((totals.resolvedSnags + totals.resolvedDisputes) / (totals.totalSnags + totals.totalDisputes)) * 100)
    : 0;

  const snagCategoryData = useMemo(() => {
    const societyData = societies.map(s => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
      snags: s.totalSnags,
      disputes: s.totalDisputes,
      resolved: s.resolvedSnags + s.resolvedDisputes,
    }));
    return societyData;
  }, [societies]);

  const slaData = useMemo(() => [
    { name: 'On Track', value: totals.totalOnTrack },
    { name: 'Breached', value: totals.totalBreached },
  ], [totals]);

  if (isLoading) {
    return (
      <AppLayout headerTitle="Builder Analytics" showLocation={false}>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Portfolio Analytics" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle className="mx-auto text-success mb-1" size={18} />
              <p className="text-xl font-bold">{resolutionRate}%</p>
              <p className="text-[10px] text-muted-foreground">Resolution Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="mx-auto text-warning mb-1" size={18} />
              <p className="text-xl font-bold">{totals.avgResolution}h</p>
              <p className="text-[10px] text-muted-foreground">Avg Resolution</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="mx-auto text-destructive mb-1" size={18} />
              <p className="text-xl font-bold">{totals.totalBreached}</p>
              <p className="text-[10px] text-muted-foreground">SLA Breached</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <IndianRupee className="mx-auto text-primary mb-1" size={18} />
              <p className="text-xl font-bold">₹{totals.totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trends">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="trends" className="text-xs">Trends</TabsTrigger>
            <TabsTrigger value="comparison" className="text-xs">Comparison</TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">SLA</TabsTrigger>
          </TabsList>

          {/* Complaint Trends */}
          <TabsContent value="trends" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp size={16} /> Complaint Volume (6 months)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12 
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="complaints" stroke="hsl(var(--destructive))" strokeWidth={2} name="Raised" />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(var(--primary))" strokeWidth={2} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Society Comparison */}
          <TabsContent value="comparison" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} /> Society Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={snagCategoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12 
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="snags" fill="hsl(var(--warning))" name="Snags" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="disputes" fill="hsl(var(--destructive))" name="Disputes" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" fill="hsl(var(--primary))" name="Resolved" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Per-society breakdown cards */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Per Society</h3>
              {societies.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-primary" />
                        <p className="font-semibold text-sm">{s.name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.memberCount} members</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs font-bold">{s.totalSnags}</p>
                        <p className="text-[9px] text-muted-foreground">Snags</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold">{s.totalDisputes}</p>
                        <p className="text-[9px] text-muted-foreground">Disputes</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary">{s.resolvedSnags + s.resolvedDisputes}</p>
                        <p className="text-[9px] text-muted-foreground">Resolved</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-destructive">{s.slaBreached}</p>
                        <p className="text-[9px] text-muted-foreground">Breached</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SLA Compliance */}
          <TabsContent value="sla" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert size={16} /> SLA Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center p-4">
                {(slaData[0].value + slaData[1].value) > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={slaData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--destructive))" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No open issues to track</p>
                )}
              </CardContent>
            </Card>

            {/* SLA by society */}
            <div className="space-y-2 mt-4">
              {societies.filter(s => s.slaBreached > 0).map(s => (
                <Card key={s.id} className="border-destructive/30">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.avgResolutionHours}h avg resolution</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">{s.slaBreached} breached</p>
                      <p className="text-xs text-muted-foreground">{s.slaOnTrack} on track</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
