import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, ChevronRight, Heart, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { jitteredStaleTime } from '@/lib/query-utils';

interface RecentPost {
  id: string;
  title: string;
  category: string;
  comment_count: number;
  vote_count: number;
  created_at: string;
}

export function CommunityTeaser() {
  const { effectiveSocietyId } = useAuth();

  const { data } = useQuery({
    queryKey: ['community-teaser', effectiveSocietyId],
    queryFn: async () => {
      const [postsRes, helpRes] = await Promise.all([
        supabase
          .from('bulletin_posts')
          .select('id, title, category, comment_count, vote_count, created_at')
          .eq('society_id', effectiveSocietyId!)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(2),
        supabase
          .from('help_requests')
          .select('id', { count: 'exact', head: true })
          .eq('society_id', effectiveSocietyId!)
          .eq('status', 'open'),
      ]);
      return {
        posts: (postsRes.data || []) as RecentPost[],
        helpCount: helpRes.count || 0,
      };
    },
    enabled: !!effectiveSocietyId,
    staleTime: jitteredStaleTime(3 * 60 * 1000),
  });

  const posts = data?.posts || [];
  const helpCount = data?.helpCount || 0;

  if (!effectiveSocietyId || (posts.length === 0 && helpCount === 0)) return null;

  return (
    <div className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-[15px] text-foreground tracking-tight flex items-center gap-1.5">
          <MessageCircle size={15} className="text-primary" />
          Community
        </h3>
        <Link to="/community" className="text-[11px] font-bold text-primary flex items-center gap-0.5">
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="space-y-2.5">
        {helpCount > 0 && (
          <Link to="/community">
            <div className="bg-warning/10 border border-warning/20 rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                <Heart size={16} className="text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {helpCount} neighbor{helpCount !== 1 ? 's' : ''} need{helpCount === 1 ? 's' : ''} help
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">See how you can assist</p>
              </div>
              <ArrowRight size={14} className="text-warning shrink-0" />
            </div>
          </Link>
        )}
        
        {posts.map((post) => (
          <Link key={post.id} to="/community">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform hover:border-primary/20">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground line-clamp-1">{post.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''} · {post.vote_count} vote{post.vote_count !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
