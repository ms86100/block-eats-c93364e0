import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, Send } from 'lucide-react';

interface Comment {
  id: string;
  body: string;
  author_id: string;
  is_committee_note: boolean;
  created_at: string;
  author?: { name: string };
}

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  is_anonymous: boolean;
  sla_deadline: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  submitted_by: string;
  submitter?: { name: string } | null;
}

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  isAdmin?: boolean;
}

export function DisputeDetailSheet({ ticket, open, onOpenChange, onUpdated, isAdmin }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (ticket && open) fetchComments();
  }, [ticket, open]);

  const fetchComments = async () => {
    if (!ticket) return;
    const { data } = await supabase
      .from('dispute_comments')
      .select('*, author:profiles!dispute_comments_author_id_fkey(name)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setComments((data as any) || []);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !ticket) return;
    setSending(true);
    try {
      const { error } = await supabase.from('dispute_comments').insert({
        ticket_id: ticket.id,
        author_id: user.id,
        body: newComment.trim(),
        is_committee_note: isAdmin || false,
      } as any);
      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    setUpdating(true);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'acknowledged' && !ticket.acknowledged_at) {
        updates.acknowledged_at = new Date().toISOString();
      }
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('dispute_tickets')
        .update(updates)
        .eq('id', ticket.id);
      if (error) throw error;
      toast({ title: `Ticket ${newStatus}` });
      onUpdated();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  if (!ticket) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">Concern Details</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {/* Ticket Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ticket.category}</Badge>
              <Badge variant="secondary">{ticket.status.replace('_', ' ')}</Badge>
            </div>
            {!ticket.is_anonymous && ticket.submitter && (
              <p className="text-xs text-muted-foreground">By {ticket.submitter.name}</p>
            )}
            {ticket.is_anonymous && (
              <p className="text-xs text-muted-foreground italic">Anonymous submission</p>
            )}
            <p className="text-sm">{ticket.description}</p>
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <span>Filed {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
              <span>SLA: {format(new Date(ticket.sla_deadline), 'MMM d, h:mm a')}</span>
            </div>
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex gap-2">
              <Select onValueChange={handleStatusChange} disabled={updating}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acknowledged">Acknowledge</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="closed">Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Comments */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Discussion</p>
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
            )}
            {comments.map(c => (
              <div key={c.id} className={`rounded-lg p-3 text-sm ${c.author_id === user?.id ? 'bg-primary/10 ml-6' : 'bg-muted mr-6'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{c.author?.name || 'Unknown'}</span>
                  {c.is_committee_note && <Badge variant="secondary" className="text-[8px]">Committee</Badge>}
                </div>
                <p className="text-xs">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Comment Input */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a message..."
            rows={2}
            className="flex-1 text-sm"
          />
          <Button size="icon" onClick={handleSendComment} disabled={sending || !newComment.trim()}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
