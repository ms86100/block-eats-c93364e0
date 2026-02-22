import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { jobRequestSchema, validateForm } from '@/lib/validation-schemas';
import { friendlyError } from '@/lib/utils';
import { FeatureGate } from '@/components/ui/FeatureGate';

const JOB_TYPES = [
  { value: 'maid', label: '🧹 Maid / Cleaning' },
  { value: 'cook', label: '🍳 Cook' },
  { value: 'nanny', label: '👶 Nanny / Babysitter' },
  { value: 'driver', label: '🚗 Driver' },
  { value: 'electrician', label: '⚡ Electrician' },
  { value: 'plumber', label: '🔧 Plumber' },
  { value: 'gardener', label: '🌱 Gardener' },
  { value: 'general', label: '🛠️ General Help' },
];

export default function CreateJobRequestPage() {
  const { profile, effectiveSocietyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jobType, setJobType] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [startTime, setStartTime] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [urgency, setUrgency] = useState('normal');

  const createJob = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !profile?.society_id) throw new Error('Not authenticated');

      const validation = validateForm(jobRequestSchema, {
        job_type: jobType,
        description: description || '',
        price: price ? parseFloat(price) : null,
        duration_hours: parseInt(durationHours) || 1,
        urgency,
      });

      if (!validation.success) {
        const firstError = Object.values((validation as { success: false; errors: Record<string, string> }).errors)[0] as string;
        throw new Error(firstError);
      }

      const { error } = await supabase.from('worker_job_requests').insert({
        society_id: profile.society_id,
        resident_id: profile.id,
        job_type: validation.data.job_type,
        description: validation.data.description || null,
        price: validation.data.price || null,
        duration_hours: validation.data.duration_hours,
        start_time: startTime ? new Date(startTime).toISOString() : null,
        location_details: locationDetails || null,
        urgency: validation.data.urgency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job request posted! Workers will be notified.');
      queryClient.invalidateQueries({ queryKey: ['resident-job-requests'] });
      navigate('/worker-hire');
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  return (
    <AppLayout headerTitle="Post a Job">
      <FeatureGate feature="worker_marketplace">
      <div className="p-4 pb-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What help do you need?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Job Type *</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what you need..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={durationHours}
                  onChange={e => setDurationHours(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <Label>Location Details</Label>
              <Input
                placeholder="e.g. Block A, 3rd floor"
                value={locationDetails}
                onChange={e => setLocationDetails(e.target.value)}
              />
            </div>

            <div>
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexible">🟢 Flexible</SelectItem>
                  <SelectItem value="normal">🟡 Normal</SelectItem>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => createJob.mutate()}
              disabled={createJob.isPending || !jobType}
            >
              {createJob.isPending ? 'Posting...' : 'Post Job Request'}
            </Button>
          </CardContent>
        </Card>
      </div>
      </FeatureGate>
    </AppLayout>
  );
}
