import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreateDisputeSheet } from '@/components/disputes/CreateDisputeSheet';
import { DisputeTicketCard } from '@/components/disputes/DisputeTicketCard';
import { DisputeDetailSheet } from '@/components/disputes/DisputeDetailSheet';
import { Plus, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

export default function DisputesPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tab, setTab] = useState('open');

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('dispute_tickets')
      .select('*')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false });
    setTickets((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status));
  const closedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status));
  const display = tab === 'open' ? openTickets : closedTickets;

  return (
    <AppLayout headerTitle="My Concerns" showLocation={false}>
      <FeatureGate feature="disputes">
      <div className="p-4 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="open">Open ({openTickets.length})</TabsTrigger>
            <TabsTrigger value="closed">Resolved ({closedTickets.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : display.length === 0 ? (
          <div className="text-center py-12">
            <ShieldAlert size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              {tab === 'open' ? 'No open concerns' : 'No resolved concerns'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Raise a concern privately to the committee
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {display.map(ticket => (
              <DisputeTicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setSelectedTicket(ticket)}
              />
            ))}
          </div>
        )}
      </div>

      <Button
        size="icon"
        className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full shadow-lg"
        onClick={() => setShowCreate(true)}
      >
        <Plus size={22} />
      </Button>

      <CreateDisputeSheet open={showCreate} onOpenChange={setShowCreate} onCreated={fetchTickets} />
      <DisputeDetailSheet
        ticket={selectedTicket}
        open={!!selectedTicket}
        onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}
        onUpdated={() => { fetchTickets(); setSelectedTicket(null); }}
      />
      </FeatureGate>
    </AppLayout>
  );
}
