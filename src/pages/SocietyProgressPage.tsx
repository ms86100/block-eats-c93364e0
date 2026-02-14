import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressTimeline } from '@/components/progress/ProgressTimeline';
import { MilestoneCard } from '@/components/progress/MilestoneCard';
import { AddMilestoneSheet } from '@/components/progress/AddMilestoneSheet';
import { HardHat, Construction } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  photos: string[];
  completion_percentage: number;
  posted_by: string;
  created_at: string;
  reactions?: { thumbsup: number; concern: number; user_reaction?: string | null };
}

export default function SocietyProgressPage() {
  const { user, society, isAdmin } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMilestones = async () => {
    if (!society?.id) return;

    const { data, error } = await supabase
      .from('construction_milestones')
      .select('*')
      .eq('society_id', society.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching milestones:', error);
      setIsLoading(false);
      return;
    }

    // Fetch reactions for all milestones
    const milestoneIds = (data || []).map(m => m.id);
    let reactionsMap: Record<string, { thumbsup: number; concern: number; user_reaction?: string | null }> = {};

    if (milestoneIds.length > 0) {
      const { data: reactions } = await supabase
        .from('milestone_reactions')
        .select('milestone_id, user_id, reaction_type')
        .in('milestone_id', milestoneIds);

      for (const id of milestoneIds) {
        const mReactions = (reactions || []).filter(r => r.milestone_id === id);
        reactionsMap[id] = {
          thumbsup: mReactions.filter(r => r.reaction_type === 'thumbsup').length,
          concern: mReactions.filter(r => r.reaction_type === 'concern').length,
          user_reaction: mReactions.find(r => r.user_id === user?.id)?.reaction_type || null,
        };
      }
    }

    setMilestones(
      (data || []).map(m => ({
        ...m,
        photos: m.photos || [],
        reactions: reactionsMap[m.id] || { thumbsup: 0, concern: 0, user_reaction: null },
      }))
    );
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMilestones();
  }, [society?.id]);

  // Compute overall progress
  const latestStage = milestones.length > 0 ? milestones[0].stage : 'foundation';
  const overallPercentage = milestones.length > 0
    ? Math.max(...milestones.map(m => m.completion_percentage))
    : 0;

  const isUnderConstruction = (society as any)?.is_under_construction;

  if (isLoading) {
    return (
      <AppLayout headerTitle="Construction Progress" showLocation={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isUnderConstruction) {
    return (
      <AppLayout headerTitle="Construction Progress" showLocation={false}>
        <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
          <Construction className="text-muted-foreground mb-4" size={48} />
          <h2 className="text-lg font-semibold">Not Available</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This feature is for under-construction societies. Your society is already delivered!
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Construction Progress" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardHat className="text-primary" size={20} />
            <h2 className="font-semibold text-sm">{society?.name}</h2>
          </div>
          {isAdmin && <AddMilestoneSheet onAdded={fetchMilestones} />}
        </div>

        {/* Timeline Overview */}
        <Card>
          <CardContent className="p-4">
            <ProgressTimeline
              currentStage={latestStage}
              overallPercentage={overallPercentage}
            />
          </CardContent>
        </Card>

        {/* Milestones List */}
        <h3 className="text-sm font-semibold text-muted-foreground">
          Updates ({milestones.length})
        </h3>

        {milestones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <HardHat className="mx-auto mb-3" size={32} />
            <p className="text-sm">No milestone updates yet</p>
            {isAdmin && <p className="text-xs mt-1">Tap "Add Milestone" to post the first update</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map(milestone => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                onReactionChange={fetchMilestones}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
