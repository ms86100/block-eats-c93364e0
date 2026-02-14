import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Society, Builder } from '@/types/database';
import { Building2, Users, Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BuilderSociety extends Society {
  pendingUsers?: number;
  totalMembers?: number;
}

export default function BuilderDashboardPage() {
  const { isBuilderMember, managedBuilderIds, isAdmin } = useAuth();
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [societies, setSocieties] = useState<BuilderSociety[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (managedBuilderIds.length === 0 && !isAdmin) return;
    fetchBuilderData();
  }, [managedBuilderIds, isAdmin]);

  const fetchBuilderData = async () => {
    try {
      if (managedBuilderIds.length > 0) {
        const { data: builderData } = await supabase
          .from('builders')
          .select('*')
          .eq('id', managedBuilderIds[0])
          .single();
        setBuilder(builderData as Builder | null);

        // Get societies for this builder
        const { data: bSocieties } = await supabase
          .from('builder_societies')
          .select('society_id')
          .eq('builder_id', managedBuilderIds[0]);

        if (bSocieties && bSocieties.length > 0) {
          const societyIds = bSocieties.map(bs => bs.society_id);
          const { data: societiesData } = await supabase
            .from('societies')
            .select('*')
            .in('id', societyIds);

          // Get member counts per society
          const enriched = await Promise.all(
            ((societiesData as Society[]) || []).map(async (s) => {
              const [pending, total] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('society_id', s.id).eq('verification_status', 'pending'),
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('society_id', s.id).eq('verification_status', 'approved'),
              ]);
              return { ...s, pendingUsers: pending.count || 0, totalMembers: total.count || 0 };
            })
          );
          setSocieties(enriched);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isBuilderMember && !isAdmin) {
    return (
      <AppLayout headerTitle="Builder Dashboard" showLocation={false}>
        <div className="p-4 text-center text-muted-foreground py-20">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="font-medium">Access Denied</p>
          <p className="text-sm">You need builder access to view this page.</p>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout headerTitle="Builder Dashboard" showLocation={false}>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle={builder?.name || 'Builder Dashboard'} showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Aggregate Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Building2 className="mx-auto text-primary mb-1" size={18} />
            <p className="text-lg font-bold">{societies.length}</p>
            <p className="text-[10px] text-muted-foreground">Societies</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Users className="mx-auto text-success mb-1" size={18} />
            <p className="text-lg font-bold">{societies.reduce((sum, s) => sum + (s.totalMembers || 0), 0)}</p>
            <p className="text-[10px] text-muted-foreground">Total Members</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Shield className="mx-auto text-warning mb-1" size={18} />
            <p className="text-lg font-bold">{societies.reduce((sum, s) => sum + (s.pendingUsers || 0), 0)}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent></Card>
        </div>

        {/* Societies List */}
        <h3 className="font-semibold text-sm text-muted-foreground">Managed Societies</h3>
        <div className="space-y-3">
          {societies.map((s) => (
            <Link key={s.id} to={`/society`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.totalMembers} members • {s.pendingUsers! > 0 ? `${s.pendingUsers} pending` : 'No pending'}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {s.is_verified && <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded">Verified</span>}
                      {s.is_active && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Active</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {societies.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No societies assigned to this builder yet</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
