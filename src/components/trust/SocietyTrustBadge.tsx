import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRUST_LABELS: { min: number; label: string; color: string }[] = [
  { min: 9, label: 'Model Community', color: 'text-emerald-600 dark:text-emerald-400' },
  { min: 7, label: 'Thriving', color: 'text-green-600 dark:text-green-400' },
  { min: 5, label: 'Active', color: 'text-blue-600 dark:text-blue-400' },
  { min: 3, label: 'Growing', color: 'text-amber-600 dark:text-amber-400' },
  { min: 0, label: 'Getting Started', color: 'text-muted-foreground' },
];

function getTrustInfo(score: number) {
  return TRUST_LABELS.find(t => score >= t.min) || TRUST_LABELS[TRUST_LABELS.length - 1];
}

export function SocietyTrustBadge() {
  const { profile } = useAuth();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.society_id) return;

    const fetchScore = async () => {
      // First try to get cached score from societies table
      const { data } = await supabase
        .from('societies')
        .select('trust_score')
        .eq('id', profile.society_id!)
        .single();

      if (data) {
        let s = Number(data.trust_score);
        // If score is 0, try computing live
        if (s === 0) {
          const { data: computed } = await supabase.rpc('calculate_society_trust_score', {
            _society_id: profile.society_id!,
          });
          if (computed !== null && computed !== undefined) {
            s = Number(computed);
            // Update cached score
            await supabase
              .from('societies')
              .update({ trust_score: s })
              .eq('id', profile.society_id!);
          }
        }
        setScore(s);
      }
    };

    fetchScore();
  }, [profile?.society_id]);

  if (score === null) return null;

  const info = getTrustInfo(score);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shadow-sm">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Shield className="text-primary" size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Trust Score</p>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold leading-none">{score.toFixed(1)}</span>
          <span className={cn('text-[10px] font-semibold', info.color)}>{info.label}</span>
        </div>
      </div>
      {/* Mini arc indicator */}
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle
            cx="18" cy="18" r="15"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="3"
          />
          <circle
            cx="18" cy="18" r="15"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(score / 10) * 94.2} 94.2`}
          />
        </svg>
      </div>
    </div>
  );
}
