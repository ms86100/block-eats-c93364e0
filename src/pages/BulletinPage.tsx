import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CategoryFilter, type BulletinCategory } from '@/components/bulletin/CategoryFilter';
import { PostCard, type BulletinPost } from '@/components/bulletin/PostCard';
import { CreatePostSheet } from '@/components/bulletin/CreatePostSheet';
import { PostDetailSheet } from '@/components/bulletin/PostDetailSheet';
import { MostDiscussedSection } from '@/components/bulletin/MostDiscussedSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Loader2 } from 'lucide-react';

export default function BulletinPage() {
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<BulletinCategory>('all');
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [mostDiscussed, setMostDiscussed] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    if (!profile?.society_id) return;
    setLoading(true);

    let query = supabase
      .from('bulletin_posts')
      .select('*, author:profiles!bulletin_posts_author_id_fkey(name, block, flat_number, avatar_url)')
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
    }

    const { data } = await query;
    setPosts((data as any) || []);
    setLoading(false);
  }, [profile?.society_id, category, search]);

  const fetchMostDiscussed = useCallback(async () => {
    if (!profile?.society_id) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data } = await supabase
      .from('bulletin_posts')
      .select('*, author:profiles!bulletin_posts_author_id_fkey(name, block, flat_number, avatar_url)')
      .eq('is_archived', false)
      .gte('created_at', yesterday.toISOString())
      .order('comment_count', { ascending: false })
      .limit(5);

    setMostDiscussed(((data as any) || []).filter((p: any) => p.comment_count > 0));
  }, [profile?.society_id]);

  const fetchUserVotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bulletin_votes')
      .select('post_id')
      .eq('user_id', user.id)
      .eq('vote_type', 'upvote');
    setUserVotes(new Set((data || []).map(v => v.post_id)));
  }, [user]);

  useEffect(() => {
    fetchPosts();
    fetchMostDiscussed();
    fetchUserVotes();
  }, [fetchPosts, fetchMostDiscussed, fetchUserVotes]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('bulletin-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bulletin_posts' }, () => {
        fetchPosts();
        fetchMostDiscussed();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bulletin_comments' }, () => {
        fetchPosts();
        fetchMostDiscussed();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts, fetchMostDiscussed]);

  const handleUpvote = async (postId: string) => {
    if (!user) return;
    if (userVotes.has(postId)) {
      await supabase
        .from('bulletin_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('vote_type', 'upvote');
      setUserVotes(prev => { const next = new Set(prev); next.delete(postId); return next; });
    } else {
      await supabase.from('bulletin_votes').insert({
        post_id: postId,
        user_id: user.id,
        vote_type: 'upvote',
      });
      setUserVotes(prev => new Set(prev).add(postId));
    }
    fetchPosts();
  };

  const enrichedPosts = posts.map(p => ({
    ...p,
    user_has_voted: userVotes.has(p.id),
  }));

  return (
    <AppLayout headerTitle="Community" showLocation={false}>
      <div className="pt-4 space-y-3">
        {/* Search */}
        <div className="px-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search posts..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Category filter */}
        <CategoryFilter selected={category} onSelect={setCategory} />

        {/* Most discussed */}
        {category === 'all' && (
          <MostDiscussedSection posts={mostDiscussed} onOpen={setSelectedPost} />
        )}

        {/* Posts feed */}
        <div className="px-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : enrichedPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No posts yet. Be the first to share!</p>
            </div>
          ) : (
            enrichedPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onUpvote={handleUpvote}
                onOpen={setSelectedPost}
              />
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <Button
        size="icon"
        className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full shadow-lg"
        onClick={() => setShowCreate(true)}
      >
        <Plus size={22} />
      </Button>

      <CreatePostSheet open={showCreate} onOpenChange={setShowCreate} onCreated={fetchPosts} />
      <PostDetailSheet
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(o) => !o && setSelectedPost(null)}
        onVote={handleUpvote}
      />
    </AppLayout>
  );
}
