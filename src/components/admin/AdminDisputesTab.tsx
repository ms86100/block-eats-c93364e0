import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DisputeTicketCard } from '@/components/disputes/DisputeTicketCard';
import { DisputeDetailSheet } from '@/components/disputes/DisputeDetailSheet';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  is_anonymous: boolean;
  sla_deadline: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  submitted_by: string;
  submitter?: { name: string } | null;
}

export function AdminDisputesTab() {
  const { effectiveSocietyId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!effectiveSocietyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('dispute_tickets')
      .select('*, submitter:profiles!dispute_tickets_submitted_by_fkey(name)')
      .eq('society_id', effectiveSocietyId)
      .order('created_at', { ascending: false });
    setTickets((data as any) || []);
    setLoading(false);
  }, [effectiveSocietyId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openCount = tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length;
  const breachedCount = tickets.filter(t => t.status === 'submitted' && !t.acknowledged_at && new Date(t.sla_deadline) < new Date()).length;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Badge variant="outline">Open: {openCount}</Badge>
        {breachedCount > 0 && <Badge variant="destructive">SLA Breached: {breachedCount}</Badge>}
        <Badge variant="secondary">Total: {tickets.length}</Badge>
      </div>

      {tickets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No dispute tickets</p>
      ) : (
        tickets.map(ticket => (
          <DisputeTicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => setSelected(ticket)}
            showSubmitter
          />
        ))
      )}

      <DisputeDetailSheet
        ticket={selected}
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        onUpdated={() => { fetchTickets(); setSelected(null); }}
        isAdmin
      />
    </div>
  );
}
