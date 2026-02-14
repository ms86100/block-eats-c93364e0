import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SnagTicketCard } from '@/components/snags/SnagTicketCard';
import { CreateSnagSheet } from '@/components/snags/CreateSnagSheet';
import { SnagDetailSheet } from '@/components/snags/SnagDetailSheet';
import { Wrench } from 'lucide-react';

interface SnagTicket {
  id: string;
  flat_number: string;
  category: string;
  description: string;
  photo_urls: string[];
  status: string;
  sla_deadline: string;
  assigned_to_name: string | null;
  acknowledged_at: string | null;
  fixed_at: string | null;
  verified_at: string | null;
  resolution_note: string | null;
  created_at: string;
  reported_by: string;
  society_id: string;
  tower_id: string | null;
}

export default function SnagListPage() {
  const { society } = useAuth();
  const [tickets, setTickets] = useState<SnagTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SnagTicket | null>(null);

  const fetchTickets = async () => {
    if (!society?.id) return;
    const { data } = await supabase
      .from('snag_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    setTickets((data as any) || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [society?.id]);

  if (isLoading) {
    return (
      <AppLayout headerTitle="Snag Reports" showLocation={false}>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Snag Reports" showLocation={false}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            <h2 className="font-semibold text-sm">Defect Reports</h2>
          </div>
          <CreateSnagSheet onCreated={fetchTickets} />
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wrench className="mx-auto mb-3" size={32} />
            <p className="text-sm">No snag reports yet</p>
            <p className="text-xs mt-1">Report any defects found in your flat</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <SnagTicketCard key={t.id} ticket={t} onClick={() => setSelectedTicket(t)} />
            ))}
          </div>
        )}

        <SnagDetailSheet
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(v) => !v && setSelectedTicket(null)}
          onUpdated={() => { fetchTickets(); setSelectedTicket(null); }}
        />
      </div>
    </AppLayout>
  );
}
