import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkerRole } from '@/hooks/useWorkerRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Clock, MapPin, IndianRupee, Zap, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { friendlyError } from '@/lib/utils';
import { FeatureGate } from '@/components/ui/FeatureGate';

const JOB_TYPE_LABELS: Record<string, string> = {
  maid: '🧹 Maid / Cleaning',
  cook: '🍳 Cook',
  nanny: '👶 Nanny / Babysitter',
  driver: '🚗 Driver',
  electrician: '⚡ Electrician',
  plumber: '🔧 Plumber',
  gardener: '🌱 Gardener',
  general: '🛠️ General Help',
};

export default function WorkerJobsPage() {
  const { profile, effectiveSocietyId } = useAuth();
  const { isWorker, workerProfile } = useWorkerRole();
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: openJobs = [], isLoading } = useQuery({
    queryKey: ['worker-open-jobs', effectiveSocietyId],
    queryFn: async () => {
      if (!effectiveSocietyId) return [];
      const { data, error } = await supabase
        .from('worker_job_requests')
        .select('*, resident:profiles!worker_job_requests_resident_id_fkey(name, flat_number, block)')
        .eq('society_id', effectiveSocietyId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveSocietyId && isWorker,
  });

  // Realtime subscription for new jobs
  useQuery({
    queryKey: ['worker-jobs-realtime', effectiveSocietyId],
    queryFn: () => {
      if (!effectiveSocietyId) return null;
      const channel = supabase
        .channel('worker-jobs')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'worker_job_requests',
          filter: `society_id=eq.${effectiveSocietyId}`,
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['worker-open-jobs'] });
          queryClient.invalidateQueries({ queryKey: ['worker-my-jobs'] });
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
    enabled: !!effectiveSocietyId && isWorker,
    staleTime: Infinity,
  });

  const acceptJob = useMutation({
    mutationFn: async (jobId: string) => {
      if (!profile?.id) throw new Error('Not logged in');
      const { data, error } = await supabase.rpc('accept_worker_job', {
        _job_id: jobId,
        _worker_id: profile.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Job accepted! The resident will be notified.');
      queryClient.invalidateQueries({ queryKey: ['worker-open-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['worker-my-jobs'] });
      setAcceptingId(null);
    },
    onError: (error: Error) => {
      toast.error(friendlyError(error));
      setAcceptingId(null);
    },
  });

  if (!isWorker) {
    return (
      <AppLayout headerTitle="Jobs">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <AlertCircle className="text-muted-foreground mb-4" size={48} />
          <h2 className="text-lg font-semibold">Worker Access Only</h2>
          <p className="text-sm text-muted-foreground mt-1">You need to be registered as a worker to access this page.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Available Jobs">
      <FeatureGate feature="worker_marketplace">
      <div className="p-4 space-y-4 pb-24">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {workerProfile?.worker_type ? JOB_TYPE_LABELS[workerProfile.worker_type] || workerProfile.worker_type : 'Worker'}
          </Badge>
          <Badge variant={workerProfile?.is_available ? 'default' : 'outline'} className="text-xs">
            {workerProfile?.is_available ? '🟢 Available' : '🔴 Unavailable'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : openJobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase size={40} className="mx-auto mb-3 opacity-50" />
            <p>No open jobs right now</p>
            <p className="text-xs mt-1">New jobs will appear here in real-time</p>
          </div>
        ) : (
          openJobs.map((job: any) => (
            <Card key={job.id} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                  </CardTitle>
                  {job.urgency === 'urgent' && (
                    <Badge variant="destructive" className="text-xs">
                      <Zap size={12} className="mr-1" /> Urgent
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {job.description && (
                  <p className="text-sm text-muted-foreground">{job.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {job.price && (
                    <span className="flex items-center gap-1">
                      <IndianRupee size={12} /> ₹{job.price}
                    </span>
                  )}
                  {job.duration_hours && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {job.duration_hours}h
                    </span>
                  )}
                  {job.start_time && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {format(new Date(job.start_time), 'dd MMM, h:mm a')}
                    </span>
                  )}
                  {job.location_details && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {job.location_details}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  📍 {(job.resident as any)?.block}-{(job.resident as any)?.flat_number}
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  disabled={acceptingId === job.id || acceptJob.isPending}
                  onClick={() => {
                    setAcceptingId(job.id);
                    acceptJob.mutate(job.id);
                  }}
                >
                  <Check size={16} className="mr-1" />
                  {acceptingId === job.id ? 'Accepting...' : 'Accept Job'}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </FeatureGate>
    </AppLayout>
  );
}
